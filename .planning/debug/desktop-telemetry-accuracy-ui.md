---
status: resolved
trigger: 'GPU identificada no inventario mas indisponivel na telemetria, memoria sem DDR/velocidade, Windows 11 exibido como Windows 10, Medicoes incompleta, atualizar inventario sem feedback e restauracao inicial aparentando travar'
created: 2026-08-12T22:00:00-03:00
updated: 2026-08-12T18:20:00-03:00
resolved: 2026-08-12T18:20:00-03:00
---

## Symptoms

- expected: Inventario e telemetria apresentam somente dados reais deste PC, com nome comercial correto do Windows, memoria detalhada quando o firmware fornece dados e uma experiencia clara.
- actual: A faixa superior identificava a GPU, mas o painel ao vivo informava GPU indisponivel; memoria mostrava somente capacidade; Windows 11 aparecia como Windows 10.0.
- actual: Atualizar inventario nao comunicava progresso ou conclusao e a restauracao da conta podia permanecer visualmente pendente.

## Evidence

- `RtlGetVersion` e CIM confirmaram Windows 11 Pro, kernel 10.0.26200.
- SMBIOS Type 17 confirmou dois modulos Kingston de 16 GiB, DDR5 e velocidade configurada de 6000 MT/s.
- Os contadores PDH `GPU Engine(*)/Utilization Percentage` existem neste PC.
- O fluxo de inventario nao aguardava o resultado nem exibia horario/cobertura.
- A sincronizacao inicial da conta nao possuia limite de tempo.

## Resolution

- root_cause: Coletores independentes tinham capacidades inconsistentes; a GPU ao vivo era deliberadamente indisponivel, a memoria usava apenas `GlobalMemoryStatusEx`, o Windows era nomeado pela versao do kernel e os fluxos assincronos nao tinham feedback ou timeout suficientes.
- fix: Nome comercial do Windows derivado do build e edicao; memoria detalhada por SMBIOS; GPU ao vivo por PDH com agregacao por motor; inventario aguarda resultado e mostra progresso, cobertura e horario; restauracao da conta possui etapas, timeout de 12 segundos, repeticao e entrada alternativa; Medicoes foi reorganizada e os erros nativos foram humanizados.
- verification: 137 testes Rust, 156 testes desktop, 21 testes desktop-client, 91 testes feature-shell, 5 E2E de medicao, build interno e bundle staging passaram. O gate `phase5:verify --mode final` passou com `currentPcAdmitted: true` e nenhum diagnostico. A coleta fisica observou 300 segundos, 12.406 MB de pico, 0% CPU ociosa, cancelamento em 100 ms e nenhum identificador bruto.
- files_changed: `hardware_inventory.rs`, `live_telemetry.rs`, superficies React/CSS de conta e medicao, politica de evidencia acionavel, testes e probe fisico da fase 5.
- tdd_checkpoint: green

## Remaining release gates

- A matriz independente de Windows 10, Intel, notebook e outras combinacoes continua sendo gate de release, nao uma falha deste PC.
- Assinatura publica Authenticode continua prevista para a fase de distribuicao.
