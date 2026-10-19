# Validação do estefane-web

Rodada concluída em 19/10/2026. Projeto: `D:\web-site\estefane-web`. Ambiente: Windows, Node.js 24.19.0. Os documentos usados nos testes são explicitamente fictícios.

## Diagnóstico e correções

O fluxo de leitura foi verificado desde o upload do React até a rota Express, o processo de extração, o parser e o cálculo compartilhado. No modo `node --watch`, mensagens internas de dependências podiam ser confundidas com respostas do leitor. O protocolo agora aceita somente mensagens identificadas como `closing-analysis-result`; o worker não herda o canal de acompanhamento de dependências. Falhas de leitura, encerramento e timeout são tratados sem encerrar a API.

A extração reconstrói linhas pela geometria da página, utiliza regras explícitas de interpretação e recorre ao OCR local em português para páginas digitalizadas. Os campos guardam origem e estado de reconhecimento. Valores ausentes ou ambíguos continuam pendentes. O cálculo usa centavos inteiros, separa dinheiro físico de pagamentos eletrônicos e evita somar cartões consolidados com seus subtotais.

O resultado permite corrigir campos e recalcula imediatamente. A emissão final depende dos dados necessários e da conferência. O nome padrão é Pingo De Ouro, a operadora padrão é Estefane e a data usa America/Sao_Paulo. Dados efetivamente identificados no documento prevalecem sobre os padrões.

As configurações abrangem aparência, mercado, fechamento, impressão, relatórios e perfil. Somente preferências permitidas são persistidas; dados financeiros, PDF e observações não são gravados no localStorage. A seleção de A4, 80 mm e 58 mm possui imagens locais, dimensões e prévia. Os PDFs usam tamanho físico de página e a impressão HTML exclui a interface.

## Verificação automatizada

| Comando | Resultado |
| --- | --- |
| `npm test` | 43 testes aprovados em 4 arquivos. |
| `npm run test:integration` | Aprovado: upload, rotas, origem, extração, proveniência, valores conhecidos, múltiplas páginas, tabela numerada e vale-alimentação. |
| `npm run test:integration` | Aprovado: falta, sobra, arquivos inválidos, limite de tamanho, senha, OCR, página mista e documento vazio. |
| `npm run test:integration` | Aprovado: PDFs A4, 80 mm e 58 mm, dimensões, conteúdo dentro da página, assinatura, observações, preferências, margens, logotipo e conteúdo longo até o rodapé. |
| `npm run test:dev` | Três uploads reais no backend iniciado com `node --watch`, com saúde confirmada depois de cada upload. |
| `npm run build` | Build de produção gerado com sucesso. |
| `npm audit` | Nenhuma vulnerabilidade encontrada. |

Também foi enviado um PDF de teste à API principal em `127.0.0.1:8787`. A resposta identificou R$ 500,00 em dinheiro e R$ 1.000,00 em vendas, conforme o documento. O endpoint de saúde continuou respondendo depois da análise. O frontend em `127.0.0.1:5173` respondeu HTTP 200 ao fim da rodada.

## Verificação pela interface

- Fluxo de upload até resultado, alteração do contado, recálculo de falta, revisão, confirmação e download de PDF exercitado no navegador.
- Persistência de configurações após recarregar, logotipo opcional, nome do arquivo e limites de margem conferidos. Preferências temporárias de teste foram restauradas; os valores financeiros fictícios foram removidos da sessão por recarga.
- Início e configurações conferidos nas larguras 320, 375, 390, 768 e 1440 px sem transbordamento horizontal. Resultado e modal também foram inspecionados em celular e desktop. Nesta continuação, configurações foram reconferidas em 375 e 1440 px.
- Modal com três imagens de papel, ajuste da prévia à tela e ações de salvar/imprimir inspecionado. Sem fechamento confirmado, a prévia informa a pendência e as ações finais ficam desabilitadas.
- Nenhum erro de console registrado na aba nova desta rodada. Os tamanhos temporários de viewport foram restaurados.
- Capturas finais em `tests/output/configuracoes-final.png` e `tests/output/impressao-final.png`. Os relatórios de teste e suas renderizações também ficam nessa pasta, sem carregamento automático na aplicação.

## Limitações e operação

1. Não foi fornecido um PDF real do Pingo De Ouro. As regras foram testadas com documentos conhecidos; a compatibilidade com o layout real do mercado ainda precisa ser validada. Campo não reconhecido exige conferência manual.
2. A impressão física e o corte das bobinas não foram testados em equipamento. Abrir o diálogo do navegador não comprova impressão concluída. O PDF pode ser salvo e impresso pelo leitor do sistema.
3. Responsividade foi testada em viewports de navegador; não em celulares físicos.
4. `npm run dev` mantém frontend e backend no mesmo comando enquanto o processo estiver aberto. Não instala serviço do Windows nem garante execução depois de encerrar o terminal ou desligar o computador. Para produção local, use `npm run build` e `npm start`.
5. OCR pode errar caracteres e valores. Preserve a conferência antes da emissão final, especialmente em documentos digitalizados.

O mapa dos componentes, os comandos de execução e as regras financeiras estão em `README.md`.
