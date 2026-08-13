use std::{fmt, sync::Mutex};

use base64::{Engine as _, engine::general_purpose::URL_SAFE_NO_PAD};
use serde::{Deserialize, Serialize};

const RECOVERY_CREDENTIAL_SERVICE: &str = "com.liiiraa.boost.desktop.recovery.v1";
const DEFAULT_ACCOUNT_SCOPE: &str = "local-install";
static CUSTODY_CAS: Mutex<()> = Mutex::new(());

#[derive(Clone, Debug, Deserialize, Eq, PartialEq, Serialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct AnchorHead {
    pub database_id: String,
    pub epoch: u32,
    pub sequence: Option<u32>,
    pub head_mac: String,
}

#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub enum IntegrityAnchorError {
    Unavailable,
    Mismatch,
}

impl fmt::Display for IntegrityAnchorError {
    fn fmt(&self, formatter: &mut fmt::Formatter<'_>) -> fmt::Result {
        formatter.write_str(match self {
            Self::Unavailable => "recovery integrity custody is unavailable",
            Self::Mismatch => "recovery integrity anchor compare-and-swap failed",
        })
    }
}

impl std::error::Error for IntegrityAnchorError {}

pub trait IntegrityAnchor: fmt::Debug + Send + Sync {
    fn read_head(&self) -> Result<Option<AnchorHead>, IntegrityAnchorError>;
    fn read_key(&self, epoch: u32) -> Result<Option<Vec<u8>>, IntegrityAnchorError>;
    fn initialize(&self, head: &AnchorHead, key: &[u8]) -> Result<(), IntegrityAnchorError>;
    fn install_key(&self, epoch: u32, key: &[u8]) -> Result<(), IntegrityAnchorError>;
    fn compare_and_swap(
        &self,
        expected: &AnchorHead,
        next: &AnchorHead,
    ) -> Result<(), IntegrityAnchorError>;
}

pub struct WindowsIntegrityAnchor {
    account_scope: String,
}

impl WindowsIntegrityAnchor {
    pub fn new() -> Self {
        Self::for_account(DEFAULT_ACCOUNT_SCOPE)
    }

    pub fn for_account(account_scope: impl Into<String>) -> Self {
        Self {
            account_scope: account_scope.into(),
        }
    }

    fn head_entry(&self) -> Result<keyring::Entry, IntegrityAnchorError> {
        self.entry(&format!("{}:head", self.account_scope))
    }

    fn key_entry(&self, epoch: u32) -> Result<keyring::Entry, IntegrityAnchorError> {
        self.entry(&format!("{}:key:{epoch}", self.account_scope))
    }

    fn entry(&self, account: &str) -> Result<keyring::Entry, IntegrityAnchorError> {
        keyring::Entry::new(RECOVERY_CREDENTIAL_SERVICE, account)
            .map_err(|_| IntegrityAnchorError::Unavailable)
    }

    fn read_password(entry: keyring::Entry) -> Result<Option<String>, IntegrityAnchorError> {
        match entry.get_password() {
            Ok(value) => Ok(Some(value)),
            Err(keyring::Error::NoEntry) => Ok(None),
            Err(_) => Err(IntegrityAnchorError::Unavailable),
        }
    }

    fn write_head(&self, head: &AnchorHead) -> Result<(), IntegrityAnchorError> {
        let encoded = serde_json::to_string(head).map_err(|_| IntegrityAnchorError::Unavailable)?;
        self.head_entry()?
            .set_password(&encoded)
            .map_err(|_| IntegrityAnchorError::Unavailable)
    }
}

impl Default for WindowsIntegrityAnchor {
    fn default() -> Self {
        Self::new()
    }
}

impl fmt::Debug for WindowsIntegrityAnchor {
    fn fmt(&self, formatter: &mut fmt::Formatter<'_>) -> fmt::Result {
        formatter
            .debug_struct("WindowsIntegrityAnchor")
            .field("service", &RECOVERY_CREDENTIAL_SERVICE)
            .field("account_scope", &"[redacted]")
            .finish()
    }
}

impl IntegrityAnchor for WindowsIntegrityAnchor {
    fn read_head(&self) -> Result<Option<AnchorHead>, IntegrityAnchorError> {
        Self::read_password(self.head_entry()?)?
            .map(|value| {
                serde_json::from_str(&value).map_err(|_| IntegrityAnchorError::Unavailable)
            })
            .transpose()
    }

    fn read_key(&self, epoch: u32) -> Result<Option<Vec<u8>>, IntegrityAnchorError> {
        Self::read_password(self.key_entry(epoch)?)?
            .map(|value| {
                URL_SAFE_NO_PAD
                    .decode(value)
                    .map_err(|_| IntegrityAnchorError::Unavailable)
            })
            .transpose()
    }

    fn initialize(&self, head: &AnchorHead, key: &[u8]) -> Result<(), IntegrityAnchorError> {
        let _guard = CUSTODY_CAS
            .lock()
            .map_err(|_| IntegrityAnchorError::Unavailable)?;
        if self.read_head()?.is_some() {
            return Err(IntegrityAnchorError::Mismatch);
        }
        self.install_key(head.epoch, key)?;
        self.write_head(head)
    }

    fn install_key(&self, epoch: u32, key: &[u8]) -> Result<(), IntegrityAnchorError> {
        if key.len() != 32 {
            return Err(IntegrityAnchorError::Unavailable);
        }
        self.key_entry(epoch)?
            .set_password(&URL_SAFE_NO_PAD.encode(key))
            .map_err(|_| IntegrityAnchorError::Unavailable)
    }

    fn compare_and_swap(
        &self,
        expected: &AnchorHead,
        next: &AnchorHead,
    ) -> Result<(), IntegrityAnchorError> {
        let _guard = CUSTODY_CAS
            .lock()
            .map_err(|_| IntegrityAnchorError::Unavailable)?;
        if self.read_head()?.as_ref() != Some(expected) {
            return Err(IntegrityAnchorError::Mismatch);
        }
        self.write_head(next)
    }
}
