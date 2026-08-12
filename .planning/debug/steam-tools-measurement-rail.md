---
status: resolved
trigger: "Steamworks Common Redistributables nao e um jogo e o bloco de autoridade sempre em cima ficou ruim"
created: 2026-08-12
updated: 2026-08-12
---

# Symptoms

- expected: A descoberta lista somente jogos instalados, e cada aba de Medições começa pelo conteúdo que o usuário escolheu.
- actual: Steamworks Common Redistributables aparece como jogo e o painel detalhado de autoridade precede todas as abas.
- errors: Nenhuma exceção; regressões semântica e de hierarquia visual.
- timeline: Observado após conectar a descoberta nativa de jogos e transformar a autoridade em faixa horizontal.
- reproduction: Atualizar o inventário com o AppID 228980 instalado e abrir qualquer aba de Medições.

# Current Focus

- hypothesis: O coletor admite qualquer nome de manifesto Steam, e o JSX posiciona a autoridade antes do corpo sem redução progressiva de detalhes.
- test: Cobrir a exclusão de utilitários Steam e verificar a ordem/conteúdo do layout em testes de componente e navegador.
- expecting: AppID 228980 ausente; conteúdo específico da aba aparece primeiro; proveniência fica compacta e expansível ao final.
- next_action: Correção verificada e pronta para entrega.

# Evidence

- timestamp: 2026-08-12T22:00:00-03:00
  observation: `discover_steam_games` passa diretamente o campo `name` a `insert_game_name`, que só rejeita o literal `common`.
- timestamp: 2026-08-12T22:01:00-03:00
  observation: `AuthorityMeasureSurface` renderiza `NativeEvidenceRail` antes de `renderBody()` em todas as rotas.

# Eliminated

- hypothesis: O item vem da descoberta por diretório.
  reason: A captura identifica exatamente o nome do manifesto do AppID Steamworks Common Redistributables.

# Resolution

- root_cause: A descoberta Steam admitia todo campo `name` de manifesto, inclusive componentes de suporte, e o painel detalhado de proveniência era renderizado antes do conteúdo de todas as abas.
- fix: Excluídos AppID 228980 e nomes conhecidos de redistribuíveis/runtimes/SDK; conteúdo da aba passou a vir primeiro e a proveniência virou um resumo compacto e expansível no rodapé.
- verification: Teste Rust de regressão aprovado; 92 testes do feature shell; 158 testes do desktop; 5 Playwright de Medições, incluindo escala 150% e largura estreita; `verify:quick` global; build e NSIS aprovados.
- files_changed: apps/desktop/src-tauri/src/hardware_inventory.rs, packages/feature-shell/src/features/measure.tsx, packages/feature-shell/src/features/technical-surfaces.test.tsx, apps/desktop/src/routes-approved.css
