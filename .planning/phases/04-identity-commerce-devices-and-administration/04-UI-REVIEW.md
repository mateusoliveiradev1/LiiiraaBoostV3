---
phase: 04-identity-commerce-devices-and-administration
reviewed_at: 2026-08-11
reviewed_commit: f53c8a5
status: remediation-required
overall_score: 14
maximum_score: 24
needs_human_review: true
---

# Revisão visual da Fase 4 — Admin publicado

## Veredito

O Admin publicado em `admin.liiiraaboost.com.br` recuperou autorização, navegação e
estados verdadeiros, mas ainda não alcança a direção **Calm Briefing + Mission
Control + Operational Ledger** aprovada no contrato visual. A tela atual é segura e
legível, porém se comporta como um relatório técnico linear: repete o contexto da
função, usa o histórico como assunto principal e não deixa evidente qual decisão o
administrador deve tomar agora.

A remediação deve preservar integralmente a autoridade real e reorganizar apenas a
apresentação: uma prioridade operacional, um resumo de postura, uma ação principal
e um ledger recente com estados semanticamente distintos.

## Evidência observada

- Origem: `https://admin.liiiraaboost.com.br/pt-BR/admin/overview`
- Sessão real: função Segurança, autoridade PostgreSQL/API e domínio customizado.
- Viewport observado: desktop no navegador interno do Codex.
- Rotas verificadas: Visão geral, Pessoas e Segurança.
- Implementação principal: `apps/admin/src/features/admin-authority.tsx`,
  `apps/admin/src/admin-navigation.tsx` e `apps/admin/src/app/admin-shell.css`.

## Pontuação

| Pilar       | Nota | Diagnóstico                                                                                                                                                                                                                                                  |
| ----------- | ---: | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Copywriting |  2/4 | O texto é seguro, mas descreve o sistema em vez de orientar a tarefa. “Central de segurança” leva diretamente a “Atividade recente”, sem prioridade, consequência ou próxima ação. Pessoas ainda expõe `live`, `active`, `owner`, `operations` e `security`. |
| Visual      |  2/4 | A página é uma sequência de divisores sobre preto, sem uma região focal. Cabeçalho, contexto e ledger têm o mesmo peso. O controle largo e vazio de recolher a navegação parece quebrado.                                                                    |
| Cor         |  3/4 | O cobalt permanece raro e sem efeito gamer, mas a falta de separação tonal deixa canvas, contexto e linhas com profundidade quase idêntica. Estados ativos e revogados dependem demais de texto discreto.                                                    |
| Tipografia  |  3/4 | Manrope e JetBrains Mono estão aplicadas corretamente, porém há excesso de mono em referências e datas e pouca diferenciação entre prioridade, estado atual e histórico secundário.                                                                          |
| Espaçamento |  2/4 | O ritmo horizontal é coerente, mas o layout desperdiça altura no contexto repetido e estica formulários/listas por toda a coluna. A densidade comunica vazio, não foco.                                                                                      |
| Experiência |  2/4 | As rotas funcionam e preservam a sessão, mas a visão geral não responde “o que exige atenção agora?”. O histórico não possui agrupamento semântico, filtro ou ação; o acesso emergencial não explica por que a ação está bloqueada antes do código.          |

## Falhas prioritárias

### P0 — transformar a Visão geral em briefing

1. Introduzir uma região focal com prioridade verdadeira derivada das sessões
   admitidas: total ativo, encerramentos recentes e postura atual.
2. Expor uma única ação principal para a revisão de Segurança, mantendo o histórico
   como evidência secundária.
3. Substituir a faixa repetitiva de três fatos por um resumo compacto integrado ao
   briefing, com validade da sessão e sincronização.

### P1 — recuperar profundidade e significado

1. Criar separação tonal entre briefing, ledger e canvas sem adicionar sombras
   decorativas ou uma grade de cartões SaaS.
2. Diferenciar sessões ativas, revogadas e expiradas com ícone, padrão de borda e
   rótulo; cor continua sendo apenas um reforço.
3. Limitar o ledger recente a evidência suficiente para decisão e apresentar o total
   preservado como metadado, não como justificativa técnica.
4. Converter o controle largo e vazio da barra lateral em um comando visível quando
   expandido e um alvo compacto quando recolhido.

### P2 — acabamento transversal

1. Traduzir os valores técnicos ainda visíveis em Pessoas.
2. Explicar o requisito do código forte no acesso emergencial e mostrar o escopo e a
   consequência antes da ação.
3. Revalidar desktop e mobile, PT-BR e inglês, teclado, foco, reduced motion e
   ausência de overflow após a nova composição.

## Restrições da correção

- Nenhuma função, capability, registro ou ação pode ser criada no cliente.
- A contagem e a prioridade devem derivar somente da projeção admitida existente.
- CSRF, TOTP, step-up, isolamento de origem, mascaramento e auditoria permanecem
  inalterados.
- Não usar templates de dashboard, shadcn, gradientes, glow, métricas inventadas ou
  Docker.

## Decisão

Reabrir a recuperação visual do Admin com foco primeiro na função Segurança, que é
a sessão real do owner. A aprovação final exige nova captura publicada e validação
das três rotas visíveis no domínio customizado.
