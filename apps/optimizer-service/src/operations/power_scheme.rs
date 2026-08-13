//! Exact-state lifecycle for the single admitted managed power scheme.

pub const MANAGED_SCHEME_FRIENDLY_NAME: &str = "Liiiraa Verificado";
pub const MANAGED_SCHEME_DESCRIPTION: &str =
    "Liiiraa Boost managed clone; activation alone makes no performance claim.";

#[derive(Clone, Copy, Debug, Eq, Hash, PartialEq, Ord, PartialOrd)]
pub struct PowerSchemeId(u128);

impl PowerSchemeId {
    pub const fn from_journaled_u128(value: u128) -> Option<Self> {
        if value == 0 { None } else { Some(Self(value)) }
    }

    pub const fn as_u128(self) -> u128 {
        self.0
    }
}

#[derive(Clone, Debug, Eq, PartialEq)]
pub struct PowerSchemeSnapshot {
    pub id: PowerSchemeId,
    pub friendly_name: String,
    pub description: String,
    pub settings_fingerprint: String,
}

#[derive(Clone, Debug, Eq, PartialEq)]
pub struct VerifiedClientContext {
    session_id: u32,
    interactive_logon_sid: String,
}

impl VerifiedClientContext {
    pub fn establish(
        session_id: u32,
        interactive_logon_sid: impl Into<String>,
        impersonation_succeeded: bool,
        token_verified: bool,
    ) -> Result<Self, PowerSchemeError> {
        let interactive_logon_sid = interactive_logon_sid.into();
        if session_id == 0
            || interactive_logon_sid.trim().is_empty()
            || !impersonation_succeeded
            || !token_verified
        {
            return Err(PowerSchemeError::UnverifiedClientContext);
        }
        Ok(Self {
            session_id,
            interactive_logon_sid,
        })
    }

    pub const fn session_id(&self) -> u32 {
        self.session_id
    }

    pub fn interactive_logon_sid(&self) -> &str {
        &self.interactive_logon_sid
    }
}

#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub enum ConflictStage {
    ApplyPrecondition,
    DestinationOwnership,
    ApplyVerification,
    RestorePrecondition,
    PriorState,
    RestoreVerification,
    CleanupOwnership,
}

#[derive(Clone, Debug, Eq, PartialEq)]
pub struct StateConflict {
    pub stage: ConflictStage,
    pub expected: Option<PowerSchemeSnapshot>,
    pub observed: Option<PowerSchemeSnapshot>,
}

#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub enum PowerSchemeError {
    AccessDenied,
    AlreadyExists,
    NotFound,
    UnverifiedClientContext,
    Windows(u32),
}

#[derive(Clone, Debug, Eq, PartialEq)]
pub struct ApplyRequest {
    pub expected_prior: PowerSchemeSnapshot,
    pub journaled_destination: PowerSchemeId,
    pub known_owned_target: Option<PowerSchemeSnapshot>,
}

#[derive(Clone, Debug, Eq, PartialEq)]
pub struct ManagedPowerScheme {
    pub prior: PowerSchemeSnapshot,
    pub target: PowerSchemeSnapshot,
}

#[derive(Clone, Debug, Eq, PartialEq)]
pub enum ApplyOutcome {
    Applied(ManagedPowerScheme),
    AlreadyApplied(ManagedPowerScheme),
    Drift(StateConflict),
    Conflict(StateConflict),
}

#[derive(Clone, Debug, Eq, PartialEq)]
pub enum RestoreOutcome {
    Restored { target_deleted: bool },
    AlreadyRestored { target_deleted: bool },
    Drift(StateConflict),
    Conflict(StateConflict),
}

pub trait PowerSchemePort {
    fn preflight(&mut self, context: &VerifiedClientContext) -> Result<(), PowerSchemeError>;

    fn observe_active(
        &mut self,
        context: &VerifiedClientContext,
    ) -> Result<PowerSchemeSnapshot, PowerSchemeError>;

    fn observe_scheme(
        &mut self,
        context: &VerifiedClientContext,
        id: PowerSchemeId,
    ) -> Result<Option<PowerSchemeSnapshot>, PowerSchemeError>;

    fn duplicate_managed(
        &mut self,
        context: &VerifiedClientContext,
        source: PowerSchemeId,
        destination: PowerSchemeId,
    ) -> Result<(), PowerSchemeError>;

    fn activate_managed(
        &mut self,
        context: &VerifiedClientContext,
        id: PowerSchemeId,
    ) -> Result<(), PowerSchemeError>;

    fn delete_owned(
        &mut self,
        context: &VerifiedClientContext,
        id: PowerSchemeId,
    ) -> Result<(), PowerSchemeError>;
}

/// Fail-closed RED seam. Task 2 implements the exact lifecycle.
pub fn apply_managed_scheme(
    _port: &mut impl PowerSchemePort,
    _context: &VerifiedClientContext,
    request: ApplyRequest,
) -> Result<ApplyOutcome, PowerSchemeError> {
    Ok(ApplyOutcome::Drift(StateConflict {
        stage: ConflictStage::ApplyPrecondition,
        expected: Some(request.expected_prior),
        observed: None,
    }))
}

/// Fail-closed RED seam. Task 2 implements exact restoration and owned cleanup.
pub fn restore_managed_scheme(
    _port: &mut impl PowerSchemePort,
    _context: &VerifiedClientContext,
    managed: &ManagedPowerScheme,
) -> Result<RestoreOutcome, PowerSchemeError> {
    Ok(RestoreOutcome::Conflict(StateConflict {
        stage: ConflictStage::RestorePrecondition,
        expected: Some(managed.target.clone()),
        observed: None,
    }))
}
