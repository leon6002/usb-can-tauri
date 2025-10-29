import React from "react";

interface StatusIndicatorProps {
  status: number;
  label: string;
}

const StatusIndicator: React.FC<StatusIndicatorProps> = ({ status, label }) => {
  const getStatusColor = (status: number) => {
    switch (status) {
      case 0:
        return "#ef4444"; // 红色
      case 1:
        return "#eab308"; // 黄色
      case 2:
        return "#10b981"; // 绿色
      default:
        return "#6b7280";
    }
  };

  const getStatusGlow = (status: number) => {
    switch (status) {
      case 0:
        return "shadow-red-500/50"; // 红色光晕
      case 1:
        return "shadow-yellow-500/50"; // 黄色光晕
      case 2:
        return "shadow-green-500/50"; // 绿色光晕
      default:
        return "shadow-gray-500/50";
    }
  };

  const statusColor = getStatusColor(status);
  const statusGlow = getStatusGlow(status);

  return (
    <div className="flex items-center justify-between bg-slate-600/50 rounded-lg px-3 py-2 backdrop-blur-sm border border-slate-500/30">
      <p className="font-light text-gray-200 text-sm">{label}</p>
      <div className="flex items-center gap-2">
        {/* 外层光晕圆 */}
        <div
          className={`w-3 h-3 rounded-full ${statusGlow} shadow-lg`}
          style={{
            backgroundColor: statusColor,
            boxShadow: `0 0 12px ${statusColor}80, 0 0 6px ${statusColor}`,
          }}
        ></div>
      </div>
    </div>
  );
};

export default StatusIndicator;
