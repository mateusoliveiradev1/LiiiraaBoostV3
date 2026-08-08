---
status: resolved
trigger: "O CI completo falha em Linux e Windows porque a tecla Home não troca #desktop-locale de en-US para pt-BR"
created: 2026-08-08
updated: 2026-08-08T08:10:00-03:00
---

# Debug Session: Desktop locale Home key

## Symptoms

- expected: o percurso de acessibilidade por teclado seleciona `pt-BR` no controle `#desktop-locale` e a interface passa a expor o rótulo `Idioma`.
- actual: após focar o seletor e pressionar `Home`, o valor continua `en-US` em Chromium no Linux e no Windows.
- errors: `Expected: "pt-BR"`, `Received: "en-US"` em `apps/desktop/tests/browser/accessibility.spec.ts:171`.
- timeline: observado no run GitHub Actions `31250143815` do commit `46ee4e9b53bf6b3dc723bb240026c0524019c259`; 84 outros testes passaram em cada sistema.
- reproduction: executar somente o teste `@a11y-visual-smoke completes command, F6, route, locale, and settings journeys by keyboard` do Playwright desktop.

## Current Focus

- hypothesis: confirmado — o `requestAnimationFrame` pendente de `focusHeading` rouba foco de uma interação posterior porque o callback foca o `h1` incondicionalmente.
- test: verificação concluída: GREEN focado + 10 repetições, TypeScript, formatação das regiões alteradas e diff check.
- expecting: resolvido; nenhuma ação técnica pendente.
- next_action: arquivar a sessão, registrar knowledge base e criar commits GSD restritos aos arquivos desta correção
- reasoning_checkpoint:
    hypothesis: "O foco assíncrono de heading, agendado por navigate antes de setRoute, causa o RED porque executa depois de locale.focus e muda document.activeElement para h1 antes de Home."
    confirming_evidence:
      - "app.tsx agenda focusHeading por requestAnimationFrame sem cancelamento ou guarda e foca o h1 incondicionalmente."
      - "Atrasar somente o próximo frame de Control+, por 100 ms reproduziu exatamente Expected pt-BR / Received en-US no único caso focado."
      - "Sem o atraso controlado, o mesmo caso e seus predecessores passam, explicando a dependência de velocidade do runner."
    falsification_test: "Se uma guarda que rejeita foco obsoleto quando document.activeElement mudou não fizer o mesmo teste RED passar, a corrida de foco não é a causa suficiente."
    fix_rationale: "Impedir callbacks de foco obsoletos preserva a intenção de focar o heading após navegação, mas não sobrescreve uma interação de foco mais recente do usuário."
    blind_spots: "Ainda não há reexecução nos runners ubuntu-24.04/windows-2025; a flake posterior do switch Space é separada e não está coberta por esta correção."
- tdd_checkpoint:
    test_file: "apps/desktop/tests/browser/accessibility.spec.ts"
    test_name: "@a11y-visual-smoke completes command, F6, route, locale, and settings journeys by keyboard"
    status: "green"
    failure_output: "RED anterior: Locator #desktop-locale; Expected pt-BR; Received en-US. GREEN: 11 execuções consecutivas passaram."

## Evidence

- timestamp: 2026-08-08T06:38:04-03:00
  checked: estado do worktree e descoberta de skills locais
  found: o commit existente permanece intocado; há somente arquivos não rastreados, incluindo esta sessão e artefatos preexistentes. Não existem `.codex/skills` nem `.agents/skills` no projeto.
  implication: a investigação pode prosseguir sem sobrepor mudanças rastreadas nem regras de skill adicionais.
- timestamp: 2026-08-08T06:38:04-03:00
  checked: `apps/desktop/playwright.config.ts`, `accessibility.spec.ts` e `PreConsentLocaleControl`
  found: o teste foca um `<select>` controlado cujo primeiro item é `pt-BR`, pressiona `Home` e espera `pt-BR`; o arquivo `.spec.ts` é coletado pelo projeto `chromium`, enquanto os projetos matriciais aceitam apenas `.browser.spec.ts`.
  implication: não há evidência de project drift para este arquivo; a próxima observação deve reproduzir a semântica de teclado no único projeto aplicável.
- timestamp: 2026-08-08T06:41:00-03:00
  checked: primeira execução focada via lifecycle no projeto `chromium`
  found: o Playwright abortou antes de coletar/executar o teste porque `127.0.0.1:4173` já está em uso e `reuseExistingServer` é falso.
  implication: ainda não existe evidência RED do bug; é preciso isolar o conflito ambiental antes de testar a hipótese de teclado.
- timestamp: 2026-08-08T06:44:00-03:00
  checked: processo que escuta na porta 4173 e conteúdo HTTP servido
  found: PID 19768 é `node scripts/dev-server.mjs`, órfão de um `nohup`, e serve a aplicação não relacionada “Zera Junto”, não o desktop Liiiraa Boost.
  implication: encerrar o processo violaria preservação de trabalho alheio; a reprodução deve usar uma porta isolada.
- timestamp: 2026-08-08T06:47:00-03:00
  checked: primeira execução com config temporária na porta 4174
  found: o Vite desktop iniciou em 4174, mas `openDesktopTestCase` navegou para a constante `DESKTOP_APP_URL` em 4173 e não encontrou `.desktop-app-shell`.
  implication: a falha não testa `Home`; é necessário alinhar temporariamente a constante do helper com a porta isolada, sem modificar a interação observada.
- timestamp: 2026-08-08T06:50:00-03:00
  checked: execução focada isolada com helper temporariamente apontado para o desktop em 4174
  found: o único caso passou em 480 ms; após `focus()` e `Home`, o locale tornou-se `pt-BR` no Chromium local atual.
  implication: a hipótese de falha universal da tecla `Home` está eliminada; é preciso localizar a diferença temporal/ambiental antes de produzir RED genuíno.
- timestamp: 2026-08-08T07:00:00-03:00
  checked: HEAD, histórico/diffs relevantes e logs do GitHub Actions 31250143815
  found: HEAD é exatamente `e61e293`; não há diff em teste, helper, preferências, config desktop ou lockfile desde `46ee4e9`. O full gate executou `playwright test --config playwright.config.ts`; Linux e Windows falharam no mesmo valor `en-US`, enquanto os outros 84 casos passaram.
  implication: a divergência não vem de código/versão alterado; as hipóteses restantes são semântica de entrada dependente de ambiente ou interferência/carga da execução completa.
- timestamp: 2026-08-08T07:06:00-03:00
  checked: 20 repetições locais somente do caso focado no Chromium
  found: a etapa de locale passou em todas as repetições; 19 jornadas completas passaram e uma falhou posteriormente porque o switch de movimento permaneceu desmarcado após `Space`.
  implication: `Home` não é uma transição confiavelmente idêntica entre ambientes, e o reducer/controle de locale funciona quando o browser produz a mudança. A falha posterior de `Space` é uma flake distinta e não explica o RED de locale no CI.
- timestamp: 2026-08-08T07:12:00-03:00
  checked: Actions artifacts API e metadados dos jobs do run 31250143815
  found: existem somente `full-linux-failure` (182 bytes) e `full-windows-failure` (184 bytes), descritos pelo workflow como metadados redigidos; nenhum artifact de trace, screenshot ou `test-results` foi publicado. Runners foram `ubuntu-24.04` e `windows-2025`.
  implication: o trace citado pelo log existiu apenas no workspace efêmero do runner; os pequenos artefatos ainda serão lidos para excluir referência recuperável.
- timestamp: 2026-08-08T07:16:00-03:00
  checked: conteúdo baixado de `full-linux-failure` e `full-windows-failure`
  found: os arquivos contêm somente `{"job":"full-linux","status":"failed"}` e `{"job":"full-windows","status":"failed"}`.
  implication: a via de artifact/trace está encerrada; o diretório temporário foi removido e a investigação passa a delta-debugging de ordem.
- timestamp: 2026-08-08T07:20:00-03:00
  checked: execução estreita da auditoria de 59 pares seguida da jornada alvo no mesmo worker Chromium
  found: ambos passaram; a auditoria levou 32,3 s e a jornada selecionou `pt-BR` em 465 ms.
  implication: o predecessor Chromium imediato não causa o RED de locale.
- timestamp: 2026-08-08T07:20:00-03:00
  checked: ordinal do caso no log Windows do full gate
  found: o alvo foi o teste 3 de 85; antes dele rodaram apenas `harness.config.pw.ts` no projeto harness (teste 1) e a auditoria de 59 pares (teste 2).
  implication: não há outros specs anteriores para delta-debug; resta reproduzir a combinação multi-project exata ou concluir dependência de runner.
- timestamp: 2026-08-08T07:28:00-03:00
  checked: reprodução dos três primeiros casos com grafo completo de 147 projetos
  found: harness, auditoria e jornada passaram; o alvo selecionou `pt-BR` em 417 ms.
  implication: toda ordem predecessora e seleção multi-project do full gate estão eliminadas localmente.
- timestamp: 2026-08-08T07:28:00-03:00
  checked: browser instalado no CI e manifesto Playwright local
  found: ambos usam Playwright 1.62.0 com Chromium/Chrome Headless Shell 151.0.7922.34 revision 1234; Windows CI usa Windows Server 2025 e Linux CI usa Ubuntu 24.04.
  implication: não há drift de versão do browser; resta variável de ambiente CI, plataforma runner ou flake rara.
- timestamp: 2026-08-08T07:33:00-03:00
  checked: reprodução dos três primeiros casos com `CI=true`
  found: os três passaram e o alvo selecionou `pt-BR` em 446 ms.
  implication: a variável CI simples não reproduz; a duração de 6 s no alvo CI versus ~0,45 s local sugere uma espera de asserção causada por evento/foco perdido, possivelmente corrida de foco após navegação.
- timestamp: 2026-08-08T07:39:00-03:00
  checked: implementação completa de navegação e foco em `routes.tsx`/`app.tsx`
  found: `navigate()` chama `focusHeading()` antes de `setRoute`; `focusHeading()` usa `deferFocus`, que agenda um `requestAnimationFrame` sem guarda ou cancelamento e depois foca o `h1` incondicionalmente. O teste aguarda apenas `data-route-path`/label antes de focar o locale.
  implication: existe uma corrida concreta e falsificável: o frame pendente pode sobrescrever uma interação de foco posterior do usuário/teste.
- timestamp: 2026-08-08T07:43:00-03:00
  checked: caso focado com somente o próximo frame de `Control+,` atrasado em 100 ms
  found: o teste falhou deterministicamente em 5,6 s na mesma asserção do CI; `#desktop-locale` permaneceu `en-US` após `Home`.
  implication: a corrida de foco assíncrono é causa suficiente do sintoma e existe RED TDD local antes de qualquer correção de produção.
- timestamp: 2026-08-08T07:53:00-03:00
  checked: primeira implementação GREEN que cancela heading após qualquer `focusin`
  found: o caso falhou antes, em `Control+1`, porque o `h1` não recebeu foco; uma restauração de foco gerenciada pelo próprio app reivindicou ownership indevidamente.
  implication: ownership deve distinguir foco gerenciado de interação externa; a causa raiz permanece, mas a primeira guarda foi ampla demais.
- timestamp: 2026-08-08T07:57:00-03:00
  checked: implementação GREEN com epoch de ownership e supressão durante foco gerenciado
  found: o único caso slow-frame passou em 628 ms; `Control+1` ainda focou o heading e `Home` mudou o locale para `pt-BR`.
  implication: a correção mínima resolve o RED sem enfraquecer os contratos adjacentes de foco.
- timestamp: 2026-08-08T08:00:00-03:00
  checked: 10 repetições do único caso slow-frame
  found: 10/10 passaram em um worker, entre 603 e 652 ms por execução.
  implication: a correção é estável sob a condição determinística que reproduzia o RED.
- timestamp: 2026-08-08T08:02:00-03:00
  checked: primeira passagem de TypeScript/Prettier scoped
  found: Prettier marcou somente `apps/desktop/src/app.tsx`; a execução paralela não retornou saída inequívoca do typecheck por causa do exit agregado.
  implication: aplicar formatação mecânica e rerodar ambos separadamente para registrar resultados conclusivos.
- timestamp: 2026-08-08T08:05:00-03:00
  checked: TypeScript do pacote desktop e Prettier nos arquivos alterados
  found: `tsc -p tsconfig.json --noEmit` passou; Prettier confirmou ambos os arquivos.
  implication: implementação e regressão são tipadas e formatadas; resta auditoria de diff e arquivamento/commit.
- timestamp: 2026-08-08T08:10:00-03:00
  checked: auditoria final de diff, formatação mínima e worktree
  found: `git diff --check` passou; Prettier passou na regressão e no intervalo alterado de `app.tsx`; o diff rastreado contém somente ownership de foco e o teste slow-frame. Arquivos temporários de porta foram removidos e artefatos não relacionados continuam intocados.
  implication: a correção está pronta para arquivamento e commit atômico restrito.

## Eliminated

- hypothesis: `Home` em `<select>` fechado sempre mantém `en-US` no Chromium deste código.
  evidence: o caso focado passou localmente no projeto Chromium atual, com a mesma sequência de foco e tecla, após isolar apenas a porta do servidor.
  timestamp: 2026-08-08T06:50:00-03:00
- hypothesis: a auditoria de 59 pares no mesmo worker Chromium causa o RED do caso seguinte.
  evidence: a execução estreita dos dois casos, em ordem e com um worker, passou integralmente.
  timestamp: 2026-08-08T07:20:00-03:00
- hypothesis: o projeto harness ou o grafo completo de 147 projetos altera o worker Chromium antes do alvo.
  evidence: a reprodução exata dos testes 1–3 com todos os nomes/projetos preservados passou integralmente.
  timestamp: 2026-08-08T07:28:00-03:00
- hypothesis: definir `CI=true` é suficiente para reproduzir o RED.
  evidence: os três primeiros casos passaram com `CI=true` e a mesma versão Chromium.
  timestamp: 2026-08-08T07:33:00-03:00
- hypothesis: qualquer evento `focusin` após agendar heading representa uma interação nova do usuário.
  evidence: a restauração gerenciada do invocador também emite `focusin` e bloqueou incorretamente o heading de `Control+1`.
  timestamp: 2026-08-08T07:53:00-03:00

## Resolution

- root_cause: `focusHeading` agenda via `requestAnimationFrame` um foco incondicional no `h1`. Em execução lenta, esse callback fica pendente até depois de o usuário/teste focar `#desktop-locale`, rouba o foco antes de `Home` e impede o evento `change`, mantendo `en-US`.
- fix: `focusHeading` registra ownership até o frame; foco externo posterior incrementa o epoch e invalida o callback obsoleto, enquanto focos gerenciados por heading/F6/overlay são explicitamente suprimidos dessa reivindicação.
- verification: caso slow-frame passou 1 vez e depois 10/10; TypeScript desktop passou; Prettier passou no teste e na região alterada de app.tsx; `git diff --check` passou; nenhum workflow amplo foi executado.
- files_changed:
  - apps/desktop/src/app.tsx
  - apps/desktop/tests/browser/accessibility.spec.ts
