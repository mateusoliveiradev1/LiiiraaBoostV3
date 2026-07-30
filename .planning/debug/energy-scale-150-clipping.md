---
status: resolved
trigger: 'Na escala interna de 150%, a rota Planos de energia corta os cartões inferiores.'
created: 2026-07-30T12:57:46.2906241-03:00
updated: 2026-07-30T13:19:21.2557640-03:00
---

# Debug Session: Energy Scale 150 Clipping

## Symptoms

- expected: A rota Planos de energia deve continuar navegável em 150%, com todos os cartões e controles alcançáveis.
- actual: Os cartões inferiores ficam cortados no limite inferior da janela.
- errors: Nenhuma mensagem de erro; falha visual de reflow/rolagem.
- timeline: Observado na validação final da build atual.
- reproduction: Abrir Planos de energia e selecionar escala interna de 150%.

## Current Focus

hypothesis: Confirmada — uma regra antiga adiciona padding ao `<main>` premium e o grid recomendado usa breakpoint da viewport física, não a largura lógica reduzida pela escala.
test: Executar a rota `/power` em 1432 × 871 com escala interna 150%, exigir um único eixo vertical e conferir os limites de conteúdo, métricas e ação.
expecting: Nenhum overflow horizontal, scroll vertical alcançável e scrollport ocupando toda a altura disponível.
next_action: Resolvido e confirmado visualmente pelo usuário na build instalada.

## Evidence

- timestamp: 2026-07-30T12:57:46.2906241-03:00
  observation: A captura mostra a rota em 150% com os cartões da segunda linha cortados no limite inferior da janela.
- timestamp: 2026-07-30T12:57:46.2906241-03:00
  observation: `.premium-route-content` é o scrollport interno, enquanto `.desktop-work-canvas:has(> .premium-operations)` oculta o overflow externo.
- timestamp: 2026-07-30T12:57:46.2906241-03:00
  observation: A escala interna usa `zoom: 1.5` em um shell redimensionado para 66,67% da viewport.
- timestamp: 2026-07-30T13:12:01.5278432-03:00
  observation: O teste reproduziu `scrollWidth: 927` para `clientWidth: 635` antes da correção.
- timestamp: 2026-07-30T13:12:01.5278432-03:00
  observation: A regra antiga aplicava `padding: 30px ... 48px` ao `<main>` premium; em 150% isso criava aproximadamente 45px no topo e 72px vazios embaixo.
- timestamp: 2026-07-30T13:12:01.5278432-03:00
  observation: Após o override e a container query, o teste focado passa, o card recomendado permanece contido e o último plano é alcançável por rolagem.
- timestamp: 2026-07-30T13:19:21.2557640-03:00
  observation: O usuário confirmou visualmente que a tela Planos de energia foi corrigida na build instalada.

## Eliminated

- hypothesis: A rolagem vertical estava completamente desativada.
  reason: O scrollTop do `.premium-route-content` avançava até o final; a falha era o viewport encurtado e o overflow horizontal do grid recomendado.

## Resolution

root_cause: Padding legado aplicado ao shell premium e breakpoint baseado na viewport física sob `zoom`.
fix: Zerar o padding externo do `<main>` premium e adaptar a rota de energia pela largura real do contêiner.
verification: 45/45 testes Chromium, TypeScript, ESLint, Prettier e diff-check passaram; validação humana da build instalada confirmada.
files_changed: apps/desktop/src/accessibility-preferences.css, apps/desktop/tests/browser/appearance-responsive.spec.ts
