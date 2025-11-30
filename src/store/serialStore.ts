// serialStore.ts

import { create } from "zustand";
import { invoke } from "@tauri-apps/api/core";
import { toast } from "sonner";
import { SerialConfig } from "@/types"; // 假设 types.ts 在同级目录
import { loadDefaultCsv } from "@/utils/csvLoader"; // 假设 csvLoader.ts 存在

// 1. 定义 Store 接口
interface SerialState {
  isConnected: boolean;
  availablePorts: string[];
  config: SerialConfig;
  driveData: string;

  // Actions
  updateConfig: (newConfig: Partial<SerialConfig>) => void;
  updateDriveData: (driveData: string) => void;
  initializeSerial: () => Promise<void>;
  handleConnect: () => Promise<void>;
  handleDisconnect: (silent?: boolean) => Promise<void>;
  connectToPort: (port: string) => Promise<void>;
}

// 默认配置
const initialConfig: SerialConfig = {
  port: undefined,
  baudRate: 2000000,
  canBaudRate: 500000,
  frameType: "standard",
  protocolLength: "fixed",
  canMode: "normal",
  sendIntervalMs: 20,
  canIdColumnIndex: 0,
  canDataColumnIndex: 1,
  csvStartRowIndex: 1,
};

// 2. 创建 Zustand Store
export const useSerialStore = create<SerialState>((set, get) => ({
  // --- 状态 (State) ---
  isConnected: false,
  availablePorts: [],
  config: initialConfig,
  driveData: "",

  // --- 操作 (Actions) ---

  /**
   * 更新配置项（支持部分更新）
   * @param newConfig 部分新的配置对象
   */
  updateConfig: (newConfig) => {
    set((state) => ({
      config: {
        ...state.config,
        ...newConfig,
      },
    }));
  },

  updateDriveData: (driveData: string) => {
    set({ driveData });
  },

  /**
   * 应用初始化时运行的逻辑：获取端口和加载默认 CSV。
   */
  initializeSerial: async () => {
    try {
      // 获取可用串口
      const ports = await invoke<string[]>("get_available_ports");

      // 加载预置的示例数据
      console.log("📂 Loading preset CSV data on app startup...");
      const csvRows = await loadDefaultCsv();
      console.log(`loaded ${csvRows.length} rows from preset CSV`);
      const csvText = [
        "can_id,can_data,interval_ms",
        ...csvRows.map(
          (row) => `${row.can_id},${row.can_data},${row.interval_ms}`
        ),
      ].join("\n");

      // 批量更新状态
      set((state) => ({
        availablePorts: ports,
        config: {
          ...state.config,
          csvFilePath: "sample-trajectory.csv (预置)",
        },
        driveData: csvText,
      }));
      console.log("✅ Preset CSV data loaded successfully");
    } catch (error) {
      console.error("Failed to initialize app:", error);
    }
  },

  /**
   * 连接/断开串口的通用处理函数
   */
  handleConnect: async () => {
    const { isConnected, config } = get(); // 从 Store 获取当前状态

    try {
      if (isConnected) {
        // 断开连接
        await invoke("disconnect_serial");
        set({ isConnected: false });
        toast.success("已断开连接");
      } else {
        // 连接
        // 转换字段名为 Rust 后端期望的格式
        const rustConfig = {
          port: config.port,
          baud_rate: config.baudRate,
          can_baud_rate: config.canBaudRate,
          frame_type: config.frameType,
          can_mode: config.canMode,
          protocol_length: config.protocolLength,
        };
        await invoke("connect_serial", { config: rustConfig });
        set({ isConnected: true });
        toast.success(`已连接到 ${config.port}`);
      }
    } catch (error) {
      console.error("Connection error:", error);
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      toast.error(`连接错误: ${errorMessage}`);
    }
  },

  /**
   * 仅断开连接
   * @param silent - 是否静默断开（不显示 toast）
   */
  handleDisconnect: async (silent = false) => {
    try {
      await invoke("disconnect_serial");
      set({ isConnected: false });
      if (!silent) {
        toast.success("已断开连接");
      }
    } catch (error) {
      console.error("Disconnect error:", error);
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      if (!silent) {
        toast.error(`断开连接错误: ${errorMessage}`);
      }
    }
  },

  /**
   * 连接到指定端口（用于演示模式快速连接）
   */
  connectToPort: async (port) => {
    const { config } = get();

    try {
      const rustConfig = {
        port,
        baud_rate: config.baudRate,
        can_baud_rate: config.canBaudRate,
        frame_type: config.frameType,
        can_mode: config.canMode,
        protocol_length: config.protocolLength,
      };
      await invoke("connect_serial", { config: rustConfig });
      set((state) => ({
        isConnected: true,
        config: {
          ...state.config,
          port,
        },
      }));
    } catch (error) {
      console.error("Connection error:", error);
      throw error;
    }
  },
}));
