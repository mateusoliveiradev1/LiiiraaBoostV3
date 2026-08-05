use crate::offline_entitlement::{
    OfflineEntitlementSigningKey, OfflineEntitlementVerificationContext, TrustedTimeStore,
};

#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub enum PremiumCapabilityKind {
    AccountAccess,
    ContinueActiveGame,
    ContinueInFlightOperation,
    DiagnosticHistory,
    Diagnostics,
    ExistingChangeReview,
    Restoration,
    SecurityWarnings,
    StartNewPaidAction,
}

#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub enum PremiumAuthorityReason {
    Contradictory,
    Expired,
    Revoked,
    Stale,
}

#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub enum PremiumCapabilityCode {
    Allowed,
    AllowedWithExpiryWarning,
    Continued,
    OnlineVerificationRequired,
    SafetyPreserved,
}

#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub struct PremiumCapabilityDecision {
    pub allowed: bool,
    pub code: PremiumCapabilityCode,
    pub reason: Option<PremiumAuthorityReason>,
    pub requires_online_verification: bool,
}

#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub enum PremiumRenewalDisposition {
    RenewedSilently,
    RetainedOfflineAuthority,
    Revoked,
    VerificationRequired,
}

pub enum PremiumAuthenticatedContact<'a> {
    Renewed { envelope_bytes: &'a [u8] },
    Revoked,
    Unavailable,
}

#[derive(Clone, Debug, Default, Eq, PartialEq)]
pub struct PremiumAuthority {
    envelope_bytes: Option<Vec<u8>>,
    reason: Option<PremiumAuthorityReason>,
}

impl PremiumAuthority {
    pub fn envelope_bytes(&self) -> Option<&[u8]> {
        self.envelope_bytes.as_deref()
    }
}

pub fn renew_offline_entitlement(
    _authority: &mut PremiumAuthority,
    _contact: PremiumAuthenticatedContact<'_>,
    _key_ring: &[OfflineEntitlementSigningKey],
    _context: OfflineEntitlementVerificationContext<'_>,
    _trusted_time_store: &mut impl TrustedTimeStore,
) -> PremiumRenewalDisposition {
    panic!("EXPECTED_RED[04-21-01]: Premium renewal authority is not implemented")
}

pub fn authorize_capability(
    _authority: &mut PremiumAuthority,
    _capability: PremiumCapabilityKind,
    _key_ring: &[OfflineEntitlementSigningKey],
    _context: OfflineEntitlementVerificationContext<'_>,
    _trusted_time_store: &mut impl TrustedTimeStore,
) -> PremiumCapabilityDecision {
    panic!("EXPECTED_RED[04-21-01]: Premium capability authority is not implemented")
}
