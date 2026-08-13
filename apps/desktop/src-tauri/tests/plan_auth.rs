#[path = "../src/credential_store.rs"]
mod credential_store;
#[path = "../src/plan_auth.rs"]
mod plan_auth;

use std::cell::RefCell;

use credential_store::{CredentialStore, CredentialStoreError};
use plan_auth::{
    AdvancedPreferenceAction, AdvancedPreferenceApprovalRequest, ApplyPlanApprovalRequest,
    OpaqueApprovalReceipt, OperationVersion, PlanApprovalApi, PlanApprovalApiResponse,
    PlanAuthError, admit_local_recovery, consume_advanced_preference_approval,
    consume_plan_approval,
};
use serde_json::json;

const NOW_MS: u64 = 1_895_227_200_000;
const CREDENTIAL: &str = "credential-in-windows-credential-manager";
const RECEIPT: &str = "opaque_native_receipt_abcdefghijklmnopqrstuvwxyz_0123456789";

#[derive(Default)]
struct MemoryCredentialStore {
    credential: RefCell<Option<String>>,
    reads: RefCell<usize>,
}

impl CredentialStore for MemoryCredentialStore {
    fn write_rotated_credential(&self, credential: &str) -> Result<(), CredentialStoreError> {
        self.credential.replace(Some(credential.to_owned()));
        Ok(())
    }

    fn read_credential(&self) -> Result<Option<String>, CredentialStoreError> {
        *self.reads.borrow_mut() += 1;
        Ok(self.credential.borrow().clone())
    }

    fn delete_credential(&self) -> Result<(), CredentialStoreError> {
        self.credential.replace(None);
        Ok(())
    }
}

struct RecordingApi {
    response: RefCell<Result<PlanApprovalApiResponse, PlanAuthError>>,
    calls: RefCell<Vec<(String, serde_json::Value)>>,
}

impl PlanApprovalApi for RecordingApi {
    fn consume(
        &self,
        credential: &str,
        body: &[u8],
    ) -> Result<PlanApprovalApiResponse, PlanAuthError> {
        self.calls.borrow_mut().push((
            credential.to_owned(),
            serde_json::from_slice(body).expect("native proof request should be JSON"),
        ));
        self.response.borrow_mut().as_ref().map_or_else(
            |error| Err(*error),
            |response| Ok(response.clone()),
        )
    }
}

fn store() -> MemoryCredentialStore {
    MemoryCredentialStore {
        credential: RefCell::new(Some(CREDENTIAL.to_owned())),
        reads: RefCell::new(0),
    }
}

fn receipt() -> OpaqueApprovalReceipt {
    OpaqueApprovalReceipt::from_native_response(RECEIPT.to_owned())
        .expect("opaque API receipt should enter native custody")
}

fn apply_request() -> ApplyPlanApprovalRequest {
    ApplyPlanApprovalRequest {
        authorization_context_id: "plan-review-0001".to_owned(),
        device_id: "device-0001".to_owned(),
        operation_versions: vec![
            OperationVersion {
                operation_id: "managed-power-scheme".to_owned(),
                version: "3".to_owned(),
            },
            OperationVersion {
                operation_id: "restore-checkpoint".to_owned(),
                version: "2".to_owned(),
            },
        ],
        plan_fingerprint: "plan-fingerprint-0001".to_owned(),
        receipt: receipt(),
    }
}

fn preference_request(action: AdvancedPreferenceAction) -> AdvancedPreferenceApprovalRequest {
    AdvancedPreferenceApprovalRequest {
        action,
        authorization_context_id: "advanced-preference-review-0001".to_owned(),
        device_id: "device-0001".to_owned(),
        hardware_fingerprint: "hardware-fingerprint-0001".to_owned(),
        receipt: receipt(),
        security_posture_fingerprint: "security-posture-0001".to_owned(),
    }
}

fn response(proof: serde_json::Value) -> PlanApprovalApiResponse {
    PlanApprovalApiResponse {
        status: 200,
        body: serde_json::to_vec(&json!({ "ok": true, "proof": proof }))
            .expect("proof response should serialize"),
    }
}

fn apply_proof() -> serde_json::Value {
    json!({
        "kind": "consumed-plan-approval",
        "action": "apply-transactional-plan",
        "resource": "desktop-plan",
        "authorizationContextId": "plan-review-0001",
        "evidenceId": "receipt-evidence-0001",
        "deviceId": "device-0001",
        "targetFingerprint": "server-computed-by-green",
        "verifiedAtUnixMs": NOW_MS - 60_000,
        "expiresAtUnixMs": NOW_MS + 240_000,
        "consumedAtUnixMs": NOW_MS
    })
}

fn preference_proof(action: &str) -> serde_json::Value {
    json!({
        "kind": "consumed-advanced-preference",
        "action": action,
        "resource": "desktop-risk-preference",
        "authorizationContextId": "advanced-preference-review-0001",
        "evidenceId": "receipt-evidence-0002",
        "deviceId": "device-0001",
        "targetFingerprint": "server-computed-by-green",
        "verifiedAtUnixMs": NOW_MS - 60_000,
        "expiresAtUnixMs": NOW_MS + 240_000,
        "consumedAtUnixMs": NOW_MS
    })
}

#[test]
fn apply_consumes_exact_plan_and_operation_versions_with_native_credential_custody() {
    let store = store();
    let api = RecordingApi {
        response: RefCell::new(Ok(response(apply_proof()))),
        calls: RefCell::new(Vec::new()),
    };
    let proof = consume_plan_approval(&store, &api, apply_request(), NOW_MS)
        .expect("exact scoped apply proof should be admitted once");

    assert_eq!(proof.action(), "apply-transactional-plan");
    assert_eq!(proof.evidence_id(), "receipt-evidence-0001");
    let calls = api.calls.borrow();
    assert_eq!(calls[0].0, CREDENTIAL);
    assert_eq!(calls[0].1["action"], "apply-transactional-plan");
    assert_eq!(calls[0].1["resource"], "desktop-plan");
    assert_eq!(calls[0].1["binding"]["planFingerprint"], "plan-fingerprint-0001");
    assert_eq!(calls[0].1["binding"]["operationVersions"].as_array().unwrap().len(), 2);
    assert_eq!(calls[0].1["receipt"], RECEIPT);
    assert!(!format!("{proof:?}").contains(RECEIPT));
}

#[test]
fn enable_and_revoke_use_closed_non_interchangeable_proof_types() {
    for (action, wire_action) in [
        (AdvancedPreferenceAction::Enable, "enable-advanced-preference"),
        (AdvancedPreferenceAction::Revoke, "revoke-advanced-preference"),
    ] {
        let store = store();
        let api = RecordingApi {
            response: RefCell::new(Ok(response(preference_proof(wire_action)))),
            calls: RefCell::new(Vec::new()),
        };
        let proof = consume_advanced_preference_approval(
            &store,
            &api,
            preference_request(action),
            NOW_MS,
        )
        .expect("exact preference proof should be admitted");
        assert_eq!(proof.action(), action);
        assert_eq!(proof.evidence_id(), "receipt-evidence-0002");
    }

    let store = store();
    let api = RecordingApi {
        response: RefCell::new(Ok(response(preference_proof(
            "revoke-advanced-preference",
        )))),
        calls: RefCell::new(Vec::new()),
    };
    assert_eq!(
        consume_advanced_preference_approval(
            &store,
            &api,
            preference_request(AdvancedPreferenceAction::Enable),
            NOW_MS,
        ),
        Err(PlanAuthError::InvalidResponse),
    );
}

#[test]
fn offline_signed_out_stale_and_posture_changed_proofs_fail_closed() {
    let signed_out = MemoryCredentialStore::default();
    let offline = RecordingApi {
        response: RefCell::new(Err(PlanAuthError::NetworkUnavailable)),
        calls: RefCell::new(Vec::new()),
    };
    assert_eq!(
        consume_plan_approval(&signed_out, &offline, apply_request(), NOW_MS),
        Err(PlanAuthError::SignedOut),
    );
    assert_eq!(
        consume_plan_approval(&store(), &offline, apply_request(), NOW_MS),
        Err(PlanAuthError::NetworkUnavailable),
    );

    let mut stale = apply_proof();
    stale["expiresAtUnixMs"] = json!(NOW_MS);
    let stale_api = RecordingApi {
        response: RefCell::new(Ok(response(stale))),
        calls: RefCell::new(Vec::new()),
    };
    assert_eq!(
        consume_plan_approval(&store(), &stale_api, apply_request(), NOW_MS),
        Err(PlanAuthError::InvalidResponse),
    );

    let mut changed = preference_proof("enable-advanced-preference");
    changed["targetFingerprint"] = json!("posture-changed-target");
    let changed_api = RecordingApi {
        response: RefCell::new(Ok(response(changed))),
        calls: RefCell::new(Vec::new()),
    };
    assert_eq!(
        consume_advanced_preference_approval(
            &store(),
            &changed_api,
            preference_request(AdvancedPreferenceAction::Enable),
            NOW_MS,
        ),
        Err(PlanAuthError::InvalidResponse),
    );
}

#[test]
fn local_recovery_needs_neither_network_nor_authentication() {
    let admission = admit_local_recovery();
    assert_eq!(format!("{admission:?}"), "LocalRecoveryAdmission");
}

#[test]
fn renderer_boolean_and_plaintext_sqlite_are_absent_from_native_proof_boundary() {
    let source = include_str!("../src/plan_auth.rs");
    for prohibited in ["strongAuth: true", "strong_auth: bool", "rusqlite", "localStorage"] {
        assert!(!source.contains(prohibited), "prohibited proof surface: {prohibited}");
    }
    assert!(!format!("{:?}", receipt()).contains(RECEIPT));
}
