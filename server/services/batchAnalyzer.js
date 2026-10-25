import { randomUUID, createHash } from "node:crypto";
import { createReadStream } from "node:fs";
import fs from "node:fs/promises";
import { analyzePDF } from "./analyzeService.js";
import { ExecutionQueue } from "./executionQueue.js";
import { limits } from "../config.js";
import { cleanupUploadDirectory } from "./uploadStorage.js";
import { groupDocuments } from "./groupingService.js";
import { summarizeBatch } from "../../shared/batch.js";
import { contractVersion, validateDocument } from "../../shared/contracts.js";
import { detectDocument } from "./documentDetector.js";
import { scopePartLabel } from "./documentScopes.js";
const completedStatus = (result) =>
  result.documentKind === "inventory"
    ? result.inventory?.issues?.length ||
      result.inventory?.items?.some((item) => item.issues?.length)
      ? "review_required"
      : "completed"
    : result.audit?.canConfirm
      ? "completed"
      : "review_required";
export const executionQueue = new ExecutionQueue(
  limits.concurrency,
  limits.maxBatches * limits.maxFiles + 5,
);
const jobs = new Map();
export async function fingerprint(filePath) {
  const hash = createHash("sha256");
  for await (const chunk of createReadStream(filePath)) hash.update(chunk);
  return hash.digest("hex");
}
export function safeFilename(name) {
  return (
    name
      .replace(/[\\/]/g, "_")
      .replace(/[\u0000-\u001f\u007f]/g, "")
      .slice(0, 180) || "documento.pdf"
  );
}
export async function validateFile(file) {
  if (file.size > limits.maxUploadBytes)
    return "Arquivo excede o tamanho individual permitido.";
  try {
    file.detectedFormat = await detectDocument(file);
  } catch (error) {
    file.failureKind = error.failureKind || "invalid";
    return error.message;
  }
  return null;
}
export function canAcceptBatch() {
  return (
    [...jobs.values()].filter((j) => !j.finished).length < limits.maxBatches
  );
}
export function getBatch(id, owner) {
  const job = jobs.get(id);
  return job && (!job.owner || job.owner === owner) ? job : undefined;
}
export function batchSnapshot(job) {
  const documents = job.documents.flatMap((doc) =>
    doc.parts?.length
      ? doc.parts.map((part) => ({
          ...doc,
          ...part,
          parts: undefined,
          contextPages: undefined,
          container: false,
          partOf: doc.id,
          hash: doc.hash,
          filename: `${doc.filename} · ${part.partLabel || scopePartLabel(part.pages)}`,
          status: completedStatus(part),
        }))
      : [doc],
  );
  const grouped = groupDocuments(documents, { autoGroup: job.autoGroup });
  return {
    version: contractVersion,
    id: job.id,
    batchId: job.id,
    status: job.finished
      ? job.documents.some((d) => d.status === "cancelled")
        ? "cancelled"
        : job.documents.some((d) => d.status === "error")
          ? "partial"
          : "review_required"
      : "processing",
    documents,
    sourceDocuments: job.documents.map(
      ({
        id,
        filename,
        hash,
        status,
        format,
        documentKind,
        container,
        inventory,
        contextPages,
        error,
        failureKind,
        parts,
        size,
        page,
        pageCount,
      }) => ({
        id,
        filename,
        hash,
        status,
        format,
        documentKind,
        container,
        inventory,
        contextPages,
        error,
        failureKind,
        size,
        page,
        pageCount,
        partCount: parts?.length || 0,
      }),
    ),
    closings: grouped.closings,
    suggestions: grouped.suggestions,
    summary: summarizeBatch(grouped.closings, documents),
    warnings: job.warnings || [],
  };
}
export async function startBatch(
  files,
  directory,
  { autoGroup = true, owner, importProfiles = [] } = {},
) {
  if (!canAcceptBatch())
    throw Object.assign(new Error("Fila de lotes cheia."), { status: 429 });
  // Bound retained financial metadata as well as active processing.
  const retained = [...jobs.values()].filter((j) => j.finished);
  while (retained.length >= 10) {
    const oldest = retained.shift();
    clearTimeout(oldest.expiry);
    jobs.delete(oldest.id);
  }
  const job = {
    id: randomUUID(),
    documents: [],
    controller: new AbortController(),
    directory,
    finished: false,
    autoGroup,
    owner,
  };
  jobs.set(job.id, job);
  try {
    const hashes = new Map();
    for (const file of files) {
      const hash = await fingerprint(file.path),
        error = await validateFile(file),
        duplicateOf = hashes.get(hash);
      const doc = validateDocument({
        id: error || duplicateOf ? randomUUID() : "doc-" + hash,
        filename: safeFilename(file.originalname),
        hash,
        size: file.size,
        format: file.detectedFormat,
        status: error ? "error" : duplicateOf ? "duplicate" : "waiting",
        error: error || undefined,
        failureKind: error ? file.failureKind || "limit" : undefined,
        duplicateOf,
        message: duplicateOf ? "Este documento já foi adicionado." : undefined,
      });
      job.documents.push(doc);
      if (!error && !duplicateOf) hashes.set(hash, doc.id);
    }
  } catch (error) {
    jobs.delete(job.id);
    throw error;
  }
  job.completion = (async () => {
    try {
      await Promise.all(
        job.documents.map(async (doc, index) => {
          const file = files[index];
          try {
            if (doc.status !== "waiting") return;
            const data = await executionQueue.run(
              () =>
                analyzePDF(file.path, {
                  documentId: doc.id,
                  format: file.detectedFormat,
                  importProfiles,
                  signal: job.controller.signal,
                  onProgress: ({ stage, page, pageCount }) =>
                    Object.assign(doc, { status: stage, page, pageCount }),
                }),
              job.controller.signal,
            );
            const { type, ok, ...result } = data;
            Object.assign(doc, result, {
              status: completedStatus(result),
            });
            validateDocument(doc);
          } catch (error) {
            doc.status = error.name === "AbortError" ? "cancelled" : "error";
            doc.failureKind =
              error.failureKind ||
              (error.name === "PasswordException"
                ? "unsupported"
                : "technical");
            doc.error =
              error.name === "PasswordException"
                ? "PDF protegido por senha. Exporte uma cópia sem senha."
                : error.name === "AnalysisTimeout"
                  ? "Tempo limite de análise excedido."
                  : error.name === "AbortError"
                    ? "Análise cancelada."
                    : error.name === "DocumentError" ||
                        error.message?.includes("limite")
                      ? error.message
                      : "Não foi possível ler este documento. Verifique se está corrompido ou protegido.";
          } finally {
            await fs.rm(file.path, { force: true }).catch(() => {
              job.warnings = [
                "Não foi possível descartar um arquivo temporário imediatamente. A limpeza do diretório será repetida ao finalizar.",
              ];
            });
          }
        }),
      );
    } finally {
      job.finished = true;
      await cleanupUploadDirectory(directory).catch(() => {
        job.warnings = [
          "Limpeza dos temporários pendente. Verifique as permissões da pasta temporária do servidor.",
        ];
      });
    }
  })();
  job.expiry = setTimeout(() => {
    job.controller.abort();
    jobs.delete(job.id);
  }, limits.retentionMs);
  job.expiry.unref();
  return job;
}
export async function stopBatches() {
  const pending = [...jobs.values()];
  for (const j of pending) {
    clearTimeout(j.expiry);
    j.controller.abort();
  }
  await Promise.allSettled(pending.map((j) => j.completion));
  jobs.clear();
}
