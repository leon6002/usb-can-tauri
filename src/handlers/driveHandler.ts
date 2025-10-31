import { SerialConfig } from "@/types";

interface DriveCommandParams {
  config: SerialConfig;
  csvContent: string;
  addDebugLog: (
    action: string,
    commandId: string,
    canId: string,
    data: string,
    description: string
  ) => void;
  updateVehicleControl: (
    speed: number,
    steeringAngle: number,
    gear?: string
  ) => void;
  updateDriveAnimation: (speed: number, steeringAngle: number) => void;
  startCsvLoop: (
    onProgressUpdate?: (
      speed: number,
      steeringAngle: number,
      gear?: string
    ) => void
  ) => void;
  updateCarState: (commandId: string) => void;
  startDriveAnimation: () => void;
}

interface StopDrivingParams {
  addDebugLog: (
    action: string,
    commandId: string,
    canId: string,
    data: string,
    description: string
  ) => void;
  stopCsvLoop: () => Promise<void>;
  updateVehicleControl: (
    speed: number,
    steeringAngle: number,
    gear?: string
  ) => void;
  updateCarState: (commandId: string) => void;
  stopDriveAnimation: () => void;
}

export const handleStartDriving = async ({
  config,
  csvContent,
  addDebugLog,
  updateVehicleControl,
  updateDriveAnimation,
  startCsvLoop,
  updateCarState,
  startDriveAnimation,
}: DriveCommandParams) => {
  const commandId = "start_driving";
  console.log("🚗 Start driving command detected");

  try {
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
    console.log("starting drive animation");
    startDriveAnimation();
  } catch (error) {
    console.error(`❌ 启动驾驶命令执行失败 (${commandId}):`, error);
    // 记录失败日志
    addDebugLog(
      "启动驾驶命令执行失败",
      commandId,
      "CSV",
      config.csvFilePath || "N/A",
      `错误: ${error instanceof Error ? error.message : String(error)}`
    );
    // 重新抛出错误，让调用者知道命令失败
    throw error;
  }
};

export const handleStopDriving = async ({
  addDebugLog,
  stopCsvLoop,
  updateVehicleControl,
  updateCarState,
  stopDriveAnimation,
}: StopDrivingParams) => {
  const commandId = "stop_driving";

  try {
    // 停止循环发送
    addDebugLog("停止CSV循环发送", commandId, "CSV", "停止", "停止循环发送");

    await stopCsvLoop();
    // 更新状态面板显示方向盘转向角
    updateVehicleControl(0, 0);
    updateCarState(commandId);
    stopDriveAnimation();
  } catch (error) {
    console.error(`❌ 停止驾驶命令执行失败 (${commandId}):`, error);
    // 记录失败日志
    addDebugLog(
      "停止驾驶命令执行失败",
      commandId,
      "CSV",
      "N/A",
      `错误: ${error instanceof Error ? error.message : String(error)}`
    );
    throw error;
  }
};
