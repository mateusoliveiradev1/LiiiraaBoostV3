#[path = "../src/main.rs"]
mod service;

use std::collections::BTreeMap;

use liiiraa_contracts_rust::{
    PrivilegedBrokerRequest, TransactionalRecoveryDocument,
    validate_transactional_recovery_document,
};
use serde_json::{Value, json};
use service::{
    dispatcher::{
        DispatchContext, InteractiveUserEffectLease, PhysicalOperationDispatcher,
        POWER_SCHEME_OPERATION_VERSION, RESTORE_POINT_OPERATION_VERSION,
    },
    ipc::{BrokerErrorCode, OperationDispatcher},
    operations::power_scheme::{
        MANAGED_SCHEME_DESCRIPTION, MANAGED_SCHEME_FRIENDLY_NAME, PowerSchemeError, PowerSchemeId,
        PowerSchemePort, PowerSchemeSnapshot, VerifiedClientContext,
    },
    restore_point::{
        ApiCallEvidence, PointObservation, RestorePointApi, RestorePointObserver,
    },
};

const SID: &str = "S-1-5-5-7-42";
const DEVICE: &str = "device-verified";

#[derive(Clone, Debug, Eq, PartialEq)]
enum PowerCall {
    Duplicate { source: u128, destination: u128 },
    Activate(u128),
    Delete(u128),
}

struct FakePower {
    active: PowerSchemeSnapshot,
    schemes: BTreeMap<PowerSchemeId, PowerSchemeSnapshot>,
    mutations: Vec<PowerCall>,
}

impl FakePower {
    fn new(active: PowerSchemeSnapshot) -> Self {
        let mut schemes = BTreeMap::new();
        schemes.insert(active.id, active.clone());
        Self {
            active,
            schemes,
            mutations: Vec::new(),
        }
    }
}

impl PowerSchemePort for FakePower {
    fn preflight(&mut self, _context: &VerifiedClientContext) -> Result<(), PowerSchemeError> {
        Ok(())
    }

    fn observe_active(
        &mut self,
        _context: &VerifiedClientContext,
    ) -> Result<PowerSchemeSnapshot, PowerSchemeError> {
        Ok(self.active.clone())
    }

    fn observe_scheme(
        &mut self,
        _context: &VerifiedClientContext,
        id: PowerSchemeId,
    ) -> Result<Option<PowerSchemeSnapshot>, PowerSchemeError> {
        Ok(self.schemes.get(&id).cloned())
    }

    fn duplicate_managed(
        &mut self,
        _context: &VerifiedClientContext,
        source: PowerSchemeId,
        destination: PowerSchemeId,
    ) -> Result<(), PowerSchemeError> {
        self.mutations.push(PowerCall::Duplicate {
            source: source.as_u128(),
            destination: destination.as_u128(),
        });
        self.schemes.insert(
            destination,
            PowerSchemeSnapshot {
                id: destination,
                friendly_name: MANAGED_SCHEME_FRIENDLY_NAME.into(),
                description: MANAGED_SCHEME_DESCRIPTION.into(),
                settings_fingerprint: self.active.settings_fingerprint.clone(),
            },
        );
        Ok(())
    }

    fn activate_managed(
        &mut self,
        _context: &VerifiedClientContext,
        id: PowerSchemeId,
    ) -> Result<(), PowerSchemeError> {
        self.mutations.push(PowerCall::Activate(id.as_u128()));
        self.active = self
            .schemes
            .get(&id)
            .cloned()
            .ok_or(PowerSchemeError::NotFound)?;
        Ok(())
    }

    fn delete_owned(
        &mut self,
        _context: &VerifiedClientContext,
        id: PowerSchemeId,
    ) -> Result<(), PowerSchemeError> {
        self.mutations.push(PowerCall::Delete(id.as_u128()));
        self.schemes.remove(&id);
        Ok(())
    }
}

#[derive(Default)]
struct FakeRestorePoint {
    descriptions: Vec<String>,
}

impl RestorePointApi for FakeRestorePoint {
    fn readiness(&mut self) -> Result<(), service::restore_point::UnavailableReason> {
        Ok(())
    }

    fn begin(&mut self, description: &str) -> ApiCallEvidence {
        self.descriptions.push(description.to_owned());
        ApiCallEvidence {
            returned: true,
            status: 0,
            sequence_number: 91,
        }
    }

    fn end(&mut self, sequence_number: i64, description: &str) -> ApiCallEvidence {
        assert_eq!(description, self.descriptions[0]);
        ApiCallEvidence {
            returned: true,
            status: 0,
            sequence_number,
        }
    }
}

impl RestorePointObserver for FakeRestorePoint {
    fn observe(&mut self, sequence_number: i64) -> PointObservation {
        PointObservation::Usable { sequence_number }
    }
}

fn id(value: u128) -> PowerSchemeId {
    PowerSchemeId::from_journaled_u128(value).expect("nonzero fixture GUID")
}

fn snapshot(value: u128, name: &str, description: &str, hash: &str) -> PowerSchemeSnapshot {
    PowerSchemeSnapshot {
        id: id(value),
        friendly_name: name.into(),
        description: description.into(),
        settings_fingerprint: hash.into(),
    }
}

fn generated(value: Value) -> PrivilegedBrokerRequest {
    match validate_transactional_recovery_document(&value).expect("generated-valid request") {
        TransactionalRecoveryDocument::PrivilegedBrokerRequest(request) => request,
        _ => panic!("fixture must be a broker request"),
    }
}

fn request(kind: &str, step: &str) -> Value {
    let common = json!({
        "kind": kind,
        "schemaVersion": "1.0",
        "requestId": step,
        "deviceBindingId": DEVICE,
        "issuedAt": "2026-08-13T08:00:00Z",
        "nonce": format!("nonce-{step}"),
        "counter": 17
    });
    common
}

fn context(step: &str, version: &str) -> DispatchContext {
    let lease = InteractiveUserEffectLease::for_test(7, SID);
    DispatchContext::with_effect_lease(
        "transaction-physical",
        step,
        version,
        7,
        SID,
        4242,
        "sha256:trusted-native-host",
        lease,
    )
}

fn assert_generated_diagnostic(document: &Value, step: &str) {
    assert_eq!(document["requestId"], step);
    assert_eq!(document["outcome"], "accepted");
    assert!(matches!(
        validate_transactional_recovery_document(document),
        Ok(TransactionalRecoveryDocument::PrivilegedBrokerResponse(_))
    ));
}

#[test]
fn all_five_generated_variants_preserve_exact_fields_and_dispatch_one_closed_effect() {
    let prior = snapshot(1, "Balanced", "Windows balanced", "sha256:prior");
    let target = snapshot(
        2,
        MANAGED_SCHEME_FRIENDLY_NAME,
        MANAGED_SCHEME_DESCRIPTION,
        "sha256:prior",
    );
    let mut power = FakePower::new(prior.clone());
    let mut restore = FakeRestorePoint::default();

    {
        let mut dispatcher = PhysicalOperationDispatcher::new(&mut power, &mut restore);
        let document = dispatcher
            .dispatch(
                generated(request("observe-power-scheme-request", "step-observe")),
                &context("step-observe", POWER_SCHEME_OPERATION_VERSION),
            )
            .expect("observe dispatches");
        assert_generated_diagnostic(&document, "step-observe");
        let audit = dispatcher.last_audit().expect("bounded audit");
        assert_eq!(audit.request_id, "step-observe");
        assert_eq!(audit.transaction_id, "transaction-physical");
        assert_eq!(audit.operation_version_id, POWER_SCHEME_OPERATION_VERSION);
        assert!(!format!("{audit:?}").contains(SID));
    }
    assert!(power.mutations.is_empty(), "observation cannot mutate");

    let mut duplicate = request("duplicate-managed-power-scheme-request", "step-duplicate");
    duplicate["sourceSchemeId"] = json!("00000000-0000-0000-0000-000000000001");
    duplicate["destinationSchemeId"] = json!("00000000-0000-0000-0000-000000000002");
    duplicate["friendlyName"] = json!(MANAGED_SCHEME_FRIENDLY_NAME);
    {
        let mut dispatcher = PhysicalOperationDispatcher::new(&mut power, &mut restore);
        let document = dispatcher
            .dispatch(
                generated(duplicate),
                &context("step-duplicate", POWER_SCHEME_OPERATION_VERSION),
            )
            .expect("duplicate dispatches");
        assert_generated_diagnostic(&document, "step-duplicate");
    }
    assert_eq!(
        power.mutations,
        [PowerCall::Duplicate {
            source: 1,
            destination: 2
        }]
    );

    let mut activate = request("activate-managed-power-scheme-request", "step-activate");
    activate["schemeId"] = json!("00000000-0000-0000-0000-000000000002");
    activate["expectedCurrentSchemeId"] =
        json!("00000000-0000-0000-0000-000000000001");
    {
        let mut dispatcher = PhysicalOperationDispatcher::new(&mut power, &mut restore);
        dispatcher
            .dispatch(
                generated(activate),
                &context("step-activate", POWER_SCHEME_OPERATION_VERSION),
            )
            .expect("activate dispatches");
    }
    assert_eq!(power.active, target);
    assert_eq!(power.mutations.last(), Some(&PowerCall::Activate(2)));

    let mut delete = request("delete-owned-power-scheme-request", "step-delete");
    delete["schemeId"] = json!("00000000-0000-0000-0000-000000000002");
    delete["expectedCanonicalStateHash"] = json!("sha256:prior");
    power.active = prior;
    {
        let mut dispatcher = PhysicalOperationDispatcher::new(&mut power, &mut restore);
        dispatcher
            .dispatch(
                generated(delete),
                &context("step-delete", POWER_SCHEME_OPERATION_VERSION),
            )
            .expect("delete dispatches");
    }
    assert_eq!(power.mutations.last(), Some(&PowerCall::Delete(2)));

    let mut prepare = request("prepare-restore-point-request", "step-restore-point");
    prepare["transactionId"] = json!("transaction-physical");
    prepare["displaySummary"] = json!("Prepare Liiiraa recovery checkpoint");
    {
        let mut dispatcher = PhysicalOperationDispatcher::new(&mut power, &mut restore);
        dispatcher
            .dispatch(
                generated(prepare),
                &context("step-restore-point", RESTORE_POINT_OPERATION_VERSION),
            )
            .expect("restore point dispatches");
    }
    assert_eq!(
        restore.descriptions,
        ["Prepare Liiiraa recovery checkpoint"]
    );
}

#[test]
fn metadata_only_or_mismatched_effect_context_calls_no_windows_port() {
    let prior = snapshot(1, "Balanced", "Windows balanced", "sha256:prior");
    let mut power = FakePower::new(prior);
    let mut restore = FakeRestorePoint::default();
    let request = generated(request("observe-power-scheme-request", "step-observe"));
    let metadata_only = DispatchContext::metadata_only(
        "transaction-physical",
        "step-observe",
        POWER_SCHEME_OPERATION_VERSION,
        7,
        SID,
        4242,
        "sha256:trusted-native-host",
    );
    let error = PhysicalOperationDispatcher::new(&mut power, &mut restore)
        .dispatch(request.clone(), &metadata_only)
        .expect_err("metadata cannot authorize an effect");
    assert_eq!(error.code, BrokerErrorCode::AuthenticationFailed);

    let wrong_lease = InteractiveUserEffectLease::for_test(99, "S-1-5-5-99-1");
    let mismatched = DispatchContext::with_effect_lease(
        "transaction-physical",
        "step-observe",
        POWER_SCHEME_OPERATION_VERSION,
        7,
        SID,
        4242,
        "sha256:trusted-native-host",
        wrong_lease,
    );
    let error = PhysicalOperationDispatcher::new(&mut power, &mut restore)
        .dispatch(request, &mismatched)
        .expect_err("lease identity must match verified metadata");
    assert_eq!(error.code, BrokerErrorCode::AuthenticationFailed);
    assert!(power.mutations.is_empty());
    assert!(restore.descriptions.is_empty());
}

#[test]
fn drift_wrong_version_and_forbidden_shapes_are_zero_call_fail_closed_cases() {
    let drifted = snapshot(3, "External", "Changed outside Liiiraa", "sha256:drift");
    let mut power = FakePower::new(drifted);
    let mut restore = FakeRestorePoint::default();
    let mut activate = request("activate-managed-power-scheme-request", "step-activate");
    activate["schemeId"] = json!("00000000-0000-0000-0000-000000000002");
    activate["expectedCurrentSchemeId"] =
        json!("00000000-0000-0000-0000-000000000001");
    let document = PhysicalOperationDispatcher::new(&mut power, &mut restore)
        .dispatch(
            generated(activate.clone()),
            &context("step-activate", POWER_SCHEME_OPERATION_VERSION),
        )
        .expect("drift is a closed diagnostic result");
    assert_eq!(document["outcome"], "rejected");
    assert_eq!(document["reasonCode"], "power-scheme-drift");
    assert!(power.mutations.is_empty());

    let error = PhysicalOperationDispatcher::new(&mut power, &mut restore)
        .dispatch(
            generated(activate),
            &context("step-activate", "power-scheme-extreme-v999"),
        )
        .expect_err("unregistered operation versions fail closed");
    assert_eq!(error.code, BrokerErrorCode::InvalidMessage);
    assert!(power.mutations.is_empty());

    for forbidden in [
        json!({"kind": "extreme-request", "command": "disable-security"}),
        json!({"kind": "script-request", "powershell": "anything"}),
        json!({"kind": "registry-request", "path": "HKLM"}),
        json!({"kind": "remote-host-request", "host": "elsewhere"}),
    ] {
        assert!(validate_transactional_recovery_document(&forbidden).is_err());
    }
    assert!(power.mutations.is_empty());
    assert!(restore.descriptions.is_empty());
}
