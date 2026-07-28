---
phase: 02-complete-desktop-experience
plan: '04'
subsystem: desktop-testing
tags: [storybook, playwright, axe, keyboard, deterministic-fixtures, scenario-parity]
requires:
  - phase: 02-03
    provides: Catálogo canônico e imutável S01-S24
  - phase: 02-15
    provides: Ciclo de verificação desktop limitado e fail-closed
provides:
  - Matriz determinística de 144 combinações visuais para Playwright
  - Decoradores Storybook para viewport, idioma, escala, movimento e cores forçadas
  - Fixtures congeladas de relógio, IDs, semente, latência e gráficos
  - Helpers de teclado e axe com bloqueio de violações sérias/críticas
  - Manifesto de histórias derivado do único catálogo canônico S01-S24
affects: [desktop-ui, feature-shell, visual-regression, desktop-e2e, phase-02-evidence]
tech-stack:
  added: []
  patterns:
    - Eixos visuais são gerados programaticamente a partir de dimensões fechadas
    - Cobertura de histórias referencia e deriva o catálogo canônico sem persistir uma segunda lista
key-files:
  created:
    - apps/desktop/.storybook/main.ts
    - apps/desktop/.storybook/preview.tsx
    - apps/desktop/playwright.config.ts
    - apps/desktop/tests/browser/fixtures.ts
    - apps/desktop/tests/browser/keyboard.ts
    - apps/desktop/tests/browser/axe.ts
    - apps/desktop/tests/browser/harness.config.pw.ts
    - apps/desktop/tests/browser/story-parity.test.mjs
    - tooling/desktop-evidence/story-manifest.json
  modified:
    - .gitignore
    - eslint.config.mjs
key-decisions:
  - 'Gerar 144 projetos Playwright a partir do produto cartesiano dos cinco eixos visuais bloqueados, mais projetos dedicados ao harness e Storybook.'
  - 'Persistir no manifesto somente a referência canônica, a regra S01-S24 e os eixos visuais; pares rota/estado são derivados em execução.'
  - 'Validar mutações contra uma projeção do próprio catálogo canônico, sem importar caminhos privados de outro módulo.'
patterns-established:
  - 'Fixture browser: cenário sintético marcado e congelado antes de qualquer script de página.'
  - 'Paridade de histórias: catálogo JSON -> derivação efêmera -> diagnóstico estável de omissão, excesso, duplicação ou renomeação.'
requirements-completed:
  [UX-02, UX-03, UX-04, UX-05, UX-06, UX-07, UX-08, UX-09, UX-10, UX-11, UX-12]
duration: 24min
completed: 2026-07-28
status: complete
---

# Phase 02 Plan 04: Harness determinístico de componentes e navegador

**Storybook e Playwright agora expõem todos os eixos visuais bloqueados com fixtures sintéticas congeladas, enquanto a cobertura S01-S24 deriva rotas e estados diretamente do catálogo canônico.**

## Performance

- **Duration:** 24 min
- **Started:** 2026-07-28T02:24:00Z
- **Completed:** 2026-07-28T02:47:30Z
- **Tasks:** 2
- **Files modified:** 11

## Accomplishments

- Configurou Storybook React-Vite com telemetria desabilitada, quatro viewports e controles determinísticos para idioma, escala, movimento e contraste.
- Gerou 144 projetos Playwright para o produto cartesiano completo dos eixos bloqueados, além dos projetos `harness` e `storybook`.
- Congelou relógio, UUIDs, aleatoriedade, semente, latência e amostras de gráfico antes da execução de scripts da página, sempre com marcador `SIMULATED SCENARIO`.
- Adicionou jornadas exclusivamente por teclado e auditoria axe que rejeita violações `serious` ou `critical`.
- Criou um manifesto sem lista duplicada de cenários/rotas/estados; o teste focado deriva todos os pares do catálogo canônico e cobre mutações de omissão, excesso, duplicação e renomeação.

## Task Commits

1. **Task 1: Configure deterministic component and browser harnesses** - `6e6bd6c` (chore)
2. **Task 1 correction: Isolate Playwright smoke discovery** - `b299162` (fix)
3. **Task 2 RED: Specify canonical story parity** - `a70fedf` (test)
4. **Task 1 correction: Align pinned Playwright/axe APIs** - `164f017` (fix)
5. **Task 2 GREEN: Derive story evidence from canonical scenarios** - `7b2ebef` (feat)
6. **Task 1 verification: Assert all 146 Playwright projects** - `9a62423` (test)
7. **Task 2 correction: Preserve public module boundaries** - `f38ff1c` (fix)

## Files Created/Modified

- `apps/desktop/.storybook/main.ts` - Configuração React-Vite sem telemetria nem modo watch.
- `apps/desktop/.storybook/preview.tsx` - Decorador e toolbars para todos os eixos visuais bloqueados.
- `apps/desktop/playwright.config.ts` - Matriz visual completa, snapshots determinísticos e projetos separados.
- `apps/desktop/tests/browser/fixtures.ts` - Fixture `desktopTest` e `freezeDesktopScenario`.
- `apps/desktop/tests/browser/keyboard.ts` - `runKeyboardJourney` e asserção de foco.
- `apps/desktop/tests/browser/axe.ts` - `expectNoAxeViolations` com bloqueio sério/crítico.
- `apps/desktop/tests/browser/harness.config.pw.ts` - Smoke sem navegador que comprova os 146 projetos configurados.
- `apps/desktop/tests/browser/story-parity.test.mjs` - Derivação e mutações de paridade S01-S24.
- `tooling/desktop-evidence/story-manifest.json` - Referência canônica e eixos visuais autorados.
- `.gitignore` - Saídas locais de Playwright e Storybook ignoradas.
- `eslint.config.mjs` - Cobertura type-aware dos novos arquivos de configuração e browser.

## Decisions Made

- A matriz completa é declarativa e programática; não há 144 configurações copiadas manualmente.
- O manifesto não contém `scenarios`, `requiredRoutes` nem `requiredStates`; somente aponta ao catálogo e define como derivar cobertura.
- O smoke do harness não abre navegador e não reivindica jornadas de produto ainda não implementadas.
- Nenhuma biblioteca, serviço, infraestrutura, segredo ou recurso pago foi adicionado.

## TDD Gate Compliance

- **RED:** `a70fedf` executou três testes e falhou porque `story-manifest.json` ainda não existia.
- **GREEN:** `7b2ebef` adicionou o manifesto mínimo derivado; os três testes passaram.
- As mutações exercitam cenário ausente, extra e duplicado, rota/estado renomeados e par rota/estado duplicado com mensagens estáveis.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Adicionado smoke Playwright listável**

- **Found during:** Task 1
- **Issue:** `playwright test --list` encerrava com erro quando nenhum teste existia.
- **Fix:** Adicionado um projeto `harness` e um teste de configuração sem navegador.
- **Files modified:** `apps/desktop/playwright.config.ts`, `apps/desktop/tests/browser/harness.config.pw.ts`
- **Verification:** O comando lista um teste e o smoke confirma 146 projetos únicos.
- **Committed in:** `6e6bd6c`, `9a62423`

**2. [Rule 3 - Blocking] Isolada a descoberta de testes Playwright e Vitest**

- **Found during:** Task 2 RED
- **Issue:** O sufixo `.spec.ts` fazia o Vitest coletar um teste Playwright e falhar antes da paridade.
- **Fix:** O smoke passou a usar o sufixo dedicado `.config.pw.ts`.
- **Files modified:** `apps/desktop/playwright.config.ts`, `apps/desktop/tests/browser/harness.config.pw.ts`, `eslint.config.mjs`
- **Verification:** Vitest coleta somente a suíte de paridade; Playwright continua listando e executando o harness.
- **Committed in:** `b299162`

**3. [Rule 1 - Bug] Corrigido uso das APIs Playwright e axe fixadas**

- **Found during:** Task 1 type/API verification
- **Issue:** `reducedMotion` deve residir em `contextOptions` no Playwright fixado e o pacote axe expõe `AxeBuilder` nominalmente.
- **Fix:** Ajustados os contextos e o import nominal.
- **Files modified:** `apps/desktop/playwright.config.ts`, `apps/desktop/tests/browser/axe.ts`
- **Verification:** Playwright smoke e ESLint type-aware passaram.
- **Committed in:** `164f017`

**4. [Rule 1 - Bug] Removido deep import privado do verificador de paridade**

- **Found during:** Gate de arquitetura
- **Issue:** O teste importava `packages/desktop-client/src/experience.ts`, violando a fronteira pública de módulos.
- **Fix:** As mutações agora são comparadas a uma projeção do catálogo canônico carregado.
- **Files modified:** `apps/desktop/tests/browser/story-parity.test.mjs`
- **Verification:** `pnpm test:architecture` passou com 34 testes e ambos os adapters.
- **Committed in:** `f38ff1c`

---

**Total deviations:** 4 auto-fixed (2 Rule 1, 2 Rule 3).
**Impact on plan:** Correções restritas à executabilidade, API fixada e fronteiras arquiteturais do harness; nenhum recurso de produto, dependência ou custo adicional.

## Issues Encountered

- O build de teste do Storybook gerou `storybook-static`; a saída foi validada, removida do checkout e permanece ignorada.
- Um typecheck ad hoc dos arquivos de tooling não pôde usar tipos Node/React que não pertencem ao manifesto desktop aprovado; os gates canônicos de Storybook, Playwright, ESLint type-aware e `apps/desktop check` passaram sem instalar dependências.

## Known Stubs

None. A ausência atual de arquivos `*.stories.tsx` é escopo explícito dos planos de componentes posteriores; este plano entrega somente o harness e não registra histórias vazias ou dados falsos de produto.

## Authentication Gates

None.

## User Setup Required

None - tudo é local e gratuito; não há serviço externo, credencial, certificado ou configuração paga.

## Verification

- `pnpm --filter @liiiraa/desktop test:wave-zero -- --browser-smoke` - PASS.
- `pnpm --filter @liiiraa/desktop test:wave-zero -- --story-parity` - PASS, 3 testes.
- `pnpm --filter @liiiraa/desktop exec playwright test --config playwright.config.ts --project harness --grep @browser-smoke` - PASS.
- `pnpm --filter @liiiraa/desktop exec playwright test --config playwright.config.ts --list` - PASS.
- `pnpm --filter @liiiraa/desktop check` - PASS.
- `pnpm test:architecture` - PASS, 34 testes e ambos os adapters.
- `pnpm contracts:check` - PASS, 8 artefatos sem drift.
- `pnpm verify:quick -- --smoke lifecycle` - PASS.
- ESLint type-aware e Prettier focados - PASS.

## Next Phase Readiness

- Planos de componentes e rotas podem adicionar histórias e specs diretamente à matriz determinística.
- A evidência visual pode resolver S01-S24 sem manter uma segunda lista de cobertura.
- Nenhum blocker do Plano 02-04 permanece.

## Self-Check: PASSED

- Todos os nove arquivos criados, dois arquivos modificados e este resumo existem no disco.
- Commits `6e6bd6c`, `b299162`, `a70fedf`, `164f017`, `7b2ebef`, `9a62423` e `f38ff1c` existem no histórico Git.
- Gates de browser, Storybook, paridade, arquitetura, contratos, lifecycle, lint e formatação passaram.
- Nenhum arquivo gerado não rastreado permanece.

---

_Phase: 02-complete-desktop-experience_
_Completed: 2026-07-28_
