import { create } from "zustand";
import { invoke } from "@tauri-apps/api/core";
import { toast } from "sonner";
import { CanCommand, CarStates } from "@/types"; // 假设 types.ts 在同级目录
import { useSerialStore } from "./serialStore";
import { useDebugStore } from "./useDebugStore";
import { useCanMessageStore } from "./canMessageStore";
import { use3DStore } from "./car3DStore";
import { listen } from "@tauri-apps/api/event";

const validateCanId = (
  id: string,
  frameType: string
): { valid: boolean; error?: string } => {
  // ... (原 useCanMessages 中的 validateCanId 逻辑)
  try {
    const idHex = id.toLowerCase().replace(/^0x/, "");
    if (!/^[0-9a-f]+$/.test(idHex)) {
      return { valid: false, error: "CAN ID 必须是有效的十六进制数" };
    }
    const canId = parseInt(idHex, 16);
    if (frameType === "standard" && canId > 0x7ff) {
      return { valid: false, error: `标准帧 CAN ID 不能超过 0x7FF` };
    } else if (frameType === "extended" && canId > 0x1fffffff) {
      return { valid: false, error: `扩展帧 CAN ID 不能超过 0x1FFFFFFF` };
    }
    return { valid: true };
  } catch (error) {
    return { valid: false, error: "CAN ID 格式错误" };
  }
};

const CAN_COMMANDS: CanCommand[] = [
  {
    id: "door_open",
    name: "车门开启",
    canId: "201",
    data: "FF 02 FF FF 00 00 00 00",
    description: "打开左右车门",
  },
  {
    id: "door_close",
    name: "车门关闭",
    canId: "201",
    data: "FF 01 FF FF 00 00 00 00",
    description: "关闭左右车门",
  },
  {
    id: "door_stop",
    name: "车门停止",
    canId: "201",
    data: "FF 03 FF FF 00 00 00 00",
    description: "停止左右车门",
  },
  {
    id: "fan_level_0",
    name: "风扇档位0",
    canId: "201",
    data: "00 FF FF FF 00 00 00 00",
    description: "风扇档位0",
  },
  {
    id: "fan_level_1",
    name: "风扇档位1",
    canId: "201",
    data: "01 FF FF FF 00 00 00 00",
    description: "风扇档位1",
  },
  {
    id: "fan_level_2",
    name: "风扇档位2",
    canId: "201",
    data: "02 FF FF FF 00 00 00 00",
    description: "风扇档位2",
  },
  {
    id: "fan_level_3",
    name: "风扇档位3",
    canId: "201",
    data: "03 FF FF FF 00 00 00 00",
    description: "风扇档位3",
  },
  {
    id: "light_mode_1",
    name: "灯带模式1",
    canId: "201",
    data: "FF FF FF 01 00 00 00 00",
    description: "灯带模式1",
  },
  {
    id: "light_mode_2",
    name: "灯带模式2",
    canId: "201",
    data: "FF FF FF 02 00 00 00 00",
    description: "灯带模式2",
  },
  {
    id: "light_mode_3",
    name: "灯带模式3",
    canId: "201",
    data: "FF FF FF 03 00 00 00 00",
    description: "灯带模式3",
  },
  {
    id: "light_mode_4",
    name: "灯带模式4",
    canId: "201",
    data: "FF FF FF 04 00 00 00 00",
    description: "灯带模式4",
  },
  {
    id: "start_driving",
    name: "开始行驶",
    canId: "200",
    data: "0B B8 FF 07 00 00 00 00",
    description: "开始车辆行驶动画",
  },
  {
    id: "stop_driving",
    name: "停止行驶",
    canId: "200",
    data: "00 00 00 00 00 00 00 00",
    description: "停止车辆行驶动画",
  },
  {
    id: "suspension_up",
    name: "悬架升高",
    canId: "201",
    data: "FF FF 01 FF 00 00 00 00",
    description: "升高车辆悬架",
  },
  {
    id: "suspension_down",
    name: "悬架降低",
    canId: "201",
    data: "FF FF 02 FF 00 00 00 00",
    description: "降低车辆悬架",
  },
  {
    id: "suspension_stop",
    name: "悬架降低",
    canId: "201",
    data: "FF FF 03 FF 00 00 00 00",
    description: "停止车辆悬架",
  },
];

interface CarControlStore {
  canCommands: CanCommand[];
  carStates: CarStates;

  // --- 内部 Ref 变量，用于管理定时器 ID ---
  // 存储在 Store 状态中，可以被 set/get 访问
  progressIntervalId: NodeJS.Timeout | null;
  completeTimeoutId: NodeJS.Timeout | null;
  suspensionTimeoutId: NodeJS.Timeout | null;

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
  csvLoopFinishListener: () => void;
  unlistenCsvLoopFunc: (() => void) | null;
  stopCsvLoopListen: () => void;
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

export const useCarControlStore = create<CarControlStore>((set, get) => ({
  // --- 状态 (State) ---
  canCommands: CAN_COMMANDS,
  carStates: initialCarStates,
  progressIntervalId: null,
  completeTimeoutId: null,
  suspensionTimeoutId: null,

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
    set((state) => {
      const newState = { ...state.carStates };

      switch (commandId) {
        case "door_open":
          newState.leftDoorStatus = "开启";
          newState.rightDoorStatus = "开启";
          break;
        case "door_close":
          newState.leftDoorStatus = "关闭";
          newState.rightDoorStatus = "关闭";
          break;
        case "door_stop":
          newState.leftDoorStatus = "停止";
          newState.rightDoorStatus = "停止";
          break;
        case "fan_level_0":
          newState.fanLevel = 0;
          break;
        case "fan_level_1":
          newState.fanLevel = 1;
          break;
        case "fan_level_2":
          newState.fanLevel = 2;
          break;
        case "fan_level_3":
          newState.fanLevel = 3;
          break;
        case "light_mode_1":
          newState.lightMode = 1;
          break;
        case "light_mode_2":
          newState.lightMode = 2;
          break;
        case "light_mode_3":
          newState.lightMode = 3;
          break;
        case "light_mode_4":
          newState.lightMode = 4;
          break;
        case "start_driving":
          newState.isDriving = true;
          break;
        case "stop_driving":
          newState.isDriving = false;
          break;
        case "suspension_up":
          newState.suspensionStatus = "升高";
          break;
        case "suspension_down":
          newState.suspensionStatus = "降低";
          break;
        case "suspension_stop":
          newState.suspensionStatus = "正常";
          break;
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
        currentSpeed: speed, // 假设速度单位是 m/s
        currentSteeringAngle: steeringAngle, // 假设转向角度单位是度
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
                data.vehicle_control.steering_angle_rad,
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
    const { progressIntervalId, completeTimeoutId } = get();
    try {
      // 清除前端的定时器
      if (progressIntervalId) clearInterval(progressIntervalId);
      if (completeTimeoutId) clearTimeout(completeTimeoutId);

      // 清理 Store 状态中的 ID
      set({ progressIntervalId: null, completeTimeoutId: null });

      // 调用后端停止 CSV 循环
      await invoke("stop_csv_loop");
      console.log("✓ 后端 CSV 循环已停止");
    } catch (error) {
      console.error("Failed to stop CSV loop:", error);
      throw error;
    }
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
      suspensionTimeoutId,
      sendCarCommand: internalSendCarCommand,
      canCommands,
    } = get();
    const command = canCommands.find((cmd) => cmd.id === commandId);
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
        console.log("🚗 Start driving command detected");

        if (!config.csvFilePath || !csvContent) {
          console.error("❌ CSV file not selected");
          return;
        }
        if (!config.sendIntervalMs || config.sendIntervalMs < 1) {
          console.error("❌ Invalid send interval");
          alert("请设置有效的发送间隔（>= 1ms）");
          return;
        }

        console.log("✅ All validations passed, starting CSV loop");
        addDebugLog(
          "开始CSV循环发送",
          commandId,
          "CSV",
          config.csvFilePath,
          `间隔: ${config.sendIntervalMs}ms, 开始行: ${
            config.csvStartRowIndex || 0
          }`
        );

        // 定义进度更新回调
        const onProgressUpdate = (
          speed: number,
          steeringAngle: number,
          gear?: string
        ) => {
          // steeringAngle 已经是轮胎转向角（从新的8字节数据格式解析），单位是弧度
          // 不需要再进行转向比转换

          // todo 计算方向盘转向角用于显示（方向盘转向角 = 轮胎转向角 * 转向比）
          // const steeringWheelAngle = steeringAngle * STEERING_RATIO;

          // 更新状态面板显示方向盘转向角和档位
          updateVehicleControl(speed, steeringAngle, gear);

          // 同时更新3D场景中的车身旋转（基于自行车模型） 使用轮胎转向角来计算车身旋转
          updateDriveAnimation(speed, steeringAngle);
        };

        await startCsvLoop(onProgressUpdate);
        updateCarState(commandId);

        // 触发3D动画
        startDriveAnimation();
      } else if (commandId === "stop_driving") {
        // 停止循环发送
        addDebugLog(
          "停止CSV循环发送",
          commandId,
          "CSV",
          "停止",
          "停止循环发送"
        );

        await stopCsvLoop();
        // 更新状态面板显示方向盘转向角
        updateVehicleControl(0, 0);
        updateCarState(commandId);
        stopDriveAnimation();
      } else if (commandId === "door_open" || commandId === "door_close") {
        // 门命令 - 发送开/关命令，动画结束后自动发送停止信号
        addDebugLog(
          "发送车门命令",
          commandId,
          command.canId,
          command.data,
          command.description
        );

        await sendCanCommand(command.canId, command.data);
        updateCarState(commandId);

        // 门动画持续时间约为 4 秒，动画结束后自动发送停止信号
        const doorAnimationDuration = 4000; // 毫秒
        setTimeout(async () => {
          console.log("🚪 门动画结束，自动发送停止信号");
          const stopCommand = canCommands.find((cmd) => cmd.id === "door_stop");
          if (stopCommand) {
            addDebugLog(
              "自动发送车门停止",
              "door_stop",
              stopCommand.canId,
              stopCommand.data,
              "门动画结束后自动停止"
            );
            await sendCanCommand(stopCommand.canId, stopCommand.data);
            updateCarState("door_stop");
          }
        }, doorAnimationDuration);
      } else if (commandId === "suspension_up") {
        // 悬挂升高命令
        addDebugLog(
          "发送悬挂升高命令",
          commandId,
          command.canId,
          command.data,
          command.description
        );

        await sendCanCommand(command.canId, command.data);
        updateCarState(commandId);
        suspensionAnimation("up");
        // 2秒后自动发送停止命令
        if (suspensionTimeoutId) {
          clearTimeout(suspensionTimeoutId);
        }
        const newSuspensionTimeoutId = setTimeout(() => {
          internalSendCarCommand("suspension_stop");
        }, 4000);
        set({ suspensionTimeoutId: newSuspensionTimeoutId });
      } else if (commandId === "suspension_down") {
        // 悬挂降低命令
        addDebugLog(
          "发送悬挂降低命令",
          commandId,
          command.canId,
          command.data,
          command.description
        );

        await sendCanCommand(command.canId, command.data);
        updateCarState(commandId);

        suspensionAnimation("down");

        // 2秒后自动发送停止命令
        if (suspensionTimeoutId) {
          clearTimeout(suspensionTimeoutId);
        }
        const newSuspensionTimeoutId = setTimeout(() => {
          internalSendCarCommand("suspension_stop");
        }, 4000);
        set({ suspensionTimeoutId: newSuspensionTimeoutId });
      } else if (commandId === "suspension_stop") {
        // 悬挂停止命令
        addDebugLog(
          "发送悬挂停止命令",
          commandId,
          command.canId,
          command.data,
          command.description
        );

        await sendCanCommand(command.canId, command.data);
        updateCarState("suspension_stop");

        suspensionAnimation("stop");

        // 清除定时器
        if (suspensionTimeoutId) {
          clearTimeout(suspensionTimeoutId);
          set({ suspensionTimeoutId: null });
        }
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
    const { sendCarCommand, unlistenCsvLoopFunc } = get();
    try {
      if (!unlistenCsvLoopFunc) {
        const unlistenCsvLoopFunc = await listen<any>(
          "csv-loop-completed",
          () => {
            // addDebugLog(
            //   "CSV循环完成事件",
            //   "csv_loop_completed",
            //   "CSV",
            //   "完成",
            //   "后端已完成所有数据发送"
            // );
            sendCarCommand("stop_driving");
            set({ unlistenCsvLoopFunc });
          }
        );
      }
    } catch (error) {
      console.error("Failed to setup CSV loop listener:", error);
    }
  },
  stopCsvLoopListen: () => {
    const { unlistenCsvLoopFunc } = get();
    if (unlistenCsvLoopFunc) {
      unlistenCsvLoopFunc();
      set({ unlistenCsvLoopFunc: null });
    }
  },
}));
