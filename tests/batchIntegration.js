import assert from "node:assert/strict";
import { jsPDF } from "jspdf";
import fs from "node:fs/promises";
import { app } from "../server/app.js";
import { stopBatches } from "../server/services/batchAnalyzer.js";
const server = app.listen(0, "127.0.0.1");
await new Promise((r) => server.once("listening", r));
const url = `http://127.0.0.1:${server.address().port}`;
const header = (r = "01", op = "Estefane", date = "19/10/2026") => [
  "DOCUMENTO FICTICIO - TESTE",
  "Mercado: TESTE FICTICIO",
  `Operadora: ${op}`,
  `Caixa: ${r}`,
  `Data: ${date}`,
  "ID do fechamento: TURNO-A",
];
const amounts = [
  "Total de vendas: 1.000,00",
  "Dinheiro: 1.000,00",
  "Fundo: 100,00",
  "Suprimento: 50,00",
  "Sangria 01: 100,00",
  "Devolucoes: 0,00",
  "Dinheiro contado: 1.050,00",
];
const pdf = (lines) => {
  const d = new jsPDF();
  d.setFontSize(11);
  d.text(lines, 15, 20);
  return d.output("arraybuffer");
};
async function batch(files) {
  const f = new FormData();
  for (const [name, bytes, type = "application/pdf"] of files)
    f.append("pdfs", new Blob([bytes], { type }), name);
  const response = await fetch(url + "/api/fechamento/analisar-lote", {
    method: "POST",
    body: f,
  });
  const body = await response.json();
  assert.equal(response.status, 202, JSON.stringify(body));
  return body;
}
async function finish(id) {
  const deadline = Date.now() + 60000;
  while (Date.now() < deadline) {
    const r = await fetch(url + "/api/fechamento/lotes/" + id);
    const b = await r.json();
    assert.equal(r.status, 200);
    if (b.status !== "processing") return b;
    await new Promise((r) => setTimeout(r, 80));
  }
  throw Error("Timeout de lote no teste.");
}
try {
  const files = ["01", "02", "03"].map((r) => [
    `caixa-${r}.pdf`,
    pdf([...header(r), ...amounts]),
  ]);
  await fs.mkdir("tests/output", { recursive: true });
  for (const [name, bytes] of files)
    await fs.writeFile("tests/output/lote-" + name, Buffer.from(bytes));
  let result = await finish((await batch(files)).id);
  assert.equal(result.documents.length, 3);
  assert.equal(result.closings.length, 3);
  assert.ok(
    result.closings.every(
      (c) =>
        c.calculation.expected === 105000 && c.calculation.difference === 0,
    ),
  );
  assert.equal(result.summary.validatedCount, 0);
  assert.equal(result.summary.netDifferenceCents, null);
  console.log(
    "OK: três PDFs reais, três caixas, origem e cálculo separados, revisão obrigatória.",
  );
  const tenFiles = Array.from({ length: 10 }, (_, i) => {
    const register = String(i + 1).padStart(2, "0");
    return [
      `dez-caixas-${register}.pdf`,
      pdf([...header(register), ...amounts]),
    ];
  });
  const ten = await finish((await batch(tenFiles)).id);
  assert.equal(ten.documents.length, 10);
  assert.equal(ten.closings.length, 10);
  assert.ok(ten.closings.every((c) => c.calculation.expected === 105000));
  console.log(
    "OK: dez PDFs aceitos e processados pela fila, sem mistura entre dez fechamentos.",
  );
  result = await finish((await batch([files[0], files[0]])).id);
  assert.equal(
    result.documents.filter((d) => d.status === "duplicate").length,
    1,
  );
  assert.equal(result.closings.length, 1);
  assert.equal(result.closings[0].fields.sales.value, 100000);
  console.log("OK: hash SHA-256 impede documento repetido.");
  const complement = [
    ["vendas.pdf", pdf([...header(), ...amounts.slice(0, 2)])],
    ["movimentos.pdf", pdf([...header(), ...amounts.slice(2, 6)])],
    ["conferencia.pdf", pdf([...header(), amounts[6]])],
  ];
  result = await finish((await batch(complement)).id);
  assert.equal(result.closings.length, 1);
  assert.equal(result.closings[0].calculation.difference, 0);
  assert.equal(result.closings[0].documentIds.length, 3);
  console.log(
    "OK: documentos complementares agrupados por identidade e referência confiáveis.",
  );
  for (const headers of [
    [header("01", "Ana"), header("01", "Estefane")],
    [
      header("01", "Estefane", "19/10/2026"),
      header("01", "Estefane", "20/10/2026"),
    ],
  ]) {
    result = await finish(
      (
        await batch(
          headers.map((h, i) => [
            "separado-" + i + ".pdf",
            pdf([...h, ...amounts]),
          ]),
        )
      ).id,
    );
    assert.equal(result.closings.length, 2);
    assert.ok(
      result.closings.every((c) => c.fields.withdrawals.value === 10000),
    );
  }
  console.log(
    "OK: PDFs de operadores distintos e PDFs da mesma operadora em datas distintas permanecem separados.",
  );
  result = await finish(
    (
      await batch([
        ["sem-contado.pdf", pdf([...header(), ...amounts.slice(0, -1)])],
      ])
    ).id,
  );
  assert.equal(result.closings[0].fields.counted.value, null);
  assert.equal(result.closings[0].audit.canConfirm, false);
  assert.equal(result.closings[0].calculation.difference, null);
  result = await finish(
    (
      await batch([
        [
          "liquido.pdf",
          pdf([
            ...header(),
            ...amounts,
            "Cancelamentos ja descontados no total liquido: 50,00",
          ]),
        ],
      ])
    ).id,
  );
  assert.equal(result.closings[0].rules.cancellationTreatment, "included");
  assert.equal(result.closings[0].calculation.expected, 105000);
  console.log(
    "OK: contado ausente impede finalizar; cancelamento incluído não é descontado novamente.",
  );
  result = await finish(
    (
      await batch([
        files[0],
        files[1],
        ["corrompido.pdf", "%PDF-arquivo quebrado"],
      ])
    ).id,
  );
  assert.equal(result.status, "partial");
  assert.equal(result.documents.filter((d) => d.status === "error").length, 1);
  assert.equal(result.closings.length, 2);
  assert.equal(result.summary.partial, true);
  console.log("OK: um PDF corrompido não interrompe os dois válidos.");
  const pending = await batch(files);
  const cancelled = await fetch(url + "/api/fechamento/lotes/" + pending.id, {
    method: "DELETE",
  });
  assert.equal(cancelled.status, 202);
  result = await finish(pending.id);
  assert.ok(result.documents.some((d) => d.status === "cancelled"));
  assert.equal((await fetch(url + "/api/health")).status, 200);
  console.log("OK: cancelamento real, fila liberada e saúde preservada.");
  const form = new FormData();
  for (let i = 0; i < 11; i++)
    form.append(
      "pdfs",
      new Blob([files[0][1]], { type: "application/pdf" }),
      i + ".pdf",
    );
  assert.equal(
    (
      await fetch(url + "/api/fechamento/analisar-lote", {
        method: "POST",
        body: form,
      })
    ).status,
    400,
  );
  assert.equal(
    (await fetch(url + "/api/fechamento/lotes/inexistente")).status,
    404,
  );
  console.log("OK: limite de quantidade e lote inexistente.");
  const large = new Uint8Array(11 * 1024 * 1024);
  large.set(new TextEncoder().encode("%PDF-"));
  result = await finish((await batch([files[0], ["grande.pdf", large]])).id);
  assert.equal(result.documents[1].status, "error");
  assert.equal(result.closings.length, 1);
  const locked = new jsPDF({
    encryption: {
      userPassword: "teste",
      ownerPassword: "dono",
      userPermissions: ["print"],
    },
  });
  locked.text("FICTICIO", 10, 10);
  result = await finish(
    (await batch([files[0], ["senha.pdf", locked.output("arraybuffer")]])).id,
  );
  assert.equal(result.documents[1].status, "error");
  assert.ok(result.documents[1].error.includes("senha"));
  assert.equal(result.closings.length, 1);
  console.log(
    "OK: arquivo acima do limite e PDF com senha não interrompem o outro documento do lote.",
  );
  const previous = process.env.ACCESS_BEARER_TOKEN;
  process.env.ACCESS_BEARER_TOKEN = "token-ficticio-do-teste";
  try {
    assert.equal((await fetch(url + "/api/health")).status, 401);
    assert.equal(
      (
        await fetch(url + "/api/health", {
          headers: { Authorization: "Bearer token-ficticio-do-teste" },
        })
      ).status,
      200,
    );
  } finally {
    if (previous === undefined) delete process.env.ACCESS_BEARER_TOKEN;
    else process.env.ACCESS_BEARER_TOKEN = previous;
  }
  console.log(
    "OK: API não confia apenas em Origin quando a validação de acesso está configurada.",
  );
} finally {
  await stopBatches();
  server.close();
}
