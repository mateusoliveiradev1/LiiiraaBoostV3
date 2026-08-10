---
status: resolved
trigger: 'STRIPE_TEST_PROVISIONING_REJECTED:WEBHOOK_CREATE during protected API promotion'
created: 2026-08-10T14:54:00.000Z
updated: 2026-08-10T14:55:51.000Z
---

## Symptoms

- expected: A promoção protegida cria um webhook temporário, publica a nova API e aposenta o anterior.
- actual: A promoção para antes de alterar o Render com `STRIPE_TEST_PROVISIONING_REJECTED:WEBHOOK_CREATE`.
- reproduction: Executar `Phase 4 staging API artifact` manualmente com `build_only=false`.

## Current Focus

- hypothesis: Confirmada. Webhooks gerenciados já desativados permaneciam acumulados porque a finalização apenas chamava `update(..., { disabled: true })`.
- test: A preparação deve remover somente endpoints desativados com URL e descrição gerenciadas antes de criar o próximo webhook.
- expecting: Liberar a capacidade da conta sem interromper o endpoint ativo usado pela API publicada.
- next_action: rerun protected deployment

## Evidence

- timestamp: 2026-08-10T14:53:56.000Z
  checked: Log sanitizado do workflow `31400275014`.
  found: Migrações passaram; a criação do webhook falhou antes de qualquer atualização do Render.
  implication: O staging permaneceu intacto e a correção pode ser feita no provisionador.
- timestamp: 2026-08-10T14:55:15.000Z
  checked: Teste RED do provisionador Stripe.
  found: O endpoint desativado gerenciado não era removido antes da criação; o teste falhou com zero exclusões.
  implication: A retenção era reproduzível sem acesso aos segredos do provedor.
- timestamp: 2026-08-10T14:55:51.000Z
  checked: Teste focado, suíte completa da API, TypeScript, ESLint e Prettier.
  found: 239 testes passaram; somente o endpoint desativado e gerenciado é excluído.
  implication: O reparo é limitado e preserva o webhook ativo e integrações não gerenciadas.

## Eliminated

- Falha da correção da tela Pessoas: imagem, testes, SBOM e varredura passaram antes do estágio Stripe.
- Exclusão ampla de webhooks: endpoints ativos ou com outra descrição não entram na limpeza.

## Resolution

- root_cause: A rotação desativava webhooks antigos, mas nunca removia os endpoints desativados; promoções sucessivas esgotaram a capacidade de criação da conta Stripe de teste.
- fix: Antes da rotação, remover somente endpoints desativados cuja URL e descrição correspondem exatamente ao webhook gerenciado do staging.
- verification: Teste RED/GREEN; API 32 arquivos/239 testes; TypeScript; ESLint; Prettier.
- files_changed: apps/api/src/staging/provision-stripe.ts, apps/api/src/staging/provision-stripe.test.ts
