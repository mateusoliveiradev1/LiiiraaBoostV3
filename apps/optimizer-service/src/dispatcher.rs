//! Request-preserving dispatch for the five Phase 6 privileged operations.

use std::time::Duration;

use liiiraa_contracts_rust::PrivilegedBrokerRequest;
use serde_json::{Value, json};

use super::{
    ipc::{BrokerError, BrokerErrorCode, OperationDispatcher},
    operations::{
        PowerOperation,
        power_scheme::{
            InteractiveUserEffectError, MANAGED_SCHEME_DESCRIPTION, MANAGED_SCHEME_FRIENDLY_NAME,
            PowerSchemeError, PowerSchemeId, PowerSchemePort, PowerSchemeSnapshot,
            VerifiedClientContext,
        },
    },
    restore_point::{
        Admission, PreparationRequest, RestorePointApi, RestorePointObserver, RiskClass,
        prepare_restore_point,
    },
};

pub use super::operations::power_scheme::InteractiveUserEffectLease;

pub const POWER_SCHEME_OPERATION_VERSION: &str = "power-scheme-v1";
pub const RESTORE_POINT_OPERATION_VERSION: &str = "restore-point-v1";

/// Exact broker and authenticated-client metadata supplied to one dispatch.
pub struct DispatchContext<'token> {
    transaction_id: String,
    step_id: String,
    operation_version_id: String,
    interactive_session_id: u32,
    interactive_logon_sid: String,
    process_id: u32,
    process_image_hash: String,
    effect_timeout: Duration,
    effect_lease: Option<InteractiveUserEffectLease<'token>>,
}

impl<'token> DispatchContext<'token> {
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
            effect_timeout: Duration::from_secs(5),
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
        effect_lease: InteractiveUserEffectLease<'token>,
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

    #[allow(clippy::too_many_arguments)]
    pub(crate) fn with_effect_lease_and_timeout(
        transaction_id: impl Into<String>,
        step_id: impl Into<String>,
        operation_version_id: impl Into<String>,
        interactive_session_id: u32,
        interactive_logon_sid: impl Into<String>,
        process_id: u32,
        process_image_hash: impl Into<String>,
        effect_timeout: Duration,
        effect_lease: InteractiveUserEffectLease<'token>,
    ) -> Self {
        let mut context = Self::with_effect_lease(
            transaction_id,
            step_id,
            operation_version_id,
            interactive_session_id,
            interactive_logon_sid,
            process_id,
            process_image_hash,
            effect_lease,
        );
        context.effect_timeout = effect_timeout;
        context
    }

    fn verified_client(&self) -> Result<VerifiedClientContext, BrokerError> {
        let Some(_lease) = self.effect_lease.as_ref() else {
            return Err(error(BrokerErrorCode::AuthenticationFailed));
        };
        if self.process_id == 0 || self.process_image_hash.trim().is_empty() {
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

    fn with_interactive_user<T, F>(
        &self,
        client: &VerifiedClientContext,
        effect: F,
    ) -> Result<T, BrokerError>
    where
        T: Send,
        F: FnOnce(&VerifiedClientContext) -> Result<T, PowerSchemeError> + Send,
    {
        let lease = self
            .effect_lease
            .as_ref()
            .ok_or_else(|| error(BrokerErrorCode::AuthenticationFailed))?;
        lease
            .with_interactive_user(self.effect_timeout, client, effect)
            .map_err(map_effect_error)
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
    P: PowerSchemePort + Send,
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
    P: PowerSchemePort + Send,
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
        context: &DispatchContext<'_>,
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
        context: &DispatchContext<'_>,
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
    P: PowerSchemePort + Send,
    A: RestorePointApi,
    O: RestorePointObserver,
{
    fn dispatch(
        &mut self,
        request: PrivilegedBrokerRequest,
        context: &DispatchContext<'_>,
    ) -> Result<Value, BrokerError> {
        match request {
            PrivilegedBrokerRequest::ObservePowerSchemeRequest(request) => {
                let request_id = request.request_id.as_str();
                let client =
                    Self::validate_common(context, request_id, POWER_SCHEME_OPERATION_VERSION)?;
                // Key-link witness: 'with_interactive_user guards WindowsPowrProf'
                context.with_interactive_user(&client, |client| {
                    self.power.preflight(client)?;
                    self.power.observe_active(client)?;
                    Ok(())
                })?;
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
                let dispatched = context.with_interactive_user(&client, |client| {
                    self.power.preflight(client)?;
                    let active = self.power.observe_active(client)?;
                    if active.id != source
                        || self.power.observe_scheme(client, destination)?.is_some()
                    {
                        return Ok(false);
                    }
                    self.power.duplicate_managed(client, source, destination)?;
                    Ok(true)
                })?;
                if !dispatched {
                    self.push_audit(
                        context,
                        request_id,
                        PowerOperation::DuplicateManaged.as_str(),
                        DispatchOutcome::RejectedConflict,
                    );
                    return Ok(rejected(request_id, "power-scheme-drift"));
                }
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
                let dispatched = context.with_interactive_user(&client, |client| {
                    self.power.preflight(client)?;
                    let active = self.power.observe_active(client)?;
                    let target = self.power.observe_scheme(client, target_id)?;
                    if active.id != expected_current
                        || !target.as_ref().is_some_and(is_owned_target)
                    {
                        return Ok(false);
                    }
                    self.power.activate_managed(client, target_id)?;
                    Ok(true)
                })?;
                if !dispatched {
                    self.push_audit(
                        context,
                        request_id,
                        PowerOperation::ActivateManaged.as_str(),
                        DispatchOutcome::RejectedConflict,
                    );
                    return Ok(rejected(request_id, "power-scheme-drift"));
                }
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
                let expected_hash = request.expected_canonical_state_hash.as_str();
                let dispatched = context.with_interactive_user(&client, |client| {
                    self.power.preflight(client)?;
                    let active = self.power.observe_active(client)?;
                    let target = self.power.observe_scheme(client, target_id)?;
                    let owned_with_exact_hash = target.as_ref().is_some_and(|target| {
                        is_owned_target(target) && target.settings_fingerprint == expected_hash
                    });
                    if active.id == target_id || !owned_with_exact_hash {
                        return Ok(false);
                    }
                    self.power.delete_owned(client, target_id)?;
                    Ok(true)
                })?;
                if !dispatched {
                    self.push_audit(
                        context,
                        request_id,
                        PowerOperation::DeleteOwned.as_str(),
                        DispatchOutcome::RejectedConflict,
                    );
                    return Ok(rejected(request_id, "power-scheme-conflict"));
                }
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

fn map_effect_error(error_value: InteractiveUserEffectError<PowerSchemeError>) -> BrokerError {
    match error_value {
        InteractiveUserEffectError::Effect(power_error) => map_power_error(power_error),
        InteractiveUserEffectError::Timeout => error(BrokerErrorCode::Timeout),
        InteractiveUserEffectError::ClientMismatch
        | InteractiveUserEffectError::IdentityMismatch
        | InteractiveUserEffectError::ImpersonationFailed(_) => {
            error(BrokerErrorCode::AuthenticationFailed)
        }
        InteractiveUserEffectError::Panicked | InteractiveUserEffectError::CleanupFailed(_) => {
            error(BrokerErrorCode::ServerStopping)
        }
    }
}

fn error(code: BrokerErrorCode) -> BrokerError {
    BrokerError { code }
}
