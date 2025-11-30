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

// Parse 18-byte data packet
const parseSystemMonitorData = (data: number[]): SystemMonitorData | null => {
  try {
    if (data.length < 18) {
      console.warn("⚠️ [SystemMonitor] Data too short:", data.length);
      return null;
    }

    // Byte 0: 0xAA, Byte 1: 0x55 (Already checked in backend, but good to know)

    const getTimeString = (): string => {
      const now = new Date();
      const hours = now.getHours().toString().padStart(2, "0");
      const minutes = now.getMinutes().toString().padStart(2, "0");
      const seconds = now.getSeconds().toString().padStart(2, "0");
      return `${hours}:${minutes}:${seconds}`;
    };

    const monitorData: SystemMonitorData = {
      // 0: AA, 1: 55
      cpu1: data[2],
      cpu2: data[3],
      cpu3: data[4],
      cpu4: data[5],
      vm0_mem: data[6],
      vm1_mem: data[7],

      // Bytes 8-13 are debug info, skipping for now

      steeringControl: data[14],
      brakeControl: data[15],
      bodyControl: data[16],
      acSystem: data[17],

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
