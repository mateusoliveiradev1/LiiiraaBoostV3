---
status: resolved
trigger: 'Ao redimensionar a janela, botões, cabeçalhos, cartões e textos de várias rotas se sobrepõem ou ficam cortados.'
created: 2026-07-30T13:30:55.2725042-03:00
updated: 2026-07-30T14:04:46.8217156-03:00
---

# Debug Session: Responsive Resize Overflow

## Symptoms

- expected: Todas as rotas devem reorganizar navegação, cabeçalhos, barras de ação, listas e cartões para qualquer tamanho suportado da janela, sem conteúdo lateral cortado, controles sobrepostos ou barras de rolagem destoantes.
- actual: A sidebar podia permanecer larga apesar da pouca largura útil; botões do Desinstalador ficavam cortados; textos e controles de Serviços, Visão geral e Configurações se sobrepunham ou quebravam de forma ilegível.
- errors: Nenhuma mensagem de erro; falha visual de reflow responsivo.
- timeline: Observado durante validação manual da escala e do redimensionamento da build instalada.
- reproduction: Abrir diferentes rotas e reduzir progressivamente a largura da janela, especialmente com escala interna de 150%.

## Current Focus

hypothesis: Confirmada. O shell escolhia seus breakpoints pela largura física da janela sem descontar a escala interna, enquanto componentes internos usavam grids e linhas rígidas baseados na viewport em vez da largura real do contêiner.

test: Reproduzir Home, Serviços, Desinstalador e Configurações em larguras físicas de 1222, 1000 e 760 pixels, com escalas de 100%, 125% e 150%, além de redimensionamento ao vivo.

next_action: Gerar e instalar a nova build de desenvolvimento para validação humana em 100%, 125% e 150%.

## Evidence

- O teste RED mostrou a Home classificada como `standard` numa janela física de 1222 px com escala de 150%, embora a largura lógica disponível fosse de aproximadamente 815 px.
- Em Configurações, botões e controles ultrapassavam a área útil antes da correção.
- Os 21 testes dedicados de responsividade passaram, cobrindo 14 rotas, escalas de 100%, 125% e 150%, redimensionamento ao vivo, ausência de overflow e sobreposição, sidebar e scrollbars.
- A suíte Chromium completa passou: 67/67 testes.
- TypeScript do desktop, TypeScript do design system e ESLint passaram.

## Eliminated

- A largura mínima da janela, isoladamente, não era a causa: o problema aparecia em larguras físicas maiores quando a escala interna reduzia a largura lógica.
- O defeito não era exclusivo da sidebar: grids e barras de ação internos também precisavam responder à largura do próprio contêiner.

## Resolution

root_cause: O cálculo responsivo ignorava a escala efetiva e vários componentes dependiam de media queries da viewport física ou estruturas rígidas, causando uma classificação de layout incorreta e reflow incompleto.

fix: O shell agora usa a largura lógica (`largura física / escala efetiva`) para escolher o layout. Foram adicionadas regras adaptativas por contêiner para as rotas afetadas, sidebar compacta estável, quebra segura de controles e um tratamento global premium e consistente para todas as barras de rolagem.

verification: 21/21 testes novos de responsividade e 67/67 testes Chromium passaram, incluindo as escalas de 100%, 125% e 150%, redimensionamento ao vivo e validação visual dos scrollbars.

files_changed:

- apps/desktop/src/app.tsx
- apps/desktop/src/adaptive-layout.css
- apps/desktop/index.html
- packages/design-system/src/shell.tsx
- apps/desktop/tests/browser/adaptive-window-resize.spec.ts
- eslint.config.mjs
