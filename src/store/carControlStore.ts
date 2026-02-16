import { create } from "zustand";
import { invoke } from "@tauri-apps/api/core";
import { toast } from "sonner";
import { CanCommand, CarStates } from "@/types"; // 假设 types.ts 在同级目录
import { useSerialStore } from "./serialStore";
import { useDebugStore } from "./useDebugStore";
import { useCanMessageStore } from "./canMessageStore";
import { use3DStore } from "./car3DStore";
import { listen, UnlistenFn } from "@tauri-apps/api/event";
import { CAN_COMMANDS } from "@/config/canCommands";
import { handleDoorCommand } from "@/handlers/doorHandler";
import { handleSuspensionCommand } from "@/handlers/suspensionHandler";
// import { handleStartDriving, handleStopDriving } from "@/handlers/driveHandler";
import { validateCanId } from "@/utils/validation";
import { buildVehicleControlData } from "@/utils/canProtocol";

// Tracking variables for signal optimization
let lastSentSpeed: number | null = null;
let lastSentAngle: number | null = null;
let lastSentTime = 0;

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
  startInfiniteDrive: (
    onProgressUpdate?: (
      speed: number,
      steeringAngle: number,
      gear?: string
    ) => void
  ) => Promise<void>;
  stopAutoDrive: () => Promise<void>;
  sendCarCommand: (commandId: string) => Promise<void>;
  sendCanCommand: (canId: string, data: string) => Promise<void>;

  sendVehicleControlCommand: (speed: number, angle: number) => Promise<void>;
  csvLoopFinishListener: () => Promise<UnlistenFn>;
  unlistenCsvLoopFunc: UnlistenFn | null;
  unlistenCsvProgressFunc: UnlistenFn | null;

  // Realtime Feedback
  unlistenFeedbackFunc: UnlistenFn | null;
  startFeedbackListener: () => Promise<void>;
  stopFeedbackListener: () => void;
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
  currentSteeringAngle: 0, // degree
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
  unlistenCsvLoopFunc: null,
  unlistenCsvProgressFunc: null,

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
      toast.error(`send can command error: ${error}`);
      throw error; // 抛出错误以便上层调用者（如 sendCarCommand 的其他分支）捕获
    }
  },

  sendVehicleControlCommand: async (speed, angle) => {
    try {
      const now = Date.now();
      const HEARTBEAT_INTERVAL = 1000; // 1 second heartbeat

      // Check if values changed or heartbeat interval passed
      const hasChanged =
        lastSentSpeed === null ||
        lastSentAngle === null ||
        speed !== lastSentSpeed ||
        Math.abs(angle - lastSentAngle) > 0.001; // Float comparison

      const timeSinceLastSend = now - lastSentTime;
      const shouldSend = hasChanged || timeSinceLastSend >= HEARTBEAT_INTERVAL;

      if (!shouldSend) {
        return;
      }

      const data = buildVehicleControlData(speed, angle);
      const params = {
        id: '200',
        data: data,
        frameType: "standard",
        protocolLength: "fixed",
      };
      await invoke("send_can_message", params);

      // Update tracking variables
      lastSentSpeed = speed;
      lastSentAngle = angle;
      lastSentTime = now;
    } catch (error) {
      console.error("Send vehicle control command error:", error);
      // toast.error(`Send vehicle control command error: ${error}`);
      // throw error;
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
  updateVehicleControl: (speed, steeringAngle, gear) => {
    set((state) => ({
      carStates: {
        ...state.carStates,
        currentSpeed: speed,
        currentSteeringAngle: steeringAngle,
        gear: gear || state.carStates.gear, // Update gear if provided, otherwise keep current
      },
    }));
  },
  // 开始循环发送CSV数据（使用预解析的数据）
  startInfiniteDrive: async (
    onProgressUpdate?: (
      speed: number,
      steeringAngle: number,
      gear?: string
    ) => void
  ) => {
    try {
      console.log("🚀 Starting Infinite Drive");

      // Setup listener (same as startCsvLoop)
      if (onProgressUpdate) {
        const { unlistenCsvProgressFunc } = get();
        if (unlistenCsvProgressFunc) {
          unlistenCsvProgressFunc();
        }

        console.log("🎧 Setting up listener for infinite drive progress");
        const unlisten = await listen<any>("auto-drive-progress", (event) => {
          const { vehicle_control } = event.payload;
          if (vehicle_control) {
            onProgressUpdate(
              vehicle_control.linear_velocity_mms,
              vehicle_control.steering_angle,
              vehicle_control.gear_name
            );
          }
        });

        set({ unlistenCsvProgressFunc: unlisten });
      }

      await invoke("start_infinite_drive");

      // Set driving state
      set((state) => ({
        carStates: { ...state.carStates, isDriving: true }
      }));

      // toast.success("Infinite Drive Started");
    } catch (error) {
      console.error("❌ Failed to start infinite drive:", error);
      toast.error(`Failed to start infinite drive: ${error}`);
      throw error;
    }
  },

  // 停止自动驾驶
  stopAutoDrive: async () => {
    set((state) => {
      if (state.progressIntervalId) {
        clearTimeout(state.progressIntervalId);
        return { progressIntervalId: null };
      }
      return {};
    });
    // 清理事件监听器
    const { unlistenCsvLoopFunc, unlistenCsvProgressFunc } = get();
    if (unlistenCsvLoopFunc) {
      unlistenCsvLoopFunc();
      set({ unlistenCsvLoopFunc: null });
    }
    if (unlistenCsvProgressFunc) {
      unlistenCsvProgressFunc();
      set({ unlistenCsvProgressFunc: null });
    }

    try {
      await invoke("stop_infinite_drive");
    } catch (e) {
      // Ignore error if not running
    }
    console.log("✓ Auto Drive Stopped");
  },

  // 发送车辆控制命令
  sendCarCommand: async (commandId: string) => {
    console.log("📍 sendCarCommand called with:", commandId);
    // const { config, driveData: csvContent } = useSerialStore.getState();
    const { addDebugLog } = useDebugStore.getState();

    const {
      updateVehicleControl,
      updateCarState,
      startInfiniteDrive,
      stopAutoDrive,
      sendCanCommand,
      canCommands,
    } = get();
    const command = findCommandById(commandId, canCommands);
    if (!command) {
      console.log("❌ Command not found:", commandId);
      return;
    }
    const {
      startDriveAnimation,
      stopDriveAnimation,
      suspensionAnimation,
      updateDriveAnimation, // Need this for the callback
    } = use3DStore.getState();

    try {
      // 处理"开始行驶"命令 - 使用CSV循环发送
      if (commandId === "start_driving") {
        // handleStartDriving({
        //   config,
        //   csvContent,
        //   addDebugLog,
        //   updateVehicleControl,
        //   updateDriveAnimation,
        //   startCsvLoop,
        //   updateCarState,
        //   startDriveAnimation,
        // });
        // Define progress update callback (similar to handleStartDriving)
        const onProgressUpdate = (
          speed: number,
          steeringAngle: number,
          gear?: string
        ) => {
          // Update status panel
          updateVehicleControl(speed, steeringAngle, gear);
          // Update 3D scene
          updateDriveAnimation(speed, steeringAngle);
        };

        // Send CAN initialization command (0x421)
        const enableCanCommand = findCommandById("enable_can_mode", canCommands);
        if (enableCanCommand) {
          console.log("⚡ Sending CAN Mode Enable Command (0x421)");
          await sendCanCommand(enableCanCommand.canId, enableCanCommand.data);
          // Wait briefly for the vehicle to accept the command
          await new Promise((resolve) => setTimeout(resolve, 500));
        } else {
          console.warn("⚠️ 'enable_can_mode' command not found, skipping initialization");
        }

        // Use new Infinite Drive logic with callback
        startInfiniteDrive(onProgressUpdate);
        updateCarState(commandId);
        startDriveAnimation();
      } else if (commandId === "stop_driving") {
        // handleStopDriving({
        //   addDebugLog,
        //   stopCsvLoop,
        //   updateVehicleControl,
        //   updateCarState,
        //   stopDriveAnimation,
        // });
        // Stop Infinite Drive
        stopAutoDrive(); // This now stops both
        updateVehicleControl(0, 0);
        updateCarState(commandId);
        stopDriveAnimation();
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
    const unlisten = await listen<any>("auto-drive-completed", (event) => {
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

  // --- Realtime Vehicle Feedback Listener ---
  unlistenFeedbackFunc: null,

  startFeedbackListener: async () => {
    const { unlistenFeedbackFunc } = get();
    if (unlistenFeedbackFunc) return;

    console.log("🎧 Starting Vehicle Feedback Listener");
    
    // Listen for vehicle feedback (0x221)
    const unlisten = await listen<any>("vehicle-feedback", (event: any) => {
      const { speed_mms, steering_angle_rad_1000 } = event.payload;

      // Convert units
      // Speed: mm/s -> mm/s (no change needed for currentSpeed state)
      const speed = speed_mms; 

      // Steering: 0.001 rad -> degrees
      // rad = raw / 1000
      // deg = rad * (180/PI)
      const angleRad = steering_angle_rad_1000 / 1000.0;
      const angleDeg = (angleRad * 180.0) / Math.PI;

      // Update store state directly
      // Note: This overrides command loop updates if they happen simultaneously,
      // which is desired as this is 'real' feedback.
      if (speed !== undefined && angleDeg !== undefined) {
          set((state) => ({
              carStates: {
                  ...state.carStates,
                  currentSpeed: speed,
                  currentSteeringAngle: angleDeg,
              }
          }));
      }
    });

    set({ unlistenFeedbackFunc: unlisten });
  },

  stopFeedbackListener: () => {
      const { unlistenFeedbackFunc } = get();
      if (unlistenFeedbackFunc) {
          unlistenFeedbackFunc();
          set({ unlistenFeedbackFunc: null });
          console.log("🛑 Stopped Vehicle Feedback Listener");
      }
  },

}));
