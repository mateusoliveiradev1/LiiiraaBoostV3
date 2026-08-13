//! Truthful, complementary Windows System Restore preparation.
//!
//! The operation-specific Liiiraa recovery manifest remains the primary recovery
//! authority. This module can only add evidence about the complementary Windows
//! restore-point layer.

pub const SRCLIENT_DLL: &str = "SrClient.dll";
pub const SR_SET_RESTORE_POINT_W_SYMBOL: &[u8] = b"SRSetRestorePointW\0";
pub const MAX_DESCRIPTION_UTF16_UNITS: usize = 255;

pub const ERROR_SUCCESS: u32 = 0;
pub const ERROR_ACCESS_DENIED: u32 = 5;
pub const ERROR_SERVICE_DISABLED: u32 = 1058;
pub const ERROR_NOT_SAFEBOOT_SERVICE: u32 = 1084;
pub const ERROR_ACCESS_DISABLED_BY_POLICY: u32 = 1260;

#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub enum RiskClass {
    Verified,
    Advanced,
    Experimental,
    Extreme,
}

#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub enum UnavailableReason {
    ComNotInitialized,
    ComCallbackSecurityMissing,
    DllMissing,
    SymbolMissing,
    Disabled,
    SafeMode,
    PolicyDenied,
    AccessDenied,
    ShuttingDown,
}

#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub struct ApiCallEvidence {
    pub returned: bool,
    pub status: u32,
    pub sequence_number: i64,
}

#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub enum PointObservation {
    Usable { sequence_number: i64 },
    ExistingRecent { sequence_number: i64 },
    NotCreated,
    Unavailable(UnavailableReason),
    Failed { status: u32 },
}

#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub enum FailureStage {
    Request,
    Begin,
    End,
    Observation,
}

#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub struct FailureEvidence {
    pub stage: FailureStage,
    pub status: Option<u32>,
}

#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub enum ComplementaryState {
    Usable { sequence_number: i64 },
    SkippedFrequency { sequence_number: i64 },
    NotCreated,
    Unavailable(UnavailableReason),
    Failed(FailureEvidence),
}

#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub enum Admission {
    Allowed,
    RequiresComplementAcknowledgement,
    Blocked,
}

#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub struct PreparationRequest<'a> {
    pub description: &'a str,
    pub risk: RiskClass,
    pub primary_manifest_ready: bool,
    pub advanced_without_complement_acknowledged: bool,
}

#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub struct RestorePointProjection {
    pub requested: bool,
    pub primary_manifest_preserved: bool,
    pub begin: Option<ApiCallEvidence>,
    pub end: Option<ApiCallEvidence>,
    pub observation: Option<PointObservation>,
    pub state: ComplementaryState,
    pub admission: Admission,
}

pub trait RestorePointApi {
    fn readiness(&mut self) -> Result<(), UnavailableReason>;
    fn begin(&mut self, description: &str) -> ApiCallEvidence;
    fn end(&mut self, sequence_number: i64, description: &str) -> ApiCallEvidence;
}

pub trait RestorePointObserver {
    fn observe(&mut self, sequence_number: i64) -> PointObservation;
}

pub fn prepare_restore_point(
    api: &mut dyn RestorePointApi,
    observer: &mut dyn RestorePointObserver,
    request: PreparationRequest<'_>,
) -> RestorePointProjection {
    if !request.primary_manifest_ready {
        return projection(
            request,
            None,
            None,
            None,
            ComplementaryState::Failed(FailureEvidence {
                stage: FailureStage::Request,
                status: None,
            }),
        );
    }
    if let Err(reason) = api.readiness() {
        return projection(
            request,
            None,
            None,
            None,
            ComplementaryState::Unavailable(reason),
        );
    }

    let begin = api.begin(request.description);
    if !begin.returned || begin.status != ERROR_SUCCESS || begin.sequence_number <= 0 {
        let state = unavailable_from_status(begin.status).map_or_else(
            || {
                ComplementaryState::Failed(FailureEvidence {
                    stage: FailureStage::Begin,
                    status: Some(begin.status),
                })
            },
            ComplementaryState::Unavailable,
        );
        return projection(request, Some(begin), None, None, state);
    }

    let end = api.end(begin.sequence_number, request.description);
    if !end.returned || end.status != ERROR_SUCCESS || end.sequence_number != begin.sequence_number
    {
        return projection(
            request,
            Some(begin),
            Some(end),
            None,
            ComplementaryState::Failed(FailureEvidence {
                stage: FailureStage::End,
                status: Some(end.status),
            }),
        );
    }

    let observation = observer.observe(begin.sequence_number);
    let state = match observation {
        PointObservation::Usable { sequence_number }
            if sequence_number == begin.sequence_number =>
        {
            ComplementaryState::Usable { sequence_number }
        }
        PointObservation::ExistingRecent { sequence_number } => {
            ComplementaryState::SkippedFrequency { sequence_number }
        }
        PointObservation::Unavailable(reason) => ComplementaryState::Unavailable(reason),
        PointObservation::Failed { status } => ComplementaryState::Failed(FailureEvidence {
            stage: FailureStage::Observation,
            status: Some(status),
        }),
        PointObservation::Usable { .. } | PointObservation::NotCreated => {
            ComplementaryState::NotCreated
        }
    };
    projection(request, Some(begin), Some(end), Some(observation), state)
}

fn unavailable_from_status(status: u32) -> Option<UnavailableReason> {
    match status {
        ERROR_SERVICE_DISABLED => Some(UnavailableReason::Disabled),
        ERROR_NOT_SAFEBOOT_SERVICE => Some(UnavailableReason::SafeMode),
        ERROR_ACCESS_DISABLED_BY_POLICY => Some(UnavailableReason::PolicyDenied),
        ERROR_ACCESS_DENIED => Some(UnavailableReason::AccessDenied),
        _ => None,
    }
}

fn projection(
    request: PreparationRequest<'_>,
    begin: Option<ApiCallEvidence>,
    end: Option<ApiCallEvidence>,
    observation: Option<PointObservation>,
    state: ComplementaryState,
) -> RestorePointProjection {
    let usable = matches!(state, ComplementaryState::Usable { .. });
    let admission = if !request.primary_manifest_ready || request.risk == RiskClass::Extreme {
        Admission::Blocked
    } else {
        match request.risk {
            RiskClass::Verified => Admission::Allowed,
            RiskClass::Advanced if usable || request.advanced_without_complement_acknowledged => {
                Admission::Allowed
            }
            RiskClass::Advanced => Admission::RequiresComplementAcknowledgement,
            RiskClass::Experimental if usable => Admission::Allowed,
            RiskClass::Experimental | RiskClass::Extreme => Admission::Blocked,
        }
    };
    RestorePointProjection {
        requested: true,
        primary_manifest_preserved: request.primary_manifest_ready,
        begin,
        end,
        observation,
        state,
        admission,
    }
}

#[cfg(windows)]
pub mod windows_adapter {
    use std::{mem::transmute, ptr};

    use windows::{
        Win32::{
            Foundation::{FreeLibrary, HMODULE},
            System::{
                Com::{COINIT_MULTITHREADED, CoInitializeEx},
                LibraryLoader::{GetProcAddress, LoadLibraryW},
                Restore::{
                    APPLICATION_INSTALL, BEGIN_SYSTEM_CHANGE, END_SYSTEM_CHANGE, RESTOREPOINTINFOW,
                    STATEMGRSTATUS,
                },
            },
        },
        core::{BOOL, PCSTR, w},
    };

    use super::{
        ApiCallEvidence, ERROR_SUCCESS, MAX_DESCRIPTION_UTF16_UNITS, RestorePointApi,
        SR_SET_RESTORE_POINT_W_SYMBOL, UnavailableReason,
    };

    type SrSetRestorePointW =
        unsafe extern "system" fn(*const RESTOREPOINTINFOW, *mut STATEMGRSTATUS) -> BOOL;

    pub struct WindowsRestorePointApi {
        library: Option<HMODULE>,
        set_restore_point: Option<SrSetRestorePointW>,
        com_initialized: bool,
        com_callback_security_ready: bool,
        shutting_down: bool,
    }

    impl WindowsRestorePointApi {
        /// Loads the one documented System Restore library and symbol.
        ///
        /// `com_callback_security_ready` must only be true after the service host
        /// has configured process-wide COM callback security for LocalService,
        /// NetworkService, SYSTEM, SELF, and Administrators as documented by
        /// Microsoft. This adapter does not broaden or replace that host policy.
        pub fn load(com_callback_security_ready: bool) -> Self {
            let com_initialized = unsafe {
                let result = CoInitializeEx(None, COINIT_MULTITHREADED);
                result.is_ok() || result.0 == 0x80010106_u32 as i32
            };
            let library = unsafe { LoadLibraryW(w!("SrClient.dll")) }.ok();
            let set_restore_point = library.and_then(|handle| unsafe {
                GetProcAddress(handle, PCSTR(SR_SET_RESTORE_POINT_W_SYMBOL.as_ptr())).map(
                    |address| {
                        transmute::<unsafe extern "system" fn() -> isize, SrSetRestorePointW>(
                            address,
                        )
                    },
                )
            });
            Self {
                library,
                set_restore_point,
                com_initialized,
                com_callback_security_ready,
                shutting_down: false,
            }
        }

        pub fn begin_shutdown(&mut self) {
            self.shutting_down = true;
        }

        fn invoke(
            &self,
            event_type: u32,
            sequence_number: i64,
            description: &str,
        ) -> ApiCallEvidence {
            let Some(set_restore_point) = self.set_restore_point else {
                return ApiCallEvidence {
                    returned: false,
                    status: ERROR_SUCCESS,
                    sequence_number: 0,
                };
            };
            let mut info = RESTOREPOINTINFOW::default();
            info.dwEventType.0 = event_type;
            info.dwRestorePtType = APPLICATION_INSTALL;
            info.llSequenceNumber = sequence_number;
            let mut encoded_description = [0_u16; 256];
            for (slot, unit) in encoded_description
                .iter_mut()
                .take(MAX_DESCRIPTION_UTF16_UNITS)
                .zip(description.encode_utf16())
            {
                *slot = unit;
            }
            info.szDescription = encoded_description;
            let mut status = STATEMGRSTATUS::default();
            let returned =
                unsafe { set_restore_point(ptr::addr_of!(info), ptr::addr_of_mut!(status)) };
            let code = unsafe { ptr::read_unaligned(ptr::addr_of!(status.nStatus)) }.0;
            let observed_sequence =
                unsafe { ptr::read_unaligned(ptr::addr_of!(status.llSequenceNumber)) };
            ApiCallEvidence {
                returned: returned.as_bool(),
                status: code,
                sequence_number: observed_sequence,
            }
        }
    }

    impl RestorePointApi for WindowsRestorePointApi {
        fn readiness(&mut self) -> Result<(), UnavailableReason> {
            if self.shutting_down {
                return Err(UnavailableReason::ShuttingDown);
            }
            if !self.com_initialized {
                return Err(UnavailableReason::ComNotInitialized);
            }
            if !self.com_callback_security_ready {
                return Err(UnavailableReason::ComCallbackSecurityMissing);
            }
            if self.library.is_none() {
                return Err(UnavailableReason::DllMissing);
            }
            if self.set_restore_point.is_none() {
                return Err(UnavailableReason::SymbolMissing);
            }
            Ok(())
        }

        fn begin(&mut self, description: &str) -> ApiCallEvidence {
            self.invoke(BEGIN_SYSTEM_CHANGE.0, 0, description)
        }

        fn end(&mut self, sequence_number: i64, description: &str) -> ApiCallEvidence {
            self.invoke(END_SYSTEM_CHANGE.0, sequence_number, description)
        }
    }

    impl Drop for WindowsRestorePointApi {
        fn drop(&mut self) {
            self.set_restore_point = None;
            if let Some(library) = self.library.take() {
                unsafe {
                    let _ = FreeLibrary(library);
                }
            }
        }
    }
}
