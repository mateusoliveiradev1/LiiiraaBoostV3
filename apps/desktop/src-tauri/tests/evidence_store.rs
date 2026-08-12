#[path = "../src/evidence_store.rs"]
mod evidence_store;

use std::{
    fs,
    path::PathBuf,
    sync::atomic::{AtomicU64, Ordering},
};

use evidence_store::{EvidenceLifecycle, EvidenceStore, EvidenceStoreError, ReferenceKind};
use rusqlite::Connection;
use serde_json::{Value, json};

static NEXT_DATABASE: AtomicU64 = AtomicU64::new(1);

struct TestDatabase {
    path: PathBuf,
}

impl TestDatabase {
    fn new(name: &str) -> Self {
        let suffix = NEXT_DATABASE.fetch_add(1, Ordering::Relaxed);
        let path = std::env::temp_dir().join(format!(
            "liiiraa-evidence-{name}-{}-{suffix}.sqlite3",
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

fn execution() -> Value {
    json!({
        "sourceCapability": "native-readonly",
        "deadlineAt": "2026-08-12T12:00:10Z",
        "cancellationState": "not-requested",
        "health": {
            "state": "healthy",
            "checkedAt": "2026-08-12T12:00:00Z",
            "detail": "Collector ready."
        },
        "overhead": {
            "sampleWindowMs": 1000,
            "cpuTimeMs": 12,
            "peakWorkingSetBytes": "8388608",
            "quality": "valid"
        }
    })
}

fn observed(value: &str) -> Value {
    json!({
        "state": "observed",
        "value": value,
        "source": "windows-native-api",
        "observedAt": "2026-08-12T12:00:00Z"
    })
}

fn unavailable() -> Value {
    json!({
        "state": "unavailable",
        "reasonCode": "not-reported",
        "detail": "Not reported by Windows."
    })
}

fn inventory(id: &str) -> Value {
    json!({
        "kind": "inventory-snapshot",
        "schemaVersion": "1.0",
        "evidenceId": id,
        "evidenceVersion": 1,
        "collectedAt": "2026-08-12T12:00:01Z",
        "evidenceHash": format!("sha256:{}", "a".repeat(64)),
        "execution": execution(),
        "cpu": observed("AMD Ryzen"),
        "gpu": observed("NVIDIA GeForce"),
        "memory": observed("32 GiB"),
        "storage": observed("NVMe"),
        "network": observed("Ethernet"),
        "display": observed("144 Hz"),
        "audio": unavailable(),
        "usb": observed("4 controllers"),
        "windows": observed("Windows 11"),
        "drivers": observed("Signed"),
        "security": observed("Secure Boot"),
        "games": unavailable()
    })
}

fn incomplete_session(id: &str) -> Value {
    json!({
        "kind": "measurement-session",
        "schemaVersion": "1.0",
        "sessionId": id,
        "evidenceVersion": 1,
        "status": "incomplete",
        "startedAt": "2026-08-12T12:00:01Z",
        "execution": execution(),
        "baseline": {
            "baselineId": "baseline-1",
            "inventoryEvidenceId": "inventory-1",
            "inventoryEvidenceHash": format!("sha256:{}", "a".repeat(64)),
            "capturedAt": "2026-08-12T12:00:01Z"
        },
        "chunks": [],
        "reason": "Capture is still running."
    })
}

fn completed_session(id: &str) -> Value {
    json!({
        "kind": "measurement-session",
        "schemaVersion": "1.0",
        "sessionId": id,
        "evidenceVersion": 1,
        "status": "completed",
        "startedAt": "2026-08-12T12:00:01Z",
        "completedAt": "2026-08-12T12:00:02Z",
        "execution": execution(),
        "baseline": {
            "baselineId": "baseline-1",
            "inventoryEvidenceId": "inventory-1",
            "inventoryEvidenceHash": format!("sha256:{}", "a".repeat(64)),
            "capturedAt": "2026-08-12T12:00:01Z"
        },
        "chunks": [{
            "chunkId": "chunk-1",
            "sequence": 0,
            "startedAt": "2026-08-12T12:00:01Z",
            "endedAt": "2026-08-12T12:00:02Z",
            "metric": "frame-time-ms",
            "unit": "milliseconds",
            "values": [7.1, 7.3, 8.2],
            "evidenceHash": format!("sha256:{}", "b".repeat(64)),
            "quality": "valid"
        }],
        "evidenceHash": format!("sha256:{}", "c".repeat(64)),
        "limitations": ["Synthetic workload is bounded."]
    })
}

#[test]
fn completed_evidence_reopens_with_identical_bytes_and_hash() {
    let database = TestDatabase::new("restart");
    let original = {
        let mut store = EvidenceStore::open(&database.path).expect("open evidence store");
        store
            .append_document(&inventory("inventory-1"), EvidenceLifecycle::Immutable, 1)
            .expect("append inventory")
    };

    let store = EvidenceStore::open(&database.path).expect("reopen evidence store");
    let reopened = store.get("inventory-1").expect("read evidence");
    assert_eq!(reopened.canonical_json, original.canonical_json);
    assert_eq!(reopened.content_hash, original.content_hash);
    assert_eq!(reopened.schema_version, "1.0");
}

#[test]
fn interrupted_session_remains_inspectable_but_is_not_admissible() {
    let database = TestDatabase::new("interrupted");
    let mut store = EvidenceStore::open(&database.path).expect("open evidence store");
    store
        .append_document(
            &incomplete_session("session-1"),
            EvidenceLifecycle::Incomplete,
            1,
        )
        .expect("append incomplete session");
    drop(store);

    let store = EvidenceStore::open(&database.path).expect("reopen evidence store");
    assert_eq!(
        store.get("session-1").expect("inspect session").lifecycle,
        EvidenceLifecycle::Incomplete
    );
    assert!(
        store
            .admissible_session_ids()
            .expect("query sessions")
            .is_empty()
    );
}

#[test]
fn completion_commits_document_chunks_and_state_atomically() {
    let database = TestDatabase::new("complete");
    let mut store = EvidenceStore::open(&database.path).expect("open evidence store");
    store
        .append_document(
            &incomplete_session("session-1"),
            EvidenceLifecycle::Incomplete,
            1,
        )
        .expect("append incomplete session");
    let completed = store
        .complete_session(&completed_session("session-1"), 2)
        .expect("complete session");

    assert_eq!(completed.lifecycle, EvidenceLifecycle::Completed);
    assert_eq!(
        store.chunk_sequences("session-1").expect("read chunks"),
        vec![0]
    );
    assert_eq!(
        store.admissible_session_ids().expect("query sessions"),
        vec!["session-1"]
    );
}

#[test]
fn malformed_generated_document_and_missing_foreign_keys_fail_closed() {
    let database = TestDatabase::new("invalid");
    let mut store = EvidenceStore::open(&database.path).expect("open evidence store");
    let malformed = json!({"kind": "inventory-snapshot", "schemaVersion": "1.0"});
    assert_eq!(
        store.append_document(&malformed, EvidenceLifecycle::Immutable, 1),
        Err(EvidenceStoreError::ContractRejected)
    );
    assert_eq!(
        store.link("missing-owner", "missing-target", ReferenceKind::Report),
        Err(EvidenceStoreError::ForeignKeyRejected)
    );
}

#[test]
fn hash_mismatch_is_reported_as_corrupt_after_restart() {
    let database = TestDatabase::new("tamper");
    {
        let mut store = EvidenceStore::open(&database.path).expect("open evidence store");
        store
            .append_document(&inventory("inventory-1"), EvidenceLifecycle::Immutable, 1)
            .expect("append inventory");
    }
    let connection = Connection::open(&database.path).expect("open raw database");
    connection
        .execute(
            "UPDATE evidence_documents SET canonical_json = ?1 WHERE evidence_id = ?2",
            (br#"{"tampered":true}"#.as_slice(), "inventory-1"),
        )
        .expect("tamper test row");
    drop(connection);

    let store = EvidenceStore::open(&database.path).expect("reopen evidence store");
    assert_eq!(
        store.get("inventory-1"),
        Err(EvidenceStoreError::HashMismatch)
    );
    assert!(
        store
            .admissible_session_ids()
            .expect("query sessions")
            .is_empty()
    );
}

#[test]
fn retention_preserves_referenced_evidence_and_removes_unreferenced_rows() {
    let database = TestDatabase::new("retention");
    let mut store = EvidenceStore::open(&database.path).expect("open evidence store");
    store
        .append_document(&inventory("kept"), EvidenceLifecycle::Immutable, 1)
        .unwrap();
    store
        .append_document(&inventory("owner"), EvidenceLifecycle::Immutable, 2)
        .unwrap();
    store
        .append_document(&inventory("remove"), EvidenceLifecycle::Immutable, 3)
        .unwrap();
    store.link("owner", "kept", ReferenceKind::Report).unwrap();

    assert_eq!(store.prune_unreferenced_before(4, 10).unwrap(), 1);
    assert!(store.get("kept").is_ok());
    assert!(store.get("owner").is_ok());
    assert_eq!(store.get("remove"), Err(EvidenceStoreError::NotFound));
}

#[test]
fn bounded_busy_timeout_returns_a_stable_error() {
    let database = TestDatabase::new("busy");
    let store = EvidenceStore::open(&database.path).expect("initialize evidence store");
    drop(store);
    let locking = Connection::open(&database.path).expect("open locking connection");
    locking
        .execute_batch("BEGIN EXCLUSIVE;")
        .expect("acquire exclusive lock");

    let result = EvidenceStore::open(&database.path);
    assert!(matches!(result, Err(EvidenceStoreError::Busy)));
    locking.execute_batch("ROLLBACK;").expect("release lock");
}
