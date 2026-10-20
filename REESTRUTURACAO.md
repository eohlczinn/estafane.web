# Entrega técnica — Estefane Web

Validação final: **20/10/2026**, Windows, Node.js 24.19.0. Projeto existente em `D:\web-site\estefane-web`. Diagnóstico inicial em `DIAGNOSTICO-LOTE.md`. Não houve recriação do site, publicação na internet ou criação de autenticação própria.

## Resultado implementado

Um ou vários PDFs utilizam o mesmo leitor, motor financeiro e auditoria. O frontend distingue documento, fechamento e lote. O backend preserva a rota individual, adiciona lotes assíncronos, progresso por documento, fila global, cancelamento e tratamento de falhas individuais. Design, sidebar, foto da Estefane, temas, cores e formatos de papel foram preservados.

Não há dados financeiros fictícios carregados automaticamente na produção. Todos os exemplos usados na validação são arquivos identificados como **fictícios**, em `tests/output/`.

## Arquivos e responsabilidades

| Arquivos novos ou modificados | Alteração |
| --- | --- |
| `server/services/movementExtractor.js` | Extrai itens individuais, direção, magnitude positiva, identificadores, subtotais e evidências de efeito financeiro. |
| `server/services/pdfParser.js`, `parserRules.js` | Integra itens e totais, reconhece identidade e referência, conserva conflitos e linhas desconhecidas. Rótulos líquidos ambíguos ficam pendentes. |
| `server/services/textLines.js`, `pdfReader.js` | Conserva colunas, segmentos e coordenadas. Mantém OCR local e aplica limites de texto/páginas. |
| `shared/fields.js`, `movements.js`, `calculation.js` | Contrato de campos, soma segura e motor único de centavos inteiros; saldo líquido e fórmula bruta separados. |
| `shared/reconciliation.js`, `server/services/reconciliationService.js` | Auditoria reutilizada no servidor e após correções no navegador. |
| `shared/grouping.js`, `server/services/groupingService.js` | Associação conservadora e deduplicação de operações, preservando candidatos conflitantes. |
| `shared/batch.js`, `closingEdits.js`, `contracts.js` | Consolidado, histórico de alterações, invalidação de confirmações e contratos versão 2. |
| `server/services/executionQueue.js`, `batchAnalyzer.js` | Fila, progresso efetivo, estados individuais, retenção limitada e continuidade após erros. |
| `server/services/uploadStorage.js` | Upload em streaming para temporários aleatórios, medição do tamanho total e limpeza verificada. |
| `server/services/analyzeService.js`, `pdfWorker.js` | Protocolo IPC tipado, progresso, timeout, aborto e processamento isolado. |
| `server/app.js`, `config.js`, `index.js` | Rotas individuais/lotes, limites, ponto de verificação de acesso externo, cabeçalhos, HOST/PORT e encerramento. Remove o bloqueio global `busy`. |
| `src/services/closingApi.js` | Upload multipart e consulta de progresso/cancelamento. |
| `src/context/ClosingContext.jsx` | Mantém múltiplos fechamentos, seleção ativa, auditoria, histórico e resumo reativo, sem persistir valores financeiros. |
| `src/components/upload/Upload.jsx`, `FileList.jsx`, `FileStatus.jsx` | Seleção múltipla, inclusão posterior, remoção, limpeza, hash no navegador e andamento por arquivo. |
| `src/components/batch/BatchSummary.jsx`, `ClosingCard.jsx`, `src/pages/BatchResults.jsx` | Dashboard real, decisões de associação, totais confirmados e emissão em lote. |
| `src/components/fechamento/Review.jsx`, `MovementDetails.jsx`, `CalculationDetails.jsx`, `DocumentSource.jsx` | Resultado prioritário, detalhes recolhidos, correções, justificativas e origem. |
| `src/services/report.js`, `pdfGenerator.js`, `zip.js` | Conteúdo comum, PDFs individuais/consolidado, A4 em colunas, bobinas com altura calculada, paginação e ZIP com CRC-32. |
| `src/pages/Report.jsx`, `Results.jsx`, `Home.jsx`, `Settings.jsx`, `Support.jsx` | Integração dos fluxos, configuração de lotes, privacidade e ajuda atualizadas. |
| `src/components/layout/Layout.jsx`, `src/App.jsx`, `src/styles/app.css` | Navegação de fechamentos sem descartar a sessão, responsividade e extensão visual compatível. |
| `src/services/preferences.js` | Lista permitida de preferências e limites de lote; documentos/valores não entram no localStorage. |
| `tests/movements.test.js`, `batch.test.js`, `closingEdits.test.js`, `contracts.test.js`, `startup.test.js` | Regressões financeiras, associação, alterações, contratos, ZIP e porta ocupada. |
| `tests/singleMovementIntegration.js`, `batchIntegration.js`, `batchReports.js`, `integration.js` | PDFs reais de teste do upload à extração, auditoria e emissão. |
| `tests/finance.test.js`, `package.json`, `README.md` | Expectativa de agregado negativo corrigida, comandos de integração ampliados e operação documentada. |

Não foi adicionado outro motor financeiro, OCR externo ou dependência de API paga. As regras comuns ficam em `shared/`; wrappers do servidor expõem essas mesmas implementações.

## Correções financeiras

Sangrias numeradas, retiradas, recolhimentos e saídas do caixa reconhecidas viram registros individuais com ID estável derivado do documento e da posição, `amountCents >= 0`, `direction: out`, texto original e origem. Suprimentos/entradas de numerário utilizam `direction: in`. A palavra “saída” isolada não vira sangria.

Os itens são somados uma vez. Subtotais servem para conferência no seu escopo documental, sem nova soma. Fundo inicial é um saldo, não uma série aditiva de lançamentos repetidos. Identificadores iguais com valores iguais permitem excluir repetições; identificadores iguais com valores diferentes geram conflito. Ausência de identificadores em documentos sobrepostos exige esclarecimento.

Fórmula bruta: fundo + vendas em dinheiro + suprimentos − sangrias − devoluções em dinheiro aplicáveis. Um saldo líquido explicitamente identificado substitui essa fórmula, evitando novo desconto de sangrias. Se saldo líquido e fórmula bruta completa divergirem, a auditoria pede correção ou justificativa específica. “Dinheiro líquido” sem definição suficiente não é assumido como venda bruta.

Cancelamentos e estornos já incluídos nos valores líquidos não são descontados novamente. Saída física adicional exige evidência ou esclarecimento específico. Possível sobreposição com devoluções bloqueia confirmação até ser esclarecida. Pagamentos eletrônicos não entram na gaveta. Cartões consolidados não são somados aos seus detalhes. Pagamentos conhecidos maiores que as vendas geram conflito mesmo se outras categorias estiverem ausentes.

Valores ausentes continuam nulos. Correções guardam valor anterior/novo, mantêm o original, recalculam e invalidam a confirmação e os totais confirmados do consolidado. Agregados corrigidos manualmente são identificados como substituição explícita da soma, preservando os itens para comparação.

## Lotes, associação e privacidade

- Padrão: **até 10 PDFs**, 10 MB por arquivo, 30 MB por lote, 20 páginas por PDF. O limite do navegador não amplia o do servidor.
- Fila global compartilhada com o endpoint individual: **um worker por vez** por padrão, configurável até dois. Tarefas aguardam sem carregar todos os PDFs na memória do Express.
- Cada arquivo recebe SHA-256. Repetição exata é sinalizada e não soma valores novamente. Nomes iguais sozinhos não definem duplicidade.
- Associação automática exige identidade completa compatível e referência do fechamento ou período confiável. Operadores, caixas ou datas incompatíveis ficam separados. Associação incerta permanece pendente e exige uma decisão explícita.
- Um arquivo inválido, com senha, corrompido ou grande demais pode falhar individualmente enquanto os outros continuam. Excesso total do lote ou quantidade inválida rejeita a requisição.
- Cancelamento remove tarefas em espera e encerra workers ativos quando possível. Timeout por documento: 120 segundos. O protocolo ignora mensagens internas de `node --watch`.
- Temporários são descartados após a leitura; resultados ficam em memória por até dez minutos no padrão. A rotina de limpeza restringe seus alvos à raiz da aplicação. Diretórios antigos de execuções interrompidas são limpos na inicialização e periodicamente. Na inspeção final, a raiz de temporários não continha diretórios de lotes pendentes.
- Hospedagem privada está preparada por um ponto de verificação de acesso; integração real com provedor, isolamento entre usuários e infraestrutura pública **não estão homologados**. O padrão permanece loopback. Não há afirmação de que OCR em servidor remoto ocorre no celular.

## Comprovação do PDF obrigatório

Arquivo efetivamente enviado ao endpoint: `tests/output/sangrias-ficticio.pdf`, gerado e marcado como documento fictício. O teste usa multipart, PDF.js, parser e cálculo; não aprova a leitura com um objeto preenchido manualmente.

| Campo efetivamente extraído/calculado | Valor |
| --- | --- |
| Fundo inicial | R$ 200,00 |
| Vendas em dinheiro | R$ 1.280,75 |
| Suprimentos | R$ 150,00 |
| Sangria 01 | R$ 400,00, normalizada de sinal negativo no PDF |
| Sangria 02 | R$ 500,00 |
| Total de sangrias | R$ 900,00 |
| Devoluções | R$ 0,00 declarado |
| Dinheiro esperado | R$ 730,75 |
| Dinheiro contado | R$ 717,25 |
| Diferença | **− R$ 13,50** |
| Resultado | **FALTA** |

Valores extraídos também registrados em `tests/output/sangrias-extraidas.json` e comparados com os resultados esperados pelo teste.

## Testes executados

| Comando | Resultado |
| --- | --- |
| `npm test` | **76 testes aprovados, 9 arquivos, 0 falhas.** Inclui regressões de líquido/bruto, devoluções e porta ocupada. |
| `npm run test:integration` | Quatro scripts aprovados: extração/OCR/rotas, PDF de sangrias, lotes e relatórios. |
| `node tests/batchIntegration.js` | Reexecutado com **dez PDFs válidos**, dez fechamentos separados e testes de erro/duplicação/associação. |
| `npm run test:dev` | Três uploads reais com `node --watch`; saúde da API preservada após cada um. |
| `npm run build` | Build Vite aprovado. Reexecutado após o ajuste final do indicador dos relatórios selecionados. |
| `npm audit` | Nenhuma vulnerabilidade encontrada. |
| Verificação ZIP por `zipfile` | CRC e conteúdo PDF válidos; ZIP baixado pela interface contém três PDFs distintos. |

Cobertura dos quinze cenários solicitados: sangrias múltiplas, sinal negativo, subtotal sem dupla soma, caixa equilibrado, PDFs independentes, hash duplicado, documentos complementares, operadores diferentes, datas diferentes, faltas/sobras separadas, erro parcial, contado ausente, cancelamento já incluído, emissão individual/consolidada A4/80/58 e fluxo frontend/backend. Os testes de integração usam PDFs com conteúdo conhecido, inclusive texto, imagem/OCR e colunas reais.

## Navegador e responsividade

Fluxo real exercitado: três arquivos → três caixas → correção do contado → falta de R$ 20,00 no caixa 01 → sobra de R$ 10,00 no caixa 02 → consolidado parcial enquanto caixa 03 não confirmado → confirmação do terceiro → saldo líquido −R$ 10,00, mantendo faltas/sobras separadas. O PDF individual, o consolidado parcial e o ZIP foram baixados por botões da aplicação.

O padrão da tela vazia foi conferido em **20/10/2026**. Os PDFs de teste datados de 19/10/2026 mantiveram a data do documento, sem substituição silenciosa.

Upload, dashboard do lote, detalhe e configurações foram conferidos em 320, 375, 390, 768, 1024 e 1440 px. Larguras de conteúdo e viewport útil coincidiram respectivamente em 305, 360, 375, 753, 1009 e 1425 px, sem rolagem horizontal da página. O PDF de duas sangrias também foi processado e confirmado na interface, e seu relatório em 58 mm foi baixado. A prévia de dois relatórios em bobina foi inspecionada em 320 px, com os três formatos ilustrados disponíveis e seleção de 80 mm.

Capturas: `tests/output/lote-final-desktop.png`, `tests/output/lote-impressao-mobile.png`, `tests/output/sangrias-resultado.png` e `tests/output/configuracoes-lote-final.png`. São evidências de testes fictícios, não fechamentos reais do Pingo De Ouro. Os tamanhos temporários foram restaurados e as abas isoladas de testes foram encerradas, sem manter esses valores na tela de uso.

## Estado de aprovação e pendências

Implementados e verificados: envio único/múltiplo, fila e falha individual, movimentações e somas, saldo esperado/contado/diferença, separação/associação conservadora, auditoria, correções, resumo confirmado/parcial, PDFs e ZIP, formatos com medidas reais, build e estabilidade após uploads.

**Não homologado para uso financeiro real:** o formato efetivamente exportado pelo Pingo De Ouro ainda não foi fornecido. É necessário validar esse modelo e eventuais regras específicas com amostras reais anonimizadas. Não há promessa de compatibilidade universal.

**Impressão física pendente:** seleção e prévias foram verificadas, e a solicitação de impressão foi acionada. O diálogo nativo bloqueou a automação do navegador; isso não comprova envio ao equipamento nem saída em papel. Corte, margens e driver de A4/80/58 precisam de teste na impressora real. O download de PDF permanece disponível como alternativa.

**Celular físico e hospedagem privada pendentes:** responsividade foi verificada em viewports, não em aparelhos reais. Provedor externo de acesso, HTTPS, rate limiting, isolamento por usuário e supervisão do processo dependem do ambiente de publicação. Nenhuma implantação foi feita.

**Operação:** `npm run dev` mantém frontend e API enquanto o processo estiver aberto. Não é um serviço do Windows nem garantia de execução após fechar o terminal ou desligar o computador. A API foi verificada ativa após os testes desta rodada.

## Correção validada com o extrato fictício enviado em 20/10/2026

Arquivo testado pela interface: `relatorio_caixa_teste_estefane.pdf`, preservado sem alterações. O PDF declara Mercado Exemplo (fictício), Estefane, caixa 03 e movimento de 18/10/2026; estes metadados do documento prevalecem sobre preferências e a data de hoje.

Problema: cabeçalhos sem dois-pontos misturavam operadora/caixa e estabelecimento/data; o resumo bruto/líquido e a repetição das vendas em dinheiro não eram conciliados. A ausência de uma linha explícita de devoluções impedia o cálculo.

Correção: `parserRules.js` e `pdfParser.js` reconhecem esses rótulos e separam as colunas de metadados. `ledgerProfile.js` concilia vendas brutas menos cancelamentos com vendas líquidas e reconhece a seção delimitada de movimentações físicas. Somente neste perfil, quando a seção está completa, suas linhas financeiras são conhecidas e nenhuma devolução é registrada, devoluções recebe zero derivado com evidência e explicação visível na memória de cálculo. PDFs genéricos, seções abertas e saídas desconhecidas continuam pendentes. O motor compartilhado de cálculo mantém a fórmula em centavos; não há resultado fixado para o exemplo.

Resultado verificado no navegador: fundo 200,00 + dinheiro 1.280,75 + suprimento 150,00 - sangrias (400,00 + 500,00) = esperado 730,75. Contado 717,25 - esperado 730,75 = **-13,50**. Cancelamentos de 180,00 já refletidos nas vendas líquidas não são descontados outra vez. O fechamento permanece para confirmação humana.

Regressões: `tests/ledgerProfile.test.js` e fixture textual fictícia, incluindo valores diferentes, divergência bruto/líquido, seção incompleta, saída desconhecida e tratamento contraditório. 82 testes unitários passaram. Evidência: `tests/output/estefane-pdf-falta-13-50.png`.
