use std::{
    collections::BTreeSet,
    path::{Path, PathBuf},
    sync::Arc,
};

use liiiraa_contracts_rust::validate_transactional_recovery_document;
use rusqlite::{
    Connection, Error as SqliteError, ErrorCode, OptionalExtension, TransactionBehavior, params,
};
use serde_json::{Value, json};
use sha2::{Digest, Sha256};

use crate::{
    plan_auth::{
        AdvancedPreferenceAction, ConsumedAdvancedPreferenceProof, LocalRecoveryAdmission,
        PlanAuthError,
    },
    recovery_store::{
        MutationState, RecoveryStore,
        integrity_anchor::{AnchorHead, IntegrityAnchor, IntegrityAnchorError},
    },
};

const GENESIS_MAC: &str =
    "hmac-sha256:0000000000000000000000000000000000000000000000000000000000000000";
const MAC_DOMAIN: &[u8] = b"liiiraa-recovery-journal-v1";

#[derive(Clone, Debug, Eq, PartialEq)]
pub struct DevicePosture {
    pub device_id: String,
    pub hardware_fingerprint: String,
    pub security_posture_fingerprint: String,
}

#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub enum AdvancedPreferenceState {
    Disabled,
    Enabled,
    Revoked,
    RevalidationRequired,
}

#[derive(Clone, Debug, Eq, PartialEq)]
pub struct AdvancedPreferenceProjection {
    pub state: AdvancedPreferenceState,
    pub sequence: Option<u32>,
    pub event_count: usize,
    pub device: DevicePosture,
    pub last_event_id: Option<String>,
}

#[derive(Clone, Debug, Eq, PartialEq)]
pub struct AdvancedPreferenceEvent {
    pub sequence: u32,
    pub event_kind: String,
    pub proof_reference: Option<String>,
    pub reason_code: String,
    pub device: DevicePosture,
}

#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub enum AdvancedPreferenceFault {
    FullBeforeCommit,
    IoBeforeCommit,
}

#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub enum AdvancedPreferenceError {
    InvalidProofAction,
    ProofBindingMismatch,
    ProofExpired,
    ProofReplayed,
    InvalidTransition,
    IntegrityFailure,
    StorageFull,
    StorageIo,
    StorageBusy,
    Storage,
}

pub struct AdvancedPreferenceStore {
    path: PathBuf,
    connection: Connection,
    anchor: Arc<dyn IntegrityAnchor>,
    database_id: String,
    current: DevicePosture,
    projection: AdvancedPreferenceProjection,
    fault: Option<AdvancedPreferenceFault>,
}

impl AdvancedPreferenceStore {
    pub fn open(
        path: &Path,
        anchor: Arc<dyn IntegrityAnchor>,
        current: DevicePosture,
        occurred_at: &str,
    ) -> Result<Self, AdvancedPreferenceError> {
        validate_device(&current)?;
        let recovery =
            RecoveryStore::open(path, Arc::clone(&anchor)).map_err(map_recovery_error)?;
        if recovery.mutation_state() != MutationState::Writable {
            return Err(AdvancedPreferenceError::IntegrityFailure);
        }
        drop(recovery);

        let connection = Connection::open(path).map_err(map_sqlite_error)?;
        connection
            .execute_batch(
                "PRAGMA foreign_keys = ON;\nPRAGMA journal_mode = WAL;\nPRAGMA synchronous = FULL;",
            )
            .map_err(map_sqlite_error)?;
        let database_id = connection
            .query_row(
                "SELECT database_id FROM recovery_metadata WHERE singleton = 1",
                [],
                |row| row.get::<_, String>(0),
            )
            .map_err(map_sqlite_error)?;
        let events = load_validated_events(&connection)?;
        if events
            .first()
            .is_some_and(|event| event.device.device_id != current.device_id)
        {
            return Err(AdvancedPreferenceError::IntegrityFailure);
        }
        let mut projection = reduce_projection(&events, current.clone())?;
        if projection.state != AdvancedPreferenceState::Enabled {
            projection.device = current.clone();
        }
        let mut store = Self {
            path: path.to_owned(),
            connection,
            anchor,
            database_id,
            current: current.clone(),
            projection,
            fault: None,
        };
        store.persist_projection()?;
        if store.projection.state == AdvancedPreferenceState::Enabled
            && store.projection.device != current
        {
            store.append_event("invalidated", None, "device-posture-changed", occurred_at)?;
        }
        Ok(store)
    }

    pub fn projection(&self) -> &AdvancedPreferenceProjection {
        &self.projection
    }

    pub fn history(&self) -> Result<Vec<AdvancedPreferenceEvent>, AdvancedPreferenceError> {
        load_validated_events(&self.connection)
    }

    pub fn enable(
        &mut self,
        proof: &ConsumedAdvancedPreferenceProof,
        now_unix_ms: u64,
        occurred_at: &str,
    ) -> Result<(), AdvancedPreferenceError> {
        self.authorize(proof, AdvancedPreferenceAction::Enable, now_unix_ms)?;
        match self.projection.state {
            AdvancedPreferenceState::Disabled
            | AdvancedPreferenceState::Revoked
            | AdvancedPreferenceState::RevalidationRequired => {}
            AdvancedPreferenceState::Enabled => {
                return Err(AdvancedPreferenceError::InvalidTransition);
            }
        }
        self.append_event(
            "enabled",
            Some(proof.evidence_id()),
            if self.projection.state == AdvancedPreferenceState::RevalidationRequired {
                "revalidated-with-fresh-proof"
            } else {
                "enabled-with-fresh-proof"
            },
            occurred_at,
        )
    }

    pub fn revoke(
        &mut self,
        proof: &ConsumedAdvancedPreferenceProof,
        now_unix_ms: u64,
        occurred_at: &str,
    ) -> Result<(), AdvancedPreferenceError> {
        self.authorize(proof, AdvancedPreferenceAction::Revoke, now_unix_ms)?;
        if self.projection.state != AdvancedPreferenceState::Enabled {
            return Err(AdvancedPreferenceError::InvalidTransition);
        }
        self.append_event(
            "revoked",
            Some(proof.evidence_id()),
            "revoked-with-fresh-proof",
            occurred_at,
        )
    }

    pub fn observe_binding(
        &mut self,
        current: DevicePosture,
        occurred_at: &str,
    ) -> Result<(), AdvancedPreferenceError> {
        validate_device(&current)?;
        if current.device_id != self.current.device_id {
            return Err(AdvancedPreferenceError::IntegrityFailure);
        }
        if current == self.current {
            return Ok(());
        }
        self.current = current.clone();
        if self.projection.state == AdvancedPreferenceState::Enabled {
            self.append_event("invalidated", None, "device-posture-changed", occurred_at)
        } else {
            self.projection.device = current;
            self.persist_projection()
        }
    }

    pub fn rebuild_projection(
        &mut self,
    ) -> Result<AdvancedPreferenceProjection, AdvancedPreferenceError> {
        let events = load_validated_events(&self.connection)?;
        self.projection = reduce_projection(&events, self.current.clone())?;
        if self.projection.state != AdvancedPreferenceState::Enabled
            && self.projection.state != AdvancedPreferenceState::RevalidationRequired
        {
            self.projection.device = self.current.clone();
        }
        self.persist_projection()?;
        Ok(self.projection.clone())
    }

    pub fn set_fault(&mut self, fault: AdvancedPreferenceFault) {
        self.fault = Some(fault);
    }

    pub fn recovery_available(&self, _admission: LocalRecoveryAdmission) -> bool {
        true
    }

    pub fn expected_action_for_state(&self) -> AdvancedPreferenceAction {
        match self.projection.state {
            AdvancedPreferenceState::Enabled => AdvancedPreferenceAction::Revoke,
            AdvancedPreferenceState::Disabled
            | AdvancedPreferenceState::Revoked
            | AdvancedPreferenceState::RevalidationRequired => AdvancedPreferenceAction::Enable,
        }
    }

    fn authorize(
        &self,
        proof: &ConsumedAdvancedPreferenceProof,
        expected_action: AdvancedPreferenceAction,
        now_unix_ms: u64,
    ) -> Result<(), AdvancedPreferenceError> {
        let proof_reference = proof
            .authorize(
                expected_action,
                &self.current.device_id,
                &self.current.hardware_fingerprint,
                &self.current.security_posture_fingerprint,
                now_unix_ms,
            )
            .map_err(map_proof_error)?;
        if self
            .connection
            .query_row(
                "SELECT 1 FROM advanced_preference_events WHERE proof_reference = ?1",
                [proof_reference],
                |_| Ok(()),
            )
            .optional()
            .map_err(map_sqlite_error)?
            .is_some()
        {
            return Err(AdvancedPreferenceError::ProofReplayed);
        }
        Ok(())
    }

    fn append_event(
        &mut self,
        event_kind: &'static str,
        proof_reference: Option<&str>,
        reason_code: &'static str,
        occurred_at: &str,
    ) -> Result<(), AdvancedPreferenceError> {
        match self.fault.take() {
            Some(AdvancedPreferenceFault::FullBeforeCommit) => {
                return Err(AdvancedPreferenceError::StorageFull);
            }
            Some(AdvancedPreferenceFault::IoBeforeCommit) => {
                return Err(AdvancedPreferenceError::StorageIo);
            }
            None => {}
        }
        validate_timestamp(occurred_at)?;
        let verifier = RecoveryStore::open(&self.path, Arc::clone(&self.anchor))
            .map_err(map_recovery_error)?;
        if verifier.mutation_state() != MutationState::Writable {
            return Err(AdvancedPreferenceError::IntegrityFailure);
        }
        drop(verifier);

        let history = load_validated_events(&self.connection)?;
        let latest = reduce_projection(&history, self.current.clone())?;
        if latest.state != self.projection.state || latest.sequence != self.projection.sequence {
            return Err(AdvancedPreferenceError::InvalidTransition);
        }
        let preference_sequence = match latest.sequence {
            None => 0,
            Some(sequence) => sequence
                .checked_add(1)
                .ok_or(AdvancedPreferenceError::InvalidTransition)?,
        };
        let event_id = format!("advanced-preference-event-{preference_sequence:010}");
        let contract_event_kind = match event_kind {
            "enabled" => "enabled",
            "revoked" => "revoked",
            "invalidated" => "posture-invalidated",
            _ => return Err(AdvancedPreferenceError::InvalidTransition),
        };
        let proof_id = proof_reference.unwrap_or("native-posture-observation");
        let action = match event_kind {
            "enabled" => "enable-advanced-preference",
            "revoked" => "revoke-advanced-preference",
            "invalidated" => "invalidate-advanced-preference",
            _ => unreachable!(),
        };
        let document = json!({
            "kind": "advanced-preference-event",
            "schemaVersion": "1.0",
            "eventId": event_id,
            "preferenceId": format!("advanced-preference:{}", self.current.device_id),
            "device": {
                "deviceBindingId": self.current.device_id,
                "hardwareFingerprint": self.current.hardware_fingerprint,
                "securityPostureFingerprint": self.current.security_posture_fingerprint,
            },
            "event": contract_event_kind,
            "proof": {
                "proofReference": proof_id,
                "action": action,
                "issuedAt": occurred_at,
                "expiresAt": occurred_at,
            },
            "sequence": preference_sequence,
            "occurredAt": occurred_at,
            "audit": {
                "auditId": format!("advanced-preference-audit-{preference_sequence:010}"),
                "recordedAt": occurred_at,
            }
        });
        validate_transactional_recovery_document(&document)
            .map_err(|_| AdvancedPreferenceError::InvalidTransition)?;
        let canonical_json = canonical_json(&document)?;
        let content_hash = hash_bytes(&canonical_json);

        let protected = self
            .anchor
            .read_head()
            .map_err(map_anchor_error)?
            .ok_or(AdvancedPreferenceError::IntegrityFailure)?;
        if protected.database_id != self.database_id {
            return Err(AdvancedPreferenceError::IntegrityFailure);
        }
        let latest_journal = self
            .connection
            .query_row(
                "SELECT sequence, key_epoch, event_mac FROM journal_events ORDER BY sequence DESC LIMIT 1",
                [],
                |row| Ok((row.get::<_, u32>(0)?, row.get::<_, u32>(1)?, row.get::<_, String>(2)?)),
            )
            .optional()
            .map_err(map_sqlite_error)?;
        let (integrity_sequence, previous_event_mac, key_epoch) = match latest_journal {
            Some((sequence, epoch, event_mac))
                if protected.sequence == Some(sequence)
                    && protected.epoch == epoch
                    && protected.head_mac == event_mac =>
            {
                (
                    sequence
                        .checked_add(1)
                        .ok_or(AdvancedPreferenceError::InvalidTransition)?,
                    event_mac,
                    epoch,
                )
            }
            None if protected.sequence.is_none()
                && protected.epoch == 1
                && protected.head_mac == GENESIS_MAC =>
            {
                (0, GENESIS_MAC.to_owned(), 1)
            }
            _ => return Err(AdvancedPreferenceError::IntegrityFailure),
        };
        let key = self
            .anchor
            .read_key(key_epoch)
            .map_err(map_anchor_error)?
            .filter(|key| key.len() == 32)
            .ok_or(AdvancedPreferenceError::IntegrityFailure)?;
        let journal_kind = format!("advanced-preference:{event_kind}");
        let head_event_mac = keyed_event_mac(
            &key,
            &self.database_id,
            key_epoch,
            integrity_sequence,
            &journal_kind,
            &canonical_json,
            &previous_event_mac,
        );

        let next_projection = AdvancedPreferenceProjection {
            state: match event_kind {
                "enabled" => AdvancedPreferenceState::Enabled,
                "revoked" => AdvancedPreferenceState::Revoked,
                "invalidated" => AdvancedPreferenceState::RevalidationRequired,
                _ => unreachable!(),
            },
            sequence: Some(preference_sequence),
            event_count: history.len() + 1,
            device: self.current.clone(),
            last_event_id: Some(event_id.clone()),
        };
        let transaction = self
            .connection
            .transaction_with_behavior(TransactionBehavior::Immediate)
            .map_err(map_sqlite_error)?;
        transaction
            .execute(
                "INSERT INTO journal_events (
                    sequence, record_id, event_kind, document_sequence, transaction_id,
                    canonical_json, content_hash, key_id, key_epoch, previous_mac, event_mac
                 ) VALUES (?1, ?2, ?3, NULL, NULL, ?4, ?5, ?6, ?7, ?8, ?9)",
                params![
                    integrity_sequence,
                    event_id,
                    journal_kind,
                    canonical_json,
                    content_hash,
                    format!("recovery-epoch-{key_epoch}"),
                    key_epoch,
                    previous_event_mac,
                    head_event_mac,
                ],
            )
            .map_err(map_sqlite_error)?;
        transaction
            .execute(
                "INSERT INTO advanced_preference_events (
                    event_id, integrity_sequence, preference_sequence, event_kind, device_id,
                    hardware_fingerprint, security_posture_fingerprint, proof_reference,
                    reason_code, occurred_at, previous_event_mac, head_event_mac,
                    canonical_json, content_hash
                 ) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13, ?14)",
                params![
                    event_id,
                    integrity_sequence,
                    preference_sequence,
                    event_kind,
                    self.current.device_id,
                    self.current.hardware_fingerprint,
                    self.current.security_posture_fingerprint,
                    proof_reference,
                    reason_code,
                    occurred_at,
                    previous_event_mac,
                    head_event_mac,
                    canonical_json,
                    content_hash,
                ],
            )
            .map_err(map_preference_insert_error)?;
        write_projection(&transaction, &next_projection, &head_event_mac)?;
        transaction.commit().map_err(map_sqlite_error)?;

        let next_head = AnchorHead {
            database_id: self.database_id.clone(),
            epoch: key_epoch,
            sequence: Some(integrity_sequence),
            head_mac: head_event_mac,
        };
        self.anchor
            .compare_and_swap(&protected, &next_head)
            .map_err(map_anchor_error)?;
        self.projection = next_projection;
        Ok(())
    }

    fn persist_projection(&mut self) -> Result<(), AdvancedPreferenceError> {
        let source_mac = self
            .projection
            .sequence
            .and_then(|sequence| {
                self.connection
                    .query_row(
                        "SELECT head_event_mac FROM advanced_preference_events WHERE preference_sequence = ?1",
                        [sequence],
                        |row| row.get::<_, String>(0),
                    )
                    .optional()
                    .ok()
                    .flatten()
            });
        write_projection(
            &self.connection,
            &self.projection,
            source_mac.as_deref().unwrap_or(""),
        )
    }
}

fn validate_device(device: &DevicePosture) -> Result<(), AdvancedPreferenceError> {
    if !bounded_identifier(&device.device_id)
        || !valid_hash(&device.hardware_fingerprint)
        || !valid_hash(&device.security_posture_fingerprint)
    {
        return Err(AdvancedPreferenceError::IntegrityFailure);
    }
    Ok(())
}

fn validate_timestamp(value: &str) -> Result<(), AdvancedPreferenceError> {
    if (20..=64).contains(&value.len()) && value.ends_with('Z') {
        Ok(())
    } else {
        Err(AdvancedPreferenceError::InvalidTransition)
    }
}

fn bounded_identifier(value: &str) -> bool {
    (1..=128).contains(&value.len())
        && value
            .bytes()
            .all(|byte| byte.is_ascii_alphanumeric() || matches!(byte, b'.' | b'_' | b':' | b'-'))
}

fn valid_hash(value: &str) -> bool {
    value.len() == 71
        && value.starts_with("sha256:")
        && value[7..]
            .bytes()
            .all(|byte| byte.is_ascii_hexdigit() && !byte.is_ascii_uppercase())
}

fn load_validated_events(
    connection: &Connection,
) -> Result<Vec<AdvancedPreferenceEvent>, AdvancedPreferenceError> {
    let mut statement = connection
        .prepare(
            "SELECT p.preference_sequence, p.event_kind, p.proof_reference, p.reason_code,
                    p.device_id, p.hardware_fingerprint, p.security_posture_fingerprint,
                    p.previous_event_mac, p.head_event_mac, p.canonical_json, p.content_hash,
                    j.event_kind, j.previous_mac, j.event_mac, j.canonical_json, j.content_hash
             FROM advanced_preference_events p
             JOIN journal_events j ON j.sequence = p.integrity_sequence
             ORDER BY p.preference_sequence",
        )
        .map_err(map_sqlite_error)?;
    let rows = statement
        .query_map([], |row| {
            Ok((
                AdvancedPreferenceEvent {
                    sequence: row.get(0)?,
                    event_kind: row.get(1)?,
                    proof_reference: row.get(2)?,
                    reason_code: row.get(3)?,
                    device: DevicePosture {
                        device_id: row.get(4)?,
                        hardware_fingerprint: row.get(5)?,
                        security_posture_fingerprint: row.get(6)?,
                    },
                },
                row.get::<_, String>(7)?,
                row.get::<_, String>(8)?,
                row.get::<_, Vec<u8>>(9)?,
                row.get::<_, String>(10)?,
                row.get::<_, String>(11)?,
                row.get::<_, String>(12)?,
                row.get::<_, String>(13)?,
                row.get::<_, Vec<u8>>(14)?,
                row.get::<_, String>(15)?,
            ))
        })
        .map_err(map_sqlite_error)?
        .collect::<Result<Vec<_>, _>>()
        .map_err(map_sqlite_error)?;

    let mut proofs = BTreeSet::new();
    let mut events = Vec::with_capacity(rows.len());
    for (expected, row) in rows.into_iter().enumerate() {
        let (
            event,
            previous_event_mac,
            head_event_mac,
            canonical_json,
            content_hash,
            journal_kind,
            journal_previous,
            journal_head,
            journal_json,
            journal_hash,
        ) = row;
        validate_device(&event.device)?;
        if event.sequence != expected as u32
            || journal_kind != format!("advanced-preference:{}", event.event_kind)
            || previous_event_mac != journal_previous
            || head_event_mac != journal_head
            || canonical_json != journal_json
            || content_hash != journal_hash
            || hash_bytes(&canonical_json) != content_hash
        {
            return Err(AdvancedPreferenceError::IntegrityFailure);
        }
        let document: Value = serde_json::from_slice(&canonical_json)
            .map_err(|_| AdvancedPreferenceError::IntegrityFailure)?;
        validate_transactional_recovery_document(&document)
            .map_err(|_| AdvancedPreferenceError::IntegrityFailure)?;
        if document.get("sequence").and_then(Value::as_u64) != Some(u64::from(event.sequence))
            || document
                .get("device")
                .and_then(|value| value.get("deviceBindingId"))
                .and_then(Value::as_str)
                != Some(event.device.device_id.as_str())
            || document
                .get("device")
                .and_then(|value| value.get("hardwareFingerprint"))
                .and_then(Value::as_str)
                != Some(event.device.hardware_fingerprint.as_str())
            || document
                .get("device")
                .and_then(|value| value.get("securityPostureFingerprint"))
                .and_then(Value::as_str)
                != Some(event.device.security_posture_fingerprint.as_str())
        {
            return Err(AdvancedPreferenceError::IntegrityFailure);
        }
        match (&*event.event_kind, event.proof_reference.as_deref()) {
            ("enabled", Some(reference))
                if matches!(
                    event.reason_code.as_str(),
                    "enabled-with-fresh-proof" | "revalidated-with-fresh-proof"
                ) && proofs.insert(reference.to_owned()) => {}
            ("revoked", Some(reference))
                if event.reason_code == "revoked-with-fresh-proof"
                    && proofs.insert(reference.to_owned()) => {}
            ("invalidated", None) if event.reason_code == "device-posture-changed" => {}
            _ => return Err(AdvancedPreferenceError::IntegrityFailure),
        }
        events.push(event);
    }
    Ok(events)
}

fn reduce_projection(
    events: &[AdvancedPreferenceEvent],
    initial_device: DevicePosture,
) -> Result<AdvancedPreferenceProjection, AdvancedPreferenceError> {
    let mut state = AdvancedPreferenceState::Disabled;
    let mut device = initial_device;
    for event in events {
        state = match (state, event.event_kind.as_str()) {
            (
                AdvancedPreferenceState::Disabled
                | AdvancedPreferenceState::Revoked
                | AdvancedPreferenceState::RevalidationRequired,
                "enabled",
            ) => AdvancedPreferenceState::Enabled,
            (AdvancedPreferenceState::Enabled, "revoked") => AdvancedPreferenceState::Revoked,
            (AdvancedPreferenceState::Enabled, "invalidated") => {
                AdvancedPreferenceState::RevalidationRequired
            }
            _ => return Err(AdvancedPreferenceError::IntegrityFailure),
        };
        device = event.device.clone();
    }
    Ok(AdvancedPreferenceProjection {
        state,
        sequence: events.last().map(|event| event.sequence),
        event_count: events.len(),
        device,
        last_event_id: events
            .last()
            .map(|event| format!("advanced-preference-event-{:010}", event.sequence)),
    })
}

fn write_projection(
    connection: &Connection,
    projection: &AdvancedPreferenceProjection,
    source_event_mac: &str,
) -> Result<(), AdvancedPreferenceError> {
    connection
        .execute(
            "INSERT INTO advanced_preference_projection (
                singleton, state, preference_sequence, event_count, device_id,
                hardware_fingerprint, security_posture_fingerprint, last_event_id,
                source_event_mac
             ) VALUES (1, ?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8)
             ON CONFLICT(singleton) DO UPDATE SET
                state = excluded.state,
                preference_sequence = excluded.preference_sequence,
                event_count = excluded.event_count,
                device_id = excluded.device_id,
                hardware_fingerprint = excluded.hardware_fingerprint,
                security_posture_fingerprint = excluded.security_posture_fingerprint,
                last_event_id = excluded.last_event_id,
                source_event_mac = excluded.source_event_mac",
            params![
                state_name(projection.state),
                projection.sequence,
                projection.event_count as u32,
                projection.device.device_id,
                projection.device.hardware_fingerprint,
                projection.device.security_posture_fingerprint,
                projection.last_event_id,
                source_event_mac,
            ],
        )
        .map(|_| ())
        .map_err(map_sqlite_error)
}

fn state_name(state: AdvancedPreferenceState) -> &'static str {
    match state {
        AdvancedPreferenceState::Disabled => "disabled",
        AdvancedPreferenceState::Enabled => "enabled",
        AdvancedPreferenceState::Revoked => "revoked",
        AdvancedPreferenceState::RevalidationRequired => "revalidation-required",
    }
}

fn canonical_json(document: &Value) -> Result<Vec<u8>, AdvancedPreferenceError> {
    serde_json::to_vec(&canonicalize(document)).map_err(|_| AdvancedPreferenceError::Storage)
}

fn canonicalize(value: &Value) -> Value {
    match value {
        Value::Array(values) => Value::Array(values.iter().map(canonicalize).collect()),
        Value::Object(values) => {
            let mut keys = values.keys().collect::<Vec<_>>();
            keys.sort_unstable();
            let mut canonical = serde_json::Map::new();
            for key in keys {
                canonical.insert(key.clone(), canonicalize(&values[key]));
            }
            Value::Object(canonical)
        }
        _ => value.clone(),
    }
}

fn hash_bytes(bytes: &[u8]) -> String {
    format!("sha256:{:x}", Sha256::digest(bytes))
}

fn keyed_event_mac(
    key: &[u8],
    database_id: &str,
    epoch: u32,
    sequence: u32,
    event_kind: &str,
    canonical_json: &[u8],
    previous_mac: &str,
) -> String {
    let mut message = Vec::new();
    for value in [
        MAC_DOMAIN,
        database_id.as_bytes(),
        epoch.to_be_bytes().as_slice(),
        sequence.to_be_bytes().as_slice(),
        event_kind.as_bytes(),
        canonical_json,
        previous_mac.as_bytes(),
    ] {
        message.extend_from_slice(&(value.len() as u64).to_be_bytes());
        message.extend_from_slice(value);
    }
    format!("hmac-sha256:{}", hex_bytes(&hmac_sha256(key, &message)))
}

fn hmac_sha256(key: &[u8], message: &[u8]) -> [u8; 32] {
    const BLOCK_BYTES: usize = 64;
    let mut key_block = [0_u8; BLOCK_BYTES];
    if key.len() > BLOCK_BYTES {
        key_block[..32].copy_from_slice(&Sha256::digest(key));
    } else {
        key_block[..key.len()].copy_from_slice(key);
    }
    let mut inner_pad = [0x36_u8; BLOCK_BYTES];
    let mut outer_pad = [0x5c_u8; BLOCK_BYTES];
    for index in 0..BLOCK_BYTES {
        inner_pad[index] ^= key_block[index];
        outer_pad[index] ^= key_block[index];
    }
    let mut inner = Sha256::new();
    inner.update(inner_pad);
    inner.update(message);
    let mut outer = Sha256::new();
    outer.update(outer_pad);
    outer.update(inner.finalize());
    outer.finalize().into()
}

fn hex_bytes(bytes: &[u8]) -> String {
    let mut encoded = String::with_capacity(bytes.len() * 2);
    for byte in bytes {
        use std::fmt::Write as _;
        write!(&mut encoded, "{byte:02x}").expect("write hex byte");
    }
    encoded
}

fn map_proof_error(error: PlanAuthError) -> AdvancedPreferenceError {
    match error {
        PlanAuthError::InvalidRequest => AdvancedPreferenceError::InvalidProofAction,
        PlanAuthError::ProofRejected => AdvancedPreferenceError::ProofBindingMismatch,
        PlanAuthError::InvalidResponse => AdvancedPreferenceError::ProofExpired,
        _ => AdvancedPreferenceError::ProofBindingMismatch,
    }
}

fn map_recovery_error(_: crate::recovery_store::RecoveryStoreError) -> AdvancedPreferenceError {
    AdvancedPreferenceError::IntegrityFailure
}

fn map_anchor_error(_: IntegrityAnchorError) -> AdvancedPreferenceError {
    AdvancedPreferenceError::IntegrityFailure
}

fn map_preference_insert_error(error: SqliteError) -> AdvancedPreferenceError {
    match error {
        SqliteError::SqliteFailure(inner, _) if inner.code == ErrorCode::ConstraintViolation => {
            AdvancedPreferenceError::ProofReplayed
        }
        other => map_sqlite_error(other),
    }
}

fn map_sqlite_error(error: SqliteError) -> AdvancedPreferenceError {
    match error {
        SqliteError::SqliteFailure(inner, _)
            if matches!(
                inner.code,
                ErrorCode::DatabaseBusy | ErrorCode::DatabaseLocked
            ) =>
        {
            AdvancedPreferenceError::StorageBusy
        }
        SqliteError::SqliteFailure(inner, _) if inner.code == ErrorCode::DiskFull => {
            AdvancedPreferenceError::StorageFull
        }
        SqliteError::SqliteFailure(inner, _) if inner.code == ErrorCode::SystemIoFailure => {
            AdvancedPreferenceError::StorageIo
        }
        _ => AdvancedPreferenceError::Storage,
    }
}
