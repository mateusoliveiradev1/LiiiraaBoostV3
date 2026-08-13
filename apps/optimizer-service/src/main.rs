//! Minimal privileged optimizer broker.
//!
//! The RED phase deliberately exposes the final test surface while every
//! authoritative operation remains fail-closed. Task 2 moves these modules to
//! their production files and implements the boundary.

pub mod dedup_store {
    #[derive(Clone, Copy, Debug, Eq, PartialEq)]
    pub enum FaultPoint {
        None,
        AfterReserve,
        AfterDispatch,
    }
}

pub mod ipc {
    use std::path::Path;

    use serde_json::Value;

    use super::dedup_store::FaultPoint;

    pub const PIPE_REJECT_REMOTE_CLIENTS: u32 = 0x0000_0008;

    #[derive(Clone, Debug, Eq, PartialEq)]
    pub struct PipeSecurityPolicy {
        pub pipe_name: String,
        pub sddl: String,
        pub open_mode_flags: u32,
    }

    impl PipeSecurityPolicy {
        pub fn service_only(_interactive_logon_sid: &str, _service_sid: &str) -> Self {
            Self {
                pipe_name: String::new(),
                sddl: String::new(),
                open_mode_flags: 0,
            }
        }
    }

    #[derive(Clone, Debug)]
    pub struct BrokerConfig {
        pub interactive_session_id: u32,
        pub interactive_logon_sid: String,
        pub expected_process_hash: String,
        pub service_sid: String,
        pub database_custody_verified: bool,
        pub now_unix_seconds: i64,
        pub max_message_bytes: usize,
    }

    #[derive(Clone, Debug)]
    pub struct ClientIdentity {
        pub local_machine: bool,
        pub remote_transport: bool,
        pub impersonation_succeeded: bool,
        pub token_query_succeeded: bool,
        pub session_id: u32,
        pub logon_sid: String,
        pub process_id: u32,
        pub process_image_hash: String,
    }

    #[derive(Clone, Debug)]
    pub struct SessionTicket {
        pub session_id: String,
        pub server_nonce: String,
        pub session_key: Vec<u8>,
    }

    #[derive(Clone, Debug)]
    pub struct BrokerEnvelope {
        pub transaction_id: String,
        pub step_id: String,
        pub operation_version_id: String,
        pub server_nonce: String,
        pub request: Value,
        pub mac_hex: String,
    }

    #[derive(Clone, Copy, Debug, Eq, PartialEq)]
    pub enum ReplyDisposition {
        Terminal,
        ObservationRequired,
    }

    #[derive(Clone, Debug, PartialEq)]
    pub struct BrokerReply {
        pub disposition: ReplyDisposition,
        pub document: Value,
    }

    #[derive(Clone, Copy, Debug, Eq, PartialEq)]
    pub enum BrokerErrorCode {
        AuthenticationFailed,
        CustodyUnavailable,
        DatabaseUnavailable,
        DuplicateConflict,
        IntegrityFailure,
        InvalidMac,
        InvalidMessage,
        MessageTooLarge,
        NotImplemented,
        ReplayRejected,
        ServerStopping,
        Timeout,
    }

    #[derive(Clone, Copy, Debug, Eq, PartialEq)]
    pub struct BrokerError {
        pub code: BrokerErrorCode,
    }

    #[derive(Clone, Debug, Eq, PartialEq)]
    pub enum AllowedOperation {
        ObservePowerScheme,
        DuplicateManagedPowerScheme,
        ActivateManagedPowerScheme,
        DeleteOwnedPowerScheme,
        PrepareRestorePoint,
    }

    pub trait OperationDispatcher {
        fn dispatch(&mut self, operation: AllowedOperation) -> Result<Value, BrokerError>;
    }

    pub struct Broker;

    impl Broker {
        pub fn open(
            _database_path: impl AsRef<Path>,
            _config: BrokerConfig,
            _install_secret: &[u8],
        ) -> Result<Self, BrokerError> {
            Ok(Self)
        }

        pub fn authenticate_client(
            &mut self,
            _identity: &ClientIdentity,
            _client_nonce: &str,
        ) -> Result<SessionTicket, BrokerError> {
            Err(BrokerError {
                code: BrokerErrorCode::NotImplemented,
            })
        }

        pub fn sign_envelope(
            _ticket: &SessionTicket,
            transaction_id: &str,
            step_id: &str,
            operation_version_id: &str,
            request: Value,
        ) -> BrokerEnvelope {
            BrokerEnvelope {
                transaction_id: transaction_id.to_owned(),
                step_id: step_id.to_owned(),
                operation_version_id: operation_version_id.to_owned(),
                server_nonce: String::new(),
                request,
                mac_hex: String::new(),
            }
        }

        pub fn submit(
            &mut self,
            _ticket: &SessionTicket,
            _envelope: &BrokerEnvelope,
            _dispatcher: &mut dyn OperationDispatcher,
            _fault: FaultPoint,
        ) -> Result<BrokerReply, BrokerError> {
            Err(BrokerError {
                code: BrokerErrorCode::NotImplemented,
            })
        }

        pub fn begin_preshutdown(&mut self) {}

        pub fn prune_terminal_before(&mut self, _cutoff: i64) -> Result<usize, BrokerError> {
            Err(BrokerError {
                code: BrokerErrorCode::NotImplemented,
            })
        }
    }
}

fn main() {}
