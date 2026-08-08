---
status: resolved
trigger: "O workflow phase-4-surfaces falha com Project staging-origin not found in the worker process"
created: 2026-08-08
updated: 2026-08-08
---

# Debug Session: Playwright project worker drift

## Symptoms

- expected: `playwright test tests/security-artifacts.spec.ts --grep @staging-origin-smoke --workers=1` seleciona e executa o projeto `staging-origin` tanto no coordenador quanto no worker.
- actual: o coordenador inicia a execução, mas o worker recarrega uma lista de projetos que não contém `staging-origin`.
- errors: `Project "staging-origin" not found in the worker process. Make sure project name does not change.`
- timeline: observado no run GitHub Actions `31250376676`, após o deploy saudável da API no commit `46ee4e9b53bf6b3dc723bb240026c0524019c259`.
- reproduction: executar o smoke `@staging-origin-smoke` com um worker pelo comando acima ou disparar `phase-4-surfaces.yml` com `bounded-provider-preview`.

## Current Focus

- hypothesis: confirmada e corrigida; marcadores herdáveis mantêm a configuração coordenador/worker estável.
- test: verificação focada concluída; sessão arquivada e padrão registrado na knowledge base.
- expecting: commit atômico contendo somente configuração, regressão e os dois artefatos de debug.
- next_action: revisar o stage exato e criar o commit sem incluir artefatos temporários não relacionados
- reasoning_checkpoint:
    hypothesis: `stagingOriginRun` e `productionAuthorityRun` são recalculados no worker apenas a partir de `process.argv`; como o worker não recebe o filtro CLI original, ele constrói uma lista sem o projeto que o coordenador atribuiu.
    confirming_evidence:
      - a configuração define ambos os booleanos exclusivamente com `process.argv.slice(2)` e condiciona diretamente a inclusão dos projetos
      - a reprodução exata lista `[staging-origin]` no coordenador e falha no worker com `Project "staging-origin" not found in the worker process`
    falsification_test: se uma recarga da configuração com argv vazio ainda contiver `staging-origin` após a carga inicial com `@staging-origin-smoke`, a hipótese estará errada
    fix_rationale: persistir o modo condicional em variável de ambiente durante a carga do coordenador fornece ao worker um marcador herdável e mantém idêntica a lista de projetos
    blind_spots: a reprodução local confirma staging-origin; production-authority compartilha a mesma implementação condicional, mas ainda não foi executado end-to-end por depender do harness HTTPS
- tdd_checkpoint:
    test_file: tooling/web-evidence/src/playwright-config.test.ts
    test_name: keeps the $project project when a worker reloads config without CLI filters
    status: green
    failure_output: `2 failed | 4 passed`; em ambos os casos, `expected [ 'public-quick', …(29) ] to include` o projeto condicional na linha 68

## Evidence

- timestamp: 2026-08-08
  checked: instruções do repositório e estado do worktree
  found: não há project skills declaradas; o debug file e vários artefatos temporários preexistentes estão untracked
  implication: a investigação seguirá as regras globais/GSD e preservará todos os artefatos não relacionados

- timestamp: 2026-08-08
  checked: .planning/debug/knowledge-base.md e busca por referências Playwright
  found: nenhuma entrada da base tem sobreposição com o erro; playwright.config.ts calcula stagingOriginRun e productionAuthorityRun a partir de process.argv, e há um teste de configuração dedicado
  implication: não há padrão conhecido para priorizar; a hipótese de drift de configuração tem um ponto de teste unitário focado

- timestamp: 2026-08-08
  checked: implementação completa de tooling/web-evidence/playwright.config.ts e src/playwright-config.test.ts
  found: `stagingOriginRun` é calculado exclusivamente de `process.argv.slice(2)`; o teste atual valida apenas `selectWebTestSurfaces(arguments_)`, não a estabilidade da lista de projetos entre processos
  implication: a cobertura existente prova que daemons locais ficam desligados, mas não detecta que o worker recebe argumentos diferentes do coordenador

- timestamp: 2026-08-08
  checked: reprodução exata `playwright test tests/security-artifacts.spec.ts --grep @staging-origin-smoke --workers=1`
  found: o coordenador iniciou 1 teste no projeto `[staging-origin]`, e o worker falhou imediatamente com `Project "staging-origin" not found in the worker process`
  implication: confirma diretamente que a lista de projetos diverge entre os processos, antes de qualquer mudança de produção

- timestamp: 2026-08-08
  checked: teste de regressão focado src/playwright-config.test.ts
  found: 4 testes existentes passaram; os 2 novos casos falharam somente no segundo carregamento, omitindo respectivamente `staging-origin` e `production-authority`
  implication: o teste RED reproduz de forma mínima o drift coordenador/worker para ambos os projetos condicionais e está pronto para guiar a correção

- timestamp: 2026-08-08
  checked: teste GREEN focado src/playwright-config.test.ts
  found: 6 de 6 testes passaram, incluindo as recargas de staging-origin e production-authority sem filtros CLI
  implication: os marcadores herdáveis estabilizam a lista de projetos no modelo unitário coordenador/worker

- timestamp: 2026-08-08
  checked: reprodução Playwright original com @staging-origin-smoke e --workers=1
  found: o teste executou no projeto `[staging-origin]` e passou; o erro `Project not found in the worker process` não ocorreu
  implication: a correção elimina o sintoma original no caminho real coordenador/worker

- timestamp: 2026-08-08
  checked: Prettier focado nos dois arquivos alterados
  found: ambos exigem apenas normalização de estilo
  implication: aplicar o formatter do repositório antes dos checks finais; não altera o mecanismo da correção

- timestamp: 2026-08-08
  checked: TypeScript check do pacote @liiiraa/web-evidence
  found: `tsc -p tsconfig.json --noEmit` passou
  implication: implementação e regressão permanecem válidas sob os tipos strict do pacote

- timestamp: 2026-08-08
  checked: Vitest focado e Prettier após normalização
  found: 6 de 6 testes passaram novamente; os dois arquivos alterados estão formatados
  implication: a correção permanece GREEN após a formatação e atende aos gates locais focados

- timestamp: 2026-08-08
  checked: revisão final de diff e git diff --check
  found: apenas playwright.config.ts e seu teste de regressão têm mudanças de código; não há whitespace inválido e artefatos temporários não relacionados permanecem intocados
  implication: o conjunto está pronto para arquivamento e commit atômico com paths explícitos

- timestamp: 2026-08-08
  checked: arquivamento da sessão e atualização de knowledge-base.md
  found: sessão movida para `.planning/debug/resolved/` e padrão persistente registrado com causa, correção e arquivos
  implication: os artefatos de diagnóstico estão completos e prontos para o mesmo commit atômico da correção

## Eliminated

## Resolution

- root_cause: `tooling/web-evidence/playwright.config.ts` inclui projetos condicionais usando apenas argumentos CLI locais; Playwright não preserva `--grep` no argv do worker, então a recarga da configuração remove `staging-origin`/`production-authority` e invalida o projeto escolhido pelo coordenador.
- fix: detectar os modos condicionais no coordenador, persistir marcadores internos com valor exato `1` em `process.env` e reutilizá-los quando o worker recarrega a configuração sem os filtros CLI.
- verification: regressão Vitest 6/6; reprodução Playwright original 1/1 com um worker; TypeScript strict e Prettier focados aprovados.
- files_changed:
    - tooling/web-evidence/playwright.config.ts
    - tooling/web-evidence/src/playwright-config.test.ts
