import React from "react";
import { PackageCheck } from "lucide-react";
const quantity = (value) =>
  value == null
    ? "Não informado"
    : new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 6 }).format(
        value,
      );
export default function InventorySummary({ inventory }) {
  if (!inventory?.detected) return null;
  return (
    <section className="panel inventory-summary">
      <h2>
        <PackageCheck size={21} />
        Conferência de estoque
      </h2>
      <p className="muted">
        Saldo esperado = inicial + entradas − saídas. Quantidades ficam
        separadas dos valores do caixa.
      </p>
      {inventory.issues?.map((issue, i) => (
        <p className="error-message" key={issue.code + ":" + i}>
          {issue.message}
        </p>
      ))}
      {inventory.items?.length > 0 && (
        <div className="inventory-table-wrap">
          <table>
            <thead>
              <tr>
                <th>Produto</th>
                <th>Inicial</th>
                <th>Entradas</th>
                <th>Saídas</th>
                <th>Esperado</th>
                <th>Contado</th>
                <th>Resultado</th>
              </tr>
            </thead>
            <tbody>
              {inventory.items.map((item, i) => (
                <tr key={item.id || item.product + ":" + i}>
                  <th scope="row">
                    {item.product}
                    <small>
                      {item.unit || "unidade não informada"} · pág.{" "}
                      {item.source?.page || "?"}
                    </small>
                    {item.quantity != null && (
                      <small>
                        Quantidade informada: {quantity(item.quantity)}{" "}
                        {item.unit || ""}
                      </small>
                    )}
                    {item.issues?.map((message, j) => (
                      <small className="danger-text" key={j}>
                        {message}
                      </small>
                    ))}
                  </th>
                  {["opening", "entries", "exits", "expected", "counted"].map(
                    (key) => (
                      <td key={key}>{quantity(item[key])}</td>
                    ),
                  )}
                  <td className={item.difference < 0 ? "danger-text" : ""}>
                    {item.difference == null
                      ? "Conferir dados"
                      : item.difference === 0
                        ? "Confere"
                        : `${item.difference < 0 ? "Falta" : "Sobra"} ${quantity(Math.abs(item.difference))} ${item.unit || ""}`}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
