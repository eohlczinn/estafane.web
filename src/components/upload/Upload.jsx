import React, { useRef, useState, useEffect } from "react";
import {
  CloudUpload,
  FileText,
  ArrowRight,
  LoaderCircle,
  ShieldCheck,
  Plus,
  X,
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useClosing } from "../../context/ClosingContext.jsx";
import { analyzeFiles } from "../../services/closingApi.js";
import FileList from "./FileList.jsx";
import { documentAccept, declaredFormatError } from "../../../shared/documentFormats.js";
import { groupDocuments } from "../../../shared/grouping.js";
export default function Upload() {
  const navigate = useNavigate(),
    { busy, setBusy, loadBatch, prefs, serverLimits } = useClosing();
  const [files, setFiles] = useState([]),
    [error, setError] = useState(""),
    [drag, setDrag] = useState(false),
    [progress, setProgress] = useState([]),
    [selecting, setSelecting] = useState(false),
    [lastResult, setLastResult] = useState(null),
    input = useRef(),
    controller = useRef();
  const maxFiles = Math.min(prefs.maxBatchFiles, serverLimits.maxFiles);
  useEffect(() => () => controller.current?.abort(), []);
  async function select(incoming) {
    if (busy || selecting) return;
    setSelecting(true);
    setError("");
    const next = [...files],
      errors = [];
    try {
      for (const file of incoming) {
        const invalid = declaredFormatError(file.name, file.type);
        if (invalid) {
          errors.push(file.name + ": " + invalid);
          continue;
        }
        if (file.size > serverLimits.maxUploadBytes) {
          errors.push(file.name + ": excede o tamanho individual.");
          continue;
        }
        if (next.length >= maxFiles) {
          errors.push(`Limite de ${maxFiles} documentos por lote.`);
          break;
        }
        if (
          next.reduce((n, item) => n + item.file.size, 0) + file.size >
          serverLimits.maxBatchBytes
        ) {
          errors.push("O lote excede o tamanho total permitido.");
          continue;
        }
        const hash = Array.from(
          new Uint8Array(
            await crypto.subtle.digest("SHA-256", await file.arrayBuffer()),
          ),
          (b) => b.toString(16).padStart(2, "0"),
        ).join("");
        if (next.some((item) => item.hash === hash)) {
          if (prefs.warnDuplicates)
            errors.push(file.name + ": este documento já foi adicionado.");
          continue;
        }
        next.push({ file, hash });
      }
      setFiles(next);
      setProgress([]);
      setLastResult(null);
      setError(errors.join(" "));
    } finally {
      setSelecting(false);
    }
  }
  async function analyze(retry = false) {
    const selectedFiles = retry ? files.filter((_,i) => ["error","cancelled"].includes(progress[i]?.status)) : files;
    if (!selectedFiles.length || busy) return;
    setBusy(true);
    setError("");
    setProgress(old => files.map((item,i) => selectedFiles.includes(item) ? { status: "waiting" } : old[i]));
    controller.current = new AbortController();
    try {
      const data = await analyzeFiles(
        selectedFiles.map((item) => item.file),
        {
          signal: controller.current.signal,
          autoGroup: prefs.autoGroup,
          onProgress: (data) => setProgress(old => files.map((item,i) => data.documents.find(d => d.hash === item.hash) || old[i])),
        },
      );
      const documents = retry && lastResult ? [...lastResult.documents.filter(d => !selectedFiles.some(f => f.hash === d.hash)),...data.documents] : data.documents;
      const result = { ...data, documents, ...groupDocuments(documents, { autoGroup:prefs.autoGroup }) };
      setLastResult(result);
      if (!documents.some(d => ["error","cancelled"].includes(d.status))) openResult(result);
    } catch (error) {
      setError(
        error.name === "AbortError"
          ? "Análise cancelada. Os dados deste envio não foram carregados."
          : error instanceof TypeError
            ? "Não foi possível conectar ao servidor. Verifique a conexão e tente novamente."
            : error.message,
      );
      if (error.name === "AbortError")
        setProgress((old) =>
          old.map((d) =>
            ["completed", "review_required", "error", "duplicate"].includes(
              d.status,
            )
              ? d
              : { ...d, status: "cancelled" },
          ),
        );
    } finally {
      setBusy(false);
      controller.current = null;
    }
  }
  function openResult(result) {
    loadBatch(result);
    navigate(result.closings.length === 1 && result.documents.length === 1 ? "/resultado" : "/lote");
  }
  return (
    <section className="panel upload-panel">
      <div className="panel-heading">
        <span className="tile red">
          <FileText size={22} />
        </span>
        <div>
          <h2>Importar documentos do caixa</h2>
          <p>Envie PDFs, planilhas Excel, CSVs e outros formatos compatíveis.</p>
        </div>
      </div>
      <div
        className={"dropzone " + (drag ? "dragging" : "")}
        onDragOver={(e) => {
          e.preventDefault();
          setDrag(true);
        }}
        onDragLeave={() => setDrag(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDrag(false);
          select(Array.from(e.dataTransfer.files));
        }}
      >
        <div className="upload-icon">
          <CloudUpload size={39} />
        </div>
        <h3>Arraste seus documentos até aqui</h3>
        <p>ou escolha os arquivos no seu dispositivo</p>
        <button
          className="primary"
          onClick={() => input.current.click()}
          disabled={busy || selecting}
        >
          <Plus size={18} />
          {selecting
            ? "Verificando arquivos…"
            : files.length
              ? "Adicionar documentos"
              : "Selecionar documentos"}
        </button>
        <small>
          PDF, XLSX, XLS, ODS, CSV, TXT, PNG e JPEG · Até {maxFiles} arquivos · {serverLimits.maxUploadBytes / 1024 / 1024} MB
          por arquivo · {serverLimits.maxBatchBytes / 1024 / 1024} MB por lote
        </small>
        <input
          ref={input}
          type="file"
          multiple
          accept={documentAccept}
          hidden
          onChange={(e) => {
            select(Array.from(e.target.files));
            e.target.value = "";
          }}
        />
      </div>
      {!!files.length && (
        <>
          <div className="file-list-heading">
            <strong>{files.length} arquivo(s) selecionado(s)</strong>
            <button
              className="text-button"
              disabled={busy}
              onClick={() => {
                setFiles([]);
                setProgress([]);
                setError("");
                setLastResult(null);
              }}
            >
              Limpar seleção
            </button>
          </div>
          <FileList
            files={files}
            progress={progress}
            busy={busy}
            onRemove={(hash) => {
              setFiles((old) => old.filter((i) => i.hash !== hash));
              setProgress([]);
              setLastResult(null);
            }}
          />
        </>
      )}
      {error && (
        <div role="alert" className="error-message">
          {error}
        </div>
      )}
      <div aria-live="polite" className="upload-progress-label">
        {busy
          ? `${progress.filter((d) => ["completed", "review_required", "error", "duplicate", "cancelled"].includes(d.status)).length} de ${files.length} documentos processados`
          : "Valores ausentes permanecem pendentes para conferência."}
      </div>
      <button
        className="analyze-button primary"
        disabled={!files.length || busy || selecting}
        onClick={() => analyze(false)}
      >
        {busy ? (
          <LoaderCircle className="spin" size={18} />
        ) : (
          <ArrowRight size={18} />
        )}{" "}
        {busy
          ? "Analisando documentos…"
          : `Analisar ${files.length || ""} documento${files.length === 1 ? "" : "s"}`}
      </button>
      {lastResult && !busy && <div className="batch-actions">
        <button className="secondary" onClick={() => analyze(true)} disabled={!progress.some(d => ["error","cancelled"].includes(d?.status))}>Repetir somente arquivos com falha</button>
        <button className="primary" onClick={() => openResult(lastResult)}>Abrir resultados disponíveis</button>
      </div>}
      {busy && (
        <button
          className="secondary cancel-analysis"
          onClick={() => controller.current?.abort()}
        >
          <X size={18} />
          Cancelar análise
        </button>
      )}
      <div className="privacy-hint">
        <ShieldCheck size={14} /> Documentos processados no servidor desta instalação,
        sem serviços externos. Arquivos temporários descartados após a leitura.
      </div>
    </section>
  );
}
