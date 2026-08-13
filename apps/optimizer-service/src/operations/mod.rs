//! Closed privileged-operation registry.

pub mod power_scheme;

/// The complete Phase 6 power-operation allowlist.
#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub enum PowerOperation {
    Observe,
    DuplicateManaged,
    ActivateManaged,
    DeleteOwned,
}

impl PowerOperation {
    pub const ALL: [Self; 4] = [
        Self::Observe,
        Self::DuplicateManaged,
        Self::ActivateManaged,
        Self::DeleteOwned,
    ];

    pub const fn as_str(self) -> &'static str {
        match self {
            Self::Observe => "observe-power-scheme",
            Self::DuplicateManaged => "duplicate-managed-power-scheme",
            Self::ActivateManaged => "activate-managed-power-scheme",
            Self::DeleteOwned => "delete-owned-power-scheme",
        }
    }
}
