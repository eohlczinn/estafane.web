import { validateDocument } from "../../shared/contracts.js";
import { reconcile } from "../../shared/reconciliation.js";

const MAX_RECORD_BYTES = 2 * 1024 * 1024;
const MAX_TOTAL_BYTES = 20 * 1024 * 1024;
const snapshotKeys = [
  "id",
  "fields",
  "rules",
  "movements",
  "declarations",
  "unparsedLines",
  "extractionIssues",
  "mergeIssues",
  "resolutions",
  "history",
  "pages",
  "documents",
  "documentIds",
  "warnings",
  "notes",
  "confirmed",
  "reviewed",
  "profileCorrections",
];
export function archiveSnapshot(closing) {
  const value = Object.fromEntries(
    snapshotKeys
      .filter((k) => closing[k] !== undefined)
      .map((k) => [k, closing[k]]),
  );
  value.history = (value.history || []).slice(-100);
  const json = JSON.stringify(value);
  if (new TextEncoder().encode(json).length > MAX_RECORD_BYTES)
    throw Error(
      "Este fechamento ultrapassa 2 MB. Baixe o PDF para guardar uma cópia.",
    );
  return restoreSnapshot(JSON.parse(json), false);
}
export function restoreSnapshot(value, reopen = true) {
  if (
    !value ||
    !value.fields ||
    !value.rules ||
    !Array.isArray(value.documents) ||
    !Array.isArray(value.pages) ||
    !Array.isArray(value.movements)
  )
    throw Error(
      "Registro incompleto. Não foi possível restaurar este fechamento.",
    );
  validateDocument({
    ...value,
    id: String(value.id),
    filename: "histórico",
    hash: "0".repeat(64),
    status: "completed",
  });
  const copy = JSON.parse(JSON.stringify(value));
  delete copy.undoStack;
  // Reopening always requires a fresh review. Persisted calculations are never trusted.
  if (reopen) {
    copy.confirmed = false;
    copy.reviewed = false;
  }
  const audit = reconcile(copy, {
    reviewed: !!copy.confirmed && !!copy.reviewed,
  });
  return {
    ...copy,
    audit,
    calculation: audit.calculation,
    status: audit.status,
  };
}
export function makeArchiveRecord(
  closing,
  id = crypto.randomUUID(),
  previous,
  now = new Date().toISOString(),
) {
  const snapshot = archiveSnapshot(closing);
  const bytes = new TextEncoder().encode(JSON.stringify(snapshot)).length;
  if (bytes > MAX_RECORD_BYTES)
    throw Error(
      "Este fechamento ultrapassa 2 MB. Baixe o PDF para guardar uma cópia.",
    );
  return {
    version: 1,
    id,
    savedAt: previous?.savedAt || now,
    updatedAt: now,
    snapshot,
    bytes,
  };
}
export function checkArchiveCapacity(records, record, limit = 50) {
  const others = records.filter((r) => r.id !== record.id);
  if (
    (!records.some((r) => r.id === record.id) && others.length >= limit) ||
    others.reduce((sum, r) => sum + r.bytes, 0) + record.bytes > MAX_TOTAL_BYTES
  )
    throw Error(
      "Histórico cheio. Exclua registros que não precisa mais antes de salvar.",
    );
}
function database() {
  return new Promise((resolve, reject) => {
    if (!globalThis.indexedDB)
      return reject(Error("O histórico não está disponível neste navegador."));
    const request = indexedDB.open("estefane-workspace", 1);
    request.onupgradeneeded = () =>
      request.result.createObjectStore("closings", { keyPath: "id" });
    request.onerror = () =>
      reject(Error("Não foi possível abrir o histórico local."));
    request.onblocked = () =>
      reject(Error("Feche outras abas do site para atualizar o histórico."));
    request.onsuccess = () => resolve(request.result);
  });
}
async function transaction(mode, operation) {
  const db = await database();
  try {
    return await new Promise((resolve, reject) => {
      const tx = db.transaction("closings", mode),
        store = tx.objectStore("closings");
      let result;
      tx.oncomplete = () => resolve(result);
      tx.onerror = tx.onabort = () =>
        reject(
          Error(
            "Não foi possível salvar a alteração no histórico. Verifique o espaço disponível.",
          ),
        );
      operation(store, (value) => {
        result = value;
      });
    });
  } finally {
    db.close();
  }
}
export function decodeArchiveRecords(records) {
  return records
    .map((record) => {
      try {
        if (
          record.version !== 1 ||
          typeof record.id !== "string" ||
          typeof record.updatedAt !== "string" ||
          !Number.isFinite(Date.parse(record.updatedAt))
        )
          throw Error("Formato de histórico incompatível.");
        return { ...record, snapshot: restoreSnapshot(record.snapshot, false) };
      } catch {
        return {
          id: record.id,
          version: record.version,
          invalid: true,
          bytes: Number.isFinite(record.bytes) ? record.bytes : 0,
          updatedAt: Number.isFinite(Date.parse(record.updatedAt))
            ? record.updatedAt
            : "1970-01-01T00:00:00Z",
          snapshot: {
            fields: {
              market: { value: "Registro incompatível ou incompleto" },
            },
            confirmed: false,
          },
        };
      }
    })
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
}
export const listArchive = () =>
  transaction("readonly", (store, done) => {
    const request = store.getAll();
    request.onsuccess = () => done(decodeArchiveRecords(request.result));
  });
export const putArchive = (record, limit) =>
  transaction("readwrite", (store, done) => {
    const request = store.getAll();
    request.onsuccess = () => {
      try {
        checkArchiveCapacity(request.result, record, limit);
        store.put(record);
        done(record);
      } catch (error) {
        done({ error: error.message });
      }
    };
  }).then((result) => {
    if (result?.error) throw Error(result.error);
    return result;
  });
export const deleteArchive = (ids) =>
  transaction("readwrite", (store) => ids.forEach((id) => store.delete(id)));
