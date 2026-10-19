import express from "express";
import multer from "multer";
import { timingSafeEqual, createHash } from "node:crypto";
import { analyzePDF } from "./services/analyzeService.js";
import { limits } from "./config.js";
import {
  uploadStorage,
  createUploadDirectory,
  cleanupUploadDirectory,
} from "./services/uploadStorage.js";
import {
  startBatch,
  getBatch,
  batchSnapshot,
  canAcceptBatch,
  executionQueue,
  validateFile,
  fingerprint,
  safeFilename,
} from "./services/batchAnalyzer.js";
import { contractVersion } from "../shared/contracts.js";
export const app = express();
app.disable("x-powered-by");
app.use((_req, res, next) => {
  res.set({
    "X-Content-Type-Options": "nosniff",
    "Referrer-Policy": "no-referrer",
    "X-Frame-Options": "DENY",
    "Permissions-Policy": "camera=(), microphone=(), geolocation=()",
    "Cross-Origin-Resource-Policy": "same-origin",
  });
  next();
});
// A hosting adapter may replace this verifier with its provider's verified JWT/session middleware.
// No unverified identity header is trusted, and Origin is never authentication.
app.locals.verifyAccess = async (req) => {
  const expected = process.env.ACCESS_BEARER_TOKEN;
  if (expected) {
    const supplied = (req.get("authorization") || "").replace(/^Bearer /, "");
    return timingSafeEqual(
      createHash("sha256").update(expected).digest(),
      createHash("sha256").update(supplied).digest(),
    );
  }
  const host = process.env.HOST || "127.0.0.1";
  if (!["127.0.0.1", "localhost", "::1"].includes(host)) return false;
  return ["127.0.0.1", "::1", "::ffff:127.0.0.1"].includes(
    req.socket.remoteAddress,
  );
};
app.use("/api", async (req, res, next) => {
  res.set("Cache-Control", "no-store");
  if (!(await app.locals.verifyAccess(req)))
    return res
      .status(401)
      .json({
        error:
          "Acesso não autorizado. Configure o provedor de acesso privado no servidor.",
      });
  const origin = req.get("origin"),
    allowed = (
      process.env.ALLOWED_ORIGINS ||
      "http://127.0.0.1:5173,http://localhost:5173,http://127.0.0.1:8787,http://localhost:8787"
    ).split(",");
  if (origin && !allowed.includes(origin))
    return res.status(403).json({ error: "Origem não autorizada." });
  next();
});
app.get("/api/health", (_req, res) =>
  res.json({
    status: "ok",
    version: contractVersion,
    ...limits,
    ocr: "server-local",
    processingLocation: "server",
    uptimeSeconds: Math.floor(process.uptime()),
  }),
);
const upload = multer({
  storage: uploadStorage,
  limits: {
    files: limits.maxFiles,
    fields: 1,
    fieldSize: 256,
    parts: limits.maxFiles + 1,
  },
});
let receiving = 0;
function receive(mode) {
  return async (req, res, next) => {
    if (receiving >= limits.maxBatches || !canAcceptBatch())
      return res
        .status(429)
        .json({
          error: "Há lotes em andamento. Aguarde a fila liberar espaço.",
        });
    receiving++;
    try {
      req.uploadDirectory = await createUploadDirectory();
      await new Promise((resolve, reject) =>
        (mode === "single"
          ? upload.single("pdf")
          : upload.array("pdfs", limits.maxFiles))(req, res, (error) =>
          error ? reject(error) : resolve(),
        ),
      );
      const files = mode === "single" ? [req.file].filter(Boolean) : req.files;
      if (!files?.length)
        throw Object.assign(new Error("Envie pelo menos um PDF."), {
          status: 400,
        });
      if (req.aborted)
        throw Object.assign(new Error("Envio cancelado."), { status: 400 });
      req.uploadFiles = files;
      next();
    } catch (error) {
      if (req.uploadDirectory)
        await cleanupUploadDirectory(req.uploadDirectory);
      next(error);
    } finally {
      receiving--;
    }
  };
}
app.post(
  "/api/fechamento/analisar",
  receive("single"),
  async (req, res, next) => {
    const file = req.uploadFiles[0],
      controller = new AbortController();
    const abort = () => {
      if (!res.writableEnded) controller.abort();
    };
    res.once("close", abort);
    try {
      const invalid = await validateFile(file);
      if (invalid)
        return res
          .status(file.size > limits.maxUploadBytes ? 413 : 400)
          .json({ error: invalid });
      const hash = await fingerprint(file.path),
        id = 'doc-'+hash;
      const data = await executionQueue.run(
        () =>
          analyzePDF(file.path, { signal: controller.signal, documentId: id }),
        controller.signal,
      );
      const { type, ok, ...result } = data;
      res.json({
        version: contractVersion,
        id,
        hash,
        status: result.audit.canConfirm ? "completed" : "review_required",
        ...result,
        filename: safeFilename(file.originalname),
        ocr: result.pages.some((p) => p.ocr),
      });
    } catch (error) {
      next(error);
    } finally {
      res.removeListener("close", abort);
      await cleanupUploadDirectory(req.uploadDirectory);
    }
  },
);
app.post(
  "/api/fechamento/analisar-lote",
  receive("batch"),
  async (req, res, next) => {
    try {
      const job = await startBatch(req.uploadFiles, req.uploadDirectory, {
        autoGroup: req.body.autoGroup !== "false",
      });
      if (req.aborted || res.destroyed) {
        job.controller.abort();
        return;
      }
      res.once("close", () => {
        if (!res.writableEnded) job.controller.abort();
      });
      res.status(202).json(batchSnapshot(job));
    } catch (error) {
      await cleanupUploadDirectory(req.uploadDirectory);
      next(error);
    }
  },
);
app.get("/api/fechamento/lotes/:id", (req, res) => {
  const job = getBatch(req.params.id);
  if (!job)
    return res
      .status(404)
      .json({
        error: "Lote expirado ou não encontrado. Envie os arquivos novamente.",
      });
  res.json(batchSnapshot(job));
});
app.delete("/api/fechamento/lotes/:id", (req, res) => {
  const job = getBatch(req.params.id);
  if (!job) return res.status(404).json({ error: "Lote não encontrado." });
  job.controller.abort();
  res.status(202).json({ id: job.id, status: "cancelling" });
});
app.use((error, req, res, _next) => {
  if (res.headersSent) return;
  const status =
    error.code === "LIMIT_BATCH_SIZE"
      ? 413
      : error.code?.startsWith("LIMIT_")
        ? 400
        : error.status || (error.name === "AnalysisTimeout" ? 504 : 422);
  res
    .status(status)
    .json({
      error:
        error.code === "LIMIT_BATCH_SIZE"
          ? `O lote excede ${limits.maxBatchBytes / 1024 / 1024} MB.`
          : error.code?.startsWith("LIMIT_")
            ? `Envie até ${limits.maxFiles} PDFs, usando o campo correto.`
            : error.name === "PasswordException"
              ? "PDF protegido por senha. Exporte uma cópia sem senha."
              : error.name === "AnalysisTimeout"
                ? "Tempo limite de leitura excedido."
                : error.name === "AbortError"
                  ? "Análise cancelada."
                  : error.status
                    ? error.message
                    : error.message?.includes("limite")
                      ? error.message
                      : "Não foi possível ler o PDF. Verifique o arquivo ou use a conferência manual.",
    });
});
app.use("/api", (_req, res) =>
  res.status(404).json({ error: "Rota da API não encontrada." }),
);
