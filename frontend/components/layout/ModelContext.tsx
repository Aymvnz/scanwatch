"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { MODELS, type ModelSummary } from "@/lib/models";

interface ModelContextValue {
  models: ModelSummary[];
  selected: ModelSummary;
  select: (id: string) => void;
}

const STORAGE_KEY = "scanwatch.selectedModel";
const Ctx = createContext<ModelContextValue | null>(null);

export function ModelProvider({ children }: { children: ReactNode }) {
  const [selectedId, setSelectedId] = useState(MODELS[0].id);

  // Restore after mount so server and client markup match on first render.
  useEffect(() => {
    try {
      const saved = window.localStorage.getItem(STORAGE_KEY);
      if (saved && MODELS.some((m) => m.id === saved)) setSelectedId(saved);
    } catch { /* storage unavailable: keep default */ }
  }, []);

  const select = useCallback((id: string) => {
    if (!MODELS.some((m) => m.id === id)) return;
    setSelectedId(id);
    try { window.localStorage.setItem(STORAGE_KEY, id); } catch { /* ignore */ }
  }, []);

  const value = useMemo<ModelContextValue>(
    () => ({ models: MODELS, selected: MODELS.find((m) => m.id === selectedId) ?? MODELS[0], select }),
    [selectedId, select],
  );
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useModel() {
  const v = useContext(Ctx);
  if (!v) throw new Error("useModel must be used inside <ModelProvider>");
  return v;
}
