import React from "react";
import { Gauge, gaugeClasses } from "@mui/x-charts/Gauge";

interface CPUGaugeProps {
  value: number;
  label: string;
}

const CPUGauge: React.FC<CPUGaugeProps> = ({ value, label }) => {
  // 根据使用率确定颜色
  const getGaugeColor = (val: number) => {
    // 灰色：无数据或错误（保持静默）
    if (val <= 0) return "#9CA3AF";

    // 80 红色：极高负载，危险区域
    if (val >= 90) return "#F87171"; // Red 400

    // 60 琥珀色/黄色：高负载，警告区域
    if (val >= 80) return "#FACC15"; // Amber 400

    // 20青色：中负载，活跃但健康
    if (val >= 20) return "#22D3EE"; // Cyan 400

    // 绿色：低负载，理想状态
    return "#34D399"; // Emerald 400 (或使用更深的绿色如 #059669)
  };

  const gaugeColor = getGaugeColor(value);

  return (
    <div className="flex flex-col items-center gap-2 h-full">
      <Gauge
        value={Math.min(100, Math.max(0, value))}
        startAngle={-110}
        endAngle={110}
        sx={{
          [`& .${gaugeClasses.valueText} text`]: {
            fontSize: 24,
            fontWeight: "bold",
            fill: gaugeColor,
          },
          [`& .${gaugeClasses.valueArc}`]: {
            fill: gaugeColor,
          },
        }}
        text={({ value }) => `${value}%`}
      />
      <p className="text-xs text-gray-400">{label}</p>
    </div>
  );
};

export default CPUGauge;
