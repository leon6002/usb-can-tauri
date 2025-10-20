import { useState, useRef } from "react";
import { CarStates, CanCommand } from "../types";
import { invoke } from "@tauri-apps/api/core";

export const useCarControl = () => {
  const loopIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const progressIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const completeTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  // Car control commands configuration
  const [canCommands, setCanCommands] = useState<CanCommand[]>([
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
  ]);

  // Car control states
  const [carStates, setCarStates] = useState<CarStates>({
    isDriving: false,
    leftDoorStatus: "停止",
    rightDoorStatus: "停止",
    fanLevel: 0,
    lightMode: 1,
    suspensionStatus: "正常",
    currentSpeed: 0,
    currentSteeringAngle: 0,
  });

  // 更新实时 CAN 数据（速度、转向角和档位）
  const updateVehicleControl = (speed: number, steeringAngle: number, gear?: string) => {
    setCarStates((prev) => ({
      ...prev,
      currentSpeed: speed,
      currentSteeringAngle: steeringAngle,
      ...(gear && { gear }),
    }));
  };

  // 更新车辆状态
  const updateCarState = (commandId: string) => {
    setCarStates((prev) => {
      const newState = { ...prev };

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
      }

      return newState;
    });
  };

  // 更新CAN命令配置
  const updateCanCommand = (
    commandId: string,
    field: keyof CanCommand,
    value: string
  ) => {
    setCanCommands((prev) =>
      prev.map((cmd) =>
        cmd.id === commandId ? { ...cmd, [field]: value } : cmd
      )
    );
  };

  // 开始循环发送CSV数据（使用预解析的数据）
  const startCsvLoop = async (
    csvContent: string,
    intervalMs: number,
    canIdColumnIndex: number,
    canDataColumnIndex: number,
    csvStartRowIndex: number,
    config: any,
    onComplete?: () => void,
    onProgressUpdate?: (speed: number, steeringAngle: number, gear?: string) => void
  ) => {
    try {
      console.log("🚀 startCsvLoop called with:", {
        csvContentLength: csvContent.length,
        intervalMs,
        canIdColumnIndex,
        canDataColumnIndex,
        csvStartRowIndex,
      });

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
        if (progressIntervalRef.current) {
          clearInterval(progressIntervalRef.current);
        }

        progressIntervalRef.current = setInterval(() => {
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
            if (progressIntervalRef.current) {
              clearInterval(progressIntervalRef.current);
              progressIntervalRef.current = null;
            }
          }
        }, intervalMs);
      }

      // 计算预期的完成时间
      const estimatedDuration = preloadedData.length * intervalMs + 1000; // 加1秒缓冲

      console.log(
        `📊 CSV loop will complete in approximately ${estimatedDuration}ms (${preloadedData.length} records × ${intervalMs}ms)`
      );

      // 设置定时器，在预期时间后检查并触发完成回调
      if (onComplete) {
        // 清除之前的 completeTimeout（如果存在）
        if (completeTimeoutRef.current) {
          clearTimeout(completeTimeoutRef.current);
        }

        completeTimeoutRef.current = setTimeout(() => {
          console.log(
            "✅ CSV loop should be completed, triggering onComplete callback"
          );
          onComplete();
          completeTimeoutRef.current = null;
        }, estimatedDuration);
      }
    } catch (error) {
      console.error("❌ Failed to start CSV loop:", error);
      throw error;
    }
  };

  // 停止循环发送
  const stopCsvLoop = async () => {
    try {
      // 清除前端的定时器
      if (progressIntervalRef.current) {
        clearInterval(progressIntervalRef.current);
        progressIntervalRef.current = null;
        console.log("✓ progressInterval 已清除");
      }

      if (completeTimeoutRef.current) {
        clearTimeout(completeTimeoutRef.current);
        completeTimeoutRef.current = null;
        console.log("✓ completeTimeout 已清除");
      }

      // 调用后端停止 CSV 循环
      await invoke("stop_csv_loop");
      console.log("✓ 后端 CSV 循环已停止");
    } catch (error) {
      console.error("Failed to stop CSV loop:", error);
      throw error;
    }
  };

  return {
    canCommands,
    carStates,
    updateCarState,
    updateCanCommand,
    updateVehicleControl,
    startCsvLoop,
    stopCsvLoop,
    loopIntervalRef,
  };
};
