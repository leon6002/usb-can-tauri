import { create } from "zustand";
import { listen } from "@tauri-apps/api/event";
import { RadarDistances, RadarData, RadarMessage } from "../types";
import { useCarControlStore } from "./carControlStore";
import { getRadarQueryInterval } from "@/config/appConfig";

// 雷达CAN ID映射（8位十六进制格式）
const RADAR_CAN_IDS = {
  RADAR_1: "0x00000521",
  RADAR_2: "0x00000522",
  RADAR_3: "0x00000523",
  RADAR_4: "0x00000524",
};

interface RadarState {
  //States
  radarDistances: RadarDistances;
  isListening: boolean;
  radarIntervalId: NodeJS.Timeout | null;

  // Actions
  setRadarData: (message: RadarMessage) => void;
  startListening: () => Promise<void>;
  stopListening: () => void;
  clearRadarData: () => void;
  sendRadarQuery: () => Promise<void>;
  unlistenFunc: (() => void) | null;
  manageRadar: (isConnected: boolean) => void;
}

// 例如：0x01 83 02 02 F2 -> 取最后两个字节 02 F2 -> 0x02F2 = 754mm
const parseDistanceFromData = (data: string): number => {
  try {
    // 移除空格并转换为大写
    const cleanData = data.replace(/\s+/g, "").toUpperCase();
    console.log("📏 [Radar] Raw data:", data, "Clean data:", cleanData);

    // 获取最后4个字符（最后两个字节）
    if (cleanData.length >= 4) {
      const lastTwoBytes = cleanData.slice(-4);
      const distance = parseInt(lastTwoBytes, 16);
      console.log(
        "📏 [Radar] Last two bytes:",
        lastTwoBytes,
        "Distance:",
        distance,
        "mm"
      );
      return distance;
    }
    console.warn("⚠️  [Radar] Data too short:", cleanData);
    return 0;
  } catch (error) {
    console.error("❌ [Radar] Error parsing distance from data:", error);
    return 0;
  }
};

export const useRadarStore = create<RadarState>((set, get) => ({
  // 状态
  radarDistances: {
    radar1: null,
    radar2: null,
    radar3: null,
    radar4: null,
    lastUpdate: new Date().toLocaleTimeString(),
  },
  isListening: false,
  unlistenFunc: null,
  radarIntervalId: null,

  // Action: 处理雷达消息并更新状态
  setRadarData: (message: RadarMessage) => {
    const distance = parseDistanceFromData(message.data);
    const timestamp = new Date().toLocaleTimeString();

    const radarData: RadarData = {
      id: message.canId,
      distance,
      rawData: message.data,
      timestamp,
    };

    set((state) => {
      let updatedDistances = state.radarDistances;
      let hasChanged = false;

      // ... 保持原有的根据 CAN ID 更新 state 的逻辑 ...
      if (
        message.canId === RADAR_CAN_IDS.RADAR_1 &&
        state.radarDistances.radar1?.distance !== distance
      ) {
        updatedDistances = { ...updatedDistances, radar1: radarData };
        hasChanged = true;
      }
      if (
        message.canId === RADAR_CAN_IDS.RADAR_2 &&
        state.radarDistances.radar2?.distance !== distance
      ) {
        updatedDistances = { ...updatedDistances, radar2: radarData };
        hasChanged = true;
      }
      if (
        message.canId === RADAR_CAN_IDS.RADAR_3 &&
        state.radarDistances.radar3?.distance !== distance
      ) {
        updatedDistances = { ...updatedDistances, radar3: radarData };
        hasChanged = true;
      }
      if (
        message.canId === RADAR_CAN_IDS.RADAR_4 &&
        state.radarDistances.radar4?.distance !== distance
      ) {
        updatedDistances = { ...updatedDistances, radar4: radarData };
        hasChanged = true;
      }

      // 只有当数据实际改变时才更新整个 store
      return hasChanged
        ? { radarDistances: { ...updatedDistances, lastUpdate: timestamp } }
        : state;
    });
  },

  // Action: 启动监听
  startListening: async () => {
    try {
      if (get().unlistenFunc) return; // 避免重复监听

      const unlisten = await listen<RadarMessage>("radar-message", (event) => {
        get().setRadarData(event.payload); // 调用 Store 的 Action
      });

      set({ isListening: true, unlistenFunc: unlisten });
      console.log("✅ Started listening for radar messages (Zustand)");
    } catch (error) {
      console.error("❌ Failed to start listening for radar messages:", error);
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
    console.log("⏹️  Stopped listening for radar messages (Zustand)");
  },

  // 发送雷达查询命令
  sendRadarQuery: async () => {
    const { sendCanCommand } = useCarControlStore.getState();

    // 雷达查询命令配置
    const RADAR_QUERIES = [
      { id: "0x521", data: "01 03 01 00 00 01" },
      { id: "0x522", data: "02 03 01 00 00 01" },
      { id: "0x523", data: "03 03 01 00 00 01" },
      { id: "0x524", data: "04 03 01 00 00 01" },
    ];

    try {
      for (const radar of RADAR_QUERIES) {
        await sendCanCommand(radar.id, radar.data);
        console.log(`📡 [Radar] Sent radar query: ${radar.id} ${radar.data}`);
      }
    } catch (error) {
      console.error("❌ Failed to send radar query:", error);
    }
  },

  // Action: 清空数据
  clearRadarData: () => {
    set({
      radarDistances: {
        radar1: null,
        radar2: null,
        radar3: null,
        radar4: null,
        lastUpdate: new Date().toLocaleTimeString(),
      },
    });
  },

  // 辅助 Getter (可选，直接在组件中使用 selector 更常见)
  getAllDistances: () => {
    const radarDistances = get().radarDistances;
    return {
      radar1: radarDistances.radar1?.distance ?? null,
      radar2: radarDistances.radar2?.distance ?? null,
      radar3: radarDistances.radar3?.distance ?? null,
      radar4: radarDistances.radar4?.distance ?? null,
    };
  },
  manageRadar: (isConnected: boolean) => {
    const {
      startListening,
      stopListening,
      unlistenFunc,
      sendRadarQuery,
      radarIntervalId,
    } = get();
    if (isConnected) {
      // 启动监听
      if (!unlistenFunc) {
        startListening();
      }

      // 启动定时发送查询
      if (!radarIntervalId) {
        const radarInterval = getRadarQueryInterval();
        const intervalId = setInterval(() => {
          sendRadarQuery();
        }, radarInterval);
        set({ radarIntervalId: intervalId }); // 存储 interval ID
      }
    } else {
      // 停止监听
      if (unlistenFunc) {
        stopListening();
      }

      // 停止定时发送查询
      if (radarIntervalId) {
        clearInterval(radarIntervalId);
        set({ radarIntervalId: null });
      }
    }
  },
}));
