import React from "react";
import { Headphones } from "lucide-react";
const faq = [
  [
    "Como enviar um ou vários PDFs?",
    "Em Início ou Ler PDF, selecione ou arraste os documentos. Você pode adicionar mais arquivos, remover um deles ou limpar a seleção antes de analisar. Os limites do servidor aparecem na área de envio. Arquivos idênticos são detectados pelo conteúdo.",
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
    "O PDF do meu mercado é compatível?",
    "As regras iniciais reconhecem rótulos comuns. A compatibilidade com o formato específico do mercado depende de validação com um PDF real. Totais ambíguos e linhas com vários valores exigem revisão.",
  ],
  [
    "Meus dados são enviados para outro serviço?",
    "Não são usados serviços externos de leitura ou OCR. Os PDFs são enviados ao servidor desta instalação, que pode estar neste computador ou em uma hospedagem privada. Os arquivos temporários são descartados após a análise. Os resultados ficam na sessão do navegador e temporariamente na memória do servidor, por até 10 minutos na configuração padrão. Recarregar a página limpa a sessão financeira do navegador.",
  ],
  ['Como os PDFs são agrupados?', 'Documentos com identidade completa e referência de fechamento ou período compatível podem ser associados. Nome da operadora sozinho não comprova a associação. Quando faltam evidências, os documentos ficam separados e você confirma se são independentes ou do mesmo fechamento. Resolva a associação antes de corrigir os valores.'],
  ['Como funciona o consolidado?', 'Somente fechamentos confirmados entram nos totais confirmados. Faltas e sobras são mostradas separadamente. Se houver pendências ou arquivos com erro, o consolidado fica identificado como parcial e lista as exclusões. Também é possível baixar os individuais confirmados em ZIP.'],
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
