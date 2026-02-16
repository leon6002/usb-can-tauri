import { create } from "zustand";


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
  // connect: (port: string, baudRate: number) => Promise<void>; // Deprecated
  connect: () => Promise<void>; 
  disconnect: () => Promise<void>;
  startListening: () => Promise<void>;
  stopListening: () => void;
  clearHistory: () => void;
  
  startMockLoop: () => void;
  stopMockLoop: () => void;
  mockIntervalId: NodeJS.Timeout | null;
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
  isConnected: false, // Now represents "Monitoring Active"
  unlistenFunc: null, // Deprecated but kept for interface compatibility if needed, or remove
  maxHistoryPoints: 20,
  lastUpdateTime: 0,
  throttleInterval: 1000,
  mockIntervalId: null as NodeJS.Timeout | null,

  // Action: 设置监控数据
  setMonitorData: (data: SystemMonitorData) => {
    set((state) => {
      const historyPoint: HistoryDataPoint = {
        timestamp: data.timestamp,
        cpu1: data.cpu1,
        cpu2: data.cpu2,
        cpu3: data.cpu3,
        cpu4: data.cpu4,
        memory: Math.max(data.vm0_mem, data.vm1_mem),
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

  // Replaces connect/startListening
  startMockLoop: () => {
    const { unlistenFunc } = get();
    if (unlistenFunc) return;

    console.log("🟢 Starting System Monitor Feedback Listener");
    
    // Clear any existing watchdog
    let watchdogTimer: NodeJS.Timeout | null = null;
    
    const resetWatchdog = () => {
      if (watchdogTimer) clearTimeout(watchdogTimer);
      // If no data for 200ms (10 frames at 20ms), consider disconnected
      watchdogTimer = setTimeout(() => {
         set({ isConnected: false });
         console.log("⚠️ System Monitor Disconnected (No 0x221 Feedback)");
         
         // Reset data to zeros
          const zeroData: SystemMonitorData = {
            cpu1: 0,
            cpu2: 0,
            cpu3: 0,
            cpu4: 0,
            vm0_mem: 0,
            vm1_mem: 0,
            steeringControl: 0,
            brakeControl: 0,
            bodyControl: 0,
            acSystem: 0,
            timestamp: new Date().toLocaleTimeString(),
          };
          get().setMonitorData(zeroData);
      }, 500); 
    };

    import("@tauri-apps/api/event").then(({ listen }) => {
      // Listen for vehicle feedback (0x221)
      listen<any>("vehicle-feedback", (_event) => {
        // We received valid 0x221 data
        // 1. Mark as connected
        set({ isConnected: true });
        
        // 2. Generate and set System Monitor Mock Data (Throttled)
        const { lastUpdateTime, throttleInterval } = get();
        const now = Date.now();
        
        if (now - lastUpdateTime > throttleInterval) {
            // (In a real app, we might use event.payload info here too)
            const mockData = parseSystemMonitorData(new Array(12).fill(0));
            if (mockData) {
              get().setMonitorData(mockData);
            }
        }

        // 3. Reset watchdog (always reset watchdog on activity, regardless of throttle)
        resetWatchdog();
      }).then(unlisten => {
         set({ unlistenFunc: unlisten });
      });
    });
  },

  // Replaces disconnect/stopListening
  stopMockLoop: () => {
    const { unlistenFunc } = get();
    if (unlistenFunc) {
      unlistenFunc(); // Call the unlisten function returned by tauri
      set({ 
        isConnected: false,
        unlistenFunc: null 
      });
      console.log("🔴 Stopped System Monitor Feedback Listener");
    }
  },

  // Legacy/Unused actions (kept empty or redirecting to mock loop if called)
  connect: async () => {
    console.warn("connect() is deprecated, use startMockLoop()");
    get().startMockLoop();
  },
  disconnect: async () => {
    get().stopMockLoop();
  },
  startListening: async () => {},
  stopListening: () => {},

  // Action: 清空历史数据
  clearHistory: () => {
    set({ historyData: [] });
  },
}));
