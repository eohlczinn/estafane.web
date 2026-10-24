# Estefane Web 1.3

## Resultado

Histórico local com busca, filtros, seleção, exclusão confirmada e download dos relatórios confirmados. A conferência consistente pode ser finalizada em uma ação. Perfil editável com links sociais reais, notificações persistentes, central de conhecimento pesquisável e controles de efeitos 3D.

## Responsabilidades e dependências

- `server/services/documentAssessment.js`: triagem explicável após a extração. Datas e dinheiro isolados não bastam para caracterizar caixa. Documentos complementares continuam aceitos; arquivos sem evidências são recusados com HTTP 422 e `failureKind: unrelated`, sem criar um caixa vazio.
- `server/services/pdfWorker.js`: continua isolando PDF, planilhas, texto e OCR. Encaminha o resultado da triagem e usa o motor financeiro existente.
- `shared/reconciliation.js`: permanece como auditoria financeira única. A nova confirmação prática não altera regras, presume zeros ou elimina divergências. OCR e campos desconhecidos ainda podem exigir esclarecimentos.
- `src/context/ClosingContext.jsx`: autoridade sobre o caixa em edição; restaura registros e reaudita os dados. Reabrir invalida a confirmação anterior. Alterar o nome do mercado no relatório também exige nova confirmação.
- `src/services/archive.js`: snapshots versionados em IndexedDB, com transações, limite de 2 MB por registro e 20 MB no total. Mantém origem, valores, observações e até 100 eventos do histórico de edição; exclui a pilha de desfazer e os arquivos originais. Recalcula os valores ao restaurar e ao baixar um arquivo salvo.
- `src/context/WorkspaceContext.jsx` e `workspace.js`: estado do histórico, perfil e notificações, separado da autoridade financeira e do contexto de recomendações. Serializa salvamentos e exclusões. Não limpa o caixa ativo quando o armazenamento falha. Contexto separado do componente preserva a identidade no recarregamento de desenvolvimento.
- `src/services/workspace.js`: validação dos links oficiais de Instagram, Facebook e WhatsApp; bloqueia protocolos executáveis, credenciais em URL, portas e domínios semelhantes. Nome de exibição não altera as credenciais de login.
- `src/pages/History.jsx`: operações explícitas sobre os registros, seleção em lote e confirmação antes de substituir o caixa ativo ou excluir registros. O limite não causa exclusão automática.
- `src/components/WorkspaceDialog.jsx`: comportamento de teclado reutilizado nas confirmações, com foco, Escape e retorno do foco.
- `src/components/profile/DepthCard.jsx`: inclinação limitada por quadro, cancelada ao sair do elemento. CSS cuida das órbitas e formas. Sem biblioteca 3D ou vídeo; modo econômico e movimento reduzido prevalecem.
- `src/pages/Settings.jsx`: seleção por seção e busca sem distinção de acentos. `WorkspaceSettings.jsx` reúne os controles de histórico, notificações e 3D.
- `src/services/knowledge.js`: conceitos financeiros locais e pesquisáveis; classificações aprendidas continuam usando o mecanismo existente de perfis por assinatura exata de layout. Não há geração de respostas financeiras por IA.

## Armazenamento

O histórico é específico do navegador e da origem do site. Não sincroniza com outro dispositivo. Limpar os dados do navegador remove os registros; PDFs baixados são cópias independentes. O armazenamento pode ser bloqueado ou ficar cheio: a interface mostra a falha e mantém o caixa em edição.

Preferências, perfil e até 60 notificações ficam no localStorage. Valores e texto dos fechamentos ficam em IndexedDB quando salvos manualmente ou quando o salvamento automático de caixas confirmados está habilitado. Rascunhos não são arquivados automaticamente.

## Limites da interpretação

A triagem usa evidências e regras, não compreensão universal de qualquer PDF. Um layout novo pode precisar de classificação manual. Dados incompletos, totais conflitantes e OCR continuam visíveis como pendências. O sistema verifica consistência; a operadora confirma a correspondência com o documento original.

## Validação

- Testes de snapshots, recálculo, limites, URLs sociais, notificações e triagem positiva/negativa.
- Suíte financeira existente preservada, incluindo os seis formatos fictícios Horizonte e o caso de falta de R$ 13,50.
- Integração HTTP com PDFs fora do contexto, arquivo vazio, OCR, lotes mistos e relatórios A4/80/58 mm.
- Verificação no navegador de seleção de configurações, histórico persistente após recarga, restauração, nova confirmação e alteração do mercado.
