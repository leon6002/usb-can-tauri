import { create } from "zustand";

export interface DebugLog {
  id: string;
  timestamp: string;
  action: string;
  commandId: string;
  canId: string;
  data: string;
  description: string;
}

// 1. 定义 Store 的接口
interface DebugState {
  logs: DebugLog[];
  isDebugVisible: boolean;

  // 操作函数
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

export const useDebugStore = create<DebugState>((set) => ({
  logs: [],
  isDebugVisible: false,
  addDebugLog: (action, commandId, canId, data, description) => {
    const newLog: DebugLog = {
      id: Date.now().toString() + Math.random().toString(36).substr(2, 9),
      timestamp: new Date().toLocaleTimeString("zh-CN", {
        hour12: false,
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
      }),
      action,
      commandId,
      canId,
      data,
      description,
    };

    // 使用 set 更新状态
    set((state) => {
      const newLogs = [newLog, ...state.logs];
      // 限制日志数量
      return { logs: newLogs.slice(0, 100) };
    });
  },
  clearLogs: () => set({ logs: [] }),
  toggleDebugPanel: () =>
    set((state) => ({ isDebugVisible: !state.isDebugVisible })),
}));
