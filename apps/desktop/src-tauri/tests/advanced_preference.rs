#[path = "../src/recovery_store/advanced_preference.rs"]
mod advanced_preference;
#[path = "../src/credential_store.rs"]
mod credential_store;
#[path = "../src/plan_auth.rs"]
mod plan_auth;
#[path = "../src/recovery_store/mod.rs"]
mod recovery_store;

use std::{
    cell::RefCell,
    collections::BTreeMap,
    fs,
    path::{Path, PathBuf},
    sync::{
        Arc, Barrier, Mutex,
        atomic::{AtomicU64, Ordering},
    },
    thread,
};

use advanced_preference::{
    AdvancedPreferenceError, AdvancedPreferenceFault, AdvancedPreferenceState,
    AdvancedPreferenceStore, DevicePosture,
};
use credential_store::{CredentialStore, CredentialStoreError};
use plan_auth::{
    AdvancedPreferenceAction, AdvancedPreferenceApprovalRequest, ConsumedAdvancedPreferenceProof,
    OpaqueApprovalReceipt, PlanApprovalApi, PlanApprovalApiResponse,
    consume_advanced_preference_approval,
};
use recovery_store::integrity_anchor::{AnchorHead, IntegrityAnchor, IntegrityAnchorError};
use rusqlite::Connection;
use serde_json::json;
use sha2::{Digest, Sha256};

const NOW_MS: u64 = 1_895_227_200_000;
const AT_1: &str = "2030-01-20T00:00:00Z";
const AT_2: &str = "2030-01-20T00:01:00Z";
const AT_3: &str = "2030-01-20T00:02:00Z";
const CREDENTIAL: &str = "credential-in-windows-credential-manager";
static NEXT_DATABASE: AtomicU64 = AtomicU64::new(1);

struct TestDatabase {
    path: PathBuf,
}

impl TestDatabase {
    fn new() -> Self {
        let id = NEXT_DATABASE.fetch_add(1, Ordering::Relaxed);
        let path = std::env::temp_dir().join(format!(
            "liiiraa-advanced-preference-{}-{id}.sqlite3",
            std::process::id()
        ));
        for candidate in [
            &path,
            &path.with_extension("sqlite3-wal"),
            &path.with_extension("sqlite3-shm"),
        ] {
            let _ = fs::remove_file(candidate);
        }
        Self { path }
    }
}

impl Drop for TestDatabase {
    fn drop(&mut self) {
        for candidate in [
            self.path.clone(),
            PathBuf::from(format!("{}-wal", self.path.display())),
            PathBuf::from(format!("{}-shm", self.path.display())),
        ] {
            let _ = fs::remove_file(candidate);
        }
    }
}

#[derive(Clone, Debug, Default)]
struct FakeAnchor {
    state: Arc<Mutex<FakeAnchorState>>,
}

#[derive(Debug, Default)]
struct FakeAnchorState {
    head: Option<AnchorHead>,
    keys: BTreeMap<u32, Vec<u8>>,
}

impl IntegrityAnchor for FakeAnchor {
    fn read_head(&self) -> Result<Option<AnchorHead>, IntegrityAnchorError> {
        Ok(self.state.lock().unwrap().head.clone())
    }

    fn read_key(&self, epoch: u32) -> Result<Option<Vec<u8>>, IntegrityAnchorError> {
        Ok(self.state.lock().unwrap().keys.get(&epoch).cloned())
    }

    fn initialize(&self, head: &AnchorHead, key: &[u8]) -> Result<(), IntegrityAnchorError> {
        let mut state = self.state.lock().unwrap();
        if state.head.is_some() {
            return Err(IntegrityAnchorError::Mismatch);
        }
        state.keys.insert(head.epoch, key.to_vec());
        state.head = Some(head.clone());
        Ok(())
    }

    fn install_key(&self, epoch: u32, key: &[u8]) -> Result<(), IntegrityAnchorError> {
        self.state.lock().unwrap().keys.insert(epoch, key.to_vec());
        Ok(())
    }

    fn compare_and_swap(
        &self,
        expected: &AnchorHead,
        next: &AnchorHead,
    ) -> Result<(), IntegrityAnchorError> {
        let mut state = self.state.lock().unwrap();
        if state.head.as_ref() != Some(expected) {
            return Err(IntegrityAnchorError::Mismatch);
        }
        state.head = Some(next.clone());
        Ok(())
    }
}

#[derive(Default)]
struct MemoryCredentialStore;

impl CredentialStore for MemoryCredentialStore {
    fn write_rotated_credential(&self, _credential: &str) -> Result<(), CredentialStoreError> {
        Ok(())
    }

    fn read_credential(&self) -> Result<Option<String>, CredentialStoreError> {
        Ok(Some(CREDENTIAL.to_owned()))
    }

    fn delete_credential(&self) -> Result<(), CredentialStoreError> {
        Ok(())
    }
}

struct ProofApi(RefCell<Option<PlanApprovalApiResponse>>);

impl PlanApprovalApi for ProofApi {
    fn consume(
        &self,
        _credential: &str,
        _body: &[u8],
    ) -> Result<PlanApprovalApiResponse, plan_auth::PlanAuthError> {
        self.0
            .borrow_mut()
            .take()
            .ok_or(plan_auth::PlanAuthError::ProofRejected)
    }
}

fn fingerprint(label: &str) -> String {
    format!("sha256:{:x}", Sha256::digest(label.as_bytes()))
}

fn device(device_id: &str, hardware: &str, security: &str) -> DevicePosture {
    DevicePosture {
        device_id: device_id.to_owned(),
        hardware_fingerprint: fingerprint(hardware),
        security_posture_fingerprint: fingerprint(security),
    }
}

fn default_device() -> DevicePosture {
    device("device-0001", "hardware-a", "security-a")
}

fn proof(
    action: AdvancedPreferenceAction,
    binding: &DevicePosture,
    evidence_id: &str,
) -> ConsumedAdvancedPreferenceProof {
    let wire_action = match action {
        AdvancedPreferenceAction::Enable => "enable-advanced-preference",
        AdvancedPreferenceAction::Revoke => "revoke-advanced-preference",
    };
    let target = [
        wire_action,
        binding.device_id.as_str(),
        binding.hardware_fingerprint.as_str(),
        binding.security_posture_fingerprint.as_str(),
    ]
    .join("|");
    let response = PlanApprovalApiResponse {
        status: 200,
        body: serde_json::to_vec(&json!({
            "ok": true,
            "proof": {
                "kind": "consumed-advanced-preference",
                "action": wire_action,
                "resource": "desktop-risk-preference",
                "authorizationContextId": "advanced-review-0001",
                "evidenceId": evidence_id,
                "deviceId": binding.device_id,
                "targetFingerprint": format!("{:x}", Sha256::digest(target.as_bytes())),
                "verifiedAtUnixMs": NOW_MS - 60_000,
                "expiresAtUnixMs": NOW_MS + 240_000,
                "consumedAtUnixMs": NOW_MS
            }
        }))
        .unwrap(),
    };
    let api = ProofApi(RefCell::new(Some(response)));
    consume_advanced_preference_approval(
        &MemoryCredentialStore,
        &api,
        AdvancedPreferenceApprovalRequest {
            action,
            authorization_context_id: "advanced-review-0001".to_owned(),
            device_id: binding.device_id.clone(),
            hardware_fingerprint: binding.hardware_fingerprint.clone(),
            receipt: OpaqueApprovalReceipt::from_native_response(
                "opaque_native_receipt_abcdefghijklmnopqrstuvwxyz_0123456789".to_owned(),
            )
            .unwrap(),
            security_posture_fingerprint: binding.security_posture_fingerprint.clone(),
        },
        NOW_MS,
    )
    .unwrap()
}

fn open(
    database: &TestDatabase,
    anchor: &FakeAnchor,
    binding: DevicePosture,
    occurred_at: &str,
) -> Result<AdvancedPreferenceStore, AdvancedPreferenceError> {
    AdvancedPreferenceStore::open(
        &database.path,
        Arc::new(anchor.clone()),
        binding,
        occurred_at,
    )
}

fn count_events(path: &Path) -> i64 {
    Connection::open(path)
        .unwrap()
        .query_row(
            "SELECT count(*) FROM advanced_preference_events",
            [],
            |row| row.get(0),
        )
        .unwrap()
}

#[test]
fn starts_disabled_and_enables_only_after_exact_fresh_proof_and_durable_append() {
    let database = TestDatabase::new();
    let anchor = FakeAnchor::default();
    let binding = default_device();
    let mut store = open(&database, &anchor, binding.clone(), AT_1).unwrap();
    assert_eq!(store.projection().state, AdvancedPreferenceState::Disabled);
    assert_eq!(store.projection().event_count, 0);

    store
        .enable(
            &proof(AdvancedPreferenceAction::Enable, &binding, "enable-proof-1"),
            NOW_MS,
            AT_1,
        )
        .unwrap();
    assert_eq!(store.projection().state, AdvancedPreferenceState::Enabled);
    assert_eq!(store.projection().event_count, 1);
    assert_eq!(count_events(&database.path), 1);
}

#[test]
fn restart_rebuilds_an_identical_projection_for_the_exact_device_and_posture() {
    let database = TestDatabase::new();
    let anchor = FakeAnchor::default();
    let binding = default_device();
    let before = {
        let mut store = open(&database, &anchor, binding.clone(), AT_1).unwrap();
        store
            .enable(
                &proof(AdvancedPreferenceAction::Enable, &binding, "enable-proof-2"),
                NOW_MS,
                AT_1,
            )
            .unwrap();
        store.projection().clone()
    };
    let mut reopened = open(&database, &anchor, binding, AT_2).unwrap();
    assert_eq!(reopened.projection(), &before);
    assert_eq!(reopened.rebuild_projection().unwrap(), before);
}

#[test]
fn revoke_requires_a_distinct_action_proof_and_preserves_history() {
    let database = TestDatabase::new();
    let anchor = FakeAnchor::default();
    let binding = default_device();
    let mut store = open(&database, &anchor, binding.clone(), AT_1).unwrap();
    let enable = proof(AdvancedPreferenceAction::Enable, &binding, "enable-proof-3");
    store.enable(&enable, NOW_MS, AT_1).unwrap();

    assert_eq!(
        store.revoke(&enable, NOW_MS, AT_2),
        Err(AdvancedPreferenceError::InvalidProofAction)
    );
    assert_eq!(store.history().unwrap().len(), 1);

    store
        .revoke(
            &proof(AdvancedPreferenceAction::Revoke, &binding, "revoke-proof-1"),
            NOW_MS,
            AT_2,
        )
        .unwrap();
    assert_eq!(store.projection().state, AdvancedPreferenceState::Revoked);
    assert_eq!(store.history().unwrap().len(), 2);
}

#[test]
fn stale_replayed_cross_action_and_wrong_device_proofs_never_mutate_preference() {
    let database = TestDatabase::new();
    let anchor = FakeAnchor::default();
    let binding = default_device();
    let wrong = device("device-0002", "hardware-a", "security-a");
    let mut store = open(&database, &anchor, binding.clone(), AT_1).unwrap();

    assert_eq!(
        store.enable(
            &proof(AdvancedPreferenceAction::Enable, &binding, "stale-proof"),
            NOW_MS + 300_000,
            AT_1,
        ),
        Err(AdvancedPreferenceError::ProofExpired)
    );
    assert_eq!(
        store.enable(
            &proof(
                AdvancedPreferenceAction::Revoke,
                &binding,
                "cross-action-proof"
            ),
            NOW_MS,
            AT_1,
        ),
        Err(AdvancedPreferenceError::InvalidProofAction)
    );
    assert_eq!(
        store.enable(
            &proof(
                AdvancedPreferenceAction::Enable,
                &wrong,
                "wrong-device-proof"
            ),
            NOW_MS,
            AT_1,
        ),
        Err(AdvancedPreferenceError::ProofBindingMismatch)
    );
    assert_eq!(count_events(&database.path), 0);

    store
        .enable(
            &proof(AdvancedPreferenceAction::Enable, &binding, "one-use-proof"),
            NOW_MS,
            AT_1,
        )
        .unwrap();
    let replayed = proof(AdvancedPreferenceAction::Revoke, &binding, "one-use-proof");
    assert_eq!(
        store.revoke(&replayed, NOW_MS, AT_2),
        Err(AdvancedPreferenceError::ProofReplayed)
    );
    assert_eq!(count_events(&database.path), 1);
}

#[test]
fn hardware_or_security_change_appends_invalidation_before_reenable() {
    for changed in [
        device("device-0001", "hardware-b", "security-a"),
        device("device-0001", "hardware-a", "security-b"),
    ] {
        let database = TestDatabase::new();
        let anchor = FakeAnchor::default();
        let original = default_device();
        let mut store = open(&database, &anchor, original.clone(), AT_1).unwrap();
        store
            .enable(
                &proof(
                    AdvancedPreferenceAction::Enable,
                    &original,
                    "enable-before-change",
                ),
                NOW_MS,
                AT_1,
            )
            .unwrap();
        store.observe_binding(changed.clone(), AT_2).unwrap();
        assert_eq!(
            store.projection().state,
            AdvancedPreferenceState::RevalidationRequired
        );
        assert_eq!(store.history().unwrap()[1].event_kind, "invalidated");

        assert_eq!(
            store.enable(
                &proof(
                    AdvancedPreferenceAction::Enable,
                    &original,
                    "old-binding-proof"
                ),
                NOW_MS,
                AT_3,
            ),
            Err(AdvancedPreferenceError::ProofBindingMismatch)
        );
        store
            .enable(
                &proof(
                    AdvancedPreferenceAction::Enable,
                    &changed,
                    "fresh-binding-proof",
                ),
                NOW_MS,
                AT_3,
            )
            .unwrap();
        assert_eq!(store.projection().state, AdvancedPreferenceState::Enabled);
        assert_eq!(store.history().unwrap().len(), 3);
    }
}

#[test]
fn changed_posture_is_invalidated_automatically_during_restart_open() {
    let database = TestDatabase::new();
    let anchor = FakeAnchor::default();
    let original = default_device();
    {
        let mut store = open(&database, &anchor, original.clone(), AT_1).unwrap();
        store
            .enable(
                &proof(
                    AdvancedPreferenceAction::Enable,
                    &original,
                    "enable-before-restart",
                ),
                NOW_MS,
                AT_1,
            )
            .unwrap();
    }
    let changed = device("device-0001", "hardware-a", "security-after-restart");
    let reopened = open(&database, &anchor, changed, AT_2).unwrap();
    assert_eq!(
        reopened.projection().state,
        AdvancedPreferenceState::RevalidationRequired
    );
    assert_eq!(reopened.history().unwrap().len(), 2);
}

#[test]
fn repeated_read_and_preapply_revalidation_append_only_one_invalidation() {
    let database = TestDatabase::new();
    let anchor = FakeAnchor::default();
    let original = default_device();
    let changed = device("device-0001", "hardware-a", "security-after-read");
    let mut store = open(&database, &anchor, original.clone(), AT_1).unwrap();
    store
        .enable(
            &proof(
                AdvancedPreferenceAction::Enable,
                &original,
                "enable-before-revalidation",
            ),
            NOW_MS,
            AT_1,
        )
        .unwrap();

    store.observe_binding(changed.clone(), AT_2).unwrap();
    store.observe_binding(changed, AT_3).unwrap();

    assert_eq!(
        store.projection().state,
        AdvancedPreferenceState::RevalidationRequired
    );
    assert_eq!(store.history().unwrap().len(), 2);
}

#[test]
fn append_only_history_rejects_update_delete_and_detects_chain_tamper() {
    let database = TestDatabase::new();
    let anchor = FakeAnchor::default();
    let binding = default_device();
    {
        let mut store = open(&database, &anchor, binding.clone(), AT_1).unwrap();
        store
            .enable(
                &proof(
                    AdvancedPreferenceAction::Enable,
                    &binding,
                    "immutable-proof",
                ),
                NOW_MS,
                AT_1,
            )
            .unwrap();
    }
    let connection = Connection::open(&database.path).unwrap();
    assert!(
        connection
            .execute(
                "UPDATE advanced_preference_events SET reason_code = 'changed'",
                []
            )
            .is_err()
    );
    assert!(
        connection
            .execute("DELETE FROM advanced_preference_events", [])
            .is_err()
    );
    connection
        .execute_batch(
            "DROP TRIGGER advanced_preference_events_no_update;
         UPDATE advanced_preference_events SET reason_code = 'tampered';",
        )
        .unwrap();
    drop(connection);
    assert!(matches!(
        open(&database, &anchor, binding, AT_2),
        Err(AdvancedPreferenceError::IntegrityFailure)
    ));
}

#[test]
fn full_and_io_failures_leave_no_preference_event_or_enabled_projection() {
    for (fault, expected) in [
        (
            AdvancedPreferenceFault::FullBeforeCommit,
            AdvancedPreferenceError::StorageFull,
        ),
        (
            AdvancedPreferenceFault::IoBeforeCommit,
            AdvancedPreferenceError::StorageIo,
        ),
    ] {
        let database = TestDatabase::new();
        let anchor = FakeAnchor::default();
        let binding = default_device();
        let mut store = open(&database, &anchor, binding.clone(), AT_1).unwrap();
        store.set_fault(fault);
        assert_eq!(
            store.enable(
                &proof(
                    AdvancedPreferenceAction::Enable,
                    &binding,
                    "failed-append-proof"
                ),
                NOW_MS,
                AT_1
            ),
            Err(expected)
        );
        assert_eq!(store.projection().state, AdvancedPreferenceState::Disabled);
        assert_eq!(count_events(&database.path), 0);
    }
}

#[test]
fn recovery_is_available_without_auth_network_or_enabled_preference() {
    for state in ["disabled", "revoked", "invalidated"] {
        let database = TestDatabase::new();
        let anchor = FakeAnchor::default();
        let binding = default_device();
        let mut store = open(&database, &anchor, binding.clone(), AT_1).unwrap();
        if state != "disabled" {
            store
                .enable(
                    &proof(
                        AdvancedPreferenceAction::Enable,
                        &binding,
                        &format!("enable-{state}"),
                    ),
                    NOW_MS,
                    AT_1,
                )
                .unwrap();
        }
        if state == "revoked" {
            store
                .revoke(
                    &proof(
                        AdvancedPreferenceAction::Revoke,
                        &binding,
                        "recovery-revoke",
                    ),
                    NOW_MS,
                    AT_2,
                )
                .unwrap();
        } else if state == "invalidated" {
            store
                .observe_binding(
                    device("device-0001", "hardware-changed", "security-a"),
                    AT_2,
                )
                .unwrap();
        }
        assert!(store.recovery_available(plan_auth::admit_local_recovery()));
    }
}

#[test]
fn preference_is_only_in_recovery_sqlite_and_has_no_cloud_sync_surface() {
    let source = include_str!("../src/recovery_store/advanced_preference.rs");
    for prohibited in [
        "account_sync",
        "localStorage",
        "tauri_plugin_store",
        "cloud",
    ] {
        assert!(
            !source.contains(prohibited),
            "prohibited preference surface: {prohibited}"
        );
    }
}

#[test]
fn state_action_table_rejects_every_non_transition_without_an_append() {
    for initial in ["disabled", "enabled", "revoked", "invalidated"] {
        let database = TestDatabase::new();
        let anchor = FakeAnchor::default();
        let binding = default_device();
        let mut store = open(&database, &anchor, binding.clone(), AT_1).unwrap();
        if initial != "disabled" {
            store
                .enable(
                    &proof(
                        AdvancedPreferenceAction::Enable,
                        &binding,
                        &format!("table-enable-{initial}"),
                    ),
                    NOW_MS,
                    AT_1,
                )
                .unwrap();
        }
        if initial == "revoked" {
            store
                .revoke(
                    &proof(AdvancedPreferenceAction::Revoke, &binding, "table-revoke"),
                    NOW_MS,
                    AT_2,
                )
                .unwrap();
        } else if initial == "invalidated" {
            store
                .observe_binding(
                    device("device-0001", "hardware-table-b", "security-a"),
                    AT_2,
                )
                .unwrap();
        }
        let before = count_events(&database.path);
        let result = match initial {
            "enabled" => store.enable(
                &proof(
                    AdvancedPreferenceAction::Enable,
                    &binding,
                    "table-invalid-enable",
                ),
                NOW_MS,
                AT_3,
            ),
            _ => {
                let current = store.projection().device.clone();
                store.revoke(
                    &proof(
                        AdvancedPreferenceAction::Revoke,
                        &current,
                        &format!("table-invalid-revoke-{initial}"),
                    ),
                    NOW_MS,
                    AT_3,
                )
            }
        };
        assert_eq!(result, Err(AdvancedPreferenceError::InvalidTransition));
        assert_eq!(count_events(&database.path), before);
    }
}

#[test]
fn repeated_reopen_rebuilds_projection_and_ignores_corruptible_cache() {
    let database = TestDatabase::new();
    let anchor = FakeAnchor::default();
    let binding = default_device();
    let expected = {
        let mut store = open(&database, &anchor, binding.clone(), AT_1).unwrap();
        store
            .enable(
                &proof(
                    AdvancedPreferenceAction::Enable,
                    &binding,
                    "repeated-reopen-proof",
                ),
                NOW_MS,
                AT_1,
            )
            .unwrap();
        store.projection().clone()
    };
    Connection::open(&database.path)
        .unwrap()
        .execute(
            "UPDATE advanced_preference_projection
             SET state = 'disabled', event_count = 0, last_event_id = NULL",
            [],
        )
        .unwrap();

    for _ in 0..4 {
        let reopened = open(&database, &anchor, binding.clone(), AT_2).unwrap();
        assert_eq!(reopened.projection(), &expected);
    }
}

#[test]
fn posture_oscillation_never_silently_reenables_prior_authority() {
    let database = TestDatabase::new();
    let anchor = FakeAnchor::default();
    let original = default_device();
    let changed = device("device-0001", "hardware-oscillated", "security-a");
    let mut store = open(&database, &anchor, original.clone(), AT_1).unwrap();
    store
        .enable(
            &proof(
                AdvancedPreferenceAction::Enable,
                &original,
                "oscillation-enable-1",
            ),
            NOW_MS,
            AT_1,
        )
        .unwrap();
    store.observe_binding(changed.clone(), AT_2).unwrap();
    store.observe_binding(original.clone(), AT_3).unwrap();
    assert_eq!(
        store.projection().state,
        AdvancedPreferenceState::RevalidationRequired
    );
    assert_eq!(store.history().unwrap().len(), 2);

    store
        .enable(
            &proof(
                AdvancedPreferenceAction::Enable,
                &original,
                "oscillation-enable-2",
            ),
            NOW_MS,
            AT_3,
        )
        .unwrap();
    assert_eq!(store.projection().state, AdvancedPreferenceState::Enabled);
    assert_eq!(store.history().unwrap().len(), 3);
}

#[test]
fn concurrent_enable_attempts_serialize_to_one_durable_event() {
    let database = TestDatabase::new();
    let anchor = FakeAnchor::default();
    let binding = default_device();
    drop(open(&database, &anchor, binding.clone(), AT_1).unwrap());
    let barrier = Arc::new(Barrier::new(2));
    let mut workers = Vec::new();
    for suffix in ["a", "b"] {
        let path = database.path.clone();
        let anchor = anchor.clone();
        let binding = binding.clone();
        let barrier = Arc::clone(&barrier);
        workers.push(thread::spawn(move || {
            let mut store =
                AdvancedPreferenceStore::open(&path, Arc::new(anchor), binding.clone(), AT_1)
                    .unwrap();
            let consumed = proof(
                AdvancedPreferenceAction::Enable,
                &binding,
                &format!("concurrent-enable-{suffix}"),
            );
            barrier.wait();
            store.enable(&consumed, NOW_MS, AT_1)
        }));
    }
    let results = workers
        .into_iter()
        .map(|worker| worker.join().unwrap())
        .collect::<Vec<_>>();
    assert_eq!(results.iter().filter(|result| result.is_ok()).count(), 1);
    assert!(results.iter().any(|result| {
        matches!(
            result,
            Err(AdvancedPreferenceError::InvalidTransition)
                | Err(AdvancedPreferenceError::StorageBusy)
                | Err(AdvancedPreferenceError::IntegrityFailure)
        )
    }));
    let reopened = open(&database, &anchor, binding, AT_2).unwrap();
    assert_eq!(
        reopened.projection().state,
        AdvancedPreferenceState::Enabled
    );
    assert_eq!(reopened.history().unwrap().len(), 1);
}

#[test]
fn proof_reference_and_timestamp_column_tamper_fail_projection_rebuild() {
    for column_update in [
        "proof_reference = 'substituted-proof'",
        "occurred_at = '2030-01-20T09:09:09Z'",
    ] {
        let database = TestDatabase::new();
        let anchor = FakeAnchor::default();
        let binding = default_device();
        {
            let mut store = open(&database, &anchor, binding.clone(), AT_1).unwrap();
            store
                .enable(
                    &proof(
                        AdvancedPreferenceAction::Enable,
                        &binding,
                        "column-tamper-proof",
                    ),
                    NOW_MS,
                    AT_1,
                )
                .unwrap();
        }
        Connection::open(&database.path)
            .unwrap()
            .execute_batch(&format!(
                "DROP TRIGGER advanced_preference_events_no_update;
                 UPDATE advanced_preference_events SET {column_update};"
            ))
            .unwrap();
        assert!(matches!(
            open(&database, &anchor, binding, AT_2),
            Err(AdvancedPreferenceError::IntegrityFailure)
        ));
    }
}
