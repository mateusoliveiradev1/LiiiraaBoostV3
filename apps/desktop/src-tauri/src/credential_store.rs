use std::fmt;

const CREDENTIAL_SERVICE: &str = "com.liiiraa.boost.desktop.identity";

#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub enum CredentialStoreError {
    Unavailable,
}

impl fmt::Display for CredentialStoreError {
    fn fmt(&self, formatter: &mut fmt::Formatter<'_>) -> fmt::Result {
        formatter.write_str("native credential custody is unavailable")
    }
}

impl std::error::Error for CredentialStoreError {}

pub trait CredentialStore {
    fn write_rotated_credential(&self, credential: &str) -> Result<(), CredentialStoreError>;
    fn read_credential(&self) -> Result<Option<String>, CredentialStoreError>;
    fn delete_credential(&self) -> Result<(), CredentialStoreError>;
}

pub struct WindowsCredentialStore {
    account: String,
}

impl WindowsCredentialStore {
    pub fn for_account(account: impl Into<String>) -> Self {
        Self {
            account: account.into(),
        }
    }

    fn entry(&self) -> Result<keyring::Entry, CredentialStoreError> {
        keyring::Entry::new(CREDENTIAL_SERVICE, &self.account)
            .map_err(|_| CredentialStoreError::Unavailable)
    }
}

impl fmt::Debug for WindowsCredentialStore {
    fn fmt(&self, formatter: &mut fmt::Formatter<'_>) -> fmt::Result {
        formatter
            .debug_struct("WindowsCredentialStore")
            .field("service", &CREDENTIAL_SERVICE)
            .field("account", &"[redacted]")
            .finish()
    }
}

impl CredentialStore for WindowsCredentialStore {
    fn write_rotated_credential(&self, credential: &str) -> Result<(), CredentialStoreError> {
        self.entry()?
            .set_password(credential)
            .map_err(|_| CredentialStoreError::Unavailable)
    }

    fn read_credential(&self) -> Result<Option<String>, CredentialStoreError> {
        match self.entry()?.get_password() {
            Ok(credential) => Ok(Some(credential)),
            Err(keyring::Error::NoEntry) => Ok(None),
            Err(_) => Err(CredentialStoreError::Unavailable),
        }
    }

    fn delete_credential(&self) -> Result<(), CredentialStoreError> {
        match self.entry()?.delete_credential() {
            Ok(()) | Err(keyring::Error::NoEntry) => Ok(()),
            Err(_) => Err(CredentialStoreError::Unavailable),
        }
    }
}
