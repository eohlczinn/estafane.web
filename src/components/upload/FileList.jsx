import React from "react";
import { FileText, X } from "lucide-react";
import FileStatus from "./FileStatus.jsx";
export default function FileList({ files, progress = [], onRemove, busy }) {
  return (
    <ul className="batch-files">
      {files.map((item, i) => (
        <li key={item.hash}>
          <FileText size={22} />
          <div>
            <strong>{item.file.name}</strong>
            <small>{(item.file.size / 1024).toFixed(1)} KB · {progress[i]?.format ? `Detectado: ${progress[i].format.toUpperCase()}` : item.file.name.split(".").pop().toUpperCase()}</small>
            <FileStatus document={progress[i] || { status: "selected" }} />
            {progress[i]?.error && (
              <p className="field-error">{progress[i].error}</p>
            )}
          </div>
          <button
            className="icon-btn"
            disabled={busy}
            onClick={() => onRemove(item.hash)}
            aria-label={"Remover " + item.file.name}
          >
            <X size={19} />
          </button>
        </li>
      ))}
    </ul>
  );
}
