import { useEffect, useRef, useState } from "react";
import { useSteeringControl } from "@/hooks/useSteeringControl";
import { useCarControlStore } from "@/store/carControlStore";
import { useSerialStore } from "@/store/serialStore";
import { Pedals } from "./Pedals";
import { CarControlPanel } from "./CarControlPanel";
import { CarStatusPanel } from "./CarStatusPanel";
import { ChevronLeft, ChevronRight, RotateCcw, Settings2 } from "lucide-react";


// --- 常量定义 ---
// 将角度转换为弧度的辅助函数
const toRad = (deg: number) => (deg * Math.PI) / 180;
// 将弧度转换为角度的辅助函数
const toDeg = (rad: number) => (rad * 180) / Math.PI;

// 最大旋转角度限制：正负 240 度
const MAX_ROTATION_DEG = 200;
const MAX_ROTATION_RAD = toRad(MAX_ROTATION_DEG);

// 转向比：方向盘转8度，轮胎转1度
const STEERING_RATIO = 8;
const TURN_STEP_DEG = 10;
const TURN_INTERVAL_MS = 40;
const RESET_INTERVAL_MS = 16;
const RESET_DAMPING = 0.22;
const MIN_RESET_STEP_DEG = 1.2;
const MAX_RESET_STEP_DEG = 12;

type SteeringDirection = "left" | "right" | null;

const clampRotation = (value: number) =>
  Math.max(-MAX_ROTATION_RAD, Math.min(MAX_ROTATION_RAD, value));

const SteeringWheelContinued = () => {
  const [rotation, setRotation] = useState(0);
  const [activeDirection, setActiveDirection] = useState<SteeringDirection>(null);
  const steeringIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const resetIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // 获取自动驾驶状态
  const isDriving = useCarControlStore((state) => state.carStates.isDriving);
  const currentSpeed = useCarControlStore((state) => state.carStates.currentSpeed);
  const currentSteeringAngle = useCarControlStore((state) => state.carStates.currentSteeringAngle);
  const isConnected = useSerialStore((state) => state.isConnected);

  const clearSteeringIntervals = () => {
    if (steeringIntervalRef.current) {
      clearInterval(steeringIntervalRef.current);
      steeringIntervalRef.current = null;
    }

    if (resetIntervalRef.current) {
      clearInterval(resetIntervalRef.current);
      resetIntervalRef.current = null;
    }
  };

  useEffect(() => {
    if (isDriving && activeDirection === null) {
      const targetRotationDeg = -currentSteeringAngle * STEERING_RATIO;
      setRotation(clampRotation(toRad(targetRotationDeg)));
    }
  }, [activeDirection, currentSteeringAngle, isDriving]);

  useEffect(() => {
    if (isDriving || !isConnected) {
      clearSteeringIntervals();
      setActiveDirection(null);
    }
  }, [isConnected, isDriving]);

  useEffect(() => () => clearSteeringIntervals(), []);

  // 计算当前方向盘角度（度数）
  // Protocol: Positive = Left, Negative = Right
  // Visual (rotation): Positive = Right (CW), Negative = Left (CCW)
  // So we invert rotation to get the correct protocol angle
  const steeringWheelAngleDeg = -toDeg(rotation);
  const tireAngleDegNumber = steeringWheelAngleDeg / STEERING_RATIO;
  const displayedTireAngle = isDriving ? currentSteeringAngle : tireAngleDegNumber;

  // 使用方向盘控制 Hook（转向比 8:1）
  useSteeringControl(steeringWheelAngleDeg, STEERING_RATIO);

  const startSteering = (direction: Exclude<SteeringDirection, null>) => {
    if (isDriving || !isConnected) return;

    clearSteeringIntervals();
    setActiveDirection(direction);

    const delta = direction === "left" ? -toRad(TURN_STEP_DEG) : toRad(TURN_STEP_DEG);
    const applyTurnStep = () => {
      setRotation((prevRotation) => clampRotation(prevRotation + delta));
    };

    applyTurnStep();
    steeringIntervalRef.current = setInterval(applyTurnStep, TURN_INTERVAL_MS);
  };

  const stopSteering = () => {
    if (steeringIntervalRef.current) {
      clearInterval(steeringIntervalRef.current);
      steeringIntervalRef.current = null;
    }

    setActiveDirection(null);
  };

  const startResetAnimation = () => {
    if (resetIntervalRef.current) {
      clearInterval(resetIntervalRef.current);
    }

    const minStep = toRad(MIN_RESET_STEP_DEG);
    const maxStep = toRad(MAX_RESET_STEP_DEG);

    resetIntervalRef.current = setInterval(() => {
      setRotation((prevRotation) => {
        const remaining = Math.abs(prevRotation);

        if (remaining <= minStep) {
          if (resetIntervalRef.current) {
            clearInterval(resetIntervalRef.current);
            resetIntervalRef.current = null;
          }

          return 0;
        }

        const easedStep = Math.max(
          minStep,
          Math.min(maxStep, remaining * RESET_DAMPING)
        );

        return prevRotation > 0
          ? prevRotation - easedStep
          : prevRotation + easedStep;
      });
    }, RESET_INTERVAL_MS);
  };

  const resetSteering = () => {
    if (isDriving || !isConnected) return;
    clearSteeringIntervals();
    setActiveDirection(null);
    startResetAnimation();
  };

  const buttonBaseClass =
    "group relative flex h-[76px] w-[76px] items-center justify-center rounded-[22px] border backdrop-blur-md transition-all duration-200 select-none touch-none shrink-0";
  const buttonStateClass = (direction: Exclude<SteeringDirection, null>) => {
    if (isDriving || !isConnected) {
      return "cursor-not-allowed border-white/10 bg-white/[0.04] text-white/20";
    }

    if (activeDirection === direction) {
      return direction === "left"
        ? "border-cyan-400/60 bg-cyan-400/20 text-cyan-100 shadow-[0_0_24px_rgba(34,211,238,0.22)]"
        : "border-amber-400/60 bg-amber-400/20 text-amber-100 shadow-[0_0_24px_rgba(251,191,36,0.22)]";
    }

    return "border-white/10 bg-black/25 text-white/80 hover:border-white/20 hover:bg-white/[0.08]";
  };


  return (
    <div className="flex flex-col items-center gap-3">
      {/* Radar Status Panel */}
      <CarStatusPanel className="w-[260px]" />

      {/* Speed & Angle Display - Above Wheel */}
      <div className="w-[260px] flex justify-between items-center bg-black/20 backdrop-blur-sm px-6 py-2 rounded-2xl border border-white/10">
        {/* Speed */}
        <div className="flex flex-col items-center">
          <span className="text-[10px] font-bold text-white/60 uppercase tracking-wider">Speed</span>
          <div className="flex items-baseline gap-1">
            <span className="text-xl font-bold text-white font-mono">
              {((currentSpeed / 1000) * 3.6).toFixed(1)}
            </span>
            <span className="text-[10px] font-bold text-white/60 uppercase">km/h</span>
          </div>
        </div>

        <div className="w-px h-8 bg-white/10" />

        {/* Angle (Tire) */}
        <div className="flex flex-col items-center">
          <span className="text-[10px] font-bold text-white/60 uppercase tracking-wider">Angle</span>
          <span className="font-mono font-bold text-xl text-white">
            {displayedTireAngle.toFixed(1)}°
          </span>
        </div>
      </div>

      <div className="mt-3 w-[260px] px-2 py-1">
        <div className="flex items-center justify-center gap-3">
          <button
            type="button"
            disabled={isDriving || !isConnected}
            className={`${buttonBaseClass} ${buttonStateClass("left")}`}
            onPointerDown={() => startSteering("left")}
            onPointerUp={stopSteering}
            onPointerLeave={stopSteering}
            onPointerCancel={stopSteering}
          >
            <div className="absolute inset-[8px] rounded-[16px] border border-white/10 group-hover:border-white/15" />
            <ChevronLeft className="relative z-10 h-8 w-8" />
          </button>

          <button
            type="button"
            disabled={isDriving || !isConnected}
            className={`group relative flex h-[76px] w-[76px] items-center justify-center rounded-[22px] border backdrop-blur-md transition-all duration-200 select-none shrink-0 ${isDriving || !isConnected
              ? "cursor-not-allowed border-white/10 bg-white/[0.04] text-white/20"
              : "border-white/10 bg-white/[0.05] text-white/65 hover:border-white/20 hover:bg-white/[0.08]"
              }`}
            onClick={resetSteering}
            aria-label="Reset steering"
          >
            <div className="absolute inset-[8px] rounded-[16px] border border-white/10 group-hover:border-white/15" />
            <RotateCcw className="relative z-10 h-5 w-5" />
          </button>

          <button
            type="button"
            disabled={isDriving || !isConnected}
            className={`${buttonBaseClass} ${buttonStateClass("right")}`}
            onPointerDown={() => startSteering("right")}
            onPointerUp={stopSteering}
            onPointerLeave={stopSteering}
            onPointerCancel={stopSteering}
          >
            <div className="absolute inset-[8px] rounded-[16px] border border-white/10 group-hover:border-white/15" />
            <ChevronRight className="relative z-10 h-8 w-8" />
          </button>
        </div>

        <div className="mt-2 text-center text-[10px] font-medium uppercase tracking-[0.14em] text-white/35">
          {isDriving ? "Auto Sync" : `${displayedTireAngle.toFixed(1)}°`}
        </div>
      </div>

      {/* Pedals - Passed down */}
      <div className="mt-2 w-full">
        <Pedals currentSteeringAngle={tireAngleDegNumber} />
      </div>

      {/* Vehicle Controls - Integrated below pedals */}
      <div className="mt-4 w-full flex justify-center">
        <div className="bg-black/20 backdrop-blur-md p-4 rounded-2xl border border-white/10 w-full max-w-[320px]">
          <div className="flex items-center gap-2 mb-3 text-white/60">
            <Settings2 className="w-3 h-3" />
            <span className="text-[10px] font-bold uppercase tracking-widest">Vehicle Controls</span>
          </div>
          <CarControlPanel />
        </div>
      </div>
    </div>
  );
};

export default SteeringWheelContinued;
