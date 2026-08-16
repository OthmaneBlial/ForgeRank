"use client";

import { useMemo, useSyncExternalStore } from "react";

const EVENT = "forgerank-local-storage";

function subscribe(callback: () => void): () => void {
  window.addEventListener("storage", callback);
  window.addEventListener(EVENT, callback);
  return () => {
    window.removeEventListener("storage", callback);
    window.removeEventListener(EVENT, callback);
  };
}

export function useLocalList(key: string): [string[], (values: string[]) => void] {
  const serialized = useSyncExternalStore(
    subscribe,
    () => localStorage.getItem(key) ?? "[]",
    () => "[]",
  );
  const values = useMemo(() => {
    try {
      const parsed = JSON.parse(serialized) as unknown;
      return Array.isArray(parsed)
        ? parsed.filter((value): value is string => typeof value === "string")
        : [];
    } catch {
      return [];
    }
  }, [serialized]);
  const setValues = (next: string[]) => {
    localStorage.setItem(key, JSON.stringify(next));
    window.dispatchEvent(new Event(EVENT));
  };
  return [values, setValues];
}
