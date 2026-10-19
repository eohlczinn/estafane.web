import assert from "node:assert/strict";
import fs from "node:fs/promises";
import { getDocument } from "pdfjs-dist/legacy/build/pdf.mjs";
import { createCanvas } from "@napi-rs/canvas";
import { parsePages } from "../server/services/pdfParser.js";
import { groupDocuments } from "../shared/grouping.js";
import { reconcile } from "../shared/reconciliation.js";
import { closingReport, consolidatedReport } from "../src/services/report.js";
import {
  reportPDF,
  individualReportArchive,
} from "../src/services/pdfGenerator.js";
import { defaultPreferences } from "../src/services/preferences.js";
const document = (id, register, counted) => {
  const text = `Mercado: MERCADO FICTICIO TESTE\nOperadora: Estefane\nCaixa: ${register}\nData: 19/10/2026\nTotal de vendas: 1.000,00\nDinheiro: 1.000,00\nPIX: 0,00\nDebito: 0,00\nCredito: 0,00\nVale-alimentacao: 0,00\nOutros: 0,00\nFundo: 100,00\nSuprimento: 50,00\nSangria 01: 100,00\nDevolucoes: 0,00\nDinheiro contado: ${counted}`;
  return {
    id,
    hash: id.repeat(64),
    filename: `caixa-${register}-ficticio.pdf`,
    status: "completed",
    ...parsePages([{ page: 1, text }], { documentId: id }),
    pages: [{ page: 1, text }],
  };
};
const docs = [document("a", "01", "1.030,00"), document("b", "02", "1.060,00")],
  batch = { id: "ficticio", documents: docs, ...groupDocuments(docs) },
  prefs = { ...defaultPreferences };
batch.closings.forEach((c) => {
  c.confirmed = true;
  c.reviewed = true;
  c.audit = reconcile(c, { reviewed: true });
  assert.equal(c.audit.status, "validated");
});
async function inspect(pdf, required, paper, file) {
  const bytes = new Uint8Array(pdf.output("arraybuffer"));
  await fs.writeFile(file + ".pdf", bytes);
  const task = getDocument({ data: bytes, useSystemFonts: true }),
    doc = await task.promise;
  let all = "";
  try {
    for (let i = 1; i <= doc.numPages; i++) {
      const page = await doc.getPage(i),
        width = (page.view[2] * 25.4) / 72;
      assert.ok(Math.abs(width - (paper === "a4" ? 210 : +paper)) < 0.2);
      const content = await page.getTextContent();
      for (const item of content.items) {
        all += item.str + " ";
        assert.ok(item.transform[4] >= -1);
        assert.ok(
          item.transform[4] + item.width <= page.view[2] + 1,
          "texto fora do papel",
        );
        assert.ok(
          item.transform[5] >= -1 && item.transform[5] <= page.view[3] + 1,
        );
      }
      if (i === 1) {
        const view = page.getViewport({ scale: 1.2 }),
          canvas = createCanvas(Math.ceil(view.width), Math.ceil(view.height));
        await page.render({
          canvasContext: canvas.getContext("2d"),
          viewport: view,
        }).promise;
        await fs.writeFile(file + ".png", canvas.toBuffer("image/png"));
      }
    }
    for (const text of required)
      assert.ok(all.includes(text), `Texto ausente: ${text}`);
  } finally {
    await task.destroy();
  }
}
await fs.mkdir("tests/output", { recursive: true });
for (const paper of ["a4", "80", "58"]) {
  for (const c of batch.closings)
    await inspect(
      reportPDF(closingReport(c, prefs), prefs, paper),
      [
        "Estefane",
        c.fields.register.value,
        "Dinheiro esperado",
        "1.050,00",
        "100,00",
        c.fields.register.value === "01" ? "FALTA" : "SOBRA",
        "DOCUMENTOS DE ORIGEM",
      ],
      paper,
      `tests/output/individual-${c.fields.register.value}-${paper}`,
    );
  const model = consolidatedReport(batch, prefs);
  assert.equal(model.summary.totalShortCents, 2000);
  assert.equal(model.summary.totalOverCents, 1000);
  assert.equal(model.summary.netDifferenceCents, -1000);
  await inspect(
    reportPDF(model, prefs, paper),
    [
      "CONSOLIDADO",
      "20,00",
      "10,00",
      "Estefane",
      "Caixa 01",
      "Caixa 02",
      "DOCUMENTOS UTILIZADOS",
    ],
    paper,
    `tests/output/consolidado-${paper}`,
  );
  console.log(
    `OK: PDFs individuais e consolidado ${paper}, dimensões, falta/sobra, identificação, origem e texto dentro da página.`,
  );
}
batch.closings[0].confirmed = false;
const partial = consolidatedReport(batch, prefs);
assert.equal(partial.partial, true);
assert.equal(partial.summary.netDifferenceCents, null);
assert.equal(partial.summary.totalSalesCents, 100000);
await inspect(
  reportPDF(partial, prefs, "58"),
  ["PARCIAL", "EXCLUÍDO DOS TOTAIS CONFIRMADOS"],
  "58",
  "tests/output/consolidado-parcial-58",
);
const archive = individualReportArchive(batch.closings, prefs);
await fs.writeFile("tests/output/individuais-teste.zip", archive);
assert.equal(new DataView(archive.buffer).getUint32(0, true), 0x04034b50);
console.log(
  "OK: consolidado parcial identificado, caixa não confirmado excluído, ZIP gerado.",
);
