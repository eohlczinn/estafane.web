import { getDocument, OPS } from "pdfjs-dist/legacy/build/pdf.mjs";
import { recognizePage } from "./ocrService.js";
import { reconstructPage } from "./textLines.js";
export async function readPDF(buffer, onProgress = () => {}) {
  const task = getDocument({
    data: new Uint8Array(buffer),
    isEvalSupported: false,
    useSystemFonts: true,
  });
  let document;
  try {
    document = await task.promise;
    if (document.numPages > 20)
      throw new Error("O limite é de 20 páginas por PDF.");
    const pages = [];
    let textCharacters = 0,
      lineCount = 0;
    for (let i = 1; i <= document.numPages; i++) {
      const page = await document.getPage(i),
        content = await page.getTextContent();
      let { text, lines } = reconstructPage(content.items),
        ocr = false;
      const values = (text.match(/\d,\d{2}\b/g) || []).length;
      let needsOCR = text.trim().length < 20;
      if (!needsOCR && values < 2) {
        const operations = await page.getOperatorList();
        needsOCR = operations.fnArray.some((op) =>
          [
            OPS.paintImageXObject,
            OPS.paintInlineImageXObject,
            OPS.paintImageXObjectRepeat,
          ].includes(op),
        );
      }
      if (needsOCR) {
        const scanned = await recognizePage(page);
        if (scanned.text.trim().length > text.trim().length || !text.trim()) {
          text = scanned.text;
          lines = scanned.lines || scanned.text.split(/\r?\n/).map((text, index) => ({
            text,
            line: index + 1,
            bounds: null,
            segments: [],
          }));
          ocr = true;
        }
      }
      textCharacters += text.length;
      lineCount += lines.length;
      if (textCharacters > 250000 || lineCount > 5000)
        throw Error(
          "O documento excede o limite de texto extraído (250 mil caracteres ou 5 mil linhas).",
        );
      pages.push({ page: i, text, lines, ocr });
      onProgress({ stage: "reading", page: i, pageCount: document.numPages });
      page.cleanup();
    }
    return pages;
  } finally {
    await task.destroy();
  }
}
