import React, { useState } from "react";
import { useClosing } from "../../context/ClosingContext.jsx";
import { movementTypes } from "../../../shared/movements.js";
import { formatMoney, editMoney, parseMoney } from "../../../shared/money.js";
import { sourceLocation } from "../../../shared/source.js";
function Movement({ item }) {
  const { updateMovement } = useClosing(),
    [draft, setDraft] = useState(editMoney(item.amountCents)),
    [error, setError] = useState("");
  return (
    <div
      className={
        "movement-item " + (item.status === "excluded" ? "excluded" : "")
      }
    >
      <div>
        <strong>{item.description}</strong>
        <span>
          {item.direction === "out" ? "Saída −" : "Entrada +"}{" "}
          {formatMoney(item.amountCents)}
        </span>
        <small>
          {sourceLocation(item.source)} · {item.source.text}
        </small>
        {item.duplicateOf && (
          <small>Operação repetida identificada; não somada.</small>
        )}
      </div>
      <details>
        <summary>Corrigir movimentação</summary>
        <label>
          Valor da movimentação
          <input
            aria-label={"Valor de " + item.description}
            value={draft}
            inputMode="decimal"
            onChange={(e) => setDraft(e.target.value)}
          />
        </label>
        <button
          className="secondary"
          onClick={() => {
            try {
              const cents = parseMoney(draft);
              if (cents < 0)
                throw Error(
                  "Informe a magnitude positiva. A direção já está definida.",
                );
              updateMovement(item.id, cents, false);
              setError("");
            } catch (e) {
              setError(e.message);
            }
          }}
        >
          Aplicar correção
        </button>
        <button
          className="text-button"
          onClick={() =>
            updateMovement(
              item.id,
              item.amountCents,
              item.status !== "excluded",
            )
          }
        >
          {item.status === "excluded"
            ? "Incluir na soma"
            : "Excluir da soma (duplicada/inaplicável)"}
        </button>
        {error && (
          <p role="alert" className="field-error">
            {error}
          </p>
        )}
      </details>
      {item.history?.length > 0 && (
        <small>
          Correção manual registrada. Original:{" "}
          {formatMoney(item.history[0].previous)}.
        </small>
      )}
    </div>
  );
}
export default function MovementDetails() {
  const { closing } = useClosing();
  return (
    <section className="movement-details">
      {Object.entries(movementTypes).map(([type, spec]) => {
        const items = closing.movements.filter((m) => m.type === type);
        return (
          items.length > 0 && (
            <details key={type}>
              <summary>
                Ver {spec.label.toLowerCase()} · {items.length} registro(s)
              </summary>
              {items.map((item) => (
                <Movement key={item.id} item={item} />
              ))}
            </details>
          )
        );
      })}
      {!closing.movements.length && (
        <p className="muted">
          Nenhuma movimentação individual reconhecida. Os totais declarados
          continuam disponíveis nos campos.
        </p>
      )}
    </section>
  );
}
