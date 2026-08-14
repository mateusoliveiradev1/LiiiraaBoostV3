//! Authenticated, local-only Windows named-pipe host for the privileged broker.

use std::{
    io::{self, Read},
    sync::{
        Arc,
        atomic::{AtomicUsize, Ordering},
    },
    time::Duration,
};

#[cfg(windows)]
use std::os::windows::io::AsHandle;

use serde_json::Value;

use super::operations::power_scheme::InteractiveUserEffectLease;
#[cfg(test)]
use super::operations::power_scheme::VerifiedClientContext;

pub const OPTIMIZER_PIPE_NAME: &str = r"\\.\pipe\LiiiraaBoost\optimizer-v1";
pub const MAX_FRAME_BYTES: usize = 64 * 1024;

#[derive(Clone, Debug, Eq, PartialEq)]
pub struct PipeHostConfig {
    pub pipe_name: &'static str,
    pub max_frame_bytes: usize,
    pub read_timeout: Duration,
    pub write_timeout: Duration,
    pub request_timeout: Duration,
    pub drain_timeout: Duration,
    pub reject_remote_clients: bool,
}

impl PipeHostConfig {
    pub fn installed_defaults() -> Self {
        Self {
            pipe_name: OPTIMIZER_PIPE_NAME,
            max_frame_bytes: MAX_FRAME_BYTES,
            read_timeout: Duration::from_secs(5),
            write_timeout: Duration::from_secs(5),
            request_timeout: Duration::from_secs(5),
            drain_timeout: Duration::from_secs(15),
            reject_remote_clients: true,
        }
    }
}

#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub enum FrameError {
    Malformed,
    TooLarge,
    Truncated,
}

pub fn encode_frame(value: &Value, maximum: usize) -> Result<Vec<u8>, FrameError> {
    let payload = serde_json::to_vec(value).map_err(|_| FrameError::Malformed)?;
    if payload.is_empty() || payload.len() > maximum || payload.len() > u32::MAX as usize {
        return Err(FrameError::TooLarge);
    }
    let mut frame = Vec::with_capacity(4 + payload.len());
    frame.extend_from_slice(&(payload.len() as u32).to_be_bytes());
    frame.extend_from_slice(&payload);
    Ok(frame)
}

pub fn decode_frame(reader: &mut impl Read, maximum: usize) -> Result<Value, FrameError> {
    let mut length = [0_u8; 4];
    read_exact_frame(reader, &mut length)?;
    let length = u32::from_be_bytes(length) as usize;
    if length == 0 || length > maximum {
        return Err(FrameError::TooLarge);
    }
    let mut payload = vec![0_u8; length];
    read_exact_frame(reader, &mut payload)?;
    serde_json::from_slice(&payload).map_err(|_| FrameError::Malformed)
}

fn read_exact_frame(reader: &mut impl Read, buffer: &mut [u8]) -> Result<(), FrameError> {
    reader
        .read_exact(buffer)
        .map_err(|error| match error.kind() {
            io::ErrorKind::UnexpectedEof => FrameError::Truncated,
            _ => FrameError::Malformed,
        })
}

#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub enum HostState {
    Starting,
    Running,
    Stopping,
    Stopped,
}

#[derive(Debug)]
pub struct HostLifecycle {
    state: HostState,
    in_flight: bool,
}

impl HostLifecycle {
    pub fn new() -> Self {
        Self {
            state: HostState::Starting,
            in_flight: false,
        }
    }

    pub fn state(&self) -> HostState {
        self.state
    }

    pub fn mark_running(&mut self) -> Result<(), HostLifecycleError> {
        if self.state != HostState::Starting {
            return Err(HostLifecycleError);
        }
        self.state = HostState::Running;
        Ok(())
    }

    pub fn begin_request(&mut self) -> Result<(), HostLifecycleError> {
        if self.state != HostState::Running || self.in_flight {
            return Err(HostLifecycleError);
        }
        self.in_flight = true;
        Ok(())
    }

    pub fn begin_stopping(&mut self) {
        if self.state != HostState::Stopped {
            self.state = if self.in_flight {
                HostState::Stopping
            } else {
                HostState::Stopped
            };
        }
    }

    /// Finishes the sole admitted request. `false` means shutdown drained and
    /// the host moved to Stopped; `true` means it remains Running.
    pub fn finish_request(&mut self) -> bool {
        self.in_flight = false;
        if self.state == HostState::Stopping {
            self.state = HostState::Stopped;
            false
        } else {
            self.state == HostState::Running
        }
    }
}

impl Default for HostLifecycle {
    fn default() -> Self {
        Self::new()
    }
}

#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub struct HostLifecycleError;

enum TokenCustody {
    #[cfg(windows)]
    Native {
        handle: std::os::windows::io::OwnedHandle,
    },
    #[cfg(debug_assertions)]
    Test(Arc<AtomicUsize>),
}

/// Opaque lease custody for the restricted primary token duplicated from the
/// authenticated interactive client. No raw handle is exposed or logged.
pub struct AuthenticatedClientToken {
    session_id: u32,
    logon_sid: String,
    token_user_sid: String,
    custody: TokenCustody,
}

impl AuthenticatedClientToken {
    #[cfg(debug_assertions)]
    pub fn for_test(
        session_id: u32,
        logon_sid: impl Into<String>,
        releases: Arc<AtomicUsize>,
    ) -> Self {
        let logon_sid = logon_sid.into();
        Self {
            session_id,
            token_user_sid: logon_sid.clone(),
            logon_sid,
            custody: TokenCustody::Test(releases),
        }
    }

    pub fn is_bound_to(&self, session_id: u32, logon_sid: &str) -> bool {
        self.session_id == session_id && self.logon_sid == logon_sid
    }

    pub(crate) fn is_interactive_client(&self) -> bool {
        self.session_id != 0
            && self.logon_sid.starts_with("S-1-5-5-")
            && self.token_user_sid != "S-1-5-18"
    }

    pub(crate) fn effect_lease(&self) -> InteractiveUserEffectLease<'_> {
        #[cfg(windows)]
        if let TokenCustody::Native { handle } = &self.custody {
            // SAFETY: the borrow ties the lease to this owned token's lifetime;
            // its immutable SID/session binding was verified before custody.
            return unsafe {
                InteractiveUserEffectLease::from_authenticated_pipe_host(
                    self.session_id,
                    self.logon_sid.clone(),
                    self.token_user_sid.clone(),
                    handle.as_handle(),
                )
            };
        }

        #[cfg(debug_assertions)]
        {
            InteractiveUserEffectLease::for_test(self.session_id, self.logon_sid.clone())
        }

        #[cfg(not(debug_assertions))]
        {
            panic!("authenticated client token has no usable custody")
        }
    }

    #[cfg(windows)]
    fn from_native(
        session_id: u32,
        logon_sid: String,
        token_user_sid: String,
        handle: std::os::windows::io::OwnedHandle,
    ) -> Self {
        Self {
            session_id,
            logon_sid,
            token_user_sid,
            custody: TokenCustody::Native { handle },
        }
    }

    #[cfg(all(test, windows))]
    pub fn duplicate_current_process_for_test() -> Result<Self, HostError> {
        windows_host::duplicate_current_process_token_for_test()
    }

    #[cfg(test)]
    pub fn verified_client_context_for_test(&self) -> VerifiedClientContext {
        VerifiedClientContext::establish(self.session_id, self.logon_sid.clone(), true, true)
            .expect("test token has verified client binding")
    }

    #[cfg(all(test, windows))]
    pub(crate) fn effect_lease_with_token_user_sid_for_test(
        &self,
        token_user_sid: impl Into<String>,
    ) -> InteractiveUserEffectLease<'_> {
        let TokenCustody::Native { handle } = &self.custody else {
            panic!("native token required for the Windows identity mismatch proof");
        };
        unsafe {
            InteractiveUserEffectLease::from_authenticated_pipe_host(
                self.session_id,
                self.logon_sid.clone(),
                token_user_sid.into(),
                handle.as_handle(),
            )
        }
    }
}

impl Drop for AuthenticatedClientToken {
    fn drop(&mut self) {
        #[cfg(debug_assertions)]
        if let TokenCustody::Test(releases) = &self.custody {
            releases.fetch_add(1, Ordering::SeqCst);
        }
        // Native OwnedHandle closes exactly once after this Drop returns.
    }
}

pub struct WindowsPipeHost;

#[cfg(windows)]
mod windows_host {
    use std::{
        fs::{self, OpenOptions},
        io::Write,
        mem::{size_of, zeroed},
        os::windows::{
            ffi::OsStrExt,
            io::{AsRawHandle, FromRawHandle, OwnedHandle},
        },
        path::{Path, PathBuf},
        ptr,
        sync::mpsc::Receiver,
        thread,
        time::{Duration, Instant, SystemTime, UNIX_EPOCH},
    };

    use serde::Deserialize;
    use serde_json::{Value, json};
    use sha2::{Digest, Sha256};
    use windows::{
        Win32::{
            Foundation::{
                ERROR_ALREADY_EXISTS, ERROR_BROKEN_PIPE, ERROR_NO_DATA, ERROR_PIPE_CONNECTED,
                ERROR_PIPE_LISTENING, GetLastError, HANDLE, HLOCAL, INVALID_HANDLE_VALUE,
                LocalFree,
            },
            Security::{
                Authorization::{
                    ConvertSidToStringSidW, ConvertStringSecurityDescriptorToSecurityDescriptorW,
                },
                Cryptography::{
                    BCRYPT_USE_SYSTEM_PREFERRED_RNG, BCryptGenRandom, CRYPT_INTEGER_BLOB,
                    CRYPTPROTECT_LOCAL_MACHINE, CryptProtectData, CryptUnprotectData,
                },
                DACL_SECURITY_INFORMATION, DuplicateTokenEx, GetTokenInformation,
                OWNER_SECURITY_INFORMATION, PROTECTED_DACL_SECURITY_INFORMATION,
                PSECURITY_DESCRIPTOR, RevertToSelf, SECURITY_ATTRIBUTES, SecurityImpersonation,
                SetFileSecurityW, TOKEN_ASSIGN_PRIMARY, TOKEN_DUPLICATE, TOKEN_GROUPS, TOKEN_QUERY,
                TOKEN_USER, TokenGroups, TokenPrimary, TokenSessionId, TokenUser,
            },
            Storage::FileSystem::{
                CreateDirectoryW, MOVEFILE_REPLACE_EXISTING, MOVEFILE_WRITE_THROUGH, MoveFileExW,
                PIPE_ACCESS_DUPLEX, ReadFile, WriteFile,
            },
            System::{
                IO::CancelIoEx,
                Pipes::{
                    ConnectNamedPipe, CreateNamedPipeW, DisconnectNamedPipe,
                    GetNamedPipeClientProcessId, ImpersonateNamedPipeClient, NAMED_PIPE_MODE,
                    PIPE_NOWAIT, PIPE_READMODE_BYTE, PIPE_TYPE_BYTE,
                },
                RemoteDesktop::ProcessIdToSessionId,
                Threading::{
                    GetCurrentProcess, GetCurrentThread, OpenProcess, OpenProcessToken,
                    OpenThreadToken, PROCESS_NAME_WIN32, PROCESS_QUERY_LIMITED_INFORMATION,
                    QueryFullProcessImageNameW,
                },
            },
            UI::Shell::{FOLDERID_ProgramData, KF_FLAG_DEFAULT, SHGetKnownFolderPath},
        },
        core::{PCWSTR, PWSTR},
    };

    use super::super::{
        dedup_store::FaultPoint,
        dispatcher::PhysicalOperationDispatcher,
        installation_manifest::{
            CustodyError, CustodyErrorCode, VerifiedInstallationManifest, verify_installed_manifest,
        },
        ipc::{
            Broker, BrokerConfig, BrokerEnvelope, BrokerError, ClientIdentity,
            PIPE_REJECT_REMOTE_CLIENTS, PipeSecurityPolicy, SessionTicket,
        },
        operations::power_scheme::windows_adapter::WindowsPowrProf,
        restore_point::{
            PointObservation, RestorePointObserver, UnavailableReason,
            windows_adapter::WindowsRestorePointApi,
        },
    };
    use super::{AuthenticatedClientToken, HostLifecycle, PipeHostConfig, WindowsPipeHost};

    // Key-link witness: 'AuthenticatedClientToken authorizes PhysicalOperationDispatcher'

    const POLL_INTERVAL: Duration = Duration::from_millis(20);
    const SECRET_BYTES: usize = 32;
    const SECRET_FILE: &str = "broker-install-secret.dpapi";
    const DATABASE_FILE: &str = "broker.sqlite3";
    const ADMISSION_FILE: &str = "last-admitted-installation.json";

    #[derive(Clone, Copy, Debug, Eq, PartialEq)]
    pub enum HostErrorCode {
        InstalledCustody,
        InteractiveSession,
        RestrictedToken,
        StorageAdmission,
        PipeAdmission,
        InstalledManifest,
        InstalledCms,
        InstalledIdentity,
        InstalledAcl,
        Authentication,
        Custody,
        Framing,
        Io,
        Protocol,
        Stopping,
    }

    #[derive(Clone, Copy, Debug, Eq, PartialEq)]
    pub struct HostError {
        pub code: HostErrorCode,
    }

    impl HostError {
        pub const fn service_specific_exit_code(self) -> u32 {
            match self.code {
                HostErrorCode::InstalledCustody => 63_101,
                HostErrorCode::InteractiveSession => 63_102,
                HostErrorCode::RestrictedToken => 63_103,
                HostErrorCode::StorageAdmission => 63_104,
                HostErrorCode::PipeAdmission => 63_105,
                HostErrorCode::InstalledManifest => 63_106,
                HostErrorCode::InstalledCms => 63_107,
                HostErrorCode::InstalledIdentity => 63_108,
                HostErrorCode::InstalledAcl => 63_109,
                HostErrorCode::Authentication => 63_201,
                HostErrorCode::Custody => 63_202,
                HostErrorCode::Framing => 63_203,
                HostErrorCode::Io => 63_204,
                HostErrorCode::Protocol => 63_205,
                HostErrorCode::Stopping => 63_206,
            }
        }

        #[cfg(debug_assertions)]
        pub const fn for_test(code: HostErrorCode) -> Self {
            Self { code }
        }

        #[cfg(debug_assertions)]
        pub const fn for_custody_test(code: CustodyErrorCode) -> Self {
            Self {
                code: installed_custody_code(code),
            }
        }
    }

    impl WindowsPipeHost {
        pub fn prepare(config: PipeHostConfig) -> Result<PreparedHost, HostError> {
            if config.pipe_name != super::OPTIMIZER_PIPE_NAME
                || config.max_frame_bytes != super::MAX_FRAME_BYTES
                || !config.reject_remote_clients
            {
                return Err(host_error(HostErrorCode::PipeAdmission));
            }
            // Key-link witness: 'verify_installed_manifest'
            let manifest = verify_installed_manifest().map_err(installed_custody_error)?;
            let service_sid =
                current_service_sid().map_err(|_| host_error(HostErrorCode::RestrictedToken))?;
            let storage = prepare_storage(&service_sid, &manifest)
                .map_err(|_| host_error(HostErrorCode::StorageAdmission))?;
            let expected_process_hash =
                manifest.document().files.desktop.sha256.as_str().to_owned();
            let now = SystemTime::now()
                .duration_since(UNIX_EPOCH)
                .map_err(|_| host_error(HostErrorCode::StorageAdmission))?
                .as_secs() as i64;
            let broker = Broker::open(
                &storage.database_path,
                BrokerConfig {
                    expected_process_hash,
                    service_sid: service_sid.clone(),
                    database_custody_verified: true,
                    now_unix_seconds: now,
                    max_message_bytes: config.max_frame_bytes,
                    request_timeout_millis: config.request_timeout.as_millis() as u64,
                },
                &storage.install_secret,
            )
            .map_err(|_| host_error(HostErrorCode::StorageAdmission))?;
            let security =
                SecurityDescriptor::new(&PipeSecurityPolicy::service_only(&service_sid).sddl)
                    .map_err(|_| host_error(HostErrorCode::PipeAdmission))?;
            let listener = NativePipe::create(&config, &security)
                .map_err(|_| host_error(HostErrorCode::PipeAdmission))?;
            Ok(PreparedHost {
                config,
                broker,
                security,
                listener: Some(listener),
                lifecycle: HostLifecycle::new(),
            })
        }

        pub fn run(host: &mut PreparedHost, shutdown: &Receiver<()>) -> Result<(), HostError> {
            host.lifecycle
                .mark_running()
                .map_err(|_| host_error(HostErrorCode::Stopping))?;
            loop {
                if shutdown.try_recv().is_ok() {
                    host.stop();
                    return Ok(());
                }
                let listener = host
                    .listener
                    .take()
                    .ok_or_else(|| host_error(HostErrorCode::Io))?;
                match listener.wait_for_client(shutdown)? {
                    WaitResult::Connected(mut pipe) => {
                        let connection_result = host.serve_connection(&mut pipe, shutdown);
                        unsafe {
                            let _ = CancelIoEx(pipe.handle(), None);
                            let _ = DisconnectNamedPipe(pipe.handle());
                        }
                        drop(pipe);
                        if host.lifecycle.state() == super::HostState::Stopped {
                            return Ok(());
                        }
                        if connection_result
                            .is_err_and(|error| error.code == HostErrorCode::Stopping)
                        {
                            host.stop();
                            return Ok(());
                        }
                        // Authentication, framing, timeout and disconnect failures
                        // terminate only this bounded connection, never widen admission.
                        host.listener = Some(NativePipe::create(&host.config, &host.security)?);
                    }
                    WaitResult::Stopping => {
                        host.stop();
                        return Ok(());
                    }
                }
            }
        }
    }

    pub struct PreparedHost {
        config: PipeHostConfig,
        broker: Broker,
        security: SecurityDescriptor,
        listener: Option<NativePipe>,
        lifecycle: HostLifecycle,
    }

    impl PreparedHost {
        fn serve_connection(
            &mut self,
            pipe: &mut NativePipe,
            shutdown: &Receiver<()>,
        ) -> Result<(), HostError> {
            let handshake = pipe.read_value(
                self.config.max_frame_bytes,
                self.config.read_timeout,
                shutdown,
            )?;
            let handshake: Handshake = serde_json::from_value(handshake)
                .map_err(|_| host_error(HostErrorCode::Protocol))?;
            if handshake.kind != "broker-handshake-v1" || handshake.client_nonce.trim().is_empty() {
                return Err(host_error(HostErrorCode::Authentication));
            }
            let (identity, token) = authenticate_pipe_client(pipe.handle())?;
            let ticket = self
                .broker
                .authenticate_client_with_token(&identity, &handshake.client_nonce, token)
                .map_err(|_| host_error(HostErrorCode::Authentication))?;
            pipe.write_value(
                &json!({
                    "kind": "broker-handshake-accepted-v1",
                    "sessionId": ticket.session_id,
                    "serverNonce": ticket.server_nonce,
                    "sessionKey": hex(&ticket.session_key),
                    "nextCounter": ticket.next_counter,
                }),
                self.config.max_frame_bytes,
                self.config.write_timeout,
                shutdown,
            )?;

            let result = self.serve_requests(pipe, shutdown, &ticket);
            self.broker.disconnect_session(&ticket);
            result
        }

        fn serve_requests(
            &mut self,
            pipe: &mut NativePipe,
            shutdown: &Receiver<()>,
            ticket: &SessionTicket,
        ) -> Result<(), HostError> {
            loop {
                if shutdown.try_recv().is_ok() {
                    self.stop();
                    return Ok(());
                }
                let value = match pipe.read_value(
                    self.config.max_frame_bytes,
                    self.config.read_timeout,
                    shutdown,
                ) {
                    Ok(value) => value,
                    Err(error) if error.code == HostErrorCode::Stopping => {
                        self.stop();
                        return Ok(());
                    }
                    Err(error) => return Err(error),
                };
                let envelope: BrokerEnvelope = serde_json::from_value(value)
                    .map_err(|_| host_error(HostErrorCode::Protocol))?;
                self.lifecycle
                    .begin_request()
                    .map_err(|_| host_error(HostErrorCode::Stopping))?;
                let mut power = WindowsPowrProf;
                let mut restore = WindowsRestorePointApi::load(false);
                let mut observer = FailClosedRestoreObserver;
                let mut dispatcher =
                    PhysicalOperationDispatcher::new(&mut power, &mut restore, &mut observer);
                let reply =
                    self.broker
                        .submit(ticket, &envelope, &mut dispatcher, FaultPoint::None);
                let keep_running = self.lifecycle.finish_request();
                let response = broker_result(reply);
                pipe.write_value(
                    &response,
                    self.config.max_frame_bytes,
                    self.config.write_timeout,
                    shutdown,
                )?;
                if !keep_running {
                    return Ok(());
                }
            }
        }

        fn stop(&mut self) {
            self.lifecycle.begin_stopping();
            self.broker.begin_preshutdown();
            self.listener.take();
        }
    }

    struct FailClosedRestoreObserver;

    impl RestorePointObserver for FailClosedRestoreObserver {
        fn observe(&mut self, _sequence_number: i64) -> PointObservation {
            PointObservation::Unavailable(UnavailableReason::PolicyDenied)
        }
    }

    #[derive(Deserialize)]
    #[serde(rename_all = "camelCase", deny_unknown_fields)]
    struct Handshake {
        kind: String,
        client_nonce: String,
    }

    fn broker_result(result: Result<super::super::ipc::BrokerReply, BrokerError>) -> Value {
        match result {
            Ok(reply) => reply.document,
            Err(error) => json!({
                "kind": "broker-host-error-v1",
                "code": format!("{:?}", error.code),
            }),
        }
    }

    struct NativePipe(OwnedHandle);

    enum WaitResult {
        Connected(NativePipe),
        Stopping,
    }

    impl NativePipe {
        fn create(
            config: &PipeHostConfig,
            security: &SecurityDescriptor,
        ) -> Result<Self, HostError> {
            let name = wide(config.pipe_name);
            let attributes = security.attributes();
            let mode = NAMED_PIPE_MODE(
                PIPE_TYPE_BYTE.0
                    | PIPE_READMODE_BYTE.0
                    | PIPE_NOWAIT.0
                    | PIPE_REJECT_REMOTE_CLIENTS,
            );
            let handle = unsafe {
                CreateNamedPipeW(
                    PCWSTR(name.as_ptr()),
                    PIPE_ACCESS_DUPLEX,
                    mode,
                    1,
                    config.max_frame_bytes as u32,
                    config.max_frame_bytes as u32,
                    config.read_timeout.as_millis() as u32,
                    Some(&attributes),
                )
            };
            if handle == INVALID_HANDLE_VALUE {
                return Err(host_error(HostErrorCode::Io));
            }
            // SAFETY: CreateNamedPipeW returned a unique owned kernel handle.
            Ok(Self(unsafe { OwnedHandle::from_raw_handle(handle.0) }))
        }

        fn handle(&self) -> HANDLE {
            HANDLE(self.0.as_raw_handle())
        }

        fn wait_for_client(self, shutdown: &Receiver<()>) -> Result<WaitResult, HostError> {
            loop {
                if shutdown.try_recv().is_ok() {
                    return Ok(WaitResult::Stopping);
                }
                if unsafe { ConnectNamedPipe(self.handle(), None) }.is_ok() {
                    return Ok(WaitResult::Connected(self));
                }
                let error = unsafe { GetLastError() };
                if error == ERROR_PIPE_CONNECTED {
                    return Ok(WaitResult::Connected(self));
                }
                if error != ERROR_PIPE_LISTENING && error != ERROR_NO_DATA {
                    return Err(host_error(HostErrorCode::Io));
                }
                thread::sleep(POLL_INTERVAL);
            }
        }

        fn read_value(
            &mut self,
            maximum: usize,
            timeout: Duration,
            shutdown: &Receiver<()>,
        ) -> Result<Value, HostError> {
            let deadline = Instant::now() + timeout;
            let mut length = [0_u8; 4];
            self.read_exact(&mut length, deadline, shutdown)?;
            let length = u32::from_be_bytes(length) as usize;
            if length == 0 || length > maximum {
                return Err(host_error(HostErrorCode::Framing));
            }
            let mut payload = vec![0_u8; length];
            self.read_exact(&mut payload, deadline, shutdown)?;
            serde_json::from_slice(&payload).map_err(|_| host_error(HostErrorCode::Protocol))
        }

        fn write_value(
            &mut self,
            value: &Value,
            maximum: usize,
            timeout: Duration,
            shutdown: &Receiver<()>,
        ) -> Result<(), HostError> {
            let frame = super::encode_frame(value, maximum)
                .map_err(|_| host_error(HostErrorCode::Framing))?;
            let deadline = Instant::now() + timeout;
            let mut offset = 0;
            while offset < frame.len() {
                if shutdown.try_recv().is_ok() {
                    return Err(host_error(HostErrorCode::Stopping));
                }
                if Instant::now() >= deadline {
                    return Err(host_error(HostErrorCode::Io));
                }
                let mut written = 0_u32;
                match unsafe {
                    WriteFile(
                        self.handle(),
                        Some(&frame[offset..]),
                        Some(&mut written),
                        None,
                    )
                } {
                    Ok(()) if written > 0 => offset += written as usize,
                    _ => {
                        let error = unsafe { GetLastError() };
                        if error == ERROR_BROKEN_PIPE || error == ERROR_NO_DATA {
                            return Err(host_error(HostErrorCode::Io));
                        }
                        thread::sleep(POLL_INTERVAL);
                    }
                }
            }
            Ok(())
        }

        fn read_exact(
            &mut self,
            buffer: &mut [u8],
            deadline: Instant,
            shutdown: &Receiver<()>,
        ) -> Result<(), HostError> {
            let mut offset = 0;
            while offset < buffer.len() {
                if shutdown.try_recv().is_ok() {
                    return Err(host_error(HostErrorCode::Stopping));
                }
                if Instant::now() >= deadline {
                    return Err(host_error(HostErrorCode::Io));
                }
                let mut read = 0_u32;
                match unsafe {
                    ReadFile(
                        self.handle(),
                        Some(&mut buffer[offset..]),
                        Some(&mut read),
                        None,
                    )
                } {
                    Ok(()) if read > 0 => offset += read as usize,
                    _ => {
                        let error = unsafe { GetLastError() };
                        if error == ERROR_BROKEN_PIPE {
                            return Err(host_error(HostErrorCode::Io));
                        }
                        thread::sleep(POLL_INTERVAL);
                    }
                }
            }
            Ok(())
        }
    }

    struct SecurityDescriptor(PSECURITY_DESCRIPTOR);

    impl SecurityDescriptor {
        fn new(sddl: &str) -> Result<Self, HostError> {
            let sddl = wide(sddl);
            let mut descriptor = PSECURITY_DESCRIPTOR::default();
            unsafe {
                ConvertStringSecurityDescriptorToSecurityDescriptorW(
                    PCWSTR(sddl.as_ptr()),
                    1,
                    &mut descriptor,
                    None,
                )
            }
            .map_err(|_| host_error(HostErrorCode::Custody))?;
            Ok(Self(descriptor))
        }

        fn attributes(&self) -> SECURITY_ATTRIBUTES {
            SECURITY_ATTRIBUTES {
                nLength: size_of::<SECURITY_ATTRIBUTES>() as u32,
                lpSecurityDescriptor: self.0.0,
                bInheritHandle: false.into(),
            }
        }
    }

    impl Drop for SecurityDescriptor {
        fn drop(&mut self) {
            if !self.0.0.is_null() {
                unsafe {
                    let _ = LocalFree(Some(HLOCAL(self.0.0)));
                }
            }
        }
    }

    struct RevertGuard {
        active: bool,
    }

    impl RevertGuard {
        const fn new() -> Self {
            Self { active: true }
        }

        fn finish(mut self) -> Result<(), HostError> {
            unsafe { RevertToSelf() }.map_err(|_| host_error(HostErrorCode::Authentication))?;
            self.active = false;
            Ok(())
        }
    }

    impl Drop for RevertGuard {
        fn drop(&mut self) {
            if self.active {
                unsafe {
                    let _ = RevertToSelf();
                }
            }
        }
    }

    struct NativeHandle(OwnedHandle);

    impl NativeHandle {
        fn new(handle: HANDLE) -> Result<Self, HostError> {
            if handle.is_invalid() {
                return Err(host_error(HostErrorCode::Io));
            }
            Ok(Self(unsafe { OwnedHandle::from_raw_handle(handle.0) }))
        }

        fn raw(&self) -> HANDLE {
            HANDLE(self.0.as_raw_handle())
        }
    }

    fn authenticate_pipe_client(
        pipe: HANDLE,
    ) -> Result<(ClientIdentity, AuthenticatedClientToken), HostError> {
        let mut process_id = 0_u32;
        unsafe { GetNamedPipeClientProcessId(pipe, &mut process_id) }
            .map_err(|_| host_error(HostErrorCode::Authentication))?;
        if process_id == 0 {
            return Err(host_error(HostErrorCode::Authentication));
        }
        let mut session_id = 0_u32;
        unsafe { ProcessIdToSessionId(process_id, &mut session_id) }
            .map_err(|_| host_error(HostErrorCode::Authentication))?;
        let image_hash = process_image_hash(process_id)?;

        unsafe { ImpersonateNamedPipeClient(pipe) }
            .map_err(|_| host_error(HostErrorCode::Authentication))?;
        let revert = RevertGuard::new();
        let mut impersonation = HANDLE::default();
        unsafe {
            OpenThreadToken(
                GetCurrentThread(),
                TOKEN_QUERY | TOKEN_DUPLICATE,
                true,
                &mut impersonation,
            )
        }
        .map_err(|_| host_error(HostErrorCode::Authentication))?;
        let impersonation = NativeHandle::new(impersonation)?;
        let token_session = token_session_id(impersonation.raw())?;
        let logon_sid = logon_sid(impersonation.raw())?;
        let token_user_sid = token_user_sid(impersonation.raw())?;
        if token_session != session_id {
            return Err(host_error(HostErrorCode::Authentication));
        }
        let mut primary = HANDLE::default();
        unsafe {
            DuplicateTokenEx(
                impersonation.raw(),
                TOKEN_QUERY | TOKEN_DUPLICATE | TOKEN_ASSIGN_PRIMARY,
                None,
                SecurityImpersonation,
                TokenPrimary,
                &mut primary,
            )
        }
        .map_err(|_| host_error(HostErrorCode::Authentication))?;
        let primary = NativeHandle::new(primary)?;
        drop(impersonation);
        revert.finish()?;

        let identity = ClientIdentity {
            local_machine: true,
            remote_transport: false,
            impersonation_succeeded: true,
            token_query_succeeded: true,
            session_id,
            logon_sid: logon_sid.clone(),
            process_id,
            process_image_hash: image_hash,
        };
        let NativeHandle(primary) = primary;
        Ok((
            identity,
            AuthenticatedClientToken::from_native(session_id, logon_sid, token_user_sid, primary),
        ))
    }

    #[cfg(test)]
    pub(super) fn duplicate_current_process_token_for_test()
    -> Result<AuthenticatedClientToken, HostError> {
        let mut process_token = HANDLE::default();
        unsafe {
            OpenProcessToken(
                GetCurrentProcess(),
                TOKEN_QUERY | TOKEN_DUPLICATE,
                &mut process_token,
            )
        }
        .map_err(|_| host_error(HostErrorCode::Authentication))?;
        let process_token = NativeHandle::new(process_token)?;
        let session_id = token_session_id(process_token.raw())?;
        let logon_sid = logon_sid(process_token.raw())?;
        let token_user_sid = token_user_sid(process_token.raw())?;
        let mut primary = HANDLE::default();
        unsafe {
            DuplicateTokenEx(
                process_token.raw(),
                TOKEN_QUERY | TOKEN_DUPLICATE | TOKEN_ASSIGN_PRIMARY,
                None,
                SecurityImpersonation,
                TokenPrimary,
                &mut primary,
            )
        }
        .map_err(|_| host_error(HostErrorCode::Authentication))?;
        let NativeHandle(primary) = NativeHandle::new(primary)?;
        Ok(AuthenticatedClientToken::from_native(
            session_id,
            logon_sid,
            token_user_sid,
            primary,
        ))
    }

    fn current_service_sid() -> Result<String, HostError> {
        let mut token = HANDLE::default();
        unsafe { OpenProcessToken(GetCurrentProcess(), TOKEN_QUERY, &mut token) }
            .map_err(|_| host_error(HostErrorCode::Authentication))?;
        let token = NativeHandle::new(token)?;
        token_group_sids(token.raw())?
            .into_iter()
            .find(|(_, sid)| sid.starts_with("S-1-5-80-"))
            .map(|(_, sid)| sid)
            .ok_or_else(|| host_error(HostErrorCode::Authentication))
    }

    fn logon_sid(token: HANDLE) -> Result<String, HostError> {
        const SE_GROUP_LOGON_ID_MASK: u32 = 0xC000_0000;
        token_group_sids(token)?
            .into_iter()
            .find(|(attributes, _)| attributes & SE_GROUP_LOGON_ID_MASK == SE_GROUP_LOGON_ID_MASK)
            .map(|(_, sid)| sid)
            .ok_or_else(|| host_error(HostErrorCode::Authentication))
    }

    fn token_group_sids(token: HANDLE) -> Result<Vec<(u32, String)>, HostError> {
        let mut bytes = 0_u32;
        let _ = unsafe { GetTokenInformation(token, TokenGroups, None, 0, &mut bytes) };
        if bytes < size_of::<TOKEN_GROUPS>() as u32 {
            return Err(host_error(HostErrorCode::Authentication));
        }
        let mut buffer = vec![0_u8; bytes as usize];
        unsafe {
            GetTokenInformation(
                token,
                TokenGroups,
                Some(buffer.as_mut_ptr().cast()),
                bytes,
                &mut bytes,
            )
        }
        .map_err(|_| host_error(HostErrorCode::Authentication))?;
        let groups = unsafe { &*buffer.as_ptr().cast::<TOKEN_GROUPS>() };
        let entries = unsafe {
            std::slice::from_raw_parts(groups.Groups.as_ptr(), groups.GroupCount as usize)
        };
        entries
            .iter()
            .map(|entry| sid_string(entry.Sid).map(|sid| (entry.Attributes, sid)))
            .collect()
    }

    fn token_session_id(token: HANDLE) -> Result<u32, HostError> {
        let mut session_id = 0_u32;
        let mut returned = 0_u32;
        unsafe {
            GetTokenInformation(
                token,
                TokenSessionId,
                Some(ptr::addr_of_mut!(session_id).cast()),
                size_of::<u32>() as u32,
                &mut returned,
            )
        }
        .map_err(|_| host_error(HostErrorCode::Authentication))?;
        if returned != size_of::<u32>() as u32 {
            return Err(host_error(HostErrorCode::Authentication));
        }
        Ok(session_id)
    }

    fn token_user_sid(token: HANDLE) -> Result<String, HostError> {
        let mut bytes = 0_u32;
        let _ = unsafe { GetTokenInformation(token, TokenUser, None, 0, &mut bytes) };
        if bytes < size_of::<TOKEN_USER>() as u32 {
            return Err(host_error(HostErrorCode::Authentication));
        }
        let mut buffer = vec![0_u8; bytes as usize];
        unsafe {
            GetTokenInformation(
                token,
                TokenUser,
                Some(buffer.as_mut_ptr().cast()),
                bytes,
                &mut bytes,
            )
        }
        .map_err(|_| host_error(HostErrorCode::Authentication))?;
        let user = unsafe { &*buffer.as_ptr().cast::<TOKEN_USER>() };
        sid_string(user.User.Sid)
    }

    fn sid_string(sid: windows::Win32::Security::PSID) -> Result<String, HostError> {
        let mut text = PWSTR::null();
        unsafe { ConvertSidToStringSidW(sid, &mut text) }
            .map_err(|_| host_error(HostErrorCode::Authentication))?;
        let value =
            unsafe { text.to_string() }.map_err(|_| host_error(HostErrorCode::Authentication));
        unsafe {
            let _ = LocalFree(Some(HLOCAL(text.0.cast())));
        }
        value
    }

    fn process_image_hash(process_id: u32) -> Result<String, HostError> {
        let process = unsafe { OpenProcess(PROCESS_QUERY_LIMITED_INFORMATION, false, process_id) }
            .map_err(|_| host_error(HostErrorCode::Authentication))?;
        let process = NativeHandle::new(process)?;
        let mut path = vec![0_u16; 32_768];
        let mut length = path.len() as u32;
        unsafe {
            QueryFullProcessImageNameW(
                process.raw(),
                PROCESS_NAME_WIN32,
                PWSTR(path.as_mut_ptr()),
                &mut length,
            )
        }
        .map_err(|_| host_error(HostErrorCode::Authentication))?;
        path.truncate(length as usize);
        let path = PathBuf::from(
            String::from_utf16(&path).map_err(|_| host_error(HostErrorCode::Authentication))?,
        );
        let bytes = fs::read(path).map_err(|_| host_error(HostErrorCode::Authentication))?;
        Ok(format!("sha256:{:x}", Sha256::digest(bytes)))
    }

    struct Storage {
        database_path: PathBuf,
        install_secret: Vec<u8>,
    }

    fn prepare_storage(
        service_sid: &str,
        manifest: &VerifiedInstallationManifest,
    ) -> Result<Storage, HostError> {
        let program_data = known_program_data()?;
        let root = program_data.join("Liiiraa Boost");
        let custody = root.join("custody");
        let sddl = format!(
            "O:SY{}",
            PipeSecurityPolicy::service_storage_sddl(service_sid)
        );
        let security = SecurityDescriptor::new(&sddl)?;
        create_protected_directory(&root, &security)?;
        create_protected_directory(&custody, &security)?;

        let database_path = custody.join(DATABASE_FILE);
        ensure_protected_file(&database_path, &security)?;
        let secret_path = custody.join(SECRET_FILE);
        let install_secret = load_or_create_secret(&secret_path, &security)?;
        record_admission(&custody, manifest, &security)?;
        Ok(Storage {
            database_path,
            install_secret,
        })
    }

    fn create_protected_directory(
        path: &Path,
        security: &SecurityDescriptor,
    ) -> Result<(), HostError> {
        let wide_path = wide_os(path);
        let attributes = security.attributes();
        match unsafe { CreateDirectoryW(PCWSTR(wide_path.as_ptr()), Some(&attributes)) } {
            Ok(()) => {}
            Err(_) if unsafe { GetLastError() } == ERROR_ALREADY_EXISTS => {}
            Err(_) => return Err(host_error(HostErrorCode::Custody)),
        }
        apply_security(path, security)
    }

    fn ensure_protected_file(path: &Path, security: &SecurityDescriptor) -> Result<(), HostError> {
        if !path.exists() {
            OpenOptions::new()
                .write(true)
                .create_new(true)
                .open(path)
                .map_err(|_| host_error(HostErrorCode::Custody))?;
        }
        apply_security(path, security)
    }

    fn apply_security(path: &Path, security: &SecurityDescriptor) -> Result<(), HostError> {
        let wide_path = wide_os(path);
        let information = windows::Win32::Security::OBJECT_SECURITY_INFORMATION(
            OWNER_SECURITY_INFORMATION.0
                | DACL_SECURITY_INFORMATION.0
                | PROTECTED_DACL_SECURITY_INFORMATION.0,
        );
        if unsafe { SetFileSecurityW(PCWSTR(wide_path.as_ptr()), information, security.0) }
            .as_bool()
        {
            Ok(())
        } else {
            Err(host_error(HostErrorCode::Custody))
        }
    }

    fn load_or_create_secret(
        path: &Path,
        security: &SecurityDescriptor,
    ) -> Result<Vec<u8>, HostError> {
        if path.exists() {
            let protected = fs::read(path).map_err(|_| host_error(HostErrorCode::Custody))?;
            return unprotect(&protected);
        }
        let mut secret = vec![0_u8; SECRET_BYTES];
        let status = unsafe { BCryptGenRandom(None, &mut secret, BCRYPT_USE_SYSTEM_PREFERRED_RNG) };
        if status.is_err() {
            return Err(host_error(HostErrorCode::Custody));
        }
        let protected = protect(&secret)?;
        OpenOptions::new()
            .write(true)
            .create_new(true)
            .open(path)
            .and_then(|mut file| {
                file.write_all(&protected)?;
                file.sync_all()
            })
            .map_err(|_| host_error(HostErrorCode::Custody))?;
        apply_security(path, security)?;
        Ok(secret)
    }

    fn protect(secret: &[u8]) -> Result<Vec<u8>, HostError> {
        let input = CRYPT_INTEGER_BLOB {
            cbData: secret.len() as u32,
            pbData: secret.as_ptr().cast_mut(),
        };
        let mut output: CRYPT_INTEGER_BLOB = unsafe { zeroed() };
        unsafe {
            CryptProtectData(
                &input,
                PCWSTR::null(),
                None,
                None,
                None,
                CRYPTPROTECT_LOCAL_MACHINE,
                &mut output,
            )
        }
        .map_err(|_| host_error(HostErrorCode::Custody))?;
        let bytes =
            unsafe { std::slice::from_raw_parts(output.pbData, output.cbData as usize) }.to_vec();
        unsafe {
            let _ = LocalFree(Some(HLOCAL(output.pbData.cast())));
        }
        Ok(bytes)
    }

    fn unprotect(protected: &[u8]) -> Result<Vec<u8>, HostError> {
        let input = CRYPT_INTEGER_BLOB {
            cbData: protected.len() as u32,
            pbData: protected.as_ptr().cast_mut(),
        };
        let mut output: CRYPT_INTEGER_BLOB = unsafe { zeroed() };
        unsafe { CryptUnprotectData(&input, None, None, None, None, 0, &mut output) }
            .map_err(|_| host_error(HostErrorCode::Custody))?;
        let bytes =
            unsafe { std::slice::from_raw_parts(output.pbData, output.cbData as usize) }.to_vec();
        unsafe {
            let _ = LocalFree(Some(HLOCAL(output.pbData.cast())));
        }
        if bytes.len() != SECRET_BYTES {
            return Err(host_error(HostErrorCode::Custody));
        }
        Ok(bytes)
    }

    fn record_admission(
        custody: &Path,
        manifest: &VerifiedInstallationManifest,
        security: &SecurityDescriptor,
    ) -> Result<(), HostError> {
        let path = custody.join(ADMISSION_FILE);
        let bytes = serde_json::to_vec(&json!({
            "manifestSha256": manifest.manifest_sha256(),
            "packageVersion": manifest.package_version(),
            "productCode": manifest.document().product_code.as_str(),
        }))
        .map_err(|_| host_error(HostErrorCode::Custody))?;
        if path.exists() {
            let existing = fs::read(&path).map_err(|_| host_error(HostErrorCode::Custody))?;
            if existing == bytes {
                return apply_security(&path, security);
            }
        }
        let temporary = custody.join("last-admitted-installation.next");
        if temporary.exists() {
            return Err(host_error(HostErrorCode::Custody));
        }
        OpenOptions::new()
            .write(true)
            .create_new(true)
            .open(&temporary)
            .and_then(|mut file| {
                file.write_all(&bytes)?;
                file.sync_all()
            })
            .map_err(|_| host_error(HostErrorCode::Custody))?;
        apply_security(&temporary, security)?;
        let temporary_wide = wide_os(&temporary);
        let path_wide = wide_os(&path);
        unsafe {
            MoveFileExW(
                PCWSTR(temporary_wide.as_ptr()),
                PCWSTR(path_wide.as_ptr()),
                MOVEFILE_REPLACE_EXISTING | MOVEFILE_WRITE_THROUGH,
            )
        }
        .map_err(|_| host_error(HostErrorCode::Custody))?;
        apply_security(&path, security)
    }

    fn known_program_data() -> Result<PathBuf, HostError> {
        let pointer = unsafe { SHGetKnownFolderPath(&FOLDERID_ProgramData, KF_FLAG_DEFAULT, None) }
            .map_err(|_| host_error(HostErrorCode::Custody))?;
        let value = unsafe { pointer.to_string() }
            .map(PathBuf::from)
            .map_err(|_| host_error(HostErrorCode::Custody));
        unsafe { windows::Win32::System::Com::CoTaskMemFree(Some(pointer.0.cast())) };
        value
    }

    fn wide(value: &str) -> Vec<u16> {
        value.encode_utf16().chain(Some(0)).collect()
    }

    fn wide_os(path: &Path) -> Vec<u16> {
        path.as_os_str().encode_wide().chain(Some(0)).collect()
    }

    fn hex(bytes: &[u8]) -> String {
        const HEX: &[u8; 16] = b"0123456789abcdef";
        let mut output = String::with_capacity(bytes.len() * 2);
        for byte in bytes {
            output.push(HEX[(byte >> 4) as usize] as char);
            output.push(HEX[(byte & 0x0f) as usize] as char);
        }
        output
    }

    fn host_error(code: HostErrorCode) -> HostError {
        HostError { code }
    }

    const fn installed_custody_code(code: CustodyErrorCode) -> HostErrorCode {
        match code {
            CustodyErrorCode::Missing | CustodyErrorCode::Path => HostErrorCode::InstalledCustody,
            CustodyErrorCode::Schema => HostErrorCode::InstalledManifest,
            CustodyErrorCode::Signature => HostErrorCode::InstalledCms,
            CustodyErrorCode::Authenticode | CustodyErrorCode::Hash | CustodyErrorCode::Version => {
                HostErrorCode::InstalledIdentity
            }
            CustodyErrorCode::Acl => HostErrorCode::InstalledAcl,
        }
    }

    fn installed_custody_error(error: CustodyError) -> HostError {
        host_error(installed_custody_code(error.code))
    }

    #[cfg(test)]
    mod tests {
        use std::{
            fs::OpenOptions,
            io::Write,
            os::windows::io::{AsRawHandle, FromRawHandle, OwnedHandle},
            sync::mpsc,
            time::Duration,
        };

        use windows::Win32::{
            Foundation::{ERROR_PIPE_CONNECTED, GetLastError, HANDLE, INVALID_HANDLE_VALUE},
            Storage::FileSystem::{PIPE_ACCESS_DUPLEX, ReadFile},
            System::Pipes::{
                ConnectNamedPipe, CreateNamedPipeW, DisconnectNamedPipe, NAMED_PIPE_MODE,
                PIPE_READMODE_BYTE, PIPE_TYPE_BYTE,
            },
        };
        use windows::core::PCWSTR;

        use super::super::super::operations::power_scheme::{
            PowerSchemePort, VerifiedClientContext,
        };
        use super::{PIPE_REJECT_REMOTE_CLIENTS, WindowsPowrProf, authenticate_pipe_client, wide};

        #[test]
        fn real_named_pipe_impersonation_yields_client_bound_token() {
            let pipe_name = format!(r"\\.\pipe\LiiiraaBoost\token-test-{}", std::process::id());
            let wide_name = wide(&pipe_name);
            let mode = NAMED_PIPE_MODE(
                PIPE_TYPE_BYTE.0 | PIPE_READMODE_BYTE.0 | PIPE_REJECT_REMOTE_CLIENTS,
            );
            let raw = unsafe {
                CreateNamedPipeW(
                    PCWSTR(wide_name.as_ptr()),
                    PIPE_ACCESS_DUPLEX,
                    mode,
                    1,
                    4096,
                    4096,
                    5_000,
                    None,
                )
            };
            assert_ne!(raw, INVALID_HANDLE_VALUE);
            let server = unsafe { OwnedHandle::from_raw_handle(raw.0) };
            let (client_tx, client_rx) = mpsc::channel();
            let client_name = pipe_name.clone();
            let client = std::thread::spawn(move || {
                let mut pipe = OpenOptions::new()
                    .read(true)
                    .write(true)
                    .open(client_name)
                    .expect("connect real named-pipe client");
                pipe.write_all(b"h").expect("seed client security context");
                client_tx.send(pipe).expect("retain client handle");
            });
            match unsafe { ConnectNamedPipe(HANDLE(server.as_raw_handle()), None) } {
                Ok(()) => {}
                Err(_) if unsafe { GetLastError() } == ERROR_PIPE_CONNECTED => {}
                Err(error) => panic!("connect named-pipe server: {error:?}"),
            }
            let mut byte = [0_u8; 1];
            let mut read = 0_u32;
            unsafe {
                ReadFile(
                    HANDLE(server.as_raw_handle()),
                    Some(&mut byte),
                    Some(&mut read),
                    None,
                )
            }
            .expect("read client handshake byte");
            assert_eq!(read, 1);
            let client_handle = client_rx.recv().expect("receive live client handle");

            let (identity, token) = authenticate_pipe_client(HANDLE(server.as_raw_handle()))
                .expect("impersonate and duplicate actual pipe client token");
            assert_eq!(identity.process_id, std::process::id());
            assert_ne!(identity.session_id, 0);
            assert!(token.is_interactive_client());
            assert!(token.is_bound_to(identity.session_id, &identity.logon_sid));
            let verified = VerifiedClientContext::establish(
                identity.session_id,
                identity.logon_sid.clone(),
                true,
                true,
            )
            .expect("verified client context");
            let lease = token.effect_lease();
            let mut power = WindowsPowrProf;
            let observation =
                lease.with_interactive_user(Duration::from_secs(5), &verified, |client| {
                    power.observe_active(client)
                });
            assert!(
                observation.is_ok(),
                "real client-bound read-only observation failed: {observation:?}"
            );

            drop(client_handle);
            unsafe {
                let _ = DisconnectNamedPipe(HANDLE(server.as_raw_handle()));
            }
            client.join().expect("join client thread");
        }
    }
}

#[cfg(windows)]
pub use windows_host::{HostError, HostErrorCode, PreparedHost};
