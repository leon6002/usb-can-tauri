import React, { useRef, useEffect, useState } from "react";
import { useCarControlStore } from "@/store/carControlStore";
import { Zap, Octagon } from "lucide-react";

interface PedalsProps {
  currentSteeringAngle: number; // 当前轮胎转向角（度数）
}

export const Pedals: React.FC<PedalsProps> = ({ currentSteeringAngle }) => {
  const [isAccelerating, setIsAccelerating] = useState(false);
  const [isBraking, setIsBraking] = useState(false);

  const accelerateIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const brakeIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // 加速参数
  const MAX_SPEED = 5000; // 最大速度 5000 mm/s
  const ACCELERATION_STEP = 100; // 每次加速增加 100 mm/s
  const SEND_INTERVAL = 100; // 每 100ms 发送一次

  // 获取发送 CAN 命令的方法和更新车辆控制的方法
  const { sendDriveCanCommand, getAndIncrementAliveCounter, updateVehicleControl } =
    useCarControlStore.getState();

  // 发送驾驶 CAN 命令
  const sendDrivingCommand = async (speed: number, angle: number) => {
    const canData = buildDriveCanData(
      getAndIncrementAliveCounter(),
      speed,
      angle
    );
    try {
      await sendDriveCanCommand(canData);
    } catch (error) {
      console.error("❌ Failed to send drive command:", error);
    }
  };

  // 加速踏板按下
  const handleAccelerateStart = () => {
    setIsAccelerating(true);
    setIsBraking(false);

    // 清除制动定时器
    if (brakeIntervalRef.current) {
      clearInterval(brakeIntervalRef.current);
      brakeIntervalRef.current = null;
    }

    // 获取当前速度 (从 Store 中获取最新值)
    let currentSpeed = useCarControlStore.getState().carStates.currentSpeed;

    // 立即发送一次
    const newSpeed = Math.min(currentSpeed + ACCELERATION_STEP, MAX_SPEED);
    updateVehicleControl(newSpeed, currentSteeringAngle); // 更新 Store
    sendDrivingCommand(newSpeed, currentSteeringAngle);

    // 启动持续加速
    accelerateIntervalRef.current = setInterval(() => {
      // 再次获取最新速度
      currentSpeed = useCarControlStore.getState().carStates.currentSpeed;
      const nextSpeed = Math.min(currentSpeed + ACCELERATION_STEP, MAX_SPEED);
      updateVehicleControl(nextSpeed, currentSteeringAngle); // 更新 Store
      sendDrivingCommand(nextSpeed, currentSteeringAngle);
    }, SEND_INTERVAL);
  };

  // 加速踏板释放
  const handleAccelerateEnd = () => {
    setIsAccelerating(false);
    if (accelerateIntervalRef.current) {
      clearInterval(accelerateIntervalRef.current);
      accelerateIntervalRef.current = null;
    }
  };

  // 制动踏板按下
  const handleBrakeStart = () => {
    setIsBraking(true);
    setIsAccelerating(false);

    // 清除加速定时器
    if (accelerateIntervalRef.current) {
      clearInterval(accelerateIntervalRef.current);
      accelerateIntervalRef.current = null;
    }

    // 立即发送制动命令（速度为 0）
    updateVehicleControl(0, currentSteeringAngle); // 更新 Store
    sendDrivingCommand(0, currentSteeringAngle);

    // 持续发送制动命令
    brakeIntervalRef.current = setInterval(() => {
      sendDrivingCommand(0, currentSteeringAngle);
    }, SEND_INTERVAL);
  };

  // 制动踏板释放
  const handleBrakeEnd = () => {
    setIsBraking(false);
    if (brakeIntervalRef.current) {
      clearInterval(brakeIntervalRef.current);
      brakeIntervalRef.current = null;
    }
  };

  // 清理定时器
  useEffect(() => {
    return () => {
      if (accelerateIntervalRef.current) {
        clearInterval(accelerateIntervalRef.current);
      }
      if (brakeIntervalRef.current) {
        clearInterval(brakeIntervalRef.current);
      }
    };
  }, []);

  return (
    <div className="w-full p-4 bg-white rounded-2xl shadow-sm border border-gray-100 mt-4">
      {/* Pedals Container - Compact */}
      <div className="flex justify-center items-end gap-8">
        {/* Brake Pedal */}
        <div className="flex flex-col items-center gap-2 group">
          <button
            onMouseDown={handleBrakeStart}
            onMouseUp={handleBrakeEnd}
            onMouseLeave={handleBrakeEnd}
            onTouchStart={handleBrakeStart}
            onTouchEnd={handleBrakeEnd}
            className={`
              relative w-20 h-16 rounded-lg transform transition-all duration-100 ease-out
              border-b-[4px] active:border-b-0 active:translate-y-[4px]
              ${isBraking
                ? 'bg-gradient-to-b from-red-500 to-red-600 border-red-800 shadow-md shadow-red-200'
                : 'bg-gradient-to-b from-gray-100 to-gray-200 border-gray-300 hover:from-gray-50 hover:to-gray-100 shadow-sm'
              }
            `}
          >
            {/* Pedal Texture */}
            <div className="absolute inset-0 flex flex-col justify-between p-2 opacity-10">
              {[...Array(3)].map((_, i) => (
                <div key={i} className="w-full h-1 bg-black rounded-full" />
              ))}
            </div>

            <div className="absolute inset-0 flex items-center justify-center">
              <Octagon className={`w-6 h-6 ${isBraking ? 'text-white' : 'text-gray-400'}`} />
            </div>
          </button>
          <span className={`text-[10px] font-bold tracking-widest uppercase transition-colors ${isBraking ? 'text-red-600' : 'text-gray-400 group-hover:text-gray-500'
            }`}>
            Brake
          </span>
        </div>

        {/* Accelerator Pedal */}
        <div className="flex flex-col items-center gap-2 group">
          <button
            onMouseDown={handleAccelerateStart}
            onMouseUp={handleAccelerateEnd}
            onMouseLeave={handleAccelerateEnd}
            onTouchStart={handleAccelerateStart}
            onTouchEnd={handleAccelerateEnd}
            className={`
              relative w-14 h-24 rounded-lg transform transition-all duration-100 ease-out
              border-b-[4px] active:border-b-0 active:translate-y-[4px]
              ${isAccelerating
                ? 'bg-gradient-to-b from-emerald-400 to-emerald-500 border-emerald-700 shadow-md shadow-emerald-200'
                : 'bg-gradient-to-b from-gray-100 to-gray-200 border-gray-300 hover:from-gray-50 hover:to-gray-100 shadow-sm'
              }
            `}
          >
            {/* Pedal Texture */}
            <div className="absolute inset-0 flex flex-col gap-2 p-2 opacity-10">
              {[...Array(6)].map((_, i) => (
                <div key={i} className="w-full h-1 bg-black rounded-full" />
              ))}
            </div>

            <div className="absolute inset-0 flex items-center justify-center">
              <Zap className={`w-6 h-6 ${isAccelerating ? 'text-white' : 'text-gray-400'}`} />
            </div>
          </button>
          <span className={`text-[10px] font-bold tracking-widest uppercase transition-colors ${isAccelerating ? 'text-emerald-600' : 'text-gray-400 group-hover:text-gray-500'
            }`}>
            Accel
          </span>
        </div>
      </div>
    </div>
  );
};

// 构建驾驶 CAN 数据（与 useSteeringControl.ts 中的函数相同）
function buildDriveCanData(
  aliveCounter: number,
  speedMms: number,
  angleDeg: number,
  gear: number = 0x04
): string {
  const steeringAngleRaw = Math.round(angleDeg * 100);
  const speedShifted = speedMms << 4;
  const rawU32 = speedShifted | (gear & 0x0f);
  const data0 = rawU32 & 0xff;
  const data1 = (rawU32 >> 8) & 0xff;
  let data2 = (rawU32 >> 16) & 0xff;
  const buffer = new ArrayBuffer(2);
  const view = new DataView(buffer);
  view.setInt16(0, steeringAngleRaw, false);
  const highByte = view.getUint8(0);
  const lowByte = view.getUint8(1);
  const data4 = (highByte >> 4) & 0x0f;
  const data3 = ((highByte & 0x0f) << 4) | (lowByte >> 4);
  data2 = data2 | ((lowByte & 0x0f) << 4);
  const data5 = 0x00;
  const data6 = aliveCounter & 0xff;
  const payload = [data0, data1, data2, data3, data4, data5, data6];
  let bcc = 0;
  for (const byte of payload) {
    bcc ^= byte;
  }
  const data7 = bcc;
  const finalData = [...payload, data7];
  return finalData
    .map((b) => b.toString(16).toUpperCase().padStart(2, "0"))
    .join(" ");
}
