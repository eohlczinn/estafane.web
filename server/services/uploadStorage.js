import fs from "node:fs";
import fsp from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { Transform } from "node:stream";
import { pipeline } from "node:stream/promises";
import { limits } from "../config.js";
const root = path.resolve(os.tmpdir(), "estefane-web-uploads");
export async function createUploadDirectory() {
  await fsp.mkdir(root, { recursive: true });
  return fsp.mkdtemp(path.join(root, "batch-"));
}
export async function cleanupUploadDirectory(directory) {
  const target = path.resolve(directory);
  if (
    path.dirname(target) !== root ||
    !path.basename(target).startsWith("batch-")
  )
    throw Error("Diretório de upload inválido para limpeza.");
  await fsp.rm(target, { recursive: true, force: true });
}
export async function cleanupStaleUploads(now = Date.now()) {
  const entries = await fsp
    .readdir(root, { withFileTypes: true })
    .catch(() => []);
  for (const entry of entries) {
    if (!entry.isDirectory() || !entry.name.startsWith("batch-")) continue;
    const target = path.join(root, entry.name),
      stat = await fsp.lstat(target);
    if (!stat.isSymbolicLink() && now - stat.mtimeMs > 2 * 60 * 60 * 1000)
      await cleanupUploadDirectory(target);
  }
}
// Stream to temporary files; never buffer an entire batch in Express memory.
export const uploadStorage = {
  _handleFile(req, file, callback) {
    const target = path.join(req.uploadDirectory, randomUUID() + ".upload");
    let size = 0;
    const limiter = new Transform({
      transform(chunk, _encoding, next) {
        size += chunk.length;
        req.batchBytes = (req.batchBytes || 0) + chunk.length;
        if (req.batchBytes > limits.maxBatchBytes)
          return next(
            Object.assign(
              new Error("O lote excede o tamanho total permitido."),
              { code: "LIMIT_BATCH_SIZE" },
            ),
          );
        // Keep reading an oversized individual file so the remaining PDFs can proceed.
        next(null, size <= limits.maxUploadBytes ? chunk : undefined);
      },
    });
    pipeline(
      file.stream,
      limiter,
      fs.createWriteStream(target, { flags: "wx" }),
    ).then(
      () => callback(null, { path: target, size }),
      (error) => callback(error),
    );
  },
  _removeFile(_req, file, callback) {
    fsp.rm(file.path, { force: true }).then(() => callback(null), callback);
  },
};
