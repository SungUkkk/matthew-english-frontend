import React, { createContext, useContext, useEffect, useState } from "react";

type ZoomContextValue = {
  zoom: number;
  increase: () => void;
  decrease: () => void;
};

const STORAGE_KEY = "matthew-english-zoom";

const ZoomContext = createContext<ZoomContextValue | undefined>(undefined);

function loadInitialZoom(): number {
  if (typeof window === "undefined") return 1;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    const num = raw ? Number(raw) : NaN;
    if (!Number.isNaN(num) && num >= 0.8 && num <= 1.6) return num;
  } catch {
    // ignore
  }
  return 1;
}

export const ZoomProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [zoom, setZoom] = useState<number>(loadInitialZoom);

  useEffect(() => {
    document.documentElement.style.fontSize = `${zoom * 100}%`;
    try {
      window.localStorage.setItem(STORAGE_KEY, String(zoom));
    } catch {
      // ignore
    }
  }, [zoom]);

  const increase = () => {
    setZoom((z) => Math.min(1.6, Number((z + 0.1).toFixed(2))));
  };

  const decrease = () => {
    setZoom((z) => Math.max(0.8, Number((z - 0.1).toFixed(2))));
  };

  return (
    <ZoomContext.Provider value={{ zoom, increase, decrease }}>{children}</ZoomContext.Provider>
  );
};

export function useZoom(): ZoomContextValue {
  const ctx = useContext(ZoomContext);
  if (!ctx) {
    throw new Error("useZoom must be used within ZoomProvider");
  }
  return ctx;
}

