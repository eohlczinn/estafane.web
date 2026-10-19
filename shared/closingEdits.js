import { movementTotals, movementTypes } from "./movements.js";
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
