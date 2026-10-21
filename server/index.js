import { app } from "./app.js";
import { stopBatches } from "./services/batchAnalyzer.js";
import { cleanupStaleUploads } from "./services/uploadStorage.js";
import path from "node:path";
import express from "express";
app.use(express.static(path.resolve("dist"), { dotfiles: "deny" }));
app.get("/{*path}", (_req, res) =>
  res.sendFile(path.resolve("dist/index.html")),
);
const port = process.env.PORT === undefined ? 8787 : Number(process.env.PORT),
  host = process.env.HOST || (process.env.NODE_ENV === "production" ? "0.0.0.0" : "127.0.0.1");
if (!Number.isInteger(port) || port < 0 || port > 65535)
  throw Error("PORT deve ser uma porta válida.");
const server = app.listen(port, host, () => {
  const address = server.address();
  if (address && typeof address === "object")
    console.log(
      `estefane-web API: http://${host.includes(":") ? "[" + host + "]" : host}:${address.port}`,
    );
});
cleanupStaleUploads().catch(() =>
  console.error(
    "Não foi possível limpar temporários antigos. Verifique as permissões da pasta temporária.",
  ),
);
const cleanupTimer = setInterval(
  () => cleanupStaleUploads().catch(() => {}),
  30 * 60 * 1000,
);
cleanupTimer.unref();
server.requestTimeout = 120000;
server.headersTimeout = 15000;
server.keepAliveTimeout = 5000;
server.on("error", (error) => {
  console.error(
    error.code === "EADDRINUSE"
      ? `A porta ${port} já está em uso. Encerre a execução anterior.`
      : "Não foi possível iniciar o servidor. Verifique HOST e PORT.",
  );
  process.exitCode = 1;
});
let stopping = false;
async function shutdown() {
  if (stopping) return;
  stopping = true;
  const deadline = setTimeout(() => process.exit(1), 7000);
  deadline.unref();
  server.close();
  server.closeIdleConnections();
  await stopBatches();
  server.closeAllConnections();
  clearTimeout(deadline);
}
process.once("SIGTERM", shutdown);
process.once("SIGINT", shutdown);
