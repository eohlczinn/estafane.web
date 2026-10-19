# Diagnóstico antes da reestruturação

Inspeção do código existente em 19/10/2026: frontend React, contexto único de fechamento, Express, extração PDF.js/OCR, parser por rótulos, cálculo compartilhado e relatórios jsPDF/HTML. O design, as preferências e os três formatos de impressão serão preservados.

Problemas confirmados no código:

- `pdfParser.js` aplica a mesma atribuição de campo a sangrias individuais e totais. Duas sangrias diferentes viram ambiguidade; não existe entidade de movimentação.
- `textLines.js` conserva somente texto. Colunas na mesma linha podem ser misturadas e a posição se perde.
- `calculation.js` aceita agregados negativos de saída, podendo inverter o efeito; depende de opções gerais da operadora para cancelamentos e não representa saldo líquido em espécie.
- `app.js` usa upload único e bloqueio global `busy`; não há fila, lote, cancelamento, hash ou agrupamento.
- O contexto React mantém somente um documento/fechamento. A seleção substitui o arquivo anterior.
- Não há auditoria de itens contra subtotais, linhas financeiras desconhecidas, sobreposição entre documentos ou consolidado validado.
- Relatórios e emissão funcionam para um fechamento, mas ainda não distinguem documentos complementares ou múltiplos caixas.
- Mensagens de privacidade pressupõem servidor local; precisam explicar a localização real do processamento em uma futura hospedagem.

A implementação seguirá a ordem do pedido: movimentações → cálculo e auditoria → validação individual → lotes → agrupamento → consolidado → relatórios → responsividade → testes completos. Nenhuma publicação pública ou autenticação própria será criada.
