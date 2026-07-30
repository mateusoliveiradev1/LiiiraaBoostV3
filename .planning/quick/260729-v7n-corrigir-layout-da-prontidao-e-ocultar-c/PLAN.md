# Quick Task: Corrigir layout da prontidão e ocultar confirmação concluída

## Problemas confirmados

- A confirmação de conclusão permanece no cartão e compete com o conteúdo principal.
- A composição em três colunas deixa o estado isolado, o centro sobrecarregado e a ação pendente solta.
- A barra em 100% parece um processo ainda aberto, mesmo depois da conclusão.

## Implementação

- [x] Reorganizar o topo em duas áreas equilibradas: estado/conteúdo e revisão pendente.
- [x] Tornar o indicador “Sistema pronto” compacto e integrado à hierarquia.
- [x] Exibir barra e percentual somente durante a análise.
- [x] Trocar a conclusão por feedback compacto e temporário, removido automaticamente.
- [x] Manter “Verificado agora” discretamente nas evidências após o feedback sumir.
- [x] Atualizar testes, snapshots e instalador.

## Validação

- O feedback concluído desaparece sem interação do usuário.
- A análise pode ser executada novamente após a conclusão.
- O cartão não apresenta rolagem lateral nem quebra nos tamanhos suportados.
- Tema claro, escuro, movimento reduzido e os dois idiomas permanecem corretos.
