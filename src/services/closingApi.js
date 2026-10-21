import { validateBatch } from "../../shared/contracts.js";

async function json(response) {
  const data = await response.json().catch(() => {
    throw Error("O servidor não respondeu corretamente. Tente novamente.");
  });
  if (response.status === 401) {
    if (typeof window !== "undefined") {
      window.dispatchEvent(new CustomEvent("auth:expired"));
    }
    throw Error(data?.error || "Sessão expirada. Faça login novamente.");
  }
  if (!response.ok)
    throw Error(data.error || "Não foi possível concluir a solicitação.");
  return data;
}

const delay = (ms, signal) =>
  new Promise((resolve, reject) => {
    const done = () => {
      signal?.removeEventListener("abort", abort);
      resolve();
    };
    const timer = setTimeout(done, ms);
    function abort() {
      clearTimeout(timer);
      reject(new DOMException("Cancelado", "AbortError"));
    }
    signal?.addEventListener("abort", abort, { once: true });
    if (signal?.aborted) abort();
  });

export async function analyzeFiles(
  files,
  { signal, onProgress = () => {}, autoGroup = true } = {},
) {
  const form = new FormData();
  files.forEach((f) =>
    form.append(
      "pdfs",
      f.type ? f : new Blob([f], { type: "application/pdf" }),
      f.name,
    ),
  );
  form.append("autoGroup", String(autoGroup));
  let id;
  try {
    let data = validateBatch(
      await json(
        await fetch("/api/fechamento/analisar-lote", {
          method: "POST",
          body: form,
          signal,
          credentials: "include",
        }),
      ),
    );
    id = data.id;
    onProgress(data);
    while (data.status === "processing") {
      await delay(500, signal);
      data = validateBatch(
        await json(
          await fetch("/api/fechamento/lotes/" + id, {
            signal,
            credentials: "include",
          }),
        ),
      );
      onProgress(data);
    }
    return data;
  } catch (error) {
    if (id && signal?.aborted)
      await fetch("/api/fechamento/lotes/" + id, {
        method: "DELETE",
        credentials: "include",
      }).catch(() => {});
    throw error;
  }
}
