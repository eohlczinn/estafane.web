import { emptyFields } from "./fields.js";
import { movementTotals, movementTypes } from "./movements.js";
import { reconcile } from "./reconciliation.js";
import { mergeTransactions } from "./transactionMerge.js";
const norm = (v) =>
  String(v ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
const identityKeys = ["market", "operator", "register", "date"];
const val = (doc, k) => doc.fields?.[k]?.value;
export function compareDocuments(a, b) {
  if (a.hash && a.hash === b.hash && !(a.partOf && b.partOf && a.id !== b.id))
    return "duplicate";
  if (
    identityKeys.some(
      (k) => val(a, k) && val(b, k) && norm(val(a, k)) !== norm(val(b, k)),
    )
  )
    return "independent";
  if (identityKeys.every((k) => val(a, k) && val(b, k))) {
    const refA = a.identity?.closingReference,
      refB = b.identity?.closingReference;
    if (refA && refB)
      return norm(refA) === norm(refB) ? "compatible" : "independent";
    const shiftA = val(a, "shift"),
      shiftB = val(b, "shift");
    if (shiftA && shiftB) {
      if (norm(shiftA) !== norm(shiftB)) return "independent";
      // A clock time alone does not prove an operating period.
      if (!/^\d{2}:\d{2}(?::\d{2})?$/.test(norm(shiftA))) return "compatible";
    }
  }
  return "uncertain";
}
export function mergeDocuments(documents, id) {
  const receiptMerge = mergeTransactions(documents);
  const fields = emptyFields(),
    movements = [],
    mergeIssues = [...receiptMerge.issues],
    declarations = documents.flatMap((d) => d.declarations || []);
  for (const key of Object.keys(fields)) {
    const candidates = documents.flatMap((d) => {
      const f = d.fields[key];
      return f?.status === "ambiguous"
        ? f.candidates || []
        : f?.value != null
          ? [f]
          : [];
    });
    if (!candidates.length) continue;
    const distinct = [
      ...new Set(
        candidates.map((f) =>
          typeof f.value === "string" ? norm(f.value) : f.value,
        ),
      ),
    ];
    if (distinct.length === 1)
      fields[key] = {
        ...candidates[0],
        sources: candidates
          .flatMap((f) => f.sources || [f.source])
          .filter(Boolean),
      };
    else
      fields[key] = {
        ...candidates[0],
        value: null,
        status: "ambiguous",
        candidates,
      };
  }
  const seen = new Map();
  for (const doc of documents)
    for (const original of doc.movements || []) {
      const m = { ...original };
      // Opening is a snapshot, not a stream of additive entries across documents.
      const key = m.operationId
        ? `${m.type}:${m.operationId}`
        : m.type === "opening"
          ? `opening:${m.amountCents}`
          : null;
      if (key && seen.has(key)) {
        const previous = seen.get(key);
        if (previous.amountCents === m.amountCents) {
          m.duplicateOf = previous.id;
          m.status = "excluded";
        } else {
          m.status = "conflict";
          previous.status = "conflict";
        }
      } else if (key) seen.set(key, m);
      movements.push(m);
    }
  for (const [type, spec] of Object.entries(movementTypes)) {
    const items = movements.filter((m) => m.type === type && !m.duplicateOf),
      origins = new Set(items.map((m) => m.documentId));
    if (
      origins.size > 1 &&
      items.some((m) => !m.operationId) &&
      type !== "opening"
    )
      mergeIssues.push({
        id: `overlap:${type}`,
        field: spec.field,
        message: `${spec.label}: há itens de documentos diferentes sem identificadores suficientes. Exclua itens repetidos ou confirme que são operações distintas.`,
        resolvable: true,
      });
  }
  const totals = movementTotals(movements);
  for (const [field, total] of Object.entries(totals)) {
    const first = movements.find(
      (m) => movementTypes[m.type]?.field === field && !m.duplicateOf,
    );
    fields[field] = {
      ...fields[field],
      value: total,
      status: "recognized",
      source: {
        ...first.source,
        profile: "soma-movimentacoes",
        movementIds: movements
          .filter(
            (m) => movementTypes[m.type]?.field === field && !m.duplicateOf,
          )
          .map((m) => m.id),
      },
      original: first.source.text,
    };
  }
  // Reconcile totals-only documents against item documents without adding them again.
  for (const key of Object.keys(fields))
    if (totals[key] == null) {
      const ds = declarations.filter((d) => d.field === key),
        values = new Set(ds.map((d) => d.value));
      if (values.size > 1)
        fields[key] = {
          ...fields[key],
          value: null,
          status: "ambiguous",
          candidates: ds.map((d) => ({
            value: d.value,
            source: d.source,
            original: d.source.text,
          })),
        };
    }
  const rules = {
    automatic: true,
    confirmed: true,
    cashBasis: fields.netCash.value != null ? "net" : "gross",
  };
  for (const key of [
    "cancellationTreatment",
    "reversalTreatment",
    "refundTreatment",
    "voucherIncludedInOther",
  ]) {
    const values = [
      ...new Set(documents.map((d) => d.rules?.[key]).filter((v) => v != null)),
    ];
    rules[key] = values.length === 1 ? values[0] : null;
    if (values.length > 1)
      mergeIssues.push({
        id: `rule:${key}`,
        message: "Documentos divergem no tratamento financeiro: " + key,
        resolvable: true,
      });
  }
  const closing = {
    id,
    documentIds: documents.map((d) => d.id),
    documents: documents.map(({ id, filename, hash, identity }) => ({
      id,
      filename,
      hash,
      identity,
    })),
    fields,
    movements,
    declarations,
    rules,
    unparsedLines: documents.flatMap((d) => d.unparsedLines || []),
    extractionIssues: documents.flatMap((d) => d.extractionIssues || []),
    mergeIssues,
    pages: documents.flatMap((d) =>
      d.pages.map((p) => ({ ...p, documentId: d.id, filename: d.filename })),
    ),
    warnings: documents.flatMap((d) => d.warnings || []),
    transactions: receiptMerge.transactions,
    normalizationNotes: [
      ...documents.flatMap((d) => d.normalizationNotes || []),
      ...receiptMerge.notes,
    ],
    inventory: {
      version: 1,
      detected: documents.some((d) => d.inventory?.detected),
      items: documents.flatMap((d) => d.inventory?.items || []),
      issues: documents.flatMap((d) => d.inventory?.issues || []),
    },
    resolutions: {},
    history: [],
    notes: "",
    reviewed: false,
    confirmed: false,
  };
  closing.audit = reconcile(closing);
  closing.calculation = closing.audit.calculation;
  closing.status = closing.audit.status;
  return closing;
}
export function groupDocuments(
  documents,
  { autoGroup = true, relations = {} } = {},
) {
  const groups = [],
    suggestions = [];
  const ready = documents.filter(
    (d) =>
      d.fields &&
      !d.container &&
      d.documentKind !== "inventory" &&
      !["error", "cancelled", "duplicate"].includes(d.status),
  );
  for (const doc of ready) {
    const match = groups.find(
      (g) =>
        autoGroup &&
        g.every((other) => compareDocuments(doc, other) === "compatible"),
    );
    if (match) match.push(doc);
    else groups.push([doc]);
  }
  const closings = groups.map((g) => mergeDocuments(g, "closing-" + g[0].id));
  for (let i = 0; i < groups.length; i++)
    for (let j = i + 1; j < groups.length; j++) {
      const relation = compareDocuments(groups[i][0], groups[j][0]),
        pair = [groups[i][0].id, groups[j][0].id].sort().join("|");
      if (relation !== "independent" && !relations[pair]) {
        const suggestion = {
          id: `group:${pair}`,
          pair,
          closingIds: [closings[i].id, closings[j].id],
          message:
            "Confirme se estes documentos são fechamentos independentes ou complementares. Os identificadores não permitem somar com segurança.",
        };
        suggestions.push(suggestion);
        for (const c of [closings[i], closings[j]]) {
          c.mergeIssues.push(suggestion);
          c.audit = reconcile(c);
          c.status = c.audit.status;
          c.calculation = c.audit.calculation;
        }
      }
    }
  return { closings, suggestions };
}
export function resolveGroupingDecision(batch, suggestion, combine) {
  const selected = batch.closings.filter((c) =>
    suggestion.closingIds.includes(c.id),
  );
  if (selected.length !== 2)
    throw Error("A associação mudou. Confira a lista novamente.");
  if (
    selected.some(
      (c) => c.confirmed || c.history.some((h) => h.kind !== "manual_grouping"),
    )
  )
    throw Error(
      "Resolva o agrupamento antes das correções ou envie os documentos novamente.",
    );
  const target = selected[0].id;
  let closings = combine
    ? [
        ...batch.closings.filter((c) => !suggestion.closingIds.includes(c.id)),
        {
          ...mergeDocuments(
            batch.documents.filter((d) =>
              selected.some((c) => c.documentIds.includes(d.id)),
            ),
            target,
          ),
          history: [
            {
              kind: "manual_grouping",
              documentIds: selected.flatMap((c) => c.documentIds),
              at: new Date().toISOString(),
            },
          ],
        },
      ]
    : batch.closings;
  const suggestions = [],
    seen = new Set();
  for (const original of batch.suggestions.filter(
    (s) => s.id !== suggestion.id,
  )) {
    const closingIds = [
      ...new Set(
        original.closingIds.map((id) =>
          combine && suggestion.closingIds.includes(id) ? target : id,
        ),
      ),
    ];
    if (closingIds.length < 2) continue;
    const pair = [...closingIds].sort().join("|");
    if (seen.has(pair)) continue;
    seen.add(pair);
    suggestions.push({ ...original, id: "group:" + pair, closingIds });
  }
  closings = closings.map((c) => {
    const next = {
      ...c,
      mergeIssues: [
        ...c.mergeIssues.filter((i) => !i.id.startsWith("group:")),
        ...suggestions.filter((s) => s.closingIds.includes(c.id)),
      ],
    };
    next.audit = reconcile(next);
    next.status = next.audit.status;
    next.calculation = next.audit.calculation;
    return next;
  });
  return { ...batch, closings, suggestions };
}
