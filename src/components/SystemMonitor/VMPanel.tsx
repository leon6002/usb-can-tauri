import React from "react";
import CPUGauge from "./CPUGauge";
import MemoryChart from "./MemoryChart";
import StatusIndicator from "./StatusIndicator";

interface VMPanelProps {
  className: string;
  title: string;
  cpuValues: number[];
  cpuLabels: string[];
  memoryData: number[];
  timeLabels: string[];
  statusIndicators: Array<{
    status: number;
    label: string;
  }>;
}

const VMPanel: React.FC<VMPanelProps> = ({
  className,
  title,
  cpuValues,
  cpuLabels,
  memoryData,
  timeLabels,
  statusIndicators,
}) => {
  return (
    <div
      className={`bg-slate-700 rounded-lg p-3 shadow-xl flex flex-col overflow-hidden opacity-90 bg-opacity-60 shadow-cyan-100/10 ${className}`}
    >
      {/* 标题栏 */}
      <div className="flex justify-between items-center mb-3 flex-shrink-0">
        <h2 className="text-lg font-bold text-white">{title}</h2>
        {/* <div className="bg-green-500 text-white px-2 py-0.5 rounded-full text-xs font-medium">
          {status}
        </div> */}
      </div>

      {/* CPU 仪表盘 */}
      <div className="flex justify-around gap-2 mb-3 h-[40%]">
        {cpuValues.map((value, index) => (
          <div
            key={index}
            className="rounded-lg bg-slate-600 bg-opacity-80 p-4 h-full w-full"
          >
            <CPUGauge value={value} label={cpuLabels[index]} />
          </div>
        ))}
      </div>

      {/* 内存图表 */}
      <MemoryChart memoryData={memoryData} timeLabels={timeLabels} />

      {/* 系统状态指示器 */}
      <div className="grid grid-cols-2 gap-4">
        {statusIndicators.map((indicator, index) => (
          <StatusIndicator
            key={index}
            status={indicator.status}
            label={indicator.label}
          />
        ))}
      </div>
    </div>
  );
};

export default VMPanel;
