//! Windows service entrypoint for the minimal privileged optimizer broker.

pub mod artifact_manifest;
pub mod dedup_store;
pub mod dispatcher;
pub mod installation_manifest;
pub mod ipc;
pub mod operations;
pub mod restore_point;
pub mod windows_pipe;

#[cfg(windows)]
fn main() -> windows_service::Result<()> {
    windows_service_host::run()
}

#[cfg(not(windows))]
fn main() {
    panic!("liiiraa-optimizer-service is Windows-only");
}

#[cfg(windows)]
pub(crate) mod windows_service_host {
    use std::{ffi::OsString, sync::mpsc, time::Duration};

    use super::windows_pipe::{PipeHostConfig, WindowsPipeHost};

    use windows_service::{
        Result, define_windows_service,
        service::{
            ServiceControl, ServiceControlAccept, ServiceExitCode, ServiceState, ServiceStatus,
            ServiceType,
        },
        service_control_handler::{self, ServiceControlHandlerResult},
        service_dispatcher,
    };

    const SERVICE_NAME: &str = "LiiiraaBoostOptimizer";
    const SERVICE_TYPE: ServiceType = ServiceType::OWN_PROCESS;

    pub fn run() -> Result<()> {
        service_dispatcher::start(SERVICE_NAME, ffi_service_main)
    }

    define_windows_service!(ffi_service_main, service_main);

    pub fn service_main(_arguments: Vec<OsString>) {
        let _ = run_service();
    }

    fn run_service() -> Result<()> {
        let (shutdown_tx, shutdown_rx) = mpsc::channel();
        let event_handler = move |control| -> ServiceControlHandlerResult {
            match control {
                ServiceControl::Interrogate => ServiceControlHandlerResult::NoError,
                ServiceControl::Stop | ServiceControl::Shutdown | ServiceControl::Preshutdown => {
                    let _ = shutdown_tx.send(());
                    ServiceControlHandlerResult::NoError
                }
                _ => ServiceControlHandlerResult::NotImplemented,
            }
        };
        let status = service_control_handler::register(SERVICE_NAME, event_handler)?;
        status.set_service_status(ServiceStatus {
            service_type: SERVICE_TYPE,
            current_state: ServiceState::StartPending,
            controls_accepted: ServiceControlAccept::empty(),
            exit_code: ServiceExitCode::Win32(0),
            checkpoint: 1,
            wait_hint: Duration::from_secs(30),
            process_id: None,
        })?;

        // Installed custody is verified and the first local-only pipe instance
        // is created before SCM can observe this service as Running.
        let mut pipe_host = match WindowsPipeHost::prepare(PipeHostConfig::installed_defaults()) {
            Ok(host) => host,
            Err(error) => {
                status.set_service_status(startup_failure_status(error))?;
                return Ok(());
            }
        };
        status.set_service_status(ServiceStatus {
            service_type: SERVICE_TYPE,
            current_state: ServiceState::Running,
            controls_accepted: ServiceControlAccept::STOP
                | ServiceControlAccept::SHUTDOWN
                | ServiceControlAccept::PRESHUTDOWN,
            exit_code: ServiceExitCode::Win32(0),
            checkpoint: 0,
            wait_hint: Duration::default(),
            process_id: None,
        })?;

        // Key-link witness: 'WindowsPipeHost::run'
        let host_result = WindowsPipeHost::run(&mut pipe_host, &shutdown_rx);
        status.set_service_status(ServiceStatus {
            service_type: SERVICE_TYPE,
            current_state: ServiceState::StopPending,
            controls_accepted: ServiceControlAccept::empty(),
            exit_code: ServiceExitCode::Win32(0),
            checkpoint: 1,
            wait_hint: Duration::from_secs(15),
            process_id: None,
        })?;
        status.set_service_status(ServiceStatus {
            service_type: SERVICE_TYPE,
            current_state: ServiceState::Stopped,
            controls_accepted: ServiceControlAccept::empty(),
            exit_code: host_result.map_or_else(
                |error| ServiceExitCode::ServiceSpecific(error.service_specific_exit_code()),
                |_| ServiceExitCode::Win32(0),
            ),
            checkpoint: 0,
            wait_hint: Duration::default(),
            process_id: None,
        })?;
        Ok(())
    }

    pub(crate) fn startup_failure_status(error: super::windows_pipe::HostError) -> ServiceStatus {
        ServiceStatus {
            service_type: SERVICE_TYPE,
            current_state: ServiceState::Stopped,
            controls_accepted: ServiceControlAccept::empty(),
            exit_code: ServiceExitCode::ServiceSpecific(error.service_specific_exit_code()),
            checkpoint: 0,
            wait_hint: Duration::default(),
            process_id: None,
        }
    }
}
