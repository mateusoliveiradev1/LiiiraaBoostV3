//! Request-preserving dispatch for the five Phase 6 privileged operations.

use std::marker::PhantomData;

use liiiraa_contracts_rust::PrivilegedBrokerRequest;
use serde_json::{Value, json};

use super::{
    ipc::{BrokerError, BrokerErrorCode, OperationDispatcher},
    operations::{
        PowerOperation,
        power_scheme::{
            MANAGED_SCHEME_DESCRIPTION, MANAGED_SCHEME_FRIENDLY_NAME, PowerSchemeError,
            PowerSchemeId, PowerSchemePort, PowerSchemeSnapshot, VerifiedClientContext,
        },
    },
    restore_point::{
        Admission, PreparationRequest, RestorePointApi, RestorePointObserver, RiskClass,
        prepare_restore_point,
    },
};

pub const POWER_SCHEME_OPERATION_VERSION: &str = "power-scheme-v1";
pub const RESTORE_POINT_OPERATION_VERSION: &str = "restore-point-v1";

/// Opaque proof that the pipe host acquired a bounded interactive-user token.
///
/// Public identity strings cannot construct this capability. The production
/// constructor remains crate-private until the authenticated Windows host owns
/// token duplication in Plan 06-30.
pub struct InteractiveUserEffectLease {
    session_id: u32,
    interactive_logon_sid: String,
    _not_clone_or_send: PhantomData<*mut ()>,
}

impl InteractiveUserEffectLease {
    #[cfg(debug_assertions)]
    pub fn for_test(session_id: u32, interactive_logon_sid: impl Into<String>) -> Self {
        Self {
            session_id,
            interactive_logon_sid: interactive_logon_sid.into(),
            _not_clone_or_send: PhantomData,
        }
    }

    #[allow(dead_code)]
    pub(crate) unsafe fn from_authenticated_pipe_host(
        session_id: u32,
        interactive_logon_sid: String,
    ) -> Self {
        Self {
            session_id,
            interactive_logon_sid,
            _not_clone_or_send: PhantomData,
        }
    }

    fn matches(&self, session_id: u32, interactive_logon_sid: &str) -> bool {
        self.session_id == session_id && self.interactive_logon_sid == interactive_logon_sid
    }
}

/// Exact broker and authenticated-client metadata supplied to one dispatch.
pub struct DispatchContext {
    transaction_id: String,
    step_id: String,
    operation_version_id: String,
    interactive_session_id: u32,
    interactive_logon_sid: String,
    process_id: u32,
    process_image_hash: String,
    effect_lease: Option<InteractiveUserEffectLease>,
}

impl DispatchContext {
    #[allow(clippy::too_many_arguments)]
    pub fn metadata_only(
        transaction_id: impl Into<String>,
        step_id: impl Into<String>,
        operation_version_id: impl Into<String>,
        interactive_session_id: u32,
        interactive_logon_sid: impl Into<String>,
        process_id: u32,
        process_image_hash: impl Into<String>,
    ) -> Self {
        Self {
            transaction_id: transaction_id.into(),
            step_id: step_id.into(),
            operation_version_id: operation_version_id.into(),
            interactive_session_id,
            interactive_logon_sid: interactive_logon_sid.into(),
            process_id,
            process_image_hash: process_image_hash.into(),
            effect_lease: None,
        }
    }

    #[allow(clippy::too_many_arguments)]
    pub fn with_effect_lease(
        transaction_id: impl Into<String>,
        step_id: impl Into<String>,
        operation_version_id: impl Into<String>,
        interactive_session_id: u32,
        interactive_logon_sid: impl Into<String>,
        process_id: u32,
        process_image_hash: impl Into<String>,
        effect_lease: InteractiveUserEffectLease,
    ) -> Self {
        let mut context = Self::metadata_only(
            transaction_id,
            step_id,
            operation_version_id,
            interactive_session_id,
            interactive_logon_sid,
            process_id,
            process_image_hash,
        );
        context.effect_lease = Some(effect_lease);
        context
    }

    fn verified_client(&self) -> Result<VerifiedClientContext, BrokerError> {
        let Some(lease) = self.effect_lease.as_ref() else {
            return Err(error(BrokerErrorCode::AuthenticationFailed));
        };
        if self.process_id == 0
            || self.process_image_hash.trim().is_empty()
            || !lease.matches(self.interactive_session_id, &self.interactive_logon_sid)
        {
            return Err(error(BrokerErrorCode::AuthenticationFailed));
        }
        VerifiedClientContext::establish(
            self.interactive_session_id,
            self.interactive_logon_sid.clone(),
            true,
            true,
        )
        .map_err(|_| error(BrokerErrorCode::AuthenticationFailed))
    }
}

#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub enum DispatchOutcome {
    AcceptedObservationRequired,
    RejectedConflict,
    Unavailable,
}

/// Redacted dispatch metadata. It intentionally excludes SID, token, nonce and
/// device-binding values.
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct DispatchAudit {
    pub transaction_id: String,
    pub request_id: String,
    pub operation_version_id: String,
    pub operation: &'static str,
    pub outcome: DispatchOutcome,
}

pub struct PhysicalOperationDispatcher<'a, P, A, O>
where
    P: PowerSchemePort,
    A: RestorePointApi,
    O: RestorePointObserver,
{
    power: &'a mut P,
    restore_point_api: &'a mut A,
    restore_point_observer: &'a mut O,
    audits: Vec<DispatchAudit>,
}

impl<'a, P, A, O> PhysicalOperationDispatcher<'a, P, A, O>
where
    P: PowerSchemePort,
    A: RestorePointApi,
    O: RestorePointObserver,
{
    pub fn new(
        power: &'a mut P,
        restore_point_api: &'a mut A,
        restore_point_observer: &'a mut O,
    ) -> Self {
        Self {
            power,
            restore_point_api,
            restore_point_observer,
            audits: Vec::new(),
        }
    }

    pub fn last_audit(&self) -> Option<&DispatchAudit> {
        self.audits.last()
    }

    fn push_audit(
        &mut self,
        context: &DispatchContext,
        request_id: &str,
        operation: &'static str,
        outcome: DispatchOutcome,
    ) {
        self.audits.push(DispatchAudit {
            transaction_id: context.transaction_id.clone(),
            request_id: request_id.to_owned(),
            operation_version_id: context.operation_version_id.clone(),
            operation,
            outcome,
        });
    }

    fn validate_common(
        context: &DispatchContext,
        request_id: &str,
        version: &str,
    ) -> Result<VerifiedClientContext, BrokerError> {
        if context.step_id != request_id || context.operation_version_id != version {
            return Err(error(BrokerErrorCode::InvalidMessage));
        }
        context.verified_client()
    }
}

impl<P, A, O> OperationDispatcher for PhysicalOperationDispatcher<'_, P, A, O>
where
    P: PowerSchemePort,
    A: RestorePointApi,
    O: RestorePointObserver,
{
    fn dispatch(
        &mut self,
        request: PrivilegedBrokerRequest,
        context: &DispatchContext,
    ) -> Result<Value, BrokerError> {
        match request {
            PrivilegedBrokerRequest::ObservePowerSchemeRequest(request) => {
                let request_id = request.request_id.as_str();
                let client =
                    Self::validate_common(context, request_id, POWER_SCHEME_OPERATION_VERSION)?;
                self.power.preflight(&client).map_err(map_power_error)?;
                self.power
                    .observe_active(&client)
                    .map_err(map_power_error)?;
                self.push_audit(
                    context,
                    request_id,
                    PowerOperation::Observe.as_str(),
                    DispatchOutcome::AcceptedObservationRequired,
                );
                Ok(accepted(request_id))
            }
            PrivilegedBrokerRequest::DuplicateManagedPowerSchemeRequest(request) => {
                let request_id = request.request_id.as_str();
                let client =
                    Self::validate_common(context, request_id, POWER_SCHEME_OPERATION_VERSION)?;
                let source = parse_scheme_id(&request.source_scheme_id)?;
                let destination = parse_scheme_id(&request.destination_scheme_id)?;
                self.power.preflight(&client).map_err(map_power_error)?;
                let active = self
                    .power
                    .observe_active(&client)
                    .map_err(map_power_error)?;
                if active.id != source
                    || self
                        .power
                        .observe_scheme(&client, destination)
                        .map_err(map_power_error)?
                        .is_some()
                {
                    self.push_audit(
                        context,
                        request_id,
                        PowerOperation::DuplicateManaged.as_str(),
                        DispatchOutcome::RejectedConflict,
                    );
                    return Ok(rejected(request_id, "power-scheme-drift"));
                }
                self.power
                    .duplicate_managed(&client, source, destination)
                    .map_err(map_power_error)?;
                self.push_audit(
                    context,
                    request_id,
                    PowerOperation::DuplicateManaged.as_str(),
                    DispatchOutcome::AcceptedObservationRequired,
                );
                Ok(accepted(request_id))
            }
            PrivilegedBrokerRequest::ActivateManagedPowerSchemeRequest(request) => {
                let request_id = request.request_id.as_str();
                let client =
                    Self::validate_common(context, request_id, POWER_SCHEME_OPERATION_VERSION)?;
                let target_id = parse_scheme_id(&request.scheme_id)?;
                let expected_current = parse_scheme_id(&request.expected_current_scheme_id)?;
                self.power.preflight(&client).map_err(map_power_error)?;
                let active = self
                    .power
                    .observe_active(&client)
                    .map_err(map_power_error)?;
                let target = self
                    .power
                    .observe_scheme(&client, target_id)
                    .map_err(map_power_error)?;
                if active.id != expected_current || !target.as_ref().is_some_and(is_owned_target) {
                    self.push_audit(
                        context,
                        request_id,
                        PowerOperation::ActivateManaged.as_str(),
                        DispatchOutcome::RejectedConflict,
                    );
                    return Ok(rejected(request_id, "power-scheme-drift"));
                }
                self.power
                    .activate_managed(&client, target_id)
                    .map_err(map_power_error)?;
                self.push_audit(
                    context,
                    request_id,
                    PowerOperation::ActivateManaged.as_str(),
                    DispatchOutcome::AcceptedObservationRequired,
                );
                Ok(accepted(request_id))
            }
            PrivilegedBrokerRequest::DeleteOwnedPowerSchemeRequest(request) => {
                let request_id = request.request_id.as_str();
                let client =
                    Self::validate_common(context, request_id, POWER_SCHEME_OPERATION_VERSION)?;
                let target_id = parse_scheme_id(&request.scheme_id)?;
                self.power.preflight(&client).map_err(map_power_error)?;
                let active = self
                    .power
                    .observe_active(&client)
                    .map_err(map_power_error)?;
                let target = self
                    .power
                    .observe_scheme(&client, target_id)
                    .map_err(map_power_error)?;
                let owned_with_exact_hash = target.as_ref().is_some_and(|target| {
                    is_owned_target(target)
                        && target.settings_fingerprint
                            == request.expected_canonical_state_hash.as_str()
                });
                if active.id == target_id || !owned_with_exact_hash {
                    self.push_audit(
                        context,
                        request_id,
                        PowerOperation::DeleteOwned.as_str(),
                        DispatchOutcome::RejectedConflict,
                    );
                    return Ok(rejected(request_id, "power-scheme-conflict"));
                }
                self.power
                    .delete_owned(&client, target_id)
                    .map_err(map_power_error)?;
                self.push_audit(
                    context,
                    request_id,
                    PowerOperation::DeleteOwned.as_str(),
                    DispatchOutcome::AcceptedObservationRequired,
                );
                Ok(accepted(request_id))
            }
            PrivilegedBrokerRequest::PrepareRestorePointRequest(request) => {
                let request_id = request.request_id.as_str();
                Self::validate_common(context, request_id, RESTORE_POINT_OPERATION_VERSION)?;
                if request.transaction_id.as_str() != context.transaction_id {
                    return Err(error(BrokerErrorCode::InvalidMessage));
                }
                let projection = prepare_restore_point(
                    self.restore_point_api,
                    self.restore_point_observer,
                    PreparationRequest {
                        description: request.display_summary.as_str(),
                        risk: RiskClass::Verified,
                        primary_manifest_ready: true,
                        advanced_without_complement_acknowledged: false,
                    },
                );
                let (document, outcome) = if projection.admission == Admission::Allowed {
                    (
                        accepted(request_id),
                        DispatchOutcome::AcceptedObservationRequired,
                    )
                } else {
                    (
                        unavailable(request_id, "restore-point-unavailable"),
                        DispatchOutcome::Unavailable,
                    )
                };
                self.push_audit(context, request_id, "prepare-restore-point", outcome);
                Ok(document)
            }
        }
    }
}

fn is_owned_target(snapshot: &PowerSchemeSnapshot) -> bool {
    snapshot.friendly_name == MANAGED_SCHEME_FRIENDLY_NAME
        && snapshot.description == MANAGED_SCHEME_DESCRIPTION
}

fn parse_scheme_id(value: &str) -> Result<PowerSchemeId, BrokerError> {
    let compact: String = value
        .chars()
        .filter(|character| *character != '-')
        .collect();
    let raw =
        u128::from_str_radix(&compact, 16).map_err(|_| error(BrokerErrorCode::InvalidMessage))?;
    PowerSchemeId::from_journaled_u128(raw).ok_or_else(|| error(BrokerErrorCode::InvalidMessage))
}

fn accepted(request_id: &str) -> Value {
    json!({
        "kind": "broker-accepted-response",
        "schemaVersion": "1.0",
        "responseId": format!("dispatch-{request_id}"),
        "requestId": request_id,
        "outcome": "accepted",
        "completedAt": "1970-01-01T00:00:00Z"
    })
}

fn rejected(request_id: &str, reason_code: &str) -> Value {
    json!({
        "kind": "broker-rejected-response",
        "schemaVersion": "1.0",
        "responseId": format!("dispatch-{request_id}"),
        "requestId": request_id,
        "outcome": "rejected",
        "reasonCode": reason_code,
        "completedAt": "1970-01-01T00:00:00Z"
    })
}

fn unavailable(request_id: &str, reason_code: &str) -> Value {
    json!({
        "kind": "broker-unavailable-response",
        "schemaVersion": "1.0",
        "responseId": format!("dispatch-{request_id}"),
        "requestId": request_id,
        "outcome": "unavailable",
        "reasonCode": reason_code,
        "completedAt": "1970-01-01T00:00:00Z"
    })
}

fn map_power_error(_power_error: PowerSchemeError) -> BrokerError {
    error(BrokerErrorCode::InvalidMessage)
}

fn error(code: BrokerErrorCode) -> BrokerError {
    BrokerError { code }
}
