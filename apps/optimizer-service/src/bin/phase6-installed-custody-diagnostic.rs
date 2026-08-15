#[path = "../installation_manifest.rs"]
mod installation_manifest;
#[path = "../numeric_version.rs"]
mod numeric_version;

use installation_manifest::{CustodyError, verify_installed_manifest};
use serde::Serialize;

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct SafeDiagnostic<'a> {
    status: &'static str,
    error_code: &'a str,
    detail_code: &'a str,
    role: Option<&'a str>,
    path_class: Option<&'a str>,
    io_kind: Option<&'a str>,
    win32_code: Option<i32>,
}

fn from_error(error: &CustodyError) -> SafeDiagnostic<'_> {
    let path = error.safe_path_diagnostic();
    SafeDiagnostic {
        status: "BLOCKED",
        error_code: error.code.as_str(),
        detail_code: error.safe_path_detail_code(),
        role: path.map(|value| value.role),
        path_class: path.map(|value| value.path_class),
        io_kind: path.map(|value| value.io_kind),
        win32_code: path.and_then(|value| value.win32_code),
    }
}

fn write_blocked(diagnostic: &SafeDiagnostic<'_>) -> ! {
    let serialized = serde_json::to_string(diagnostic).unwrap_or_else(|_| {
        r#"{"status":"BLOCKED","errorCode":"diagnostic-serialization-failed","detailCode":"unavailable","role":null,"pathClass":null,"ioKind":null,"win32Code":null}"#.to_owned()
    });
    eprintln!("{serialized}");
    std::process::exit(2);
}

fn main() {
    if std::env::args_os().count() != 1 {
        write_blocked(&SafeDiagnostic {
            status: "BLOCKED",
            error_code: "diagnostic-argument-invalid",
            detail_code: "unavailable",
            role: None,
            path_class: None,
            io_kind: None,
            win32_code: None,
        });
    }

    match verify_installed_manifest() {
        Ok(_) => println!(
            "{}",
            r#"{"status":"PASSED","errorCode":null,"detailCode":null,"role":null,"pathClass":null,"ioKind":null,"win32Code":null}"#
        ),
        Err(error) => write_blocked(&from_error(&error)),
    }
}
