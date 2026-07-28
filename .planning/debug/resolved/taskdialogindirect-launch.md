---
status: resolved
trigger: "Após instalar o Liiiraa Boost 0.0.0, liiiraa-desktop.exe não abre e o Windows informa que o ponto de entrada TaskDialogIndirect não foi encontrado no próprio executável."
created: 2026-07-28T15:53:53.186Z
updated: 2026-07-28T17:15:00-03:00
---

# Debug: TaskDialogIndirect no primeiro launch

## Symptoms

- expected: O instalador conclui e o aplicativo desktop abre normalmente para visualização local.
- actual: O executável não inicia; aparece uma caixa "liiiraa-desktop.exe - Ponto de entrada não encontrado".
- error: "Não foi possível localizar o ponto de entrada do procedimento TaskDialogIndirect na biblioteca de vínculo dinâmico C:\Users\Liiiraa\AppData\Local\Liiiraa Boost\liiiraa-desktop.exe."
- timeline: Ocorreu no primeiro teste após instalar o artefato de desenvolvimento 0.0.0; o aplicativo ainda não abriu com sucesso.
- reproduction: Executar o instalador staged `Liiiraa Boost_0.0.0_x64-setup.exe` e iniciar o aplicativo instalado.
- screenshot: `C:\Users\Liiiraa\AppData\Local\Temp\codex-clipboard-5beef02f-e5f2-4e4b-95b7-420d8b53748b.png`

## Current Focus

- hypothesis: RESOLVIDA — o build script não incorporava o manifesto Common Controls v6; a correção restaurou `tauri-build` e o activation context correto.
- test: GREEN — contrato do build, configuração fail-closed do updater, build release/NSIS, extração RT_MANIFEST e launch real.
- expecting: O executável deve abrir, permanecer ativo e carregar `comctl32.dll` do assembly WinSxS v6.
- next_action: complete
- reasoning_checkpoint:
    hypothesis: "A omissão de `tauri_build` impede a incorporação do manifesto Common Controls v6, fazendo o loader resolver `TaskDialogIndirect` no comctl32 v5 sem esse export."
    confirming_evidence:
      - "Os PEs release/staged/debug importam `comctl32.dll!TaskDialogIndirect` e têm resource directory RVA=0/size=0."
      - "System32 comctl32 não exporta `TaskDialogIndirect`, mas o assembly WinSxS v6 exporta."
      - "`build.rs` não chama `tauri_build` e o teste de contrato falha em RED."
    falsification_test: "Se, após executar `tauri_build` e rebuildar, o PE continuar sem RT_MANIFEST/Common Controls v6 ou o launch ainda falhar com o mesmo loader error, a hipótese estará falsificada."
    fix_rationale: "Declarar a build-dependency e chamar o helper restaura o pipeline oficial que compila/linka o manifesto v6 no executável, corrigindo o activation context em vez de contornar o símbolo."
    blind_spots: "O executável instalado original não está presente; a validação end-to-end dependerá do novo release/staging e de um launch local não destrutivo."
- tdd_checkpoint:
    test_file: apps/desktop/src-tauri/tests/windows_build_manifest.rs
    test_name: windows_build_embeds_common_controls_v6_manifest
    status: green
    failure_output: "panicked at windows_build_manifest.rs:4:5: the desktop build script must invoke tauri-build so the Windows Common Controls v6 manifest is embedded"

## Evidence

- timestamp: 2026-07-28T16:22:00-03:00
  found: Não existe `.planning/debug/knowledge-base.md`; não há padrão local conhecido para priorizar.
  implication: A investigação seguirá evidência direta e o checklist comum; o sintoma se encaixa em Import/Module e Environment/Config no nível do loader PE.
- timestamp: 2026-07-28T16:27:00-03:00
  found: Foram localizados `target/release/liiiraa-desktop.exe` (23.306.040 bytes), a cópia staged com o mesmo tamanho, o instalador NSIS staged/release (4.503.880 bytes) e um build debug posterior (36.436.992 bytes).
  implication: Existem artefatos suficientes para isolar se a referência nasceu no link release ou foi introduzida no staging.
- timestamp: 2026-07-28T16:27:00-03:00
  found: `C:\Users\Liiiraa\AppData\Local\Liiiraa Boost` não existe no momento da investigação.
  implication: O executável instalado original não pode ser comparado diretamente; nenhuma ação de desinstalação/remoção foi executada nesta sessão.
- timestamp: 2026-07-28T16:31:00-03:00
  found: O parser PE atribuiu `TaskDialogIndirect` a uma importação normal de `comctl32.dll` nos binários release, staged e debug; todos são PE32+ x64 e têm as mesmas cinco seções principais.
  implication: A hipótese de descriptor PE apontando `TaskDialogIndirect` diretamente para o próprio EXE foi eliminada. A falha é compatível com resolução contra Common Controls v5 quando o activation context v6 não é ativado.
- timestamp: 2026-07-28T16:36:00-03:00
  found: Release e staged têm SHA-256 idêntico `69f4c85ee4f4ad9516bf9125102651404ee43f0bce009112dc54c1b6ad61b690`; ambos, assim como o debug posterior, têm resource data directory RVA=0/size=0 e nenhuma seção `.rsrc`.
  implication: O staging é byte a byte fiel; a ausência do manifesto já existe no binário produzido pelo linker e persiste em rebuild debug.
- timestamp: 2026-07-28T16:36:00-03:00
  found: `apps/desktop/src-tauri/build.rs` contém apenas dois `cargo:rerun-if-changed` e não chama `tauri_build`; `Cargo.toml` não declara `[build-dependencies]`.
  implication: O crate substituiu o build script Tauri esperado e não executa a geração/linkedição de recursos Windows.
- timestamp: 2026-07-28T16:36:00-03:00
  found: A fonte local exata de `tauri-build 2.6.3` define por padrão um manifesto com `Microsoft.Windows.Common-Controls` versão `6.0.0.0` e o compila via `WindowsResource`; sua documentação alerta que APIs de diálogo exigem Common Controls v6.
  implication: Há uma cadeia causal direta entre a omissão de `tauri_build`, o resource directory vazio, a resolução de `TaskDialogIndirect` no comctl32 antigo e a falha antes de `main`.
- timestamp: 2026-07-28T16:41:00-03:00
  found: O teste `windows_build_embeds_common_controls_v6_manifest` falhou em RED no primeiro assert porque `build.rs` não invoca `tauri-build` (0 passed, 1 failed).
  implication: A regressão está reproduzida de forma mínima e determinística no contrato de build; nenhuma correção foi aplicada.
- timestamp: 2026-07-28T16:45:00-03:00
  found: Nenhum EXE build/staged exporta `TaskDialogIndirect`; `C:\Windows\System32\comctl32.dll` também não exporta a função, enquanto o assembly Common Controls v6 em WinSxS (`6.0.26100.8521`) exporta.
  implication: A mensagem citar o EXE não significa self-import. Sem manifesto, o loader usa precisamente o módulo que não tem o símbolo; com activation context v6, o assembly disponível fornece o símbolo.
- timestamp: 2026-07-28T16:45:00-03:00
  found: Toolchain ativa é `rustc/cargo 1.97.1`, host `x86_64-pc-windows-msvc`, LLVM 22.1.6, em Windows `10.0.26200.0`; o PE produzido é x64 e a fonte local de `tauri-build` é 2.6.3.
  implication: Arquitetura e toolchain correspondem ao contrato do projeto; não há evidência de target GNU, bitness incorreta ou SDK incompatível. A omissão está no build script do crate.
- timestamp: 2026-07-28T16:56:00-03:00
  found: A primeira execução GREEN avançou até `tauri-build`, que falhou porque o recurso Windows padrão `icons/icon.ico` não existia; o projeto possuía apenas `icon-rgba.png`.
  implication: A chamada corrigida expôs um requisito adjacente legítimo do pipeline oficial, não uma refutação da causa; foi necessário fornecer o formato Windows derivado do ativo existente.
- timestamp: 2026-07-28T17:00:00-03:00
  found: Após declarar `tauri-build = "=2.6.3"`, chamar `tauri_build::build()` e gerar `icons/icon.ico` a partir do PNG canônico, o teste passou (1 passed, 0 failed).
  implication: O checkpoint TDD está GREEN e a correção de fonte/build está pronta para verificação no artefato.
- timestamp: 2026-07-28T17:04:00-03:00
  found: Frontend Vite e `tauri build` concluíram; o release e o instalador NSIS foram reconstruídos. O novo PE tem resource directory RVA=17739776/size=57944, enquanto o staged histórico permanece sem recursos e não foi sobrescrito.
  implication: A correção está materializada no novo artefato de build e o pacote histórico de evidência foi preservado.
- timestamp: 2026-07-28T17:05:00-03:00
  found: `mt.exe` extraiu RT_MANIFEST #1 do novo release com `Microsoft.Windows.Common-Controls` versão `6.0.0.0`, publicKeyToken `6595b64144ccf1df`.
  implication: O activation context necessário para resolver `TaskDialogIndirect` está incorporado diretamente no PE.
- timestamp: 2026-07-28T17:07:00-03:00
  found: O primeiro launch pós-manifesto ultrapassou o loader e chegou ao runtime, mas expôs um bloqueio posterior: `plugins.updater` ausente era desserializado como null.
  implication: O erro TaskDialogIndirect foi corrigido; uma configuração Tauri independente ainda impedia o objetivo final de abrir a interface.
- timestamp: 2026-07-28T17:10:00-03:00
  found: Foi adicionado teste RED→GREEN para configuração fail-closed do updater e declarados `endpoints: []`, `pubkey: ""`, `windows: null`, coerentes com `artifactsEnabled: false`.
  implication: O plugin inicializa sem habilitar downloads nem confiar em uma chave inexistente.
- timestamp: 2026-07-28T17:13:00-03:00
  found: O release final permaneceu ativo por 5 segundos, abriu janela com título `Liiiraa Boost`, stderr vazio e carregou `comctl32.dll` de `WinSxS\...\6.0.26100.8521...`; o processo de teste foi encerrado e confirmado ausente.
  implication: A reprodução original foi revertida no fluxo real de launch sem instalar/desinstalar, remover certificados ou alterar o trust store.
- timestamp: 2026-07-28T17:15:00-03:00
  found: `cargo test -p liiiraa-desktop` passou 20 testes em 4 suites; `cargo fmt --check` e `git diff --check` passaram.
  implication: A correção e os testes de regressão estão consistentes com o restante do crate.
## Eliminated

- hypothesis: A etapa de staging corrompeu ou reatribuiu a importação de `TaskDialogIndirect` ao executável.
  evidence: Tanto release quanto staged e debug declaram `comctl32.dll!TaskDialogIndirect` no import directory.
  eliminated_at: 2026-07-28T16:31:00-03:00
- hypothesis: O instalador NSIS modificou o executável ou introduziu a falha após o build.
  evidence: A cópia staged e `target/release/liiiraa-desktop.exe` têm hash SHA-256 idêntico.
  eliminated_at: 2026-07-28T16:36:00-03:00
- hypothesis: A ausência de recurso foi específica do build release antigo.
  evidence: O build debug posterior também tem resource directory vazio e importa `comctl32.dll!TaskDialogIndirect`.
  eliminated_at: 2026-07-28T16:36:00-03:00
- hypothesis: O símbolo deveria ser exportado pelo próprio `liiiraa-desktop.exe` e está faltando na tabela de exports.
  evidence: O import descriptor nomeia `comctl32.dll`; o assembly Common Controls v6 em WinSxS exporta `TaskDialogIndirect`, enquanto o System32 sem activation context não exporta.
  eliminated_at: 2026-07-28T16:45:00-03:00
- hypothesis: Target/toolchain incorreta (GNU, x86 ou versão Rust divergente) gerou a incompatibilidade.
  evidence: O host é `x86_64-pc-windows-msvc`, Rust/Cargo 1.97.1 conforme pin do projeto, e os PEs são x64.
  eliminated_at: 2026-07-28T16:45:00-03:00
## Resolution

- root_cause: O build script customizado do desktop não chama `tauri_build` e o manifesto padrão de Common Controls v6 não é incorporado ao PE; `TaskDialogIndirect` é importado estaticamente de `comctl32.dll`, mas sem activation context v6 o loader encontra a implementação antiga sem esse export e encerra antes de `main`.
- fix: Declarada a build-dependency pinada `tauri-build 2.6.3`, restaurada a chamada `tauri_build::build()` e adicionado o ícone Windows `.ico` derivado do ativo PNG existente para permitir a geração do recurso PE.
- verification: TDD GREEN (2 testes novos), suite Rust completa 20/20, Vite build, Tauri release + NSIS, RT_MANIFEST v6 extraído, launch com janela real e comctl32 WinSxS v6 observado; nenhum stderr ou processo residual.
- files_changed:
  - apps/desktop/src-tauri/tests/windows_build_manifest.rs (teste TDD RED)
  - apps/desktop/src-tauri/Cargo.toml
  - apps/desktop/src-tauri/build.rs
  - apps/desktop/src-tauri/icons/icon.ico
  - apps/desktop/src-tauri/tauri.conf.json
  - apps/desktop/src-tauri/tests/startup_config.rs
  - Cargo.lock

## Archive

- resolved_at: 2026-07-28T17:15:00-03:00
