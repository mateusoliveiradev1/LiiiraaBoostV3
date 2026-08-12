---
quick: 260812-rr9
title: Preparar laboratório Hyper-V sem Docker
status: complete
completed: 2026-08-12
---

# Resultado

Laboratório Hyper-V persistente preparado em `C:\Users\Liiiraa\VM-Lab`, sem Docker e sem criar switch de rede externo.

# Entregue

- ISO oficial do Windows 11 Enterprise Evaluation 25H2 PT-BR validada pelo SHA-256 oficial.
- VM Generation 2 com Secure Boot, TPM virtual, 4 vCPUs, memória dinâmica de 4 a 12 GiB, 8 GiB iniciais e VHDX dinâmico de 96 GiB.
- Script administrativo para auditoria, reparo restrito do host, criação, status, abertura e checkpoints.
- Evidências JSON e logs administrativos gravados fora do repositório.
- Cadeia do Hyper-V restaurada aos modos oficiais e VBS ativa para suportar o TPM virtual.
- VM comprovadamente iniciada no estado `Running`, com ISO oficial anexada e console aberto.

# Evidência principal

`C:\Users\Liiiraa\VM-Lab\Evidence\20260812-202913-open.json` registra a VM em execução com Secure Boot e TPM ativos.

# Próximo marco

Concluir o OOBE do Windows, aplicar atualizações e criar o checkpoint nomeado `Clean-Windows-Ready` antes de instalar o Liiiraa Boost.
