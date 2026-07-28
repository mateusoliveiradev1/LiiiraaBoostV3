#[test]
fn windows_build_embeds_common_controls_v6_manifest() {
    let build_script = include_str!("../build.rs");
    assert!(
        build_script.contains("tauri_build::build()")
            || build_script.contains("tauri_build::try_build("),
        "the desktop build script must invoke tauri-build so the Windows Common Controls v6 manifest is embedded"
    );

    let cargo_manifest = include_str!("../Cargo.toml");
    let build_dependencies = cargo_manifest
        .split_once("[build-dependencies]")
        .map(|(_, remainder)| remainder.split("\n[").next().unwrap_or(remainder))
        .unwrap_or_default();
    assert!(
        build_dependencies.contains("tauri-build") && build_dependencies.contains("\"=2.6.3\""),
        "the desktop crate must declare the pinned tauri-build build dependency"
    );
}
