import { movementTotals, movementTypes } from "./movements.js";
import { moneyFields } from "./fields.js";
export function classifyUnknownLine(
  closing,
  id,
  field,
  value,
  reason,
  mode = "total",
) {
  const line = closing.unparsedLines.find((l) => l.id === id);
  if (
    !line ||
    !Object.hasOwn(moneyFields, field) ||
    !Number.isSafeInteger(value) ||
    Math.abs(value) > 1e12 ||
    reason.trim().length < 8
  )
    throw Error(
      "Confira a linha, a categoria, o valor e o motivo da correção.",
    );
  const at = new Date().toISOString();
  let next;
  if (mode === "movement") {
    const previousTotal = movementTotals(closing.movements)[field];
    if (closing.fields[field].value != null && (previousTotal == null || closing.fields[field].value !== previousTotal))
      throw Error("Já existe um total sem detalhamento suficiente ou corrigido manualmente. Confira a soma completa e use a opção de substituir o total para evitar contar duas vezes.");
    const type = Object.keys(movementTypes).find(
      (k) => movementTypes[k].field === field,
    );
    if (!type || value < 0)
      throw Error("Escolha uma movimentação e informe sua magnitude positiva.");
    const item = {
      id: id + ":manual",
      type,
      amountCents: value,
      direction: movementTypes[type].direction,
      description: line.text,
      documentId: line.source.documentId,
      source: line.source,
      status: "manual",
      operationId: null,
      effect: null,
    };
    const movements = [...closing.movements, item];
    next = editField(
      { ...closing, movements },
      field,
      movementTotals(movements)[field],
      "manual",
      at,
    );
  } else if (mode === "total")
    next = editField(closing, field, value, "manual", at);
  else throw Error("Tipo de correção inválido.");
  return {
    ...next,
    resolutions: {
      ...next.resolutions,
      [id]: { reason: reason.trim(), at, field, value, mode },
    },
    history: [
      ...next.history,
      {
        kind: "classification",
        id,
        field,
        value,
        mode,
        reason: reason.trim(),
        source: line.source,
        at,
      },
    ],
    profileCorrections:
      mode === "total"
        ? [
            ...(next.profileCorrections || []),
            { layoutKey: line.layoutKey, label: line.label, field },
          ]
        : next.profileCorrections,
  };
}
export function rememberChange(previous, next) {
  const keys = [
    "fields",
    "movements",
    "rules",
    "resolutions",
    "profileCorrections",
    "notes",
  ];
  const snapshot = Object.fromEntries(keys.map((k) => [k, previous[k]]));
  return {
    ...next,
    undoStack: [...(previous.undoStack || []), snapshot].slice(-30),
  };
}
export function undoChange(closing) {
  if (!closing.undoStack?.length) return closing;
  return {
    ...closing,
    ...closing.undoStack.at(-1),
    undoStack: closing.undoStack.slice(0, -1),
    confirmed: false,
    reviewed: false,
    history: [
      ...closing.history,
      {
        kind: "undo",
        reason: "Última alteração desfeita pela operadora",
        at: new Date().toISOString(),
      },
    ],
  };
}
export function editField(
  closing,
  key,
  value,
  status = "manual",
  at = new Date().toISOString(),
) {
  const previous = closing.fields[key];
  return {
    ...closing,
    fields: {
      ...closing.fields,
      [key]: {
        ...previous,
        value,
        status,
        review: false,
        history: [
          ...(previous.history || []),
          { previous: previous.value, value, at },
        ],
      },
    },
    rules:
      key === "netCash"
        ? { ...closing.rules, cashBasis: value == null ? "gross" : "net" }
        : closing.rules,
    history: [
      ...closing.history,
      { kind: "field", key, previous: previous.value, value, at },
    ],
    confirmed: false,
    reviewed: false,
  };
}
export function editMovement(
  closing,
  id,
  amountCents,
  excluded = false,
  at = new Date().toISOString(),
) {
  if (!Number.isSafeInteger(amountCents) || amountCents < 0)
    throw Error("Informe centavos positivos para a movimentação.");
  const original = closing.movements.find((m) => m.id === id);
  if (!original) throw Error("Movimentação não encontrada.");
  const movements = closing.movements.map((m) =>
    m.id === id
      ? {
          ...m,
          amountCents,
          status: excluded ? "excluded" : "manual",
          duplicateOf: excluded ? m.duplicateOf : null,
          history: [
            ...(m.history || []),
            { previous: m.amountCents, value: amountCents, excluded, at },
          ],
        }
      : m,
  );
  const key = movementTypes[original.type].field,
    total = movementTotals(movements)[key] ?? 0;
  const next = editField({ ...closing, movements }, key, total, "manual", at);
  return {
    ...next,
    history: [
      ...next.history,
      {
        kind: "movement",
        id,
        previous: original.amountCents,
        amountCents,
        excluded,
        at,
      },
    ],
  };
}
