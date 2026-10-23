# Estefane Web 1.1 — importação de documentos

Destino de publicação: **https://estafane-web.onrender.com/**, no serviço existente `srv-dbbbeirbc2fs73aiu930`, plano Free. A referência ao Railway no pedido original foi substituída pela correção expressa do usuário. Nenhum outro serviço ou domínio deve ser criado.

## Problemas corrigidos

- O upload recusava Excel e encaminhava tudo ao leitor de PDF.
- Planilhas não tinham validação de contêiner, limites de expansão nem origem de células.
- Linhas de referência podiam gerar pendências desnecessárias; a palavra genérica “entrada” podia classificar um complemento desconhecido como suprimento.
- Lotes eram recuperáveis por qualquer sessão autenticada que conhecesse seu identificador. Agora leitura e cancelamento exigem a sessão original; novos logins têm identificadores aleatórios.
- Faltavam classificação assistida, desfazer, perfis de layout e reenvio exclusivo de falhas.

## Arquitetura e arquivos

O cálculo permanece em `shared/calculation.js`, em centavos inteiros. A extração não calcula o fechamento: leitores produzem páginas/abas e linhas com células; o adaptador tabular associa colunas; o interpretador aplica regras; a reconciliação decide se a conferência pode ser confirmada.

| Camada | Arquivos principais |
|---|---|
| Contrato de formatos e validação | `shared/documentFormats.js`, `server/services/documentDetector.js` |
| Proteção de ZIP e leitores | `archiveGuard.js`, `tabularReader.js`, `imageReader.js`, `ocrService.js`, `pdfReader.js` em `server/services/` |
| Worker e fila existentes | `analyzeService.js`, `pdfWorker.js`, `batchAnalyzer.js`, `server/app.js` |
| Interpretação e origem | `tableInterpreter.js`, `pdfParser.js`, `parserRules.js`, `movementExtractor.js`, `ledgerProfile.js`, `shared/source.js` |
| Dinheiro, agrupamento, auditoria | `shared/fields.js`, `movements.js`, `calculation.js`, `grouping.js`, `batch.js`, `reconciliation.js` |
| Correções e perfis | `shared/closingEdits.js`, `shared/importProfiles.js`, `src/context/ClosingContext.jsx`, `UnknownLine.jsx`, `ImportProfiles.jsx` |
| Upload e apresentação | `src/components/upload/`, `src/components/fechamento/`, `src/components/batch/BatchSummary.jsx`, páginas Home/Settings/Support/BatchResults, Layout, `src/styles/app.css` |
| Relatórios e API cliente | `src/services/report.js`, `src/services/closingApi.js`; impressão e PDF continuam usando a estrutura existente |
| Dependências | `package.json`, `package-lock.json`, `vendor/xlsx-0.20.3.tgz`, `vendor/README.md` |
| Regressão | `tests/documents.test.js`, `tests/documentIntegration.js`, `tests/fixtures/documents.js`, suítes anteriores preservadas |

SheetJS é usado somente no servidor/worker para XLSX, XLS e ODS. O pacote oficial é versionado em `vendor/` para permitir `npm ci` sem depender do CDN durante o deploy. `yauzl` valida o ZIP por streaming antes de abrir a planilha. Nenhuma biblioteca de Excel é enviada ao frontend.

## Formatos implementados e limites reais

| Formato | Comportamento validado |
|---|---|
| PDF | Texto, múltiplas páginas, OCR de digitalizados e páginas mistas; leitor anterior preservado |
| XLSX | Células de texto/número/data, múltiplas abas, mesclagens, cabeçalhos repetidos, linhas ocultas e resultados armazenados de fórmulas |
| XLS | Arquivos binários OLE/BIFF8, representativos do Excel 97–2003 |
| ODS | Abas e valores de planilhas geradas em fixture compatível com OpenDocument |
| CSV | Delimitadores `;`, vírgula, TAB e `|`, aspas e vírgula decimal brasileira |
| TXT | Relatórios rotulados e tabelas delimitadas; UTF-8, UTF-16 com BOM e fallback Windows-1252 |
| PNG/JPG/JPEG | OCR português local, valores sempre sujeitos à conferência humana |

Todas essas verificações usam **arquivos fictícios**. Não há planilha real do supermercado anexada neste pedido: a compatibilidade do layout específico do sistema comercial ainda precisa ser conferida com um exemplar autorizado.

Planilhas de abas independentes com identificação completa são separadas em fechamentos. Abas complementares permanecem no mesmo documento. Registros de vários operadores/caixas/datas misturados na mesma tabela, sem separação segura, ficam ambíguos e impedem confirmação; não são automaticamente somados como um único caixa.

Não são suportados macros, objetos incorporados, vínculos externos de workbook, arquivos criptografados/protegidos sem suporte, arquivos ZIP64 fora dos limites, BIFF bruto muito antigo e planilhas que dependam de executar fórmulas para obter valores. Fórmulas **nunca são executadas**; resultados armazenados podem estar desatualizados e exigem conferência. Fórmula sem resultado não vira zero. Linhas e abas ocultas são incluídas com indicação da origem; células mescladas não duplicam valores. Mesclagens e colunas sem relação comprovável continuam pendentes.

Limites: 10 arquivos, 10 MB por arquivo, 30 MB por lote; fila com uma análise simultânea no Render; 120 segundos por documento; 20 páginas/abas; 5 mil linhas, 100 colunas por aba, 50 mil células preenchidas e 250 mil caracteres extraídos. Texto: 2 MB. ZIP: 2 mil entradas, 40 MB expandidos no total, 16 MB por entrada, com limite adicional de razão de compressão e validação de tamanho real. Imagem/OCR: 4 megapixels, até 12 mil pixels por lado para imagens. Esses limites reduzem consumo, mas memória nativa de OCR/canvas continua sujeita à capacidade real do plano Free.

## Regras financeiras e conferência

- Fundo + vendas em dinheiro + suprimentos − sangrias − devoluções aplicáveis − despesas autorizadas − cancelamentos/estornos físicos adicionais, quando comprovados.
- PIX, cartão e vales não entram no dinheiro físico. Vale-alimentação e vale-refeição identificados separadamente são conciliados com o total, sem somá-lo novamente.
- Cancelamentos já refletidos nas vendas líquidas não são descontados de novo. Resumos e subtotais conciliam os itens em vez de duplicá-los.
- Duplicação de arquivo usa SHA-256. Operações usam identificadores e contexto; igualdade de valor, sozinha, não exclui duas operações legítimas.
- Sinais negativos, valores divergentes, campos ausentes e identidades incompatíveis permanecem visíveis e bloqueiam confirmação quando necessário.
- A linha desconhecida mostra arquivo, aba/página, célula/linha, conteúdo e motivo. A operadora escolhe entre substituir um total, adicionar uma movimentação ou esclarecer uma referência sem movimento adicional.
- Correções registram valor anterior/atual e motivo, recalculam o saldo, invalidam confirmação anterior e podem ser desfeitas. O histórico permanece auditável.
- Depois de confirmar o fechamento, classificações de totais podem ser salvas como perfil local, versão 1, vinculado à assinatura exata do layout. As sugestões de perfil continuam exigindo revisão. Não existe treinamento de IA externa nem aplicação indiscriminada a outros layouts.
- Relatórios individuais/consolidados preservam A4, 80 mm e 58 mm, origem, ajustes, pendências, faltas e sobras. Somente fechamentos confirmados entram nos totais confirmados, inclusive nas divisões por operadora, data e turno.

## API e privacidade

Endpoints existentes preservados: `POST /api/fechamento/analisar` (campo multipart `pdf`, agora aceita os formatos suportados) e `POST /api/fechamento/analisar-lote` (campo `pdfs`). Os nomes antigos dos campos foram mantidos para não quebrar integrações. O lote aceita `autoGroup` e, opcionalmente, `importProfiles` JSON validado (até 20 layouts, 30 regras por layout, 32 KB no formulário). Origem, sessão, tamanho, MIME, assinatura e conteúdo são conferidos no servidor.

Respostas acrescentam `format`, `layoutKey`, `extractionIssues`, proveniência de células, confiança e partes de workbook quando aplicável. O contrato de lote permanece versão 2. `GET /api/health` é autenticado e informa versão do aplicativo, revisão pública e formatos; `/healthz` continua sendo um probe público mínimo. Erros distinguem arquivo inválido, formato/recurso não suportado, limite e falha técnica sem expor credenciais.

Arquivos temporários são descartados após análise; resultados do servidor expiram. Valores e documentos não são gravados no localStorage. Perfis locais guardam apenas regras de classificação. Não há exportação CSV nesta versão; portanto nenhum conteúdo de documento é gerado como fórmula em CSV. Nenhum dado real é enviado nos testes de produção.

## Validação

`npm test`: 122 testes, incluindo todos os 98 anteriores e 24 novos casos de importação, segurança e regressão financeira. `npm run test:integration` executa as cinco suítes: documentos PDF/OCR e impressão, movimentações, lotes, novos formatos e relatórios/ZIP. `npm run test:dev` verifica uploads reais no processo com `node --watch`. `npm run build` gera o frontend.

Exemplo obrigatório reproduzido por PDF, XLSX, XLS, ODS, CSV e TXT: sangrias 90000 centavos, esperado 73075, contado 71725, diferença **−1350 centavos**. PNG e JPEG usam OCR real e permanecem pendentes de conferência. Foram exercitados ainda lote misto com falha isolada, arquivo repetido renomeado, dois caixas em abas distintas e bloqueio de leitura/cancelamento por outra sessão do mesmo usuário.

Interface: upload, reenvio apenas das falhas, classificação manual, recálculo, desfazer, confirmação e salvamento de perfil foram exercitados pelo navegador. Importação verificada em 390 px, 768 px e desktop sem rolagem horizontal. Impressão física em equipamento real continua dependendo do driver/papel e não foi certificada; os PDFs A4/80/58 são conferidos pelas suítes existentes.

O deploy só deve ser considerado concluído após a revisão correta aparecer como `live` no serviço existente e o teste autenticado de produção confirmar a versão e a leitura dos arquivos fictícios. O histórico do Render identifica o commit ativo; nenhuma senha deve ser incluída neste relatório.
