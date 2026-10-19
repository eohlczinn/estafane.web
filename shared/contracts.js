export const contractVersion = 2;
import { allFields, moneyFields } from "./fields.js";
export const documentStatuses = [
  "waiting",
  "reading",
  "interpreting",
  "calculating",
  "validating",
  "review_required",
  "completed",
  "error",
  "cancelled",
  "duplicate",
];
export function validateDocument(document) {
  if (
    !document ||
    typeof document.id !== "string" ||
    typeof document.filename !== "string" ||
    !documentStatuses.includes(document.status) ||
    !/^[a-f0-9]{64}$/.test(document.hash || "")
  )
    throw Error("Contrato de documento inválido.");
  if (document.fields) {
    for (const key of Object.keys(allFields)) {
      const f = document.fields[key];
      if (
        !f ||
        typeof f.status !== "string" ||
        (f.value != null &&
          (key in moneyFields
            ? !Number.isSafeInteger(f.value)
            : typeof f.value !== "string"))
      )
        throw Error("Campo inválido: " + key);
    }
  }
  for (const m of document.movements || [])
    if (
      !Number.isSafeInteger(m.amountCents) ||
      m.amountCents < 0 ||
      !["in", "out"].includes(m.direction) ||
      !m.source?.documentId
    )
      throw Error("Contrato de movimentação inválido.");
  return document;
}
export function validateBatch(batch) {
  if (
    batch.version !== contractVersion ||
    !Array.isArray(batch.documents) ||
    !Array.isArray(batch.closings) ||
    typeof batch.id !== "string"
  )
    throw Error("Contrato de lote incompatível.");
  batch.documents.forEach(validateDocument);
  for (const c of batch.closings) {
    if (
      typeof c.id !== "string" ||
      !Array.isArray(c.documentIds) ||
      !c.fields ||
      !c.audit ||
      ![
        "validated",
        "review_required",
        "conflict",
        "incomplete",
        "error",
      ].includes(c.audit.status)
    )
      throw Error("Contrato de fechamento inválido.");
  }
  return batch;
}
