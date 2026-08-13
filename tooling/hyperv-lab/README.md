# Laboratório Hyper-V do Liiiraa Boost

Laboratório persistente para testes de instalação, permissões, reinicialização, atualização, desinstalação, falhas e rollback do desktop. Ele não usa Docker e não altera as configurações de energia, serviços ou registro do PC principal.

## VM padrão

- Windows 11 Enterprise Evaluation 25H2 PT-BR oficial.
- Hyper-V Generation 2.
- Secure Boot e TPM virtual.
- 4 vCPUs.
- 8 GiB de RAM inicial, dinâmica entre 4 e 12 GiB.
- VHDX dinâmico de 96 GiB.
- `Default Switch` do Hyper-V.
- Checkpoints automáticos desativados; somente marcos nomeados e intencionais.
- A ação `RepairHost` restaura somente os modos de inicialização oficiais do Hyper-V: `Vid` como System Start, `VMBus` como Boot Start e os serviços de integração como Manual.
- A mesma ação habilita VBS com Secure Boot, sem forçar Integridade de Memória, para permitir o TPM virtual exigido pela VM de Windows 11.
- Se `VMBus` estava desativado ou configurado sob demanda, reinicie o Windows depois de `RepairHost`; drivers de boot não podem ser carregados corretamente no meio da sessão.

Os arquivos ficam em `C:\Users\Liiiraa\VM-Lab`. Evidências administrativas ficam em `C:\Users\Liiiraa\VM-Lab\Evidence`.

## Comandos

Execute em PowerShell **como administrador**:

```powershell
$script = 'C:\Users\Liiiraa\Documents\estudos\LiiiraaBoostV3\tooling\hyperv-lab\Invoke-LiiiraaBoostLab.ps1'

& $script -Action Audit
& $script -Action RepairHost
& $script -Action Create -StartAfterCreate
& $script -Action Status
& $script -Action Open
& $script -Action StageGuest
& $script -Action Checkpoint -CheckpointName 'Clean-Windows-Ready'
```

Para registrar também a saída administrativa em `Evidence`, use `Run-LabElevated.ps1` com os mesmos parâmetros.

`StageGuest` habilita somente a Interface de Serviço de Convidado, copia o bootstrap para `C:\Users\Public\Desktop\LiiiraaBoost-Lab` e ejeta a ISO já utilizada. Dentro da VM, execute `Preparar-Laboratorio.cmd`; ele solicita elevação local, instala somente atualizações oficiais de software pelo Windows Update, reinicia quando necessário e cria o marcador `Liiiraa Boost Lab - PREPARADO.txt` quando não restar atualização pendente.

Depois da instalação limpa do Windows e das atualizações, crie `Clean-Windows-Ready`. Depois de instalar o Liiiraa Boost, crie `LiiiraaBoost-Installed`. Antes de cada plano da Fase 6, crie um checkpoint específico para o cenário.

## Cobertura real

| Pode ser validado na VM | Exige máquina física |
|---|---|
| Instalação e desinstalação | Detecção real de Intel em host Intel |
| Primeiro início e autenticação | Métricas de uma GPU física diferente |
| Elevação e permissões negadas | Ganho de desempenho em jogo |
| Reinicialização e retomada | Temperatura, clocks e sensores de fabricante |
| Falha no meio do plano e rollback | Compatibilidade com drivers e periféricos reais |
| Atualização e migração de estado | Windows 10 físico quando não houver ISO legítimo |

Uma VM criada no host AMD continua expondo a virtualização daquele host; ela não constitui prova de compatibilidade Intel. Os PCs dos amigos no alfa complementam essa matriz com evidência física consentida.
