---
status: resolved
trigger: 'Em texto do Windows a 200%, a Home sobrepõe conteúdo, a sidebar cria barras internas estranhas e as opções Escala da interface, Densidade e Contraste de dados não funcionam.'
created: 2026-07-30
updated: 2026-07-30
---

# Debug: escala de texto e preferências de aparência

## Symptoms

- Expected: texto do Windows em 200% mantém Home e sidebar utilizáveis com scroll vertical previsível; Escala da interface, Densidade e Contraste de dados alteram a UI e persistem.
- Actual: o cabeçalho da Home sobrepõe telemetria e o painel de prontidão; a sidebar cria scroll vertical e horizontal internos; três preferências novas não produzem efeito observável.
- Error messages: nenhum erro visível.
- Timeline: detectado no checkpoint humano de acessibilidade da Fase 2.
- Reproduction: definir o tamanho do texto do Windows em 200%, abrir Home e Configurações > Aparência, então alterar as três opções.
- Evidence: três capturas enviadas pelo usuário em 2026-07-30.

## Root cause

1. `.premium-operations` reservava uma linha fixa para o cabeçalho. Quando o WebView aumentava o texto, o cabeçalho crescia visualmente fora dessa linha e cobria o conteúdo seguinte.
2. A sidebar dividia rolagem entre região, rail e toolbar, mantendo overflow horizontal possível em largura lógica reduzida.
3. `data-app-scale` e `--lb-app-scale` existiam, mas nenhum componente consumia o fator. Densidade alterava somente tokens pouco usados. Contraste de dados mudava o estado sem possuir uma paleta aplicada aos valores técnicos.

## Resolution

- O shell passou a consumir a escala 100/125/150 com compensação do viewport para impedir rolagem horizontal.
- Cabeçalhos operacionais usam linha automática e o conteúdo continua em uma única região rolável.
- A sidebar possui um único eixo vertical e bloqueia overflow horizontal.
- Densidade controla altura e padding reais das linhas.
- Contraste de dados controla cores reais de valores, unidades e metadados.
- Configurações > Aparência ganhou uma prévia ao vivo e feedback localizado por toast.
- `appearance-responsive.spec.ts` mede geometria e efeito visual, em vez de aceitar apenas atributos.

## Verification

- `@appearance text at 200% keeps route content and navigation in one scroll axis`: aprovado.
- `@appearance scale, density and data contrast visibly change the interface`: aprovado.
- Inspeção visual local realizada em 100%, 150%, densidade compacta, contraste reforçado e viewport lógico 960x515.
- A captura física de 1920x1030 foi modelada como viewport CSS 960x515, equivalente à largura lógica observada com escala de 200%.

## Next action

Repetir o checkpoint humano no executável reconstruído antes de promover as evidências de texto em 200% e escala interna em 150%.
