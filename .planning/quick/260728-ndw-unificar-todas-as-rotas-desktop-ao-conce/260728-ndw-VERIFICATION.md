---
quick_id: 260728-ndw
status: human_needed
verified: 2026-07-29
code_commit: 1b62551
---

# Verificação — acabamento visual final do desktop

## Veredito

A implementação e a verificação local passaram. A tarefa rápida está completa
no código e no pacote gerado. O encerramento oficial da Fase 2 ainda precisa de
instalação humana em ambientes limpos de Windows 10 e Windows 11.

## Evidência visual

As sete rotas principais foram capturadas e inspecionadas em 1440 × 900:

- `final-home-1440.png`
- `final-optimization-1440.png`
- `final-games-1440.png`
- `final-performance-1440.png`
- `final-recovery-1440.png`
- `final-settings-1440.png`
- `final-onboarding-1440.png`

Critérios observados:

- shell e sidebar permanecem estáveis ao trocar de rota;
- títulos e painéis seguem o mesmo grid;
- ícones Lucide compartilham tamanho, stroke e caixa de alinhamento;
- não há faixa roxa persistente nem inspetor ocupando a composição;
- copy principal está em português e estados simulados continuam identificados;
- Configurações e onboarding seguem a linguagem visual das rotas principais;
- a marca na barra não usa badge genérico nem símbolo improvisado.

## Evidência automatizada

| Gate             |                       Resultado |
| ---------------- | ------------------------------: |
| Design tokens    |                             6/6 |
| Design system    |                           11/11 |
| Feature shell    |                           89/89 |
| Desktop unitário |                           66/66 |
| Playwright E2E   |                           15/15 |
| Axe canônico     |                     59/59 pares |
| TypeScript       |           aprovado em 3 pacotes |
| Vite build       |                        aprovado |
| Screenshots      | 1440, 1280, 960 e 760 aprovados |

## Evidência do instalador

O instalador final possui 4.543.624 bytes e foi gerado em 29 de julho de 2026.

O script NSIS gerado confirma:

- `MUI_PAGE_LICENSE` com o arquivo de termos incorporado;
- `PortugueseBR` como primeiro idioma;
- `MUI_ICON` e `MUI_UNICON` apontando para o ícone próprio;
- `MUI_HEADERIMAGE_BITMAP` apontando para `installer/header.bmp`;
- `MUI_WELCOMEFINISHPAGE_BITMAP` apontando para `installer/sidebar.bmp`.

O ícone associado foi extraído do próprio setup e do executável empacotado; ambos
usam o monograma novo.

## Validação humana pendente

- Instalar, abrir, navegar e desinstalar em uma imagem limpa de Windows 10.
- Instalar, abrir, navegar e desinstalar em uma imagem limpa de Windows 11.
- Confirmar visualmente no assistente nativo que os termos, idioma e artes aparecem
  corretamente em ambas as imagens.

Esses itens não indicam falha do código local; são o gate externo já registrado
para aceitação do pacote.
