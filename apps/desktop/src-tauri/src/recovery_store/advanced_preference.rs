use std::{path::Path, sync::Arc};

use crate::{
    plan_auth::{
        AdvancedPreferenceAction, ConsumedAdvancedPreferenceProof, LocalRecoveryAdmission,
    },
    recovery_store::{RecoveryStore, integrity_anchor::IntegrityAnchor},
};

#[derive(Clone, Debug, Eq, PartialEq)]
pub struct DevicePosture {
    pub device_id: String,
    pub hardware_fingerprint: String,
    pub security_posture_fingerprint: String,
}

#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub enum AdvancedPreferenceState {
    Disabled,
    Enabled,
    Revoked,
    RevalidationRequired,
}

#[derive(Clone, Debug, Eq, PartialEq)]
pub struct AdvancedPreferenceProjection {
    pub state: AdvancedPreferenceState,
    pub sequence: Option<u32>,
    pub event_count: usize,
    pub device: DevicePosture,
    pub last_event_id: Option<String>,
}

#[derive(Clone, Debug, Eq, PartialEq)]
pub struct AdvancedPreferenceEvent {
    pub sequence: u32,
    pub event_kind: &'static str,
    pub proof_reference: Option<String>,
    pub reason_code: String,
    pub device: DevicePosture,
}

#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub enum AdvancedPreferenceFault {
    FullBeforeCommit,
    IoBeforeCommit,
}

#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub enum AdvancedPreferenceError {
    InvalidProofAction,
    ProofBindingMismatch,
    ProofExpired,
    ProofReplayed,
    InvalidTransition,
    IntegrityFailure,
    StorageFull,
    StorageIo,
    StorageBusy,
    Storage,
}

pub struct AdvancedPreferenceStore {
    projection: AdvancedPreferenceProjection,
    _anchor: Arc<dyn IntegrityAnchor>,
}

impl AdvancedPreferenceStore {
    pub fn open(
        path: &Path,
        anchor: Arc<dyn IntegrityAnchor>,
        current: DevicePosture,
        _occurred_at: &str,
    ) -> Result<Self, AdvancedPreferenceError> {
        RecoveryStore::open(path, Arc::clone(&anchor))
            .map_err(|_| AdvancedPreferenceError::Storage)?;
        Ok(Self {
            projection: AdvancedPreferenceProjection {
                state: AdvancedPreferenceState::Disabled,
                sequence: None,
                event_count: 0,
                device: current,
                last_event_id: None,
            },
            _anchor: anchor,
        })
    }

    pub fn projection(&self) -> &AdvancedPreferenceProjection {
        &self.projection
    }

    pub fn history(&self) -> Result<Vec<AdvancedPreferenceEvent>, AdvancedPreferenceError> {
        Ok(Vec::new())
    }

    pub fn enable(
        &mut self,
        _proof: &ConsumedAdvancedPreferenceProof,
        _now_unix_ms: u64,
        _occurred_at: &str,
    ) -> Result<(), AdvancedPreferenceError> {
        Err(AdvancedPreferenceError::Storage)
    }

    pub fn revoke(
        &mut self,
        _proof: &ConsumedAdvancedPreferenceProof,
        _now_unix_ms: u64,
        _occurred_at: &str,
    ) -> Result<(), AdvancedPreferenceError> {
        Err(AdvancedPreferenceError::Storage)
    }

    pub fn observe_binding(
        &mut self,
        _current: DevicePosture,
        _occurred_at: &str,
    ) -> Result<(), AdvancedPreferenceError> {
        Err(AdvancedPreferenceError::Storage)
    }

    pub fn rebuild_projection(
        &mut self,
    ) -> Result<AdvancedPreferenceProjection, AdvancedPreferenceError> {
        Ok(self.projection.clone())
    }

    pub fn set_fault(&mut self, _fault: AdvancedPreferenceFault) {}

    pub fn recovery_available(&self, _admission: LocalRecoveryAdmission) -> bool {
        true
    }

    pub fn expected_action_for_state(&self) -> AdvancedPreferenceAction {
        match self.projection.state {
            AdvancedPreferenceState::Enabled => AdvancedPreferenceAction::Revoke,
            AdvancedPreferenceState::Disabled
            | AdvancedPreferenceState::Revoked
            | AdvancedPreferenceState::RevalidationRequired => AdvancedPreferenceAction::Enable,
        }
    }
}
