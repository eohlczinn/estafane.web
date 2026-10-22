import React from "react";
import { Headphones } from "lucide-react";
const faq = [
  [
    "Como importar PDF, Excel ou outros documentos?",
    "Em Início ou Importar, selecione ou arraste PDFs, XLSX, XLS, ODS, CSV, TXT, PNG ou JPEG. Você pode misturar formatos, adicionar arquivos e remover itens antes de analisar. Os limites aparecem na área de envio. Arquivos idênticos são detectados pelo conteúdo. Se um deles falhar, repita somente os arquivos com falha ou abra os resultados disponíveis.",
  ],
  [
    "Como conferir o fechamento?",
    "Abra um caixa em Fechamentos. Confira esperado, contado e diferença. Expanda as movimentações, a memória de cálculo ou a origem quando necessário. Corrija dados ausentes e esclareça apenas as pendências apresentadas. Confirme cada fechamento individualmente.",
  ],
  [
    "Como salvar o relatório?",
    "Após confirmar o fechamento, abra Relatório e toque em Salvar PDF. O arquivo será gerado localmente no formato selecionado.",
  ],
  [
    "Como imprimir e escolher o papel?",
    "Abra Imprimir, selecione A4, 80 mm ou 58 mm e confira a prévia. O botão Imprimir abre o diálogo do navegador. Configure a impressora e o papel no sistema operacional.",
  ],
  [
    "E quando o PDF não for reconhecido?",
    "O sistema tenta OCR local em páginas sem texto. Documentos protegidos, danificados ou de baixa qualidade podem exigir nova exportação. Você pode preencher os campos manualmente, sempre usando os valores do documento.",
  ],
  [
    "Como corrigir valores?",
    "Edite os campos em Conferência do caixa. Use vírgula para centavos, por exemplo 1.234,56. Campos editados são identificados e o fechamento precisa ser confirmado novamente.",
  ],
  [
    "Por que há dados pendentes?",
    "O sistema não transforma informações ausentes em zero. Fundo inicial, dinheiro, sangrias, suprimentos, devoluções e dinheiro contado são essenciais. Informe zero somente após verificar que não houve essa movimentação.",
  ],
  [
    "O relatório do meu mercado é compatível?",
    "A leitura reconhece rótulos comuns e tabelas com colunas identificadas. Um layout diferente pode exigir classificação manual. Planilhas com caixas independentes em abas completas são separadas; identidades misturadas na mesma tabela ficam pendentes. A compatibilidade com o sistema específico do mercado depende da conferência de um relatório real.",
  ],
  [
    "Como funcionam fórmulas e linhas ocultas do Excel?",
    "Fórmulas e macros nunca são executadas. Resultados de fórmulas armazenados no arquivo exigem conferência porque podem estar desatualizados. Fórmulas sem resultado permanecem pendentes. Linhas e abas ocultas são incluídas e identificadas na origem, para não omitir movimentações. Planilhas protegidas, com macros ou vínculos externos são recusadas.",
  ],
  [
    "Como classificar uma linha desconhecida e guardar o aprendizado?",
    "Na auditoria, abra a linha e compare sua origem. Escolha se é um total, uma movimentação individual ou apenas uma referência informativa. Informe a categoria, o valor e o motivo. O cálculo é atualizado e o histórico preservado; você pode desfazer a alteração. Depois de confirmar o fechamento, volte à conferência para salvar um perfil do layout. As sugestões serão usadas apenas no mesmo layout e continuarão exigindo revisão. Gerencie os perfis em Configurações.",
  ],
  [
    "Meus dados são enviados para outro serviço?",
    "Não são usados serviços externos de leitura ou OCR. Os documentos são enviados ao servidor desta instalação. Os temporários são descartados após a análise. Resultados ficam na sessão do navegador e temporariamente na memória do servidor, por até 10 minutos na configuração padrão, vinculados à sessão que fez o envio. Recarregar a página limpa os dados financeiros do navegador. Perfis guardam apenas classificações no navegador, sem arquivos nem valores financeiros.",
  ],
  [
    "Como os documentos são agrupados?",
    "Documentos com identidade completa e referência de fechamento ou período compatível podem ser associados. Nome da operadora sozinho não comprova a associação. Quando faltam evidências, os documentos ficam separados e você confirma se são independentes ou do mesmo fechamento. Resolva a associação antes de corrigir os valores.",
  ],
  [
    "Como funciona o consolidado?",
    "Somente fechamentos confirmados entram nos totais confirmados. Faltas e sobras são mostradas separadamente. Se houver pendências ou arquivos com erro, o consolidado fica identificado como parcial e lista as exclusões. Também é possível baixar os individuais confirmados em ZIP.",
  ],
];
export default function Support() {
  return (
    <>
      <div className="page-heading">
        <span className="heading-icon">
          <Headphones />
        </span>
        <div>
          <h1>Como podemos ajudar?</h1>
          <p>Um guia rápido para fechar seu caixa com tranquilidade.</p>
        </div>
      </div>
      <section className="panel faq">
        {faq.map(([q, a]) => (
          <details key={q}>
            <summary>{q}</summary>
            <p>{a}</p>
          </details>
        ))}
      </section>
    </>
  );
}
