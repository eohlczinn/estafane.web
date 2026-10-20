import { calculate } from "./calculation.js";
import { allFields } from "./fields.js";
import { movementTotals, movementTypes } from "./movements.js";
export function reconcile(
  closing,
  { reviewed = closing.reviewed || false } = {},
) {
  const {
    fields,
    rules = {},
    movements = [],
    declarations = [],
    unparsedLines = [],
    resolutions = {},
  } = closing;
  const calculation = calculate(fields, rules),
    issues = [];
  const add = (code, message, extra = {}) =>
    issues.push({ id: code, code, severity: "blocking", message, ...extra });
  for (const key of calculation.pending)
    add(`missing:${key}`, `Informe ${allFields[key] || key}.`, {
      field: key,
      kind: "incomplete",
    });
  for (const [i, message] of calculation.warnings.entries())
    add(`calculation:${i}`, message, { kind: "conflict" });
  if (rules.cashBasis === "net") {
    const gross = calculate(fields, { ...rules, cashBasis: "gross" });
    if (
      gross.expected != null &&
      gross.expected !== calculation.expected &&
      !gross.warnings.some((w) => w.startsWith("Esclareça")) &&
      !resolutions["net:reconciliation"]?.reason?.trim()
    )
      add(
        "net:reconciliation",
        `O saldo líquido declarado (${calculation.expected} centavos) diverge da fórmula bruta completa (${gross.expected} centavos). Corrija os campos ou esclareça a movimentação adicional que explica essa diferença.`,
        { kind: "conflict", resolvable: true, field: "netCash" },
      );
  }
  for (const key of ["market", "operator", "register", "date"])
    if (!fields[key]?.value?.trim() || fields[key]?.status === "ambiguous")
      add(`identity:${key}`, `Confira ${allFields[key]}.`, {
        field: key,
        kind: "incomplete",
      });
  if (fields.date?.value) {
    const match = fields.date.value.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
    const day = match
      ? new Date(Date.UTC(+match[3], +match[2] - 1, +match[1]))
      : null;
    if (
      !match ||
      day.getUTCDate() !== +match[1] ||
      day.getUTCMonth() !== +match[2] - 1
    )
      add("invalid:date", "Informe uma data válida no formato DD/MM/AAAA.", {
        field: "date",
        kind: "conflict",
      });
  }
  for (const key of Object.keys(fields)) {
    const f = fields[key];
    if (
      f.value != null &&
      !f.source &&
      !["manual", "default"].includes(f.status)
    )
      add(
        `source:${key}`,
        `Origem ou confirmação explícita ausente em ${allFields[key]}.`,
        { field: key },
      );
  }
  const totals = movementTotals(movements);
  for (const [key, total] of Object.entries(totals)) {
    const values = declarations.filter((d) => d.field === key);
    for (const d of values) {
      const scoped = movements
        .filter((m) => m.source.documentId === d.source.documentId)
        .map((m) =>
          m.duplicateOf ? { ...m, duplicateOf: null, status: "recognized" } : m,
        );
      const scopedTotal = movementTotals(scoped)[key] ?? total;
      if (d.value !== scopedTotal && fields[key].status !== "manual")
        add(
          `subtotal:${key}:${d.source.documentId}:${d.source.page}:${d.source.line}`,
          `Itens de ${allFields[key]} somam ${scopedTotal} centavos no escopo do subtotal, mas ele declara ${d.value}.`,
          { field: key, source: d.source, kind: "conflict" },
        );
    }
  }
  const seen = new Map();
  for (const m of movements) {
    if (m.status === "excluded" || m.duplicateOf) continue;
    if (m.operationId) {
      const key = `${m.type}:${m.operationId}`;
      if (seen.has(key))
        add(
          `duplicate:${m.id}`,
          `Identificador repetido em ${movementTypes[m.type].label}: ${m.operationId}.`,
          { movementId: m.id, kind: "conflict" },
        );
      else seen.set(key, m);
    }
    if (m.status === "conflict")
      add(`movement:${m.id}`, "Movimentação contraditória entre documentos.", {
        movementId: m.id,
        kind: "conflict",
      });
  }
  for (const line of unparsedLines)
    if (!resolutions[line.id]?.reason?.trim())
      add(line.id, "Linha financeira não interpretada: " + line.text, {
        source: line.source,
        kind: "review",
        resolvable: true,
      });
  for (const conflict of closing.mergeIssues || [])
    if (
      !resolutions[conflict.id]?.reason?.trim() &&
      !(conflict.field && fields[conflict.field]?.status === "manual")
    )
      add(conflict.id, conflict.message, { ...conflict, kind: "conflict" });
  for (const key of ["cancellations", "reversals"]) {
    const policy =
      key === "cancellations" ? "cancellationTreatment" : "reversalTreatment";
    if (
      rules[policy] === "cash_out" &&
      rules.refundTreatment !== "included" &&
      fields.refunds?.value > 0 &&
      !resolutions[`separate:${key}`]?.reason
    )
      add(
        `separate:${key}`,
        `Confirme se ${allFields[key]} representa saída distinta das devoluções, evitando desconto duplicado.`,
        { resolvable: true, kind: "review" },
      );
  }
  const status = issues.some((i) => i.kind === "conflict")
    ? "conflict"
    : issues.some((i) => i.kind === "incomplete")
      ? "incomplete"
      : issues.length || !reviewed
        ? "review_required"
        : "validated";
  const result = issues.length ? "pending" : calculation.result;
  return {
    status,
    issues,
    calculation: { ...calculation, result },
    canConfirm: !issues.length,
    reviewed,
  };
}
