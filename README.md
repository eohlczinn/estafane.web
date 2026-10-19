# estefane-web

Sistema de fechamento de caixa do **Pingo De Ouro**, sobre o projeto existente React + Vite, Express, PDF.js, OCR português e jsPDF. Preserva o perfil da Estefane, sidebar, temas e cores. Um PDF, vários caixas ou documentos complementares usam o mesmo motor financeiro compartilhado.

## Executar

Node.js 24 LTS e npm (validado com Node 24.19.0). A instalação inicial precisa de internet; leitura e OCR utilizam bibliotecas e modelo instalados, sem serviços externos.

```powershell
cd D:\web-site\estefane-web
npm ci
npm run dev
```

Frontend: http://127.0.0.1:5173. API: http://127.0.0.1:8787/api/health. O comando inicia os dois processos; mantenha o terminal aberto. Ctrl+C encerra. Não instala serviço do Windows nem inicialização automática.

Produção local: `npm run build` e `npm start`, abrindo http://127.0.0.1:8787. Não abra o HTML diretamente pelo explorador.

## Uso

1. Selecione ou arraste de 1 a 10 PDFs. Adicione outros, remova itens ou limpe a seleção. Nome, tamanho e duplicação por conteúdo ficam visíveis.
2. Analise. O progresso vem do servidor: aguardando, leitura, interpretação, cálculo, auditoria e resultado individual. Sem porcentagens simuladas. É possível cancelar; sair da tela cancela a análise dessa seleção.
3. O resultado único abre sua conferência; vários documentos abrem o dashboard do lote. Falhas individuais não impedem os demais arquivos válidos.
4. Documentos com identidade completa e referência confiável ou turno/período compatível são associados. Operadora igual sozinha não basta. Associação incerta exige decidir entre fechamentos independentes ou documentos complementares, antes de corrigir valores.
5. Confira esperado, contado e diferença. Itens, pagamentos, origem e memória do cálculo ficam em detalhes recolhidos. Corrija dados e esclareça somente as ambiguidades reais. Cada alteração registra o valor anterior, reaudita, invalida a confirmação e atualiza o consolidado.
6. Confirme cada fechamento. Salve ou imprima A4, 80 mm ou 58 mm, com ilustrações e prévia. O lote oferece consolidado, ZIP dos individuais confirmados e impressão dos individuais selecionados.

O preenchimento manual continua disponível. Pingo De Ouro, Estefane e a data de hoje em America/Sao_Paulo são padrões identificados, nunca evidência para agrupar PDFs. Dados reais do documento prevalecem. Um cálculo sem diferença não recebe confirmação final apenas porque a leitura terminou.

## Precisão financeira

- Valores em centavos inteiros; formato brasileiro, sem arredondamento silencioso. Movimentações têm magnitude positiva e direção separada. Uma sangria negativa no documento é normalizada como saída, nunca somada por dupla negação.
- Dinheiro esperado bruto = fundo + vendas em dinheiro + suprimentos − sangrias − devoluções em dinheiro aplicáveis.
- Saldo líquido em dinheiro explicitamente declarado substitui a fórmula bruta; sangrias já incluídas não são descontadas novamente.
- Diferença = contado − esperado. Negativa: falta; positiva: sobra; zero: sem diferença, sujeita à conferência. PIX/cartões/vale não são dinheiro na gaveta.
- Itens de sangria/suprimento são somados; subtotais declarados conferem os itens e não entram novamente na soma. Subtotais parciais são conferidos em seu documento de origem. Fundo inicial é um saldo, não um fluxo de entradas repetidas.
- Operações com identificador repetido e valor igual são excluídas da soma; identificador igual e valor diferente gera conflito. Valores iguais sem identificadores não bastam para deduplicar movimentos de documentos diferentes.
- Cancelamentos, estornos e devoluções com efeito explícito seguem a evidência. Valores positivos com efeito indeterminado pedem esclarecimento específico. Saídas adicionais que possam repetir devoluções exigem justificativa.
- Cartões consolidados conferem débito + crédito, sem nova soma. Total de vendas pode ser declarado; derivá-lo exige pagamentos completos. Pagamentos conhecidos maiores que vendas também geram conflito, mesmo com categorias ausentes.
- Ausência continua `null`. Informe zero somente após conferir. Correções manuais de agregados substituem o total calculado e preservam itens, origem e histórico para comparação.
- Auditoria: `incomplete`, `conflict`, `review_required`, `validated` e `error`. Dados essenciais sem origem/confirmação, divergências e linhas financeiras desconhecidas impedem confirmação até serem resolvidos.

O consolidado soma **somente fechamentos confirmados e auditados**. Faltas e sobras ficam separadas. Saldo líquido é mostrado somente quando todos os fechamentos incluídos estiverem validados e não houver falhas de documentos. Um consolidado parcial pode ser salvo/imprimido, com identificação explícita e lista de exclusões; nunca é rotulado como totalmente validado.

## Modelo e API

Contratos JSON versão 2 em `shared/contracts.js`:

- Documento: ID, nome seguro, SHA-256, estado, páginas/texto/coordenadas, campos, movimentações, subtotais, origem e avisos.
- Fechamento: documentos associados, identidade, campos, movimentos, regras extraídas, auditoria, histórico e confirmação.
- Lote: documentos, fechamentos, sugestões de associação e resumo.

Rotas:

- `GET /api/health`: limites e saúde.
- `POST /api/fechamento/analisar`: compatibilidade com upload único, campo `pdf`, resultado completo.
- `POST /api/fechamento/analisar-lote`: multipart `pdfs`, retorna HTTP 202 e ID. Campo opcional `autoGroup=false`.
- `GET /api/fechamento/lotes/:id`: progresso real e resultado do lote.
- `DELETE /api/fechamento/lotes/:id`: cancela tarefas em espera e processos ativos quando possível.

Falhas de processamento são específicas por documento. Excesso total de tamanho/quantidade rejeita a requisição. O lote continua pendente se houver arquivos com erro ou fechamentos não confirmados.

## Limites e operação do servidor

| Variável | Padrão | Faixa |
| --- | --- | --- |
| `HOST` | `127.0.0.1` | Endereço de escuta |
| `PORT` | `8787` | 0–65535, 0 escolhe porta livre |
| `MAX_BATCH_FILES` | 10 | 1–10 |
| `MAX_UPLOAD_MB` | 10 | 1–30 por arquivo |
| `MAX_BATCH_MB` | 30 | 1–100 por lote |
| `ANALYSIS_CONCURRENCY` | 1 | 1–2 workers globais |
| `MAX_ACTIVE_BATCHES` | 3 | 1–5 |
| `BATCH_RETENTION_MINUTES` | 10 | 1–30 |

As preferências de limite no navegador podem reduzir, nunca ampliar, o limite do servidor. Cada PDF tem no máximo 20 páginas, 250 mil caracteres extraídos e 5 mil linhas; OCR limitado a 16 milhões de pixels por página; worker com heap JS de 384 MB e timeout de 120 segundos. Memória nativa de OCR/canvas não é limitada pelo heap JS. Documentos do lote aguardam numa fila global limitada, compartilhada com o endpoint único.

Uploads são gravados por streaming em diretórios aleatórios na pasta temporária do sistema, sem cópias integrais de lotes na memória do Express. Arquivos individuais acima do limite são descartados e sinalizados sem impedir os demais. O tamanho total é medido durante o streaming. Arquivos são removidos após o processamento e cancelamento. Diretórios de execuções interrompidas, com mais de duas horas, são limpos na inicialização e periodicamente. Diretórios de limpeza são verificados dentro da raiz de temporários da aplicação.

Resultados estruturados permanecem apenas em memória: até a expiração do lote, com limite adicional de dez lotes finalizados retidos. O navegador mantém a sessão financeira até recarregar. localStorage contém somente preferências permitidas; não inclui documentos, valores, texto ou observações financeiras. Downloads explícitos permanecem onde o navegador salvar.

## Acesso privado e hospedagem futura

A escuta padrão é somente loopback. A API verifica acesso além de Origin, define respostas sem cache e cabeçalhos de segurança e não registra conteúdo financeiro. Não confia em cabeçalhos de identidade ou `X-Forwarded-For` não verificados.

`app.locals.verifyAccess(req)` é o ponto de integração de um provedor externo: substituir por verificação real de JWT/sessão conforme o provedor escolhido. Não existe login próprio. `ACCESS_BEARER_TOKEN`, quando configurado, exige esse token no cabeçalho Authorization e usa comparação segura. Esse modo atende integração de servidor/proxy; não coloque token em código frontend ou localStorage. `ALLOWED_ORIGINS` configura as origens permitidas separadas por vírgula, mas não autentica usuários.

Se HOST não for loopback e nenhum verificador de acesso estiver configurado, a API recusa acesso. O uso público exige HTTPS, provedor de acesso privado verificado no proxy/servidor, isolamento de requisições por usuário, rate limiting, supervisão do processo, política de retenção e validação de infraestrutura. Esses itens de implantação não estão configurados nem publicados nesta entrega. A integração de autenticação é um ponto preparado, não uma autenticação de hospedagem homologada.

Em servidor hospedado, os PDFs viajam até esse servidor; o OCR acontece nele, não necessariamente no celular. A interface explica isso. O preview loopback não é acesso automático por outro celular.

## Relatórios e impressão

Conteúdo estruturado comum para HTML e jsPDF. Individual inclui identificação, pagamentos, movimentos com saídas sinalizadas, resultado, documentos, correções, observações, assinatura e horário quando habilitados. Consolidado inclui período, contagens, totais confirmados, resultado por caixa, faltas/sobras e exclusões. Nomes incluem caixa, identificador, papel e horário; ZIP contém PDFs com nomes distintos.

A4 pagina; térmicas usam largura real e altura calculada, paginando se exceder o limite físico do PDF. `@media print`, páginas nomeadas e portal separado removem menus/sidebar/botões. O diálogo de impressão depende do navegador/driver; o sistema não afirma que a impressão física terminou. Valide margens e corte na impressora real. Navegador incorporado pode não disponibilizar o diálogo: salve o PDF e use o leitor do sistema.

As imagens de A4/80/58 são locais em `public/illustrations/`, geradas durante o desenvolvimento e sem chamadas externas durante o uso.

## Organização

- `shared/calculation.js`, `movements.js`, `reconciliation.js`: motor único de cálculo, normalização e auditoria para servidor e navegador.
- `shared/grouping.js`, `batch.js`, `closingEdits.js`, `contracts.js`: associação, consolidado, histórico/revalidação e contrato versionado.
- `server/services/movementExtractor.js`, `pdfParser.js`, `parserRules.js`, `textLines.js`, `pdfReader.js`: extração por rótulos, itens/subtotais e coordenadas. OCR português em `ocrService.js`.
- `server/services/executionQueue.js`, `batchAnalyzer.js`, `uploadStorage.js`, `analyzeService.js`, `pdfWorker.js`: fila, lote, streaming temporário, processo isolado e progresso.
- `server/services/groupingService.js` e `reconciliationService.js`: entradas do servidor para os módulos compartilhados.
- `server/app.js`, `config.js`, `index.js`: rotas/acesso, limites e inicialização/encerramento.
- `src/context/ClosingContext.jsx`: sessão com vários fechamentos e compatibilidade com o único.
- `src/components/upload/`, `batch/`, `fechamento/`, `printing/`: upload, dashboard, conferência e formatos.
- `src/pages/BatchResults.jsx`, `Results.jsx`, `Report.jsx`: lote, detalhe e emissão reutilizada para individual/consolidado/seleção.
- `src/services/closingApi.js`, `report.js`, `pdfGenerator.js`, `zip.js`, `preferences.js`: comunicação, conteúdo, emissão, ZIP e preferências.

## Verificação e limites de homologação

```powershell
npm test
npm run test:integration
npm run test:dev
npm run build
npm audit
```

A integração inclui PDFs reais **fictícios**, OCR, múltiplas páginas e colunas, sangrias repetidas, falta/sobra, lotes independentes/complementares/duplicados, operadores/datas diferentes, erro parcial, cancelamento, limites, senha, PDFs individuais/consolidado A4/80/58 e ZIP. Artefatos em `tests/output/`, sem importação automática na produção. `test:dev` faz uploads contra `node --watch` e verifica a sobrevivência da API.

**O PDF efetivamente usado pelo Pingo De Ouro ainda não foi fornecido nem homologado. O sistema não está declarado pronto para uso financeiro real sem essa validação.** Os aliases e regras são extensíveis em `parserRules.js`/`movementExtractor.js` com regressões de amostras anonimizadas. OCR também exige conferência humana. Impressora física, celular físico e infraestrutura de hospedagem ainda precisam de homologação.

Consulte `REESTRUTURACAO.md` para a comprovação atual e `DIAGNOSTICO-LOTE.md` para o diagnóstico inicial. `VALIDACAO.md` registra a rodada anterior, de fechamento único.
