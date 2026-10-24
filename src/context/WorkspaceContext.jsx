import React, { useCallback, useEffect, useRef, useState } from "react";
import { useClosing } from "./ClosingContext.jsx";
import { WorkspaceContext } from "./workspace.js";
import {
  listArchive,
  putArchive,
  deleteArchive,
  makeArchiveRecord,
} from "../services/archive.js";
import {
  readProfile,
  normalizeProfile,
  profileKey,
  readNotifications,
  notificationsKey,
  appendNotification,
} from "../services/workspace.js";

export function WorkspaceProvider({ children }) {
  const { closing, prefs, notice, setNotice } = useClosing();
  const [profile, setProfile] = useState(() => readProfile(localStorage));
  const [notifications, setNotifications] = useState(() =>
    readNotifications(localStorage),
  );
  const [records, setRecords] = useState([]),
    [archiveError, setArchiveError] = useState("");
  const [saving, setSaving] = useState(false);
  const [notificationError, setNotificationError] = useState("");
  const historyNotice = useRef("");
  const archiveIds = useRef(new Map()),
    lastAuto = useRef(""),
    queue = useRef(Promise.resolve());
  const refreshArchive = useCallback(async () => {
    try {
      setRecords(await listArchive());
      setArchiveError("");
    } catch (e) {
      setArchiveError(e.message);
    }
  }, []);
  useEffect(() => {
    refreshArchive();
    const visible = () => {
      if (!document.hidden) refreshArchive();
    };
    document.addEventListener("visibilitychange", visible);
    return () => document.removeEventListener("visibilitychange", visible);
  }, [refreshArchive]);
  const notify = useCallback(
    (text, category = "system") => {
      if (
        !prefs.notificationsEnabled ||
        (category === "history" && !prefs.notifyHistory)
      )
        return;
      setNotifications((old) => appendNotification(old, text, category));
    },
    [prefs.notificationsEnabled, prefs.notifyHistory],
  );
  useEffect(() => {
    if (notice && historyNotice.current === notice) {
      historyNotice.current = "";
      return;
    }
    if (notice) notify(notice);
  }, [notice, notify]);
  useEffect(() => {
    try {
      localStorage.setItem(notificationsKey, JSON.stringify(notifications));
      setNotificationError("");
    } catch {
      setNotificationError(
        "Os avisos estão disponíveis apenas nesta sessão: o navegador não permitiu salvá-los.",
      );
    }
  }, [notifications]);
  function saveProfile(value) {
    try {
      const next = normalizeProfile(value);
      localStorage.setItem(profileKey, JSON.stringify(next));
      setProfile(next);
      setNotice("Perfil atualizado neste navegador.");
      return true;
    } catch (e) {
      setNotice(e.message);
      return false;
    }
  }
  function saveClosing(value = closing, automatic = false) {
    const work = async () => {
      setSaving(true);
      try {
        const key = JSON.stringify([
          value.id,
          value.documents.map((d) => d.hash || d.id),
        ]);
        const id =
          value.archiveId || archiveIds.current.get(key) || crypto.randomUUID();
        const existing = (await listArchive()).find((r) => r.id === id);
        const record = makeArchiveRecord(value, id, existing);
        await putArchive(record, prefs.historyLimit);
        archiveIds.current.set(key, id);
        await refreshArchive();
        notify(
          automatic
            ? "Fechamento confirmado salvo no histórico."
            : "Fechamento salvo no histórico.",
          "history",
        );
        if (!automatic) {
          historyNotice.current =
            "Salvo no histórico deste navegador. Você pode começar um novo caixa.";
          setNotice(
            "Salvo no histórico deste navegador. Você pode começar um novo caixa.",
          );
        }
        setArchiveError("");
        return true;
      } catch (e) {
        setArchiveError(e.message);
        setNotice("Histórico: " + e.message);
        return false;
      } finally {
        setSaving(false);
      }
    };
    const pending = queue.current.then(work, work);
    queue.current = pending;
    return pending;
  }
  // Only confirmed data are archived automatically; failures never clear the active closing.
  useEffect(() => {
    if (!prefs.autoHistory || !closing.confirmed) return;
    const signature = JSON.stringify([
      closing.id,
      closing.fields,
      closing.movements,
      closing.rules,
      closing.declarations,
      closing.profileCorrections,
      closing.notes,
      closing.resolutions,
    ]);
    if (lastAuto.current === signature) return;
    lastAuto.current = signature;
    saveClosing(closing, true);
  }, [closing, prefs.autoHistory]);
  function removeRecords(ids) {
    const work = async () => {
      try {
        await deleteArchive(ids);
        await refreshArchive();
        notify(
          `${ids.length} registro(s) excluído(s) do histórico.`,
          "history",
        );
        historyNotice.current = `${ids.length} registro(s) excluído(s) do histórico.`;
        setNotice(historyNotice.current);
        return true;
      } catch (e) {
        setArchiveError(e.message);
        return false;
      }
    };
    const pending = queue.current.then(work, work);
    queue.current = pending;
    return pending;
  }
  return (
    <WorkspaceContext.Provider
      value={{
        profile,
        saveProfile,
        notifications,
        notificationError,
        unread: notifications.filter((n) => !n.read).length,
        notify,
        readAll: () =>
          setNotifications((old) => old.map((n) => ({ ...n, read: true }))),
        removeNotification: (id) =>
          setNotifications((old) => old.filter((n) => n.id !== id)),
        clearNotifications: () => setNotifications([]),
        records,
        archiveError,
        saving,
        saveClosing,
        removeRecords,
        refreshArchive,
      }}
    >
      {children}
    </WorkspaceContext.Provider>
  );
}
