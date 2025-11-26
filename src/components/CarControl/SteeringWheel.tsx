import React, { useRef, useEffect, useState } from "react";
import { useSteeringControl } from "@/hooks/useSteeringControl";
import { Pedals } from "./Pedals";
import { CarControlPanel } from "./CarControlPanel";
import { Settings2 } from "lucide-react";


// --- 常量定义 ---
const TWO_PI = Math.PI * 2;
// 将角度转换为弧度的辅助函数
const toRad = (deg: number) => (deg * Math.PI) / 180;
// 将弧度转换为角度的辅助函数
const toDeg = (rad: number) => (rad * 180) / Math.PI;

// 最大旋转角度限制：正负 240 度
const MAX_ROTATION_DEG = 200;
const MAX_ROTATION_RAD = toRad(MAX_ROTATION_DEG);

// 转向比：方向盘转8度，轮胎转1度
const STEERING_RATIO = 8;

const SteeringWheelContinued = () => {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  // 记录当前方向盘的旋转角度（弧度）
  // 初始化为 0，该值现在可以超过 -PI 到 PI 的范围
  const [rotation, setRotation] = useState(0);
  const [isDragging, setIsDragging] = useState(false);

  // 使用 useRef 来记录上一次鼠标移动时的角度位置
  // 使用 ref 而不是 state，因为我们不需要它的变化来触发重新渲染
  const lastMouseAngleRef = useRef(0);

  // 计算当前方向盘角度（度数）
  const steeringWheelAngleDeg = toDeg(rotation);

  // 使用方向盘控制 Hook（转向比 8:1）
  useSteeringControl(steeringWheelAngleDeg, STEERING_RATIO);

  // 画布尺寸配置 - 紧凑尺寸
  const size = 160; // Reduced size for compact layout
  const center = size / 2;
  const radius = 65; // Reduced radius

  // --- 绘图逻辑 (保持不变) ---
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    ctx.clearRect(0, 0, size, size);
    ctx.save();
    ctx.translate(center, center);
    // 这里直接使用当前的累计旋转角度
    ctx.rotate(rotation);

    // Light Theme Colors
    const wheelColor = "#1f2937"; // Gray-800
    const spokeColor = "#374151"; // Gray-700
    const accentColor = "#ef4444"; // Red-500

    // A. 绘制外圈
    ctx.beginPath();
    ctx.arc(0, 0, radius, 0, TWO_PI);
    ctx.lineWidth = 10; // Thinner line
    ctx.strokeStyle = wheelColor;
    ctx.shadowColor = "rgba(0,0,0,0.1)";
    ctx.shadowBlur = 8;
    ctx.stroke();
    ctx.shadowBlur = 0; // Reset shadow

    // B. 绘制内圈装饰
    ctx.beginPath();
    ctx.arc(0, 0, radius - 8, 0, TWO_PI);
    ctx.lineWidth = 1.5;
    ctx.strokeStyle = "#4b5563"; // Gray-600
    ctx.stroke();

    // C. 绘制辐条
    ctx.beginPath();
    ctx.lineWidth = 8; // Thinner spokes
    ctx.lineCap = "round";
    ctx.strokeStyle = spokeColor;
    ctx.moveTo(0, 0);
    ctx.lineTo(0, radius - 6); // 下
    ctx.moveTo(0, 0);
    ctx.lineTo(
      (radius - 6) * Math.cos(toRad(210)),
      (radius - 6) * Math.sin(toRad(210))
    ); // 左上
    ctx.moveTo(0, 0);
    ctx.lineTo(
      (radius - 6) * Math.cos(toRad(330)),
      (radius - 6) * Math.sin(toRad(330))
    ); // 右上
    ctx.stroke();

    // D. 绘制中心盖
    ctx.beginPath();
    ctx.arc(0, 0, 18, 0, TWO_PI);
    ctx.fillStyle = "#111827"; // Gray-900
    ctx.fill();

    // Logo placeholder
    ctx.beginPath();
    ctx.arc(0, 0, 6, 0, TWO_PI);
    ctx.fillStyle = "#374151";
    ctx.fill();

    // E. 绘制顶部红色回正标记
    ctx.beginPath();
    ctx.lineWidth = 10;
    ctx.strokeStyle = accentColor;
    ctx.arc(0, 0, radius, -Math.PI / 2 - 0.15, -Math.PI / 2 + 0.15);
    ctx.stroke();

    ctx.restore();
  }, [rotation]);

  // --- 交互逻辑的核心修改 ---

  // 计算鼠标相对于画布中心的角度 (-PI 到 PI)
  const getMouseAngle = (event: React.MouseEvent | MouseEvent) => {
    const canvas = canvasRef.current;
    if (!canvas) return 0;
    const rect = canvas.getBoundingClientRect();
    const x = event.clientX - rect.left - center;
    const y = event.clientY - rect.top - center;
    return Math.atan2(y, x);
  };

  const handleMouseDown = (e: React.MouseEvent) => {
    setIsDragging(true);
    // 记录鼠标按下的瞬间的角度，作为起始参照点
    lastMouseAngleRef.current = getMouseAngle(e);
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDragging) return;

    const currentMouseAngle = getMouseAngle(e);
    const lastAngle = lastMouseAngleRef.current;

    // 1. 计算增量：这一帧鼠标转了多少度
    let delta = currentMouseAngle - lastAngle;

    // 2. --- 核心修复：处理跨越 ±180度边界的跳变 ---
    // 如果增量特别大（大于 PI），说明跨越了边界。
    // 例如：从 -179度 变到了 +179度。直接相减是 358度。
    // 我们需要把它修正为实际移动的 -2度。
    if (delta > Math.PI) {
      delta -= TWO_PI;
    } else if (delta < -Math.PI) {
      delta += TWO_PI;
    }

    // 3. 计算目标角度
    let newRotation = rotation + delta;

    // 4. --- 核心功能：限制最大角度为 ±240度 ---
    // 使用 Math.max 和 Math.min 将角度钳制在范围内
    newRotation = Math.max(
      -MAX_ROTATION_RAD,
      Math.min(MAX_ROTATION_RAD, newRotation)
    );

    // 更新状态
    setRotation(newRotation);

    // 5. 重要：更新“上一次”鼠标角度为当前角度，供下一帧使用
    lastMouseAngleRef.current = currentMouseAngle;
  };

  const handleMouseUp = () => {
    setIsDragging(false);
  };

  // 计算显示的当前角度（整数）
  const displayDegree = steeringWheelAngleDeg.toFixed(0);
  // 计算轮胎转向角
  const tireAngleDeg = (steeringWheelAngleDeg / STEERING_RATIO).toFixed(1);
  const tireAngleDegNumber = steeringWheelAngleDeg / STEERING_RATIO;
  // 根据角度判断颜色，接近极限时变红
  const isNearLimit = Math.abs(steeringWheelAngleDeg) > MAX_ROTATION_DEG - 10;

  return (
    <div className="flex flex-col items-center">
      {/* Steering Wheel Container - Transparent */}
      <div className="flex flex-col items-center justify-center relative">
        <div className="relative mb-2">
          {/* Angle Indicator Ring - Subtle */}
          <div className="absolute inset-0 rounded-full border border-dashed border-white/30 opacity-50 pointer-events-none" />

          <canvas
            ref={canvasRef}
            width={size}
            height={size}
            className="cursor-pointer touch-none block relative z-10 drop-shadow-2xl"
            onMouseDown={handleMouseDown}
            onMouseMove={handleMouseMove}
            onMouseUp={handleMouseUp}
            onMouseLeave={handleMouseUp}
            style={{ width: size, height: size }}
          />
        </div>

        {/* Data Display - Floating Text */}
        <div className="flex gap-4 w-full justify-center bg-black/20 backdrop-blur-sm px-4 py-1 rounded-full border border-white/10">
          <div className="flex flex-col items-center">
            <span className="text-[9px] font-bold text-white/60 uppercase tracking-wider">Wheel</span>
            <span
              className={`font-mono font-bold text-xs ${isNearLimit ? "text-red-400" : "text-white"
                }`}
            >
              {displayDegree}°
            </span>
          </div>

          <div className="w-px h-6 bg-white/20" />

          <div className="flex flex-col items-center">
            <span className="text-[9px] font-bold text-blue-300/80 uppercase tracking-wider">Tire</span>
            <span className="font-mono font-bold text-xs text-blue-300">
              {tireAngleDeg}°
            </span>
          </div>
        </div>
      </div>

      {/* Pedals - Passed down */}
      <Pedals currentSteeringAngle={tireAngleDegNumber} />

      {/* Vehicle Controls - Integrated below pedals */}
      <div className="mt-6 w-full flex justify-center">
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
