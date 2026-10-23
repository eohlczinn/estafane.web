# Estefane Web 1.2 — leitura explicável e experiência pessoal

## Resultado

O sistema organiza a leitura dos documentos, explica o caixa em linguagem simples e sugere próximos passos a partir da sessão e das escolhas feitas dentro do site. Não usa modelos generativos, serviços de IA ou rastreamento fora do aplicativo.

## Responsabilidades e arquivos

- **Leitura financeira:** `server/services/tableInterpreter.js` preserva cabeçalhos de tabelas continuadas entre páginas consecutivas de PDF; abas de planilhas não herdam essa estrutura. `categorySuggestions.js` fornece sugestões de categoria por dicionário, com motivo legível. `pdfParser.js` entrega essas sugestões sem atribuir valores ou autorizar confirmação.
- **Explicação e mapa:** `shared/closingInsights.js` usa o cálculo e a auditoria oficiais. Produz um resumo de esperado, contado, sobra/falta, pendências, cancelamentos e etapas da conta. Não cria uma segunda fórmula financeira. `SimpleResult.jsx` apresenta a explicação; `DocumentSource.jsx` permite buscar no texto de todas as páginas/abas e ver seções e origem. Conteúdo detalhado de páginas fechadas não monta milhares de elementos na tela.
- **Memória de preferências:** `src/services/experience.js` normaliza uma lista permitida de contagens, aplica expiração e decaimento, pontua recomendações e explica o motivo. Só aceita páginas internas, papel, paleta, estilos de frases e ações genéricas do fluxo. Não recebe conteúdo de documentos, valores, nomes de arquivos, credenciais ou identificadores pessoais.
- **Estado:** `context/experience.js` mantém a identidade do contexto separada do componente `ExperienceContext.jsx`, evitando recriação do contexto durante atualização de código. O provedor depende das preferências e do contexto do fechamento; o motor financeiro não depende dele.
- **Interface:** `Recommendations.jsx` mostra três sugestões com motivo, avaliação e opção de ocultar. `ExperienceSettings.jsx` reúne estilos, desempenho, histórico e exclusão da memória. `Settings.jsx` mantém mercado, impressão e auditoria nos componentes existentes.
- **Aparência e desempenho:** `preferences.js`, `useAppearance.js` e `styles/experience.css` centralizam paletas, fundos, texto, densidade, intensidade e modo de consumo. Sete cores, três estilos e quatro modos de desempenho. Movimento reduzido prevalece. O modo econômico suspende animações e aumenta o intervalo mínimo de conexão para 60 segundos. Abas ocultas podem pausar movimento e verificações de conexão. `App.jsx` carrega configurações, perfil, suporte e relatório sob demanda.
- **Aprendizado de rótulos:** o perfil de importação existente só é salvo após classificação e fechamento conferidos. O relatório disponibiliza esse salvamento. Um perfil volta como sugestão apenas no mesmo layout e continua sujeito à conferência.

## Controles e limites

Sugestões e coleta de contagens têm interruptores independentes. A pessoa pode ver as contagens, escolher retenção de 7/30/90 dias e apagar memória e avaliações sem apagar preferências visuais ou perfis de importação. A memória pertence ao navegador, sem sincronização entre dispositivos.

O mapa cobre todo o texto extraído dentro dos limites de leitura do serviço. Não representa compreensão universal de qualquer PDF: documentos ilegíveis, categorias ambíguas ou informações faltantes continuam explícitos. OCR exige revisão. A preferência visual, o histórico ou uma sugestão jamais substituem evidência financeira ou confirmação.

## Verificações

Testes automatizados de memória permitida, dados inválidos, expiração, decaimento, recomendação contextual, motivo, ocultação, preferência de cor/frases, modos de desempenho, explicação do resultado, pendências, mapa e continuação de tabela PDF. Mantidos os testes dos seis arquivos originais Horizonte e das regressões anteriores.

Validação visual inclui computador, celular com texto ampliado, ausência de rolagem horizontal, paletas, modo econômico com `animation: none`, ocultação de recomendações, busca no documento e upload real de PDF até a explicação “Sobraram R$ 6,65”.
