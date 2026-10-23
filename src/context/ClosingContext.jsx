import React, { createContext, useContext, useEffect, useState } from "react";
import { applyWorkDefaults, todayInSaoPaulo } from "../../shared/workday.js";
import {
  readPreferences,
  writePreferences,
  normalizePreferences,
} from "../services/preferences.js";
import { useAppearance } from "../hooks/useAppearance.js";
import { reconcile } from "../../shared/reconciliation.js";
import { summarizeBatch } from "../../shared/batch.js";
import {
  mergeDocuments,
  resolveGroupingDecision,
} from "../../shared/grouping.js";
import {
  editField,
  editMovement,
  classifyUnknownLine,
  rememberChange,
  undoChange,
} from "../../shared/closingEdits.js";
import {
  readImportProfiles,
  validateImportProfiles,
  profileStorageKey,
} from "../../shared/importProfiles.js";
const Context = createContext();
function fresh(prefs) {
  return {
    id: "manual",
    fields: applyWorkDefaults(undefined, prefs.market, new Date(), prefs),
    rules: { automatic: true, confirmed: true, cashBasis: "gross" },
    movements: [],
    declarations: [],
    unparsedLines: [],
    mergeIssues: [],
    resolutions: {},
    history: [],
    pages: [],
    documents: [],
    documentIds: [],
    warnings: [],
    notes: "",
    confirmed: false,
    reviewed: false,
  };
}
function audited(c) {
  const audit = reconcile(c, { reviewed: c.reviewed && c.confirmed });
  return { ...c, audit, calculation: audit.calculation, status: audit.status };
}
export function ClosingProvider({ children }) {
  const [prefs, setPrefsState] = useState(() => readPreferences(localStorage)),
    [manual, setManual] = useState(() => fresh(prefs)),
    [batch, setBatch] = useState(null),
    [activeId, setActiveId] = useState(null);
  const [notice, setNotice] = useState(""),
    [busy, setBusy] = useState(false),
    [backend, setBackend] = useState("checking"),
    [serverLimits, setServerLimits] = useState({
      maxFiles: 10,
      maxUploadBytes: 10485760,
      maxBatchBytes: 31457280,
      maxPages: 20,
    });
  const closing = batch?.closings.find((c) => c.id === activeId) || manual,
    fields = closing.fields,
    rules = closing.rules,
    audit = reconcile(closing, {
      reviewed: closing.reviewed && closing.confirmed,
    });
  function setPrefs(value) {
    setPrefsState((old) =>
      normalizePreferences(typeof value === "function" ? value(old) : value),
    );
  }
  useAppearance(prefs);
  useEffect(() => {
    if (!writePreferences(localStorage, prefs))
      setNotice("As preferências não puderam ser salvas neste navegador.");
  }, [prefs]);
  useEffect(() => {
    function refresh() {
      const apply = (old) => {
        if (old.confirmed) return old;
        const fields = applyWorkDefaults(
          old.fields,
          prefs.market,
          new Date(),
          prefs,
        );
        for (const [key, value] of Object.entries({
          date: todayInSaoPaulo(),
          market: prefs.market,
          operator: prefs.operator,
          register: prefs.register,
        }))
          if (fields[key].status === "default")
            fields[key] = { ...fields[key], value: value || null };
        const changed = Object.keys(fields).some(
          (key) =>
            fields[key].value !== old.fields[key].value ||
            fields[key].status !== old.fields[key].status,
        );
        return changed ? audited({ ...old, fields, reviewed: false }) : old;
      };
      setManual(apply);
      setBatch((old) =>
        old ? { ...old, closings: old.closings.map(apply) } : old,
      );
    }
    refresh();
    const timer = setInterval(refresh, 60000);
    document.addEventListener("visibilitychange", refresh);
    return () => {
      clearInterval(timer);
      document.removeEventListener("visibilitychange", refresh);
    };
  }, [prefs.market, prefs.operator, prefs.register]);
  useEffect(() => {
    let stopped = false;
    async function check() {
      try {
        const response = await fetch("/api/health", {
            signal: AbortSignal.timeout(5000),
            credentials: "include",
          }),
          data = await response.json();
        if (!stopped) {
          if (response.status === 401 && typeof window !== "undefined") {
            window.dispatchEvent(new CustomEvent("auth:expired"));
          }
          setBackend(
            response.ok && data.status === "ok" ? "online" : "offline",
          );
          if (response.ok) setServerLimits(data);
        }
      } catch {
        if (!stopped) setBackend("offline");
      }
    }
    check();
    const timer = setInterval(check, 15000);
    return () => {
      stopped = true;
      clearInterval(timer);
    };
  }, []);
  function mutate(fn, record = true) {
    const apply = (old) =>
      audited(record ? rememberChange(old, fn(old)) : fn(old));
    if (batch && batch.closings.some((c) => c.id === activeId))
      setBatch((old) => ({
        ...old,
        closings: old.closings.map((c) => (c.id === activeId ? apply(c) : c)),
      }));
    else setManual(apply);
  }
  function update(key, value, status = "manual") {
    mutate((old) => editField(old, key, value, status));
  }
  function loadBatch(data) {
    setManual(fresh(prefs));
    setBatch({
      ...data,
      closings: data.closings.map((c) =>
        audited({
          ...c,
          fields: applyWorkDefaults(c.fields, prefs.market, new Date(), prefs),
        }),
      ),
    });
    setActiveId(data.closings[0]?.id || null);
    setBackend("online");
    setNotice(
      "Documentos analisados. Confira cada fechamento antes de emitir.",
    );
  }
  function load(data) {
    const doc = {
      ...data,
      status: data.status || "completed",
      id: data.id || "single",
      pages: data.pages || [],
    };
    const c = mergeDocuments([doc], "closing-" + doc.id);
    loadBatch({
      version: 2,
      id: "single",
      documents: [doc],
      closings: [c],
      suggestions: [],
    });
  }
  function setConfirmed(value) {
    if (
      value &&
      (!audit.canConfirm || (!closing.reviewed && prefs.confirmBeforeFinish))
    ) {
      setNotice(
        "Resolva as pendências e confira os valores antes de confirmar.",
      );
      return false;
    }
    mutate(
      (old) => ({
        ...old,
        confirmed: value,
        reviewed: value ? true : old.reviewed,
      }),
      false,
    );
    return true;
  }
  function resolveIssue(id, reason) {
    mutate((old) => ({
      ...old,
      resolutions: {
        ...old.resolutions,
        [id]: { reason: reason.trim(), at: new Date().toISOString() },
      },
      history: [
        ...old.history,
        { kind: "resolution", id, reason, at: new Date().toISOString() },
      ],
      confirmed: false,
      reviewed: false,
    }));
  }
  function updateMovement(id, amountCents, excluded = false) {
    mutate((old) => editMovement(old, id, amountCents, excluded));
  }
  function resolveGrouping(suggestion, combine) {
    try {
      const next = resolveGroupingDecision(batch, suggestion, combine);
      setBatch({
        ...next,
        closings: next.closings.map((c) =>
          audited({
            ...c,
            fields: applyWorkDefaults(
              c.fields,
              prefs.market,
              new Date(),
              prefs,
            ),
          }),
        ),
      });
      if (combine && suggestion.closingIds.includes(activeId)) {
        const previous = batch.closings.find((c) => c.id === activeId);
        const replacement = next.closings.find((c) =>
          c.documentIds.some((id) => previous.documentIds.includes(id)),
        );
        setActiveId(replacement?.id || next.closings[0]?.id || null);
      }
    } catch (error) {
      setNotice(error.message);
      return error.message;
    }
  }
  const summary = batch
    ? summarizeBatch(batch.closings, batch.documents)
    : null;
  return (
    <Context.Provider
      value={{
        prefs,
        setPrefs,
        fields,
        rules,
        closing,
        audit,
        update,
        load,
        loadBatch,
        batch,
        summary,
        activeId,
        selectClosing: setActiveId,
        resolveGrouping,
        resolveIssue,
        updateMovement,
        classifyLine: (id, field, value, reason, mode) =>
          mutate((old) =>
            classifyUnknownLine(old, id, field, value, reason, mode),
          ),
        undo: () => mutate(undoChange, false),
        saveImportProfile: () => {
          if (!closing.confirmed || !audit.canConfirm) {
            setNotice("Confirme o fechamento antes de salvar o perfil.");
            return;
          }
          try {
            const profiles = readImportProfiles(localStorage);
            for (const correction of closing.profileCorrections || []) {
              if (!correction.layoutKey || !correction.label) continue;
              let profile = profiles.find(
                (p) => p.layoutKey === correction.layoutKey,
              );
              if (!profile) {
                profile = {
                  version: 1,
                  layoutKey: correction.layoutKey,
                  name: "Layout conferido",
                  rules: [],
                };
                profiles.push(profile);
              }
              profile.rules = [
                ...profile.rules.filter((r) => r.label !== correction.label),
                { label: correction.label, field: correction.field },
              ];
            }
            localStorage.setItem(
              profileStorageKey,
              JSON.stringify(validateImportProfiles(profiles)),
            );
            setNotice(
              "Perfil salvo neste navegador. Sugestões só serão usadas no mesmo layout e continuarão exigindo conferência.",
            );
          } catch {
            setNotice(
              "Não foi possível salvar o perfil. Limite de 20 layouts ou armazenamento indisponível.",
            );
          }
        },
        setRules: (value) =>
          mutate((old) => ({
            ...old,
            rules: value,
            confirmed: false,
            reviewed: false,
          })),
        confirmed: closing.confirmed,
        setConfirmed,
        reviewed: closing.reviewed,
        setReviewed: (value) =>
          mutate((old) => ({ ...old, reviewed: value, confirmed: false })),
        notes: closing.notes,
        setNotes: (value) =>
          mutate((old) => ({
            ...old,
            notes: value.slice(0, 2000),
            confirmed: false,
          })),
        pages: closing.pages,
        filename: closing.documents.map((d) => d.filename).join(" + "),
        extractionWarnings: closing.warnings,
        notice,
        setNotice,
        busy,
        setBusy,
        backend,
        serverLimits,
      }}
    >
      {children}
    </Context.Provider>
  );
}
export const useClosing = () => useContext(Context);
