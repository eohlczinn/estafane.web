import React, { useState } from "react";
import { Bell, Check, Trash2 } from "lucide-react";
import { Link } from "react-router-dom";
import { useWorkspace } from "../context/workspace.js";
import { useClosing } from "../context/ClosingContext.jsx";
import WorkspaceDialog from "../components/WorkspaceDialog.jsx";
export default function Notifications() {
  const {
    notifications,
    notificationError,
    unread,
    readAll,
    removeNotification,
    clearNotifications,
  } = useWorkspace();
  const { prefs } = useClosing();
  const [filter, setFilter] = useState("all"),
    [clear, setClear] = useState(false);
  const visible = notifications.filter((n) => filter !== "unread" || !n.read);
  return (
    <>
      <div className="page-heading">
        <span className="heading-icon">
          <Bell />
        </span>
        <div>
          <div className="eyebrow">ACOMPANHE SUA ROTINA</div>
          <h1>Notificações</h1>
          <p>
            {unread} não lida(s). Avisos do sistema e do histórico, sem
            mensagens simuladas.
          </p>
        </div>
      </div>
      {notificationError && (
        <p className="error-message" role="alert">
          {notificationError}
        </p>
      )}
      <section className="panel notification-center">
        <div className="selection-toolbar">
          <label>
            Exibir
            <select value={filter} onChange={(e) => setFilter(e.target.value)}>
              <option value="all">Todas</option>
              <option value="unread">Não lidas</option>
            </select>
          </label>
          <button className="secondary" onClick={readAll} disabled={!unread}>
            <Check size={16} />
            Marcar como lidas
          </button>
          <button
            className="secondary"
            onClick={() => setClear(true)}
            disabled={!notifications.length}
          >
            <Trash2 size={16} />
            Limpar avisos
          </button>
          <Link to="/configuracoes#notificacoes-local">
            Preferências de avisos
          </Link>
        </div>
        {!prefs.notificationsEnabled && (
          <p className="muted">
            Novos avisos estão pausados nas configurações.
          </p>
        )}
        {!visible.length && (
          <div className="empty-workspace">
            <Bell size={36} />
            <h2>Tudo em dia por aqui</h2>
            <p>Os próximos avisos aparecerão quando você usar o sistema.</p>
          </div>
        )}
        {visible.map((n) => (
          <article
            key={n.id}
            className={"notification-row " + (!n.read ? "unread" : "")}
          >
            <Bell size={18} />
            <div>
              <p>{n.text}</p>
              <small>
                {new Date(n.at).toLocaleString("pt-BR")} ·{" "}
                {n.category === "history" ? "Histórico" : "Sistema"}
              </small>
            </div>
            <button
              className="icon-btn"
              aria-label={"Excluir aviso: " + n.text}
              onClick={() => removeNotification(n.id)}
            >
              <Trash2 size={17} />
            </button>
          </article>
        ))}
      </section>
      {clear && (
        <div className="modal-backdrop">
          <WorkspaceDialog
            onClose={() => setClear(false)}
            role="dialog"
            aria-modal="true"
            aria-labelledby="clear-notifications"
            className="panel workspace-dialog"
          >
            <h2 id="clear-notifications">Limpar todos os avisos?</h2>
            <p>
              Isso remove apenas as notificações. Seus fechamentos continuam no
              histórico.
            </p>
            <div className="review-actions">
              <button className="secondary" onClick={() => setClear(false)}>
                Cancelar
              </button>
              <button
                className="primary"
                onClick={() => {
                  clearNotifications();
                  setClear(false);
                }}
              >
                Limpar avisos
              </button>
            </div>
          </WorkspaceDialog>
        </div>
      )}
    </>
  );
}
