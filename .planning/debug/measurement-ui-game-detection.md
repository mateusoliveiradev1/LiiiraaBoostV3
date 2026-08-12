---
status: resolved
trigger: 'melhorar graficos, copy, piscada do status, memoria com frequencia, layout cortado, fontes indisponiveis, deteccao real de jogos e todos os botoes da tela de Medicoes funcionando'
created: 2026-08-12T18:40:00-03:00
updated: 2026-08-12T19:15:00-03:00
---

## Symptoms

- expected: Medicoes deve ter visual premium e responsivo, copy clara, telemetria historica legivel, inventario detalhado, deteccao real de jogos e cada navegacao/acao funcional.
- actual: Leitura atual exibe apenas numeros; indicador Atualizando pisca; memoria omite DDR/frequencia em algumas superficies; navegacao e painel lateral parecem cortados; seis fontes nativas aparecem indisponiveis; jogos nao sao descobertos; rotas podem ser apenas superficies sem fluxo completo.
- errors: Nenhuma excecao informada; falhas sao perceptivas, de cobertura nativa e de fluxo.
- timeline: Observado no instalador gerado apos a primeira rodada nativa da Fase 5.
- reproduction: Abrir Visao geral e Medicoes no app empacotado, atualizar inventario, percorrer todas as abas e observar cobertura, responsividade, telemetria e jogos.

## Current Focus

- hypothesis: Confirmada e corrigida.
- test: Coletor nativo empacotado, testes Rust/TypeScript e Playwright responsivo executados.
- expecting: Inventario real, telemetria estavel, navegacao funcional e layout sem overflow.
- next_action: handoff do instalador para UAT.
- reasoning_checkpoint: A autoridade publicava estado transitorio a cada poll, SMBIOS usava assinatura Win32 invertida, jogos eram placeholder e o rail de evidencia competia por largura com o conteudo.
- tdd_checkpoint: regressions passing

## Evidence

- O poll de telemetria publicava `reading` a cada 1,1 s mesmo quando uma amostra valida ja existia, causando a piscada de status e layout.
- O provider `RSMB` era criado com `from_le_bytes`; o executavel real passou a admitir `GlobalMemoryStatusEx + SMBIOS Type 17` apos corrigir para a representacao DWORD documentada.
- O Windows deste PC confirmou dois modulos DDR5 com `ConfiguredClockSpeed=6000`.
- O probe do executavel empacotado admitiu CPU, GPU, memoria, armazenamento, tela, Windows e jogos; a descoberta local de jogos foi observada.
- Rede, audio, USB, drivers e seguranca continuam explicitamente indisponiveis porque os respectivos coletores Win32 ainda nao foram conectados; a UI agora explica cada ausencia sem inventar valores.
- O teste Playwright em 150% de escala e viewport estreito confirma que Medicoes nao possui overflow horizontal.

## Eliminated

- O Windows 10 exibido anteriormente nao vinha do sistema atual: era copy de ciclo de vida anexada a uma leitura incompleta. A versao agora preserva Windows 11 e separa detalhes tecnicos.
- GPU indisponivel na telemetria nao era falha do inventario: eram autoridades distintas. O contador de uso foi conectado ao motor grafico mais ocupado e o nome permanece vindo do inventario.

## Resolution

- root_cause: Estados transitorios publicados em todo poll, leitura SMBIOS com assinatura incorreta, ausencia de descoberta nativa de jogos, acoes sem feedback e composicao CSS com rail lateral rigido.
- fix: Historico visual estavel; graficos compactos; RAM via SMBIOS Type 17; descoberta local Steam/Epic/Xbox/EA/Ubisoft; Modo Competitivo com leitura automatica; copy por fonte; feedback de atualizar/relatorio; rail horizontal e responsividade; restauracao de sessao com timeout, retry e troca de conta; fonte Saira empacotada no desktop.
- verification: 42 testes TypeScript direcionados, 140 testes Rust, 5 testes Playwright de Medicoes, 8 testes Playwright da autoridade de conta, TypeScript/lint dos arquivos alterados, build Vite e bundle NSIS aprovados.
- files_changed: hardware_inventory.rs, live-telemetry.ts, premium-operations-production.tsx, account-experience.tsx, measure.tsx, CSS, fontes e testes relacionados.
