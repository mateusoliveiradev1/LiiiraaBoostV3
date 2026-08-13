#[path = "../src/restore_point.rs"]
mod restore_point;

use restore_point::{
    Admission, ApiCallEvidence, ComplementaryState, ERROR_ACCESS_DENIED,
    ERROR_ACCESS_DISABLED_BY_POLICY, ERROR_NOT_SAFEBOOT_SERVICE, ERROR_SERVICE_DISABLED,
    ERROR_SUCCESS, FailureEvidence, FailureStage, PointObservation, PreparationRequest,
    RestorePointApi, RestorePointObserver, RiskClass, SR_SET_RESTORE_POINT_W_SYMBOL, SRCLIENT_DLL,
    UnavailableReason, prepare_restore_point,
};

#[derive(Clone)]
struct ScriptedApi {
    readiness: Result<(), UnavailableReason>,
    begin: ApiCallEvidence,
    end: ApiCallEvidence,
    calls: Vec<Call>,
}

#[derive(Clone, Debug, Eq, PartialEq)]
enum Call {
    Readiness,
    Begin(String),
    End(i64, String),
}

impl ScriptedApi {
    fn successful(sequence_number: i64) -> Self {
        Self {
            readiness: Ok(()),
            begin: evidence(true, ERROR_SUCCESS, sequence_number),
            end: evidence(true, ERROR_SUCCESS, sequence_number),
            calls: Vec::new(),
        }
    }
}

impl RestorePointApi for ScriptedApi {
    fn readiness(&mut self) -> Result<(), UnavailableReason> {
        self.calls.push(Call::Readiness);
        self.readiness
    }

    fn begin(&mut self, description: &str) -> ApiCallEvidence {
        self.calls.push(Call::Begin(description.to_owned()));
        self.begin
    }

    fn end(&mut self, sequence_number: i64, description: &str) -> ApiCallEvidence {
        self.calls
            .push(Call::End(sequence_number, description.to_owned()));
        self.end
    }
}

struct ScriptedObserver {
    observation: PointObservation,
    sequences: Vec<i64>,
}

impl ScriptedObserver {
    fn new(observation: PointObservation) -> Self {
        Self {
            observation,
            sequences: Vec::new(),
        }
    }
}

impl RestorePointObserver for ScriptedObserver {
    fn observe(&mut self, sequence_number: i64) -> PointObservation {
        self.sequences.push(sequence_number);
        self.observation
    }
}

fn evidence(returned: bool, status: u32, sequence_number: i64) -> ApiCallEvidence {
    ApiCallEvidence {
        returned,
        status,
        sequence_number,
    }
}

fn request(risk: RiskClass) -> PreparationRequest<'static> {
    PreparationRequest {
        description: "Liiiraa Boost - before transactional optimization",
        risk,
        primary_manifest_ready: true,
        advanced_without_complement_acknowledged: false,
    }
}

#[test]
fn fixes_the_dynamic_boundary_to_srclient_and_srsetrestorepointw() {
    assert_eq!(SRCLIENT_DLL, "SrClient.dll");
    assert_eq!(SR_SET_RESTORE_POINT_W_SYMBOL, b"SRSetRestorePointW\0");

    let source = include_str!("../src/restore_point.rs").to_ascii_lowercase();
    for forbidden in [
        "powershell",
        "winmgmts",
        "systemrestorepointcreationfrequency",
        "regsetvalue",
    ] {
        assert!(
            !source.contains(forbidden),
            "forbidden fallback: {forbidden}"
        );
    }
    assert!(source.contains("loadlibraryexw"));
    assert!(source.contains("load_library_search_system32"));
    assert!(source.contains("freelibrary"));
    assert!(source.contains("couninitialize"));
}

#[test]
fn submits_begin_then_end_with_the_exact_sequence_and_observes_usability() {
    let mut api = ScriptedApi::successful(41);
    let mut observer = ScriptedObserver::new(PointObservation::Usable {
        sequence_number: 41,
    });

    let projection =
        prepare_restore_point(&mut api, &mut observer, request(RiskClass::Experimental));

    assert_eq!(
        api.calls,
        vec![
            Call::Readiness,
            Call::Begin("Liiiraa Boost - before transactional optimization".into()),
            Call::End(
                41,
                "Liiiraa Boost - before transactional optimization".into()
            ),
        ]
    );
    assert_eq!(observer.sequences, vec![41]);
    assert_eq!(projection.begin, Some(evidence(true, 0, 41)));
    assert_eq!(projection.end, Some(evidence(true, 0, 41)));
    assert_eq!(
        projection.observation,
        Some(PointObservation::Usable {
            sequence_number: 41
        })
    );
    assert_eq!(
        projection.state,
        ComplementaryState::Usable {
            sequence_number: 41
        }
    );
    assert_eq!(projection.admission, Admission::Allowed);
}

#[test]
fn never_turns_boolean_api_success_into_unobserved_usable_evidence() {
    let mut api = ScriptedApi::successful(71);
    let mut observer = ScriptedObserver::new(PointObservation::NotCreated);

    let projection =
        prepare_restore_point(&mut api, &mut observer, request(RiskClass::Experimental));

    assert_eq!(projection.begin, Some(evidence(true, 0, 71)));
    assert_eq!(projection.end, Some(evidence(true, 0, 71)));
    assert_eq!(projection.observation, Some(PointObservation::NotCreated));
    assert_eq!(projection.state, ComplementaryState::NotCreated);
    assert_eq!(projection.admission, Admission::Blocked);
}

#[test]
fn reports_frequency_reuse_without_claiming_a_new_point() {
    let mut api = ScriptedApi::successful(19);
    let mut observer = ScriptedObserver::new(PointObservation::ExistingRecent {
        sequence_number: 19,
    });

    let projection =
        prepare_restore_point(&mut api, &mut observer, request(RiskClass::Experimental));

    assert_eq!(
        projection.state,
        ComplementaryState::SkippedFrequency {
            sequence_number: 19
        }
    );
    assert_eq!(projection.admission, Admission::Blocked);
}

#[test]
fn maps_preflight_unavailability_without_calling_the_api() {
    for reason in [
        UnavailableReason::ComNotInitialized,
        UnavailableReason::ComCallbackSecurityMissing,
        UnavailableReason::DllMissing,
        UnavailableReason::SymbolMissing,
        UnavailableReason::ShuttingDown,
    ] {
        let mut api = ScriptedApi {
            readiness: Err(reason),
            ..ScriptedApi::successful(5)
        };
        let mut observer = ScriptedObserver::new(PointObservation::NotCreated);

        let projection =
            prepare_restore_point(&mut api, &mut observer, request(RiskClass::Advanced));

        assert_eq!(api.calls, vec![Call::Readiness]);
        assert!(observer.sequences.is_empty());
        assert_eq!(projection.state, ComplementaryState::Unavailable(reason));
        assert!(projection.primary_manifest_preserved);
    }
}

#[test]
fn maps_documented_begin_failures_and_never_attempts_end() {
    for (status, reason) in [
        (ERROR_SERVICE_DISABLED, UnavailableReason::Disabled),
        (ERROR_NOT_SAFEBOOT_SERVICE, UnavailableReason::SafeMode),
        (
            ERROR_ACCESS_DISABLED_BY_POLICY,
            UnavailableReason::PolicyDenied,
        ),
        (ERROR_ACCESS_DENIED, UnavailableReason::AccessDenied),
    ] {
        let mut api = ScriptedApi {
            begin: evidence(false, status, 0),
            ..ScriptedApi::successful(7)
        };
        let mut observer = ScriptedObserver::new(PointObservation::NotCreated);

        let projection =
            prepare_restore_point(&mut api, &mut observer, request(RiskClass::Advanced));

        assert_eq!(api.calls.len(), 2);
        assert!(matches!(api.calls[1], Call::Begin(_)));
        assert!(observer.sequences.is_empty());
        assert_eq!(projection.begin, Some(evidence(false, status, 0)));
        assert_eq!(projection.state, ComplementaryState::Unavailable(reason));
        assert!(projection.primary_manifest_preserved);
    }
}

#[test]
fn records_begin_and_end_failures_without_observing_or_discarding_manifest_recovery() {
    let mut begin_api = ScriptedApi {
        begin: evidence(false, 87, 0),
        ..ScriptedApi::successful(17)
    };
    let mut begin_observer = ScriptedObserver::new(PointObservation::NotCreated);
    let begin_projection = prepare_restore_point(
        &mut begin_api,
        &mut begin_observer,
        request(RiskClass::Advanced),
    );
    assert_eq!(
        begin_projection.state,
        ComplementaryState::Failed(FailureEvidence {
            stage: FailureStage::Begin,
            status: Some(87),
        })
    );
    assert!(begin_projection.primary_manifest_preserved);

    let mut end_api = ScriptedApi {
        end: evidence(false, 112, 17),
        ..ScriptedApi::successful(17)
    };
    let mut end_observer = ScriptedObserver::new(PointObservation::Usable {
        sequence_number: 17,
    });
    let end_projection = prepare_restore_point(
        &mut end_api,
        &mut end_observer,
        request(RiskClass::Advanced),
    );
    assert_eq!(
        end_projection.state,
        ComplementaryState::Failed(FailureEvidence {
            stage: FailureStage::End,
            status: Some(112),
        })
    );
    assert!(end_observer.sequences.is_empty());
    assert!(end_projection.primary_manifest_preserved);
}

#[test]
fn rejects_partial_end_and_mismatched_observation_sequences() {
    let mut partial_end_api = ScriptedApi {
        end: evidence(true, ERROR_SUCCESS, 0),
        ..ScriptedApi::successful(52)
    };
    let mut observer = ScriptedObserver::new(PointObservation::Usable {
        sequence_number: 52,
    });
    let partial_end = prepare_restore_point(
        &mut partial_end_api,
        &mut observer,
        request(RiskClass::Experimental),
    );
    assert_eq!(
        partial_end.state,
        ComplementaryState::Failed(FailureEvidence {
            stage: FailureStage::End,
            status: Some(ERROR_SUCCESS),
        })
    );
    assert!(observer.sequences.is_empty());

    let mut mismatched_api = ScriptedApi::successful(52);
    let mut mismatched_observer = ScriptedObserver::new(PointObservation::Usable {
        sequence_number: 51,
    });
    let mismatched = prepare_restore_point(
        &mut mismatched_api,
        &mut mismatched_observer,
        request(RiskClass::Experimental),
    );
    assert_eq!(mismatched.state, ComplementaryState::NotCreated);
    assert_eq!(mismatched.admission, Admission::Blocked);
}

#[test]
fn preserves_explicit_observation_unavailability_and_failure() {
    let mut unavailable_api = ScriptedApi::successful(83);
    let mut unavailable_observer = ScriptedObserver::new(PointObservation::Unavailable(
        UnavailableReason::PolicyDenied,
    ));
    let unavailable = prepare_restore_point(
        &mut unavailable_api,
        &mut unavailable_observer,
        request(RiskClass::Advanced),
    );
    assert_eq!(
        unavailable.state,
        ComplementaryState::Unavailable(UnavailableReason::PolicyDenied)
    );

    let mut failed_api = ScriptedApi::successful(84);
    let mut failed_observer = ScriptedObserver::new(PointObservation::Failed { status: 1168 });
    let failed = prepare_restore_point(
        &mut failed_api,
        &mut failed_observer,
        request(RiskClass::Experimental),
    );
    assert_eq!(
        failed.state,
        ComplementaryState::Failed(FailureEvidence {
            stage: FailureStage::Observation,
            status: Some(1168),
        })
    );
    assert_eq!(failed.admission, Admission::Blocked);
}

#[test]
fn applies_proportional_complement_policy_without_replacing_the_manifest() {
    let unavailable = UnavailableReason::Disabled;

    let mut verified_api = ScriptedApi {
        readiness: Err(unavailable),
        ..ScriptedApi::successful(1)
    };
    let mut observer = ScriptedObserver::new(PointObservation::NotCreated);
    let verified = prepare_restore_point(
        &mut verified_api,
        &mut observer,
        request(RiskClass::Verified),
    );
    assert_eq!(verified.admission, Admission::Allowed);

    let mut advanced_api = ScriptedApi {
        readiness: Err(unavailable),
        ..ScriptedApi::successful(1)
    };
    let advanced = prepare_restore_point(
        &mut advanced_api,
        &mut observer,
        request(RiskClass::Advanced),
    );
    assert_eq!(
        advanced.admission,
        Admission::RequiresComplementAcknowledgement
    );

    let mut acknowledged_request = request(RiskClass::Advanced);
    acknowledged_request.advanced_without_complement_acknowledged = true;
    let mut acknowledged_api = ScriptedApi {
        readiness: Err(unavailable),
        ..ScriptedApi::successful(1)
    };
    let acknowledged =
        prepare_restore_point(&mut acknowledged_api, &mut observer, acknowledged_request);
    assert_eq!(acknowledged.admission, Admission::Allowed);

    let mut experimental_api = ScriptedApi {
        readiness: Err(unavailable),
        ..ScriptedApi::successful(1)
    };
    let experimental = prepare_restore_point(
        &mut experimental_api,
        &mut observer,
        request(RiskClass::Experimental),
    );
    assert_eq!(experimental.admission, Admission::Blocked);

    let mut extreme_api = ScriptedApi::successful(1);
    let extreme =
        prepare_restore_point(&mut extreme_api, &mut observer, request(RiskClass::Extreme));
    assert_eq!(extreme.admission, Admission::Blocked);
}

#[test]
fn missing_primary_manifest_blocks_without_touching_system_restore() {
    let mut api = ScriptedApi::successful(29);
    let mut observer = ScriptedObserver::new(PointObservation::Usable {
        sequence_number: 29,
    });
    let mut missing = request(RiskClass::Verified);
    missing.primary_manifest_ready = false;

    let projection = prepare_restore_point(&mut api, &mut observer, missing);

    assert!(api.calls.is_empty());
    assert!(observer.sequences.is_empty());
    assert_eq!(projection.admission, Admission::Blocked);
    assert_eq!(
        projection.state,
        ComplementaryState::Failed(FailureEvidence {
            stage: FailureStage::Request,
            status: None,
        })
    );
}
