// Values are magnitudes; direction is never encoded in the sign.
export const movementTypes = {
  withdrawal: { field: "withdrawals", direction: "out", label: "Sangria" },
  supply: { field: "supplies", direction: "in", label: "Suprimento" },
  expense: { field: "expenses", direction: "out", label: "Despesa autorizada" },
  opening: { field: "opening", direction: "in", label: "Fundo inicial" },
  cash_sale: { field: "cash", direction: "in", label: "Venda em dinheiro" },
  refund: {
    field: "refunds",
    direction: "out",
    label: "Devolução em dinheiro",
  },
  cancellation: {
    field: "cancellations",
    direction: "out",
    label: "Cancelamento",
  },
  reversal: { field: "reversals", direction: "out", label: "Estorno" },
};
export function sumCents(values) {
  return values.reduce((sum, value) => {
    if (!Number.isSafeInteger(value) || !Number.isSafeInteger(sum + value))
      throw Error("Soma monetária fora do limite.");
    return sum + value;
  }, 0);
}
export function movementTotals(movements) {
  const totals = {};
  for (const [type, spec] of Object.entries(movementTypes)) {
    const items = movements.filter(
      (m) => m.type === type && m.status !== "excluded" && !m.duplicateOf,
    );
    if (items.length)
      totals[spec.field] = sumCents(
        items.map((m) => {
          if (
            !Number.isSafeInteger(m.amountCents) ||
            m.amountCents < 0 ||
            m.direction !== spec.direction
          )
            throw Error("Movimentação normalizada inválida.");
          return m.amountCents;
        }),
      );
  }
  return totals;
}
