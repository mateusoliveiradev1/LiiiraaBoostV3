pub mod integrity_anchor;
pub mod migrations;

use std::{path::Path, sync::Arc};

use integrity_anchor::IntegrityAnchor;
use rusqlite::Connection;
use serde_json::Value;

#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub enum RecoveryStoreError {
    Busy,
    Full,
    Io,
    ContractRejected,
    HashMismatch,
    ForeignKeyRejected,
    NotFound,
    InvalidTransition,
    Migration,
    Storage,
    IntegrityAnchorUnavailable,
    AnchorMismatch,
}

#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub enum MutationState {
    Writable,
    ReadOnlyIntegrityAnchorUnavailable,
    ReadOnlyAnchorMismatch,
}

#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub enum FaultPoint {
    FullBeforeCommit,
    IoBeforeCommit,
    AfterCommitBeforeAnchor,
    RotationAfterKeyInstall,
}

#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub struct ConnectionPolicy {
    pub foreign_keys: bool,
    pub journal_mode_wal: bool,
    pub synchronous_full: bool,
}

#[derive(Clone, Debug, Eq, PartialEq)]
pub struct StoredEvent {
    pub sequence: u32,
    pub event_kind: String,
    pub canonical_json: Vec<u8>,
    pub content_hash: String,
    pub key_epoch: u32,
    pub previous_mac: String,
    pub event_mac: String,
}

pub struct RecoveryStore {
    connection: Connection,
    _anchor: Arc<dyn IntegrityAnchor>,
    fault: Option<FaultPoint>,
}

impl RecoveryStore {
    pub fn open(path: &Path, anchor: Arc<dyn IntegrityAnchor>) -> Result<Self, RecoveryStoreError> {
        let connection = Connection::open(path).map_err(|_| RecoveryStoreError::Storage)?;
        Ok(Self {
            connection,
            _anchor: anchor,
            fault: None,
        })
    }

    pub fn connection_policy(&self) -> Result<ConnectionPolicy, RecoveryStoreError> {
        Ok(ConnectionPolicy {
            foreign_keys: false,
            journal_mode_wal: false,
            synchronous_full: false,
        })
    }

    pub fn mutation_state(&self) -> MutationState {
        MutationState::Writable
    }

    pub fn set_fault(&mut self, fault: FaultPoint) {
        self.fault = Some(fault);
    }

    pub fn append_document(
        &mut self,
        _document: &Value,
    ) -> Result<StoredEvent, RecoveryStoreError> {
        Err(match self.fault.take() {
            Some(FaultPoint::FullBeforeCommit) => RecoveryStoreError::Full,
            Some(FaultPoint::IoBeforeCommit) => RecoveryStoreError::Io,
            _ => RecoveryStoreError::Storage,
        })
    }

    pub fn dispatch_after_prepared<T>(
        &mut self,
        document: &Value,
        dispatch: impl FnOnce() -> T,
    ) -> Result<T, RecoveryStoreError> {
        self.append_document(document)?;
        Ok(dispatch())
    }

    pub fn history(&self) -> Result<Vec<StoredEvent>, RecoveryStoreError> {
        let _ = &self.connection;
        Ok(Vec::new())
    }

    pub fn rebuild_executor_projection(&mut self) -> Result<(), RecoveryStoreError> {
        Err(RecoveryStoreError::Storage)
    }

    pub fn projection_rows(&self) -> Result<Vec<(String, u32, String)>, RecoveryStoreError> {
        Ok(Vec::new())
    }

    pub fn rotate_key(&mut self) -> Result<(), RecoveryStoreError> {
        Err(RecoveryStoreError::Storage)
    }
}
