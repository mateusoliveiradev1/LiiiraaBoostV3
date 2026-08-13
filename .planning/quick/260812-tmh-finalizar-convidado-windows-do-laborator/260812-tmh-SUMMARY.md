---
quick: 260812-tmh
title: Finalizar convidado Windows do laboratório Hyper-V e criar checkpoint limpo
status: complete
completed: 2026-08-13
---

# Resultado

O convidado Windows 11 do laboratório Hyper-V foi preparado, atualizado e congelado em um checkpoint limpo, sem Docker e sem compartilhar credenciais do usuário.

# Entregue

- Ação `StageGuest` para copiar o bootstrap pelo canal protegido de integração do Hyper-V e ejetar a ISO usada na instalação.
- Preparador local elevado que usa somente o Windows Update, continua após reinicializações e produz evidência persistente.
- Proteção contra execuções simultâneas do preparador.
- Marcador visível de conclusão na Área de Trabalho do convidado.
- Checkpoint `Clean-Windows-Ready` criado para permitir restauração antes de cada cenário de teste.

# Evidências

- `C:\Users\Liiiraa\VM-Lab\Evidence\20260812-212333-stage-guest.json` registra a cópia do bootstrap e a ejeção da ISO.
- `C:\Users\Liiiraa\VM-Lab\Evidence\20260812-213247-checkpoint.json` registra a criação do checkpoint.
- `C:\Users\Liiiraa\VM-Lab\Evidence\20260812-213313-audit.json` confirma `checkpointCount: 1`, `Clean-Windows-Ready`, Secure Boot e TPM ativos e nenhuma ISO montada.
- A validação visual dentro do convidado confirmou `Windows Update: nenhuma atualização de software pendente` e o computador `LIIIRAA-LAB`.

# Verificação

- Sintaxe dos três scripts PowerShell validada pelo parser nativo.
- Fluxo `StageGuest` executado contra a VM real.
- Preparação concluída após reinicializações reais do Windows convidado.
- Auditoria final do Hyper-V aprovada.

# Próximo marco

Instalar o build do Liiiraa Boost no convidado e criar `LiiiraaBoost-Installed` antes de iniciar os cenários destrutivos e de recuperação da Fase 6.
