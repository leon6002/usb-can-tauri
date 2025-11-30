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

  const [selectedGear, setSelectedGear] = useState<"P" | "R" | "D">("P");

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

  // 获取发送 CAN 命令的方法和更新车辆控制的方法
  const {
    sendVehicleControlCommand,
    updateVehicleControl
  } = useCarControlStore.getState();

  // 获取自动驾驶状态
  const isDriving = useCarControlStore((state) => state.carStates.isDriving);
  const currentGear = useCarControlStore((state) => state.carStates.gear);

  // Sync gear with store during auto-drive
  useEffect(() => {
    if (isDriving && currentGear) {
      // Ensure currentGear is a valid gear type
      if (["P", "R", "D"].includes(currentGear)) {
        setSelectedGear(currentGear as "P" | "R" | "D");
      }
    }
  }, [isDriving, currentGear]);

  // 获取 3D 动画控制方法
  const {
    startDriveAnimation,
    updateDriveAnimation
  } = use3DStore.getState();

  // 发送驾驶 CAN 命令
  const sendDrivingCommand = async (speed: number, angle: number) => {
    try {
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

    // P档不蠕行
    if (selectedGear === "P") return;

    // 确保动画正在运行
    startDriveAnimation();

    decelerationIntervalRef.current = setInterval(() => {
      const currentSpeed = useCarControlStore.getState().carStates.currentSpeed;
      let nextSpeed = currentSpeed;

      // 目标蠕行速度 (D档正向, R档负向)
      const targetCreepSpeed = selectedGear === "D" ? CREEP_SPEED : -CREEP_SPEED;

      if (selectedGear === "D") {
        if (currentSpeed > targetCreepSpeed) {
          // 大于蠕行速度，自然减速
          nextSpeed = Math.max(currentSpeed - DECELERATION_STEP, targetCreepSpeed);
        } else if (currentSpeed < targetCreepSpeed) {
          // 小于蠕行速度，加速到蠕行
          nextSpeed = Math.min(currentSpeed + DECELERATION_STEP, targetCreepSpeed);
        }
      } else { // R Gear
        if (currentSpeed < targetCreepSpeed) {
          // 速度比目标更负（更快后退），减速（数值变大）
          nextSpeed = Math.min(currentSpeed + DECELERATION_STEP, targetCreepSpeed);
        } else if (currentSpeed > targetCreepSpeed) {
          // 速度比目标更正（慢后退或前进），加速后退（数值变小）
          nextSpeed = Math.max(currentSpeed - DECELERATION_STEP, targetCreepSpeed);
        }
      }

      // 使用 ref 中的最新转向角
      const latestSteeringAngle = currentSteeringAngleRef.current;

      // 更新状态和发送命令
      updateVehicleControl(nextSpeed, latestSteeringAngle, selectedGear);
      updateDriveAnimation(nextSpeed, latestSteeringAngle);
      sendDrivingCommand(nextSpeed, latestSteeringAngle);

    }, SEND_INTERVAL);
  };

  // 加速踏板按下
  const handleAccelerateStart = () => {
    if (isDriving) return; // 自动驾驶时禁用交互
    if (selectedGear === "P") return; // P档无法加速

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
    let newSpeed = currentSpeed;
    if (selectedGear === "D") {
      newSpeed = Math.min(currentSpeed + ACCELERATION_STEP, MAX_SPEED);
    } else if (selectedGear === "R") {
      newSpeed = Math.max(currentSpeed - ACCELERATION_STEP, -MAX_SPEED);
    }

    updateVehicleControl(newSpeed, latestSteeringAngle, selectedGear); // 更新 Store
    updateDriveAnimation(newSpeed, latestSteeringAngle); // 更新动画状态
    sendDrivingCommand(newSpeed, latestSteeringAngle);

    // 启动持续加速
    accelerateIntervalRef.current = setInterval(() => {
      // 再次获取最新速度
      currentSpeed = useCarControlStore.getState().carStates.currentSpeed;
      let nextSpeed = currentSpeed;

      if (selectedGear === "D") {
        nextSpeed = Math.min(currentSpeed + ACCELERATION_STEP, MAX_SPEED);
      } else if (selectedGear === "R") {
        nextSpeed = Math.max(currentSpeed - ACCELERATION_STEP, -MAX_SPEED);
      }

      // 使用 ref 中的最新转向角
      const currentAngle = currentSteeringAngleRef.current;

      updateVehicleControl(nextSpeed, currentAngle, selectedGear); // 更新 Store
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

    // 持续减速
    brakeIntervalRef.current = setInterval(() => {
      // 获取最新速度
      const currentSpeed = useCarControlStore.getState().carStates.currentSpeed;
      let nextSpeed = 0;

      if (currentSpeed > 0) {
        nextSpeed = Math.max(currentSpeed - BRAKING_STEP, 0);
      } else if (currentSpeed < 0) {
        nextSpeed = Math.min(currentSpeed + BRAKING_STEP, 0);
      }

      // 使用 ref 中的最新转向角
      const currentAngle = currentSteeringAngleRef.current;

      updateVehicleControl(nextSpeed, currentAngle, selectedGear);
      updateDriveAnimation(nextSpeed, currentAngle);
      sendDrivingCommand(nextSpeed, currentAngle);

      // 关键修复：当速度降为0时，手动重置 isDriving 状态
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
    const currentSpeed = useCarControlStore.getState().carStates.currentSpeed;
    if (Math.abs(currentSpeed) > 0) {
      startIdleDrive();
    }
  };

  // 清理定时器
  useEffect(() => {
    return () => {
      if (accelerateIntervalRef.current) clearInterval(accelerateIntervalRef.current);
      if (brakeIntervalRef.current) clearInterval(brakeIntervalRef.current);
      if (decelerationIntervalRef.current) clearInterval(decelerationIntervalRef.current);
    };
  }, []);

  return (
    <div className="w-full p-4 mt-2 flex flex-col items-center gap-4">
      {/* Gear Selector */}
      <div className="flex gap-2 bg-black/40 p-1 rounded-lg backdrop-blur-sm">
        {(["P", "R", "D"] as const).map((gear) => (
          <button
            key={gear}
            onClick={() => {
              // 只有在速度为0时才允许切换档位 (简单保护)
              const currentSpeed = useCarControlStore.getState().carStates.currentSpeed;
              if (Math.abs(currentSpeed) < 10) {
                setSelectedGear(gear);
                updateVehicleControl(0, currentSteeringAngleRef.current, gear);
              }
            }}
            className={`
              w-10 h-8 rounded flex items-center justify-center font-bold text-sm transition-all
              ${selectedGear === gear
                ? (gear === 'R' ? 'bg-red-500 text-white' : gear === 'P' ? 'bg-amber-500 text-white' : 'bg-emerald-500 text-white')
                : 'text-white/50 hover:bg-white/10 hover:text-white/80'}
            `}
          >
            {gear}
          </button>
        ))}
      </div>

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
              ${isDriving || selectedGear === 'P' ? 'opacity-50 cursor-not-allowed pointer-events-none' : ''}
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


