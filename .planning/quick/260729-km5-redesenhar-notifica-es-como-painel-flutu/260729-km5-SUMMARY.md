---
status: complete
quick_id: 260729-km5
date: 2026-07-29
code_commit: 94031d1
package_commit: 44eb298
---

# Resumo

As notificações do desktop agora usam uma gaveta flutuante localizada em PT-BR, com hierarquia visual final, contador, item acionável, fechamento pelo botão, clique externo e Escape. A gaveta não participa do grid do shell, preserva a geometria da barra lateral e devolve o foco ao sino ao fechar.

As rotas de otimização agora seguem uma lista densa inspirada no modelo de interação do FSOS: ícone contextual, nome, impacto esperado, risco, detalhes, tooltip técnico e switch de ativar ou desativar. A seleção permanece uma prévia simulada e não afirma alteração real no Windows. Ajustes excluídos continuam indisponíveis.

O shell passou a usar altura fixa do viewport, overflow controlado e scrollbar estável para impedir saltos de largura entre rotas.

## Evidências

- 89 testes do feature-shell aprovados.
- 67 testes unitários do desktop aprovados.
- 21 testes Playwright aprovados, incluindo axe sobre 59 pares canônicos de rota/estado.
- Geometria idêntica entre todas as rotas da sidebar em 1440, 1280 e 1024 px.
- Novos snapshots visuais aprovados para a gaveta de notificações e a lista de otimizações.
- Detector visual do Impeccable sem achados nos arquivos alterados.
- Instalador local gratuito reconstruído e registrado no commit `44eb298`.

## Instalador

- Arquivo: `quality/evidence/phase-02/staged/Liiiraa Boost_0.0.0_x64-setup.exe`
- SHA-256: `AE8768631C945FF0FCB94EB069D7ED153457D7EABA2894B507C0BBCF2E882127`
- Assinatura: desenvolvimento local, sem confiança pública ou reputação SmartScreen.
