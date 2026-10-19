import assert from "node:assert/strict";
import fs from "node:fs/promises";
import { jsPDF } from "jspdf";
import { createCanvas } from "@napi-rs/canvas";
import { getDocument, OPS } from "pdfjs-dist/legacy/build/pdf.mjs";
import { app } from "../server/app.js";
import { calculate } from "../shared/calculation.js";
import { createReport } from "../src/services/pdfGenerator.js";
import { defaultPreferences } from "../src/services/preferences.js";
const server = app.listen(0, "127.0.0.1");
await new Promise((resolve) => server.once("listening", resolve));
const url = `http://127.0.0.1:${server.address().port}`;
const lines = [
  "Mercado: MERCADO FICTICIO - TESTE",
  "Operadora: Estefane",
  "Caixa: 01",
  "Data: 19/10/2026",
  "Total de vendas: 1.000,00",
  "Dinheiro: 500,00",
  "PIX: 200,00",
  "Debito: 100,00",
  "Credito: 200,00",
  "Outros: 0,00",
  "Fundo inicial: 100,00",
  "Sangrias: 50,00",
  "Suprimentos: 20,00",
  "Devolucoes em dinheiro: 0,00",
  "Dinheiro contado: 570,00",
];
const expected = {
  sales: 100000,
  cash: 50000,
  pix: 20000,
  debit: 10000,
  credit: 20000,
  other: 0,
  opening: 10000,
  withdrawals: 5000,
  supplies: 2000,
  refunds: 0,
  counted: 57000,
};
async function upload(data, name = "teste.pdf", type = "application/pdf") {
  const form = new FormData();
  form.append("pdf", new Blob([data], { type }), name);
  return fetch(url + "/api/fechamento/analisar", {
    method: "POST",
    body: form,
  });
}
function document(text = lines) {
  const doc = new jsPDF();
  doc.setFontSize(12);
  doc.text(text, 15, 20);
  return doc;
}
async function checkPDF(data) {
  const response = await upload(data);
  const body = await response.json();
  assert.equal(response.status, 200, JSON.stringify(body));
  return body;
}
try {
  assert.equal((await fetch(url + "/api/health")).status, 200);
  assert.equal((await fetch(url + "/api/inexistente")).status, 404);
  assert.equal(
    (
      await fetch(url + "/api/health", {
        headers: { Origin: "https://origem-invalida.example" },
      })
    ).status,
    403,
  );
  const body = await checkPDF(document().output("arraybuffer"));
  for (const [key, value] of Object.entries(expected)) {
    assert.equal(body.fields[key].value, value, key);
    assert.ok(body.fields[key].source.page);
  }
  assert.equal(body.fields.market.value, "MERCADO FICTICIO - TESTE");
  assert.equal(body.fields.date.value, "19/10/2026");
  assert.equal(body.fields.operator.value, "Estefane");
  assert.equal(body.fields.register.value, "01");
  assert.equal(body.calculation.expected, 57000);
  assert.equal(body.calculation.difference, 0);
  assert.equal(calculate(body.fields, { confirmed: true }).result, "balanced");
  console.log(
    "OK: rotas, origem, upload textual, todos os valores conhecidos, proveniência e cálculo inicial.",
  );
  const multi = document(lines.slice(0, 7));
  multi.addPage();
  multi.text(lines.slice(7), 15, 20);
  const multiBody = await checkPDF(multi.output("arraybuffer"));
  assert.equal(multiBody.pages.length, 2);
  for (const [key, value] of Object.entries(expected))
    assert.equal(multiBody.fields[key].value, value, key);
  assert.equal(multiBody.fields.counted.source.page, 2);
  const table = new jsPDF();
  table.setFontSize(12);
  ["01 - Dinheiro", "02 - PIX", "03 - Vale-alimentacao"].forEach((label, i) =>
    table.text(label, 15, 20 + i * 12),
  );
  ["100,00", "50,00", "20,00"].forEach((value, i) =>
    table.text(value, 120, 20 + i * 12),
  );
  const tableBody = await checkPDF(table.output("arraybuffer"));
  assert.equal(tableBody.fields.cash.value, 10000);
  assert.equal(tableBody.fields.pix.value, 5000);
  assert.equal(tableBody.fields.voucher.value, 2000);
  const columns=new jsPDF();columns.setFontSize(11);columns.text('Operadora: Estefane',15,20);columns.text('Caixa: 03',130,20);columns.text('Dinheiro:',15,40);columns.text('100,00',65,40);columns.text('PIX:',130,40);columns.text('20,00',175,40);const columnBody=await checkPDF(columns.output('arraybuffer'));assert.equal(columnBody.fields.operator.value,'Estefane');assert.equal(columnBody.fields.register.value,'03');assert.equal(columnBody.fields.cash.value,10000);assert.equal(columnBody.fields.pix.value,2000);assert.ok(columnBody.fields.cash.source.bounds);assert.ok(columnBody.pages[0].lines[0].segments.length>=2);
  console.log(
    "OK: PDF multipágina e tabela numerada com colunas e vale-alimentação.",
  );
  for (const [counted, result, diff] of [
    ["560,00", "short", -1000],
    ["580,00", "over", 1000],
  ]) {
    const altered = await checkPDF(
      document([...lines.slice(0, -1), `Dinheiro contado: ${counted}`]).output(
        "arraybuffer",
      ),
    );
    assert.equal(altered.calculation.difference, diff);
    assert.equal(calculate(altered.fields, { confirmed: true }).result, result);
  }
  console.log("OK: upload até cálculo real de falta e sobra.");
  assert.equal((await upload("invalido")).status, 400);
  assert.equal(
    (await upload("%PDF-invalido", "errado.txt", "text/plain")).status,
    400,
  );
  assert.equal((await upload("%PDF-corrompido")).status, 422);
  assert.equal((await upload(new Uint8Array(11 * 1024 * 1024))).status, 413);
  assert.equal((await fetch(url + "/api/health")).status, 200);
  const locked = new jsPDF({
    encryption: {
      userPassword: "senha",
      ownerPassword: "dono",
      userPermissions: ["print"],
    },
  });
  locked.text("Teste protegido", 10, 10);
  assert.equal((await upload(locked.output("arraybuffer"))).status, 422);
  console.log(
    "OK: arquivos inválidos, limite de upload, documento protegido e API permanece ativa.",
  );
  const canvas = createCanvas(1300, 1300),
    ctx = canvas.getContext("2d");
  ctx.fillStyle = "white";
  ctx.fillRect(0, 0, 1300, 1300);
  ctx.fillStyle = "black";
  ctx.font = "30px Arial";
  lines.forEach((line, i) => ctx.fillText(line, 45, 60 + i * 65));
  const scan = new jsPDF();
  scan.addImage(canvas.toBuffer("image/png"), "PNG", 0, 0, 210, 210);
  const scanned = await checkPDF(scan.output("arraybuffer"));
  assert.equal(scanned.ocr, true);
  assert.equal(scanned.fields.cash.value, 50000);
  assert.equal(scanned.fields.counted.value, 57000);
  scan.text("DOCUMENTO FICTICIO - APENAS PARA TESTE", 10, 280);
  const mixed = await checkPDF(scan.output("arraybuffer"));
  assert.equal(mixed.ocr, true);
  assert.equal(mixed.fields.cash.value, 50000);
  const blank = await checkPDF(new jsPDF().output("arraybuffer"));
  assert.equal(blank.fields.cash.value, null);
  assert.equal(blank.calculation.result, "pending");
  console.log(
    "OK: OCR local de PDF digitalizado, página mista com rodapé textual e documento vazio pendente.",
  );
  await fs.mkdir("tests/output", { recursive: true });
  await fs.writeFile(
    "tests/output/caixa-ficticio.pdf",
    new Uint8Array(document().output("arraybuffer")),
  );
  for (const paper of ["a4", "80", "58"]) {
    const calc = {
      ...calculate(body.fields, { confirmed: true }),
      rules: { confirmed: true },
      notes: "OBSERVACAO FICTICIA PARA TESTE",
    };
    const pdf = createReport(
        body.fields,
        calc,
        { ...defaultPreferences, signature: true },
        paper,
      ),
      bytes = new Uint8Array(pdf.output("arraybuffer"));
    await fs.writeFile(`tests/output/relatorio-${paper}.pdf`, bytes);
    const task = getDocument({ data: bytes, useSystemFonts: true }),
      parsed = await task.promise;
    assert.equal(
      parsed.numPages,
      1,
      "Relatório padrão deve caber em uma página",
    );
    let extracted = "";
    for (let i = 1; i <= parsed.numPages; i++) {
      const page = await parsed.getPage(i),
        viewport = page.getViewport({ scale: 1 }),
        content = await page.getTextContent();
      assert.ok(
        Math.abs(
          (viewport.width * 25.4) / 72 - (paper === "a4" ? 210 : Number(paper)),
        ) < 0.1,
      );
      for (const item of content.items) {
        if (item.str) {
          assert.ok(
            item.transform[5] > 0 && item.transform[5] < viewport.height,
            "Texto fora do papel",
          );
          extracted += item.str + " ";
        }
      }
      if (i === 1) {
        const scale = 1.2,
          view = page.getViewport({ scale }),
          image = createCanvas(Math.ceil(view.width), Math.ceil(view.height));
        await page.render({
          canvasContext: image.getContext("2d"),
          viewport: view,
        }).promise;
        await fs.writeFile(
          `tests/output/relatorio-${paper}.png`,
          image.toBuffer("image/png"),
        );
      }
    }
    assert.ok(extracted.includes("570,00"));
    assert.ok(extracted.includes("FECHAMENTO"));
    assert.ok(extracted.includes("OBSERVACAO FICTICIA"));
    assert.ok(extracted.includes("Assinatura"));
    await task.destroy();
    console.log(
      `OK: PDF ${paper}, dimensão correta, conteúdo, assinatura, observações, sem texto fora da página e renderização.`,
    );
  }
  const minimal = createReport(
    body.fields,
    {
      ...calculate(body.fields, { confirmed: true }),
      rules: { confirmed: true },
    },
    {
      ...defaultPreferences,
      includeMarket: false,
      includeSummary: false,
      includeMovements: false,
      includeGenerationTime: false,
      signature: false,
      marginThermal: 6,
    },
    "58",
  );
  const task = getDocument({
      data: new Uint8Array(minimal.output("arraybuffer")),
      useSystemFonts: true,
    }),
    pdf = await task.promise;
  let text = "";
  for (let i = 1; i <= pdf.numPages; i++)
    text += (await (await pdf.getPage(i)).getTextContent()).items
      .map((i) => i.str)
      .join(" ");
  assert.ok(!text.includes("MERCADO FICTICIO"));
  assert.ok(!text.includes("RESUMO FINANCEIRO"));
  assert.ok(!text.includes("Gerado em"));
  assert.ok(text.includes("Resultado"));
  await task.destroy();
  console.log("OK: preferências de conteúdo e margens aplicadas ao PDF real.");
  const logo = createCanvas(160, 60),
    logoContext = logo.getContext("2d");
  logoContext.fillStyle = "#7c4dff";
  logoContext.fillRect(0, 0, 160, 60);
  logoContext.fillStyle = "white";
  logoContext.font = "20px Arial";
  logoContext.fillText("TESTE", 40, 37);
  const branded = createReport(
    body.fields,
    {
      ...calculate(body.fields, { confirmed: true }),
      rules: { confirmed: true },
    },
    {
      ...defaultPreferences,
      logo:
        "data:image/png;base64," +
        logo.toBuffer("image/png").toString("base64"),
    },
    "a4",
  );
  const brandedTask = getDocument({
      data: new Uint8Array(branded.output("arraybuffer")),
      useSystemFonts: true,
    }),
    brandedPDF = await brandedTask.promise;
  const operators = await (await brandedPDF.getPage(1)).getOperatorList();
  assert.ok(operators.fnArray.includes(OPS.paintImageXObject));
  await brandedTask.destroy();
  console.log("OK: logotipo opcional incorporado no PDF real.");
  for (const paper of ["a4", "58"]) {
    const long = createReport(
      body.fields,
      {
        ...calculate(body.fields, { confirmed: true }),
        rules: { confirmed: true },
        notes: "TESTE FICTICIO ".repeat(140),
      },
      { ...defaultPreferences },
      paper,
    );
    const task = getDocument({
        data: new Uint8Array(long.output("arraybuffer")),
        useSystemFonts: true,
      }),
      pdf = await task.promise;
    const lastPage = await pdf.getPage(pdf.numPages),
      content = (await lastPage.getTextContent()).items
        .map((i) => i.str)
        .join(" ");
    assert.ok(content.includes("Fechamento conferido"));
    if (paper === "58") assert.equal(pdf.numPages, 1);
    await task.destroy();
  }
  console.log(
    "OK: conteúdo longo preservado até o rodapé em A4 e bobina com altura calculada.",
  );
} finally {
  server.close();
}
