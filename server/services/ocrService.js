import { createWorker } from "tesseract.js";
import { createCanvas } from "@napi-rs/canvas";
import path from "node:path";
import { createRequire } from "node:module";
const require = createRequire(import.meta.url);
export async function recognizePage(page) {
  const viewport = page.getViewport({ scale: 1.7 });
  if (viewport.width * viewport.height > 4000000)
    throw new Error("Página excede o limite de resolução para OCR.");
  const canvas = createCanvas(
    Math.ceil(viewport.width),
    Math.ceil(viewport.height),
  );
  await page.render({ canvasContext: canvas.getContext("2d"), viewport })
    .promise;
  return (await recognizeBuffer(canvas.toBuffer("image/png"))).text;
}
export async function recognizeBuffer(buffer) {
  const worker = await createWorker("por", 1, {
    langPath:
      path.dirname(require.resolve("@tesseract.js-data/por/package.json")) +
      "/4.0.0",
    cacheMethod: "none",
    gzip: true,
  });
  try {
    const { data } = await worker.recognize(buffer);
    return { text: data.text, confidence: data.confidence / 100 };
  } finally {
    await worker.terminate();
  }
}
