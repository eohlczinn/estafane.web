import React, { useState } from "react";
import {
  readImportProfiles,
  profileStorageKey,
} from "../../../shared/importProfiles.js";
export default function ImportProfiles() {
  const [profiles, setProfiles] = useState(() =>
    readImportProfiles(localStorage),
  );
  const [error, setError] = useState("");
  return (
    <section id="perfis-importacao" className="panel settings-panel">
      <h2>Perfis de importação</h2>
      <p>
        Classificações salvas após confirmar um fechamento. Cada perfil usa uma
        assinatura exata do layout; valores financeiros não são salvos aqui. As
        sugestões continuam exigindo conferência.
      </p>
      {!profiles.length && (
        <p className="muted">
          Nenhum perfil salvo. Classifique uma linha na conferência e confirme o
          fechamento para criar um perfil.
        </p>
      )}
      {profiles.map((profile) => (
        <div className="audit-resolution" key={profile.layoutKey}>
          <strong>
            {profile.name} · versão {profile.version}
          </strong>
          <small>
            {profile.rules.length} classificação(ões) · layout{" "}
            {profile.layoutKey.slice(0, 12)}
          </small>
          <button
            className="text-button"
            onClick={() => {
              if (
                !window.confirm(
                  "Remover as classificações salvas deste layout?",
                )
              )
                return;
              try {
                const next = profiles.filter(
                  (p) => p.layoutKey !== profile.layoutKey,
                );
                localStorage.setItem(profileStorageKey, JSON.stringify(next));
                setProfiles(next);
              } catch {
                setError(
                  "Não foi possível atualizar os perfis neste navegador.",
                );
              }
            }}
          >
            Remover perfil
          </button>
        </div>
      ))}
      {error && (
        <p className="field-error" role="alert">
          {error}
        </p>
      )}
    </section>
  );
}
