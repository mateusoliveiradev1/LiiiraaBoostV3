---
status: fixing
trigger: 'Falha na operação de convite: Nenhum convite foi admitido e nenhum comprovante durável foi criado. Tente novamente apenas quando a autoridade de entrega estiver disponível.'
created: 2026-08-11T06:38:11.6257034Z
updated: 2026-08-11T08:05:19.6361372Z
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

- hypothesis: A causa local foi removida por uma porta Resend real, mas a promoção segura ainda depende
  da verificação pública de `envios.liiiraaboost.com.br` e da criação da chave somente depois disso.
- test: O adapter, o runtime, o workflow de Render e os fluxos de emissão/reenvio passaram por TDD;
  a suíte completa da API passou com 245 testes e a do Admin com 183 testes.
- expecting: Depois da propagação DNS, o Resend deve verificar DKIM/SPF/MX; a chave será guardada no
  GitHub Actions, o mesmo digest testado será promovido ao Render e um convite descartável deverá gerar
  exatamente um e-mail e um comprovante durável.
- next_action: Aguardar a propagação pública, criar a chave do Resend sem expô-la, promover a API e
  executar o UAT real de emissão e reenvio.

## Evidence

- timestamp: 2026-08-11T08:05:19.6361372Z
  checked: Implementação local e contratos de implantação.
  found: `createResendInvitationDelivery` envia somente ao endpoint HTTPS do Resend com idempotência,
  timeout, referência opaca, mensagens localizadas e erros limitados; o workflow exige
  `RESEND_API_KEY` e `STAGING_INVITATION_FROM` antes de atualizar o Render.
  implication: O ambiente continuará falhando fechado se qualquer segredo ou identidade de envio
  estiver ausente; não existe fallback simulado.
- timestamp: 2026-08-11T08:05:19.6361372Z
  checked: Custódia de destinatário na emissão e no reenvio.
  found: O endereço é entregue transitoriamente, nunca persistido; o reenvio exige que o operador
  confirme o e-mail original e o hash precisa coincidir antes de girar o segredo.
  implication: A integração real não enfraquece o limite de privacidade nem permite desviar um convite.
- timestamp: 2026-08-11T08:05:19.6361372Z
  checked: Configuração oficial da Vercel e DNS público.
  found: A API da Vercel confirma que os dois A records e os CNAMEs salvos são a recomendação rank 1,
  mas os resolvedores públicos ainda retornam NXDOMAIN para os subdomínios e DKIM.
  implication: A configuração salva está correta; promover a API antes da propagação quebraria o CORS
  dos endereços antigos sem tornar os novos utilizáveis.

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
