# estefane-web

Sistema de fechamento de caixa do **Pingo De Ouro**, sobre o projeto existente React + Vite, Express, PDF.js, OCR português e jsPDF. Preserva o perfil da Estefane, sidebar, temas e cores. PDFs, planilhas, texto e imagens usam o mesmo motor financeiro compartilhado.

**Versão 1.1.0 — site ativo: https://estafane-web.onrender.com/**. A hospedagem atual é o serviço existente do Render, plano Free. A configuração Railway abaixo permanece como referência histórica/alternativa e não é o destino de publicação atual.

Veja [EVOLUCAO-1.1.md](EVOLUCAO-1.1.md) para arquitetura, arquivos afetados, formatos efetivamente implementados, limites, conferência manual, perfis de layout e validação. A importação agora aceita PDF, XLSX, XLS/BIFF8, ODS, CSV, TXT, PNG e JPEG. Fórmulas e macros não são executadas; resultados armazenados de fórmulas e todo OCR exigem conferência. Compatibilidade com layouts específicos do supermercado depende de validação com arquivos reais autorizados.

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

1. Selecione ou arraste de 1 a 10 documentos suportados. Adicione outros, remova itens ou limpe a seleção. Nome, formato, tamanho e duplicação por conteúdo ficam visíveis. Falhas podem ser reenviadas sem repetir os arquivos válidos.
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

Rotas da API:

- `POST /api/auth/login`: login com usuário e senha, rate-limiting e emissão de cookie `HttpOnly`.
- `POST /api/auth/logout`: encerra a sessão com segurança e expira o cookie.
- `GET /api/auth/me`: valida a sessão ativa e retorna os dados do usuário.
- `GET /api/health`: limites, status e integridade do servidor.
- `POST /api/fechamento/analisar`: compatibilidade com upload único, campo `pdf`, resultado completo (exige autenticação).
- `POST /api/fechamento/analisar-lote`: multipart `pdfs`, retorna HTTP 202 e ID (exige autenticação). Campo opcional `autoGroup=false`.
- `GET /api/fechamento/lotes/:id`: progresso real e resultado do lote (exige autenticação).
- `DELETE /api/fechamento/lotes/:id`: cancela tarefas em espera e processos ativos (exige autenticação).

## Autenticação, Segurança e Deploy no Railway

O sistema possui autenticação nativa completa para ambiente de produção (Railway) e dispositivos móveis:

- **Sessão por Cookie HttpOnly**: os tokens de sessão são assinados com HMAC-SHA256, com flags `HttpOnly`, `SameSite=Lax` e `Secure` (em HTTPS / produção). O frontend nunca tem acesso direto ao token, protegendo contra XSS.
- **Login sem bloqueio por tentativas**: uma senha incorreta permite tentar novamente imediatamente, sem contador ou espera de 15 minutos. O acesso continua exigindo usuário, senha e sessão válida.
- **Proteção contra CSRF**: validação estrita de origens confiáveis para requisições de modificação.
- **Armazenamento Seguro de Senha**: suporte a hash de alta derivação computacional `scrypt` (`ADMIN_PASSWORD_HASH`) ou senha via variável de ambiente (`ADMIN_PASSWORD`). Nunca armazene senhas ou tokens no código-fonte.

### Variáveis de Ambiente no Railway

Cadastre as seguintes variáveis de ambiente no painel do Railway (**Variables**):

| Variável | Obrigatória | Exemplo / Descrição |
| --- | --- | --- |
| `HOST` | Sim | `0.0.0.0` (Permite que o Railway encaminhe o tráfego público para o container) |
| `PORT` | Automática | O Railway preenche automaticamente (ou padrão 8080/8787) |
| `NODE_ENV` | Sim | `production` (Ativa flags seguras de cookies e otimizações) |
| `ADMIN_PASSWORD_HASH` | Recomendado | Hash scrypt gerado com o comando abaixo. Ex: `scrypt:a1b2...:c3d4...` |
| `ADMIN_PASSWORD` | Alternativa | Senha em texto puro se preferir não usar hash. Ex: `MinhaSenhaForte2026` |
| `ADMIN_USERNAME` | Opcional | `estefane` (Padrão: `estefane`) |
| `SESSION_SECRET` | Recomendado | Chave aleatória de 32+ caracteres para assinar cookies. Ex: `openssl rand -hex 32` |
| `ALLOWED_ORIGINS` | Opcional | Origens extras permitidas. O Railway public domain já é detectado automaticamente. |

#### Como gerar o hash da senha:

No terminal do projeto, execute:
```bash
npm run hash-password "SuaSenhaAqui"
```
Copie a linha `ADMIN_PASSWORD_HASH=scrypt:...` exibida no terminal e cole no painel de variáveis do Railway.

## Limites e operação do servidor

| Variável | Padrão | Faixa |
| --- | --- | --- |
| `HOST` | `127.0.0.1` (`0.0.0.0` no Railway) | Endereço de escuta |
| `PORT` | `8787` | 0–65535, 0 escolhe porta livre |
| `MAX_BATCH_FILES` | 10 | 1–10 |
| `MAX_UPLOAD_MB` | 10 | 1–30 por arquivo |
| `MAX_BATCH_MB` | 30 | 1–100 por lote |
| `ANALYSIS_CONCURRENCY` | 1 | 1–2 workers globais |
| `MAX_ACTIVE_BATCHES` | 3 | 1–5 |
| `BATCH_RETENTION_MINUTES` | 10 | 1–30 |

As preferências de limite no navegador podem reduzir, nunca ampliar, o limite do servidor. Cada PDF tem no máximo 20 páginas, 250 mil caracteres extraídos e 5 mil linhas; OCR limitado a 4 milhões de pixels por página; worker com heap JS de 384 MB e timeout de 120 segundos. Memória nativa de OCR/canvas não é limitada pelo heap JS. Documentos do lote aguardam numa fila global limitada, compartilhada com o endpoint único.

Uploads são gravados por streaming em diretórios aleatórios na pasta temporária do sistema, sem cópias integrais de lotes na memória do Express. Arquivos individuais acima do limite são descartados e sinalizados sem impedir os demais. O tamanho total é medido durante o streaming. Arquivos são removidos após o processamento e cancelamento. Diretórios de execuções interrompidas, com mais de duas horas, são limpos na inicialização e periodicamente. Diretórios de limpeza são verificados dentro da raiz de temporários da aplicação.

No servidor, resultados estruturados permanecem em memória até a expiração do lote, com limite adicional de dez lotes finalizados retidos. No navegador, o caixa em edição fica na sessão; o histórico salva os fechamentos escolhidos em IndexedDB, incluindo valores, texto extraído e observações, sem arquivos originais. Caixas confirmados podem ser arquivados automaticamente. Há limites, exclusão explícita e nova conferência ao reabrir. localStorage contém preferências, perfil e notificações. Downloads explícitos permanecem onde o navegador salvar. Veja [a arquitetura da versão 1.3](EVOLUCAO-1.3.md).

## Relatórios e impressão

Conteúdo estruturado comum para HTML e jsPDF. Individual inclui identificação, pagamentos, movimentos com saídas sinalizadas, resultado, documentos, correções, observações, assinatura e horário quando habilitados. Consolidado inclui período, contagens, totais confirmados, resultado por caixa, faltas/sobras e exclusões. Nomes incluem caixa, identificador, papel e horário; ZIP contém PDFs com nomes distintos.

A4 pagina; térmicas usam largura real e altura calculada, paginando se exceder o limite físico do PDF. `@media print`, páginas nomeadas e portal separado removem menus/sidebar/botões. O diálogo de impressão depende do navegador/driver; o sistema não afirma que a impressão física terminou. Valide margens e corte na impressora real. Navegador incorporado pode não disponibilizar o diálogo: salve o PDF e use o leitor do sistema.

As imagens de A4/80/58 são locais em `public/illustrations/`, geradas durante o desenvolvimento e sem chamadas externas durante o uso.

## Organização

A versão 1.4 adiciona conciliação de cupons, leitura contextual de inteiros, estoque em unidades e separação de turnos dentro do mesmo PDF ou planilha. Veja [responsabilidades e casos de teste](EVOLUCAO-1.4.md). `npm run test:mega` verifica o PDF fictício de 19 páginas pelas duas rotas HTTP, além de estoque isolado e planilha mista.

- `shared/calculation.js`, `movements.js`, `reconciliation.js`: motor único de cálculo, normalização e auditoria para servidor e navegador.
- `shared/grouping.js`, `batch.js`, `closingEdits.js`, `contracts.js`: associação, consolidado, histórico/revalidação e contrato versionado.
- `server/services/authService.js`, `originValidator.js`: autenticação por sessão HttpOnly, hash scrypt, rate limiting e validação de origem.
- `server/services/movementExtractor.js`, `pdfParser.js`, `parserRules.js`, `textLines.js`, `pdfReader.js`: extração por rótulos, itens/subtotais e coordenadas. OCR português em `ocrService.js`.
- `server/services/executionQueue.js`, `batchAnalyzer.js`, `uploadStorage.js`, `analyzeService.js`, `pdfWorker.js`: fila, lote, streaming temporário, processo isolado e progresso.
- `server/services/groupingService.js` e `reconciliationService.js`: entradas do servidor para os módulos compartilhados.
- `server/app.js`, `config.js`, `index.js`: rotas/acesso, limites e inicialização/encerramento.
- `src/context/AuthContext.jsx`: estado da sessão do usuário, login, logout e expiração.
- `src/components/auth/Login.jsx`: tela de login responsiva e profissional para a Estefane.
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
```

A integração inclui PDFs reais **fictícios**, OCR, múltiplas páginas e colunas, sangrias repetidas, falta/sobra, lotes independentes/complementares/duplicados, operadores/datas diferentes, erro parcial, cancelamento, limites, senha, PDFs individuais/consolidado A4/80/58 e ZIP. Artefatos em `tests/output/`, sem importação automática na produção. `test:dev` faz uploads contra `node --watch` e verifica a sobrevivência da API.

Consulte `REESTRUTURACAO.md` para a comprovação atual e `DIAGNOSTICO-LOTE.md` para o diagnóstico inicial. `VALIDACAO.md` registra a rodada anterior, de fechamento único.

### Deploy reproduzível pelo Railway CLI

Na pasta `estefane-web`, execute `npm test`, `railway login`, `railway status` e `railway up`. Use `railway link` se o projeto existente ainda não estiver vinculado. O login precisa autorizar a CLI, além de entrar no painel web.

`railway.json` configura Railpack, build `npm run build`, início em produção e healthcheck `/healthz`. `.node-version` seleciona Node 24. O servidor usa `PORT` da plataforma e escuta em `0.0.0.0` quando `NODE_ENV=production`, preservando o endereço local no desenvolvimento. Não use `npm test` como comando de início: ele encerra após a suíte. A rota pública `/healthz` retorna apenas status; os dados em `/api` continuam protegidos por sessão.

Configure `ADMIN_PASSWORD_HASH` (ou `ADMIN_PASSWORD`) e `SESSION_SECRET` nas variáveis do serviço. Não coloque segredos no Git. Após publicar, verifique a URL pública, o login e um PDF fictício autenticado. Configuração oficial: https://docs.railway.com/config-as-code

### Perfil, mensagens e movimento

O perfil começa com os dados de `src/services/profile.js` (Estefane, 21 anos) e permite editar nome, cidade, função, frase e links reais de Instagram, Facebook e WhatsApp. Contas não informadas não ganham destinos inventados. `Encouragement.jsx` compartilha 32 frases religiosas e motivacionais entre início e perfil, com pausa, avanço, categoria e intervalo de 8 a 60 segundos. O temporizador para quando a aba fica oculta e quando movimento reduzido está ativo. Profundidade 3D, órbitas e intensidade são configuráveis e respeitam o modo econômico.

As preferências de foto flutuante, brilho, hover e transição são independentes e persistem no navegador. `src/hooks/useAppearance.js` aplica o tema e o movimento no login e na área autenticada; `src/styles/personal.css` mantém os novos estilos separados do arquivo geral, usando transform e opacity, sem dependências ou animação quadro a quadro em JavaScript. A opção Sem animações e o movimento reduzido do sistema têm prioridade.

`npm run dev` e `npm start` carregam `.env.railway` quando esse arquivo local existe, para usar a mesma senha configurada. O arquivo continua ignorado pelo Git e pelo upload do Railway. Em produção, as variáveis do Railway prevalecem. O login não registra tentativas nem mantém bloqueio por tempo; senha incorreta retorna 401 e permite nova tentativa imediatamente.

## Alternativa gratuita: Render

Serviço existente reaproveitado: `estafane.web`, ID `srv-dbbbeirbc2fs73aiu930`, em https://estafane-web.onrender.com. Ele acompanha a branch `main` deste repositório. Não é necessário criar outro serviço para esta instalação. A senha é configurada apenas nas variáveis do serviço, com hash scrypt, e o plano é Free.

O `render.yaml` define um único Web Service com `plan: free`, servindo React e API Express no mesmo domínio. Usa Node 24 por `.node-version`, build com dependências de desenvolvimento (necessárias para Vite), remoção delas após o build, início `npm start` e verificação pública `/healthz`. A leitura fica limitada a um processo e um lote ativo para reduzir consumo de memória.

Para uma instalação nova em outra conta, o cadastro pode ser iniciado pelo repositório:

[Deploy no Render](https://render.com/deploy?repo=https://github.com/eohlczinn/estafane.web)

Entre na sua conta, mantenha o plano Free e informe `ADMIN_PASSWORD` com a senha escolhida. O usuário é `estefane`. `SESSION_SECRET` é gerado automaticamente pelo Render. Nenhuma senha vai para o Blueprint ou para o Git. A configuração do Railway permanece disponível, sem exclusão de serviços.

O plano gratuito possui 512 MB de RAM, entra em repouso após 15 minutos sem tráfego e pode demorar cerca de um minuto para voltar. PDFs textuais pequenos são o primeiro caso a homologar; PDFs digitalizados e OCR pesado podem exceder os recursos e precisam de validação no serviço real. Reinícios descartam resultados temporários; salve ou imprima o relatório para guardá-lo. O plano gratuito não oferece a disponibilidade de uma hospedagem de produção paga.

Referências: https://render.com/docs/free e https://render.com/docs/blueprint-spec
