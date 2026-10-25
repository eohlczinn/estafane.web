import React, { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Files, Printer, Download } from "lucide-react";
import { useClosing } from "../context/ClosingContext.jsx";
import BatchSummary from "../components/batch/BatchSummary.jsx";
import ClosingCard from "../components/batch/ClosingCard.jsx";
import FileStatus from "../components/upload/FileStatus.jsx";
import InventorySummary from "../components/fechamento/InventorySummary.jsx";
export default function BatchResults() {
  const { batch, summary, selectClosing, resolveGrouping, prefs, setNotice } =
      useClosing(),
    [selected, setSelected] = useState([]),
    [saving, setSaving] = useState(false),
    [groupingError, setGroupingError] = useState(""),
    navigate = useNavigate();
  if (!batch)
    return (
      <section className="panel">
        <h1>Fechamentos do lote</h1>
        <p>Envie os documentos para analisar um ou vários caixas.</p>
        <Link className="primary" to="/ler-pdf">
          Importar documentos
        </Link>
      </section>
    );
  const sources =
    batch.sourceDocuments || batch.documents.filter((d) => !d.partOf);
  const stockDocuments = sources.filter((d) => d.inventory?.detected);
  const stockOnly = !batch.closings.length && stockDocuments.length > 0;
  const calculable = batch.closings.filter(
    (c) => c.audit.calculation.difference != null,
  ).length;
  const missingCount = batch.closings.filter(
    (c) => c.fields.counted.value == null,
  ).length;
  const repeated = batch.closings.reduce(
    (n, c) => n + (c.transactions || []).filter((t) => t.duplicateOf).length,
    0,
  );
  async function saveAll() {
    setSaving(true);
    try {
      const { saveIndividualReports } =
        await import("../services/pdfGenerator.js");
      await saveIndividualReports(
        batch.closings.filter(
          (c) => c.confirmed && c.audit.status === "validated",
        ),
        prefs,
      );
      setNotice(
        "Relatórios individuais enviados para download em um arquivo ZIP.",
      );
    } catch (e) {
      setNotice("Falha ao gerar os relatórios: " + e.message);
    } finally {
      setSaving(false);
    }
  }
  return (
    <>
      <div className="page-heading">
        <span className="heading-icon">
          <Files />
        </span>
        <div>
          <div className="eyebrow">DOCUMENTOS → FECHAMENTOS → CONFERÊNCIA</div>
          <h1>{stockOnly ? "Estoque analisado" : "Fechamentos analisados"}</h1>
          <p>
            {sources.length ||
              new Set(batch.documents.map((d) => d.partOf || d.id)).size}{" "}
            arquivo(s) · {batch.closings.length} fechamentos identificados
          </p>
        </div>
      </div>
      {!stockOnly && (
        <>
          <section
            className="panel reading-summary"
            aria-label="Resumo da leitura"
          >
            <h2>Resultado da leitura</h2>
            <p>
              {calculable} diferença(s) calculada(s) · {missingCount}{" "}
              fechamento(s) sem contagem informada · {repeated} cupom(ns)
              repetido(s) excluído(s).
            </p>
            <small>
              Cada turno mantém seus valores e sua origem. A emissão final
              depende da conferência individual.
            </small>
          </section>
          <BatchSummary summary={summary} />
        </>
      )}
      {stockDocuments.map((d) => (
        <InventorySummary key={d.id} inventory={d.inventory} />
      ))}
      {groupingError && (
        <p role="alert" className="error-message">
          {groupingError}
        </p>
      )}
      {batch.warnings?.map((w) => (
        <p className="error-message" key={w}>
          {w}
        </p>
      ))}
      {batch.suggestions?.length > 0 && (
        <section className="panel grouping-questions">
          <h2>Confirme a associação dos documentos</h2>
          {batch.suggestions.map((s) => (
            <div key={s.id}>
              <p>{s.message}</p>
              <strong>
                {s.closingIds
                  .map((id) =>
                    batch.closings
                      .find((c) => c.id === id)
                      ?.documents.map((d) => d.filename)
                      .join(" + "),
                  )
                  .join(" ↔ ")}
              </strong>
              <div className="batch-actions">
                <button
                  className="secondary"
                  onClick={() =>
                    setGroupingError(resolveGrouping(s, false) || "")
                  }
                >
                  São fechamentos independentes
                </button>
                <button
                  className="secondary"
                  onClick={() =>
                    setGroupingError(resolveGrouping(s, true) || "")
                  }
                >
                  Confirmo: são do mesmo fechamento
                </button>
              </div>
            </div>
          ))}
        </section>
      )}
      <div className="batch-actions">
        <Link className="primary" to="/ler-pdf">
          Analisar outro lote
        </Link>
        {!stockOnly && prefs.includeConsolidated && (
          <Link className="secondary" to="/relatorio?scope=consolidated">
            <Printer size={18} />
            Consolidado / imprimir
          </Link>
        )}
        <button
          className="secondary"
          disabled={!summary.validatedCount || saving}
          onClick={saveAll}
        >
          <Download size={18} />
          {saving ? "Gerando ZIP…" : "Salvar individuais confirmados (ZIP)"}
        </button>
        <button
          className="secondary"
          disabled={!selected.length}
          onClick={() =>
            navigate(
              "/imprimir?scope=selected&ids=" +
                encodeURIComponent(selected.join(",")),
            )
          }
        >
          <Printer size={18} />
          Imprimir selecionados ({selected.length})
        </button>
      </div>
      <div className="closing-grid">
        {batch.closings.map((c) => (
          <ClosingCard
            key={c.id}
            closing={c}
            selected={selected.includes(c.id)}
            onSelect={(checked) =>
              setSelected((old) =>
                checked ? [...old, c.id] : old.filter((id) => id !== c.id),
              )
            }
            onOpen={() => {
              selectClosing(c.id);
              navigate("/resultado");
            }}
          />
        ))}
      </div>
      <section className="panel batch-documents">
        <h2>Resultado de cada documento</h2>
        {sources
          .filter((d) => d.contextPages?.length)
          .map((d) => (
            <details key={d.id + ":context"}>
              <summary>
                {d.filename} · capa e páginas de contexto (
                {d.contextPages.length})
              </summary>
              <p>
                Estas páginas foram preservadas para consulta e não foram
                somadas como vendas ou novos fechamentos.
              </p>
              {d.contextPages.map((p) => (
                <details key={p.page}>
                  <summary>Página {p.page}</summary>
                  <pre className="document-context-text">
                    {p.text || "Página sem texto disponível."}
                  </pre>
                </details>
              ))}
            </details>
          ))}
        {batch.documents.map((d) => (
          <details key={d.id}>
            <summary>
              {d.filename} <FileStatus document={d} />
            </summary>
            <p>
              {d.error ||
                d.message ||
                "Leitura concluída; a validação do fechamento é realizada separadamente."}
            </p>
            {d.format && (
              <p>
                Formato detectado: {d.format.toUpperCase()}
                {d.identity?.reportType ? ` · ${d.identity.reportType}` : ""}
              </p>
            )}
            <small>SHA-256: {d.hash}</small>
            {d.duplicateOf && (
              <p>
                Documento original:{" "}
                {batch.documents.find((o) => o.id === d.duplicateOf)?.filename}
              </p>
            )}
          </details>
        ))}
      </section>
    </>
  );
}
