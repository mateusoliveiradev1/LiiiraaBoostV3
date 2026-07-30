---
quick_id: 260729-uek
status: complete
commit: 73209a7
---

# Telemetria local redesenhada

## Entregue

- O painel agora usa toda a altura disponível, sem a grande área vazia inferior.
- As quatro métricas receberam enquadramento de ícone, valor mais legível e separação estrutural.
- Uma faixa inferior informa que o monitoramento é somente leitura e que nenhuma alteração foi aplicada.
- O layout reorganiza as métricas em duas colunas nas janelas compactas.
- Todos os novos textos possuem tradução PT-BR/inglês e foram revisados nos temas escuro e claro.
- O botão “Revisar ajustes” foi corrigido de `/improve` para a rota premium `/toggles`.
- Foi adicionado um teste que impede o retorno acidental à tela legada de “Otimização”.

## Verificação

- TypeScript, ESLint e Prettier aprovados.
- Vitest: 89/89.
- Playwright Chromium: 35/35.
- Detector Impeccable: nenhuma ocorrência.
- Inspeção visual em 1920×1080 e 760×600, nos temas escuro e claro.
- Instalador NSIS reconstruído.

## Artefato

- Instalador: `target/release/bundle/nsis/Liiiraa Boost_0.0.0_x64-setup.exe`
- SHA-256: `4CA734326578497F83523216D2B1A85255AF1D7F826A8285574892EA748C52B2`
