import { fork } from "node:child_process";
export function analyzePDF(
  buffer,
  { signal, onProgress = () => {}, documentId, format = "pdf", importProfiles = [] } = {},
) {
  return new Promise((resolve, reject) => {
    const env = { ...process.env };
    delete env.NODE_WATCH_REPORT_DEPENDENCIES;
    const child = fork(new URL("./pdfWorker.js", import.meta.url), [], {
      execArgv: ["--max-old-space-size=384"],
      env,
      stdio: ["ignore", "ignore", "ignore", "ipc"],
      windowsHide: true,
    });
    let settled = false;
    function finish(error, data) {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      signal?.removeEventListener("abort", abort);
      if (error) reject(error);
      else resolve(data);
    }
    const timer = setTimeout(() => {
      child.kill();
      finish(
        Object.assign(
          new Error("Tempo limite de análise excedido (120 segundos)."),
          { name: "AnalysisTimeout" },
        ),
      );
    }, 120000);
    child.on("message", (data) => {
      if (data?.type === "closing-analysis-progress") {
        onProgress(data);
        return;
      }
      if (data?.type !== "closing-analysis-result") return;
      if (data.ok && Array.isArray(data.pages) && data.fields)
        finish(null, data);
      else
        finish(
          Object.assign(
            new Error(data.error?.message || "Resposta inválida do leitor."),
            { name: data.error?.name || "Error", status: data.error?.name === "DocumentError" ? 422 : undefined, failureKind:data.error?.failureKind },
          ),
        );
    });
    child.once("error", (error) => finish(error));
    child.once("exit", () => {
      if (!settled)
        finish(new Error("O processo de leitura foi interrompido."));
    });
    function abort() {
      child.kill();
      finish(
        Object.assign(new Error("Análise cancelada."), { name: "AbortError" }),
      );
    }
    signal?.addEventListener("abort", abort, { once: true });
    if (signal?.aborted) {
      abort();
      return;
    }
    child.send(
      {
        ...(typeof buffer === "string"
          ? { filePath: buffer }
          : { data: buffer.toString("base64") }),
        documentId,
        format,
        importProfiles,
      },
      (error) => {
        if (error) {
          child.kill();
          finish(error);
        }
      },
    );
  });
}
