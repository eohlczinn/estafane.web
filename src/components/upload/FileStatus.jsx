import React from "react";
import { LoaderCircle, CheckCircle2, AlertTriangle } from "lucide-react";
export const fileStatusLabels = {
  selected: "Selecionado",
  waiting: "Aguardando",
  reading: "Lendo",
  interpreting: "Interpretando",
  calculating: "Calculando",
  validating: "Validando",
  completed: "Leitura concluída · conferir",
  review_required: "Pendente de conferência",
  error: "Erro",
  cancelled: "Cancelado",
  duplicate: "Documento duplicado",
};
export default function FileStatus({ document }) {
  const working = [
    "reading",
    "interpreting",
    "calculating",
    "validating",
  ].includes(document.status);
  return (
    <span className={"file-state state-" + document.status}>
      {working ? (
        <LoaderCircle size={15} className="spin" />
      ) : document.status === "error" ? (
        <AlertTriangle size={15} />
      ) : (
        <CheckCircle2 size={15} />
      )}{" "}
      {document.status === "error" ? document.failureKind === "unsupported" ? "Não suportado" : document.failureKind === "limit" ? "Acima do limite" : document.failureKind === "invalid" ? "Arquivo inválido" : "Erro de processamento" : fileStatusLabels[document.status] || "Aguardando"}
      {document.pageCount
        ? ` · pág. ${document.page}/${document.pageCount}`
        : ""}
    </span>
  );
}
