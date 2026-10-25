# Estefane Web 1.4 — leitura por contexto e conciliação

O importador separa fechamentos por referência e identificação, concilia cupons com o resumo e mantém estoque em unidades, separado do dinheiro. Usa regras locais e OCR, sem modelos generativos ou APIs externas.

## Responsabilidades

- `financialObservations.js` identifica valores inteiros e brasileiros somente após rótulo financeiro ou coluna monetária explícita. Separa pares na mesma linha, preservando os deslocamentos originais. Quantidades, datas e identificadores não viram dinheiro.
- `tableInterpreter.js` mantém colunas, direção e seção. Tabelas de cupons preservam identificador, horário, forma e valor; quantidade não substitui a coluna monetária.
- `paymentTransactions.js` concilia vendas individuais e seus totais, sem somar os dois. Identificador repetido com mesma forma e valor conta uma vez, mantendo as duas origens. Identificadores conflitantes, valores incompletos e pagamentos desconhecidos exigem revisão.
- `inventoryParser.js` lê tabelas e blocos de produtos. Calcula inicial + entradas − saídas e compara com a contagem, quando os dados existem. Não converte preço em quantidade nem quantidade informada em contagem física.
- `pdfParser.js` coordena os leitores e reutiliza as regras financeiras existentes. `ledgerProfile.js` deriva zero de devoluções somente quando a seção física está delimitada e íntegra; cancelamentos já incluídos nas vendas líquidas não são descontados novamente.
- `documentScopes.js` separa páginas pela identidade do fechamento e preserva continuações. Capa e notas ficam disponíveis como contexto. `tabularScopes.js` usa o vocabulário de colunas existente para separar linhas completas de CSV/Excel; recusa divisões especulativas de cupons, estoque e registros incompletos.
- `pdfWorker.js` processa cada escopo isoladamente. Um arquivo com vários caixas é um contêiner, sem total financeiro próprio. `batchAnalyzer.js` distingue arquivos originais (`sourceDocuments`) dos fechamentos expandidos, preservando progresso, estoque e páginas de contexto.
- `shared/grouping.js` preserva cupons, origem e observações na passagem para a conferência. O motor de cálculo/auditoria continua compartilhado pelo servidor e navegador.
- `AnalysisEvidence.jsx`, `InventorySummary.jsx` e `BatchResults.jsx` mostram o que foi reconhecido, os cupons excluídos, dados ausentes e quantidades. `archive.js` preserva essas evidências no histórico; `report.js` inclui a conciliação no relatório.

## Regressões verificáveis

`tests/fixtures/mega/mega-19-pages.pdf` é uma cópia do documento fictício de teste. `expected.json` contém valores calculados independentemente; nunca é importado pelo código de produção.

- 19 páginas: 17 fechamentos, uma página por OCR, capa e notas preservadas.
- 357 cupons únicos e uma linha repetida, excluída uma única vez.
- 15 diferenças calculáveis; dois turnos sem contagem permanecem pendentes.
- T02: esperado R$ 1.085,50, falta R$ 13,50; T08: esperado R$ 514,50, falta R$ 8,00; T17: esperado R$ 774,00, sobra R$ 9,50, com revisão do OCR.
- Texto `PIX foi 500, crédito 600; débito 100`: R$ 1.200,00 de pagamentos conhecidos, sem inventar dinheiro contado ou saldo físico.
- Estoque isolado e planilhas com caixas e estoque; múltiplos fechamentos na mesma aba de CSV/XLSX/XLS/ODS, incluindo colunas reordenadas.

```powershell
npm test
npm run test:integration
npm run test:mega
npm run test:horizonte
npm run build
```

## Limites explícitos

Reconhecimento determinístico não compreende qualquer documento arbitrário. Layouts sem evidências suficientes, categorias desconhecidas, fórmulas não verificadas e valores divergentes permanecem pendentes. OCR permite cálculo provisório e exige comparação com a imagem original. Arquivos sem contagem não recebem diferença inventada. O histórico local continua sem sincronização entre dispositivos e os limites do servidor permanecem em vigor.
