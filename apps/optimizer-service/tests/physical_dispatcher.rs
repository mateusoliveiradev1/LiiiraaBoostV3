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
        DispatchContext, InteractiveUserEffectLease, POWER_SCHEME_OPERATION_VERSION,
        PhysicalOperationDispatcher, RESTORE_POINT_OPERATION_VERSION,
    },
    ipc::{BrokerErrorCode, OperationDispatcher},
    operations::power_scheme::{
        MANAGED_SCHEME_DESCRIPTION, MANAGED_SCHEME_FRIENDLY_NAME, PowerSchemeError, PowerSchemeId,
        PowerSchemePort, PowerSchemeSnapshot, VerifiedClientContext,
    },
    restore_point::{ApiCallEvidence, PointObservation, RestorePointApi, RestorePointObserver},
};

const SID: &str = "S-1-5-5-7-42";
const DEVICE: &str = "device-verified";
const PRIOR_GUID: &str = "00000000-0000-4000-8000-000000000001";
const TARGET_GUID: &str = "00000000-0000-4000-8000-000000000002";
const PRIOR_HASH: &str = "sha256:1111111111111111111111111111111111111111111111111111111111111111";

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
    calls: usize,
}

impl FakePower {
    fn new(active: PowerSchemeSnapshot) -> Self {
        let mut schemes = BTreeMap::new();
        schemes.insert(active.id, active.clone());
        Self {
            active,
            schemes,
            mutations: Vec::new(),
            calls: 0,
        }
    }
}

impl PowerSchemePort for FakePower {
    fn preflight(&mut self, _context: &VerifiedClientContext) -> Result<(), PowerSchemeError> {
        self.calls += 1;
        Ok(())
    }

    fn observe_active(
        &mut self,
        _context: &VerifiedClientContext,
    ) -> Result<PowerSchemeSnapshot, PowerSchemeError> {
        self.calls += 1;
        Ok(self.active.clone())
    }

    fn observe_scheme(
        &mut self,
        _context: &VerifiedClientContext,
        id: PowerSchemeId,
    ) -> Result<Option<PowerSchemeSnapshot>, PowerSchemeError> {
        self.calls += 1;
        Ok(self.schemes.get(&id).cloned())
    }

    fn duplicate_managed(
        &mut self,
        _context: &VerifiedClientContext,
        source: PowerSchemeId,
        destination: PowerSchemeId,
    ) -> Result<(), PowerSchemeError> {
        self.calls += 1;
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
        self.calls += 1;
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
        self.calls += 1;
        self.mutations.push(PowerCall::Delete(id.as_u128()));
        self.schemes.remove(&id);
        Ok(())
    }
}

#[derive(Default)]
struct FakeRestorePointApi {
    descriptions: Vec<String>,
}

impl RestorePointApi for FakeRestorePointApi {
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

#[derive(Default)]
struct FakeRestorePointObserver;

impl RestorePointObserver for FakeRestorePointObserver {
    fn observe(&mut self, sequence_number: i64) -> PointObservation {
        PointObservation::Usable { sequence_number }
    }
}

fn id(value: u128) -> PowerSchemeId {
    PowerSchemeId::from_journaled_u128(value).expect("nonzero fixture GUID")
}

fn guid_id(value: &str) -> u128 {
    u128::from_str_radix(&value.replace('-', ""), 16).expect("valid fixture GUID")
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
    let validated = validate_transactional_recovery_document(&value)
        .unwrap_or_else(|error| panic!("generated-valid request {value}: {error:?}"));
    match validated {
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
    let prior = snapshot(
        guid_id(PRIOR_GUID),
        "Balanced",
        "Windows balanced",
        PRIOR_HASH,
    );
    let target = snapshot(
        guid_id(TARGET_GUID),
        MANAGED_SCHEME_FRIENDLY_NAME,
        MANAGED_SCHEME_DESCRIPTION,
        PRIOR_HASH,
    );
    let mut power = FakePower::new(prior.clone());
    let mut restore = FakeRestorePointApi::default();
    let mut restore_observer = FakeRestorePointObserver;

    {
        let mut dispatcher =
            PhysicalOperationDispatcher::new(&mut power, &mut restore, &mut restore_observer);
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
    duplicate["sourceSchemeId"] = json!(PRIOR_GUID);
    duplicate["destinationSchemeId"] = json!(TARGET_GUID);
    duplicate["friendlyName"] = json!(MANAGED_SCHEME_FRIENDLY_NAME);
    {
        let mut dispatcher =
            PhysicalOperationDispatcher::new(&mut power, &mut restore, &mut restore_observer);
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
            source: guid_id(PRIOR_GUID),
            destination: guid_id(TARGET_GUID)
        }]
    );

    let mut activate = request("activate-managed-power-scheme-request", "step-activate");
    activate["schemeId"] = json!(TARGET_GUID);
    activate["expectedCurrentSchemeId"] = json!(PRIOR_GUID);
    {
        let mut dispatcher =
            PhysicalOperationDispatcher::new(&mut power, &mut restore, &mut restore_observer);
        dispatcher
            .dispatch(
                generated(activate),
                &context("step-activate", POWER_SCHEME_OPERATION_VERSION),
            )
            .expect("activate dispatches");
    }
    assert_eq!(power.active, target);
    assert_eq!(
        power.mutations.last(),
        Some(&PowerCall::Activate(guid_id(TARGET_GUID)))
    );

    let mut delete = request("delete-owned-power-scheme-request", "step-delete");
    delete["schemeId"] = json!(TARGET_GUID);
    delete["expectedCanonicalStateHash"] = json!(PRIOR_HASH);
    power.active = prior;
    {
        let mut dispatcher =
            PhysicalOperationDispatcher::new(&mut power, &mut restore, &mut restore_observer);
        dispatcher
            .dispatch(
                generated(delete),
                &context("step-delete", POWER_SCHEME_OPERATION_VERSION),
            )
            .expect("delete dispatches");
    }
    assert_eq!(
        power.mutations.last(),
        Some(&PowerCall::Delete(guid_id(TARGET_GUID)))
    );

    let mut prepare = request("prepare-restore-point-request", "step-restore-point");
    prepare["transactionId"] = json!("transaction-physical");
    prepare["displaySummary"] = json!("Prepare Liiiraa recovery checkpoint");
    {
        let mut dispatcher =
            PhysicalOperationDispatcher::new(&mut power, &mut restore, &mut restore_observer);
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
    let prior = snapshot(
        guid_id(PRIOR_GUID),
        "Balanced",
        "Windows balanced",
        PRIOR_HASH,
    );
    let mut power = FakePower::new(prior);
    let mut restore = FakeRestorePointApi::default();
    let mut restore_observer = FakeRestorePointObserver;
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
    let error = PhysicalOperationDispatcher::new(&mut power, &mut restore, &mut restore_observer)
        .dispatch(request.clone(), &metadata_only)
        .expect_err("metadata cannot authorize an effect");
    assert_eq!(error.code, BrokerErrorCode::AuthenticationFailed);
    assert_eq!(power.calls, 0, "metadata must not reach any PowrProf call");

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
    let error = PhysicalOperationDispatcher::new(&mut power, &mut restore, &mut restore_observer)
        .dispatch(request, &mismatched)
        .expect_err("lease identity must match verified metadata");
    assert_eq!(error.code, BrokerErrorCode::AuthenticationFailed);
    assert_eq!(power.calls, 0, "fabricated binding must make zero calls");
    assert!(power.mutations.is_empty());
    assert!(restore.descriptions.is_empty());
}

#[test]
fn drift_wrong_version_and_forbidden_shapes_are_zero_call_fail_closed_cases() {
    let drifted = snapshot(
        guid_id("00000000-0000-4000-8000-000000000003"),
        "External",
        "Changed outside Liiiraa",
        "sha256:3333333333333333333333333333333333333333333333333333333333333333",
    );
    let mut power = FakePower::new(drifted);
    let mut restore = FakeRestorePointApi::default();
    let mut restore_observer = FakeRestorePointObserver;
    let mut activate = request("activate-managed-power-scheme-request", "step-activate");
    activate["schemeId"] = json!(TARGET_GUID);
    activate["expectedCurrentSchemeId"] = json!(PRIOR_GUID);
    let document =
        PhysicalOperationDispatcher::new(&mut power, &mut restore, &mut restore_observer)
            .dispatch(
                generated(activate.clone()),
                &context("step-activate", POWER_SCHEME_OPERATION_VERSION),
            )
            .expect("drift is a closed diagnostic result");
    assert_eq!(document["outcome"], "rejected");
    assert_eq!(document["reasonCode"], "power-scheme-drift");
    assert!(power.mutations.is_empty());

    let error = PhysicalOperationDispatcher::new(&mut power, &mut restore, &mut restore_observer)
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
