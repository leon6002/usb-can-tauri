import { useEffect } from "react";
import { useSystemMonitorStore } from "@/store/systemMonitorStore";
import { Cpu } from "lucide-react";
import VMPanel from "./VMPanel";

const CPU_LABELS = [
  "G4MH Core @400Mhz MBIST&TCM",
  "G4MH Core @400Mhz MBIST&TCM",
  "G4MH Core @400Mhz MBIST&TCM",
  "G4MH Core @400Mhz MBIST&TCM",
];

const SystemMonitorWindow: React.FC = () => {
  const currentData = useSystemMonitorStore((state) => state.currentData);
  const historyData = useSystemMonitorStore((state) => state.historyData);
  const startListening = useSystemMonitorStore((state) => state.startListening);
  const stopListening = useSystemMonitorStore((state) => state.stopListening);

  useEffect(() => {
    startListening();
    return () => {
      stopListening();
    };
  }, [startListening, stopListening]);

  // 准备图表数据 - 提取内存数据数组
  const memoryData = historyData.map((point) => point.memory);

  // 准备时间标签 - 显示秒数
  const timeLabels = historyData.map((point) => {
    return point.timestamp;
  });

  // VM1 状态指示器
  const vm1StatusIndicators = [
    {
      status: currentData?.steeringControl || 0,
      label: "转向控制 (CAN1)",
    },
    {
      status: currentData?.brakeControl || 0,
      label: "制动控制 (CAN2)",
    },
  ];

  // VM2 状态指示器
  const vm2StatusIndicators = [
    {
      status: currentData?.bodyControl || 0,
      label: "车身控制 (PWM, SPI)",
    },
    {
      status: currentData?.acSystem || 0,
      label: "空气调节系统 (PWM, 高低驱动)",
    },
  ];

  return (
    <div
      className="w-full h-screen overflow-hidden relative flex flex-col"
      style={{
        backgroundImage: "url('/images/earth-bg.jpg')",
        backgroundSize: "cover",
        backgroundPosition: "center",
        backgroundAttachment: "fixed",
      }}
    >
      {/* 背景遮罩层 - 添加 blur 效果 */}
      <div
        className="absolute inset-0 bg-black/40 pointer-events-none"
        style={{
          backdropFilter: "blur(3px)",
        }}
      ></div>

      {/* 内容容器 - 垂直居中 */}
      <div className="relative z-10 flex flex-col h-full p-4 overflow-hidden justify-center mx-auto w-[96%]">
        {/* 标题 */}
        <div className="flex-shrink-0 mb-6 p-4 rounded-lg bg-gray-800/60 backdrop-blur-sm shadow-2xl border-l-4 border-cyan-500">
          <div className="flex items-center justify-between">
            <div className="flex items-center">
              <Cpu className="w-6 h-6 mr-3 text-cyan-400" />
              <h1 className="text-xl font-bold text-white tracking-wide">
                EE架构 <span className="text-cyan-400">性能监控系统</span>
              </h1>
            </div>
          </div>
          <p className="text-xs text-gray-400 mt-2 ml-9">
            实时高可用域 (ASIL D/B) 核心性能数据概览
          </p>
        </div>

        {/* 主容器 - VM1 和 VM2 占高度的 60-70% */}
        <div className="grid grid-cols-7 gap-4 h-[65%] overflow-hidden flex-shrink-0">
          {/* 左侧：VM1 - ASIL D */}
          <VMPanel
            className="col-span-4"
            title="VM1 - ASIL D"
            cpuValues={[
              currentData?.cpu1 || 0,
              currentData?.cpu2 || 0,
              currentData?.cpu3 || 0,
            ]}
            cpuLabels={CPU_LABELS.slice(0, 3)}
            memoryData={memoryData}
            timeLabels={timeLabels}
            statusIndicators={vm1StatusIndicators}
          />

          {/* 右侧：VM2 - ASIL B */}
          <VMPanel
            className="col-span-3"
            title="VM2 - ASIL B"
            cpuValues={[currentData?.cpu1 || 0]}
            cpuLabels={[CPU_LABELS[3]]}
            memoryData={memoryData}
            timeLabels={timeLabels}
            statusIndicators={vm2StatusIndicators}
          />
        </div>
      </div>
    </div>
  );
};

export default SystemMonitorWindow;
