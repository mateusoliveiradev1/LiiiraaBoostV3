# Phase 6: Transactional Plans and Recovery - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-08-12
**Phase:** 6-transactional-plans-and-recovery
**Areas discussed:** aplicação real e progressão do alfa, níveis de risco, falhas/reinício/retomada, restauração/checkpoints/comprovantes

---

## Aplicação real e progressão do alfa

| Decision point | Alternatives considered | Selected |
|---|---|---|
| Promoção | Quatro etapas completas; PC real direto; validação apenas manual | Quatro etapas: simulação → VM limpa → PC do proprietário → amigos |
| Primeira operação | Plano dedicado; editar plano atual; alteração temporária | Plano de energia separado **Liiiraa Verificado** |
| Drift externo | Pausar e decidir; sobrescrever; ignorar | Pausar, mostrar diff e oferecer manter/restaurar/reaplicar |
| Persistência | Até restauração explícita; ao fechar; ao expirar Premium | Até restauração explícita |
| Falha de estágio | Bloquear versão; override; continuar com aviso | Bloquear versão e reiniciar validação desde a simulação |
| Evidência dos amigos | Pacote local consentido; upload automático; logs brutos | Pacote local redigido, revisável e explicitamente exportado |
| Revogação | Assinada sem execução remota; rollback remoto; somente aviso | Bloquear novas aplicações, alertar e manter recuperação local |

**User's choice:** abordagem mais segura e completa em todos os pontos.
**Notes:** o usuário quer testar em seus PCs e nos dos amigos durante o alfa, mas sem esconder lacunas de hardware.

---

## Níveis de risco

| Decision point | Alternatives considered | Selected |
|---|---|---|
| Disponibilidade | Progressão controlada; todos liberados; só Verificado | Verificado padrão, Avançado consciente, Experimental alfa/beta, Extremo bloqueado |
| Política global | Teto; seleção automática; sem política | Teto máximo mantendo controle por operação |
| Confirmação | Proporcional; igual para todos; nenhuma adicional | Confirmação crescente com autenticação forte e recuperação comprovada |
| Classificação | Técnica imutável; usuário reduz; informativa | Técnica e imutável por versão |
| Avançado | Preferência forte por PC; global; por sessão | Persistente/revogável por PC, com revalidação |
| Experimental | Por versão/aplicação; único; implícito no beta | Consentimento por versão e por aplicação |
| Plano misto | Maior risco com grupos; média; planos separados | Herda maior risco e preserva confirmações sensíveis |
| Evidência mudou | Invalidar; aplicar com aviso; ignorar | Mostrar diff e exigir nova revisão |

**User's choice:** proteção proporcional sem remover o controle do usuário.
**Notes:** Extremo permanece visível para comunicar o modelo, mas não executável nesta fase.

---

## Falhas, reinício e retomada

| Decision point | Alternatives considered | Selected |
|---|---|---|
| Falha parcial | Grupo afetado; rollback total; manter parcial | Restaurar somente dependências afetadas e preservar independentes verificadas |
| Reinício | Checkpoint e escolha; forçar; não verificar | Checkpoint, escolha do usuário e verificação pós-boot |
| Crash/energia | Diário e observação; repetir; apenas marcar falha | Recuperação prioritária baseada no diário e estado real |
| Estado desconhecido | Bloquear/guiar; continuar; repetir indefinidamente | Bloquear mutações e abrir recuperação guiada |
| Cancelamento | Fronteira segura; matar processo; ignorar | Parar em fronteira segura; timeout nunca significa sucesso |
| Concorrência | Mutação serial; paralelismo total; tudo sequencial | Mutação serial; leituras independentes podem ser paralelas |
| Retry | Seletivo; automático de tudo; nenhum | Somente leituras com limite; mutação exige observação e novo diário |
| Fechar janela | Continuar protegido; impedir; cancelar | Executor continua e UI vai para a bandeja |

**User's choice:** opção 1, continuar pelo executor protegido ao fechar a janela.
**Notes:** desligamentos e interrupções devem ser retomáveis sem repetir efeitos cegamente.

---

## Restauração, checkpoints e comprovantes

| Decision point | Alternatives considered | Selected |
|---|---|---|
| Experiência | Central única; telas espalhadas; só restauração completa | Central de Recuperação com linha do tempo e escopos individual/completo/checkpoint |
| Autoridade | Manifesto + Restore Point; só Restore Point; só manifesto | Manifesto exato como primário e Ponto de Restauração como segunda camada |
| Conflito | Pausar e decidir; sobrescrever; manter sempre | Pausar, explicar e permitir manter atual ou restaurar anterior |
| Comprovante | Resumo + detalhes; log técnico; mensagem simples | Registro imutável, humano e tecnicamente expansível |

**User's choice:** confirmou todas as opções recomendadas e destacou que Ponto de Restauração é uma proteção valiosa.
**Notes:** o Ponto de Restauração nunca substitui o manifesto exato nem a verificação pós-operação.

## Discrição do agente

- Estrutura exata dos contratos, crates, comandos, tabelas SQLite e índices.
- Composição visual e copy final das telas, respeitando o design existente e acessibilidade.
- Limites técnicos de retry de leitura, timeouts e retenção que não comprometam recuperação/auditoria.
- API Windows documentada usada para plano de energia e Ponto de Restauração.

## Deferred Ideas

- Operações Extremo aguardam controles futuros dedicados.
- Catálogo amplo de otimizações é Fase 7.
- Descoberta e automação de jogos é Fase 8.
- Cobertura física pendente da Fase 4 será retomada no alfa com amigos.
