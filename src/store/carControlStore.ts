import { create } from "zustand";
import { invoke } from "@tauri-apps/api/core";
import { toast } from "sonner";
import { CanCommand, CarStates } from "@/types"; // 假设 types.ts 在同级目录
import { useSerialStore } from "./serialStore";
import { useDebugStore } from "./useDebugStore";
import { useCanMessageStore } from "./canMessageStore";
import { use3DStore } from "./car3DStore";
import { listen } from "@tauri-apps/api/event";
import { CAN_COMMANDS } from "@/config/canCommands";
import { handleDoorCommand } from "@/handlers/doorHandler";
import { handleSuspensionCommand } from "@/handlers/suspensionHandler";
import { handleStartDriving, handleStopDriving } from "@/handlers/driveHandler";
import { validateCanId } from "@/utils/validation";

interface CarControlStore {
  canCommands: CanCommand[];
  carStates: CarStates;

  progressIntervalId: NodeJS.Timeout | null;

  // Actions
  updateCanCommand: (
    commandId: string,
    field: keyof CanCommand,
    value: string
  ) => void;
  updateCarState: (commandId: string) => void;
  setCarState: (newState: Partial<CarStates>) => void;
  updateVehicleControl: (
    speed: number,
    steeringAngle: number,
    gear?: string
  ) => void;
  startCsvLoop: (
    onProgressUpdate?: (
      speed: number,
      steeringAngle: number,
      gear?: string
    ) => void
  ) => void;
  stopCsvLoop: () => Promise<void>;
  sendCarCommand: (commandId: string) => Promise<void>;
  sendCanCommand: (canId: string, data: string) => Promise<void>;
  csvLoopFinishListener: () => Promise<() => void>;
  unlistenCsvLoopFunc: (() => void) | null;
}

const initialCarStates: CarStates = {
  isDriving: false,
  leftDoorStatus: "停止",
  rightDoorStatus: "停止",
  fanLevel: 0,
  lightMode: 1,
  suspensionStatus: "停止",
  // 实时 CAN 数据
  currentSpeed: 0, // mm/s
  currentSteeringAngle: 0, // rad
  // 新协议数据
  gear: "P", // 档位 (P/R/N/D/S)
  steeringAngleDegrees: 0, // 转向角（度数）
};

const findCommandById = (
  commandId: string,
  canCommands: CanCommand[]
): CanCommand | undefined => {
  return canCommands.find((cmd) => cmd.id === commandId);
};

const commandStateMap: Partial<Record<string, Partial<CarStates>>> = {
  door_open: {
    leftDoorStatus: "开启",
    rightDoorStatus: "开启",
  },
  door_close: {
    leftDoorStatus: "关闭",
    rightDoorStatus: "关闭",
  },
  door_stop: {
    leftDoorStatus: "停止",
    rightDoorStatus: "停止",
  },
  fan_level_0: { fanLevel: 0 },
  fan_level_1: { fanLevel: 1 },
  fan_level_2: { fanLevel: 2 },
  fan_level_3: { fanLevel: 3 },
  light_mode_1: { lightMode: 1 },
  light_mode_2: { lightMode: 2 },
  light_mode_3: { lightMode: 3 },
  light_mode_4: { lightMode: 4 },
  start_driving: { isDriving: true },
  stop_driving: { isDriving: false },
  suspension_up: { suspensionStatus: "升高" },
  suspension_down: { suspensionStatus: "降低" },
  suspension_stop: { suspensionStatus: "正常" },
};

export const useCarControlStore = create<CarControlStore>((set, get) => ({
  // --- 状态 (State) ---
  canCommands: CAN_COMMANDS,
  carStates: initialCarStates,
  progressIntervalId: null,

  /**
   * 更新 CAN 命令配置
   */
  updateCanCommand: (commandId, field, value) => {
    set((state) => ({
      canCommands: state.canCommands.map((cmd) =>
        cmd.id === commandId ? { ...cmd, [field]: value } : cmd
      ),
    }));
  },
  /**
   * 更新车辆状态
   */
  updateCarState: (commandId) => {
    console.log(`🔄 updateCarState called with commandId: ${commandId}`);
    set((state) => {
      const newState = { ...state.carStates };
      const stateUpdate = commandStateMap[commandId];
      if (stateUpdate) {
        console.log(`📝 Applying state update for ${commandId}:`, stateUpdate);
        Object.assign(newState, stateUpdate);
        console.log(`✅ New state after update:`, newState);
      } else {
        console.warn(`⚠️ No state update found for commandId: ${commandId}`);
      }

      return { carStates: newState };
    });
  },
  /**
   * 发送 CAN 命令
   * @param canId 要发送的 CAN ID
   * @param data 要发送的 CAN Data
   */
  sendCanCommand: async (canId, data) => {
    // 1. 跨 Store 获取配置
    const config = useSerialStore.getState().config;
    // 2. 跨 Store 获取消息记录 Action
    const { addMessage } = useCanMessageStore.getState();

    try {
      // 验证 CAN ID
      const validation = validateCanId(canId, config.frameType);

      if (!validation.valid) {
        console.warn("❌ CAN ID 验证失败:", validation.error);
        toast.error(validation.error);
        return;
      }

      const params = {
        id: canId,
        data: data,
        frameType: config.frameType,
        protocolLength: config.protocolLength,
      };

      // 3. 调用后端 API
      await invoke("send_can_message", params);

      // 4. 记录消息到日志
      const newMessage = {
        id: canId,
        data: data,
        timestamp: new Date().toLocaleTimeString(),
        direction: "sent" as const, // 使用 'as const' 确保类型正确
        frameType: config.frameType as "standard" | "extended",
      };
      addMessage(newMessage);
    } catch (error) {
      console.error("Send car command error:", error);
      toast.error(`发送车辆命令错误: ${error}`);
      throw error; // 抛出错误以便上层调用者（如 sendCarCommand 的其他分支）捕获
    }
  },

  setCarState: (newState) => {
    set((state) => ({
      carStates: {
        ...state.carStates,
        ...newState, // 合并传入的新状态
      },
    }));
  },
  /**
   * 更新车辆控制量（速度和转向角）
   */
  updateVehicleControl: (speed, steeringAngle, gear?) => {
    set((state) => ({
      carStates: {
        ...state.carStates,
        currentSpeed: speed,
        currentSteeringAngle: steeringAngle,
        ...(gear && { gear }),
      },
    }));
  },
  // 开始循环发送CSV数据（使用预解析的数据）
  startCsvLoop: async (
    onProgressUpdate?: (
      speed: number,
      steeringAngle: number,
      gear?: string
    ) => void
  ) => {
    const { progressIntervalId, stopCsvLoop } = get();
    // 在设置新 interval 前确保清理旧的
    if (progressIntervalId) {
      clearInterval(progressIntervalId);
      set({ progressIntervalId: null });
    }
    const csvContent = useSerialStore.getState().driveData;
    const config = useSerialStore.getState().config;
    // 解构出需要的参数
    const {
      sendIntervalMs: intervalMs,
      canIdColumnIndex,
      canDataColumnIndex,
      csvStartRowIndex,
    } = config;
    try {
      console.log("🚀 startCsvLoop called with:", {
        csvContentLength: csvContent.length,
        intervalMs,
        canIdColumnIndex,
        canDataColumnIndex,
        csvStartRowIndex,
      });

      const { config } = useSerialStore.getState();

      // 第一步：预加载并解析 CSV 数据
      console.log("📂 Preloading CSV data...");
      const preloadedData = await invoke<any[]>("preload_csv_data", {
        csvContent: csvContent,
        canIdColumnIndex: canIdColumnIndex,
        canDataColumnIndex: canDataColumnIndex,
        csvStartRowIndex: csvStartRowIndex,
      });

      console.log(`✅ Preloaded ${preloadedData.length} records`);

      // 第二步：使用预解析的数据启动循环
      const result = await invoke("start_csv_loop_with_preloaded_data", {
        preloadedData: preloadedData,
        intervalMs: intervalMs,
        config: {
          port: config.port,
          baud_rate: config.baudRate,
          can_baud_rate: config.canBaudRate,
          frame_type: config.frameType,
          can_mode: config.canMode,
          protocol_length: config.protocolLength,
        },
      });

      console.log("✅ startCsvLoop result:", result);

      // 第三步：实时更新进度（模拟）
      if (onProgressUpdate && preloadedData.length > 0) {
        let currentIndex = 0;
        // 清除之前的 progressInterval（如果存在）
        if (progressIntervalId) {
          clearInterval(progressIntervalId);
        }

        const newIntervalId = setInterval(() => {
          if (currentIndex < preloadedData.length) {
            const data = preloadedData[currentIndex];
            if (data.vehicle_control) {
              onProgressUpdate(
                data.vehicle_control.linear_velocity_mms,
                data.vehicle_control.steering_angle,
                data.vehicle_control.gear_name
              );
            }
            currentIndex++;
          } else {
            stopCsvLoop();
          }
        }, intervalMs);

        // 将新的 Interval ID 存储到 Store 状态中
        set({ progressIntervalId: newIntervalId });
      }

      // 注意：不再使用前端定时器来判断完成时间
      // 改为由后端通过事件通知前端循环已完成
      // 这样可以避免前端计算不准确导致提前停止的问题
      console.log(
        `📊 CSV loop started with ${preloadedData.length} records at ${intervalMs}ms interval`
      );
    } catch (error) {
      console.error("❌ Failed to start CSV loop:", error);
      throw error;
    }
  },
  // 停止循环发送
  stopCsvLoop: async () => {
    set((state) => {
      if (state.progressIntervalId) {
        clearInterval(state.progressIntervalId);
        return { progressIntervalId: null };
      }
      return {};
    });
    // 清理事件监听器
    const { unlistenCsvLoopFunc } = get();
    if (unlistenCsvLoopFunc) {
      unlistenCsvLoopFunc();
      set({ unlistenCsvLoopFunc: null });
    }

    await invoke("stop_csv_loop");
    console.log("✓ 后端 CSV 循环已停止");
  },
  unlistenCsvLoopFunc: null,
  // 发送车辆控制命令
  sendCarCommand: async (commandId: string) => {
    console.log("📍 sendCarCommand called with:", commandId);
    const { config, driveData: csvContent } = useSerialStore.getState();
    const { addDebugLog } = useDebugStore.getState();

    const {
      updateVehicleControl,
      updateCarState,
      startCsvLoop,
      stopCsvLoop,
      sendCanCommand,
      canCommands,
    } = get();
    const command = findCommandById(commandId, canCommands);
    if (!command) {
      console.log("❌ Command not found:", commandId);
      return;
    }
    const {
      updateDriveAnimation,
      startDriveAnimation,
      stopDriveAnimation,
      suspensionAnimation,
    } = use3DStore.getState();

    try {
      // 处理"开始行驶"命令 - 使用CSV循环发送
      if (commandId === "start_driving") {
        handleStartDriving({
          config,
          csvContent,
          addDebugLog,
          updateVehicleControl,
          updateDriveAnimation,
          startCsvLoop,
          updateCarState,
          startDriveAnimation,
        });
      } else if (commandId === "stop_driving") {
        handleStopDriving({
          addDebugLog,
          stopCsvLoop,
          updateVehicleControl,
          updateCarState,
          stopDriveAnimation,
        });
      } else if (commandId === "door_open" || commandId === "door_close") {
        const stopCommand = findCommandById("door_stop", canCommands);
        if (!stopCommand) {
          console.error("❌ 未找到停止门命令");
          return;
        }
        const params = {
          commandId,
          command,
          stopCommand,
          sendCanCommand,
          updateCarState,
          addDebugLog,
        };
        handleDoorCommand(params);
      } else if (
        commandId === "suspension_up" ||
        commandId === "suspension_down"
      ) {
        const stopCommand = findCommandById("suspension_stop", canCommands);
        if (!stopCommand) {
          console.error("❌ 未找到停止 suspension 命令");
          return;
        }
        handleSuspensionCommand({
          commandId,
          command,
          stopCommand,
          sendCanCommand,
          updateCarState,
          suspensionAnimation,
          addDebugLog,
        });
      } else {
        // 其他命令 - 发送单个CAN消息
        addDebugLog(
          "发送CAN命令",
          commandId,
          command.canId,
          command.data,
          command.description
        );
        await sendCanCommand(command.canId, command.data);
        updateCarState(commandId);
      }
    } catch (error) {
      console.error("Send car command error:", error);
      toast.error(`发送车辆命令错误: ${error}`);
    }
  },

  csvLoopFinishListener: async () => {
    console.log("🔧 csvLoopFinishListener: Starting to setup listener");
    const { unlistenCsvLoopFunc } = get();

    if (unlistenCsvLoopFunc) {
      console.log("🔧 csvLoopFinishListener: Cleaning up old listener");
      unlistenCsvLoopFunc();
    }

    console.log(
      "🔧 csvLoopFinishListener: Calling listen() for 'csv-loop-completed'"
    );
    const unlisten = await listen<any>("csv-loop-completed", (event) => {
      console.log("🎉 CSV loop completed event received.", event);
      console.log(
        "📍 Current isDriving state before stop:",
        get().carStates.isDriving
      );

      // 调用 stop_driving 命令
      get()
        .sendCarCommand("stop_driving")
        .then(() => {
          console.log("✅ Stop driving command completed");
          console.log(
            "📍 Current isDriving state after stop:",
            get().carStates.isDriving
          );
        })
        .catch((error) => {
          console.error("❌ Failed to stop driving:", error);
        });
    });

    console.log(
      "✅ csvLoopFinishListener: Listener setup complete, storing unlisten function"
    );
    set({ unlistenCsvLoopFunc: unlisten });
    return unlisten;
  },
}));
