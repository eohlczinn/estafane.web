import { moneyRules, normalize } from "./parserRules.js";
import { rowCells } from "./documentStructure.js";
import { financialAmountTokens } from "./financialObservations.js";

const QUANTITY_SCALE = 1_000_000;
const quantityFields = [
  "opening",
  "entries",
  "exits",
  "expected",
  "counted",
  "quantity",
];
const labels = {
  product: /^(?:produto|mercadoria|item|descricao do produto|nome do produto)$/,
  opening:
    /^(?:estoque inicial|saldo inicial|quantidade inicial|qtd inicial|inicial)$/,
  entries: /^(?:entradas?|recebimentos?|reposicoes|quantidade de entradas?)$/,
  exits: /^(?:saidas?|retiradas?|quantidade de saidas?)$/,
  expected:
    /^(?:estoque esperado|saldo esperado|estoque teorico|saldo teorico|saldo calculado|quantidade esperada)$/,
  counted:
    /^(?:estoque contado|estoque fisico|saldo fisico|quantidade contada|qtd contada|contagem fisica|contagem|contado|contada)$/,
  quantity: /^(?:quantidade|qtd\.?|qtdade|estoque atual)$/,
  unit: /^(?:unidade|unid\.?|un\.?|medida|unidade de medida)$/,
};
const stockHeading =
  /^(?:(?:\d+\s*[|.)-]\s*)?)(?:controle de |movimentacao de |relatorio de |conferencia de |contagem de |inventario de )?(?:estoque|inventario|produtos em estoque)(?:\s*[-|:]\s*[a-z ]+)?$/;
const financialHeading =
  /\b(?:vendas por forma de pagamento|resumo por forma de pagamento|movimentacao do dinheiro|movimentacoes de caixa|fechamento de caixa|cupons de venda|resumo financeiro|formas? de pagamento)\b/;
const unitPattern =
  /\s*(?:\((un(?:id(?:ade)?s?)?|und|kg|g|l|ml|litros?|pecas?|pc|pct|cx)\)|\b(un(?:id(?:ade)?s?)?|und|kg|g|l|ml|litros?|pecas?|pc|pct|cx))\.?\s*$/i;
const currencyPattern = /(?:r\s*\$|brl|us\s*\$|\$|€|£)/i;

export const inventorySourceKey = (source) =>
  `${source.sheet || ""}:${source.page || 1}:${source.line || 1}`;

function header(text) {
  const value = normalize(text)
    .replace(/\s*\([^)]*\)\s*$/, "")
    .trim();
  const field = Object.entries(labels).find(([, expression]) =>
    expression.test(value),
  )?.[0];
  // A column denominated in currency is valuation, never a unit quantity.
  return field &&
    (!quantityFields.includes(field) || !currencyPattern.test(text))
    ? field
    : null;
}

function cellsFor(row) {
  if (row.cells) return rowCells(row);
  // Preserve empty columns. A missing entry is not a zero or a shifted column.
  return String(row.text || "")
    .split(row.text?.includes("\t") ? /\t/ : / {2,}/)
    .map((text) => ({ text }));
}

function quantity(cell) {
  const text = String(cell?.text ?? "").trim();
  if (
    !text ||
    /^(?:[-—–]|n\/?a|nao informado|nao contado|pendente)$/i.test(
      normalize(text),
    )
  )
    return { value: null, unit: null };
  if (cell?.unsafe)
    return {
      value: null,
      unit: null,
      error: "Quantidade depende de fórmula não verificada.",
    };
  if (currencyPattern.test(text))
    return {
      value: null,
      unit: null,
      error: "Valor monetário não foi convertido em quantidade de estoque.",
    };
  const warning = cell?.formula
    ? "Quantidade usa resultado de fórmula armazenado no arquivo; confira se está atualizado."
    : null;
  const unit = text.match(unitPattern)?.slice(1).find(Boolean) || null;
  if (cell?.numeric && typeof cell.raw === "number") {
    const value = cell.raw;
    if (
      !Number.isFinite(value) ||
      value < 0 ||
      value !== Number(value.toFixed(6)) ||
      !Number.isSafeInteger(Math.round(value * QUANTITY_SCALE))
    )
      return {
        value: null,
        unit,
        error:
          "Quantidade inválida ou fora do limite de precisão (seis casas decimais).",
      };
    return { value, unit, warning };
  }
  const plain = (unit ? text.replace(unitPattern, "") : text).replace(
    /\s/g,
    "",
  );
  if (!/^(?:\d+|\d{1,3}(?:\.\d{3})+)(?:,\d{1,6})?$/.test(plain))
    return {
      value: null,
      unit,
      error: "Quantidade inválida; use número brasileiro sem símbolo de moeda.",
    };
  const [whole, fraction = ""] = plain.replace(/\./g, "").split(",");
  const scaled =
    Number(whole) * QUANTITY_SCALE + Number(fraction.padEnd(6, "0"));
  if (!Number.isSafeInteger(scaled))
    return { value: null, unit, error: "Quantidade fora do limite permitido." };
  return { value: scaled / QUANTITY_SCALE, unit, warning };
}

function location(page, row, documentId, cell) {
  return {
    documentId,
    page: page.page || 1,
    line: row.line || 1,
    ...(page.sheet ? { sheet: page.sheet } : {}),
    ...(cell?.cell ? { cell: cell.cell } : {}),
    ...(row.bounds ? { bounds: row.bounds } : {}),
    text: row.originalText || row.text || "",
    ocr: !!page.ocr,
    hidden: !!row.hidden,
    ...(cell?.formula ? { formula: true } : {}),
  };
}

function finish(item) {
  if (item.source.ocr)
    item.issues.push(
      "Quantidades obtidas por OCR exigem conferência com a imagem original.",
    );
  if (item.incompatibleUnits) {
    item.declaredExpected = item.expected;
    item.expected = null;
    item.difference = null;
    item.expectedBasis = null;
    item.unit = null;
    item.status = "review_required";
    return item;
  }
  const complete = [item.opening, item.entries, item.exits].every(
    (value) => value != null,
  );
  const declared = item.expected;
  item.expectedBasis = declared != null ? "declared" : null;
  if (complete) {
    const scaled =
      Math.round(item.opening * QUANTITY_SCALE) +
      Math.round(item.entries * QUANTITY_SCALE) -
      Math.round(item.exits * QUANTITY_SCALE);
    if (Number.isSafeInteger(scaled)) {
      const computed = scaled / QUANTITY_SCALE;
      if (declared != null && declared !== computed)
        item.issues.push(
          `Estoque esperado declarado (${declared}) difere do cálculo de entradas e saídas (${computed}).`,
        );
      item.declaredExpected = declared;
      item.expected = computed;
      item.expectedBasis = "calculated";
    } else
      item.issues.push("O cálculo do estoque ultrapassa o limite permitido.");
  }
  if (item.expected == null)
    item.issues.push(
      "Faltam estoque inicial, entradas ou saídas para calcular o estoque esperado.",
    );
  if (item.counted == null)
    item.issues.push("Contagem física de estoque não informada.");
  if (item.expected != null && item.counted != null) {
    const difference =
      Math.round(item.counted * QUANTITY_SCALE) -
      Math.round(item.expected * QUANTITY_SCALE);
    if (Number.isSafeInteger(difference))
      item.difference = difference / QUANTITY_SCALE;
    else
      item.issues.push("A diferença do estoque ultrapassa o limite permitido.");
  }
  item.status = item.issues.length
    ? "review_required"
    : item.difference === 0
      ? "balanced"
      : item.difference < 0
        ? "short"
        : "over";
  return item;
}

function emptyItem(product, source) {
  return {
    product: product.trim().slice(0, 240),
    opening: null,
    entries: null,
    exits: null,
    expected: null,
    counted: null,
    difference: null,
    quantity: null,
    unit: null,
    source,
    sources: {},
    units: {},
    issues: [],
  };
}

function canonicalUnit(value) {
  const unit = normalize(value).replace(/\./g, "");
  if (/^(?:un|und|unid|unidade|unidades|peca|pecas|pc)$/.test(unit))
    return "un";
  if (/^(?:l|litro|litros)$/.test(unit)) return "l";
  return unit;
}

function assignUnit(item, unit, field) {
  if (!unit) return;
  const normalized = canonicalUnit(unit);
  item.units[field] = normalized;
  if (item.unit && canonicalUnit(item.unit) !== normalized) {
    if (!item.incompatibleUnits)
      item.issues.push(
        "Unidades diferentes no mesmo produto; confira a conversão antes de usar o saldo.",
      );
    item.incompatibleUnits = true;
  } else item.unit = normalized;
}

function assign(item, field, cell, source, headerUnit = null) {
  if (field === "unit") {
    assignUnit(
      item,
      String(cell?.text || "")
        .trim()
        .slice(0, 40),
      field,
    );
    return;
  }
  const parsed = quantity(cell);
  item.sources[field] = source;
  if (parsed.error) item.issues.push(`${field}: ${parsed.error}`);
  if (parsed.warning) item.issues.push(`${field}: ${parsed.warning}`);
  if (
    item[field] != null &&
    parsed.value != null &&
    item[field] !== parsed.value
  )
    item.issues.push(`Há mais de uma quantidade para ${field}.`);
  else if (parsed.value != null) item[field] = parsed.value;
  const unit = parsed.unit || headerUnit;
  if (unit) {
    assignUnit(item, unit, field);
  }
}

/**
 * Read quantities separately from cash. The caller should exclude the rows in
 * excludedSources from financial interpretation while retaining original pages
 * for provenance. No quantity is ever promoted to a monetary field.
 */
export function parseInventory(pages, { documentId = "document" } = {}) {
  const items = [],
    issues = [],
    excluded = new Map(),
    sections = [],
    totals = [];
  let continuation = null,
    block = null;
  const flush = () => {
    if (block) {
      items.push(finish(block));
      block = null;
    }
  };
  const exclude = (source) => excluded.set(inventorySourceKey(source), source);
  for (const page of pages) {
    const previous =
      !page.sheet && continuation?.page === page.page - 1 ? continuation : null;
    let columns = previous?.columns || null,
      stockContext = !!previous;
    const rows =
      page.lines ||
      String(page.text || "")
        .split(/\r?\n/)
        .map((text, i) => ({ text, line: i + 1 }));
    for (const row of rows) {
      const text = String(row.text || ""),
        normalized = normalize(text).replace(/\t/g, " "),
        source = location(page, row, documentId);
      if (stockHeading.test(normalized)) {
        flush();
        stockContext = true;
        columns = null;
        sections.push(source);
        exclude(source);
        continue;
      }
      if (financialHeading.test(normalized)) {
        flush();
        stockContext = false;
        columns = null;
        continue;
      }
      const cells = cellsFor(row),
        mapping = cells.map((c) => header(String(c.text || "")));
      // A short, explicitly labelled monetary pair after a wider stock table
      // starts another section even when the document omits its heading. Do
      // not reinterpret a complete product row, or a two-column stock table.
      if (
        columns &&
        columns.mapping.length > 2 &&
        cells.filter((cell) => String(cell.text || "").trim()).length <= 2 &&
        Object.values(moneyRules).some(
          (labelPattern) =>
            financialAmountTokens(text, { labelPattern }).length === 1,
        )
      ) {
        flush();
        stockContext = false;
        columns = null;
        continue;
      }
      const productColumn = mapping.indexOf("product");
      const explicitQuantities = mapping.filter(
        (field) =>
          field && quantityFields.includes(field) && field !== "quantity",
      );
      if (
        productColumn >= 0 &&
        (explicitQuantities.length ||
          (stockContext && mapping.includes("quantity")))
      ) {
        flush();
        columns = {
          mapping,
          productColumn,
          units: cells.map(
            (c) =>
              String(c.text || "")
                .match(unitPattern)
                ?.slice(1)
                .find(Boolean) || null,
          ),
        };
        stockContext = true;
        exclude(source);
        continue;
      }
      const pair = text.match(/^\s*([^:=\t]+)\s*[:=]\s*(.*?)\s*$/);
      if (stockContext && pair) {
        const field = header(pair[1]);
        if (field === "product" && pair[2].trim()) {
          flush();
          block = emptyItem(pair[2], source);
          exclude(source);
          continue;
        }
        if (block && field && field !== "product") {
          assign(block, field, { text: pair[2] }, source);
          exclude(source);
          continue;
        }
      }
      if (!columns || cells.length < 2) continue;
      const product = String(cells[columns.productColumn]?.text || "").trim();
      const hasData = columns.mapping.some(
        (field, index) =>
          quantityFields.includes(field) &&
          String(cells[index]?.text || "").trim(),
      );
      if (!hasData) continue;
      if (!product) {
        issues.push({
          code: "inventory:product",
          message: "Linha de estoque sem identificação do produto.",
          source,
        });
        exclude(source);
        continue;
      }
      if (/^(?:total|totais|saldo total)\b/i.test(normalize(product))) {
        totals.push({
          label: product,
          source,
          values: Object.fromEntries(
            columns.mapping.flatMap((field, index) =>
              field && quantityFields.includes(field)
                ? [[field, quantity(cells[index]).value]]
                : [],
            ),
          ),
        });
        exclude(source);
        continue;
      }
      const item = emptyItem(
        product,
        location(page, row, documentId, cells[columns.productColumn]),
      );
      for (const [index, field] of columns.mapping.entries()) {
        if (!field || field === "product") continue;
        assign(
          item,
          field,
          cells[index],
          location(page, row, documentId, cells[index]),
          columns.units[index],
        );
      }
      items.push(finish(item));
      exclude(source);
    }
    // Continuations inherit only an explicit table, not arbitrary narrative text.
    continuation = !page.sheet && columns ? { page: page.page, columns } : null;
    flush();
  }
  if (sections.length && !items.length)
    issues.push({
      code: "inventory:unstructured",
      message:
        "Seção de estoque identificada sem tabela ou produto com quantidades suficientes.",
      source: sections[0],
    });
  return {
    version: 1,
    detected: sections.length > 0 || items.length > 0,
    items,
    issues,
    sections,
    totals,
    excludedSources: [...excluded.values()],
  };
}
