import React, { createContext, useContext, ReactNode } from "react";
import { DebugLog } from "../hooks/useDebugLogs";

interface DebugContextType {
  logs: DebugLog[];
  isDebugVisible: boolean;
  addDebugLog: (
    action: string,
    commandId: string,
    canId: string,
    data: string,
    description: string
  ) => void;
  clearLogs: () => void;
  toggleDebugPanel: () => void;
}

const DebugContext = createContext<DebugContextType | undefined>(undefined);

interface DebugProviderProps {
  children: ReactNode;
  logs: DebugLog[];
  isDebugVisible: boolean;
  addDebugLog: (
    action: string,
    commandId: string,
    canId: string,
    data: string,
    description: string
  ) => void;
  clearLogs: () => void;
  toggleDebugPanel: () => void;
}

export const DebugProvider: React.FC<DebugProviderProps> = ({
  children,
  logs,
  isDebugVisible,
  addDebugLog,
  clearLogs,
  toggleDebugPanel,
}) => {
  const value: DebugContextType = {
    logs,
    isDebugVisible,
    addDebugLog,
    clearLogs,
    toggleDebugPanel,
  };

  return (
    <DebugContext.Provider value={value}>{children}</DebugContext.Provider>
  );
};

export const useDebug = () => {
  const context = useContext(DebugContext);
  if (!context) {
    throw new Error("useDebug must be used within DebugProvider");
  }
  return context;
};

