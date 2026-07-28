# GSD Debug Knowledge Base

Resolved debug sessions. Used by `gsd-debugger` to surface known-pattern hypotheses at the start of new investigations.

---

## taskdialogindirect-launch — Desktop falhava antes de main por ausência do manifesto Common Controls v6

- **Date:** 2026-07-28
- **Error patterns:** TaskDialogIndirect, ponto de entrada não encontrado, liiiraa-desktop.exe não abre
- **Root cause:** O build script customizado não chamava `tauri_build`; o PE importava `comctl32.dll!TaskDialogIndirect` sem RT_MANIFEST para ativar Common Controls v6.
- **Fix:** Declarar `tauri-build 2.6.3`, executar `tauri_build::build()`, fornecer `icon.ico` e configurar o updater desabilitado de forma fail-closed.
- **Files changed:** Cargo.lock, apps/desktop/src-tauri/Cargo.toml, apps/desktop/src-tauri/build.rs, apps/desktop/src-tauri/icons/icon.ico, apps/desktop/src-tauri/tauri.conf.json, apps/desktop/src-tauri/tests/windows_build_manifest.rs, apps/desktop/src-tauri/tests/startup_config.rs

---
