"use client";

import { createContext, useCallback, useContext, useRef, useState } from "react";

type ExtractContextValue = {
  pendingFile: File | null;
  /** Ref updated synchronously so dashboard can read file on first mount before state flushes */
  pendingFileRef: React.MutableRefObject<File | null>;
  setPendingFile: (file: File | null) => void;
};

const ExtractContext = createContext<ExtractContextValue | null>(null);

export function ExtractProvider({ children }: { children: React.ReactNode }) {
  const [pendingFile, setPendingFileState] = useState<File | null>(null);
  const pendingFileRef = useRef<File | null>(null);
  const setPendingFile = useCallback((file: File | null) => {
    pendingFileRef.current = file;
    setPendingFileState(file);
  }, []);
  return (
    <ExtractContext.Provider value={{ pendingFile, pendingFileRef, setPendingFile }}>
      {children}
    </ExtractContext.Provider>
  );
}

export function useExtract() {
  const ctx = useContext(ExtractContext);
  if (!ctx) throw new Error("useExtract must be used within ExtractProvider");
  return ctx;
}
