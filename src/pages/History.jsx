import React, { useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  Archive,
  Search,
  Trash2,
  FolderOpen,
  Save,
  Plus,
  Download,
} from "lucide-react";
import { useWorkspace } from "../context/workspace.js";
import { useClosing } from "../context/ClosingContext.jsx";
import { restoreSnapshot } from "../services/archive.js";
import { formatMoney } from "../../shared/money.js";
import WorkspaceDialog from "../components/WorkspaceDialog.jsx";

export default function History() {
  const { records, archiveError, saveClosing, removeRecords, saving } =
    useWorkspace();
  const { closing, restoreClosing, startNew, prefs, setNotice } = useClosing();
  const navigate = useNavigate();
  const [query, setQuery] = useState(""),
    [filter, setFilter] = useState("all"),
    [selected, setSelected] = useState([]),
    [action, setAction] = useState(null),
    [working, setWorking] = useState(false);
  const visible = useMemo(
    () =>
      records.filter(
        (r) =>
          (filter === "all" ||
            (filter === "confirmed"
              ? r.snapshot.confirmed
              : !r.snapshot.confirmed)) &&
          [
            r.snapshot.fields.market?.value,
            r.snapshot.fields.date?.value,
            r.snapshot.fields.operator?.value,
            r.snapshot.fields.register?.value,
          ]
            .join(" ")
            .toLocaleLowerCase("pt-BR")
            .includes(query.toLocaleLowerCase("pt-BR")),
      ),
    [records, query, filter],
  );
  const chosen = records.filter((r) => selected.includes(r.id));
  const all =
    visible.length > 0 && visible.every((r) => selected.includes(r.id));
  async function proceed() {
    setWorking(true);
    try {
      if (action.kind === "delete") {
        if (await removeRecords(action.ids))
          setSelected((old) => old.filter((id) => !action.ids.includes(id)));
        else return;
      }
      if (action.kind === "new") {
        startNew();
        navigate("/ler-pdf");
      }
      if (action.kind === "open") {
        const value = restoreSnapshot(action.record.snapshot);
        restoreClosing({ ...value, archiveId: action.record.id });
        navigate("/resultado");
      }
      setAction(null);
    } catch (e) {
      setNotice(e.message);
    } finally {
      setWorking(false);
    }
  }
  async function exportSelected() {
    setWorking(true);
    try {
      const values = chosen.map((r) => restoreSnapshot(r.snapshot, false));
      if (
        !values.length ||
        values.some((c) => !c.confirmed || !c.audit.canConfirm)
      )
        throw Error(
          "Selecione apenas registros confirmados e consistentes para baixar.",
        );
      const { saveIndividualReports } = await import(
        "../services/pdfGenerator.js"
      );
      await saveIndividualReports(values, prefs);
      setNotice("Relatórios selecionados enviados para download.");
    } catch (e) {
      setNotice(e.message);
    } finally {
      setWorking(false);
    }
  }
  return (
    <>
      <div className="page-heading">
        <span className="heading-icon">
          <Archive />
        </span>
        <div>
          <div className="eyebrow">SEUS FECHAMENTOS, ORGANIZADOS</div>
          <h1>Histórico</h1>
          <p>
            Guardado neste navegador. Reabra um caixa ou selecione registros
            para baixar e excluir.
          </p>
        </div>
      </div>
      <section className="panel archive-toolbar">
        <button
          className="primary"
          disabled={saving}
          onClick={() => saveClosing()}
        >
          <Save size={17} />
          Salvar caixa atual
        </button>
        <button
          className="secondary"
          onClick={() => setAction({ kind: "new" })}
        >
          <Plus size={17} />
          Novo caixa
        </button>
        <Link to="/configuracoes#historico-local">
          Configurar armazenamento
        </Link>
        <span>
          {records.length}/{prefs.historyLimit} registros ·{" "}
          {(records.reduce((s, r) => s + (r.bytes || 0), 0) / 1048576).toFixed(
            1,
          )}{" "}
          MB de 20 MB
        </span>
      </section>
      {archiveError && (
        <p className="error-message" role="alert">
          {archiveError}
        </p>
      )}
      <section className="panel archive-browser">
        <div className="archive-filters">
          <label>
            <Search size={17} />
            Buscar no histórico
            <input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Mercado, operadora, caixa ou data"
            />
          </label>
          <label>
            Status
            <select value={filter} onChange={(e) => setFilter(e.target.value)}>
              <option value="all">Todos</option>
              <option value="confirmed">Confirmados</option>
              <option value="draft">Rascunhos</option>
            </select>
          </label>
        </div>
        <div className="selection-toolbar">
          <label className="checkbox">
            <input
              type="checkbox"
              checked={all}
              onChange={() =>
                setSelected((old) =>
                  all
                    ? old.filter((id) => !visible.some((r) => r.id === id))
                    : [...new Set([...old, ...visible.map((r) => r.id)])],
                )
              }
            />
            Selecionar resultados
          </label>
          <span>{chosen.length} selecionado(s)</span>
          <button
            className="secondary"
            disabled={
              !chosen.length ||
              working ||
              chosen.some((r) => !r.snapshot.confirmed)
            }
            onClick={exportSelected}
          >
            <Download size={16} />
            Baixar PDFs
          </button>
          <button
            className="secondary danger-text"
            disabled={!chosen.length || working}
            onClick={() =>
              setAction({ kind: "delete", ids: chosen.map((r) => r.id) })
            }
          >
            <Trash2 size={16} />
            Excluir seleção
          </button>
        </div>
        {!visible.length && (
          <div className="empty-workspace">
            <Archive size={36} />
            <h2>
              {records.length
                ? "Nenhum resultado para esta busca"
                : "Seu histórico começa aqui"}
            </h2>
            <p>
              Salve um rascunho pelo botão acima. Caixas confirmados são salvos
              automaticamente quando essa opção está ativada.
            </p>
          </div>
        )}
        <div className="archive-list">
          {visible.map((r) => (
            <article
              key={r.id}
              className={
                "archive-row " + (selected.includes(r.id) ? "is-selected" : "")
              }
            >
              <input
                type="checkbox"
                aria-label={
                  "Selecionar " +
                  (r.snapshot.fields.market?.value || "caixa") +
                  " " +
                  (r.snapshot.fields.date?.value || "")
                }
                checked={selected.includes(r.id)}
                onChange={() =>
                  setSelected((old) =>
                    old.includes(r.id)
                      ? old.filter((id) => id !== r.id)
                      : [...old, r.id],
                  )
                }
              />
              <div>
                <strong>
                  {r.snapshot.fields.market?.value || "Mercado não informado"}
                </strong>
                <p>
                  {r.snapshot.fields.date?.value || "Sem data"} ·{" "}
                  {r.snapshot.fields.operator?.value ||
                    "Operadora não informada"}{" "}
                  · {r.snapshot.fields.register?.value || "Sem identificação"}
                </p>
                <small>
                  Salvo em {new Date(r.updatedAt).toLocaleString("pt-BR")} ·{" "}
                  {r.snapshot.confirmed ? "Confirmado" : "Rascunho"}
                  {r.snapshot.calculation?.difference != null
                    ? " · Diferença " +
                      formatMoney(r.snapshot.calculation.difference)
                    : ""}
                </small>
              </div>
              <button
                className="secondary"
                disabled={r.invalid}
                onClick={() => setAction({ kind: "open", record: r })}
              >
                <FolderOpen size={16} />
                Reabrir
              </button>
              <button
                className="icon-btn danger-text"
                aria-label={
                  "Excluir registro de " +
                  (r.snapshot.fields.market?.value || "caixa")
                }
                onClick={() => setAction({ kind: "delete", ids: [r.id] })}
              >
                <Trash2 size={18} />
              </button>
            </article>
          ))}
        </div>
      </section>
      <p className="muted">
        O histórico inclui valores, observações e texto extraído, sem os
        arquivos originais. Limpar os dados do navegador remove estes registros.
        Baixe os PDFs que deseja manter.
      </p>
      {action && (
        <div className="modal-backdrop">
          <WorkspaceDialog
            onClose={() => {
              if (!working) setAction(null);
            }}
            className="panel workspace-dialog"
            role="dialog"
            aria-modal="true"
            aria-labelledby="archive-action"
          >
            <h2 id="archive-action">
              {action.kind === "delete"
                ? `Excluir ${action.ids.length} registro(s)?`
                : action.kind === "new"
                  ? "Começar um novo caixa?"
                  : "Reabrir este fechamento?"}
            </h2>
            <p>
              {action.kind === "delete"
                ? "A exclusão é permanente neste navegador. O caixa em edição continua disponível."
                : "O caixa em edição será substituído. Salve-o no histórico antes de continuar se precisar dele. Ao reabrir, uma nova confirmação será solicitada."}
            </p>
            <div className="review-actions">
              <button
                className="secondary"
                onClick={() => setAction(null)}
                disabled={working}
              >
                Cancelar
              </button>
              <button className="primary" onClick={proceed} disabled={working}>
                {action.kind === "delete" ? "Excluir registros" : "Continuar"}
              </button>
            </div>
          </WorkspaceDialog>
        </div>
      )}
    </>
  );
}
