"use client";

import { useEffect, useState } from "react";

export function useDraftBuffer<T>(key: string, initial: T) {
  const [history, setHistory] = useState({ current: initial, past: [] as T[], future: [] as T[] });
  const [loadedKey, setLoadedKey] = useState<string>();
  useEffect(() => {
    try {
      const saved = localStorage.getItem(key);
      setHistory({ current: saved ? JSON.parse(saved) as T : initial, past: [], future: [] });
    } catch { setHistory({ current: initial, past: [], future: [] }); }
    setLoadedKey(key);
  }, [key]);
  useEffect(() => {
    if (loadedKey !== key) return;
    try {
      if (JSON.stringify(history.current) === JSON.stringify(initial)) localStorage.removeItem(key);
      else localStorage.setItem(key, JSON.stringify(history.current));
    } catch {}
  }, [history.current, initial, key, loadedKey]);

  function field<K extends keyof T>(name: K, value: T[K] | ((current: T[K]) => T[K])) {
    setHistory(({ current, past }) => ({
      current: { ...current, [name]: typeof value === "function" ? (value as (current: T[K]) => T[K])(current[name]) : value },
      past: [...past.slice(-29), current], future: [],
    }));
  }
  function undo() {
    setHistory(({ current, past, future }) => past.length
      ? { current: past[past.length - 1], past: past.slice(0, -1), future: [current, ...future] }
      : { current, past, future });
  }
  function redo() {
    setHistory(({ current, past, future }) => future.length
      ? { current: future[0], past: [...past, current], future: future.slice(1) }
      : { current, past, future });
  }
  return { current: history.current, field, undo, redo, canUndo: history.past.length > 0, canRedo: history.future.length > 0 };
}
