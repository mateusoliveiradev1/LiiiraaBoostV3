#[path = "../src/plan_commands.rs"]
mod plan_commands;
#[path = "../src/plan_executor.rs"]
mod plan_executor;
#[path = "../src/recovery_store/mod.rs"]
mod recovery_store;

use liiiraa_contracts_rust::{
    DurableJournalEvent, ExactOperationState, PlanTransactionDocument, ProgressEventDocument,
    ProgressSnapshotDocument, RecoveryCheckpointDocument, TransactionHash,
    TransactionReceiptDocument,
};
use liiiraa_plan_engine::{
    domain::{PlanEngineResult, PreparedTransactionIdentity},
    executor::{DurableJournalPort, JournalAppend, RecoveryLoad},
};
use plan_commands::{
    ADVANCED_PREFERENCE_COMMANDS, PLAN_COMMANDS, AdvancedPreferenceCommand,
    validate_advanced_preference_request, PlanCommand, validate_plan_document,
};
use plan_executor::{
    DiagnosticConsent, ExecutionState, PlanExecutor, PlanExecutorError, RecoveryDiagnosticSource,
};
use serde::de::DeserializeOwned;
use serde_json::{Value, json};
use std::{cell::Cell, fs, path::PathBuf};

const FIXTURE: &str =
    include_str!("../../../../packages/contracts-ts/src/fixtures/transactional-plans/valid.json");

fn fixture<T: DeserializeOwned>(id: &str) -> T {
    let root: Value = serde_json::from_str(FIXTURE).unwrap();
    let value = root["cases"]
        .as_array()
        .unwrap()
        .iter()
        .find(|case| case["id"] == id)
        .unwrap()["document"]
        .clone();
    serde_json::from_value(value).unwrap()
}

struct MemoryJournal {
    recovery: RecoveryLoad,
    diagnostics: Value,
}

impl DurableJournalPort for MemoryJournal {
    fn append_prepared(
        &mut self,
        _: &PlanTransactionDocument,
        _: &DurableJournalEvent,
    ) -> PlanEngineResult<()> {
        panic!("startup reconciliation must not append")
    }

    fn append(&mut self, _: JournalAppend<'_>) -> PlanEngineResult<TransactionHash> {
        panic!("startup reconciliation must not append")
    }

    fn store_checkpoint(
        &mut self,
        _: &PreparedTransactionIdentity,
        _: &ExactOperationState,
        _: &RecoveryCheckpointDocument,
    ) -> PlanEngineResult<()> {
        panic!("startup reconciliation must not store checkpoints")
    }

    fn store_receipt(
        &mut self,
        _: &PreparedTransactionIdentity,
        _: &ExactOperationState,
        _: &TransactionReceiptDocument,
    ) -> PlanEngineResult<()> {
        panic!("startup reconciliation must not store receipts")
    }

    fn load_recovery(&self) -> PlanEngineResult<RecoveryLoad> {
        Ok(self.recovery.clone())
    }
}

impl RecoveryDiagnosticSource for MemoryJournal {
    fn redacted_diagnostics(&self) -> Result<Value, PlanExecutorError> {
        Ok(self.diagnostics.clone())
    }
}

#[test]
fn startup_reconciliation_has_priority_and_survives_renderer_reconnect() {
    let transaction = fixture::<PlanTransactionDocument>("auditable apply transaction");
    let latest_event = fixture::<DurableJournalEvent>("journal prepared");
    let transaction_id = transaction.transaction_id.to_string();
    let journal = MemoryJournal {
        recovery: RecoveryLoad::Pending {
            transaction: Box::new(transaction),
            latest_event: Box::new(latest_event),
        },
        diagnostics: json!({"events": []}),
    };
    let mut executor = PlanExecutor::new(journal);

    let startup = executor.reconcile_startup().unwrap();
    assert_eq!(startup.state, ExecutionState::RecoveryRequired);
    assert_eq!(
        startup.transaction_id.as_deref(),
        Some(transaction_id.as_str())
    );
    assert!(!executor.accepts_new_mutation());

    let reopened = executor.read_execution();
    assert_eq!(reopened, startup);
    assert_eq!(executor.dispatch_count(), 0);
}

#[test]
fn corrupt_or_unavailable_recovery_state_fails_closed() {
    let journal = MemoryJournal {
        recovery: RecoveryLoad::CorruptOrUnavailable,
        diagnostics: json!({"events": []}),
    };
    let mut executor = PlanExecutor::new(journal);

    let snapshot = executor.reconcile_startup().unwrap();
    assert_eq!(snapshot.state, ExecutionState::JournalUnavailable);
    assert!(!executor.accepts_new_mutation());
}

#[test]
fn progress_reduction_is_monotonic_and_sequence_gaps_require_snapshot_refetch() {
    let journal = MemoryJournal {
        recovery: RecoveryLoad::Clear,
        diagnostics: json!({"events": []}),
    };
    let executor = PlanExecutor::new(journal);
    let mut snapshot = fixture::<ProgressSnapshotDocument>("authoritative progress snapshot");
    snapshot.sequence = 1;
    let event = fixture::<ProgressEventDocument>("contiguous progress event");

    let reduced = executor.reduce_progress(&snapshot, &event).unwrap();
    assert!(reduced.sequence > snapshot.sequence);

    let mut gap = event;
    gap.sequence = snapshot.sequence.saturating_add(2);
    assert!(matches!(
        executor.reduce_progress(&snapshot, &gap),
        Err(PlanExecutorError::AuthoritativeSnapshotRequired),
    ));
}

#[test]
fn diagnostic_export_requires_exact_preview_consent_and_returns_bounded_receipt() {
    let journal = MemoryJournal {
        recovery: RecoveryLoad::Clear,
        diagnostics: json!({
            "databaseId": "recovery-db-1",
            "events": [{"kind": "prepared", "contentHash": "sha256:redacted"}],
        }),
    };
    let executor = PlanExecutor::new(journal);
    let preview = executor.preview_diagnostics().unwrap();
    assert!(!preview.canonical_json.contains("session_secret"));

    let destination = temporary_export_path();
    assert_eq!(
        executor.export_diagnostics(
            &destination,
            DiagnosticConsent {
                preview_fingerprint: "sha256:wrong".to_owned(),
                approved: true,
            },
        ),
        Err(PlanExecutorError::ConsentRequired),
    );
    assert!(!destination.exists());

    let receipt = executor
        .export_diagnostics(
            &destination,
            DiagnosticConsent {
                preview_fingerprint: preview.fingerprint.clone(),
                approved: true,
            },
        )
        .unwrap();
    assert!(destination.exists());
    assert_eq!(receipt.preview_fingerprint, preview.fingerprint);
    assert!(receipt.bytes_written > 0 && receipt.bytes_written <= 65_536);
    assert!(receipt.path.len() <= 512);
    let _ = fs::remove_file(destination);
}

#[test]
fn command_surface_is_closed_and_restore_targets_cannot_be_confused() {
    assert_eq!(PLAN_COMMANDS.len(), 11);
    assert!(PLAN_COMMANDS.iter().all(|command| {
        !command.contains("shell") && !command.contains("execute") && !command.contains("registry")
    }));
    assert_eq!(
        PlanCommand::try_from("run_native"),
        Err(PlanExecutorError::InvalidRequest),
    );

    let transaction = fixture::<PlanTransactionDocument>("auditable apply transaction");
    let restore_targets = [
        (
            PlanCommand::RestoreOperation,
            liiiraa_contracts_rust::TransactionIntent::RestoreOperation,
        ),
        (
            PlanCommand::RestorePlan,
            liiiraa_contracts_rust::TransactionIntent::RestorePlan,
        ),
        (
            PlanCommand::RestoreCheckpoint,
            liiiraa_contracts_rust::TransactionIntent::RestoreCheckpoint,
        ),
    ];
    for (command, intent) in restore_targets {
        let mut exact = transaction.clone();
        exact.intent = intent;
        exact.parent_transaction_id = Some("transaction-parent-0001".parse().unwrap());
        let value = serde_json::to_value(exact).unwrap();
        assert!(validate_plan_document(command, &value).is_ok());
        assert!(matches!(
            validate_plan_document(PlanCommand::Apply, &value),
            Err(PlanExecutorError::InvalidRequest),
        ));
    }
}

#[test]
fn advanced_preference_commands_accept_only_bounded_intent_and_proof_references() {
    assert_eq!(ADVANCED_PREFERENCE_COMMANDS, [
        "read_advanced_preference",
        "enable_advanced_preference",
        "revoke_advanced_preference",
    ]);
    let request = json!({
        "intentId": "advanced-intent-0001",
        "authorizationContextId": "advanced-review-0001",
        "proofReference": "opaque_native_receipt_abcdefghijklmnopqrstuvwxyz_0123456789",
        "expectedSequence": 0,
        "requestedAt": "2030-01-20T00:00:00Z"
    });
    assert!(validate_advanced_preference_request(AdvancedPreferenceCommand::Enable, &request).is_ok());
    assert!(validate_advanced_preference_request(AdvancedPreferenceCommand::Revoke, &request).is_ok());

    for forged in [
        ("enabled", json!(true)),
        ("authenticated", json!(true)),
        ("hardwareFingerprint", json!(format!("sha256:{}", "a".repeat(64)))),
        ("securityPostureFingerprint", json!(format!("sha256:{}", "b".repeat(64)))),
        ("credential", json!("secret")),
    ] {
        let mut candidate = request.clone();
        candidate[forged.0] = forged.1;
        assert!(validate_advanced_preference_request(AdvancedPreferenceCommand::Enable, &candidate).is_err());
    }
}

#[test]
fn advanced_preference_is_revalidated_before_projection_and_apply_without_widening_recovery() {
    let main_source = include_str!("../src/main.rs");
    let executor_source = include_str!("../src/plan_executor.rs");
    let capability: Value =
        serde_json::from_str(include_str!("../capabilities/main.json")).unwrap();
    let permissions = capability["permissions"].as_array().unwrap();

    for command in ADVANCED_PREFERENCE_COMMANDS {
        let permission = format!("allow-{}", command.replace('_', "-"));
        assert!(permissions.iter().any(|value| value == &permission));
        assert!(main_source.contains(&format!("            {command},")));
    }
    assert!(executor_source.contains("revalidate_advanced_preference"));
    let revalidate = main_source.find("revalidate_advanced_preference").unwrap();
    let broker_failure = main_source.find("PlanExecutorError::BrokerUnavailable").unwrap();
    assert!(revalidate < broker_failure);
    assert!(main_source.contains("fn restore_plan_operation"));
    assert!(main_source.contains("fn restore_plan("));
    assert!(main_source.contains("fn restore_recovery_checkpoint"));
}

#[test]
fn tauri_startup_and_capability_keep_recovery_first_and_least_privilege() {
    let main_source = include_str!("../src/main.rs");
    let build_source = include_str!("../build.rs");
    let capability: Value =
        serde_json::from_str(include_str!("../capabilities/main.json")).unwrap();
    let permissions = capability["permissions"].as_array().unwrap();

    assert_eq!(capability["windows"], json!(["main"]));
    assert_eq!(capability["webviews"], json!(["main"]));
    for command in PLAN_COMMANDS {
        let permission = format!("allow-{}", command.replace('_', "-"));
        assert!(permissions.iter().any(|value| value == &permission));
        assert!(build_source.contains(&format!("\"{command}\"")));
        assert!(main_source.contains(&format!("            {command},")));
    }
    assert!(permissions.iter().all(|value| {
        value.as_str().is_some_and(|permission| {
            !permission.starts_with("shell:")
                && !permission.contains("execute-arbitrary")
                && !permission.contains("generic-native")
        })
    }));

    let open = main_source.find("RecoveryStore::open").unwrap();
    let reconcile = main_source
        .find("plan_executor.reconcile_startup()")
        .unwrap();
    let manage = main_source
        .find("app.manage(Mutex::new(plan_executor))")
        .unwrap();
    let commands = main_source
        .find(".invoke_handler(tauri::generate_handler!")
        .unwrap();
    assert!(open < reconcile && reconcile < manage && manage < commands);
    assert!(main_source.contains("WindowEvent::CloseRequested"));
    assert!(main_source.contains("CloseAction::HideToTray"));
    assert!(main_source.contains("executor.begin_shutdown()"));
}

fn temporary_export_path() -> PathBuf {
    let sequence = Cell::new(0_u64);
    sequence.set(sequence.get() + 1);
    std::env::temp_dir().join(format!(
        "liiiraa-recovery-export-{}-{}.json",
        std::process::id(),
        sequence.get(),
    ))
}
