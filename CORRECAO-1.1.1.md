# Reconhecimento contextual de documentos — 1.1.1

O relatório fictício Horizonte enviado em seis formatos expôs falhas que os testes anteriores não cobriam: quantidades formatadas como dinheiro no Excel; metadados e seções ignorados no CSV; cabeçalhos acima dos valores interpretados como identidade; ordem de leitura de colunas incorreta no OCR.

## Mudanças

- `documentStructure.js` identifica seções e cabeçalhos comuns sem depender de um nome de mercado, data ou título específico.
- `tableInterpreter.js` usa uma mesma representação de observações para células de planilhas, colunas de PDFs e linhas espaciais de OCR. Preserva direção, seção, quantidade separada do valor, identidade por registro e proveniência. Cabeçalhos acima dos valores e colunas reordenadas são suportados.
- `ocrService.js`, `imageReader.js` e `pdfReader.js` preservam coordenadas, reconstroem linhas entre blocos e usam ampliação limitada para imagens. Dígitos financeiros nunca são inventados nem corrigidos para forçar uma soma. Pontuação espúria imediatamente após `R$` é normalizada com o original preservado. OCR continua exigindo conferência explícita.
- `ledgerProfile.js` reconhece extratos físicos delimitados em texto, CSV e abas complementares. Devolução zero só é derivada quando a seção enumerada tem movimentos conhecidos, direção e fronteira de conferência; saídas desconhecidas ou seção incompleta impedem a derivação.
- `paymentProfile.js` confere uma tabela enumerada de pagamentos com seu total. Divergência exige revisão. Outros pagamentos zero só é derivado quando a soma integral confere.
- `pdfParser.js` e `movementExtractor.js` preservam a identidade e origem das observações. Nomes completos de estabelecimentos em banners são mantidos; cartões de identificação explícitos prevalecem sobre banners decorativos.

## Validação

Os seis arquivos originais fictícios estão em `tests/fixtures/horizonte/`, sem modificação. O teste `horizonte.test.js` confere todos os valores e metadados, pagamentos de 489015 centavos, esperado de 44540 e sobra de 665. Também cobre números/nomes alterados, CSV reordenado, mistura de operadores, pagamento divergente e extrato incompleto.

`npm run test:horizonte` percorre o upload HTTP, validação, processo isolado, leitura e cálculo dos seis arquivos. Pode testar o serviço existente com `DOCUMENT_TEST_URL`. Os resultados são gravados no diretório ignorado `tests/output/`.

Mantidos JavaScript, React/Vite, Express, OCR local e cálculos em centavos. A correção está na interpretação compartilhada; adicionar Python ou C++ não resolveria essas associações por si só e acrescentaria dependências ao deploy gratuito.

Limites: formatos arbitrários não têm reconhecimento garantido. Valores conflitantes, categorias financeiras desconhecidas, fórmulas sem confirmação e páginas OCR permanecem sujeitos à conferência. Nenhum documento de teste é tratado como fechamento oficial.
