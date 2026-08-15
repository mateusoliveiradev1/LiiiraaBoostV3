use std::process::Command;

#[test]
fn diagnostic_cli_rejects_arguments_without_echoing_them() {
    let output = Command::new(env!("CARGO_BIN_EXE_phase6-installed-custody-diagnostic"))
        .arg(r"C:\Users\secret-user\token.txt")
        .output()
        .expect("diagnostic binary must execute");

    assert_eq!(output.status.code(), Some(2));
    let stdout = String::from_utf8(output.stdout).expect("stdout must be UTF-8");
    let stderr = String::from_utf8(output.stderr).expect("stderr must be UTF-8");
    assert!(stdout.is_empty());
    assert_eq!(
        stderr.trim(),
        r#"{"status":"BLOCKED","errorCode":"diagnostic-argument-invalid","detailCode":"unavailable","role":null,"pathClass":null,"ioKind":null,"win32Code":null}"#
    );
    assert!(!stderr.contains("secret-user"));
    assert!(!stderr.contains("token.txt"));
}
