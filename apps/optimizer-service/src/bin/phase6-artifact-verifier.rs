#[path = "../artifact_manifest.rs"]
mod artifact_manifest;
#[path = "../installation_manifest.rs"]
mod installation_manifest;

fn main() {
    let arguments: Vec<String> = std::env::args().collect();
    let result = artifact_manifest::parse_artifact_verifier_args(&arguments)
        .and_then(|path| artifact_manifest::verify_artifact_manifest(&path));
    match result {
        Ok(verified) => {
            println!(
                "{{\"verdict\":\"verified\",\"manifestSha256\":\"{}\",\"operationVersionId\":\"{}\"}}",
                verified.manifest_sha256(),
                verified.operation_version_id()
            );
        }
        Err(error) => {
            eprintln!(
                "{{\"verdict\":\"blocked\",\"code\":\"{}\"}}",
                error.code.as_str()
            );
            std::process::exit(2);
        }
    }
}
