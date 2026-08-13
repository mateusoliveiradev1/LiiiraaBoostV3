#[cfg(not(test))]
pub mod advanced_preference;
pub mod integrity_anchor;
pub mod migrations;

use std::{collections::BTreeMap, path::Path, sync::Arc, time::Duration};

use integrity_anchor::{AnchorHead, IntegrityAnchor, IntegrityAnchorError};
use liiiraa_contracts_rust::validate_transactional_recovery_document;
use rusqlite::{
    Connection, Error as SqliteError, ErrorCode, OptionalExtension, Transaction, params,
};
use serde_json::{Value, json};
use sha2::{Digest, Sha256};
use subtle::ConstantTimeEq;

const BUSY_TIMEOUT: Duration = Duration::from_millis(50);
const GENESIS_MAC: &str =
    "hmac-sha256:0000000000000000000000000000000000000000000000000000000000000000";
const MAC_DOMAIN: &[u8] = b"liiiraa-recovery-journal-v1";
const INITIAL_EPOCH: u32 = 1;

#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub enum RecoveryStoreError {
    Busy,
    Full,
    Io,
    ContractRejected,
    HashMismatch,
    ForeignKeyRejected,
    NotFound,
    InvalidTransition,
    Migration,
    Storage,
    IntegrityAnchorUnavailable,
    AnchorMismatch,
}

#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub enum MutationState {
    Writable,
    ReadOnlyIntegrityAnchorUnavailable,
    ReadOnlyAnchorMismatch,
}

#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub enum FaultPoint {
    FullBeforeCommit,
    IoBeforeCommit,
    AfterCommitBeforeAnchor,
    RotationAfterKeyInstall,
}

#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub struct ConnectionPolicy {
    pub foreign_keys: bool,
    pub journal_mode_wal: bool,
    pub synchronous_full: bool,
}

#[derive(Clone, Debug, Eq, PartialEq)]
pub struct StoredEvent {
    pub sequence: u32,
    pub event_kind: String,
    pub canonical_json: Vec<u8>,
    pub content_hash: String,
    pub key_epoch: u32,
    pub previous_mac: String,
    pub event_mac: String,
}

#[derive(Clone, Debug, Eq, PartialEq)]
pub struct RecoveryDiagnosticEvent {
    pub sequence: u32,
    pub event_kind: String,
    pub content_hash: String,
    pub key_epoch: u32,
    pub event_mac: String,
}

#[derive(Clone, Debug, Eq, PartialEq)]
pub struct RecoveryDiagnosticExport {
    pub database_id: String,
    pub mutation_state: MutationState,
    pub retained_events: Vec<RecoveryDiagnosticEvent>,
}

#[derive(Clone, Debug)]
struct PreparedDocument {
    record_id: String,
    event_kind: String,
    document_sequence: Option<u32>,
    transaction_id: Option<String>,
    canonical_json: Vec<u8>,
    content_hash: String,
}

pub struct RecoveryStore {
    connection: Connection,
    anchor: Arc<dyn IntegrityAnchor>,
    database_id: String,
    mutation_state: MutationState,
    fault: Option<FaultPoint>,
}

impl RecoveryStore {
    pub fn open(path: &Path, anchor: Arc<dyn IntegrityAnchor>) -> Result<Self, RecoveryStoreError> {
        let mut connection = Connection::open(path).map_err(map_sqlite_error)?;
        connection
            .busy_timeout(BUSY_TIMEOUT)
            .map_err(map_sqlite_error)?;
        connection
            .execute_batch(
                "PRAGMA foreign_keys = ON;\n\
                 PRAGMA journal_mode = WAL;\n\
                 PRAGMA synchronous = FULL;",
            )
            .map_err(map_sqlite_error)?;
        verify_connection_policy(&connection)?;
        migrations::migrations()
            .to_latest(&mut connection)
            .map_err(map_migration_error)?;
        connection
            .execute_batch("BEGIN IMMEDIATE; ROLLBACK;")
            .map_err(map_sqlite_error)?;

        let quick_check: String = connection
            .query_row("PRAGMA quick_check", [], |row| row.get(0))
            .map_err(map_sqlite_error)?;
        if quick_check != "ok" {
            return Err(RecoveryStoreError::HashMismatch);
        }

        let existing_database_id = connection
            .query_row(
                "SELECT database_id FROM recovery_metadata WHERE singleton = 1",
                [],
                |row| row.get::<_, String>(0),
            )
            .optional()
            .map_err(map_sqlite_error)?;

        let database_id = match existing_database_id {
            Some(database_id) => database_id,
            None => initialize_database(&connection, anchor.as_ref())?,
        };
        let mutation_state = assess_integrity(&connection, anchor.as_ref(), &database_id);

        Ok(Self {
            connection,
            anchor,
            database_id,
            mutation_state,
            fault: None,
        })
    }

    pub fn connection_policy(&self) -> Result<ConnectionPolicy, RecoveryStoreError> {
        read_connection_policy(&self.connection)
    }

    pub fn mutation_state(&self) -> MutationState {
        self.mutation_state
    }

    pub fn set_fault(&mut self, fault: FaultPoint) {
        self.fault = Some(fault);
    }

    pub fn append_document(&mut self, document: &Value) -> Result<StoredEvent, RecoveryStoreError> {
        self.ensure_writable()?;
        let prepared = prepare_document(document)?;
        self.validate_relationships(document, &prepared)?;
        self.consume_precommit_fault()?;

        let head = self.current_verified_head()?;
        let key = self
            .anchor
            .read_key(head.epoch)
            .map_err(map_anchor_error)?
            .filter(|key| key.len() == 32)
            .ok_or(RecoveryStoreError::IntegrityAnchorUnavailable)?;
        let sequence = next_sequence(head.sequence)?;
        let previous_mac = head.head_mac.clone();
        let event_mac = keyed_event_mac(
            &key,
            &self.database_id,
            head.epoch,
            sequence,
            &prepared.event_kind,
            &prepared.canonical_json,
            &previous_mac,
        )?;
        let stored = StoredEvent {
            sequence,
            event_kind: prepared.event_kind.clone(),
            canonical_json: prepared.canonical_json.clone(),
            content_hash: prepared.content_hash.clone(),
            key_epoch: head.epoch,
            previous_mac,
            event_mac,
        };

        let transaction = self.connection.transaction().map_err(map_sqlite_error)?;
        insert_journal_event(&transaction, &prepared, &stored)?;
        insert_authoritative_projection(&transaction, document, &prepared, &stored)?;
        transaction.commit().map_err(map_sqlite_error)?;

        if self.fault.take() == Some(FaultPoint::AfterCommitBeforeAnchor) {
            self.mutation_state = MutationState::ReadOnlyAnchorMismatch;
            return Err(RecoveryStoreError::AnchorMismatch);
        }

        let next_head = AnchorHead {
            database_id: self.database_id.clone(),
            epoch: head.epoch,
            sequence: Some(sequence),
            head_mac: stored.event_mac.clone(),
        };
        if let Err(error) = self.anchor.compare_and_swap(&head, &next_head) {
            self.mutation_state = state_for_anchor_error(error);
            return Err(map_anchor_error(error));
        }
        Ok(stored)
    }

    pub fn dispatch_after_prepared<T>(
        &mut self,
        document: &Value,
        dispatch: impl FnOnce() -> T,
    ) -> Result<T, RecoveryStoreError> {
        if document.get("kind").and_then(Value::as_str) != Some("journal-event")
            || document.get("state").and_then(Value::as_str) != Some("prepared")
        {
            return Err(RecoveryStoreError::InvalidTransition);
        }
        self.append_document(document)?;
        Ok(dispatch())
    }

    pub fn history(&self) -> Result<Vec<StoredEvent>, RecoveryStoreError> {
        load_history(&self.connection)
    }

    pub fn diagnostic_export(&self) -> Result<RecoveryDiagnosticExport, RecoveryStoreError> {
        let retained_events = self
            .history()?
            .into_iter()
            .map(|event| RecoveryDiagnosticEvent {
                sequence: event.sequence,
                event_kind: event.event_kind,
                content_hash: event.content_hash,
                key_epoch: event.key_epoch,
                event_mac: event.event_mac,
            })
            .collect();
        Ok(RecoveryDiagnosticExport {
            database_id: self.database_id.clone(),
            mutation_state: self.mutation_state,
            retained_events,
        })
    }

    pub fn rebuild_executor_projection(&mut self) -> Result<(), RecoveryStoreError> {
        let transaction = self.connection.transaction().map_err(map_sqlite_error)?;
        transaction
            .execute("DELETE FROM executor_projection", [])
            .map_err(map_sqlite_error)?;
        let events = load_history_from(&transaction)?;
        for event in events {
            if event.event_kind.starts_with("journal-event:") {
                let document: Value = serde_json::from_slice(&event.canonical_json)
                    .map_err(|_| RecoveryStoreError::HashMismatch)?;
                project_executor_event(&transaction, &document, &event)?;
            }
        }
        transaction.commit().map_err(map_sqlite_error)
    }

    pub fn projection_rows(&self) -> Result<Vec<(String, u32, String)>, RecoveryStoreError> {
        let mut statement = self
            .connection
            .prepare(
                "SELECT transaction_id, document_sequence, state
                 FROM executor_projection ORDER BY transaction_id",
            )
            .map_err(map_sqlite_error)?;
        statement
            .query_map([], |row| {
                Ok((
                    row.get::<_, String>(0)?,
                    row.get::<_, u32>(1)?,
                    row.get::<_, String>(2)?,
                ))
            })
            .map_err(map_sqlite_error)?
            .collect::<Result<Vec<_>, _>>()
            .map_err(map_sqlite_error)
    }

    pub fn rotate_key(&mut self) -> Result<(), RecoveryStoreError> {
        self.ensure_writable()?;
        let head = self.current_verified_head()?;
        let old_key = self
            .anchor
            .read_key(head.epoch)
            .map_err(map_anchor_error)?
            .filter(|key| key.len() == 32)
            .ok_or(RecoveryStoreError::IntegrityAnchorUnavailable)?;
        let new_epoch = head
            .epoch
            .checked_add(1)
            .ok_or(RecoveryStoreError::InvalidTransition)?;
        let new_key = random_bytes::<32>()?;
        let sequence = next_sequence(head.sequence)?;
        let document = canonical_json(&json!({
            "kind": "integrity-key-rotation",
            "previousEpoch": head.epoch,
            "newEpoch": new_epoch,
        }))?;
        let event_kind = "integrity-key-rotation".to_owned();
        let event_mac = keyed_event_mac(
            &old_key,
            &self.database_id,
            head.epoch,
            sequence,
            &event_kind,
            &document,
            &head.head_mac,
        )?;
        let stored = StoredEvent {
            sequence,
            event_kind: event_kind.clone(),
            canonical_json: document.clone(),
            content_hash: hash_bytes(&document),
            key_epoch: head.epoch,
            previous_mac: head.head_mac.clone(),
            event_mac,
        };
        let prepared = PreparedDocument {
            record_id: format!("integrity-rotation-{new_epoch}"),
            event_kind,
            document_sequence: None,
            transaction_id: None,
            canonical_json: document,
            content_hash: stored.content_hash.clone(),
        };
        let transaction = self.connection.transaction().map_err(map_sqlite_error)?;
        insert_journal_event(&transaction, &prepared, &stored)?;
        transaction.commit().map_err(map_sqlite_error)?;

        self.anchor
            .install_key(new_epoch, &new_key)
            .map_err(map_anchor_error)?;
        if self.fault.take() == Some(FaultPoint::RotationAfterKeyInstall) {
            self.mutation_state = MutationState::ReadOnlyAnchorMismatch;
            return Err(RecoveryStoreError::AnchorMismatch);
        }
        let next_head = AnchorHead {
            database_id: self.database_id.clone(),
            epoch: new_epoch,
            sequence: Some(sequence),
            head_mac: stored.event_mac,
        };
        if let Err(error) = self.anchor.compare_and_swap(&head, &next_head) {
            self.mutation_state = state_for_anchor_error(error);
            return Err(map_anchor_error(error));
        }
        Ok(())
    }

    fn ensure_writable(&self) -> Result<(), RecoveryStoreError> {
        match self.mutation_state {
            MutationState::Writable => Ok(()),
            MutationState::ReadOnlyIntegrityAnchorUnavailable => {
                Err(RecoveryStoreError::IntegrityAnchorUnavailable)
            }
            MutationState::ReadOnlyAnchorMismatch => Err(RecoveryStoreError::AnchorMismatch),
        }
    }

    fn current_verified_head(&mut self) -> Result<AnchorHead, RecoveryStoreError> {
        self.mutation_state =
            assess_integrity(&self.connection, self.anchor.as_ref(), &self.database_id);
        self.ensure_writable()?;
        self.anchor
            .read_head()
            .map_err(map_anchor_error)?
            .ok_or(RecoveryStoreError::IntegrityAnchorUnavailable)
    }

    fn consume_precommit_fault(&mut self) -> Result<(), RecoveryStoreError> {
        match self.fault {
            Some(FaultPoint::FullBeforeCommit) => {
                self.fault = None;
                Err(RecoveryStoreError::Full)
            }
            Some(FaultPoint::IoBeforeCommit) => {
                self.fault = None;
                Err(RecoveryStoreError::Io)
            }
            _ => Ok(()),
        }
    }

    fn validate_relationships(
        &self,
        document: &Value,
        prepared: &PreparedDocument,
    ) -> Result<(), RecoveryStoreError> {
        match document.get("kind").and_then(Value::as_str) {
            Some("transactional-plan") | Some("operation-promotion") => Ok(()),
            Some("plan-approval") => {
                let plan_id = required_string(document, "planId")?;
                let revision = required_u32(document, "planRevision")?;
                ensure_exists(
                    &self.connection,
                    "SELECT 1 FROM plan_revisions WHERE plan_id = ?1 AND revision = ?2",
                    params![plan_id, revision],
                )
            }
            Some("plan-transaction") => {
                let approval_id = required_string(document, "approvalId")?;
                ensure_exists(
                    &self.connection,
                    "SELECT 1 FROM approval_events WHERE record_id = ?1",
                    params![approval_id],
                )
            }
            Some("recovery-checkpoint") => ensure_exists(
                &self.connection,
                "SELECT 1 FROM transactions WHERE record_id = ?1",
                params![required_string(document, "transactionId")?],
            ),
            Some("transaction-receipt") => self.validate_receipt_head(document),
            Some("journal-event") => {
                let transaction_id = prepared
                    .transaction_id
                    .as_deref()
                    .ok_or(RecoveryStoreError::ContractRejected)?;
                ensure_exists(
                    &self.connection,
                    "SELECT 1 FROM transactions WHERE record_id = ?1",
                    params![transaction_id],
                )?;
                let expected = self
                    .connection
                    .query_row(
                        "SELECT max(document_sequence) FROM journal_events WHERE transaction_id = ?1",
                        [transaction_id],
                        |row| row.get::<_, Option<u32>>(0),
                    )
                    .map_err(map_sqlite_error)?
                    .map(|value| value.checked_add(1).ok_or(RecoveryStoreError::InvalidTransition))
                    .transpose()?
                    .unwrap_or(0);
                if prepared.document_sequence != Some(expected) {
                    return Err(RecoveryStoreError::InvalidTransition);
                }
                Ok(())
            }
            _ => Err(RecoveryStoreError::ContractRejected),
        }
    }

    fn validate_receipt_head(&self, document: &Value) -> Result<(), RecoveryStoreError> {
        let transaction_id = required_string(document, "transactionId")?;
        ensure_exists(
            &self.connection,
            "SELECT 1 FROM transactions WHERE record_id = ?1",
            params![transaction_id],
        )?;
        let canonical = self
            .connection
            .query_row(
                "SELECT canonical_json FROM journal_events
                 WHERE transaction_id = ?1 AND event_kind IN (
                    'journal-event:verified', 'journal-event:restored'
                 )
                 ORDER BY document_sequence DESC LIMIT 1",
                [transaction_id],
                |row| row.get::<_, Vec<u8>>(0),
            )
            .optional()
            .map_err(map_sqlite_error)?
            .ok_or(RecoveryStoreError::InvalidTransition)?;
        let event: Value =
            serde_json::from_slice(&canonical).map_err(|_| RecoveryStoreError::HashMismatch)?;
        if required_string(&event, "eventHash")? != required_string(document, "journalHeadHash")? {
            return Err(RecoveryStoreError::InvalidTransition);
        }
        Ok(())
    }
}

fn initialize_database(
    connection: &Connection,
    anchor: &dyn IntegrityAnchor,
) -> Result<String, RecoveryStoreError> {
    if anchor.read_head().map_err(map_anchor_error)?.is_some() {
        return Err(RecoveryStoreError::AnchorMismatch);
    }
    let database_id = format!("recovery-{}", hex_bytes(&random_bytes::<16>()?));
    let key = random_bytes::<32>()?;
    let head = AnchorHead {
        database_id: database_id.clone(),
        epoch: INITIAL_EPOCH,
        sequence: None,
        head_mac: GENESIS_MAC.to_owned(),
    };
    anchor.initialize(&head, &key).map_err(map_anchor_error)?;
    connection
        .execute(
            "INSERT INTO recovery_metadata (singleton, database_id) VALUES (1, ?1)",
            [&database_id],
        )
        .map_err(map_sqlite_error)?;
    Ok(database_id)
}

fn assess_integrity(
    connection: &Connection,
    anchor: &dyn IntegrityAnchor,
    database_id: &str,
) -> MutationState {
    assess_integrity_result(connection, anchor, database_id).unwrap_or_else(|error| match error {
        RecoveryStoreError::IntegrityAnchorUnavailable => {
            MutationState::ReadOnlyIntegrityAnchorUnavailable
        }
        _ => MutationState::ReadOnlyAnchorMismatch,
    })
}

fn assess_integrity_result(
    connection: &Connection,
    anchor: &dyn IntegrityAnchor,
    database_id: &str,
) -> Result<MutationState, RecoveryStoreError> {
    let protected = anchor
        .read_head()
        .map_err(map_anchor_error)?
        .ok_or(RecoveryStoreError::IntegrityAnchorUnavailable)?;
    if protected.database_id != database_id {
        return Err(RecoveryStoreError::AnchorMismatch);
    }

    let history = load_history(connection)?;
    if history.is_empty() {
        if protected.sequence.is_none()
            && protected.epoch == INITIAL_EPOCH
            && protected.head_mac == GENESIS_MAC
            && anchor
                .read_key(INITIAL_EPOCH)
                .map_err(map_anchor_error)?
                .filter(|key| key.len() == 32)
                .is_some()
        {
            return Ok(MutationState::Writable);
        }
        return Err(RecoveryStoreError::AnchorMismatch);
    }

    let mut expected_previous = GENESIS_MAC.to_owned();
    let mut keys = BTreeMap::<u32, Vec<u8>>::new();
    for (expected_sequence, event) in history.iter().enumerate() {
        if event.sequence != expected_sequence as u32 || event.previous_mac != expected_previous {
            return Err(RecoveryStoreError::AnchorMismatch);
        }
        if hash_bytes(&event.canonical_json) != event.content_hash {
            return Err(RecoveryStoreError::AnchorMismatch);
        }
        let key = match keys.get(&event.key_epoch) {
            Some(key) => key.clone(),
            None => {
                let key = anchor
                    .read_key(event.key_epoch)
                    .map_err(map_anchor_error)?
                    .filter(|key| key.len() == 32)
                    .ok_or(RecoveryStoreError::IntegrityAnchorUnavailable)?;
                keys.insert(event.key_epoch, key.clone());
                key
            }
        };
        let expected_mac = keyed_event_mac(
            &key,
            database_id,
            event.key_epoch,
            event.sequence,
            &event.event_kind,
            &event.canonical_json,
            &event.previous_mac,
        )?;
        if !constant_time_equal(expected_mac.as_bytes(), event.event_mac.as_bytes()) {
            return Err(RecoveryStoreError::AnchorMismatch);
        }
        expected_previous = event.event_mac.clone();
    }

    let latest = history.last().expect("non-empty history");
    let latest_epoch = if latest.event_kind == "integrity-key-rotation" {
        let rotation: Value = serde_json::from_slice(&latest.canonical_json)
            .map_err(|_| RecoveryStoreError::AnchorMismatch)?;
        required_u32(&rotation, "newEpoch").map_err(|_| RecoveryStoreError::AnchorMismatch)?
    } else {
        latest.key_epoch
    };
    if protected.sequence == Some(latest.sequence)
        && protected.epoch == latest_epoch
        && constant_time_equal(protected.head_mac.as_bytes(), latest.event_mac.as_bytes())
    {
        return Ok(MutationState::Writable);
    }

    let prior_sequence = latest.sequence.checked_sub(1);
    let exactly_one_lag = protected.sequence == prior_sequence
        && protected.epoch == latest.key_epoch
        && constant_time_equal(
            protected.head_mac.as_bytes(),
            latest.previous_mac.as_bytes(),
        );
    if exactly_one_lag && latest.event_kind != "integrity-key-rotation" {
        let next = AnchorHead {
            database_id: database_id.to_owned(),
            epoch: latest_epoch,
            sequence: Some(latest.sequence),
            head_mac: latest.event_mac.clone(),
        };
        anchor
            .compare_and_swap(&protected, &next)
            .map_err(map_anchor_error)?;
        return Ok(MutationState::Writable);
    }
    Err(RecoveryStoreError::AnchorMismatch)
}

fn prepare_document(document: &Value) -> Result<PreparedDocument, RecoveryStoreError> {
    validate_transactional_recovery_document(document)
        .map_err(|_| RecoveryStoreError::ContractRejected)?;
    let kind = required_string(document, "kind")?;
    let (record_field, event_kind, transaction_id, document_sequence) = match kind {
        "transactional-plan" => ("planId", kind.to_owned(), None, None),
        "plan-approval" => ("approvalId", kind.to_owned(), None, None),
        "plan-transaction" => ("transactionId", kind.to_owned(), None, None),
        "recovery-checkpoint" => ("checkpointId", kind.to_owned(), None, None),
        "transaction-receipt" => ("receiptId", kind.to_owned(), None, None),
        "operation-promotion" => ("promotionId", kind.to_owned(), None, None),
        "journal-event" => {
            let state = required_string(document, "state")?;
            (
                "eventId",
                format!("journal-event:{state}"),
                Some(required_string(document, "transactionId")?.to_owned()),
                Some(required_u32(document, "sequence")?),
            )
        }
        _ => return Err(RecoveryStoreError::ContractRejected),
    };
    let canonical_json = canonical_json(document)?;
    let record_id = if kind == "transactional-plan" {
        plan_revision_record_id(
            required_string(document, "planId")?,
            required_u32(document, "revision")?,
        )
    } else {
        required_string(document, record_field)?.to_owned()
    };
    Ok(PreparedDocument {
        record_id,
        event_kind,
        document_sequence,
        transaction_id,
        content_hash: hash_bytes(&canonical_json),
        canonical_json,
    })
}

fn plan_revision_record_id(plan_id: &str, revision: u32) -> String {
    let identity = format!("{plan_id}\u{0}{revision}");
    let digest = Sha256::digest(identity.as_bytes());
    format!("plan-revision:{}", hex_bytes(&digest))
}

fn insert_journal_event(
    transaction: &Transaction<'_>,
    prepared: &PreparedDocument,
    stored: &StoredEvent,
) -> Result<(), RecoveryStoreError> {
    transaction
        .execute(
            "INSERT INTO journal_events (
                sequence, record_id, event_kind, document_sequence, transaction_id,
                canonical_json, content_hash, key_id, key_epoch, previous_mac, event_mac
             ) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11)",
            params![
                stored.sequence,
                prepared.record_id,
                prepared.event_kind,
                prepared.document_sequence,
                prepared.transaction_id,
                prepared.canonical_json,
                prepared.content_hash,
                format!("recovery-epoch-{}", stored.key_epoch),
                stored.key_epoch,
                stored.previous_mac,
                stored.event_mac,
            ],
        )
        .map(|_| ())
        .map_err(map_sqlite_error)
}

fn insert_authoritative_projection(
    transaction: &Transaction<'_>,
    document: &Value,
    prepared: &PreparedDocument,
    stored: &StoredEvent,
) -> Result<(), RecoveryStoreError> {
    match required_string(document, "kind")? {
        "transactional-plan" => {
            transaction
                .execute(
                    "INSERT INTO plan_revisions (
                        record_id, integrity_sequence, plan_id, revision, canonical_json, content_hash
                     ) VALUES (?1, ?2, ?3, ?4, ?5, ?6)",
                    params![
                        prepared.record_id,
                        stored.sequence,
                        required_string(document, "planId")?,
                        required_u32(document, "revision")?,
                        prepared.canonical_json,
                        prepared.content_hash,
                    ],
                )
                .map_err(map_sqlite_error)?;
            for operation in document
                .get("operations")
                .and_then(Value::as_array)
                .ok_or(RecoveryStoreError::ContractRejected)?
            {
                let canonical = canonical_json(operation)?;
                transaction
                    .execute(
                        "INSERT INTO plan_operations (
                            record_id, operation_version_id, dependency_group_id,
                            canonical_json, content_hash
                         ) VALUES (?1, ?2, ?3, ?4, ?5)",
                        params![
                            prepared.record_id,
                            required_string(operation, "operationVersionId")?,
                            required_string(operation, "dependencyGroupId")?,
                            canonical,
                            hash_bytes(&canonical),
                        ],
                    )
                    .map_err(map_sqlite_error)?;
            }
        }
        "plan-approval" => {
            transaction
                .execute(
                    "INSERT INTO approval_events (
                        record_id, integrity_sequence, plan_id, plan_revision,
                        canonical_json, content_hash
                     ) VALUES (?1, ?2, ?3, ?4, ?5, ?6)",
                    params![
                        prepared.record_id,
                        stored.sequence,
                        required_string(document, "planId")?,
                        required_u32(document, "planRevision")?,
                        prepared.canonical_json,
                        prepared.content_hash,
                    ],
                )
                .map_err(map_sqlite_error)?;
        }
        "plan-transaction" => {
            transaction
                .execute(
                    "INSERT INTO transactions (
                        record_id, integrity_sequence, plan_id, plan_revision, approval_id,
                        intent, canonical_json, content_hash
                     ) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8)",
                    params![
                        prepared.record_id,
                        stored.sequence,
                        required_string(document, "planId")?,
                        required_u32(document, "planRevision")?,
                        required_string(document, "approvalId")?,
                        required_string(document, "intent")?,
                        prepared.canonical_json,
                        prepared.content_hash,
                    ],
                )
                .map_err(map_sqlite_error)?;
        }
        "recovery-checkpoint" => {
            transaction
                .execute(
                    "INSERT INTO recovery_checkpoints (
                        record_id, integrity_sequence, transaction_id, plan_id,
                        canonical_json, content_hash
                     ) VALUES (?1, ?2, ?3, ?4, ?5, ?6)",
                    params![
                        prepared.record_id,
                        stored.sequence,
                        required_string(document, "transactionId")?,
                        required_string(document, "planId")?,
                        prepared.canonical_json,
                        prepared.content_hash,
                    ],
                )
                .map_err(map_sqlite_error)?;
        }
        "transaction-receipt" => {
            transaction
                .execute(
                    "INSERT INTO receipts (
                        record_id, integrity_sequence, transaction_id, plan_id,
                        operation_version_id, human_summary, technical_summary,
                        canonical_json, content_hash
                     ) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9)",
                    params![
                        prepared.record_id,
                        stored.sequence,
                        required_string(document, "transactionId")?,
                        required_string(document, "planId")?,
                        required_string(document, "operationVersionId")?,
                        required_string(document, "humanSummary")?,
                        required_string(document, "technicalSummary")?,
                        prepared.canonical_json,
                        prepared.content_hash,
                    ],
                )
                .map_err(map_sqlite_error)?;
        }
        "operation-promotion" => {
            transaction
                .execute(
                    "INSERT INTO operation_promotions (
                        record_id, integrity_sequence, operation_version_id, stage,
                        verdict, canonical_json, content_hash
                     ) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7)",
                    params![
                        prepared.record_id,
                        stored.sequence,
                        required_string(document, "operationVersionId")?,
                        required_string(document, "stage")?,
                        required_string(document, "verdict")?,
                        prepared.canonical_json,
                        prepared.content_hash,
                    ],
                )
                .map_err(map_sqlite_error)?;
        }
        "journal-event" => project_executor_event(transaction, document, stored)?,
        _ => return Err(RecoveryStoreError::ContractRejected),
    }
    Ok(())
}

fn project_executor_event(
    transaction: &Transaction<'_>,
    document: &Value,
    stored: &StoredEvent,
) -> Result<(), RecoveryStoreError> {
    transaction
        .execute(
            "INSERT INTO executor_projection (
                transaction_id, document_sequence, state,
                source_integrity_sequence, source_event_mac
             ) VALUES (?1, ?2, ?3, ?4, ?5)
             ON CONFLICT(transaction_id) DO UPDATE SET
                document_sequence = excluded.document_sequence,
                state = excluded.state,
                source_integrity_sequence = excluded.source_integrity_sequence,
                source_event_mac = excluded.source_event_mac
             WHERE excluded.document_sequence > executor_projection.document_sequence",
            params![
                required_string(document, "transactionId")?,
                required_u32(document, "sequence")?,
                required_string(document, "state")?,
                stored.sequence,
                stored.event_mac,
            ],
        )
        .map(|_| ())
        .map_err(map_sqlite_error)
}

fn load_history(connection: &Connection) -> Result<Vec<StoredEvent>, RecoveryStoreError> {
    load_history_from(connection)
}

fn load_history_from(connection: &Connection) -> Result<Vec<StoredEvent>, RecoveryStoreError> {
    let mut statement = connection
        .prepare(
            "SELECT sequence, event_kind, canonical_json, content_hash,
                    key_epoch, previous_mac, event_mac
             FROM journal_events ORDER BY sequence",
        )
        .map_err(map_sqlite_error)?;
    statement
        .query_map([], |row| {
            Ok(StoredEvent {
                sequence: row.get(0)?,
                event_kind: row.get(1)?,
                canonical_json: row.get(2)?,
                content_hash: row.get(3)?,
                key_epoch: row.get(4)?,
                previous_mac: row.get(5)?,
                event_mac: row.get(6)?,
            })
        })
        .map_err(map_sqlite_error)?
        .collect::<Result<Vec<_>, _>>()
        .map_err(map_sqlite_error)
}

fn ensure_exists<P: rusqlite::Params>(
    connection: &Connection,
    sql: &str,
    params: P,
) -> Result<(), RecoveryStoreError> {
    if connection
        .query_row(sql, params, |_| Ok(()))
        .optional()
        .map_err(map_sqlite_error)?
        .is_some()
    {
        Ok(())
    } else {
        Err(RecoveryStoreError::ForeignKeyRejected)
    }
}

fn read_connection_policy(connection: &Connection) -> Result<ConnectionPolicy, RecoveryStoreError> {
    let foreign_keys = connection
        .query_row("PRAGMA foreign_keys", [], |row| row.get::<_, i64>(0))
        .map_err(map_sqlite_error)?
        == 1;
    let journal_mode = connection
        .query_row("PRAGMA journal_mode", [], |row| row.get::<_, String>(0))
        .map_err(map_sqlite_error)?;
    let synchronous = connection
        .query_row("PRAGMA synchronous", [], |row| row.get::<_, i64>(0))
        .map_err(map_sqlite_error)?;
    Ok(ConnectionPolicy {
        foreign_keys,
        journal_mode_wal: journal_mode.eq_ignore_ascii_case("wal"),
        synchronous_full: synchronous == 2,
    })
}

fn verify_connection_policy(connection: &Connection) -> Result<(), RecoveryStoreError> {
    let policy = read_connection_policy(connection)?;
    if policy.foreign_keys && policy.journal_mode_wal && policy.synchronous_full {
        Ok(())
    } else {
        Err(RecoveryStoreError::Storage)
    }
}

fn keyed_event_mac(
    key: &[u8],
    database_id: &str,
    epoch: u32,
    sequence: u32,
    event_kind: &str,
    canonical_json: &[u8],
    previous_mac: &str,
) -> Result<String, RecoveryStoreError> {
    if key.is_empty() {
        return Err(RecoveryStoreError::IntegrityAnchorUnavailable);
    }
    let mut message = Vec::with_capacity(
        MAC_DOMAIN.len()
            + database_id.len()
            + event_kind.len()
            + canonical_json.len()
            + previous_mac.len()
            + 64,
    );
    encode_mac_field(&mut message, MAC_DOMAIN);
    encode_mac_field(&mut message, database_id.as_bytes());
    encode_mac_field(&mut message, &epoch.to_be_bytes());
    encode_mac_field(&mut message, &sequence.to_be_bytes());
    encode_mac_field(&mut message, event_kind.as_bytes());
    encode_mac_field(&mut message, canonical_json);
    encode_mac_field(&mut message, previous_mac.as_bytes());
    Ok(format!(
        "hmac-sha256:{}",
        hex_bytes(&hmac_sha256(key, &message))
    ))
}

fn encode_mac_field(message: &mut Vec<u8>, value: &[u8]) {
    message.extend_from_slice(&(value.len() as u64).to_be_bytes());
    message.extend_from_slice(value);
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
    let inner_digest = inner.finalize();
    let mut outer = Sha256::new();
    outer.update(outer_pad);
    outer.update(inner_digest);
    outer.finalize().into()
}

fn canonical_json(document: &Value) -> Result<Vec<u8>, RecoveryStoreError> {
    serde_json::to_vec(&canonicalize(document)).map_err(|_| RecoveryStoreError::ContractRejected)
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

fn required_string<'a>(document: &'a Value, field: &str) -> Result<&'a str, RecoveryStoreError> {
    document
        .get(field)
        .and_then(Value::as_str)
        .filter(|value| !value.is_empty())
        .ok_or(RecoveryStoreError::ContractRejected)
}

fn required_u32(document: &Value, field: &str) -> Result<u32, RecoveryStoreError> {
    document
        .get(field)
        .and_then(Value::as_u64)
        .and_then(|value| u32::try_from(value).ok())
        .ok_or(RecoveryStoreError::ContractRejected)
}

fn hash_bytes(bytes: &[u8]) -> String {
    format!("sha256:{}", hex_bytes(&Sha256::digest(bytes)))
}

fn hex_bytes(bytes: &[u8]) -> String {
    let mut encoded = String::with_capacity(bytes.len() * 2);
    for byte in bytes {
        use std::fmt::Write as _;
        write!(&mut encoded, "{byte:02x}").expect("write hex byte");
    }
    encoded
}

fn constant_time_equal(left: &[u8], right: &[u8]) -> bool {
    left.len() == right.len() && bool::from(left.ct_eq(right))
}

fn next_sequence(current: Option<u32>) -> Result<u32, RecoveryStoreError> {
    match current {
        None => Ok(0),
        Some(sequence) => sequence
            .checked_add(1)
            .ok_or(RecoveryStoreError::InvalidTransition),
    }
}

#[cfg(target_os = "windows")]
fn random_bytes<const N: usize>() -> Result<[u8; N], RecoveryStoreError> {
    use windows::Win32::Security::Cryptography::{
        BCRYPT_USE_SYSTEM_PREFERRED_RNG, BCryptGenRandom,
    };

    let mut random = [0_u8; N];
    // SAFETY: The system-preferred RNG accepts a null algorithm handle and the owned output
    // buffer remains valid for the duration of the call.
    let status = unsafe { BCryptGenRandom(None, &mut random, BCRYPT_USE_SYSTEM_PREFERRED_RNG) };
    if status.is_ok() {
        Ok(random)
    } else {
        Err(RecoveryStoreError::Storage)
    }
}

#[cfg(not(target_os = "windows"))]
fn random_bytes<const N: usize>() -> Result<[u8; N], RecoveryStoreError> {
    Err(RecoveryStoreError::Storage)
}

fn state_for_anchor_error(error: IntegrityAnchorError) -> MutationState {
    match error {
        IntegrityAnchorError::Unavailable => MutationState::ReadOnlyIntegrityAnchorUnavailable,
        IntegrityAnchorError::Mismatch => MutationState::ReadOnlyAnchorMismatch,
    }
}

fn map_anchor_error(error: IntegrityAnchorError) -> RecoveryStoreError {
    match error {
        IntegrityAnchorError::Unavailable => RecoveryStoreError::IntegrityAnchorUnavailable,
        IntegrityAnchorError::Mismatch => RecoveryStoreError::AnchorMismatch,
    }
}

fn map_sqlite_error(error: SqliteError) -> RecoveryStoreError {
    match error {
        SqliteError::SqliteFailure(inner, _)
            if matches!(
                inner.code,
                ErrorCode::DatabaseBusy | ErrorCode::DatabaseLocked
            ) =>
        {
            RecoveryStoreError::Busy
        }
        SqliteError::SqliteFailure(inner, _) if inner.code == ErrorCode::DiskFull => {
            RecoveryStoreError::Full
        }
        SqliteError::SqliteFailure(inner, _) if inner.code == ErrorCode::SystemIoFailure => {
            RecoveryStoreError::Io
        }
        SqliteError::SqliteFailure(inner, _) if inner.code == ErrorCode::ConstraintViolation => {
            RecoveryStoreError::InvalidTransition
        }
        _ => RecoveryStoreError::Storage,
    }
}

fn map_migration_error(error: rusqlite_migration::Error) -> RecoveryStoreError {
    match error {
        rusqlite_migration::Error::RusqliteError { err, .. } => map_sqlite_error(err),
        _ => RecoveryStoreError::Migration,
    }
}

#[cfg(test)]
mod tests {
    use super::hmac_sha256;

    #[test]
    fn hmac_sha256_matches_rfc_4231_case_one() {
        let key = [0x0b_u8; 20];
        assert_eq!(
            hmac_sha256(&key, b"Hi There"),
            [
                0xb0, 0x34, 0x4c, 0x61, 0xd8, 0xdb, 0x38, 0x53, 0x5c, 0xa8, 0xaf, 0xce, 0xaf, 0x0b,
                0xf1, 0x2b, 0x88, 0x1d, 0xc2, 0x00, 0xc9, 0x83, 0x3d, 0xa7, 0x26, 0xe9, 0x37, 0x6c,
                0x2e, 0x32, 0xcf, 0xf7,
            ]
        );
    }
}
