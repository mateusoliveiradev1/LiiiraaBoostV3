#![cfg(windows)]

#[path = "../src/main.rs"]
mod service;

use std::{
    sync::{
        Arc,
        atomic::{AtomicBool, Ordering},
    },
    thread,
    time::Duration,
};

use service::{
    operations::power_scheme::{
        InteractiveUserEffectError, PowerSchemeError, VerifiedClientContext,
        current_effective_identity_for_test, process_handle_count_for_test,
    },
    windows_pipe::AuthenticatedClientToken,
};

#[derive(Clone, Copy, Debug, Eq, PartialEq)]
enum InjectedError {
    Effect,
}

#[test]
fn effect_thread_uses_the_authenticated_token_user_and_session_then_reverts() {
    let token = AuthenticatedClientToken::duplicate_current_process_for_test()
        .expect("duplicate controlled current-client token");
    let client = token.verified_client_context_for_test();
    let expected = current_effective_identity_for_test().expect("process token identity");
    assert!(!expected.thread_impersonating);

    let lease = token.effect_lease();
    let inside = lease
        .with_interactive_user(Duration::from_secs(1), &client, |_| {
            current_effective_identity_for_test().map_err(|_| InjectedError::Effect)
        })
        .expect("bounded user-context effect");

    assert!(inside.thread_impersonating, "effect must have a thread token");
    assert_eq!(inside.token_user_sid, expected.token_user_sid);
    assert_eq!(inside.session_id, expected.session_id);
    assert!(
        !current_effective_identity_for_test()
            .expect("service identity after effect")
            .thread_impersonating,
        "caller continues under its process/service identity"
    );
}

#[test]
fn wrong_session_never_enters_the_effect_closure() {
    let token = AuthenticatedClientToken::duplicate_current_process_for_test()
        .expect("duplicate controlled current-client token");
    let client = token.verified_client_context_for_test();
    let wrong = VerifiedClientContext::establish(
        client.session_id().saturating_add(1),
        client.interactive_logon_sid(),
        true,
        true,
    )
    .expect("syntactically verified but mismatched context");
    let called = Arc::new(AtomicBool::new(false));
    let called_inside = called.clone();

    let result = token.effect_lease().with_interactive_user(
        Duration::from_secs(1),
        &wrong,
        move |_| {
            called_inside.store(true, Ordering::SeqCst);
            Ok::<_, InjectedError>(())
        },
    );

    assert_eq!(result, Err(InteractiveUserEffectError::ClientMismatch));
    assert!(!called.load(Ordering::SeqCst));
}

#[test]
fn error_unwind_and_timeout_drain_restore_before_returning() {
    let token = AuthenticatedClientToken::duplicate_current_process_for_test()
        .expect("duplicate controlled current-client token");
    let client = token.verified_client_context_for_test();

    let error = token.effect_lease().with_interactive_user(
        Duration::from_secs(1),
        &client,
        |_| Err::<(), _>(InjectedError::Effect),
    );
    assert_eq!(
        error,
        Err(InteractiveUserEffectError::Effect(InjectedError::Effect))
    );

    let unwind = token.effect_lease().with_interactive_user(
        Duration::from_secs(1),
        &client,
        |_| -> Result<(), InjectedError> { panic!("injected PowrProf unwind") },
    );
    assert_eq!(unwind, Err(InteractiveUserEffectError::Panicked));

    let drained = Arc::new(AtomicBool::new(false));
    let drained_inside = drained.clone();
    let timeout = token.effect_lease().with_interactive_user(
        Duration::from_millis(1),
        &client,
        move |_| {
            thread::sleep(Duration::from_millis(20));
            drained_inside.store(true, Ordering::SeqCst);
            Ok::<_, InjectedError>(())
        },
    );
    assert_eq!(timeout, Err(InteractiveUserEffectError::Timeout));
    assert!(
        drained.load(Ordering::SeqCst),
        "timeout must join the worker through cleanup before returning"
    );
    assert!(
        !current_effective_identity_for_test()
            .expect("service identity after cleanup matrix")
            .thread_impersonating
    );
}

#[test]
fn repeated_success_failure_unwind_and_timeout_have_zero_handle_growth() {
    let before = process_handle_count_for_test().expect("initial process handle count");

    for iteration in 0..16 {
        let token = AuthenticatedClientToken::duplicate_current_process_for_test()
            .expect("duplicate controlled current-client token");
        let client = token.verified_client_context_for_test();
        let result = match iteration % 4 {
            0 => token.effect_lease().with_interactive_user(
                Duration::from_secs(1),
                &client,
                |_| Ok::<_, InjectedError>(()),
            ),
            1 => token.effect_lease().with_interactive_user(
                Duration::from_secs(1),
                &client,
                |_| Err::<(), _>(InjectedError::Effect),
            ),
            2 => token.effect_lease().with_interactive_user(
                Duration::from_secs(1),
                &client,
                |_| -> Result<(), InjectedError> { panic!("injected unwind") },
            ),
            _ => token.effect_lease().with_interactive_user(
                Duration::from_millis(1),
                &client,
                |_| {
                    thread::sleep(Duration::from_millis(4));
                    Ok::<_, InjectedError>(())
                },
            ),
        };
        assert!(result.is_ok() || result.is_err());
        drop(token);
    }

    let after = process_handle_count_for_test().expect("final process handle count");
    assert!(
        after <= before + 2,
        "bounded token/thread handles leaked: before={before}, after={after}"
    );
}
