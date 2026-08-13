#[path = "../src/operations/mod.rs"]
mod operations;

use std::collections::{HashMap, VecDeque};

use operations::{
    PowerOperation,
    power_scheme::{
        ApplyOutcome, ApplyRequest, ConflictStage, MANAGED_SCHEME_DESCRIPTION,
        MANAGED_SCHEME_FRIENDLY_NAME, ManagedPowerScheme, PowerSchemeError, PowerSchemeId,
        PowerSchemePort, PowerSchemeSnapshot, RestoreOutcome, VerifiedClientContext,
        apply_managed_scheme, restore_managed_scheme,
    },
};

#[derive(Clone, Debug, Eq, PartialEq)]
enum Call {
    Preflight(u32, String),
    ObserveActive,
    Observe(PowerSchemeId),
    Duplicate(PowerSchemeId, PowerSchemeId),
    Activate(PowerSchemeId),
    Delete(PowerSchemeId),
}

struct FakePowrProf {
    active: PowerSchemeId,
    schemes: HashMap<PowerSchemeId, PowerSchemeSnapshot>,
    scripted_observations: HashMap<PowerSchemeId, VecDeque<Option<PowerSchemeSnapshot>>>,
    calls: Vec<Call>,
    preflight_error: Option<PowerSchemeError>,
    duplicate_error: Option<PowerSchemeError>,
    activate_error: Option<PowerSchemeError>,
    delete_error: Option<PowerSchemeError>,
}

impl FakePowrProf {
    fn with_prior(prior: PowerSchemeSnapshot) -> Self {
        Self {
            active: prior.id,
            schemes: HashMap::from([(prior.id, prior)]),
            scripted_observations: HashMap::new(),
            calls: Vec::new(),
            preflight_error: None,
            duplicate_error: None,
            activate_error: None,
            delete_error: None,
        }
    }

    fn script_scheme(
        &mut self,
        id: PowerSchemeId,
        observations: impl IntoIterator<Item = Option<PowerSchemeSnapshot>>,
    ) {
        self.scripted_observations
            .insert(id, observations.into_iter().collect());
    }
}

impl PowerSchemePort for FakePowrProf {
    fn preflight(&mut self, context: &VerifiedClientContext) -> Result<(), PowerSchemeError> {
        self.calls.push(Call::Preflight(
            context.session_id(),
            context.interactive_logon_sid().to_owned(),
        ));
        self.preflight_error.map_or(Ok(()), Err)
    }

    fn observe_active(
        &mut self,
        _context: &VerifiedClientContext,
    ) -> Result<PowerSchemeSnapshot, PowerSchemeError> {
        self.calls.push(Call::ObserveActive);
        self.schemes
            .get(&self.active)
            .cloned()
            .ok_or(PowerSchemeError::NotFound)
    }

    fn observe_scheme(
        &mut self,
        _context: &VerifiedClientContext,
        id: PowerSchemeId,
    ) -> Result<Option<PowerSchemeSnapshot>, PowerSchemeError> {
        self.calls.push(Call::Observe(id));
        if let Some(script) = self.scripted_observations.get_mut(&id)
            && let Some(observation) = script.pop_front()
        {
            return Ok(observation);
        }
        Ok(self.schemes.get(&id).cloned())
    }

    fn duplicate_managed(
        &mut self,
        _context: &VerifiedClientContext,
        source: PowerSchemeId,
        destination: PowerSchemeId,
    ) -> Result<(), PowerSchemeError> {
        self.calls.push(Call::Duplicate(source, destination));
        if let Some(error) = self.duplicate_error {
            return Err(error);
        }
        if self.schemes.contains_key(&destination) {
            return Err(PowerSchemeError::AlreadyExists);
        }
        let source = self
            .schemes
            .get(&source)
            .cloned()
            .ok_or(PowerSchemeError::NotFound)?;
        self.schemes.insert(
            destination,
            PowerSchemeSnapshot {
                id: destination,
                friendly_name: MANAGED_SCHEME_FRIENDLY_NAME.to_owned(),
                description: MANAGED_SCHEME_DESCRIPTION.to_owned(),
                settings_fingerprint: source.settings_fingerprint,
            },
        );
        Ok(())
    }

    fn activate_managed(
        &mut self,
        _context: &VerifiedClientContext,
        id: PowerSchemeId,
    ) -> Result<(), PowerSchemeError> {
        self.calls.push(Call::Activate(id));
        if let Some(error) = self.activate_error {
            return Err(error);
        }
        if !self.schemes.contains_key(&id) {
            return Err(PowerSchemeError::NotFound);
        }
        self.active = id;
        Ok(())
    }

    fn delete_owned(
        &mut self,
        _context: &VerifiedClientContext,
        id: PowerSchemeId,
    ) -> Result<(), PowerSchemeError> {
        self.calls.push(Call::Delete(id));
        if let Some(error) = self.delete_error {
            return Err(error);
        }
        self.schemes.remove(&id).ok_or(PowerSchemeError::NotFound)?;
        Ok(())
    }
}

fn id(value: u128) -> PowerSchemeId {
    PowerSchemeId::from_journaled_u128(value).expect("nonzero test GUID")
}

fn snapshot(value: u128, name: &str, fingerprint: &str) -> PowerSchemeSnapshot {
    PowerSchemeSnapshot {
        id: id(value),
        friendly_name: name.to_owned(),
        description: format!("{name} description"),
        settings_fingerprint: fingerprint.to_owned(),
    }
}

fn context() -> VerifiedClientContext {
    VerifiedClientContext::establish(7, "S-1-5-5-7-42", true, true)
        .expect("verified interactive broker client")
}

fn first_apply(prior: PowerSchemeSnapshot, destination: PowerSchemeId) -> ApplyRequest {
    ApplyRequest {
        expected_prior: prior,
        journaled_destination: destination,
        known_owned_target: None,
    }
}

fn applied_record(prior: PowerSchemeSnapshot, target_id: PowerSchemeId) -> ManagedPowerScheme {
    ManagedPowerScheme {
        target: PowerSchemeSnapshot {
            id: target_id,
            friendly_name: MANAGED_SCHEME_FRIENDLY_NAME.to_owned(),
            description: MANAGED_SCHEME_DESCRIPTION.to_owned(),
            settings_fingerprint: prior.settings_fingerprint.clone(),
        },
        prior,
    }
}

#[test]
fn registry_is_closed_to_the_four_named_power_operations() {
    assert_eq!(
        PowerOperation::ALL,
        [
            PowerOperation::Observe,
            PowerOperation::DuplicateManaged,
            PowerOperation::ActivateManaged,
            PowerOperation::DeleteOwned,
        ]
    );
    assert_eq!(
        MANAGED_SCHEME_FRIENDLY_NAME
            .encode_utf16()
            .collect::<Vec<_>>(),
        [
            76, 105, 105, 105, 114, 97, 97, 32, 86, 101, 114, 105, 102, 105, 99, 97, 100, 111,
        ]
    );
}

#[test]
fn verified_client_context_is_mandatory_and_access_denial_prevents_observation() {
    for invalid in [
        VerifiedClientContext::establish(0, "S-1-5-5-7-42", true, true),
        VerifiedClientContext::establish(7, "", true, true),
        VerifiedClientContext::establish(7, "S-1-5-5-7-42", false, true),
        VerifiedClientContext::establish(7, "S-1-5-5-7-42", true, false),
    ] {
        assert_eq!(invalid, Err(PowerSchemeError::UnverifiedClientContext));
    }

    let prior = snapshot(1, "Balanced", "settings-a");
    let mut port = FakePowrProf::with_prior(prior.clone());
    port.preflight_error = Some(PowerSchemeError::AccessDenied);
    assert_eq!(
        apply_managed_scheme(&mut port, &context(), first_apply(prior, id(2))),
        Err(PowerSchemeError::AccessDenied)
    );
    assert_eq!(port.calls.len(), 1);
}

#[test]
fn apply_observes_duplicates_names_verifies_activates_and_reobserves_exact_guid() {
    let prior = snapshot(1, "Balanced", "settings-a");
    let target_id = id(2);
    let mut port = FakePowrProf::with_prior(prior.clone());

    let outcome =
        apply_managed_scheme(&mut port, &context(), first_apply(prior.clone(), target_id))
            .expect("apply succeeds");
    assert_eq!(
        outcome,
        ApplyOutcome::Applied(applied_record(prior.clone(), target_id))
    );
    assert_eq!(port.active, target_id);
    assert_eq!(port.schemes.get(&prior.id), Some(&prior));
    assert_eq!(
        port.calls,
        vec![
            Call::Preflight(7, "S-1-5-5-7-42".into()),
            Call::ObserveActive,
            Call::Observe(target_id),
            Call::Duplicate(prior.id, target_id),
            Call::Observe(target_id),
            Call::Activate(target_id),
            Call::ObserveActive,
        ]
    );
}

#[test]
fn apply_refuses_prior_drift_and_an_unowned_duplicate_destination() {
    let prior = snapshot(1, "Balanced", "settings-a");
    let drifted = snapshot(3, "External", "settings-external");
    let target = snapshot(2, MANAGED_SCHEME_FRIENDLY_NAME, "settings-a");
    let mut drift_port = FakePowrProf::with_prior(drifted.clone());
    let drift = apply_managed_scheme(
        &mut drift_port,
        &context(),
        first_apply(prior.clone(), target.id),
    )
    .expect("drift is a closed result");
    assert!(matches!(
        drift,
        ApplyOutcome::Drift(ref conflict)
            if conflict.stage == ConflictStage::ApplyPrecondition
                && conflict.observed.as_ref() == Some(&drifted)
    ));
    assert!(
        !drift_port
            .calls
            .iter()
            .any(|call| matches!(call, Call::Duplicate(..)))
    );

    let mut duplicate_port = FakePowrProf::with_prior(prior.clone());
    duplicate_port.schemes.insert(target.id, target.clone());
    let conflict = apply_managed_scheme(
        &mut duplicate_port,
        &context(),
        first_apply(prior, target.id),
    )
    .expect("unowned duplicate is a conflict");
    assert!(matches!(
        conflict,
        ApplyOutcome::Conflict(ref evidence)
            if evidence.stage == ConflictStage::DestinationOwnership
                && evidence.observed.as_ref() == Some(&target)
    ));
    assert!(
        !duplicate_port
            .calls
            .iter()
            .any(|call| matches!(call, Call::Activate(..)))
    );
}

#[test]
fn exact_known_target_reconciles_as_already_applied_without_mutation() {
    let prior = snapshot(1, "Balanced", "settings-a");
    let record = applied_record(prior.clone(), id(2));
    let mut port = FakePowrProf::with_prior(prior.clone());
    port.schemes.insert(record.target.id, record.target.clone());
    port.active = record.target.id;

    let outcome = apply_managed_scheme(
        &mut port,
        &context(),
        ApplyRequest {
            expected_prior: prior,
            journaled_destination: record.target.id,
            known_owned_target: Some(record.target.clone()),
        },
    )
    .expect("already applied reconciles");
    assert_eq!(outcome, ApplyOutcome::AlreadyApplied(record));
    assert!(
        !port
            .calls
            .iter()
            .any(|call| matches!(call, Call::Duplicate(..) | Call::Activate(..)))
    );
}

#[test]
fn restore_reactivates_the_exact_prior_then_deletes_only_the_unchanged_owned_target() {
    let prior = snapshot(1, "Balanced", "settings-a");
    let record = applied_record(prior.clone(), id(2));
    let mut port = FakePowrProf::with_prior(prior.clone());
    port.schemes.insert(record.target.id, record.target.clone());
    port.active = record.target.id;

    assert_eq!(
        restore_managed_scheme(&mut port, &context(), &record),
        Ok(RestoreOutcome::Restored {
            target_deleted: true,
        })
    );
    assert_eq!(port.active, prior.id);
    assert_eq!(port.schemes.get(&prior.id), Some(&prior));
    assert!(!port.schemes.contains_key(&record.target.id));
    assert_eq!(port.calls.last(), Some(&Call::Delete(record.target.id)));
}

#[test]
fn restore_reconciles_an_exact_prior_as_already_restored() {
    let prior = snapshot(1, "Balanced", "settings-a");
    let record = applied_record(prior.clone(), id(2));
    let mut absent = FakePowrProf::with_prior(prior.clone());
    assert_eq!(
        restore_managed_scheme(&mut absent, &context(), &record),
        Ok(RestoreOutcome::AlreadyRestored {
            target_deleted: false,
        })
    );

    let mut owned = FakePowrProf::with_prior(prior);
    owned
        .schemes
        .insert(record.target.id, record.target.clone());
    assert_eq!(
        restore_managed_scheme(&mut owned, &context(), &record),
        Ok(RestoreOutcome::AlreadyRestored {
            target_deleted: true,
        })
    );
}

#[test]
fn restore_pauses_on_third_state_or_changed_prior_without_mutation() {
    let prior = snapshot(1, "Balanced", "settings-a");
    let record = applied_record(prior.clone(), id(2));
    let third = snapshot(3, "External", "settings-third");
    let mut third_port = FakePowrProf::with_prior(third.clone());
    third_port
        .schemes
        .insert(record.target.id, record.target.clone());
    assert!(matches!(
        restore_managed_scheme(&mut third_port, &context(), &record),
        Ok(RestoreOutcome::Conflict(ref evidence))
            if evidence.stage == ConflictStage::RestorePrecondition
                && evidence.observed.as_ref() == Some(&third)
    ));

    let changed_prior = snapshot(1, "Balanced edited", "settings-external");
    let mut changed_prior_port = FakePowrProf::with_prior(changed_prior.clone());
    changed_prior_port
        .schemes
        .insert(record.target.id, record.target.clone());
    changed_prior_port.active = record.target.id;
    assert!(matches!(
        restore_managed_scheme(&mut changed_prior_port, &context(), &record),
        Ok(RestoreOutcome::Conflict(ref evidence))
            if evidence.stage == ConflictStage::PriorState
                && evidence.observed.as_ref() == Some(&changed_prior)
    ));
    assert!(
        !changed_prior_port
            .calls
            .iter()
            .any(|call| matches!(call, Call::Activate(..) | Call::Delete(..)))
    );
}

#[test]
fn cleanup_never_deletes_a_target_changed_after_restore() {
    let prior = snapshot(1, "Balanced", "settings-a");
    let record = applied_record(prior.clone(), id(2));
    let changed_target = snapshot(2, "Externally edited", "settings-external");
    let mut port = FakePowrProf::with_prior(prior);
    port.schemes.insert(record.target.id, record.target.clone());
    port.active = record.target.id;
    port.script_scheme(
        record.target.id,
        [Some(record.target.clone()), Some(changed_target.clone())],
    );

    assert!(matches!(
        restore_managed_scheme(&mut port, &context(), &record),
        Ok(RestoreOutcome::Conflict(ref evidence))
            if evidence.stage == ConflictStage::CleanupOwnership
                && evidence.observed.as_ref() == Some(&changed_target)
    ));
    assert_eq!(port.active, record.prior.id);
    assert!(
        !port
            .calls
            .iter()
            .any(|call| matches!(call, Call::Delete(..)))
    );
}

#[test]
fn adapter_source_exposes_no_shell_registry_or_generic_mutation_authority() {
    let source = include_str!("../src/operations/power_scheme.rs").to_ascii_lowercase();
    for forbidden in [
        "powercfg",
        "powershell",
        "std::process",
        "command::",
        "regsetvalue",
        "regdelete",
        "genericoperation",
        "extreme",
        "performance gain",
    ] {
        assert!(
            !source.contains(forbidden),
            "forbidden authority: {forbidden}"
        );
    }
}
