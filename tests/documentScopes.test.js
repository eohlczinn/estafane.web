import { it, expect } from "vitest";
import {
  splitDocumentScopes,
  scopePartLabel,
} from "../server/services/documentScopes.js";
import { parsePages } from "../server/services/pdfParser.js";
import { batchSnapshot } from "../server/services/batchAnalyzer.js";

function report(page, reference = "CX01-2026-A", overrides = {}) {
  const identity = {
    market: "MERCADO FICTICIO",
    operator: "ANA",
    register: "01",
    date: "24/10/2026",
    shift: "MANHA 07:00-14:00",
    ...overrides,
  };
  return {
    page,
    text: `Mercado: ${identity.market}\nEXTRATO DE CAIXA ${reference}\nData: ${identity.date}\nOperadora: ${identity.operator}\nCaixa: ${identity.register}\nTurno: ${identity.shift}\nDocumento: ${reference}\nDinheiro: 100,00\nPIX: 20,00`,
  };
}
it("separa referências diferentes mesmo quando a operadora, data e caixa coincidem", () => {
  const { scopes } = splitDocumentScopes([
    report(2, "REF-001"),
    report(3, "REF-002"),
  ]);
  expect(scopes).toHaveLength(2);
  expect(scopes.map((s) => s.reference)).toEqual(["ref-001", "ref-002"]);
  expect(scopes.map((s) => s.pages.map((p) => p.page))).toEqual([[2], [3]]);
});
it("mantém continuação com a mesma referência e páginas adicionais sem novo cabeçalho", () => {
  const { scopes } = splitDocumentScopes([
    report(1),
    { page: 2, text: "Continuacao\nSangria 02: 20,00" },
    report(3),
  ]);
  expect(scopes).toHaveLength(1);
  expect(scopes[0].pages.map((p) => p.page)).toEqual([1, 2, 3]);
  expect(scopes[0].issues).toEqual([]);
});
it("preserva a origem de páginas intercaladas, e identidade contraditória fica bloqueada", () => {
  const a = report(1, "REF-1"),
    b = report(2, "REF-2"),
    continued = report(3, "REF-1");
  const first = splitDocumentScopes([a, b, continued]);
  expect(first.scopes.map((s) => s.pages.map((p) => p.page))).toEqual([
    [1, 3],
    [2],
  ]);
  const conflict = splitDocumentScopes([
    a,
    report(2, "REF-1", { operator: "OUTRA PESSOA" }),
  ]);
  expect(conflict.scopes).toHaveLength(2);
  expect(conflict.scopes.every((s) => s.issues.length > 0)).toBe(true);
});
it("capa, notas de auditoria e estoque são preservados fora dos movimentos financeiros", () => {
  const pages = [
    { page: 1, text: "MEGA TESTE DE FECHAMENTO DE CAIXA\nDados ficticios" },
    report(2),
    {
      page: 3,
      text: "NOTAS DE AUDITORIA DO LOTE\nExemplo ilustrativo: PIX: R$ 999,00",
    },
    {
      page: 4,
      text: "ESTOQUE\nDocumento: INV-001\nDescricao\tQuantidade\tValor\nCredito de celular\t5\t50,00",
    },
  ];
  const { scopes, contextPages } = splitDocumentScopes(pages);
  expect(scopes).toHaveLength(1);
  expect(scopes[0].pages.map((p) => p.page)).toEqual([2]);
  expect(contextPages.map((p) => p.contextKind)).toEqual([
    "cover",
    "audit_notes",
    "inventory",
  ]);
});
it("preserva o trecho financeiro quando estoque e caixa estão na mesma página", () => {
  const page = {
    page: 1,
    text: [
      "ESTOQUE",
      "Produto\tQuantidade\tUnidade",
      "Arroz\t10\tun",
      ...Array.from({ length: 15 }, () => "Descrição de mercadoria"),
      "RESUMO POR FORMA DE PAGAMENTO",
      "PIX: 500,00",
      "Crédito: 600,00",
      "Débito: 100,00",
    ].join("\n"),
  };
  const parsed = parsePages([page]);
  expect(parsed.inventory.detected).toBe(true);
  expect(parsed.fields.pix.value).toBe(50000);
  const split = splitDocumentScopes([page]);
  expect(split.contextPages).toEqual([]);
  expect(split.scopes).toHaveLength(1);
  expect(split.scopes[0].pages[0]).toBe(page);
});
it("prioriza documento explícito sobre título truncado pelo OCR e mantém trechos sem identidade separados", () => {
  const page = report(18, "FULL-2026-T17");
  page.text = page.text.replace(
    "EXTRATO DE CAIXA FULL-2026-T17",
    "EXTRATO DE CAIXA FULL-2026",
  );
  expect(splitDocumentScopes([page]).scopes[0].reference).toBe("full-2026-t17");
  const incomplete = { page: 19, text: "EXTRATO DE CAIXA\nDinheiro: 50,00" };
  const partition = splitDocumentScopes([report(1), incomplete]);
  expect(partition.scopes).toHaveLength(2);
  expect(partition.scopes[1].issues.length).toBeGreaterThan(0);
});
it("não mascara páginas independentes como abas, e não inventa intervalo para páginas intercaladas", () => {
  expect(scopePartLabel([{ page: 2 }])).toBe("página 2");
  expect(scopePartLabel([{ page: 2 }, { page: 3 }])).toBe("páginas 2–3");
  expect(scopePartLabel([{ page: 2 }, { page: 4 }])).toBe("páginas 2, 4");
  expect(scopePartLabel([{ page: 1, sheet: "Caixa A" }])).toBe("aba Caixa A");
});
it("expõe os fechamentos uma única vez e conserva metadados da fonte, estoque e contexto no lote", () => {
  const pages = [report(2, "REF-001"), report(3, "REF-002")];
  const inventory = {
    detected: true,
    items: [{ product: "Arroz", quantity: 10 }],
    issues: [],
  };
  const parts = pages.map((page, index) => ({
    id: `bundle:scope-${index + 1}`,
    ...parsePages([page], { documentId: `bundle:scope-${index + 1}` }),
    pages: [page],
    audit: { canConfirm: false },
  }));
  const doc = {
    id: "bundle",
    filename: "dois-caixas.pdf",
    hash: "a".repeat(64),
    status: "review_required",
    format: "pdf",
    container: true,
    documentKind: "closing_bundle",
    inventory,
    contextPages: [{ page: 1, text: "Capa", contextKind: "cover" }],
    parts,
    pages: [{ page: 1, text: "Capa" }, ...pages],
  };
  const snapshot = batchSnapshot({
    id: "test",
    finished: true,
    autoGroup: true,
    documents: [doc],
  });
  expect(snapshot.closings).toHaveLength(2);
  expect(snapshot.documents.map((d) => d.partOf)).toEqual(["bundle", "bundle"]);
  expect(snapshot.documents.every((d) => d.hash === doc.hash)).toBe(true);
  expect(snapshot.documents.every((d) => d.contextPages == null)).toBe(true);
  expect(snapshot.sourceDocuments).toHaveLength(1);
  expect(snapshot.sourceDocuments[0]).toMatchObject({
    id: "bundle",
    filename: doc.filename,
    partCount: 2,
    inventory,
    contextPages: doc.contextPages,
  });
  expect(snapshot.sourceDocuments[0]).not.toHaveProperty("pages");
  expect(snapshot.sourceDocuments[0]).not.toHaveProperty("parts");
});
