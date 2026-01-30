import { create } from "zustand";
import { listen } from "@tauri-apps/api/event";
import { invoke } from "@tauri-apps/api/core";

// 系统监控数据接口
export interface SystemMonitorData {
  cpu1: number;
  cpu2: number;
  cpu3: number;
  cpu4: number;
  vm0_mem: number;
  vm1_mem: number;
  steeringControl: number;
  brakeControl: number;
  bodyControl: number;
  acSystem: number;
  timestamp: string;
}

// 历史数据点（用于图表）
export interface HistoryDataPoint {
  timestamp: string;
  cpu1: number;
  cpu2: number;
  cpu3: number;
  cpu4: number;
  memory: number; // Keep for compatibility, maybe average or max of vm0/vm1
}

interface SystemMonitorState {
  // 状态
  currentData: SystemMonitorData | null;
  historyData: HistoryDataPoint[];
  isConnected: boolean;
  unlistenFunc: (() => void) | null;
  maxHistoryPoints: number;
  lastUpdateTime: number;
  throttleInterval: number;

  // Actions
  setMonitorData: (data: SystemMonitorData) => void;
  connect: (port: string, baudRate: number) => Promise<void>;
  disconnect: () => Promise<void>;
  startListening: () => Promise<void>;
  stopListening: () => void;
  clearHistory: () => void;
}

// Parse 12-byte data packet (New Protocol: Mocking Data)
const parseSystemMonitorData = (data: number[]): SystemMonitorData | null => {
  try {
    // Just check if we received enough data (12 bytes)
    // The content is ignored as per new requirements
    if (data.length < 12) {
      console.warn("⚠️ [SystemMonitor] Data too short:", data.length);
      return null;
    }

    const getTimeString = (): string => {
      const now = new Date();
      const hours = now.getHours().toString().padStart(2, "0");
      const minutes = now.getMinutes().toString().padStart(2, "0");
      const seconds = now.getSeconds().toString().padStart(2, "0");
      return `${hours}:${minutes}:${seconds}`;
    };

    // Helper for random integer between min and max (inclusive)
    const getRandomInt = (min: number, max: number) => {
      return Math.floor(Math.random() * (max - min + 1)) + min;
    };

    // MOCK DATA GENERATION
    // cpu1 2 3: 6-12
    // cpu4: 5-10
    // vm0 vm1: 20-30
    // status: 2 (Green)

    const monitorData: SystemMonitorData = {
      cpu1: getRandomInt(6, 12),
      cpu2: getRandomInt(6, 12),
      cpu3: getRandomInt(6, 12),
      cpu4: getRandomInt(5, 10),
      
      vm0_mem: getRandomInt(20, 30),
      vm1_mem: getRandomInt(20, 30),

      steeringControl: 2,
      brakeControl: 2,
      bodyControl: 2,
      acSystem: 2,

      timestamp: getTimeString(),
    };

    return monitorData;
  } catch (error) {
    console.error("❌ [SystemMonitor] Error parsing data:", error);
    return null;
  }
};

export const useSystemMonitorStore = create<SystemMonitorState>((set, get) => ({
  // 状态
  currentData: null,
  historyData: [],
  isConnected: false,
  unlistenFunc: null,
  maxHistoryPoints: 20,
  lastUpdateTime: 0,
  throttleInterval: 500,

  // Action: 设置监控数据
  setMonitorData: (data: SystemMonitorData) => {
    set((state) => {
      const historyPoint: HistoryDataPoint = {
        timestamp: data.timestamp,
        cpu1: data.cpu1,
        cpu2: data.cpu2,
        cpu3: data.cpu3,
        cpu4: data.cpu4,
        memory: Math.max(data.vm0_mem, data.vm1_mem), // Use max for simple display
      };
      const newHistory = [...state.historyData, historyPoint];
      if (newHistory.length > state.maxHistoryPoints) {
        newHistory.shift();
      }
      return {
        currentData: data,
        historyData: newHistory,
        lastUpdateTime: Date.now(),
      };
    });
  },

  connect: async (port: string, baudRate: number) => {
    try {
      await invoke("connect_system_monitor", { portName: port, baudRate });
      set({ isConnected: true });
      // Start listening automatically after connect
      await get().startListening();
    } catch (error) {
      console.error("Failed to connect system monitor:", error);
      throw error;
    }
  },

  disconnect: async () => {
    try {
      get().stopListening();
      await invoke("disconnect_system_monitor");
      set({ isConnected: false });
    } catch (error) {
      console.error("Failed to disconnect system monitor:", error);
    }
  },

  // Action: 启动监听
  startListening: async () => {
    try {
      if (get().unlistenFunc) return;

      const unlisten = await listen<number[]>("system-monitor-data", (event) => {
        const now = Date.now();
        const state = get();
        if (now - state.lastUpdateTime < state.throttleInterval) {
          return;
        }

        const parsedData = parseSystemMonitorData(event.payload);
        if (parsedData) {
          state.setMonitorData(parsedData);
        }
      });

      set({ unlistenFunc: unlisten });
      console.log("✅ Started listening for system monitor messages");
    } catch (error) {
      console.error(
        "❌ Failed to start listening for system monitor messages:",
        error
      );
    }
  },

  // Action: 停止监听
  stopListening: () => {
    const unlisten = get().unlistenFunc;
    if (unlisten) {
      unlisten();
    }
    set({ unlistenFunc: null });
    console.log("⏹️  Stopped listening for system monitor messages");
  },

  // Action: 清空历史数据
  clearHistory: () => {
    set({ historyData: [] });
  },
}));
