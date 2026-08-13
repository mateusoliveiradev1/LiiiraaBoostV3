//! Exact-state lifecycle for the single admitted managed power scheme.

pub const MANAGED_SCHEME_FRIENDLY_NAME: &str = "Liiiraa Verificado";
pub const MANAGED_SCHEME_DESCRIPTION: &str =
    "Liiiraa Boost managed clone; activation alone makes no performance claim.";

#[derive(Clone, Copy, Debug, Eq, Hash, PartialEq, Ord, PartialOrd)]
pub struct PowerSchemeId(u128);

impl PowerSchemeId {
    pub const fn from_journaled_u128(value: u128) -> Option<Self> {
        if value == 0 { None } else { Some(Self(value)) }
    }

    pub const fn as_u128(self) -> u128 {
        self.0
    }
}

#[derive(Clone, Debug, Eq, PartialEq)]
pub struct PowerSchemeSnapshot {
    pub id: PowerSchemeId,
    pub friendly_name: String,
    pub description: String,
    pub settings_fingerprint: String,
}

#[derive(Clone, Debug, Eq, PartialEq)]
pub struct VerifiedClientContext {
    session_id: u32,
    interactive_logon_sid: String,
}

impl VerifiedClientContext {
    pub fn establish(
        session_id: u32,
        interactive_logon_sid: impl Into<String>,
        impersonation_succeeded: bool,
        token_verified: bool,
    ) -> Result<Self, PowerSchemeError> {
        let interactive_logon_sid = interactive_logon_sid.into();
        if session_id == 0
            || interactive_logon_sid.trim().is_empty()
            || !impersonation_succeeded
            || !token_verified
        {
            return Err(PowerSchemeError::UnverifiedClientContext);
        }
        Ok(Self {
            session_id,
            interactive_logon_sid,
        })
    }

    pub const fn session_id(&self) -> u32 {
        self.session_id
    }

    pub fn interactive_logon_sid(&self) -> &str {
        &self.interactive_logon_sid
    }
}

#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub enum ConflictStage {
    ApplyPrecondition,
    DestinationOwnership,
    ApplyVerification,
    RestorePrecondition,
    PriorState,
    RestoreVerification,
    CleanupOwnership,
}

#[derive(Clone, Debug, Eq, PartialEq)]
pub struct StateConflict {
    pub stage: ConflictStage,
    pub expected: Option<PowerSchemeSnapshot>,
    pub observed: Option<PowerSchemeSnapshot>,
}

#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub enum PowerSchemeError {
    AccessDenied,
    AlreadyExists,
    NotFound,
    UnverifiedClientContext,
    Windows(u32),
}

#[derive(Clone, Debug, Eq, PartialEq)]
pub struct ApplyRequest {
    pub expected_prior: PowerSchemeSnapshot,
    pub journaled_destination: PowerSchemeId,
    pub known_owned_target: Option<PowerSchemeSnapshot>,
}

#[derive(Clone, Debug, Eq, PartialEq)]
pub struct ManagedPowerScheme {
    pub prior: PowerSchemeSnapshot,
    pub target: PowerSchemeSnapshot,
}

#[derive(Clone, Debug, Eq, PartialEq)]
pub enum ApplyOutcome {
    Applied(ManagedPowerScheme),
    AlreadyApplied(ManagedPowerScheme),
    Drift(StateConflict),
    Conflict(StateConflict),
}

#[derive(Clone, Debug, Eq, PartialEq)]
pub enum RestoreOutcome {
    Restored { target_deleted: bool },
    AlreadyRestored { target_deleted: bool },
    Conflict(Box<StateConflict>),
}

pub trait PowerSchemePort {
    fn preflight(&mut self, context: &VerifiedClientContext) -> Result<(), PowerSchemeError>;

    fn observe_active(
        &mut self,
        context: &VerifiedClientContext,
    ) -> Result<PowerSchemeSnapshot, PowerSchemeError>;

    fn observe_scheme(
        &mut self,
        context: &VerifiedClientContext,
        id: PowerSchemeId,
    ) -> Result<Option<PowerSchemeSnapshot>, PowerSchemeError>;

    fn duplicate_managed(
        &mut self,
        context: &VerifiedClientContext,
        source: PowerSchemeId,
        destination: PowerSchemeId,
    ) -> Result<(), PowerSchemeError>;

    fn activate_managed(
        &mut self,
        context: &VerifiedClientContext,
        id: PowerSchemeId,
    ) -> Result<(), PowerSchemeError>;

    fn delete_owned(
        &mut self,
        context: &VerifiedClientContext,
        id: PowerSchemeId,
    ) -> Result<(), PowerSchemeError>;
}

pub fn apply_managed_scheme(
    port: &mut impl PowerSchemePort,
    context: &VerifiedClientContext,
    request: ApplyRequest,
) -> Result<ApplyOutcome, PowerSchemeError> {
    port.preflight(context)?;
    let active = port.observe_active(context)?;

    if active.id == request.journaled_destination {
        return reconcile_applied_target(active, request);
    }
    if active != request.expected_prior {
        return Ok(ApplyOutcome::Drift(conflict(
            ConflictStage::ApplyPrecondition,
            Some(request.expected_prior),
            Some(active),
        )));
    }

    if let Some(existing) = port.observe_scheme(context, request.journaled_destination)? {
        return Ok(ApplyOutcome::Conflict(conflict(
            ConflictStage::DestinationOwnership,
            request.known_owned_target,
            Some(existing),
        )));
    }

    match port.duplicate_managed(
        context,
        request.expected_prior.id,
        request.journaled_destination,
    ) {
        Ok(()) => {}
        Err(PowerSchemeError::AlreadyExists) => {
            let observed = port.observe_scheme(context, request.journaled_destination)?;
            return Ok(ApplyOutcome::Conflict(conflict(
                ConflictStage::DestinationOwnership,
                request.known_owned_target,
                observed,
            )));
        }
        Err(error) => return Err(error),
    }

    let expected_target = expected_target(&request.expected_prior, request.journaled_destination);
    let created = port.observe_scheme(context, request.journaled_destination)?;
    if created.as_ref() != Some(&expected_target) {
        return Ok(ApplyOutcome::Conflict(conflict(
            ConflictStage::ApplyVerification,
            Some(expected_target),
            created,
        )));
    }

    port.activate_managed(context, request.journaled_destination)?;
    let observed_active = port.observe_active(context)?;
    if observed_active != expected_target {
        return Ok(ApplyOutcome::Conflict(conflict(
            ConflictStage::ApplyVerification,
            Some(expected_target),
            Some(observed_active),
        )));
    }

    Ok(ApplyOutcome::Applied(ManagedPowerScheme {
        prior: request.expected_prior,
        target: observed_active,
    }))
}

pub fn restore_managed_scheme(
    port: &mut impl PowerSchemePort,
    context: &VerifiedClientContext,
    managed: &ManagedPowerScheme,
) -> Result<RestoreOutcome, PowerSchemeError> {
    port.preflight(context)?;
    let active = port.observe_active(context)?;

    if active.id == managed.prior.id {
        if active != managed.prior {
            return Ok(RestoreOutcome::Conflict(Box::new(conflict(
                ConflictStage::PriorState,
                Some(managed.prior.clone()),
                Some(active),
            ))));
        }
        return cleanup_owned_target(port, context, managed, true);
    }

    if active.id != managed.target.id || active != managed.target {
        return Ok(RestoreOutcome::Conflict(Box::new(conflict(
            ConflictStage::RestorePrecondition,
            Some(managed.target.clone()),
            Some(active),
        ))));
    }

    let target = port.observe_scheme(context, managed.target.id)?;
    if target.as_ref() != Some(&managed.target) {
        return Ok(RestoreOutcome::Conflict(Box::new(conflict(
            ConflictStage::RestorePrecondition,
            Some(managed.target.clone()),
            target,
        ))));
    }

    let prior = port.observe_scheme(context, managed.prior.id)?;
    if prior.as_ref() != Some(&managed.prior) {
        return Ok(RestoreOutcome::Conflict(Box::new(conflict(
            ConflictStage::PriorState,
            Some(managed.prior.clone()),
            prior,
        ))));
    }

    port.activate_managed(context, managed.prior.id)?;
    let restored = port.observe_active(context)?;
    if restored != managed.prior {
        return Ok(RestoreOutcome::Conflict(Box::new(conflict(
            ConflictStage::RestoreVerification,
            Some(managed.prior.clone()),
            Some(restored),
        ))));
    }

    cleanup_owned_target(port, context, managed, false)
}

fn reconcile_applied_target(
    active: PowerSchemeSnapshot,
    request: ApplyRequest,
) -> Result<ApplyOutcome, PowerSchemeError> {
    let Some(known_target) = request.known_owned_target else {
        return Ok(ApplyOutcome::Conflict(conflict(
            ConflictStage::DestinationOwnership,
            None,
            Some(active),
        )));
    };
    if active != known_target {
        return Ok(ApplyOutcome::Conflict(conflict(
            ConflictStage::DestinationOwnership,
            Some(known_target),
            Some(active),
        )));
    }
    Ok(ApplyOutcome::AlreadyApplied(ManagedPowerScheme {
        prior: request.expected_prior,
        target: active,
    }))
}

fn cleanup_owned_target(
    port: &mut impl PowerSchemePort,
    context: &VerifiedClientContext,
    managed: &ManagedPowerScheme,
    already_restored: bool,
) -> Result<RestoreOutcome, PowerSchemeError> {
    let target = port.observe_scheme(context, managed.target.id)?;
    let target_deleted = match target {
        None => false,
        Some(observed) if observed == managed.target => {
            port.delete_owned(context, managed.target.id)?;
            true
        }
        Some(observed) => {
            return Ok(RestoreOutcome::Conflict(Box::new(conflict(
                ConflictStage::CleanupOwnership,
                Some(managed.target.clone()),
                Some(observed),
            ))));
        }
    };
    if already_restored {
        Ok(RestoreOutcome::AlreadyRestored { target_deleted })
    } else {
        Ok(RestoreOutcome::Restored { target_deleted })
    }
}

fn expected_target(prior: &PowerSchemeSnapshot, id: PowerSchemeId) -> PowerSchemeSnapshot {
    PowerSchemeSnapshot {
        id,
        friendly_name: MANAGED_SCHEME_FRIENDLY_NAME.to_owned(),
        description: MANAGED_SCHEME_DESCRIPTION.to_owned(),
        settings_fingerprint: prior.settings_fingerprint.clone(),
    }
}

fn conflict(
    stage: ConflictStage,
    expected: Option<PowerSchemeSnapshot>,
    observed: Option<PowerSchemeSnapshot>,
) -> StateConflict {
    StateConflict {
        stage,
        expected,
        observed,
    }
}

#[cfg(windows)]
pub mod windows_adapter {
    use std::{mem::size_of, ptr};

    use sha2::{Digest, Sha256};
    use windows::{
        Win32::{
            Foundation::{
                ERROR_ACCESS_DENIED, ERROR_ALREADY_EXISTS, ERROR_FILE_NOT_FOUND, ERROR_MORE_DATA,
                ERROR_NO_MORE_ITEMS, ERROR_SUCCESS, HLOCAL, LocalFree, WIN32_ERROR,
            },
            System::{
                Power::{
                    ACCESS_INDIVIDUAL_SETTING, ACCESS_SCHEME, ACCESS_SUBGROUP, PowerDeleteScheme,
                    PowerDuplicateScheme, PowerEnumerate, PowerGetActiveScheme,
                    PowerReadACValueIndex, PowerReadDCValueIndex, PowerReadDescription,
                    PowerReadFriendlyName, PowerSetActiveScheme, PowerSettingAccessCheckEx,
                    PowerWriteDescription, PowerWriteFriendlyName,
                },
                Registry::KEY_WRITE,
            },
        },
        core::GUID,
    };

    use super::{
        MANAGED_SCHEME_DESCRIPTION, MANAGED_SCHEME_FRIENDLY_NAME, PowerSchemeError, PowerSchemeId,
        PowerSchemePort, PowerSchemeSnapshot, VerifiedClientContext,
    };

    #[derive(Default)]
    pub struct WindowsPowrProf;

    impl PowerSchemePort for WindowsPowrProf {
        fn preflight(&mut self, context: &VerifiedClientContext) -> Result<(), PowerSchemeError> {
            require_verified_context(context)?;
            let status = unsafe { PowerSettingAccessCheckEx(ACCESS_SCHEME, None, KEY_WRITE) };
            status_result(status)
        }

        fn observe_active(
            &mut self,
            context: &VerifiedClientContext,
        ) -> Result<PowerSchemeSnapshot, PowerSchemeError> {
            require_verified_context(context)?;
            let mut allocated: *mut GUID = ptr::null_mut();
            let status = unsafe { PowerGetActiveScheme(None, &mut allocated) };
            status_result(status)?;
            if allocated.is_null() {
                return Err(PowerSchemeError::Windows(13));
            }
            let guid = unsafe { *allocated };
            unsafe {
                let _ = LocalFree(Some(HLOCAL(allocated.cast())));
            }
            observe_exact(PowerSchemeId(guid.to_u128()))?.ok_or(PowerSchemeError::NotFound)
        }

        fn observe_scheme(
            &mut self,
            context: &VerifiedClientContext,
            id: PowerSchemeId,
        ) -> Result<Option<PowerSchemeSnapshot>, PowerSchemeError> {
            require_verified_context(context)?;
            observe_exact(id)
        }

        fn duplicate_managed(
            &mut self,
            context: &VerifiedClientContext,
            source: PowerSchemeId,
            destination: PowerSchemeId,
        ) -> Result<(), PowerSchemeError> {
            require_verified_context(context)?;
            let source = guid(source);
            let mut destination_guid = guid(destination);
            let original_pointer = &mut destination_guid as *mut GUID;
            let mut destination_pointer = original_pointer;
            let status = unsafe { PowerDuplicateScheme(None, &source, &mut destination_pointer) };
            status_result(status)?;
            if destination_pointer != original_pointer
                || destination_guid.to_u128() != destination.as_u128()
            {
                return Err(PowerSchemeError::Windows(13));
            }
            let name = utf16_bytes(MANAGED_SCHEME_FRIENDLY_NAME);
            status_result(unsafe {
                PowerWriteFriendlyName(None, &destination_guid, None, None, &name)
            })?;
            let description = utf16_bytes(MANAGED_SCHEME_DESCRIPTION);
            status_result(unsafe {
                PowerWriteDescription(None, &destination_guid, None, None, &description)
            })
        }

        fn activate_managed(
            &mut self,
            context: &VerifiedClientContext,
            id: PowerSchemeId,
        ) -> Result<(), PowerSchemeError> {
            require_verified_context(context)?;
            let id = guid(id);
            status_result(unsafe { PowerSetActiveScheme(None, Some(&id)) })
        }

        fn delete_owned(
            &mut self,
            context: &VerifiedClientContext,
            id: PowerSchemeId,
        ) -> Result<(), PowerSchemeError> {
            require_verified_context(context)?;
            let id = guid(id);
            status_result(unsafe { PowerDeleteScheme(None, &id) })
        }
    }

    fn require_verified_context(context: &VerifiedClientContext) -> Result<(), PowerSchemeError> {
        if context.session_id() == 0 || context.interactive_logon_sid().trim().is_empty() {
            Err(PowerSchemeError::UnverifiedClientContext)
        } else {
            Ok(())
        }
    }

    fn observe_exact(id: PowerSchemeId) -> Result<Option<PowerSchemeSnapshot>, PowerSchemeError> {
        let guid = guid(id);
        let Some(friendly_name) = read_text(&guid, TextField::FriendlyName)? else {
            return Ok(None);
        };
        let description = read_text(&guid, TextField::Description)?.unwrap_or_default();
        let settings_fingerprint = settings_fingerprint(&guid)?;
        Ok(Some(PowerSchemeSnapshot {
            id,
            friendly_name,
            description,
            settings_fingerprint,
        }))
    }

    #[derive(Clone, Copy)]
    enum TextField {
        FriendlyName,
        Description,
    }

    fn read_text(id: &GUID, field: TextField) -> Result<Option<String>, PowerSchemeError> {
        let mut bytes = 0_u32;
        let read = |buffer: Option<*mut u8>, size: &mut u32| unsafe {
            match field {
                TextField::FriendlyName => {
                    PowerReadFriendlyName(None, Some(id), None, None, buffer, size)
                }
                TextField::Description => {
                    PowerReadDescription(None, Some(id), None, None, buffer, size)
                }
            }
        };
        let query = read(None, &mut bytes);
        if query == ERROR_FILE_NOT_FOUND {
            return Ok(None);
        }
        if query != ERROR_MORE_DATA && query != ERROR_SUCCESS {
            return Err(map_status(query));
        }
        if bytes == 0 {
            return Ok(Some(String::new()));
        }
        let mut buffer = vec![0_u8; bytes as usize];
        status_result(read(Some(buffer.as_mut_ptr()), &mut bytes))?;
        buffer.truncate(bytes as usize);
        if !buffer.len().is_multiple_of(2) {
            return Err(PowerSchemeError::Windows(13));
        }
        let units = buffer
            .chunks_exact(2)
            .map(|bytes| u16::from_le_bytes([bytes[0], bytes[1]]))
            .take_while(|unit| *unit != 0)
            .collect::<Vec<_>>();
        String::from_utf16(&units)
            .map(Some)
            .map_err(|_| PowerSchemeError::Windows(13))
    }

    fn settings_fingerprint(scheme: &GUID) -> Result<String, PowerSchemeError> {
        let mut entries = Vec::new();
        for subgroup in enumerate_guids(Some(scheme), None, ACCESS_SUBGROUP)? {
            for setting in
                enumerate_guids(Some(scheme), Some(&subgroup), ACCESS_INDIVIDUAL_SETTING)?
            {
                let mut ac = 0_u32;
                status_result(unsafe {
                    PowerReadACValueIndex(
                        None,
                        Some(scheme),
                        Some(&subgroup),
                        Some(&setting),
                        &mut ac,
                    )
                })?;
                let mut dc = 0_u32;
                status_result(WIN32_ERROR(unsafe {
                    PowerReadDCValueIndex(
                        None,
                        Some(scheme),
                        Some(&subgroup),
                        Some(&setting),
                        &mut dc,
                    )
                }))?;
                entries.push((subgroup.to_u128(), setting.to_u128(), ac, dc));
            }
        }
        entries.sort_unstable();
        let mut hasher = Sha256::new();
        hasher.update(b"liiiraa-power-scheme-settings-v1\0");
        for (subgroup, setting, ac, dc) in entries {
            hasher.update(subgroup.to_be_bytes());
            hasher.update(setting.to_be_bytes());
            hasher.update(ac.to_be_bytes());
            hasher.update(dc.to_be_bytes());
        }
        Ok(format!("sha256:{:x}", hasher.finalize()))
    }

    fn enumerate_guids(
        scheme: Option<&GUID>,
        subgroup: Option<&GUID>,
        accessor: windows::Win32::System::Power::POWER_DATA_ACCESSOR,
    ) -> Result<Vec<GUID>, PowerSchemeError> {
        let mut result = Vec::new();
        for index in 0_u32.. {
            let mut bytes = size_of::<GUID>() as u32;
            let mut buffer = [0_u8; size_of::<GUID>()];
            let status = unsafe {
                PowerEnumerate(
                    None,
                    scheme.map(|value| value as *const GUID),
                    subgroup.map(|value| value as *const GUID),
                    accessor,
                    index,
                    Some(buffer.as_mut_ptr()),
                    &mut bytes,
                )
            };
            if status == ERROR_NO_MORE_ITEMS {
                break;
            }
            status_result(status)?;
            if bytes as usize != size_of::<GUID>() {
                return Err(PowerSchemeError::Windows(13));
            }
            result.push(unsafe { ptr::read_unaligned(buffer.as_ptr().cast::<GUID>()) });
        }
        Ok(result)
    }

    fn utf16_bytes(value: &str) -> Vec<u8> {
        value
            .encode_utf16()
            .chain(Some(0))
            .flat_map(u16::to_le_bytes)
            .collect()
    }

    const fn guid(id: PowerSchemeId) -> GUID {
        GUID::from_u128(id.as_u128())
    }

    fn status_result(status: WIN32_ERROR) -> Result<(), PowerSchemeError> {
        if status == ERROR_SUCCESS {
            Ok(())
        } else {
            Err(map_status(status))
        }
    }

    fn map_status(status: WIN32_ERROR) -> PowerSchemeError {
        match status {
            ERROR_ACCESS_DENIED => PowerSchemeError::AccessDenied,
            ERROR_ALREADY_EXISTS => PowerSchemeError::AlreadyExists,
            ERROR_FILE_NOT_FOUND => PowerSchemeError::NotFound,
            other => PowerSchemeError::Windows(other.0),
        }
    }
}
