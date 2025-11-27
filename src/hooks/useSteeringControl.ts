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
  const { sendDriveCanCommand, getAndIncrementAliveCounter } = useCarControlStore.getState();

  // 构建 CAN 数据
  const canData = buildSteeringCanData(getAndIncrementAliveCounter(), tireSteeringAngleDeg);

  console.log(
    `🎯 Sending steering CAN command: angle=${tireSteeringAngleDeg.toFixed(
      2
    )}°, data=${canData}`
  );

  try {
    await sendDriveCanCommand(canData);
  } catch (error) {
    console.error("❌ Failed to send steering CAN command:", error);
  }
}

/**
 * 构建转向 CAN 数据
 * 参考 python-test/final_convert.py 中的 build_vehicle_control_data 函数
 *
 * @param speedMms 速度（mm/s）
 * @param angleDeg 转向角（度数）
 * @param gear 档位（默认 0x04 = D档）
 * @param aliveCounter 心跳计数器（默认 0x00）
 * @returns CAN 数据字符串（8字节，空格分隔）
 */
function buildSteeringCanData(
  speedMms: number,
  angleDeg: number,
  gear: number = 0x04,
  aliveCounter: number = 0x00
): string {
  // 1. 转向角原始值：角度 * 100（单位：0.01度）
  const steeringAngleRaw = Math.round(angleDeg * 100);

  // 2. 组合 data[0], data[1], data[2]（档位和速度）
  const speedShifted = speedMms << 4;
  const rawU32 = speedShifted | (gear & 0x0f);

  // 转换为小端序字节
  const data0 = rawU32 & 0xff;
  const data1 = (rawU32 >> 8) & 0xff;
  let data2 = (rawU32 >> 16) & 0xff;

  // 3. 组合 data[2], data[3], data[4]（转向角）
  // 转向角是 16 位有符号整数，需要转换为大端序
  const buffer = new ArrayBuffer(2);
  const view = new DataView(buffer);
  view.setInt16(0, steeringAngleRaw, false); // false = 大端序
  const highByte = view.getUint8(0); // 大端序：高字节在前
  const lowByte = view.getUint8(1); // 大端序：低字节在后

  // 重构 data[4]（低4位是 highByte 的高4位）
  const data4 = (highByte >> 4) & 0x0f;

  // 重构 data[3]（高4位是 highByte 的低4位，低4位是 lowByte 的高4位）
  const data3 = ((highByte & 0x0f) << 4) | (lowByte >> 4);

  // 重构 data[2]（高4位是 lowByte 的低4位）
  data2 = data2 | ((lowByte & 0x0f) << 4);

  // 4. 填充 data[5] 和 data[6]
  const data5 = 0x00; // Target Vehicle Braking
  const data6 = aliveCounter & 0xff; // Alive Rolling Counter

  // 5. 计算校验和（BCC）
  const payload = [data0, data1, data2, data3, data4, data5, data6];
  let bcc = 0;
  for (const byte of payload) {
    bcc ^= byte;
  }
  const data7 = bcc;

  // 6. 组合成最终的 8 字节报文
  const finalData = [...payload, data7];

  // 转换为十六进制字符串，空格分隔
  return finalData
    .map((b) => b.toString(16).toUpperCase().padStart(2, "0"))
    .join(" ");
}
