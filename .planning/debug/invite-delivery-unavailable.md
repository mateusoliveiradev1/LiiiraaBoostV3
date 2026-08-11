---
status: investigating
trigger: 'Falha na operação de convite: Nenhum convite foi admitido e nenhum comprovante durável foi criado. Tente novamente apenas quando a autoridade de entrega estiver disponível.'
created: 2026-08-11T06:38:11.6257034Z
updated: 2026-08-11T06:38:11.6257034Z
---

## Symptoms

- expected: Após o preflight classificar um destinatário como `valid`, a emissão revisada deve criar
  exatamente um convite e um comprovante durável.
- actual: A confirmação forte conclui, mas a emissão falha fechada sem criar convite ou comprovante.
- errors: `Falha na operação de convite` e `Tente novamente apenas quando a autoridade de entrega
estiver disponível`.
- timeline: Observado no UAT publicado da Fase 4 em 2026-08-11, imediatamente após o preflight real
  ter aprovado um alias descartável do proprietário.
- reproduction: Admin staging, função ativa `security`, Pessoas > Convites da beta > Criar convites;
  preencher destinatário válido, executar preflight, confirmar MFA e emitir convites revisados.

## Current Focus

- hypothesis: O runtime staging está corretamente configurado para falhar fechado quando a porta de
  entrega real não está pronta: a composição publicada injeta uma rejeição incondicional em vez de
  um provider.
- test: Confirmado em `apps/api/src/staging/runtime.ts`; a porta `delivery.handoff` sempre rejeita com
  `STAGING_INVITATION_DELIVERY_PROVIDER_UNAVAILABLE`.
- expecting: Uma integração real deve receber o segredo apenas durante o handoff, usar idempotência do
  comando, retornar uma referência opaca do provider e manter rollback total quando o provider falhar.
- next_action: Obter decisão explícita do proprietário para ativar um provider de e-mail de staging e
  então implementar a porta real com testes TDD e segredos somente no ambiente seguro do Render.

## Evidence

- timestamp: 2026-08-11T06:38:11.6257034Z
  checked: Captura do proprietário após emissão revisada.
  found: A autoridade permaneceu `live`, a capacidade continuou em `2 de 25 ativos` e `0 na fila`, e
  a UI afirmou explicitamente que nenhum convite nem comprovante foi criado.
  implication: A tentativa falhou atomicamente e não deve ser repetida até a autoridade de entrega
  ser diagnosticada; não há indício de convite duplicado.
- timestamp: 2026-08-11T06:38:11.6257034Z
  checked: Composição de `AdminInvitationDependencies` no runtime staging e caso de uso de emissão.
  found: `delivery.handoff` rejeita incondicionalmente; o caso de uso executa esse handoff dentro da
  transação antes de gravar eventos e comprovante durável.
  implication: Não é oscilação temporária. A emissão só poderá passar após uma porta de entrega real
  ser configurada; substituir por sucesso simulado violaria o contrato fail-closed.

## Eliminated

- hypothesis: Destinatário ou capacidade inválidos.
  reason: O preflight anterior classificou uma linha como `valid`, com uma entrada na capacidade,
  zero na fila e zero correções.
- hypothesis: A tentativa criou parcialmente um convite escondido.
  reason: O handoff rejeita dentro da transação e a projeção publicada permaneceu em dois convites;
  eventos e comprovante são persistidos somente depois do handoff bem-sucedido.

## Root Cause

O ambiente staging foi publicado deliberadamente sem provider de entrega. A composição persistente
substitui a porta por uma rejeição constante, portanto toda criação ou reemissão que precise entregar
um segredo é revertida antes de produzir estado ou comprovante.
