import { createWorker } from "tesseract.js";
import { createCanvas } from "@napi-rs/canvas";
import path from "node:path";
import { createRequire } from "node:module";
const require = createRequire(import.meta.url);
export async function recognizePage(page) {
  const native = page.getViewport({ scale: 1 });
  const scale = Math.min(
    2.5,
    Math.sqrt(3900000 / (native.width * native.height)),
  );
  const viewport = page.getViewport({ scale });
  if (viewport.width * viewport.height > 4000000)
    throw new Error("Página excede o limite de resolução para OCR.");
  const canvas = createCanvas(
    Math.ceil(viewport.width),
    Math.ceil(viewport.height),
  );
  await page.render({ canvasContext: canvas.getContext("2d"), viewport })
    .promise;
  return recognizeBuffer(canvas.toBuffer("image/png"));
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
    await worker.setParameters({ tessedit_pageseg_mode: "3" });
    const { data } = await worker.recognize(buffer, {}, { blocks: true });
    // OCR reading order may place an entire value column after the footer.
    // Reassemble spatial rows across blocks before interpreting table headers.
    const words = (data.blocks || []).flatMap((b) =>
      b.paragraphs.flatMap((p) => p.lines.flatMap((l) => l.words)),
    );
    const groups = [];
    for (const word of words.sort((a, b) => a.bbox.y0 - b.bbox.y0)) {
      const height = word.bbox.y1 - word.bbox.y0,
        center = (word.bbox.y0 + word.bbox.y1) / 2;
      const group = groups.find(
        (g) =>
          Math.abs(g.center - center) <
          Math.max(4, Math.min(g.height, height) * 0.55),
      );
      if (group) group.words.push(word);
      else groups.push({ center, height, words: [word] });
    }
    const lines = groups
      .sort((a, b) => a.center - b.center)
      .map((g, i) => {
        const ordered = g.words.sort((a, b) => a.bbox.x0 - b.bbox.x0);
        let text = "",
          previous;
        for (const w of ordered) {
          const gap = previous ? w.bbox.x0 - previous.bbox.x1 : 0;
          text +=
            (previous ? (gap > Math.max(25, g.height * 2) ? "\t" : " ") : "") +
            w.text;
          previous = w;
        }
        const originalText = text;
        // Stray OCR punctuation immediately after the currency symbol is not
        // part of the number. Never infer or replace any monetary digit.
        text = text.replace(/R\$[.:]\s*(?=\d)/g, "R$ ");
        return {
          line: i + 1,
          text,
          originalText,
          bounds: {
            x: ordered[0].bbox.x0,
            y: Math.min(...ordered.map((w) => w.bbox.y0)),
            width:
              Math.max(...ordered.map((w) => w.bbox.x1)) - ordered[0].bbox.x0,
            height:
              Math.max(...ordered.map((w) => w.bbox.y1)) -
              Math.min(...ordered.map((w) => w.bbox.y0)),
          },
          confidence:
            ordered.reduce((s, w) => s + w.confidence, 0) /
            ordered.length /
            100,
        };
      });
    return {
      text: lines.length ? lines.map((l) => l.text).join("\n") : data.text,
      lines: lines.length ? lines : undefined,
      confidence: data.confidence / 100,
    };
  } finally {
    await worker.terminate();
  }
}
