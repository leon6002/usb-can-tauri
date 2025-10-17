import React, { useRef, useEffect, useState } from "react";

interface SteeringWheelUIProps {
  onSteeringChange?: (angle: number) => void;
  /** 外部设置的方向盘转向角（用于显示CSV数据中的转向角） */
  externalSteeringAngle?: number;
}

export const SteeringWheelUI: React.FC<SteeringWheelUIProps> = ({
  onSteeringChange,
  externalSteeringAngle,
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [rotation, setRotation] = useState(0);
  const [isControlling, setIsControlling] = useState(false);
  const [lastMouseX, setLastMouseX] = useState(0);
  const maxRotation = Math.PI * 0.85; // ±135°

  // 当外部转向角变化时，更新方向盘显示
  useEffect(() => {
    if (externalSteeringAngle !== undefined && !isControlling) {
      setRotation(externalSteeringAngle);
    }
  }, [externalSteeringAngle, isControlling]);

  // 绘制方向盘
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const centerX = canvas.width / 2;
    const centerY = canvas.height / 2;
    const radius = 45;

    // 清空画布
    ctx.fillStyle = "#f0f0f0";
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // 保存当前状态
    ctx.save();

    // 移动到中心并旋转
    ctx.translate(centerX, centerY);
    ctx.rotate(rotation);

    // 绘制方向盘主体（圆环）
    ctx.strokeStyle = "#1a1a1a";
    ctx.lineWidth = 8;
    ctx.beginPath();
    ctx.arc(0, 0, radius, 0, Math.PI * 2);
    ctx.stroke();

    // 绘制辐条
    ctx.strokeStyle = "#333333";
    ctx.lineWidth = 4;
    for (let i = 0; i < 4; i++) {
      const angle = (i * Math.PI) / 2;
      const x1 = Math.cos(angle) * 20;
      const y1 = Math.sin(angle) * 20;
      const x2 = Math.cos(angle) * (radius - 8);
      const y2 = Math.sin(angle) * (radius - 8);
      ctx.beginPath();
      ctx.moveTo(x1, y1);
      ctx.lineTo(x2, y2);
      ctx.stroke();
    }

    // 绘制中心圆
    ctx.fillStyle = "#444444";
    ctx.beginPath();
    ctx.arc(0, 0, 15, 0, Math.PI * 2);
    ctx.fill();

    // 绘制顶部指示器
    ctx.fillStyle = "#ff6b6b";
    ctx.beginPath();
    ctx.arc(0, -radius - 5, 5, 0, Math.PI * 2);
    ctx.fill();

    ctx.restore();

    // 绘制角度显示
    ctx.fillStyle = "#716b6b";
    ctx.font = "14px Arial";
    ctx.textAlign = "center";
    const angleDegrees = (rotation * 180) / Math.PI;
    ctx.fillText(`${angleDegrees.toFixed(1)}°`, centerX, canvas.height - 55);
  }, [rotation]);

  // 鼠标按下
  const handleMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    setIsControlling(true);
    setLastMouseX(e.clientX);
  };

  // 鼠标移动
  const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!isControlling) return;

    const deltaX = e.clientX - lastMouseX;
    const sensitivity = 0.01;
    let newRotation = rotation + deltaX * sensitivity;
    console.log("newRotation", newRotation);

    // 限制转向角度
    newRotation = Math.max(-maxRotation, Math.min(maxRotation, newRotation));

    setRotation(newRotation);
    setLastMouseX(e.clientX);

    // 通知父组件
    if (onSteeringChange) {
      onSteeringChange(newRotation);
    }
  };

  // 鼠标释放
  const handleMouseUp = () => {
    setIsControlling(false);
  };

  // 添加全局鼠标事件监听
  useEffect(() => {
    if (!isControlling) return;

    const handleGlobalMouseMove = (e: MouseEvent) => {
      setRotation((prevRotation) => {
        const deltaX = e.clientX - lastMouseX;
        const sensitivity = 0.01;
        let newRotation = prevRotation + deltaX * sensitivity;

        newRotation = Math.max(
          -maxRotation,
          Math.min(maxRotation, newRotation)
        );

        setLastMouseX(e.clientX);

        if (onSteeringChange) {
          onSteeringChange(newRotation);
        }

        return newRotation;
      });
    };

    const handleGlobalMouseUp = () => {
      setIsControlling(false);
    };

    window.addEventListener("mousemove", handleGlobalMouseMove);
    window.addEventListener("mouseup", handleGlobalMouseUp);

    return () => {
      window.removeEventListener("mousemove", handleGlobalMouseMove);
      window.removeEventListener("mouseup", handleGlobalMouseUp);
    };
  }, [isControlling, lastMouseX, onSteeringChange]);

  return (
    <div className="flex flex-col items-center gap-2">
      {/* 方向盘画布 */}
      <canvas
        ref={canvasRef}
        width={120}
        height={120}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
        className="bg-white rounded-full shadow-lg cursor-grab active:cursor-grabbing border-2 border-gray-300"
        title="方向盘"
      />
    </div>
  );
};
