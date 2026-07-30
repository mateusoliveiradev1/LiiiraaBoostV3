---
status: resolved
trigger: 'Na escala interna de 150%, a tela de login fica cortada no topo e usa rolagem na página inteira.'
created: 2026-07-30T13:19:21.2557640-03:00
updated: 2026-07-30T14:04:46.8217156-03:00
---

# Debug Session: Login Scale 150 Clipping

## Symptoms

- expected: A tela de login deve manter a barra da janela fixa, mostrar o conteúdo desde o topo e redimensionar sem rolagem horizontal em 150%.
- actual: O conteúdo começa atrás da barra superior, os títulos ficam cortados e a rolagem vertical acontece no documento inteiro.
- errors: Nenhuma mensagem de erro; falha visual de layout e scroll.
- timeline: Observado após confirmar a correção da rota Planos de energia na build atual.
- reproduction: Abrir a tela de login em uma janela aproximada de 1278 × 785 e selecionar escala interna de 150%.

## Current Focus

hypothesis: Confirmada — o breakpoint do login usa a viewport física, mas `zoom: 1.5` reduz a largura lógica do shell sem ativar o reflow de coluna única.
test: Executar `/login` em 1278 × 785 com `appScale: 150`, exigir coluna única, medir limites da titlebar, superfície e documento, e testar a rolagem interna.
expecting: Nenhum overflow no documento, conteúdo abaixo da titlebar, formulário legível em coluna única e rolagem vertical confinada à superfície de autenticação.
next_action: Construir e instalar a nova build para confirmação visual humana em 150%.

## Evidence

- timestamp: 2026-07-30T13:19:21.2557640-03:00
  observation: A captura mostra o topo do conteúdo de autenticação oculto sob a titlebar e uma barra de rolagem vertical no extremo direito do documento.
- timestamp: 2026-07-30T13:19:21.2557640-03:00
  observation: A tela permanece em duas colunas estreitas em 150%, causando quebra excessiva de texto na coluna institucional.
- timestamp: 2026-07-30T13:21:04.0000000-03:00
  observation: O teste de regressão falhou antes da correção porque `.desktop-auth-story` permanecia visível na largura lógica reduzida.
- timestamp: 2026-07-30T13:24:29.0187444-03:00
  observation: Após o reflow específico de 150%, o login usa coluna única, preserva a titlebar e mantém o formulário inteiro alcançável.
- timestamp: 2026-07-30T13:24:29.0187444-03:00
  observation: A suíte completa Chromium passou com 46/46 testes, incluindo os cinco baselines visuais existentes.
- timestamp: 2026-07-30T13:26:44.3404379-03:00
  observation: A nova build gratuita de desenvolvimento foi instalada e aberta; o executável instalado possui SHA-256 FB79B25EA413E5E2ADD0EB0B84BC305561194260EF88ED9FEF5399EDA5F87D4B.

## Eliminated

- hypothesis: O documento precisava ganhar uma nova barra de rolagem global.
  reason: O shell já possui uma linha `minmax(0, 1fr)` para a autenticação; a superfície interna é o scrollport correto e a titlebar deve permanecer fora dele.

## Resolution

root_cause: O media query de 900px avaliava os 1278px físicos da janela e não os aproximadamente 852px lógicos disponíveis após `zoom: 1.5`, mantendo a composição de duas colunas.
fix: Aplicar em `/login` com escala 150% o mesmo reflow compacto de coluna única, esconder a narrativa lateral e dimensionar o painel pela superfície interna abaixo da titlebar.
verification: Teste de regressão focado, testes responsivos, 46/46 Chromium, TypeScript e ESLint passaram; confirmação visual da build instalada pendente.
files_changed: apps/desktop/src/accessibility-preferences.css, apps/desktop/tests/browser/initial-surfaces-responsive.spec.ts
