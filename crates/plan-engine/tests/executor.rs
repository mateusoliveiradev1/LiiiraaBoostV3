use std::{cell::RefCell, collections::VecDeque, rc::Rc};

use liiiraa_contracts_rust::{
    ActivateManagedPowerSchemeRequest, DependencyGroup, DurableJournalEvent, ExactOperationState,
    ObservePowerSchemeRequest, PlanTransactionDocument, PrivilegedBrokerResponse,
    RecoveryCheckpointDocument, TransactionHash, TransactionIdentifier, TransactionReceiptDocument,
};
use liiiraa_plan_engine::{
    dependency::{DependencyPolicy, DeterministicDependencyPolicy, VerifiedAppliedOperation},
    domain::{
        BrokerMutationCommand, BrokerObservationCommand, PlanEngineErrorCode, PlanEngineResult,
        PreparedMutation, PreparedObservation, PreparedTransactionIdentity,
    },
    executor::{
        DeterministicTransactionExecutor, DurableJournalPort, ExecutionAdmissionPort,
        ExecutionArtifacts, ExecutionOperation, ExecutionRequest, ExecutionVerdict, JournalAppend,
        MutationGateState, NextSafeAction, PrivilegedBrokerPort, RecoveryLoad,
        admission_blocked_error, broker_unavailable_error, journal_unavailable_error,
    },
};
use proptest::prelude::*;
use serde::de::DeserializeOwned;
use serde_json::{Value, json};

const FIXTURE: &str =
    include_str!("../../../packages/contracts-ts/src/fixtures/transactional-plans/valid.json");

fn fixture_value(id: &str) -> Value {
    serde_json::from_str::<Value>(FIXTURE).unwrap()["cases"]
        .as_array()
        .unwrap()
        .iter()
        .find(|case| case["id"] == id)
        .unwrap_or_else(|| panic!("missing fixture {id}"))["document"]
        .clone()
}

fn fixture<T: DeserializeOwned>(id: &str) -> T {
    serde_json::from_value(fixture_value(id)).unwrap()
}

fn hash(hex: char) -> TransactionHash {
    format!("sha256:{}", hex.to_string().repeat(64))
        .parse()
        .unwrap()
}

fn id(value: &str) -> TransactionIdentifier {
    value.parse().unwrap()
}

fn exact_state(scheme: &str, digit: char) -> ExactOperationState {
    serde_json::from_value(json!({
        "state": "observed",
        "schemeId": scheme,
        "canonicalStateHash": format!("sha256:{}", digit.to_string().repeat(64)),
        "observedAt": "2026-08-13T10:01:04Z"
    }))
    .unwrap()
}

fn unknown_state() -> ExactOperationState {
    serde_json::from_value(json!({
        "state": "unknown",
        "reason": "Observation timed out.",
        "observedAt": "2026-08-13T10:01:04Z"
    }))
    .unwrap()
}

fn event_parts_mut(
    event: &mut DurableJournalEvent,
) -> (&mut u32, &mut TransactionHash, &mut TransactionHash) {
    match event {
        DurableJournalEvent::PreparedJournalEvent(value) => (
            &mut value.sequence,
            &mut value.previous_event_hash,
            &mut value.event_hash,
        ),
        DurableJournalEvent::DispatchReturnedJournalEvent(value) => (
            &mut value.sequence,
            &mut value.previous_event_hash,
            &mut value.event_hash,
        ),
        DurableJournalEvent::ObservedJournalEvent(value) => (
            &mut value.sequence,
            &mut value.previous_event_hash,
            &mut value.event_hash,
        ),
        DurableJournalEvent::VerifiedJournalEvent(value) => (
            &mut value.sequence,
            &mut value.previous_event_hash,
            &mut value.event_hash,
        ),
        DurableJournalEvent::NotAppliedJournalEvent(value) => (
            &mut value.sequence,
            &mut value.previous_event_hash,
            &mut value.event_hash,
        ),
        DurableJournalEvent::UnknownJournalEvent(value) => (
            &mut value.sequence,
            &mut value.previous_event_hash,
            &mut value.event_hash,
        ),
        DurableJournalEvent::DriftJournalEvent(value) => (
            &mut value.sequence,
            &mut value.previous_event_hash,
            &mut value.event_hash,
        ),
        DurableJournalEvent::ConflictJournalEvent(value) => (
            &mut value.sequence,
            &mut value.previous_event_hash,
            &mut value.event_hash,
        ),
        DurableJournalEvent::RestorePreparedJournalEvent(value) => (
            &mut value.sequence,
            &mut value.previous_event_hash,
            &mut value.event_hash,
        ),
        DurableJournalEvent::RestoredJournalEvent(value) => (
            &mut value.sequence,
            &mut value.previous_event_hash,
            &mut value.event_hash,
        ),
    }
}

fn chain(event: &mut DurableJournalEvent, sequence: u32, previous: char, current: char) {
    let (event_sequence, previous_hash, event_hash) = event_parts_mut(event);
    *event_sequence = sequence;
    *previous_hash = hash(previous);
    *event_hash = hash(current);
}

fn normalize_event_identity(event: &mut DurableJournalEvent) {
    macro_rules! normalize {
        ($value:expr) => {{
            $value.transaction_id = id("transaction-0001");
            $value.operation_version_id = id("power-scheme-v1");
        }};
    }
    match event {
        DurableJournalEvent::PreparedJournalEvent(value) => normalize!(value),
        DurableJournalEvent::DispatchReturnedJournalEvent(value) => normalize!(value),
        DurableJournalEvent::ObservedJournalEvent(value) => normalize!(value),
        DurableJournalEvent::VerifiedJournalEvent(value) => normalize!(value),
        DurableJournalEvent::NotAppliedJournalEvent(value) => normalize!(value),
        DurableJournalEvent::UnknownJournalEvent(value) => normalize!(value),
        DurableJournalEvent::DriftJournalEvent(value) => normalize!(value),
        DurableJournalEvent::ConflictJournalEvent(value) => normalize!(value),
        DurableJournalEvent::RestorePreparedJournalEvent(value) => normalize!(value),
        DurableJournalEvent::RestoredJournalEvent(value) => normalize!(value),
    }
}

fn rebind_event(event: &mut DurableJournalEvent, transaction: &str, operation: &str) {
    macro_rules! rebind {
        ($value:expr) => {{
            $value.transaction_id = id(transaction);
            $value.operation_version_id = id(operation);
        }};
    }
    match event {
        DurableJournalEvent::PreparedJournalEvent(value) => rebind!(value),
        DurableJournalEvent::DispatchReturnedJournalEvent(value) => rebind!(value),
        DurableJournalEvent::ObservedJournalEvent(value) => rebind!(value),
        DurableJournalEvent::VerifiedJournalEvent(value) => rebind!(value),
        DurableJournalEvent::NotAppliedJournalEvent(value) => rebind!(value),
        DurableJournalEvent::UnknownJournalEvent(value) => rebind!(value),
        DurableJournalEvent::DriftJournalEvent(value) => rebind!(value),
        DurableJournalEvent::ConflictJournalEvent(value) => rebind!(value),
        DurableJournalEvent::RestorePreparedJournalEvent(value) => rebind!(value),
        DurableJournalEvent::RestoredJournalEvent(value) => rebind!(value),
    }
}

fn set_observed_state(event: &mut DurableJournalEvent, state: ExactOperationState) {
    match event {
        DurableJournalEvent::ObservedJournalEvent(value) => value.exact_observed_state = state,
        DurableJournalEvent::VerifiedJournalEvent(value) => value.exact_observed_state = state,
        DurableJournalEvent::NotAppliedJournalEvent(value) => value.exact_observed_state = state,
        DurableJournalEvent::UnknownJournalEvent(value) => value.exact_observed_state = state,
        DurableJournalEvent::DriftJournalEvent(value) => value.exact_observed_state = state,
        DurableJournalEvent::ConflictJournalEvent(value) => value.exact_observed_state = state,
        DurableJournalEvent::RestoredJournalEvent(value) => value.exact_observed_state = state,
        _ => panic!("event has no observed state"),
    }
}

fn artifacts(observed: ExactOperationState, dispatch_recorded: bool) -> ExecutionArtifacts {
    let mut prepared = fixture("journal prepared");
    let mut dispatch = fixture("journal dispatch returned");
    let mut observed_event = fixture("journal observed");
    let mut verified = fixture("journal verified");
    let mut not_applied = fixture("journal not applied");
    let mut unknown = fixture("journal unknown");
    let mut drift = fixture("journal drift");
    let mut conflict = fixture("journal conflict");
    let mut restored = fixture("journal restored");
    for event in [
        &mut prepared,
        &mut dispatch,
        &mut observed_event,
        &mut verified,
        &mut not_applied,
        &mut unknown,
        &mut drift,
        &mut conflict,
        &mut restored,
    ] {
        normalize_event_identity(event);
    }
    chain(&mut prepared, 0, '0', '1');
    let (observed_sequence, observed_previous, observed_hash, verdict_sequence, verdict_previous) =
        if dispatch_recorded {
            chain(&mut dispatch, 1, '1', '2');
            (2, '2', '3', 3, '3')
        } else {
            (1, '1', '2', 2, '2')
        };
    chain(
        &mut observed_event,
        observed_sequence,
        observed_previous,
        observed_hash,
    );
    for event in [
        &mut verified,
        &mut not_applied,
        &mut unknown,
        &mut drift,
        &mut conflict,
        &mut restored,
    ] {
        chain(event, verdict_sequence, verdict_previous, '4');
        set_observed_state(event, observed.clone());
    }
    set_observed_state(&mut observed_event, observed.clone());
    let mut receipt: TransactionReceiptDocument = fixture("complete verified receipt");
    receipt.exact_observed_state = observed.clone();
    receipt.verification.exact_observed_state = observed;
    receipt.journal_head_hash = hash('4');
    ExecutionArtifacts {
        prepared,
        dispatch_returned: dispatch_recorded.then_some(dispatch),
        observed: observed_event,
        verified,
        not_applied,
        unknown,
        drift,
        conflict,
        restored,
        receipt,
        restart_checkpoint: Some(fixture("protected recovery checkpoint")),
    }
}

fn observation_response(state: ExactOperationState) -> PrivilegedBrokerResponse {
    let mut response = fixture_value("bounded broker response");
    response["exactObservedState"] = serde_json::to_value(state).unwrap();
    serde_json::from_value(response).unwrap()
}

fn accepted_response() -> PrivilegedBrokerResponse {
    serde_json::from_value(json!({
        "kind": "broker-accepted-response",
        "schemaVersion": "1.0",
        "responseId": "broker-response-0001",
        "requestId": "broker-request-0001",
        "outcome": "accepted",
        "completedAt": "2026-08-13T10:01:03Z"
    }))
    .unwrap()
}

fn request(observed: ExactOperationState, dispatch_recorded: bool) -> ExecutionRequest {
    let exact_prior_state = exact_state("11111111-1111-4111-8111-111111111111", '1');
    let exact_requested_state = exact_state("22222222-2222-4222-8222-222222222222", '2');
    let observation: ObservePowerSchemeRequest = fixture("narrow broker request");
    let mutation: ActivateManagedPowerSchemeRequest = serde_json::from_value(json!({
        "kind": "activate-managed-power-scheme-request",
        "schemaVersion": "1.0",
        "requestId": "broker-request-0001",
        "deviceBindingId": "device-0001",
        "schemeId": "22222222-2222-4222-8222-222222222222",
        "expectedCurrentSchemeId": "11111111-1111-4111-8111-111111111111",
        "issuedAt": "2026-08-13T10:01:02Z",
        "nonce": "nonce-0001",
        "counter": 1
    }))
    .unwrap();
    ExecutionRequest {
        transaction: fixture("auditable apply transaction"),
        operation_version_id: id("power-scheme-v1"),
        exact_prior_state,
        exact_requested_state,
        observation_command: BrokerObservationCommand::ObservePowerScheme(observation),
        mutation_command: BrokerMutationCommand::ActivateManagedPowerScheme(mutation),
        operation: ExecutionOperation::Apply,
        expected_head_hash: hash('0'),
        read_retry_limit: 2,
        cancel_before_dispatch: false,
        restart_required: false,
        artifacts: artifacts(observed, dispatch_recorded),
    }
}

fn make_restore(request: &mut ExecutionRequest) {
    request.transaction.intent = liiiraa_contracts_rust::TransactionIntent::RestoreOperation;
    request.operation = ExecutionOperation::Restore;
    std::mem::swap(
        &mut request.exact_prior_state,
        &mut request.exact_requested_state,
    );
    let mut restore_prepared = fixture("journal restore prepared");
    normalize_event_identity(&mut restore_prepared);
    chain(&mut restore_prepared, 0, '0', '1');
    request.artifacts.prepared = restore_prepared;
    request.artifacts.receipt.exact_prior_state = request.exact_prior_state.clone();
    request.artifacts.receipt.exact_requested_state = request.exact_requested_state.clone();
}

fn rebind_request(request: &mut ExecutionRequest, transaction: &str, operation: &str) {
    request.transaction.transaction_id = id(transaction);
    request.operation_version_id = id(operation);
    rebind_event(&mut request.artifacts.prepared, transaction, operation);
    if let Some(dispatch) = request.artifacts.dispatch_returned.as_mut() {
        rebind_event(dispatch, transaction, operation);
    }
    for event in [
        &mut request.artifacts.observed,
        &mut request.artifacts.verified,
        &mut request.artifacts.not_applied,
        &mut request.artifacts.unknown,
        &mut request.artifacts.drift,
        &mut request.artifacts.conflict,
        &mut request.artifacts.restored,
    ] {
        rebind_event(event, transaction, operation);
    }
    request.artifacts.receipt.transaction_id = id(transaction);
    request.artifacts.receipt.operation_version_id = id(operation);
    if let Some(checkpoint) = request.artifacts.restart_checkpoint.as_mut() {
        checkpoint.transaction_id = id(transaction);
    }
}

#[derive(Clone, Copy, Debug, Eq, PartialEq)]
enum JournalFault {
    None,
    Prepare,
    Append(usize),
    Receipt,
    Checkpoint,
}

struct MemoryJournal {
    recovery: RecoveryLoad,
    fault: JournalFault,
    append_attempts: usize,
    sequences: Vec<u32>,
    receipts: usize,
    checkpoints: usize,
    trace: Rc<RefCell<Vec<&'static str>>>,
}

impl MemoryJournal {
    fn clear(trace: Rc<RefCell<Vec<&'static str>>>) -> Self {
        Self {
            recovery: RecoveryLoad::Clear,
            fault: JournalFault::None,
            append_attempts: 0,
            sequences: Vec::new(),
            receipts: 0,
            checkpoints: 0,
            trace,
        }
    }
}

fn event_sequence(event: &DurableJournalEvent) -> u32 {
    match event {
        DurableJournalEvent::PreparedJournalEvent(value) => value.sequence,
        DurableJournalEvent::DispatchReturnedJournalEvent(value) => value.sequence,
        DurableJournalEvent::ObservedJournalEvent(value) => value.sequence,
        DurableJournalEvent::VerifiedJournalEvent(value) => value.sequence,
        DurableJournalEvent::NotAppliedJournalEvent(value) => value.sequence,
        DurableJournalEvent::UnknownJournalEvent(value) => value.sequence,
        DurableJournalEvent::DriftJournalEvent(value) => value.sequence,
        DurableJournalEvent::ConflictJournalEvent(value) => value.sequence,
        DurableJournalEvent::RestorePreparedJournalEvent(value) => value.sequence,
        DurableJournalEvent::RestoredJournalEvent(value) => value.sequence,
    }
}

fn event_hash(event: &DurableJournalEvent) -> TransactionHash {
    match event {
        DurableJournalEvent::PreparedJournalEvent(value) => value.event_hash.clone(),
        DurableJournalEvent::DispatchReturnedJournalEvent(value) => value.event_hash.clone(),
        DurableJournalEvent::ObservedJournalEvent(value) => value.event_hash.clone(),
        DurableJournalEvent::VerifiedJournalEvent(value) => value.event_hash.clone(),
        DurableJournalEvent::NotAppliedJournalEvent(value) => value.event_hash.clone(),
        DurableJournalEvent::UnknownJournalEvent(value) => value.event_hash.clone(),
        DurableJournalEvent::DriftJournalEvent(value) => value.event_hash.clone(),
        DurableJournalEvent::ConflictJournalEvent(value) => value.event_hash.clone(),
        DurableJournalEvent::RestorePreparedJournalEvent(value) => value.event_hash.clone(),
        DurableJournalEvent::RestoredJournalEvent(value) => value.event_hash.clone(),
    }
}

impl DurableJournalPort for MemoryJournal {
    fn append_prepared(
        &mut self,
        _transaction: &PlanTransactionDocument,
        prepared_event: &DurableJournalEvent,
    ) -> PlanEngineResult<()> {
        self.trace.borrow_mut().push("prepared");
        if self.fault == JournalFault::Prepare {
            return Err(journal_unavailable_error());
        }
        self.sequences.push(event_sequence(prepared_event));
        Ok(())
    }

    fn append(&mut self, append: JournalAppend<'_>) -> PlanEngineResult<TransactionHash> {
        self.append_attempts += 1;
        self.trace.borrow_mut().push("append");
        if self.fault == JournalFault::Append(self.append_attempts) {
            return Err(journal_unavailable_error());
        }
        self.sequences.push(event_sequence(append.event));
        Ok(event_hash(append.event))
    }

    fn store_checkpoint(
        &mut self,
        _transaction: &PreparedTransactionIdentity,
        _expected_prior_state: &ExactOperationState,
        _checkpoint: &RecoveryCheckpointDocument,
    ) -> PlanEngineResult<()> {
        if self.fault == JournalFault::Checkpoint {
            return Err(journal_unavailable_error());
        }
        self.checkpoints += 1;
        self.trace.borrow_mut().push("checkpoint");
        Ok(())
    }

    fn store_receipt(
        &mut self,
        _transaction: &PreparedTransactionIdentity,
        _expected_prior_state: &ExactOperationState,
        _receipt: &TransactionReceiptDocument,
    ) -> PlanEngineResult<()> {
        if self.fault == JournalFault::Receipt {
            return Err(journal_unavailable_error());
        }
        self.receipts += 1;
        self.trace.borrow_mut().push("receipt");
        Ok(())
    }

    fn load_recovery(&self) -> PlanEngineResult<RecoveryLoad> {
        self.trace.borrow_mut().push("load-recovery");
        Ok(self.recovery.clone())
    }
}

struct FaultBroker {
    observations: RefCell<VecDeque<PlanEngineResult<PrivilegedBrokerResponse>>>,
    mutations_results: VecDeque<PlanEngineResult<PrivilegedBrokerResponse>>,
    mutations: usize,
    max_in_flight: usize,
    in_flight: usize,
    trace: Rc<RefCell<Vec<&'static str>>>,
}

impl FaultBroker {
    fn success(
        trace: Rc<RefCell<Vec<&'static str>>>,
        prior: ExactOperationState,
        observed: ExactOperationState,
    ) -> Self {
        Self {
            observations: RefCell::new(VecDeque::from([
                Ok(observation_response(prior)),
                Ok(observation_response(observed)),
            ])),
            mutations_results: VecDeque::from([Ok(accepted_response())]),
            mutations: 0,
            max_in_flight: 0,
            in_flight: 0,
            trace,
        }
    }
}

impl PrivilegedBrokerPort for FaultBroker {
    fn observe(
        &self,
        _observation: &PreparedObservation,
    ) -> PlanEngineResult<PrivilegedBrokerResponse> {
        self.trace.borrow_mut().push("observe");
        self.observations
            .borrow_mut()
            .pop_front()
            .unwrap_or_else(|| Err(broker_unavailable_error()))
    }

    fn mutate(
        &mut self,
        _mutation: &PreparedMutation,
    ) -> PlanEngineResult<PrivilegedBrokerResponse> {
        self.trace.borrow_mut().push("mutate");
        self.mutations += 1;
        self.in_flight += 1;
        self.max_in_flight = self.max_in_flight.max(self.in_flight);
        let result = self
            .mutations_results
            .pop_front()
            .unwrap_or_else(|| Err(broker_unavailable_error()));
        self.in_flight -= 1;
        result
    }
}

struct Admission {
    rejection: Option<PlanEngineErrorCode>,
    trace: Rc<RefCell<Vec<&'static str>>>,
}

impl ExecutionAdmissionPort for Admission {
    fn recompute(&self, _request: &ExecutionRequest) -> PlanEngineResult<()> {
        self.trace.borrow_mut().push("admission");
        self.rejection
            .map_or(Ok(()), |code| Err(admission_blocked_error(code)))
    }
}

fn run(
    request: &ExecutionRequest,
    journal: &mut MemoryJournal,
    broker: &mut FaultBroker,
    rejection: Option<PlanEngineErrorCode>,
) -> liiiraa_plan_engine::domain::PlanEngineResult<liiiraa_plan_engine::executor::ExecutionOutcome>
{
    DeterministicTransactionExecutor::new().execute(
        request,
        journal,
        broker,
        &Admission {
            rejection,
            trace: Rc::clone(&journal.trace),
        },
    )
}

#[test]
fn prepare_commits_before_the_single_mutation_and_success_requires_observation_and_receipt() {
    let trace = Rc::new(RefCell::new(Vec::new()));
    let requested = exact_state("22222222-2222-4222-8222-222222222222", '2');
    let request = request(requested.clone(), true);
    let mut journal = MemoryJournal::clear(Rc::clone(&trace));
    let mut broker = FaultBroker::success(
        Rc::clone(&trace),
        request.exact_prior_state.clone(),
        requested,
    );

    let outcome = run(&request, &mut journal, &mut broker, None).unwrap();

    assert_eq!(outcome.verdict(), ExecutionVerdict::Verified);
    assert_eq!(outcome.gate(), MutationGateState::Open);
    assert_eq!(outcome.durable_sequences(), &[0, 1, 2, 3]);
    assert_eq!(outcome.dispatch_count(), 1);
    assert!(outcome.receipt_stored());
    let trace = trace.borrow();
    assert!(
        trace.iter().position(|step| *step == "prepared").unwrap()
            < trace.iter().position(|step| *step == "mutate").unwrap()
    );
    assert!(
        trace.iter().rposition(|step| *step == "append").unwrap()
            < trace.iter().position(|step| *step == "receipt").unwrap()
    );
}

#[test]
fn before_prepare_and_busy_full_ioerr_prepare_failures_never_dispatch() {
    for rejection in [
        Some(PlanEngineErrorCode::ApprovalStale),
        Some(PlanEngineErrorCode::Revoked),
        None,
        None,
        None,
    ] {
        let trace = Rc::new(RefCell::new(Vec::new()));
        let requested = exact_state("22222222-2222-4222-8222-222222222222", '2');
        let request = request(requested.clone(), true);
        let mut journal = MemoryJournal::clear(Rc::clone(&trace));
        if rejection.is_none() {
            journal.fault = JournalFault::Prepare;
        }
        let mut broker = FaultBroker::success(
            Rc::clone(&trace),
            request.exact_prior_state.clone(),
            requested,
        );
        let outcome = run(&request, &mut journal, &mut broker, rejection).unwrap();
        assert!(matches!(
            outcome.verdict(),
            ExecutionVerdict::AdmissionBlocked | ExecutionVerdict::JournalFailure
        ));
        assert_eq!(broker.mutations, 0);
        assert!(!outcome.receipt_stored());
        assert!(!outcome.allows_automatic_mutation_retry());
    }
}

#[test]
fn stale_wrong_action_fingerprint_evidence_risk_recovery_and_revocation_admission_fail_closed() {
    for rejection in [
        PlanEngineErrorCode::ApprovalStale,
        PlanEngineErrorCode::StrongAuthenticationRejected,
        PlanEngineErrorCode::EvidenceNotAdmitted,
        PlanEngineErrorCode::RiskCeilingExceeded,
        PlanEngineErrorCode::RecoveryBlocked,
        PlanEngineErrorCode::Revoked,
    ] {
        let trace = Rc::new(RefCell::new(Vec::new()));
        let requested = exact_state("22222222-2222-4222-8222-222222222222", '2');
        let request = request(requested.clone(), true);
        let mut journal = MemoryJournal::clear(Rc::clone(&trace));
        let mut broker = FaultBroker::success(
            Rc::clone(&trace),
            request.exact_prior_state.clone(),
            requested,
        );
        let outcome = run(&request, &mut journal, &mut broker, Some(rejection)).unwrap();
        assert_eq!(outcome.verdict(), ExecutionVerdict::AdmissionBlocked);
        assert_eq!(broker.mutations, 0);
        assert!(!trace.borrow().contains(&"prepared"));
    }
}

#[test]
fn cancellation_after_prepare_stops_at_the_safe_boundary() {
    let trace = Rc::new(RefCell::new(Vec::new()));
    let requested = exact_state("22222222-2222-4222-8222-222222222222", '2');
    let mut request = request(requested.clone(), true);
    request.cancel_before_dispatch = true;
    let mut journal = MemoryJournal::clear(Rc::clone(&trace));
    let mut broker = FaultBroker::success(
        Rc::clone(&trace),
        request.exact_prior_state.clone(),
        requested,
    );
    let outcome = run(&request, &mut journal, &mut broker, None).unwrap();
    assert_eq!(outcome.verdict(), ExecutionVerdict::CancelledAtSafeBoundary);
    assert_eq!(
        outcome.next_safe_action(),
        NextSafeAction::StopBeforeNextStage
    );
    assert_eq!(broker.mutations, 0);
    assert_eq!(outcome.durable_sequences(), &[0]);
}

#[test]
fn timeout_before_or_after_effect_and_response_loss_are_observed_without_redispatch() {
    for observed in [
        exact_state("11111111-1111-4111-8111-111111111111", '1'),
        exact_state("22222222-2222-4222-8222-222222222222", '2'),
        unknown_state(),
    ] {
        let trace = Rc::new(RefCell::new(Vec::new()));
        let request = request(observed.clone(), false);
        let mut journal = MemoryJournal::clear(Rc::clone(&trace));
        let mut broker = FaultBroker::success(
            Rc::clone(&trace),
            request.exact_prior_state.clone(),
            observed,
        );
        broker.mutations_results = VecDeque::from([Err(broker_unavailable_error())]);
        let outcome = run(&request, &mut journal, &mut broker, None).unwrap();
        assert_eq!(broker.mutations, 1);
        assert_eq!(outcome.dispatch_count(), 1);
        assert!(!outcome.allows_automatic_mutation_retry());
        assert!(matches!(
            outcome.verdict(),
            ExecutionVerdict::Verified | ExecutionVerdict::NotApplied | ExecutionVerdict::Unknown
        ));
        if outcome.verdict() != ExecutionVerdict::Verified {
            assert!(!outcome.receipt_stored());
        }
    }
}

#[test]
fn crash_before_observation_or_verdict_append_preserves_pending_evidence_without_receipt() {
    for append in [1, 2, 3] {
        let trace = Rc::new(RefCell::new(Vec::new()));
        let requested = exact_state("22222222-2222-4222-8222-222222222222", '2');
        let request = request(requested.clone(), true);
        let mut journal = MemoryJournal::clear(Rc::clone(&trace));
        journal.fault = JournalFault::Append(append);
        let mut broker = FaultBroker::success(
            Rc::clone(&trace),
            request.exact_prior_state.clone(),
            requested,
        );
        let outcome = run(&request, &mut journal, &mut broker, None).unwrap();
        assert_eq!(outcome.verdict(), ExecutionVerdict::JournalFailure);
        assert_eq!(outcome.gate(), MutationGateState::ClosedForJournalFailure);
        assert_eq!(broker.mutations, 1);
        assert_eq!(journal.receipts, 0);
        assert_eq!(
            outcome.next_safe_action(),
            NextSafeAction::ReconcilePendingTransaction
        );
    }
}

#[test]
fn verification_and_receipt_failure_never_publish_verified_success() {
    for fault in [JournalFault::Receipt, JournalFault::Append(3)] {
        let trace = Rc::new(RefCell::new(Vec::new()));
        let requested = exact_state("22222222-2222-4222-8222-222222222222", '2');
        let request = request(requested.clone(), true);
        let mut journal = MemoryJournal::clear(Rc::clone(&trace));
        journal.fault = fault;
        let mut broker = FaultBroker::success(
            Rc::clone(&trace),
            request.exact_prior_state.clone(),
            requested,
        );
        let outcome = run(&request, &mut journal, &mut broker, None).unwrap();
        assert_eq!(outcome.verdict(), ExecutionVerdict::JournalFailure);
        assert!(!outcome.receipt_stored());
        assert_eq!(outcome.gate(), MutationGateState::ClosedForJournalFailure);
    }
}

#[test]
fn startup_pending_corruption_shutdown_and_reboot_preempt_new_mutation() {
    for recovery in [
        RecoveryLoad::Pending {
            transaction: Box::new(fixture("auditable apply transaction")),
            latest_event: Box::new(fixture("journal prepared")),
        },
        RecoveryLoad::CorruptOrUnavailable,
    ] {
        let trace = Rc::new(RefCell::new(Vec::new()));
        let requested = exact_state("22222222-2222-4222-8222-222222222222", '2');
        let request = request(requested.clone(), true);
        let mut journal = MemoryJournal::clear(Rc::clone(&trace));
        journal.recovery = recovery;
        let mut broker = FaultBroker::success(
            Rc::clone(&trace),
            request.exact_prior_state.clone(),
            requested,
        );
        let outcome = run(&request, &mut journal, &mut broker, None).unwrap();
        assert!(matches!(
            outcome.verdict(),
            ExecutionVerdict::RecoveryPriority | ExecutionVerdict::JournalFailure
        ));
        assert_eq!(broker.mutations, 0);
        assert_ne!(outcome.gate(), MutationGateState::Open);
    }
}

#[test]
fn boot_time_reconciliation_observes_pending_effect_without_redispatch() {
    let trace = Rc::new(RefCell::new(Vec::new()));
    let requested = exact_state("22222222-2222-4222-8222-222222222222", '2');
    let request = request(requested.clone(), false);
    let mut journal = MemoryJournal::clear(Rc::clone(&trace));
    journal.recovery = RecoveryLoad::Pending {
        transaction: Box::new(request.transaction.clone()),
        latest_event: Box::new(request.artifacts.prepared.clone()),
    };
    let mut broker = FaultBroker::success(
        Rc::clone(&trace),
        request.exact_prior_state.clone(),
        requested.clone(),
    );
    broker.observations = RefCell::new(VecDeque::from([Ok(observation_response(requested))]));

    let outcome = DeterministicTransactionExecutor::new()
        .reconcile_startup(&request, &mut journal, &broker)
        .unwrap();

    assert_eq!(outcome.verdict(), ExecutionVerdict::Verified);
    assert_eq!(outcome.dispatch_count(), 0);
    assert_eq!(broker.mutations, 0);
    assert_eq!(outcome.durable_sequences(), &[0, 1, 2]);
    assert!(outcome.receipt_stored());
}

#[test]
fn explicit_restore_is_a_new_prepared_transaction_and_never_an_implicit_retry() {
    let trace = Rc::new(RefCell::new(Vec::new()));
    let restore_target = exact_state("11111111-1111-4111-8111-111111111111", '1');
    let mut request = request(restore_target.clone(), true);
    make_restore(&mut request);
    let mut journal = MemoryJournal::clear(Rc::clone(&trace));
    let mut broker = FaultBroker::success(
        Rc::clone(&trace),
        request.exact_prior_state.clone(),
        restore_target,
    );

    let outcome = run(&request, &mut journal, &mut broker, None).unwrap();

    assert_eq!(outcome.verdict(), ExecutionVerdict::Restored);
    assert_eq!(outcome.dispatch_count(), 1);
    assert_eq!(journal.sequences, vec![0, 1, 2, 3]);
    assert!(outcome.receipt_stored());
    assert!(!outcome.allows_automatic_mutation_retry());
}

#[test]
fn partial_failure_auto_restores_only_the_verified_dependency_closure() {
    let groups = vec![
        DependencyGroup {
            dependency_group_id: id("group-base"),
            operation_version_ids: vec![id("op-base")],
            depends_on_group_ids: vec![],
        },
        DependencyGroup {
            dependency_group_id: id("group-failed"),
            operation_version_ids: vec![id("op-failed")],
            depends_on_group_ids: vec![id("group-base")],
        },
        DependencyGroup {
            dependency_group_id: id("group-independent"),
            operation_version_ids: vec![id("op-independent")],
            depends_on_group_ids: vec![],
        },
    ];
    let graph = DeterministicDependencyPolicy.validate(groups).unwrap();
    let applied = vec![
        VerifiedAppliedOperation::new(
            id("op-base"),
            id("group-base"),
            exact_state("22222222-2222-4222-8222-222222222222", '2'),
            exact_state("11111111-1111-4111-8111-111111111111", '1'),
        ),
        VerifiedAppliedOperation::new(
            id("op-independent"),
            id("group-independent"),
            exact_state("22222222-2222-4222-8222-222222222222", '2'),
            exact_state("11111111-1111-4111-8111-111111111111", '1'),
        ),
    ];
    let rollback = DeterministicDependencyPolicy
        .rollback_after_failure(&graph, &id("op-failed"), &applied)
        .unwrap();

    let trace = Rc::new(RefCell::new(Vec::new()));
    let restore_target = exact_state("11111111-1111-4111-8111-111111111111", '1');
    let mut restore = request(restore_target.clone(), true);
    make_restore(&mut restore);
    rebind_request(&mut restore, "restore-transaction-0001", "op-base");
    let mut journal = MemoryJournal::clear(Rc::clone(&trace));
    let mut broker = FaultBroker::success(
        Rc::clone(&trace),
        restore.exact_prior_state.clone(),
        restore_target,
    );
    let admission = Admission {
        rejection: Some(PlanEngineErrorCode::StrongAuthenticationRejected),
        trace: Rc::clone(&trace),
    };

    let outcome = DeterministicTransactionExecutor::new()
        .execute_rollback(&rollback, &[restore], &mut journal, &mut broker, &admission)
        .unwrap();

    assert_eq!(outcome.steps().len(), 1);
    assert_eq!(outcome.steps()[0].verdict(), ExecutionVerdict::Restored);
    assert_eq!(
        outcome.preserved_operation_version_ids(),
        &[id("op-independent")]
    );
    assert!(outcome.failed_restore_operation_version_id().is_none());
    assert_eq!(outcome.gate(), MutationGateState::Open);
    assert_eq!(broker.mutations, 1);
}

#[test]
fn failed_scoped_restore_blocks_all_new_mutation_and_preserves_independent_evidence() {
    let groups = vec![
        DependencyGroup {
            dependency_group_id: id("group-base"),
            operation_version_ids: vec![id("op-base")],
            depends_on_group_ids: vec![],
        },
        DependencyGroup {
            dependency_group_id: id("group-failed"),
            operation_version_ids: vec![id("op-failed")],
            depends_on_group_ids: vec![id("group-base")],
        },
        DependencyGroup {
            dependency_group_id: id("group-independent"),
            operation_version_ids: vec![id("op-independent")],
            depends_on_group_ids: vec![],
        },
    ];
    let graph = DeterministicDependencyPolicy.validate(groups).unwrap();
    let applied = vec![
        VerifiedAppliedOperation::new(
            id("op-base"),
            id("group-base"),
            exact_state("22222222-2222-4222-8222-222222222222", '2'),
            exact_state("11111111-1111-4111-8111-111111111111", '1'),
        ),
        VerifiedAppliedOperation::new(
            id("op-independent"),
            id("group-independent"),
            exact_state("22222222-2222-4222-8222-222222222222", '2'),
            exact_state("11111111-1111-4111-8111-111111111111", '1'),
        ),
    ];
    let rollback = DeterministicDependencyPolicy
        .rollback_after_failure(&graph, &id("op-failed"), &applied)
        .unwrap();
    let trace = Rc::new(RefCell::new(Vec::new()));
    let observed = unknown_state();
    let mut restore = request(observed.clone(), true);
    make_restore(&mut restore);
    rebind_request(&mut restore, "restore-transaction-0002", "op-base");
    let mut journal = MemoryJournal::clear(Rc::clone(&trace));
    let mut broker = FaultBroker::success(
        Rc::clone(&trace),
        restore.exact_prior_state.clone(),
        observed,
    );
    let admission = Admission {
        rejection: None,
        trace: Rc::clone(&trace),
    };

    let outcome = DeterministicTransactionExecutor::new()
        .execute_rollback(&rollback, &[restore], &mut journal, &mut broker, &admission)
        .unwrap();

    assert_eq!(outcome.steps()[0].verdict(), ExecutionVerdict::Unknown);
    assert_eq!(
        outcome
            .failed_restore_operation_version_id()
            .unwrap()
            .as_str(),
        "op-base"
    );
    assert_eq!(
        outcome.preserved_operation_version_ids(),
        &[id("op-independent")]
    );
    assert_ne!(outcome.gate(), MutationGateState::Open);
    assert_eq!(broker.mutations, 1);
}

#[test]
fn explicit_retry_requires_a_new_parented_reviewed_transaction() {
    let trace = Rc::new(RefCell::new(Vec::new()));
    let requested = exact_state("22222222-2222-4222-8222-222222222222", '2');
    let mut request = request(requested.clone(), true);
    request.transaction.intent = liiiraa_contracts_rust::TransactionIntent::RetryAfterObservation;
    request.transaction.parent_transaction_id = Some(id("transaction-0001"));
    rebind_request(&mut request, "retry-transaction-0001", "power-scheme-v1");
    let mut journal = MemoryJournal::clear(Rc::clone(&trace));
    let mut broker = FaultBroker::success(
        Rc::clone(&trace),
        request.exact_prior_state.clone(),
        requested,
    );

    let outcome = run(&request, &mut journal, &mut broker, None).unwrap();

    assert_eq!(outcome.verdict(), ExecutionVerdict::Verified);
    assert_eq!(broker.mutations, 1);
    assert!(trace.borrow().contains(&"admission"));
    assert!(trace.borrow().contains(&"prepared"));
}

#[test]
fn reads_retry_only_to_the_bound_and_mutations_never_retry() {
    let trace = Rc::new(RefCell::new(Vec::new()));
    let requested = exact_state("22222222-2222-4222-8222-222222222222", '2');
    let request = request(requested.clone(), true);
    let mut journal = MemoryJournal::clear(Rc::clone(&trace));
    let mut broker = FaultBroker::success(
        Rc::clone(&trace),
        request.exact_prior_state.clone(),
        requested.clone(),
    );
    broker.observations = RefCell::new(VecDeque::from([
        Err(broker_unavailable_error()),
        Err(broker_unavailable_error()),
        Ok(observation_response(request.exact_prior_state.clone())),
        Err(broker_unavailable_error()),
        Ok(observation_response(requested)),
    ]));
    let outcome = run(&request, &mut journal, &mut broker, None).unwrap();
    assert_eq!(outcome.verdict(), ExecutionVerdict::Verified);
    assert_eq!(outcome.read_attempts(), 5);
    assert_eq!(broker.mutations, 1);
    assert_eq!(broker.max_in_flight, 1);
}

#[test]
fn restart_required_stores_a_protected_checkpoint_and_never_forces_reboot() {
    let trace = Rc::new(RefCell::new(Vec::new()));
    let requested = exact_state("22222222-2222-4222-8222-222222222222", '2');
    let mut request = request(requested.clone(), true);
    request.restart_required = true;
    let mut journal = MemoryJournal::clear(Rc::clone(&trace));
    let mut broker = FaultBroker::success(
        Rc::clone(&trace),
        request.exact_prior_state.clone(),
        requested,
    );
    let outcome = run(&request, &mut journal, &mut broker, None).unwrap();
    assert_eq!(
        outcome.verdict(),
        ExecutionVerdict::RestartVerificationRequired
    );
    assert_eq!(
        outcome.gate(),
        MutationGateState::ClosedForRestartVerification
    );
    assert_eq!(
        outcome.next_safe_action(),
        NextSafeAction::VerifyAfterRestart
    );
    assert_eq!(journal.checkpoints, 1);
    assert_eq!(broker.mutations, 1);
}

#[test]
fn drift_unknown_and_conflict_remain_distinct_and_block_mutation_or_followup() {
    let cases = [
        (
            exact_state("33333333-3333-4333-8333-333333333333", '3'),
            ExecutionOperation::Apply,
            ExecutionVerdict::Drift,
            MutationGateState::ClosedForConflict,
            NextSafeAction::ReviewDrift,
        ),
        (
            exact_state("33333333-3333-4333-8333-333333333333", '3'),
            ExecutionOperation::Restore,
            ExecutionVerdict::Conflict,
            MutationGateState::ClosedForConflict,
            NextSafeAction::ReviewConflict,
        ),
        (
            unknown_state(),
            ExecutionOperation::Apply,
            ExecutionVerdict::Unknown,
            MutationGateState::ClosedForUnknownState,
            NextSafeAction::GuidedRecovery,
        ),
    ];
    for (observed, operation, verdict, gate, action) in cases {
        let trace = Rc::new(RefCell::new(Vec::new()));
        let mut request = request(observed.clone(), true);
        request.operation = operation;
        if operation == ExecutionOperation::Restore {
            make_restore(&mut request);
        }
        let mut journal = MemoryJournal::clear(Rc::clone(&trace));
        let mut broker = FaultBroker::success(
            Rc::clone(&trace),
            request.exact_prior_state.clone(),
            observed,
        );
        let outcome = run(&request, &mut journal, &mut broker, None).unwrap();
        assert_eq!(outcome.verdict(), verdict);
        assert_eq!(outcome.gate(), gate);
        assert_eq!(outcome.next_safe_action(), action);
        assert!(!outcome.receipt_stored());
        assert!(!outcome.allows_automatic_mutation_retry());
    }
}

#[test]
fn renderer_disconnect_and_window_close_do_not_cancel_native_continuity() {
    let trace = Rc::new(RefCell::new(Vec::new()));
    let requested = exact_state("22222222-2222-4222-8222-222222222222", '2');
    let request = request(requested.clone(), true);
    let mut journal = MemoryJournal::clear(Rc::clone(&trace));
    let mut broker = FaultBroker::success(
        Rc::clone(&trace),
        request.exact_prior_state.clone(),
        requested,
    );
    let outcome = run(&request, &mut journal, &mut broker, None).unwrap();
    assert_eq!(outcome.verdict(), ExecutionVerdict::Verified);
    assert_eq!(broker.mutations, 1);
    assert_eq!(journal.receipts, 1);
    assert!(!format!("{request:?}").contains("renderer"));
    assert!(!format!("{request:?}").contains("subscription"));
}

#[test]
fn malformed_non_monotonic_artifacts_fail_closed_before_receipt() {
    let trace = Rc::new(RefCell::new(Vec::new()));
    let requested = exact_state("22222222-2222-4222-8222-222222222222", '2');
    let mut request = request(requested.clone(), true);
    chain(&mut request.artifacts.observed, 9, '2', '3');
    let mut journal = MemoryJournal::clear(Rc::clone(&trace));
    let mut broker = FaultBroker::success(
        Rc::clone(&trace),
        request.exact_prior_state.clone(),
        requested,
    );
    assert!(run(&request, &mut journal, &mut broker, None).is_err());
    assert_eq!(journal.receipts, 0);
}

proptest! {
    #![proptest_config(ProptestConfig::with_cases(96))]

    #[test]
    fn arbitrary_failure_sequences_never_double_dispatch_or_publish_unreceipted_success(
        observed_selector in 0_u8..4,
        response_lost in any::<bool>(),
        receipt_failure in any::<bool>(),
        append_failure in 0_usize..5,
        cancel_at_boundary in any::<bool>(),
    ) {
        let observed = match observed_selector {
            0 => exact_state("11111111-1111-4111-8111-111111111111", '1'),
            1 => exact_state("22222222-2222-4222-8222-222222222222", '2'),
            2 => exact_state("33333333-3333-4333-8333-333333333333", '3'),
            _ => unknown_state(),
        };
        let dispatch_recorded = !response_lost;
        let trace = Rc::new(RefCell::new(Vec::new()));
        let mut request = request(observed.clone(), dispatch_recorded);
        request.cancel_before_dispatch = cancel_at_boundary;
        let mut journal = MemoryJournal::clear(Rc::clone(&trace));
        journal.fault = if receipt_failure {
            JournalFault::Receipt
        } else if append_failure > 0 {
            JournalFault::Append(append_failure)
        } else {
            JournalFault::None
        };
        let mut broker = FaultBroker::success(
            Rc::clone(&trace),
            request.exact_prior_state.clone(),
            observed,
        );
        if response_lost {
            broker.mutations_results = VecDeque::from([Err(broker_unavailable_error())]);
        }

        let outcome = run(&request, &mut journal, &mut broker, None);
        prop_assert!(broker.mutations <= 1);
        prop_assert!(broker.max_in_flight <= 1);
        if let Ok(outcome) = outcome {
            prop_assert!(!outcome.allows_automatic_mutation_retry());
            prop_assert!(outcome.durable_sequences().windows(2).all(|pair| pair[1] == pair[0] + 1));
            if matches!(outcome.verdict(), ExecutionVerdict::Verified | ExecutionVerdict::Restored) {
                prop_assert!(outcome.receipt_stored());
            }
            if outcome.gate() != MutationGateState::Open {
                prop_assert!(!matches!(outcome.verdict(), ExecutionVerdict::Verified | ExecutionVerdict::Restored));
            }
        }
    }

    #[test]
    fn arbitrary_recovery_blockers_preempt_every_new_mutation(corrupt in any::<bool>()) {
        let trace = Rc::new(RefCell::new(Vec::new()));
        let requested = exact_state("22222222-2222-4222-8222-222222222222", '2');
        let request = request(requested.clone(), true);
        let mut journal = MemoryJournal::clear(Rc::clone(&trace));
        journal.recovery = if corrupt {
            RecoveryLoad::CorruptOrUnavailable
        } else {
            RecoveryLoad::Pending {
                transaction: Box::new(request.transaction.clone()),
                latest_event: Box::new(request.artifacts.prepared.clone()),
            }
        };
        let mut broker = FaultBroker::success(
            Rc::clone(&trace),
            request.exact_prior_state.clone(),
            requested,
        );
        let outcome = run(&request, &mut journal, &mut broker, None).unwrap();
        prop_assert_eq!(broker.mutations, 0);
        prop_assert_ne!(outcome.gate(), MutationGateState::Open);
        prop_assert_eq!(outcome.dispatch_count(), 0);
        prop_assert!(!outcome.receipt_stored());
    }

    #[test]
    fn arbitrary_event_sequence_tampering_fails_before_mutation(sequence in 4_u32..=u32::MAX) {
        let trace = Rc::new(RefCell::new(Vec::new()));
        let requested = exact_state("22222222-2222-4222-8222-222222222222", '2');
        let mut request = request(requested.clone(), true);
        chain(&mut request.artifacts.observed, sequence, '2', '3');
        let mut journal = MemoryJournal::clear(Rc::clone(&trace));
        let mut broker = FaultBroker::success(
            Rc::clone(&trace),
            request.exact_prior_state.clone(),
            requested,
        );
        prop_assert!(run(&request, &mut journal, &mut broker, None).is_err());
        prop_assert_eq!(broker.mutations, 0);
        prop_assert_eq!(journal.receipts, 0);
    }
}
