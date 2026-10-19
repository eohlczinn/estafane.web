import React, { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Files, Printer, Download } from "lucide-react";
import { useClosing } from "../context/ClosingContext.jsx";
import BatchSummary from "../components/batch/BatchSummary.jsx";
import ClosingCard from "../components/batch/ClosingCard.jsx";
import FileStatus from "../components/upload/FileStatus.jsx";
export default function BatchResults() {
  const { batch, summary, selectClosing, resolveGrouping, prefs, setNotice } =
      useClosing(),
    [selected, setSelected] = useState([]),
    [saving, setSaving] = useState(false),
    [groupingError,setGroupingError]=useState(''),
    navigate = useNavigate();
  if (!batch)
    return (
      <section className="panel">
        <h1>Fechamentos do lote</h1>
        <p>Envie os PDFs para analisar um ou vários caixas.</p>
        <Link className="primary" to="/ler-pdf">
          Enviar PDFs
        </Link>
      </section>
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
          <h1>Fechamentos analisados</h1>
          <p>
            {batch.documents.length} documentos · {batch.closings.length}{" "}
            fechamentos identificados
          </p>
        </div>
      </div>
      <BatchSummary summary={summary} />
      {groupingError&&<p role="alert" className="error-message">{groupingError}</p>}
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
                  onClick={() => setGroupingError(resolveGrouping(s, false)||'')}
                >
                  São fechamentos independentes
                </button>
                <button
                  className="secondary"
                  onClick={() => setGroupingError(resolveGrouping(s, true)||'')}
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
        {prefs.includeConsolidated && (
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
