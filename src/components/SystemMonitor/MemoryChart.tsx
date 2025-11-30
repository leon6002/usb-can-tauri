import React from "react";
import {
  AreaChart,
  CartesianGrid,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  Area,
} from "recharts";

interface MemoryChartProps {
  memoryData: number[];
  timeLabels: string[];
}

const MemoryChart: React.FC<MemoryChartProps> = ({
  memoryData,
  timeLabels,
}) => {
  const intialData = [
    { time: "0", memory: 0 },
    { time: "0", memory: 0 },
    { time: "0", memory: 0 },
    { time: "0", memory: 0 },
    { time: "0", memory: 0 },
    { time: "0", memory: 0 },
  ];
  const chartData =
    memoryData.length > 0
      ? memoryData.map((value, index) => ({
        time: timeLabels[index] || `${index}s`,
        memory: value,
      }))
      : intialData;

  const getFillColor = (val: number) => {
    // 灰色：无数据或错误（保持静默）
    if (val <= 0) return "#9CA3AF";

    // 80 红色：极高负载，危险区域
    if (val >= 95) return "#F87171"; // Red 400

    // 60 琥珀色/黄色：高负载，警告区域
    if (val >= 90) return "#FACC15"; // Amber 400

    // 20青色：中负载，活跃但健康
    if (val >= 20) return "#0cae09a3"; // Cyan 400

    // 绿色：低负载，理想状态
    return "#34D399"; // Emerald 400 (或使用更深的绿色如 #059669)
  };

  return (
    <div className="bg-slate-600 rounded-lg p-2 mb-2 flex-1 overflow-hidden">
      <p className="text-gray-300 text-xs mb-1 ml-10">Memory Stack</p>
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart
          data={chartData}
          margin={{ top: 10, right: 10, bottom: 20, left: -10 }}
        >
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis
            dataKey="time"
            tick={{ fontSize: 10, fill: "#9ca3af" }}
            stroke="#c1c2c4"
          />
          <YAxis
            domain={[0, 100]}
            tick={{ fontSize: 10, fill: "#9ca3af" }}
            stroke="#c1c2c4"
            type="number"
          />
          <Tooltip
            contentStyle={{
              backgroundColor: "#1e293b",
              border: "1px solid #4b5563",
              borderRadius: "4px",
            }}
            labelStyle={{ color: "#9ca3af" }}
            formatter={(value) => `${value}%`}
          />
          <Area
            type="monotone"
            dataKey="memory"
            stroke={getFillColor(chartData[0].memory)}
            fill={getFillColor(chartData[0].memory)}
            isAnimationActive={true}
            animationDuration={300}
            animationEasing="linear"
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
};

export default MemoryChart;
