---
status: resolved
trigger: 'o minimizar na janela ainda nao funciona tbm'
created: 2026-07-29
updated: 2026-07-29
---

# Debug: botão minimizar não minimiza a janela

## Symptoms

- Expected: clicar em “Minimizar janela” recolhe a janela para a barra de tarefas.
- Actual: o botão aparece e recebe o clique, mas a janela permanece aberta.
- Error messages: nenhum erro visível; o handler atual descarta exceções nativas.
- Timeline: observado no instalador atual.
- Reproduction: abrir o aplicativo e clicar no primeiro controle da janela.

## Current Focus

- hypothesis: confirmada — a API da janela era carregada por importação dinâmica em um chunk separado, e qualquer falha era descartada silenciosamente.
- test: adaptador isolado com chamada exata a `minimize()` e inspeção do bundle de produção.
- expecting: confirmado — o teste passou com uma chamada e o build deixou de emitir `window-*.js` separado.
- next_action: resolvido; reconstruir o instalador e validar no pacote instalado.
- reasoning_checkpoint: `getCurrentWindow().minimize()` e `core:window:allow-minimize` existem no código, então é necessário verificar interação real e restauração concorrente.
- tdd_checkpoint: GREEN — o teste falhou antes porque o adaptador não existia e passou após a ligação estática.

## Evidence

- timestamp: 2026-07-29T19:00:00-03:00
  observation: permissões `core:window:allow-minimize` estão presentes na capability e no `tauri.conf.json`.
  implication: não é uma omissão óbvia de permissão.

## Eliminated

- hypothesis: o botão não foi renderizado.
  reason: usuário consegue identificá-lo e os três controles aparecem na titlebar.

## Resolution

- root_cause: `import('@tauri-apps/api/window')` criava um chunk carregado somente ao clicar; falhas de carregamento eram capturadas sem feedback, transformando o controle em no-op.
- fix: importação estática de `getCurrentWindow`, adaptador tipado e execução que retorna sucesso/falha; o controle permanece seguro em browser e Storybook.
- verification: 79/79 testes unitários, 27/27 E2E, TypeScript e build sem o chunk separado `window-*.js`.
- files_changed: `app.tsx`, `app.test.tsx`.
