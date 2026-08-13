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
}
