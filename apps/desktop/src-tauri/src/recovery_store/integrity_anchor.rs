use std::fmt;

#[derive(Clone, Debug, Eq, PartialEq)]
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

#[derive(Debug)]
pub struct WindowsIntegrityAnchor;

impl WindowsIntegrityAnchor {
    pub fn new() -> Self {
        Self
    }
}

impl IntegrityAnchor for WindowsIntegrityAnchor {
    fn read_head(&self) -> Result<Option<AnchorHead>, IntegrityAnchorError> {
        Err(IntegrityAnchorError::Unavailable)
    }

    fn read_key(&self, _epoch: u32) -> Result<Option<Vec<u8>>, IntegrityAnchorError> {
        Err(IntegrityAnchorError::Unavailable)
    }

    fn initialize(&self, _head: &AnchorHead, _key: &[u8]) -> Result<(), IntegrityAnchorError> {
        Err(IntegrityAnchorError::Unavailable)
    }

    fn install_key(&self, _epoch: u32, _key: &[u8]) -> Result<(), IntegrityAnchorError> {
        Err(IntegrityAnchorError::Unavailable)
    }

    fn compare_and_swap(
        &self,
        _expected: &AnchorHead,
        _next: &AnchorHead,
    ) -> Result<(), IntegrityAnchorError> {
        Err(IntegrityAnchorError::Unavailable)
    }
}
