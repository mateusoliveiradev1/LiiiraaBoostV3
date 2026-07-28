---
phase: 02-complete-desktop-experience
reviewed_at: 2026-07-28
status: remediation-required
overall_score: 7
maximum_score: 24
needs_human_review: true
---

# Revisão visual da Fase 2

## Veredito

A interface instalada não atende ao contrato visual aprovado para a Fase 2 e
não deve ser apresentada como produto visualmente concluído. O shell técnico
renderiza, as rotas tipadas existem e os cenários determinísticos são
alcançáveis, mas o resultado percebido ainda é uma ferramenta interna de
desenvolvimento.

Evidência humana:

- `C:\Users\Liiiraa\AppData\Local\Temp\codex-clipboard-ef79c170-9e75-405d-9e11-52d7d078bbcb.png`
- `C:\Users\Liiiraa\AppData\Local\Temp\codex-clipboard-d3874c80-884b-4311-a1ff-cbafe1025dcc.png`

Evidência automatizada:

- As 58 rotas tipadas renderizam no navegador.
- Os quatro testes `@route-scenario-smoke` passam.
- A evidência prova alcance e estrutura das rotas, não acabamento visual nem
  funcionamento do futuro motor de otimização.
- A baseline visual aprovada reproduz os mesmos problemas de composição da
  captura humana; portanto, congelou um resultado insuficiente.

## Pontuação

| Pilar | Nota | Diagnóstico |
|---|---:|---|
| Copywriting | 1/4 | PT-BR não é respeitado no app instalado; há texto inglês codificado diretamente; avisos internos e jurídicos dominam a tarefa principal. |
| Visual | 1/4 | A composição parece um painel técnico provisório, sem a presença premium e a hierarquia previstas no contrato. |
| Cor | 2/4 | A base neutra e o cobalt estão próximos do contrato, mas o roxo de cenário, as bordas e os avisos competem com a ação principal. |
| Tipografia | 1/4 | Manrope e JetBrains Mono são declaradas, porém os arquivos `.woff2` não existem no pacote; o app cai em fontes genéricas. |
| Espaçamento | 1/4 | Etapas coladas, alinhamentos frágeis, blocos densos e grandes áreas vazias quebram ritmo e leitura. |
| Experiência | 1/4 | A primeira abertura expõe verificação de desenvolvimento antes do valor do produto; o usuário encontra fixture, demo e detalhes internos em vez de uma jornada guiada. |

## Falhas prioritárias

### P0 — bloquear nova apresentação como “app pronto”

1. Corrigir a seleção e migração de idioma para PT-BR no aplicativo instalado.
2. Remover textos de interface codificados diretamente em inglês e centralizar
   toda copy nos catálogos.
3. Empacotar e verificar as fontes reais ou alterar honestamente o contrato
   tipográfico.
4. Separar aviso obrigatório de cenário dos conteúdos da tarefa; a verdade
   permanece visível sem ocupar três regiões simultaneamente.

### P1 — recompor a experiência principal

1. Redesenhar o handoff de desenvolvimento como uma confirmação curta em
   PT-BR, com detalhes técnicos recolhidos por padrão.
2. Reestruturar a calibração com progresso legível, uma ação focal, escolhas de
   privacidade claras e inspetor contextual.
3. Tornar seleção, hover, foco, estados vazios, carregamento e erro visualmente
   consistentes em todo o shell.
4. Revisar cada uma das 58 rotas por tarefa real, não apenas por presença de
   `h1`, marcador de cenário e ausência de clipping.

### P2 — elevar o acabamento

1. Ajustar densidade, ritmo vertical, largura de leitura e responsividade.
2. Reduzir ruído de bordas e etiquetas; reservar cobalt para foco e ação.
3. Criar baselines visuais novas somente depois de aprovação humana do novo
   sistema.

## Estado real das rotas

- **Existe:** árvore tipada com 58 rotas, renderização determinística e
  navegação principal por teclado.
- **É simulado:** inventário, diagnóstico, recomendações, jogos, medições,
  aplicação, recuperação, conta, assinatura e assistente.
- **Não está conectado:** motor real de otimização e operações privilegiadas do
  Windows.
- **Não está comprovado:** funcionamento completo de cada controle e jornada no
  instalador nativo; os testes atuais priorizam presença, semântica e paridade
  de cenários.

## Decisão

A Fase 2 requer uma rodada explícita de remediação visual e de copy antes dos
planos finais de evidência. Os planos 02-26 a 02-30 não corrigem o design; eles
validam acessibilidade, pacote e evidências. Executá-los agora congelaria um
produto visualmente inadequado.
