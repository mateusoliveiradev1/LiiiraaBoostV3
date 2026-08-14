use std::{
    env, fs,
    path::{Path, PathBuf},
    process::Command,
};

const PHYSICAL_VERSION_ENV: &str = "LIIIRAA_PHYSICAL_PACKAGE_VERSION";

fn main() {
    println!("cargo:rerun-if-env-changed={PHYSICAL_VERSION_ENV}");
    if env::var("CARGO_CFG_TARGET_OS").as_deref() != Ok("windows") {
        return;
    }

    let version =
        env::var(PHYSICAL_VERSION_ENV).unwrap_or_else(|_| env!("CARGO_PKG_VERSION").into());
    let parts = numeric_version(&version);
    let output = PathBuf::from(env::var_os("OUT_DIR").expect("OUT_DIR is required"));
    let source = output.join("liiiraa-optimizer-service-version.rc");
    let resource = output.join("liiiraa-optimizer-service-version.res");
    fs::write(&source, version_resource(&parts)).expect("write service VERSIONINFO source");

    let compiler = windows_resource_compiler().expect("Windows SDK rc.exe is required");
    let include_root =
        windows_sdk_include_root(&compiler).expect("Windows SDK headers are required");
    let status = Command::new(compiler)
        .arg("/nologo")
        .arg("/I")
        .arg(include_root.join("um"))
        .arg("/I")
        .arg(include_root.join("shared"))
        .arg("/I")
        .arg(include_root.join("ucrt"))
        .arg("/fo")
        .arg(&resource)
        .arg(&source)
        .status()
        .expect("launch Windows SDK rc.exe");
    assert!(status.success(), "Windows SDK rc.exe failed");

    println!(
        "cargo:rustc-link-arg-bin=liiiraa-optimizer-service={}",
        resource.display()
    );
}

fn numeric_version(version: &str) -> [u16; 4] {
    let values = version
        .split('.')
        .map(|part| {
            part.parse::<u16>()
                .expect("physical version must be numeric")
        })
        .collect::<Vec<_>>();
    assert!(
        (3..=4).contains(&values.len()),
        "physical version must have three or four parts"
    );
    [
        values[0],
        values[1],
        values[2],
        values.get(3).copied().unwrap_or(0),
    ]
}

fn version_resource(parts: &[u16; 4]) -> String {
    let [major, minor, patch, build] = *parts;
    let version = format!("{major}.{minor}.{patch}.{build}");
    format!(
        r#"#include <windows.h>
1 VERSIONINFO
FILEVERSION {major},{minor},{patch},{build}
PRODUCTVERSION {major},{minor},{patch},{build}
FILEFLAGSMASK 0x3fL
FILEFLAGS 0x0L
FILEOS 0x00040004L
FILETYPE 0x1L
FILESUBTYPE 0x0L
BEGIN
  BLOCK "StringFileInfo"
  BEGIN
    BLOCK "040904b0"
    BEGIN
      VALUE "CompanyName", "Liiiraa Boost\0"
      VALUE "FileDescription", "Liiiraa Boost Optimizer Service\0"
      VALUE "FileVersion", "{version}\0"
      VALUE "InternalName", "liiiraa-optimizer-service\0"
      VALUE "OriginalFilename", "liiiraa-optimizer-service.exe\0"
      VALUE "ProductName", "Liiiraa Boost\0"
      VALUE "ProductVersion", "{version}\0"
    END
  END
  BLOCK "VarFileInfo"
  BEGIN
    VALUE "Translation", 0x0409, 1200
  END
END
"#
    )
}

fn windows_resource_compiler() -> Option<PathBuf> {
    let architecture = match env::var("CARGO_CFG_TARGET_ARCH").as_deref() {
        Ok("x86_64") => "x64",
        Ok("x86") => "x86",
        Ok("aarch64") => "arm64",
        _ => return None,
    };
    let kits_root = env::var_os("ProgramFiles(x86)")
        .map(PathBuf::from)?
        .join("Windows Kits")
        .join("10")
        .join("bin");
    let direct = kits_root.join(architecture).join("rc.exe");
    if direct.is_file() {
        return Some(direct);
    }
    let mut versions = fs::read_dir(kits_root)
        .ok()?
        .filter_map(Result::ok)
        .map(|entry| entry.path())
        .filter(|path| path.is_dir())
        .collect::<Vec<_>>();
    versions.sort_by(|left, right| version_directory(right).cmp(&version_directory(left)));
    versions
        .into_iter()
        .map(|path| path.join(architecture).join("rc.exe"))
        .find(|path| path.is_file())
}

fn version_directory(path: &Path) -> Vec<u32> {
    path.file_name()
        .and_then(|name| name.to_str())
        .into_iter()
        .flat_map(|name| name.split('.'))
        .map(|part| part.parse::<u32>().unwrap_or(0))
        .collect()
}

fn windows_sdk_include_root(compiler: &Path) -> Option<PathBuf> {
    let version_directory = compiler.parent()?.parent()?;
    let version = version_directory.file_name()?;
    let sdk_root = version_directory.parent()?.parent()?;
    Some(sdk_root.join("Include").join(version))
}
