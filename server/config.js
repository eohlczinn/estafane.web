const integer = (key, value, min, max) =>
  Math.max(min, Math.min(max, Math.trunc(Number(process.env[key]) || value)));
export const limits = {
  maxFiles: integer("MAX_BATCH_FILES", 10, 1, 10),
  maxUploadBytes: integer("MAX_UPLOAD_MB", 10, 1, 30) * 1024 * 1024,
  maxBatchBytes: integer("MAX_BATCH_MB", 30, 1, 100) * 1024 * 1024,
  maxPages: 20,
  concurrency: integer("ANALYSIS_CONCURRENCY", 1, 1, 2),
  maxBatches: integer("MAX_ACTIVE_BATCHES", 3, 1, 5),
  retentionMs: integer("BATCH_RETENTION_MINUTES", 10, 1, 30) * 60000,
};
