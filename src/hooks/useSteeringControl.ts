import { useEffect, useRef } from "react";
import { use3DStore } from "@/store/car3DStore";
import { useCarControlStore } from "@/store/carControlStore";

/**
 * 方向盘控制 Hook
 * 处理方向盘转动时的逻辑：
 * 1. 同步更新 3D 模型的轮胎转向角
 * 2. 发送 CAN 信号 0x18C4D2D0（速度为0，角度为轮胎转向角）
 *
 * @param steeringWheelAngleDeg 方向盘角度（度数）
 * @param steeringRatio 转向比（默认 8:1，即方向盘转8度，轮胎转1度）
 */
export const useSteeringControl = (
  steeringWheelAngleDeg: number,
  steeringRatio: number = 8
) => {
  const lastSentAngleRef = useRef<number>(0);
  const sendThrottleRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    // 计算轮胎转向角（方向盘角度 / 转向比）
    const tireSteeringAngleDeg = steeringWheelAngleDeg / steeringRatio;

    // 1. 更新 3D 模型的轮胎转向角
    const { sceneHandle } = use3DStore.getState();
    if (sceneHandle?.animationSystem?.updateSteeringAngle) {
      sceneHandle.animationSystem.updateSteeringAngle(tireSteeringAngleDeg, 0);
    }

    // 更新 store 中的 vehicleDynamics，以便 Environments.tsx 可以获取到最新的转向角进行道路弯曲
    use3DStore.setState((state) => ({
      vehicleDynamics: {
        ...state.vehicleDynamics,
        steeringAngle: tireSteeringAngleDeg * (Math.PI / 180),
      },
    }));

    // 2. 节流发送 CAN 信号（避免发送过于频繁）
    // 只有当角度变化超过 0.5 度时才发送
    const angleDiff = Math.abs(tireSteeringAngleDeg - lastSentAngleRef.current);
    if (angleDiff < 0.5) {
      return;
    }

    // 清除之前的定时器
    if (sendThrottleRef.current) {
      clearTimeout(sendThrottleRef.current);
    }

    // 设置新的定时器，50ms 后发送（节流）
    sendThrottleRef.current = setTimeout(() => {
      sendSteeringCanCommand(tireSteeringAngleDeg);
      lastSentAngleRef.current = tireSteeringAngleDeg;
    }, 50);

    // 清理函数
    return () => {
      if (sendThrottleRef.current) {
        clearTimeout(sendThrottleRef.current);
      }
    };
  }, [steeringWheelAngleDeg, steeringRatio]);
};

/**
 * 发送转向 CAN 命令
 * CAN ID: 0x18C4D2D0
 * 速度: 0 mm/s
 * 角度: 轮胎转向角（度数）
 */
async function sendSteeringCanCommand(tireSteeringAngleDeg: number) {
  const { sendVehicleControlCommand } = useCarControlStore.getState();

  console.log(
    `🎯 Sending steering CAN command: angle=${tireSteeringAngleDeg.toFixed(
      2
    )}°`
  );

  try {
    // Speed is 0 when only steering
    await sendVehicleControlCommand(0, tireSteeringAngleDeg);
  } catch (error) {
    console.error("❌ Failed to send steering CAN command:", error);
  }
}


