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
import {
  SESSION_COOKIE_NAME,
  checkCredentials,
  createSessionToken,
  verifySessionToken,
  parseCookies,
  buildSessionCookie,
  buildClearCookie,
} from "./services/authService.js";
import { isAllowedOrigin } from "./services/originValidator.js";

export const app = express();
app.disable("x-powered-by");

// Probe público sem dados financeiros; a API continua exigindo autenticação.
app.get("/healthz", (_req, res) => {
  res.set("Cache-Control", "no-store").json({ status: "ok" });
});

// Configuração para proxies reversos (como Railway, Nginx, Cloudflare)
app.set("trust proxy", 1);

// Cabeçalhos de segurança essenciais
app.use((_req, res, next) => {
  res.set({
    "X-Content-Type-Options": "nosniff",
    "Referrer-Policy": "strict-origin-when-cross-origin",
    "X-Frame-Options": "DENY",
    "Permissions-Policy": "camera=(), microphone=(), geolocation=()",
    "Cross-Origin-Resource-Policy": "same-origin",
  });
  next();
});

// Middleware para processar payloads JSON (login, configurações)
app.use(express.json());

function isSecureRequest(req) {
  return (
    process.env.NODE_ENV === "production" ||
    req.secure ||
    req.get("x-forwarded-proto") === "https"
  );
}

// Verificador de acesso extensível e adaptado para Railway e sessões HttpOnly
app.locals.verifyAccess = async (req) => {
  // 1. Verificação por Bearer Token (para automações ou integrações servidor-a-servidor)
  const expectedBearer = process.env.ACCESS_BEARER_TOKEN;
  if (expectedBearer) {
    const supplied = (req.get("authorization") || "").replace(/^Bearer /, "");
    if (
      supplied &&
      timingSafeEqual(
        createHash("sha256").update(expectedBearer).digest(),
        createHash("sha256").update(supplied).digest(),
      )
    ) {
      req.user = { username: "service", role: "system" };
      return true;
    }
    // Quando ACCESS_BEARER_TOKEN está estritamente definido, não aceita outros métodos
    return false;
  }

  // 2. Verificação de sessão autenticada por Cookie HttpOnly
  const cookies = parseCookies(req.get("cookie"));
  const sessionToken = cookies[SESSION_COOKIE_NAME];
  if (sessionToken) {
    const session = verifySessionToken(sessionToken);
    if (session) {
      req.user = session;
      return true;
    }
  }

  // 3. Fallback restrito apenas para desenvolvimento e suítes de testes locais
  const isProd = process.env.NODE_ENV === "production";
  const host = process.env.HOST || "127.0.0.1";
  const strictAuth =
    process.env.REQUIRE_AUTH === "true" || isProd || host === "0.0.0.0";

  if (!strictAuth) {
    const remote = req.socket?.remoteAddress;
    const isLocalRemote = ["127.0.0.1", "::1", "::ffff:127.0.0.1"].includes(remote);
    const isLocalHost = ["127.0.0.1", "localhost", "::1"].includes(host);
    if (isLocalHost && isLocalRemote) {
      req.user = { username: "dev_local", role: "developer" };
      return true;
    }
  }

  return false;
};

// Rotas de Autenticação
app.post("/api/auth/login", (req, res) => {
  const { username, password } = req.body || {};
  const authResult = checkCredentials(username, password);

  if (!authResult.ok) {
    return res.status(401).json({ error: authResult.error });
  }

  const token = createSessionToken(authResult.user);
  const isSecure = isSecureRequest(req);
  res.setHeader("Set-Cookie", buildSessionCookie(token, isSecure));

  return res.json({
    ok: true,
    user: authResult.user,
    message: "Autenticado com sucesso.",
  });
});

app.post("/api/auth/logout", (req, res) => {
  const isSecure = isSecureRequest(req);
  res.setHeader("Set-Cookie", buildClearCookie(isSecure));
  return res.json({ ok: true, message: "Sessão encerrada com sucesso." });
});

app.get("/api/auth/me", (req, res) => {
  const cookies = parseCookies(req.get("cookie"));
  const sessionToken = cookies[SESSION_COOKIE_NAME];
  if (sessionToken) {
    const session = verifySessionToken(sessionToken);
    if (session) {
      return res.json({
        authenticated: true,
        user: {
          username: session.sub,
          name: session.name,
          role: session.role,
        },
      });
    }
  }

  return res.status(401).json({
    authenticated: false,
    error: "Sessão não autenticada ou expirada.",
  });
});

// Middleware de proteção das rotas da API e verificação de Origem
app.use("/api", async (req, res, next) => {
  res.set("Cache-Control", "no-store");

  // 1. Verificação de Origem com suporte ao Railway e desenvolvimento local
  if (!isAllowedOrigin(req)) {
    return res.status(403).json({ error: "Origem não autorizada." });
  }

  // 2. Rotas de autenticação gerenciadas acima
  if (
    req.path === "/auth/login" ||
    req.path === "/auth/logout" ||
    req.path === "/auth/me"
  ) {
    return next();
  }

  // 3. Verificação de acesso para todas as rotas /api
  if (!(await app.locals.verifyAccess(req))) {
    return res.status(401).json({
      error:
        "Acesso não autorizado. Faça login para acessar o sistema.",
    });
  }

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
        id = 'doc-' + hash;
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
