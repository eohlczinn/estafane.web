import React, { useState } from "react";
import { Link } from "react-router-dom";
import { useClosing } from "../context/ClosingContext.jsx";
import { useWorkspace } from "../context/workspace.js";
import { cashKnowledge, searchText } from "../services/knowledge.js";
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
    "Não são usados serviços externos de leitura ou OCR. Os documentos são enviados ao servidor desta instalação. Os temporários são descartados após a análise. Resultados ficam na sessão do navegador e temporariamente na memória do servidor, por até 10 minutos na configuração padrão, vinculados à sessão que fez o envio. Recarregar limpa os dados que ainda não foram salvos. O histórico guarda os fechamentos escolhidos neste navegador, com valores e texto extraído, sem os arquivos originais; você pode excluí-los. Perfis guardam apenas classificações no navegador, sem arquivos nem valores financeiros.",
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
  const [query, setQuery] = useState("");
  const { audit, backend, closing } = useClosing(),
    { records } = useWorkspace();
  const term = searchText(query),
    answers = faq.filter((item) => searchText(item.join(" ")).includes(term)),
    knowledge = cashKnowledge.filter((item) =>
      searchText(item.term + " " + item.text).includes(term),
    );
  return (
    <>
      <div className="page-heading">
        <span className="heading-icon">
          <Headphones />
        </span>
        <div>
          <h1>Central de ajuda e conhecimento</h1>
          <p>Um guia rápido para fechar seu caixa com tranquilidade.</p>
        </div>
      </div>
      <div className="support-tools">
        <section className="panel">
          <div className="eyebrow">DIAGNÓSTICO DO SEU ESPAÇO</div>
          <h2>Seu próximo passo</h2>
          <ul className="support-status-list">
            <li>
              Servidor:{" "}
              {backend === "online"
                ? "conectado"
                : backend === "checking"
                  ? "verificando"
                  : "sem resposta"}
            </li>
            <li>{closing.documents.length} documento(s) no caixa atual</li>
            <li>
              {audit.issues.length} pendência(s) na conferência automática
            </li>
            <li>{records.length} fechamento(s) guardado(s) no histórico</li>
          </ul>
          <Link
            className="secondary"
            to={audit.issues.length ? "/resultado" : "/ler-pdf"}
          >
            {audit.issues.length
              ? "Resolver pendências"
              : "Importar outro documento"}
          </Link>
        </section>
        <section className="panel">
          <div className="eyebrow">APRENDA COM O SEU PRÓPRIO LAYOUT</div>
          <h2>Um sistema que aproveita suas correções</h2>
          <p>
            Confira a origem de uma linha, escolha a categoria e confirme o
            fechamento. Depois salve as classificações. O sistema reutiliza
            regras explícitas em documentos do mesmo layout, sem inventar
            valores.
          </p>
          <Link className="secondary" to="/configuracoes#perfis-importacao">
            Gerenciar conhecimento dos layouts
          </Link>
        </section>
      </div>
      <label className="support-search">
        Pesquisar na ajuda e no conhecimento
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Ex.: sangria, PDF, histórico, senha, impressão"
        />
      </label>
      {knowledge.length > 0 && (
        <section
          aria-label="Conceitos do fechamento"
          className="knowledge-grid"
        >
          {knowledge.map((item) => (
            <article key={item.term}>
              <h3>{item.term}</h3>
              <p>{item.text}</p>
            </article>
          ))}
        </section>
      )}
      {!knowledge.length && !answers.length && (
        <p role="status">
          Não há um artigo para essa busca. Tente “PDF”, “conferir”, “histórico”
          ou “imprimir”.
        </p>
      )}
      <section className="panel faq">
        {answers.map(([q, a]) => (
          <details key={q}>
            <summary>{q}</summary>
            <p>{a}</p>
          </details>
        ))}
      </section>
    </>
  );
}
