---
target: authenticated-surfaces-and-footer
total_score: 23
p0_count: 1
p1_count: 5
timestamp: 2026-08-03T06-54-13Z
slug: authenticated-surfaces-and-footer
---
Method: dual-agent (A: ux_design_review · B: ux_detector_evidence), supplemented by independent benchmark research.

## Design Health Score

| # | Heurística | Conta | Admin | Problema principal |
|---|---|---:|---:|---|
| 1 | Visibilidade do estado | 3 | 3 | Estados aparecem, mas vários rótulos não ajudam a decidir. |
| 2 | Correspondência com o mundo real | 2 | 2 | Linguagem de implementação e timestamp ISO cru. |
| 3 | Controle e liberdade | 3 | 2 | Ações administrativas somem por largura/zoom. |
| 4 | Consistência e padrões | 2 | 3 | Premium ativo e nenhuma cobrança aparecem juntos. |
| 5 | Prevenção de erros | 3 | 3 | Boa revisão prévia; segurança baseada em viewport é inadequada. |
| 6 | Reconhecimento em vez de memória | 3 | 2 | Termos abstratos exigem interpretação. |
| 7 | Flexibilidade e eficiência | 1 | 1 | Sem busca, filtros, ordenação ou aceleradores. |
| 8 | Estética e minimalismo | 2 | 2 | Conta repete destinos; admin desperdiça espaço. |
| 9 | Diagnóstico e recuperação | 3 | 3 | Estados degradados são uma força. |
| 10 | Ajuda e documentação | 2 | 1 | Admin carece de ajuda contextual. |
| **Total** |  | **24/40** | **22/40** | **Aceitável, ainda não pronto para lançamento** |

## Anti-Patterns Verdict

O detector determinístico encontrou zero padrões proibidos em `apps/account/src` e `apps/admin/src`. No navegador, quatro alertas foram falsos positivos: um truncamento intencional do e-mail e três elementos com altura efetiva de 44 px. Não há overflow horizontal, interativos sem nome acessível, imagens sem `alt` ou alvos abaixo do mínimo WCAG 2.2 de 24 px nos viewports avaliados.

O problema não é CSS quebrado nem AI slop decorativo. O AI slop restante é estrutural: conta e admin reutilizam a mesma gramática de hero-card, painel lateral e tabela, enquanto a copy expõe termos internos de governança. A base técnica responsiva e acessível deve ser preservada; arquitetura da informação, densidade, prioridade, estados e linguagem precisam ser redesenhados.

## Overall Impression

A conta parece um checklist de conformidade, não o plano de controle de um produto premium. O admin parece uma demonstração de governança, não uma ferramenta operacional madura. O footer público é mínimo e não fecha a experiência de confiança.

## What's Working

1. Paleta quase neutra, cobalt raro, raios contidos e bordas estruturais seguem o norte visual do produto.
2. Skip links, foco, semântica, reduced motion, forced colors e estados degradados formam uma base acima da média.
3. Loading, empty, offline, stale, sessão expirada, permissão e falha receberam tratamento explícito.

## Priority Issues

### P0 — Viewport/zoom bloqueia ações administrativas

Ações de alto risco desaparecem abaixo de 960 px. Em zoom de 200%, um operador pode perder a ação necessária. Preservar a ação e converter a revisão em fluxo vertical: evidência → impacto → confirmação. Segurança deve vir da sequência e das permissões, nunca dos pixels.

### P1 — A conta apresenta estados incompatíveis

O inspetor afirma Premium e mostra preço, enquanto o overview informa nenhuma cobrança ativa. Definir um estado autoritativo único para Essential, Premium ativo e Premium pendente, aplicando a mesma regra a dispositivo, passkey e MFA.

### P1 — Copy fala a linguagem da implementação

Substituir “responsabilidades”, “decisão segura”, “resultado imutável” e “alteração remota” por resultados humanos. Garantias técnicas continuam visíveis em auditoria, risco e confirmação, não como gramática principal.

### P1 — Conta duplica navegação e não comunica valor

Perfil, Segurança, Assinatura e Dispositivo aparecem na lateral, destaque, tabela, inspetor e menu. A home autenticada deve responder em cinco segundos: plano atual, PC vinculado, segurança e próxima ação. Manter uma ação recomendada e um resumo de estado; mover detalhes para as páginas correspondentes.

### P1 — Admin não funciona como máquina de decisão

A fila real fica abaixo de explicações de função e acesso. Tornar a fila o plano principal, com busca, filtros, prioridade, idade/SLA, responsável e estado. Selecionar a primeira linha abre detalhe contextual sem abandonar a fila. Datas devem ser localizadas; ISO fica no detalhe técnico.

### P1 — Legal/LGPD ainda está em linguagem de pré-lançamento

Termos, Privacidade e Central de Privacidade já existem, mas dizem “futuro”, “sem enviar” e “indisponível”. Para lançamento, publicar controlador/contato, bases legais por finalidade, retenção, operadores/subprocessadores, transferências, direitos, revogação, cookies/armazenamento e versões. A Central autenticada deve mostrar consentimentos e solicitações reais. Revisão jurídica profissional é obrigatória antes da publicação.

### P2 — História e footer não fecham a confiança

Não existe rota institucional “Nossa história”. Criá-la para explicar origem, problema combatido, princípios e visão sem inventar métricas ou equipe. Reconstruir o footer em Produto, Recursos, Empresa, Suporte e Legal, incluindo Planos, Download, Documentação, Nossa história, Termos, Privacidade, Segurança, Status, idioma e copyright.

## Persona Red Flags

**Alex — power user:** admin sem busca, filtros, ordenação, atalhos ou ações em lote; fila não mostra prioridade, idade ou SLA.

**Sam — acessibilidade:** zoom pode remover ação principal; textos burocráticos elevam carga cognitiva apesar da boa semântica e do bom foco.

**Jordan — iniciante:** não entende por que precisa “revisar” perfil e segurança; MFA, identidade protegida e resultado imutável não têm tradução contextual; Premium contraditório paralisa a decisão.

## Recommended Product Model

### Account

- Overview: saudação breve, plano autoritativo, PC principal, estado de segurança e uma recomendação contextual.
- Navegação: Início; PCs e licenças; Plano e pagamentos; Segurança e privacidade; Ajuda. Perfil fica no menu da identidade; faturas dentro de pagamentos; downloads dentro de produto/PC.
- Privacidade e dados: ledger de consentimentos separado em telemetria, diagnóstico de suporte e uso de IA; exportar, corrigir e excluir; retenção e última alteração.
- A web controla identidade, licença, dispositivo, billing, downloads e suporte. Diagnóstico e otimização continuam no desktop.

### Admin

- Barra global: busca, fila atual, alertas e identidade/role.
- Plano principal: tabela/ledger operacional com filtros salvos, prioridade, SLA, responsável e último evento localizado.
- Painel contextual: evidência, histórico, consentimento, impacto e ações permitidas.
- RBAC reduz a navegação, mas não precisa explicar a política de acesso em cada primeira dobra.
- Auditoria detalhada preserva linguagem técnica, correlação e timestamps ISO.

### Footer

- Produto: Como funciona, Seu PC, Resultados, Planos, Download.
- Recursos: Documentação, Ajuda, Versões, Status.
- Empresa: Nossa história, princípios e contato.
- Legal: Termos, Privacidade, Segurança, Cookies/armazenamento e divulgação responsável.
- Fechamento: marca, promessa curta, idioma, copyright/versão e CTA discreto para download ou conta.

## Benchmark Directions

- Stripe Customer Portal: gestão confiável de assinatura e cobrança — https://docs.stripe.com/customer-management
- Microsoft Privacy Dashboard: privacidade como produto e histórico de dados — https://account.microsoft.com/privacy
- Cloudflare Roles: RBAC explícito sem dominar a tarefa — https://developers.cloudflare.com/fundamentals/manage-members/roles/
- Sentry Issues: fila priorizada orientada à ação — https://docs.sentry.io/product/issues/
- Linear Custom Views: filtros salvos e visões operacionais — https://linear.app/docs/custom-views
- ANPD, atendimento ao titular: direitos e canal oficial — https://www.gov.br/anpd/pt-br/canais_atendimento/cidadao-titular-de-dados

## Questions to Consider

- Se “revisar” fosse proibido, qual resultado real cada CTA prometeria?
- A conta é um hub de controle do cliente ou um checklist de conformidade?
- Por que a política de acesso ocupa o mesmo peso visual da fila de trabalho?
- A segurança é provada pelo comportamento ou apenas repetida na copy?
