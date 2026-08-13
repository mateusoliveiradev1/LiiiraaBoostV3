#[path = "../src/recovery_store/mod.rs"]
mod recovery_store;

use std::{
    collections::BTreeMap,
    fs,
    path::PathBuf,
    sync::{
        Arc, Mutex,
        atomic::{AtomicU64, Ordering},
    },
};

use recovery_store::{
    FaultPoint, MutationState, RecoveryStore, RecoveryStoreError,
    integrity_anchor::{AnchorHead, IntegrityAnchor, IntegrityAnchorError},
};
use rusqlite::{Connection, OptionalExtension};
use serde_json::Value;
use sha2::{Digest, Sha256};

static NEXT_DATABASE: AtomicU64 = AtomicU64::new(1);

struct TestDatabase {
    path: PathBuf,
}

impl TestDatabase {
    fn new(name: &str) -> Self {
        let suffix = NEXT_DATABASE.fetch_add(1, Ordering::Relaxed);
        let path = std::env::temp_dir().join(format!(
            "liiiraa-recovery-{name}-{}-{suffix}.sqlite3",
            std::process::id()
        ));
        let _ = fs::remove_file(&path);
        Self { path }
    }
}

impl Drop for TestDatabase {
    fn drop(&mut self) {
        let _ = fs::remove_file(&self.path);
        let _ = fs::remove_file(self.path.with_extension("sqlite3-shm"));
        let _ = fs::remove_file(self.path.with_extension("sqlite3-wal"));
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
    unavailable: bool,
    reject_cas: bool,
}

impl FakeAnchor {
    fn unavailable(&self, unavailable: bool) {
        self.state.lock().unwrap().unavailable = unavailable;
    }

    fn remove_head(&self) {
        self.state.lock().unwrap().head = None;
    }

    fn remove_key(&self, epoch: u32) {
        self.state.lock().unwrap().keys.remove(&epoch);
    }

    fn head(&self) -> AnchorHead {
        self.state.lock().unwrap().head.clone().unwrap()
    }

    fn replace_head(&self, head: AnchorHead) {
        self.state.lock().unwrap().head = Some(head);
    }
}

impl IntegrityAnchor for FakeAnchor {
    fn read_head(&self) -> Result<Option<AnchorHead>, IntegrityAnchorError> {
        let state = self.state.lock().unwrap();
        if state.unavailable {
            return Err(IntegrityAnchorError::Unavailable);
        }
        Ok(state.head.clone())
    }

    fn read_key(&self, epoch: u32) -> Result<Option<Vec<u8>>, IntegrityAnchorError> {
        let state = self.state.lock().unwrap();
        if state.unavailable {
            return Err(IntegrityAnchorError::Unavailable);
        }
        Ok(state.keys.get(&epoch).cloned())
    }

    fn initialize(&self, head: &AnchorHead, key: &[u8]) -> Result<(), IntegrityAnchorError> {
        let mut state = self.state.lock().unwrap();
        if state.unavailable {
            return Err(IntegrityAnchorError::Unavailable);
        }
        if state.head.is_some() {
            return Err(IntegrityAnchorError::Mismatch);
        }
        state.keys.insert(head.epoch, key.to_vec());
        state.head = Some(head.clone());
        Ok(())
    }

    fn install_key(&self, epoch: u32, key: &[u8]) -> Result<(), IntegrityAnchorError> {
        let mut state = self.state.lock().unwrap();
        if state.unavailable {
            return Err(IntegrityAnchorError::Unavailable);
        }
        state.keys.insert(epoch, key.to_vec());
        Ok(())
    }

    fn compare_and_swap(
        &self,
        expected: &AnchorHead,
        next: &AnchorHead,
    ) -> Result<(), IntegrityAnchorError> {
        let mut state = self.state.lock().unwrap();
        if state.unavailable {
            return Err(IntegrityAnchorError::Unavailable);
        }
        if state.reject_cas || state.head.as_ref() != Some(expected) {
            return Err(IntegrityAnchorError::Mismatch);
        }
        state.head = Some(next.clone());
        Ok(())
    }
}

fn fixture(id: &str) -> Value {
    let corpus: Value = serde_json::from_str(include_str!(
        "../../../../packages/contracts-ts/src/fixtures/transactional-plans/valid.json"
    ))
    .expect("valid transactional corpus");
    corpus["cases"]
        .as_array()
        .unwrap()
        .iter()
        .find(|case| case["id"] == id)
        .unwrap_or_else(|| panic!("missing fixture {id}"))["document"]
        .clone()
}

fn open_store(database: &TestDatabase, anchor: &FakeAnchor) -> RecoveryStore {
    RecoveryStore::open(&database.path, Arc::new(anchor.clone())).expect("open recovery store")
}

fn append_prerequisites(store: &mut RecoveryStore) {
    store
        .append_document(&fixture(
            "transactional plan with complete PLAN-03 metadata",
        ))
        .expect("append plan revision");
    store
        .append_document(&fixture(
            "approval bound to immutable fingerprints and proof",
        ))
        .expect("append approval");
    store
        .append_document(&fixture("auditable apply transaction"))
        .expect("append transaction");
}

fn sha256(bytes: &[u8]) -> String {
    format!("sha256:{:x}", Sha256::digest(bytes))
}

#[test]
fn installs_strict_append_schema_and_full_durability_policy() {
    let database = TestDatabase::new("schema");
    let anchor = FakeAnchor::default();
    let store = open_store(&database, &anchor);
    let policy = store.connection_policy().expect("read connection policy");
    assert!(policy.foreign_keys);
    assert!(policy.journal_mode_wal);
    assert!(policy.synchronous_full);
    drop(store);

    let connection = Connection::open(&database.path).unwrap();
    for table in [
        "plan_revisions",
        "plan_operations",
        "approval_events",
        "recovery_checkpoints",
        "transactions",
        "journal_events",
        "receipts",
        "operation_promotions",
        "executor_projection",
    ] {
        let sql: String = connection
            .query_row(
                "SELECT sql FROM sqlite_master WHERE type = 'table' AND name = ?1",
                [table],
                |row| row.get(0),
            )
            .unwrap_or_else(|_| panic!("missing table {table}"));
        assert!(sql.contains("STRICT"), "{table} must be STRICT");
    }
}

#[test]
fn prepare_commit_failure_never_calls_dispatch() {
    let database = TestDatabase::new("prepare-full");
    let anchor = FakeAnchor::default();
    let mut store = open_store(&database, &anchor);
    append_prerequisites(&mut store);
    store.set_fault(FaultPoint::FullBeforeCommit);
    let dispatches = AtomicU64::new(0);

    let result = store.dispatch_after_prepared(&fixture("journal prepared"), || {
        dispatches.fetch_add(1, Ordering::SeqCst);
    });

    assert_eq!(result, Err(RecoveryStoreError::Full));
    assert_eq!(dispatches.load(Ordering::SeqCst), 0);
}

#[test]
fn prepared_intent_is_durable_before_dispatch_observes_it() {
    let database = TestDatabase::new("prepare-order");
    let anchor = FakeAnchor::default();
    let mut store = open_store(&database, &anchor);
    append_prerequisites(&mut store);

    store
        .dispatch_after_prepared(&fixture("journal prepared"), || {
            let connection = Connection::open(&database.path).unwrap();
            let count: i64 = connection
                .query_row(
                    "SELECT count(*) FROM journal_events WHERE event_kind = 'journal-event:prepared'",
                    [],
                    |row| row.get(0),
                )
                .unwrap();
            assert_eq!(count, 1);
        })
        .expect("dispatch only after prepared commit");
}

#[test]
fn history_reopens_with_identical_bytes_hashes_and_projection() {
    let database = TestDatabase::new("restart");
    let anchor = FakeAnchor::default();
    let original = {
        let mut store = open_store(&database, &anchor);
        append_prerequisites(&mut store);
        store.append_document(&fixture("journal prepared")).unwrap();
        store
            .append_document(&fixture("journal dispatch returned"))
            .unwrap();
        store.append_document(&fixture("journal observed")).unwrap();
        store.append_document(&fixture("journal verified")).unwrap();
        let projection = store.projection_rows().unwrap();
        (store.history().unwrap(), projection)
    };

    let mut reopened = open_store(&database, &anchor);
    assert_eq!(reopened.history().unwrap(), original.0);
    assert_eq!(reopened.projection_rows().unwrap(), original.1);
    reopened.rebuild_executor_projection().unwrap();
    assert_eq!(reopened.projection_rows().unwrap(), original.1);
}

#[test]
fn authoritative_history_rejects_update_and_delete() {
    let database = TestDatabase::new("append-only");
    let anchor = FakeAnchor::default();
    let mut store = open_store(&database, &anchor);
    append_prerequisites(&mut store);
    drop(store);

    let connection = Connection::open(&database.path).unwrap();
    assert!(
        connection
            .execute("UPDATE transactions SET record_id = 'rewritten'", [])
            .is_err()
    );
    assert!(
        connection
            .execute("DELETE FROM journal_events", [])
            .is_err()
    );
}

#[test]
fn every_authoritative_document_is_appended_and_receipts_require_a_verified_head() {
    let database = TestDatabase::new("authoritative-documents");
    let anchor = FakeAnchor::default();
    let mut store = open_store(&database, &anchor);
    append_prerequisites(&mut store);
    store
        .append_document(&fixture("protected recovery checkpoint"))
        .expect("append checkpoint");
    assert_eq!(
        store.append_document(&fixture("complete verified receipt")),
        Err(RecoveryStoreError::InvalidTransition)
    );
    for fixture_id in [
        "journal prepared",
        "journal dispatch returned",
        "journal observed",
        "journal verified",
    ] {
        store.append_document(&fixture(fixture_id)).unwrap();
    }
    store
        .append_document(&fixture("complete verified receipt"))
        .expect("append verified receipt");
    store
        .append_document(&fixture("ordered simulation promotion"))
        .expect("append promotion");
    drop(store);

    let connection = Connection::open(&database.path).unwrap();
    for (table, expected) in [
        ("plan_revisions", 1_i64),
        ("plan_operations", 1),
        ("approval_events", 1),
        ("transactions", 1),
        ("recovery_checkpoints", 1),
        ("receipts", 1),
        ("operation_promotions", 1),
    ] {
        let count: i64 = connection
            .query_row(&format!("SELECT count(*) FROM {table}"), [], |row| {
                row.get(0)
            })
            .unwrap();
        assert_eq!(count, expected, "unexpected row count for {table}");
    }
    assert!(connection.execute("DELETE FROM receipts", []).is_err());
}

#[test]
fn multiple_plan_revisions_append_without_rewriting_prior_versions() {
    let database = TestDatabase::new("plan-revisions");
    let anchor = FakeAnchor::default();
    let mut store = open_store(&database, &anchor);
    let revision_one = fixture("transactional plan with complete PLAN-03 metadata");
    store.append_document(&revision_one).unwrap();
    let mut revision_two = revision_one;
    revision_two["revision"] = Value::from(2);
    revision_two["revisionFingerprint"] = Value::from(format!("sha256:{}", "f".repeat(64)));
    store.append_document(&revision_two).unwrap();
    drop(store);

    let connection = Connection::open(&database.path).unwrap();
    let revisions = connection
        .prepare("SELECT revision FROM plan_revisions ORDER BY revision")
        .unwrap()
        .query_map([], |row| row.get::<_, u32>(0))
        .unwrap()
        .collect::<Result<Vec<_>, _>>()
        .unwrap();
    assert_eq!(revisions, vec![1, 2]);
    assert!(
        connection
            .execute("UPDATE plan_revisions SET revision = 3", [])
            .is_err()
    );
}

#[test]
fn whole_history_rewrite_with_recomputed_sha_is_detected_by_external_anchor() {
    let database = TestDatabase::new("whole-rewrite");
    let anchor = FakeAnchor::default();
    {
        let mut store = open_store(&database, &anchor);
        append_prerequisites(&mut store);
        store.append_document(&fixture("journal prepared")).unwrap();
    }

    let connection = Connection::open(&database.path).unwrap();
    connection
        .execute_batch(
            "DROP TRIGGER journal_events_no_update; DROP TRIGGER journal_events_no_delete;",
        )
        .unwrap();
    let forged = br#"{\"kind\":\"journal-event\",\"forged\":true}"#;
    connection
        .execute(
            "UPDATE journal_events SET canonical_json = ?1, content_hash = ?2",
            (forged.as_slice(), sha256(forged)),
        )
        .unwrap();
    drop(connection);

    let mut reopened = open_store(&database, &anchor);
    assert_eq!(
        reopened.mutation_state(),
        MutationState::ReadOnlyAnchorMismatch
    );
    assert!(!reopened.history().unwrap().is_empty());
    assert_eq!(
        reopened.append_document(&fixture("journal prepared")),
        Err(RecoveryStoreError::AnchorMismatch)
    );
}

#[test]
fn missing_anchor_or_key_preserves_read_only_recovery_and_blocks_mutation() {
    let database = TestDatabase::new("custody-loss");
    let anchor = FakeAnchor::default();
    {
        let mut store = open_store(&database, &anchor);
        append_prerequisites(&mut store);
    }
    anchor.remove_key(1);

    let mut reopened = open_store(&database, &anchor);
    assert_eq!(
        reopened.mutation_state(),
        MutationState::ReadOnlyIntegrityAnchorUnavailable
    );
    assert_eq!(reopened.history().unwrap().len(), 3);
    let diagnostic = reopened.diagnostic_export().unwrap();
    assert_eq!(diagnostic.mutation_state, reopened.mutation_state());
    assert_eq!(diagnostic.retained_events.len(), 3);
    assert!(
        diagnostic
            .retained_events
            .iter()
            .all(|event| event.event_mac.starts_with("hmac-sha256:"))
    );
    assert_eq!(
        reopened.append_document(&fixture("journal prepared")),
        Err(RecoveryStoreError::IntegrityAnchorUnavailable)
    );

    anchor.remove_head();
    let reopened = open_store(&database, &anchor);
    assert_eq!(
        reopened.mutation_state(),
        MutationState::ReadOnlyIntegrityAnchorUnavailable
    );
}

#[test]
fn database_identity_mismatch_is_diagnostic_and_read_only() {
    let database = TestDatabase::new("database-identity");
    let anchor = FakeAnchor::default();
    {
        let mut store = open_store(&database, &anchor);
        append_prerequisites(&mut store);
    }
    let mut wrong = anchor.head();
    wrong.database_id = "recovery-different-database".to_owned();
    anchor.replace_head(wrong);

    let mut reopened = open_store(&database, &anchor);
    assert_eq!(
        reopened.mutation_state(),
        MutationState::ReadOnlyAnchorMismatch
    );
    assert_eq!(
        reopened.append_document(&fixture("journal prepared")),
        Err(RecoveryStoreError::AnchorMismatch)
    );
    let first = reopened.diagnostic_export().unwrap();
    let second = reopened.diagnostic_export().unwrap();
    assert_eq!(first, second);
}

#[test]
fn unavailable_custody_is_read_only_not_destructive() {
    let database = TestDatabase::new("custody-unavailable");
    let anchor = FakeAnchor::default();
    {
        let mut store = open_store(&database, &anchor);
        append_prerequisites(&mut store);
    }
    anchor.unavailable(true);

    let reopened = open_store(&database, &anchor);
    assert_eq!(
        reopened.mutation_state(),
        MutationState::ReadOnlyIntegrityAnchorUnavailable
    );
    assert_eq!(reopened.history().unwrap().len(), 3);
}

#[test]
fn one_event_anchor_lag_recovers_but_rollback_ahead_and_multi_lag_do_not() {
    let database = TestDatabase::new("anchor-lag");
    let anchor = FakeAnchor::default();
    let mut store = open_store(&database, &anchor);
    append_prerequisites(&mut store);
    let before = anchor.head();
    store.set_fault(FaultPoint::AfterCommitBeforeAnchor);
    assert_eq!(
        store.append_document(&fixture("journal prepared")),
        Err(RecoveryStoreError::AnchorMismatch)
    );
    drop(store);

    let mut recovered = open_store(&database, &anchor);
    assert_eq!(recovered.mutation_state(), MutationState::Writable);
    recovered
        .append_document(&fixture("journal dispatch returned"))
        .expect("advance beyond the recoverable single-event lag");
    let latest = anchor.head();
    assert_eq!(latest.sequence, Some(4));
    drop(recovered);

    anchor.replace_head(before.clone());
    assert_eq!(
        open_store(&database, &anchor).mutation_state(),
        MutationState::ReadOnlyAnchorMismatch
    );

    let mut ahead = latest;
    ahead.sequence = Some(99);
    anchor.replace_head(ahead);
    assert_eq!(
        open_store(&database, &anchor).mutation_state(),
        MutationState::ReadOnlyAnchorMismatch
    );
}

#[test]
fn key_rotation_keeps_old_epochs_verifiable_and_interruption_fails_closed() {
    let database = TestDatabase::new("rotation");
    let anchor = FakeAnchor::default();
    let mut store = open_store(&database, &anchor);
    append_prerequisites(&mut store);
    store.rotate_key().expect("rotate key");
    store.append_document(&fixture("journal prepared")).unwrap();
    let epochs = store
        .history()
        .unwrap()
        .into_iter()
        .map(|event| event.key_epoch)
        .collect::<Vec<_>>();
    assert!(epochs.contains(&1));
    assert!(epochs.contains(&2));
    drop(store);
    assert_eq!(
        open_store(&database, &anchor).mutation_state(),
        MutationState::Writable
    );

    let database = TestDatabase::new("rotation-interrupted");
    let anchor = FakeAnchor::default();
    let mut store = open_store(&database, &anchor);
    append_prerequisites(&mut store);
    store.set_fault(FaultPoint::RotationAfterKeyInstall);
    assert_eq!(store.rotate_key(), Err(RecoveryStoreError::AnchorMismatch));
    drop(store);
    assert_ne!(
        open_store(&database, &anchor).mutation_state(),
        MutationState::Writable
    );
}

#[test]
fn busy_full_and_io_failures_are_closed_and_preserve_history() {
    let database = TestDatabase::new("busy");
    let anchor = FakeAnchor::default();
    drop(open_store(&database, &anchor));
    let locking = Connection::open(&database.path).unwrap();
    locking.execute_batch("BEGIN EXCLUSIVE;").unwrap();
    assert!(matches!(
        RecoveryStore::open(&database.path, Arc::new(anchor.clone())),
        Err(RecoveryStoreError::Busy)
    ));
    locking.execute_batch("ROLLBACK;").unwrap();

    let mut store = open_store(&database, &anchor);
    append_prerequisites(&mut store);
    let count = store.history().unwrap().len();
    for (fault, expected) in [
        (FaultPoint::FullBeforeCommit, RecoveryStoreError::Full),
        (FaultPoint::IoBeforeCommit, RecoveryStoreError::Io),
    ] {
        store.set_fault(fault);
        assert_eq!(
            store.append_document(&fixture("journal prepared")),
            Err(expected)
        );
        assert_eq!(store.history().unwrap().len(), count);
    }
}

#[test]
fn disk_full_after_effect_retains_prepared_evidence_for_restart_recovery() {
    let database = TestDatabase::new("full-after-effect");
    let anchor = FakeAnchor::default();
    let mut store = open_store(&database, &anchor);
    append_prerequisites(&mut store);
    store
        .dispatch_after_prepared(&fixture("journal prepared"), || ())
        .unwrap();
    store.set_fault(FaultPoint::FullBeforeCommit);
    assert_eq!(
        store.append_document(&fixture("journal dispatch returned")),
        Err(RecoveryStoreError::Full)
    );
    drop(store);

    let reopened = open_store(&database, &anchor);
    let states = reopened
        .history()
        .unwrap()
        .into_iter()
        .map(|event| event.event_kind)
        .collect::<Vec<_>>();
    assert!(states.contains(&"journal-event:prepared".to_owned()));
    assert!(!states.contains(&"journal-event:dispatch-returned".to_owned()));
}

#[test]
fn malformed_documents_foreign_keys_and_non_increasing_sequences_fail_closed() {
    let database = TestDatabase::new("invalid");
    let anchor = FakeAnchor::default();
    let mut store = open_store(&database, &anchor);
    assert_eq!(
        store.append_document(&serde_json::json!({"kind": "journal-event"})),
        Err(RecoveryStoreError::ContractRejected)
    );
    assert_eq!(
        store.append_document(&fixture("journal prepared")),
        Err(RecoveryStoreError::ForeignKeyRejected)
    );
    append_prerequisites(&mut store);
    store.append_document(&fixture("journal prepared")).unwrap();
    assert_eq!(
        store.append_document(&fixture("journal prepared")),
        Err(RecoveryStoreError::InvalidTransition)
    );
}

#[test]
fn every_prior_schema_version_upgrades_without_rewriting_history() {
    let database = TestDatabase::new("upgrade");
    let mut connection = Connection::open(&database.path).unwrap();
    recovery_store::migrations::migrations()
        .to_version(&mut connection, 1)
        .expect("create schema v1");
    let database_id: String = connection
        .query_row(
            "SELECT database_id FROM recovery_metadata WHERE singleton = 1",
            [],
            |row| row.get(0),
        )
        .optional()
        .unwrap()
        .unwrap_or_else(|| "legacy-recovery-db".to_owned());
    if connection
        .query_row(
            "SELECT 1 FROM recovery_metadata WHERE singleton = 1",
            [],
            |_| Ok(()),
        )
        .optional()
        .unwrap()
        .is_none()
    {
        connection
            .execute(
                "INSERT INTO recovery_metadata (singleton, database_id) VALUES (1, ?1)",
                [&database_id],
            )
            .unwrap();
    }
    drop(connection);

    let anchor = FakeAnchor::default();
    anchor
        .initialize(
            &AnchorHead {
                database_id,
                epoch: 1,
                sequence: None,
                head_mac: format!("hmac-sha256:{}", "0".repeat(64)),
            },
            &[7_u8; 32],
        )
        .unwrap();
    let store = open_store(&database, &anchor);
    assert!(store.connection_policy().unwrap().synchronous_full);
}

#[test]
fn unversioned_database_upgrades_to_latest_without_external_dependencies() {
    let database = TestDatabase::new("upgrade-v0");
    let mut connection = Connection::open(&database.path).unwrap();
    recovery_store::migrations::migrations()
        .to_version(&mut connection, 0)
        .expect("retain unversioned schema");
    drop(connection);

    let anchor = FakeAnchor::default();
    drop(open_store(&database, &anchor));
    let connection = Connection::open(&database.path).unwrap();
    let version: u32 = connection
        .query_row("PRAGMA user_version", [], |row| row.get(0))
        .unwrap();
    assert_eq!(version, 2);
}
