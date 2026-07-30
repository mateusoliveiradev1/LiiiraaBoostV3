---
status: resolved
trigger: "Após instalar o build corrigido, abre uma janela de terminal intitulada Liiiraa Boost exibindo 'asset not found: index.html' em vez da interface."
created: 2026-07-28T16:27:08.165Z
updated: 2026-07-30T14:04:46.8217156-03:00
---

# Debug: console visível e index.html ausente

## Symptoms

- expected: O aplicativo abre somente a janela gráfica do Liiiraa Boost e carrega a interface empacotada.
- actual: Abre uma janela de terminal preta; a interface não aparece.
- error: `asset not found: index.html`
- timeline: Ocorreu no primeiro launch do instalador reconstruído após corrigir `TaskDialogIndirect`.
- reproduction: Instalar/executar `target/release/bundle/nsis/Liiiraa Boost_0.0.0_x64-setup.exe` e iniciar o aplicativo.
- screenshot: `C:\Users\Liiiraa\AppData\Local\Temp\codex-clipboard-af506fb3-fb05-4f7c-b74f-29342d98ddcb.png`

## Current Focus

- hypothesis: Confirmada — listen seguido de get_shell_bootstrap fecha a corrida de startup; fallback pt-BR e migração pontual v1→v2 corrigem instalações novas e o estado legado automático.
- test: Instalar e abrir o NSIS reconstruído no ambiente humano, avançar pelos dois acknowledgments intencionais e confirmar a rota principal em PT-BR.
- expecting: Sem terminal/index.html, sem tela vazia, sem splash initializing-webview permanente; handoff e ready em PT-BR, depois Calibração guiada.
- next_action: Aguardar confirmação humana do instalador target/release/bundle/nsis/Liiiraa Boost_0.0.0_x64-setup.exe.
- reasoning_checkpoint:
  hypothesis: "Os eventos de startup emitidos em setup são perdidos antes do useEffect registrar listen; sem snapshot replayável o renderer conserva o splash. Separadamente, windowsLocale indefinido usa o default en-US."
  confirming_evidence: - "main.rs emite installer identity e StartupCondition::Ready durante setup, enquanto ShellEventBridge.start registra listen apenas no efeito React posterior." - "O teste RED provou que nenhum get_shell_bootstrap era invocado após listen." - "O teste RED provou que windowsLocale indefinido resultava em en-US."
  falsification_test: "A hipótese será falsa se o build instalado continuar no splash após o snapshot validado ou se documentElement.lang não for pt-BR com o fallback aplicado."
  fix_rationale: "Registrar listen antes de pedir um snapshot fecha a janela de perda sem alterar contratos de evento; usar pt-BR somente enquanto o host locale está indisponível atende o primeiro lançamento."
  blind_spots: "A automação CDP validou o release direto e a sequência completa; resta somente confirmar o comportamento do instalador no ambiente humano."
- tdd_checkpoint:
  test_file: "apps/desktop/src/native/shell-bridge.test.ts + apps/desktop/src/preferences.test.tsx"
  test_name: "requests a replayable startup snapshot after registering the listener + starts in PT-BR while native locale is unavailable"
  status: "green"
  failure_output: "RED inicial: 2 failed, 9 passed; após get_shell_bootstrap/replay e fallback pt-BR, 2 arquivos e 11 testes passaram."

## Evidence

- timestamp: 2026-07-28T16:47:00-03:00
  checked: .planning/debug/knowledge-base.md
  found: A única entrada trata de TaskDialogIndirect/manifesto; não há sobre assets, frontendDist ou janela de console.
  implication: Não existe padrão conhecido com sobreposição de dois termos; a hipótese atual precisa de validação independente.
- timestamp: 2026-07-28T16:47:30-03:00
  checked: apps/desktop/vite.config.ts
  found: O Vite produz o frontend em apps/desktop/dist e usa base relativa "./".
  implication: O produtor de assets é determinístico e deveria criar dist/index.html.
- timestamp: 2026-07-28T16:48:00-03:00
  checked: apps/desktop/src-tauri/tauri.conf.json
  found: A configuração não possui seção build; portanto não declara frontendDist nem beforeBuildCommand.
  implication: O consumidor Tauri não está explicitamente ligado ao output Vite, forte candidato para o executável sem index.html.
- timestamp: 2026-07-28T16:48:30-03:00
  checked: package.json raiz e apps/desktop/package.json
  found: O script desktop build executa somente "vite build"; não há script Tauri nem outra etapa que garanta o frontend antes do bundle nativo.
  implication: Um cargo/tauri build executado fora de um beforeBuildCommand pode empacotar o host sem produzir os assets.
- timestamp: 2026-07-28T16:51:00-03:00
  checked: apps/desktop/dist
  found: dist/index.html (469 bytes), CSS e JS existem no workspace.
  implication: A hipótese "Vite não produziu index.html" foi refutada; a falha está entre o output existente e a incorporação Tauri.
- timestamp: 2026-07-28T16:51:30-03:00
  checked: apps/desktop/src-tauri/src/main.rs
  found: main.rs não possui cfg_attr(windows, windows_subsystem = "windows").
  implication: Em release Windows, o binário Rust permanece candidato a IMAGE_SUBSYSTEM_WINDOWS_CUI, explicando a janela de console.
- timestamp: 2026-07-28T16:52:00-03:00
  checked: build.rs e testes existentes
  found: tauri_build::build() já é chamado e os testes cobrem manifesto/updater, mas nenhum teste exige frontendDist, beforeBuildCommand ou subsistema GUI.
  implication: A correção anterior do manifesto não garante os assets nem impede regressão de console.
- timestamp: 2026-07-28T16:56:00-03:00
  checked: tauri-utils 2.9.3 BuildConfig
  found: frontend_dist e before_build_command são Option e BuildConfig deriva Default; frontendDist relativo é o diretório lido recursivamente e embutido no binário.
  implication: Sem a seção build, generate_context! não recebe um diretório de assets e não tem index.html para servir.
- timestamp: 2026-07-28T16:57:00-03:00
  checked: target/release/liiiraa-desktop.exe
  found: Os nomes Vite index-BOK4q20m.js e index--cudO--4.css não existem nos bytes do PE; apenas a string genérica index.html do runtime aparece.
  implication: O executável foi compilado sem os assets específicos presentes em apps/desktop/dist.
- timestamp: 2026-07-28T16:58:00-03:00
  checked: Cabeçalho PE de target/release/liiiraa-desktop.exe
  found: PE32+ OptionalHeader.Subsystem = 3 (IMAGE_SUBSYSTEM_WINDOWS_CUI).
  implication: O Windows cria uma janela de console ao iniciar o aplicativo release.
- timestamp: 2026-07-28T17:03:00-03:00
  checked: cargo test -p liiiraa-desktop --test packaged_startup
  found: RED reproduzido — 0 passed, 2 failed; frontendDist é Null e main.rs não satisfaz o contrato de subsistema GUI em release.
  implication: Os testes distinguem e confirmam as duas causas antes de qualquer correção.
- timestamp: 2026-07-28T17:14:00-03:00
  checked: cargo test -p liiiraa-desktop --test packaged_startup após correção mínima
  found: GREEN — 2 passed, 0 failed.
  implication: O contrato agora exige assets Vite incorporados e PE GUI em release.
- timestamp: 2026-07-28T17:16:00-03:00
  checked: pnpm --filter @liiiraa/desktop build
  found: Vite 8.1.5 concluiu; dist/index.html, CSS e JS foram gerados.
  implication: O frontend de produção está pronto para ser incorporado pelo Tauri.
- timestamp: 2026-07-28T17:20:00-03:00
  checked: pnpm --filter @liiiraa/desktop exec tauri build
  found: beforeBuildCommand executou pnpm build; release compilou e o NSIS Liiiraa Boost_0.0.0_x64-setup.exe foi gerado.
  implication: A cadeia completa configurada foi exercitada com sucesso.
- timestamp: 2026-07-28T17:23:00-03:00
  checked: Novo target/release/liiiraa-desktop.exe
  found: OptionalHeader.Subsystem = 2 (WINDOWS_GUI); os nomes assets/index-BOK4q20m.js e assets/index--cudO--4.css estão presentes no PE.
  implication: O release não solicita console e agora incorpora o output Vite referenciado por index.html.
- timestamp: 2026-07-28T17:25:00-03:00
  checked: Launch controlado do novo executável release
  found: Após 5 segundos o processo permanecia ativo com MainWindowHandle não nulo, título "Liiiraa Boost" e documento WebView acessível "Liiiraa Boost - Conteúdo da Web"; o processo de teste foi encerrado em seguida.
  implication: O host abriu a interface gráfica/WebView em vez de terminar com asset not found; por ser PE GUI, nenhuma janela de console é criada.
- timestamp: 2026-07-28T17:29:00-03:00
  checked: Regressão completa
  found: cargo test -p liiiraa-desktop passou 22 testes em 5 suites; pnpm --filter @liiiraa/desktop check passou.
  implication: A correção não introduziu regressões detectadas no host Rust nem no typecheck desktop.
- timestamp: 2026-07-28T17:39:00-03:00
  checked: Confirmação humana e screenshot da interface instalada
  found: O terminal e asset not found desapareceram, mas a WebView mostra apenas fundo #070b0f sem conteúdo visível.
  implication: O carregamento do documento/CSS ocorre; a verificação anterior por janela ativa foi insuficiente e há um novo defeito no bootstrap/renderização.
- timestamp: 2026-07-28T17:45:00-03:00
  checked: WebView2 via CDP no release
  found: document.body.innerText, #root.innerHTML estão vazios; console/pageerror reporta violação CSP por avaliação de string como JavaScript.
  implication: O bundle é carregado, mas falha antes do React montar.
- timestamp: 2026-07-28T17:46:00-03:00
  checked: packages/contracts-ts/src/validation.ts e bundle Vite
  found: O módulo cria Ajv2020 e compila validadores no top-level; o bundle contém o gerador Ajv que usa new Function.
  implication: A validação runtime depende de unsafe-eval, incompatível com a CSP deliberadamente restritiva.
- timestamp: 2026-07-28T17:50:00-03:00
  checked: validation.csp.test.ts
  found: RED — 1 teste falhou; import de validation.js rejeitou com EvalError em Ajv2020.compileSchema ao bloquear Function.
  implication: O teste reproduz exatamente o mecanismo CSP que mantém #root vazio na WebView.
- timestamp: 2026-07-28T18:08:00-03:00
  checked: Validadores standalone, contratos, build e CDP
  found: contracts-ts 22/22, typechecks passaram, release/NSIS gerados; CDP mostrou rootLength 972, conteúdo visível e zero pageerror.
  implication: O desktop renderiza UI real sem unsafe-eval nem violações CSP.
- timestamp: 2026-07-28T18:21:00-03:00
  checked: Confirmação humana, main.rs e ciclo NativeDesktopApp
  found: Host emite installer/opening/ready dentro de setup; bridge registra listener apenas no useEffect posterior; eventos não são persistidos/reproduzidos.
  implication: NativeState conserva o splash inicial e installerIdentity indefinido para sempre.
- timestamp: 2026-07-28T18:22:00-03:00
  checked: Locale inicial
  found: NativeDesktopApp recebe windowsLocale indefinido no bootstrap real; loadDesktopPreferences delega undefined a createDefaultPreferences, cujo fallback é en-US.
  implication: O inglês observado é determinístico e independente do locale brasileiro do sistema.
- timestamp: 2026-07-28T18:26:00-03:00
  checked: Testes direcionados de handshake e locale
  found: RED — 2 falhas/9 passes; bridge.start não chama get_shell_bootstrap após listen e fallback desktop retorna en-US.
  implication: Os testes reproduzem separadamente o startup preso e o locale inicial incorreto.
- timestamp: 2026-07-28T18:40:00-03:00
  checked: Implementação GREEN e guardrails estáticos
  found: ShellEventBridge solicita get_shell_bootstrap somente depois de listen; o host retorna eventos validados de identidade/ready; preferences usa pt-BR enquanto windowsLocale está ausente; capability e teste exigem somente core:event:allow-listen e exatamente dois comandos Tauri limitados.
  implication: A correção fecha a corrida e o fallback sem relaxar CSP nem introduzir uma API nativa genérica; regressões completas e validação do bundle ainda são necessárias.
- timestamp: 2026-07-28T18:44:00-03:00
  checked: Regressões focadas após GREEN
  found: Desktop unit 61/61, desktop TypeScript check, Rust host 23/23 e contracts-ts 22/22 passaram.
  implication: Handshake, locale, contratos, capability e host estão verdes; resta provar o comportamento no release WebView/NSIS.
- timestamp: 2026-07-28T18:48:00-03:00
  checked: Primeiro release GREEN via CDP com estado local legado
  found: O splash initializing-webview desapareceu e o handoff do instalador apareceu, mas documentElement.lang permaneceu en-US porque localStorage continha liiiraa.desktop.preferences.v1 com o antigo default automático.
  implication: O fallback vazio resolve novas instalações, mas não a instalação de teste já contaminada pelo bug; é necessária migração pontual, não override permanente de escolhas explícitas.
- timestamp: 2026-07-28T18:50:00-03:00
  checked: Teste e implementação da migração de preferências
  found: RED reproduziu en-US preservado pelo v1; GREEN 8/8 migra somente o locale legado ao default pt-BR, preserva density/tray e grava escolhas futuras sob v2.
  implication: A instalação existente deve corrigir o idioma uma vez sem impedir que o usuário selecione inglês explicitamente depois.
- timestamp: 2026-07-28T18:55:00-03:00
  checked: Regressão e rebuild finais após migração
  found: Desktop unit 62/62, TypeScript check, Rust host 23/23 e contracts-ts 22/22 passaram; tauri build gerou novo release e NSIS com sucesso.
  implication: A migração adicional não introduziu regressões e está presente no artefato entregue.
- timestamp: 2026-07-28T19:00:00-03:00
  checked: Release final via WebView2 CDP
  found: Com o v1 en-US legado ainda presente, documentElement.lang foi pt-BR e v2 foi gravado; reload mostrou handoff em PT-BR, sem splash antigo, zero pageerror e zero console error; após Continuar e Abrir o Liiiraa Boost, rootLength 15877 e conteúdo Calibração guiada ficaram visíveis.
  implication: O release fecha a corrida, migra o locale legado e alcança a rota principal; falta somente confirmação humana do NSIS.
- timestamp: 2026-07-28T19:02:00-03:00
  checked: Handoff do artefato
  found: NSIS final existe com 4.415.659 bytes; git diff --check passou; schemas transitórios de apps/desktop/src-tauri/gen foram removidos e o processo de verificação foi encerrado.
  implication: O workspace contém somente mudanças intencionais e o instalador está pronto para verificação humana.

## Eliminated

## Resolution

- root_cause: "A cadeia teve quatro causas independentes: assets Vite não eram declarados ao Tauri; o PE release era CUI; Ajv compilava schemas com unsafe-eval bloqueado pela CSP; e eventos de startup eram emitidos antes de listen sem replay. O inglês persistia porque windowsLocale ausente criou e salvou en-US no storage v1."
- fix: "Declarados beforeBuildCommand/frontendDist e subsistema Windows GUI; Ajv runtime foi substituído por validadores standalone; concedida somente core:event:allow-listen; adicionado get_shell_bootstrap validado após listen; fallback inicial pt-BR e migração pontual do storage v1 para v2 preservando preferências benignas."
- verification: "Desktop unit 62/62, TypeScript check, Rust 23/23 e contracts 22/22 passaram; build/NSIS concluíram. CDP no release final confirmou pt-BR mesmo com v1 legado, zero page/console errors, ausência do splash preso e rota Calibração guiada após os acknowledgments. Pendente somente confirmação humana do NSIS."
- files_changed:
  - apps/desktop/src-tauri/tests/packaged_startup.rs
  - apps/desktop/src-tauri/tauri.conf.json
  - apps/desktop/src-tauri/src/main.rs
  - apps/desktop/src-tauri/capabilities/default.json
  - apps/desktop/src-tauri/tests/shell_contract.rs
  - packages/contracts-ts/src/validation.csp.test.ts
  - packages/contracts-ts/src/validation.ts
  - packages/contracts-ts/scripts/generate-standalone.mjs
  - packages/contracts-ts/src/generated/standalone-validators.js
  - packages/contracts-ts/src/generated/standalone-validators.d.ts
  - apps/desktop/src/native/shell-bridge.test.ts
  - apps/desktop/src/native/shell-bridge.ts
  - apps/desktop/src/preferences.test.tsx
  - apps/desktop/src/preferences.tsx
  - .planning/debug/console-missing-index-html.md
