import { create } from "zustand";
import { listen } from "@tauri-apps/api/event";

// 系统监控数据接口
export interface SystemMonitorData {
  cpu1: number; // CPU1 利用率 (0-100)
  cpu2: number; // CPU2 利用率 (0-100)
  cpu3: number; // CPU3 利用率 (0-100)
  memory: number; // 内存利用率 (0-100)
  steeringControl: number; // 转向控制状态 (0=红, 1=黄, 2=绿)
  brakeControl: number; // 制动控制状态 (0=红, 1=黄, 2=绿)
  bodyControl: number; // 车身控制状态 (0=红, 1=黄, 2=绿)
  acSystem: number; // 空气调节系统 (0=红, 1=黄, 2=绿)
  timestamp: string;
}

// 历史数据点（用于图表）
export interface HistoryDataPoint {
  timestamp: string;
  cpu1: number;
  cpu2: number;
  cpu3: number;
  memory: number;
}

interface SystemMonitorState {
  // 状态
  currentData: SystemMonitorData | null;
  historyData: HistoryDataPoint[];
  isListening: boolean;
  unlistenFunc: (() => void) | null;
  maxHistoryPoints: number;

  // Actions
  setMonitorData: (data: SystemMonitorData) => void;
  startListening: () => Promise<void>;
  stopListening: () => void;
  clearHistory: () => void;
  addHistoryPoint: (point: HistoryDataPoint) => void;
}

// CAN ID 0x209 的数据解析函数
const parseSystemMonitorData = (data: string): SystemMonitorData | null => {
  try {
    // 移除空格并转换为大写
    const cleanData = data.replace(/\s+/g, "").toUpperCase();
    console.log("📊 [SystemMonitor] Raw data:", data, "Clean data:", cleanData);

    // 需要 8 个字节（16 个十六进制字符）
    if (cleanData.length < 16) {
      console.warn("⚠️  [SystemMonitor] Data too short:", cleanData);
      return null;
    }

    // 解析每个字节
    const bytes = [];
    for (let i = 0; i < 8; i++) {
      bytes.push(parseInt(cleanData.substring(i * 2, i * 2 + 2), 16));
    }
    const getTimeString = (): string => {
      const now = new Date();
      const hours = now.getHours().toString().padStart(2, "0");
      const minutes = now.getMinutes().toString().padStart(2, "0");
      const seconds = now.getSeconds().toString().padStart(2, "0");
      return `${hours}:${minutes}:${seconds}`;
    };

    const monitorData: SystemMonitorData = {
      cpu1: bytes[0], // DATA[0]: CPU1 利用率
      cpu2: bytes[1], // DATA[1]: CPU2 利用率
      cpu3: bytes[2], // DATA[2]: CPU3 利用率
      memory: bytes[3], // DATA[3]: Memory 利用率
      steeringControl: bytes[4], // DATA[4]: 转向控制状态
      brakeControl: bytes[5], // DATA[5]: 制动控制状态
      bodyControl: bytes[6], // DATA[6]: 车身控制状态
      acSystem: bytes[7], // DATA[7]: 空气调节系统
      timestamp: getTimeString(),
    };

    console.log("📊 [SystemMonitor] Parsed data:", monitorData);
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
  isListening: false,
  unlistenFunc: null,
  maxHistoryPoints: 10, // 保留最近 20 个数据点

  // Action: 设置监控数据
  setMonitorData: (data: SystemMonitorData) => {
    set({ currentData: data });

    // 同时添加到历史数据
    const historyPoint: HistoryDataPoint = {
      timestamp: data.timestamp,
      cpu1: data.cpu1,
      cpu2: data.cpu2,
      cpu3: data.cpu3,
      memory: data.memory,
    };
    get().addHistoryPoint(historyPoint);
  },

  // Action: 添加历史数据点
  addHistoryPoint: (point: HistoryDataPoint) => {
    set((state) => {
      const newHistory = [...state.historyData, point];
      // 保持最多 maxHistoryPoints 个数据点
      if (newHistory.length > state.maxHistoryPoints) {
        newHistory.shift();
      }
      return { historyData: newHistory };
    });
  },

  // Action: 启动监听
  startListening: async () => {
    try {
      if (get().unlistenFunc) return; // 避免重复监听

      const unlisten = await listen<any>("can-message-received", (event) => {
        // 检查是否是 CAN ID 0x209 的消息
        const canId = event.payload.id;
        const canIdNum = parseInt(canId.replace("0x", ""), 16);

        if (canIdNum === 0x209) {
          const parsedData = parseSystemMonitorData(event.payload.data);
          if (parsedData) {
            get().setMonitorData(parsedData);
          }
        }
      });

      set({ isListening: true, unlistenFunc: unlisten });
      console.log("✅ Started listening for system monitor messages");
    } catch (error) {
      console.error(
        "❌ Failed to start listening for system monitor messages:",
        error
      );
      set({ isListening: false });
    }
  },

  // Action: 停止监听
  stopListening: () => {
    const unlisten = get().unlistenFunc;
    if (unlisten) {
      unlisten();
    }
    set({ isListening: false, unlistenFunc: null });
    console.log("⏹️  Stopped listening for system monitor messages");
  },

  // Action: 清空历史数据
  clearHistory: () => {
    set({ historyData: [] });
  },
}));
