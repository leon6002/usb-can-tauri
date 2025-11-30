import React, { useRef, useEffect, useState } from "react";
import { useCarControlStore } from "@/store/carControlStore";
import { use3DStore } from "@/store/car3DStore";
import { Zap, Octagon } from "lucide-react";

interface PedalsProps {
  currentSteeringAngle: number; // 当前轮胎转向角（度数）
}

export const Pedals: React.FC<PedalsProps> = ({ currentSteeringAngle }) => {
  const [isAccelerating, setIsAccelerating] = useState(false);
  const [isBraking, setIsBraking] = useState(false);

  const accelerateIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const brakeIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const decelerationIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // 使用 ref 追踪最新的转向角，防止定时器闭包导致的角度锁死
  const currentSteeringAngleRef = useRef(currentSteeringAngle);

  // 当 prop 更新时同步更新 ref
  useEffect(() => {
    currentSteeringAngleRef.current = currentSteeringAngle;
  }, [currentSteeringAngle]);

  // 加速参数
  const MAX_SPEED = 5000; // 最大速度 5000 mm/s
  const ACCELERATION_STEP = 100; // 每次加速增加 100 mm/s
  const DECELERATION_STEP = 50; // 减速步长 (自然减速)
  const BRAKING_STEP = 300; // 制动减速步长 (强力减速)
  const CREEP_SPEED = 500; // 怠速 (蠕行速度)
  const SEND_INTERVAL = 100; // 每 100ms 发送一次


  const GEAR_P_STR = "P";
  const GEAR_D_STR = "D";

  // 获取发送 CAN 命令的方法和更新车辆控制的方法
  const {
    sendVehicleControlCommand,
    updateVehicleControl
  } = useCarControlStore.getState();

  // 获取自动驾驶状态
  const isDriving = useCarControlStore((state) => state.carStates.isDriving);

  // 获取 3D 动画控制方法
  const {
    startDriveAnimation,
    updateDriveAnimation
  } = use3DStore.getState();

  // 发送驾驶 CAN 命令
  const sendDrivingCommand = async (speed: number, angle: number) => {
    try {
      // New protocol: speed sign determines direction.
      // Assuming Pedals.tsx controls forward speed (D gear).
      // If we support Reverse in the future, we should negate speed here if gear is R.
      await sendVehicleControlCommand(speed, angle);
    } catch (error) {
      console.error("❌ Failed to send drive command:", error);
    }
  };

  // 启动怠速/减速逻辑
  const startIdleDrive = () => {
    if (decelerationIntervalRef.current) {
      clearInterval(decelerationIntervalRef.current);
    }

    // 确保动画正在运行
    startDriveAnimation();

    decelerationIntervalRef.current = setInterval(() => {
      const currentSpeed = useCarControlStore.getState().carStates.currentSpeed;
      let nextSpeed = currentSpeed;

      if (currentSpeed > CREEP_SPEED) {
        // 速度大于怠速，自然减速
        nextSpeed = Math.max(currentSpeed - DECELERATION_STEP, CREEP_SPEED);
      } else if (currentSpeed < CREEP_SPEED) {
        // 速度小于怠速（例如从静止开始），加速到怠速
        nextSpeed = Math.min(currentSpeed + DECELERATION_STEP, CREEP_SPEED);
      }

      // 使用 ref 中的最新转向角
      const latestSteeringAngle = currentSteeringAngleRef.current;

      // 更新状态和发送命令
      // 更新状态和发送命令
      // 怠速时始终为 D 档
      updateVehicleControl(nextSpeed, latestSteeringAngle, GEAR_D_STR);
      updateDriveAnimation(nextSpeed, latestSteeringAngle);
      sendDrivingCommand(nextSpeed, latestSteeringAngle);

    }, SEND_INTERVAL);
  };

  // 加速踏板按下
  const handleAccelerateStart = () => {
    if (isDriving) return; // 自动驾驶时禁用交互
    setIsAccelerating(true);
    setIsBraking(false);

    // 清除制动和减速定时器
    if (brakeIntervalRef.current) {
      clearInterval(brakeIntervalRef.current);
      brakeIntervalRef.current = null;
    }
    if (decelerationIntervalRef.current) {
      clearInterval(decelerationIntervalRef.current);
      decelerationIntervalRef.current = null;
    }

    // 启动行驶动画
    startDriveAnimation();

    // 获取当前速度 (从 Store 中获取最新值)
    let currentSpeed = useCarControlStore.getState().carStates.currentSpeed;
    // 使用 ref 中的最新转向角
    const latestSteeringAngle = currentSteeringAngleRef.current;

    // 立即发送一次
    const newSpeed = Math.min(currentSpeed + ACCELERATION_STEP, MAX_SPEED);
    updateVehicleControl(newSpeed, latestSteeringAngle, GEAR_D_STR); // 更新 Store
    updateDriveAnimation(newSpeed, latestSteeringAngle); // 更新动画状态
    sendDrivingCommand(newSpeed, latestSteeringAngle);

    // 启动持续加速
    accelerateIntervalRef.current = setInterval(() => {
      // 再次获取最新速度
      currentSpeed = useCarControlStore.getState().carStates.currentSpeed;
      const nextSpeed = Math.min(currentSpeed + ACCELERATION_STEP, MAX_SPEED);
      // 使用 ref 中的最新转向角
      const currentAngle = currentSteeringAngleRef.current;

      updateVehicleControl(nextSpeed, currentAngle, GEAR_D_STR); // 更新 Store
      updateDriveAnimation(nextSpeed, currentAngle); // 更新动画状态
      sendDrivingCommand(nextSpeed, currentAngle);
    }, SEND_INTERVAL);
  };

  // 加速踏板释放
  const handleAccelerateEnd = () => {
    if (!isAccelerating) return;

    setIsAccelerating(false);
    if (accelerateIntervalRef.current) {
      clearInterval(accelerateIntervalRef.current);
      accelerateIntervalRef.current = null;
    }
    // 释放加速踏板后，进入怠速/减速模式
    startIdleDrive();
  };

  // 制动踏板按下
  const handleBrakeStart = () => {
    if (isDriving) return; // 自动驾驶时禁用交互
    setIsBraking(true);
    setIsAccelerating(false);

    // 清除加速和减速定时器
    if (accelerateIntervalRef.current) {
      clearInterval(accelerateIntervalRef.current);
      accelerateIntervalRef.current = null;
    }
    if (decelerationIntervalRef.current) {
      clearInterval(decelerationIntervalRef.current);
      decelerationIntervalRef.current = null;
    }

    // 停止行驶动画
    // stopDriveAnimation(); // 移除此调用，防止刹车时重置相机视角

    // 使用 ref 中的最新转向角
    const latestSteeringAngle = currentSteeringAngleRef.current;

    // 立即发送一次当前速度（开始制动）
    let currentSpeed = useCarControlStore.getState().carStates.currentSpeed;
    // 只要有速度就是 D 档
    let currentGearStr = currentSpeed > 0 ? GEAR_D_STR : GEAR_P_STR;

    updateVehicleControl(currentSpeed, latestSteeringAngle, currentGearStr);
    updateDriveAnimation(currentSpeed, latestSteeringAngle);
    sendDrivingCommand(currentSpeed, latestSteeringAngle);

    // 持续减速
    brakeIntervalRef.current = setInterval(() => {
      // 获取最新速度
      currentSpeed = useCarControlStore.getState().carStates.currentSpeed;

      // 减速计算
      let nextSpeed = 0;
      if (currentSpeed > 0) {
        nextSpeed = Math.max(currentSpeed - BRAKING_STEP, 0);
      }

      // 确定档位：速度 > 0 为 D 档，速度 = 0 为 P 档
      const nextGearStr = nextSpeed > 0 ? GEAR_D_STR : GEAR_P_STR;

      // 使用 ref 中的最新转向角
      const currentAngle = currentSteeringAngleRef.current;

      updateVehicleControl(nextSpeed, currentAngle, nextGearStr);
      updateDriveAnimation(nextSpeed, currentAngle);
      sendDrivingCommand(nextSpeed, currentAngle);

      // 如果已经停止，可以考虑清除定时器，或者保持发送0以维持停止状态
      // 这里保持发送0比较安全

      // 关键修复：当速度降为0时，手动重置 isDriving 状态
      // 这样下次点击自动驾驶时，startDriveAnimation 就能正常执行
      if (nextSpeed === 0) {
        use3DStore.getState().setIsDriving(false);
      }
    }, SEND_INTERVAL);
  };

  // 制动踏板释放
  const handleBrakeEnd = () => {
    if (!isBraking) return;

    setIsBraking(false);
    if (brakeIntervalRef.current) {
      clearInterval(brakeIntervalRef.current);
      brakeIntervalRef.current = null;
    }
    // 释放制动踏板后，如果车还在动（未完全停止），恢复怠速/减速模式
    // 如果车已经停稳（速度为0），则保持停止状态（P档）
    const currentSpeed = useCarControlStore.getState().carStates.currentSpeed;
    if (currentSpeed > 0) {
      startIdleDrive();
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
      if (decelerationIntervalRef.current) {
        clearInterval(decelerationIntervalRef.current);
      }
    };
  }, []);

  return (
    <div className="w-full p-4 mt-2">
      {/* Pedals Container - Compact & Transparent */}
      <div className="flex justify-center items-end gap-8">
        {/* Brake Pedal */}
        <div className="flex flex-col items-center gap-2 group">
          <button
            onPointerDown={(e) => {
              e.preventDefault();
              handleBrakeStart();
            }}
            onPointerUp={(e) => {
              e.preventDefault();
              handleBrakeEnd();
            }}
            onPointerLeave={(e) => {
              e.preventDefault();
              handleBrakeEnd();
            }}
            className={`
              relative w-20 h-16 rounded-lg transform transition-all duration-100 ease-out
              border-b-[4px] active:border-b-0 active:translate-y-[4px] backdrop-blur-sm
              ${isBraking
                ? 'bg-red-500/80 border-red-700 shadow-[0_0_15px_rgba(239,68,68,0.5)]'
                : 'bg-white/20 border-white/30 hover:bg-white/30 shadow-lg'
              }
              ${isDriving ? 'opacity-50 cursor-not-allowed pointer-events-none' : ''}
            `}
          >
            {/* Pedal Texture */}
            <div className="absolute inset-0 flex flex-col justify-between p-2 opacity-20">
              {[...Array(3)].map((_, i) => (
                <div key={i} className="w-full h-1 bg-black rounded-full" />
              ))}
            </div>

            <div className="absolute inset-0 flex items-center justify-center">
              <Octagon className={`w-6 h-6 ${isBraking ? 'text-white' : 'text-white/80'}`} />
            </div>
          </button>
          <span className={`text-[9px] font-bold tracking-widest uppercase transition-colors ${isBraking ? 'text-red-400' : 'text-white/60 group-hover:text-white/80'
            }`}>
            Brake
          </span>
        </div>

        {/* Accelerator Pedal */}
        <div className="flex flex-col items-center gap-2 group">
          <button
            onPointerDown={(e) => {
              e.preventDefault();
              handleAccelerateStart();
            }}
            onPointerUp={(e) => {
              e.preventDefault();
              handleAccelerateEnd();
            }}
            onPointerLeave={(e) => {
              e.preventDefault();
              handleAccelerateEnd();
            }}
            className={`
              relative w-14 h-24 rounded-lg transform transition-all duration-100 ease-out
              border-b-[4px] active:border-b-0 active:translate-y-[4px] backdrop-blur-sm
              ${isAccelerating
                ? 'bg-emerald-500/80 border-emerald-700 shadow-[0_0_15px_rgba(16,185,129,0.5)]'
                : 'bg-white/20 border-white/30 hover:bg-white/30 shadow-lg'
              }
              ${isDriving ? 'opacity-50 cursor-not-allowed pointer-events-none' : ''}
            `}
          >
            {/* Pedal Texture */}
            <div className="absolute inset-0 flex flex-col gap-2 p-2 opacity-20">
              {[...Array(6)].map((_, i) => (
                <div key={i} className="w-full h-1 bg-black rounded-full" />
              ))}
            </div>

            <div className="absolute inset-0 flex items-center justify-center">
              <Zap className={`w-6 h-6 ${isAccelerating ? 'text-white' : 'text-white/80'}`} />
            </div>
          </button>
          <span className={`text-[9px] font-bold tracking-widest uppercase transition-colors ${isAccelerating ? 'text-emerald-400' : 'text-white/60 group-hover:text-white/80'
            }`}>
            Accel
          </span>
        </div>
      </div>
    </div>
  );
};


