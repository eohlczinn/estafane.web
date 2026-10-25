import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { useLocation } from "react-router-dom";
import { useClosing } from "./ClosingContext.jsx";
import {
  addSignal,
  emptyExperience,
  experienceKey,
  normalizeExperience,
  readExperience,
  recommendations,
  recommendationIds,
} from "../services/experience.js";
import { ExperienceContext as Context } from "./experience.js";
export function ExperienceProvider({ children }) {
  const { prefs, closing, audit, setNotice } = useClosing();
  const [memory, setMemory] = useState(() =>
    readExperience(localStorage, prefs.memoryDays),
  );
  const location = useLocation(),
    lastRoute = useRef("");
  const lastDocument = useRef(""),
    lastConfirmed = useRef("");
  const record = useCallback(
    (type, value) => {
      if (prefs.learnUsage)
        setMemory((old) =>
          addSignal(old, type, value, Date.now(), prefs.memoryDays),
        );
    },
    [prefs.learnUsage, prefs.memoryDays],
  );
  useEffect(() => {
    if (lastRoute.current === location.pathname) return;
    lastRoute.current = location.pathname;
    record("route", location.pathname);
  }, [location.pathname, record]);
  useEffect(() => {
    if (closing.pages.length && lastDocument.current !== closing.id) {
      lastDocument.current = closing.id;
      record("workflow", "import");
    }
    if (closing.confirmed && lastConfirmed.current !== closing.id) {
      lastConfirmed.current = closing.id;
      record("workflow", "confirm");
    }
  }, [closing.id, closing.pages.length, closing.confirmed, record]);
  useEffect(() => {
    const onStorage = (e) => {
      if (e.key === experienceKey)
        setMemory(readExperience(localStorage, prefs.memoryDays));
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, [prefs.memoryDays]);
  useEffect(() => {
    try {
      localStorage.setItem(
        experienceKey,
        JSON.stringify(normalizeExperience(memory, prefs.memoryDays)),
      );
    } catch {
      setNotice(
        "A memória de preferências não pôde ser salva neste navegador.",
      );
    }
  }, [memory, prefs.memoryDays, setNotice]);
  const feedback = useCallback(
    (id, value) => {
      if (
        !recommendationIds.includes(id) ||
        !["useful", "hide"].includes(value)
      )
        return;
      setMemory((old) => ({
        ...normalizeExperience(old, prefs.memoryDays),
        feedback: { ...old.feedback, [id]: { value, at: Date.now() } },
      }));
    },
    [prefs.memoryDays],
  );
  const suggestions = useMemo(
    () =>
      recommendations(memory, {
        prefs,
        hasDocument: closing.pages.length > 0,
        confirmed: closing.confirmed,
        pending: audit.issues.length,
      }),
    [
      memory,
      prefs,
      closing.pages.length,
      closing.confirmed,
      audit.issues.length,
    ],
  );
  return (
    <Context.Provider
      value={{
        memory,
        suggestions,
        record,
        feedback,
        clearMemory: () => setMemory(emptyExperience()),
      }}
    >
      {children}
    </Context.Provider>
  );
}
