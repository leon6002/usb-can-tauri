import React, { useRef, useEffect, useState } from "react";

// --- 常量定义 ---
const TWO_PI = Math.PI * 2;
// 将角度转换为弧度的辅助函数
const toRad = (deg: number) => (deg * Math.PI) / 180;
// 将弧度转换为角度的辅助函数
const toDeg = (rad: number) => (rad * 180) / Math.PI;

// 最大旋转角度限制：正负 240 度
const MAX_ROTATION_DEG = 240;
const MAX_ROTATION_RAD = toRad(MAX_ROTATION_DEG);

const SteeringWheelContinued = () => {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  // 记录当前方向盘的旋转角度（弧度）
  // 初始化为 0，该值现在可以超过 -PI 到 PI 的范围
  const [rotation, setRotation] = useState(0);
  const [isDragging, setIsDragging] = useState(false);

  // 使用 useRef 来记录上一次鼠标移动时的角度位置
  // 使用 ref 而不是 state，因为我们不需要它的变化来触发重新渲染
  const lastMouseAngleRef = useRef(0);

  // 画布尺寸配置
  const size = 250;
  const center = size / 2;
  const radius = 100;

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

    // A. 绘制外圈
    ctx.beginPath();
    ctx.arc(0, 0, radius, 0, TWO_PI);
    ctx.lineWidth = 20;
    ctx.strokeStyle = "#374151";
    ctx.stroke();

    // B. 绘制内圈装饰
    ctx.beginPath();
    ctx.arc(0, 0, radius - 15, 0, TWO_PI);
    ctx.lineWidth = 2;
    ctx.strokeStyle = "#6B7280";
    ctx.stroke();

    // C. 绘制辐条
    ctx.beginPath();
    ctx.lineWidth = 15;
    ctx.lineCap = "round";
    ctx.strokeStyle = "#4B5563";
    ctx.moveTo(0, 0);
    ctx.lineTo(0, radius - 10); // 下
    ctx.moveTo(0, 0);
    ctx.lineTo(
      (radius - 10) * Math.cos(toRad(210)),
      (radius - 10) * Math.sin(toRad(210))
    ); // 左上
    ctx.moveTo(0, 0);
    ctx.lineTo(
      (radius - 10) * Math.cos(toRad(330)),
      (radius - 10) * Math.sin(toRad(330))
    ); // 右上
    ctx.stroke();

    // D. 绘制中心盖
    ctx.beginPath();
    ctx.arc(0, 0, 30, 0, TWO_PI);
    ctx.fillStyle = "#1F2937";
    ctx.fill();

    // E. 绘制顶部红色回正标记
    ctx.beginPath();
    ctx.lineWidth = 20;
    ctx.strokeStyle = "#EF4444";
    ctx.arc(0, 0, radius, -Math.PI / 2 - 0.1, -Math.PI / 2 + 0.1);
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
  const displayDegree = toDeg(rotation).toFixed(0);
  // 根据角度判断颜色，接近极限时变红
  const isNearLimit = Math.abs(toDeg(rotation)) > MAX_ROTATION_DEG - 10;

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-gray-100 p-4 select-none">
      <div className="bg-white p-6 rounded-xl shadow-xl border border-gray-200">
        <h2 className="text-xl font-bold text-gray-800 mb-4 text-center">
          Steering
        </h2>

        <canvas
          ref={canvasRef}
          width={size}
          height={size}
          className="cursor-pointer touch-none"
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onMouseLeave={handleMouseUp}
          style={{ width: size, height: size }}
        />

        <div className="mt-4 text-center">
          <p
            className={`text-lg font-mono transition-colors ${
              isNearLimit ? "text-red-600 font-bold" : "text-gray-700"
            }`}
          >
            当前角度: {displayDegree}°
          </p>
          <p className="text-sm text-gray-400">
            最大限制: ±{MAX_ROTATION_DEG}°
          </p>
        </div>
      </div>
    </div>
  );
};

export default SteeringWheelContinued;
