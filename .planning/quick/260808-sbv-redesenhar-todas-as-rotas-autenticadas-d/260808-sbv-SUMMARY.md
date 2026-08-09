---
quick_id: 260808-sbv
status: complete
date: 2026-08-08
commit: 1dd5196
---

# Resumo — recuperação visual do portal autenticado

O portal de conta autenticado deixou de apresentar projeções reais como texto cru e passou a usar uma composição visual coerente com o produto desktop. Nenhuma fixture ou autoridade de demonstração foi reintroduzida.

## Entregue

- Shell reequilibrado com navegação compacta, workspace dominante e resumo contextual acionável.
- Gateway administrativo reduzido a um handoff secundário e protegido.
- Overview com identidade, saúde da conta e próximo passo recomendado.
- Dispositivo com vínculo, evidência, cooldown e estado vazio honesto.
- Download interno com entrega autenticada, requisitos, aviso de assinatura e orientação de instalação.
- Assinatura, segurança, faturas, suporte, perfil e privacidade recompostos com estados reais e linguagem traduzida.
- Estados técnicos de assinatura, fatura, suporte e função administrativa convertidos em linguagem de produto.
- Breakpoints, reflow, movimento reduzido e cores forçadas preservados.

## Arquitetura preservada

- `AccountAuthorityPage` continua consumindo `AccountAuthorityProjection` do adaptador real.
- O inspector deriva seus fatos da mesma projeção do workspace.
- Download continua restrito a `/api/internal-download` e à sessão autenticada.
- Nenhum import de `@liiiraa/web-preview` foi introduzido na composição de produção.

## Commit

- `1dd5196 feat(account): redesign authenticated portal routes`
