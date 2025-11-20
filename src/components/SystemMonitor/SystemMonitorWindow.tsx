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

  // prepare chart data - extract memory data array
  const memoryData = historyData.map((point) => point.memory);

  // prepare time labels - display seconds
  const timeLabels = historyData.map((point) => {
    return point.timestamp;
  });

  // VM1 status indicator
  const vm1StatusIndicators = [
    {
      status: currentData?.steeringControl || 0,
      label: "Steering control (CAN1)",
    },
    {
      status: currentData?.brakeControl || 0,
      label: "Brake control (CAN2)",
    },
  ];

  // VM2 status indicator
  const vm2StatusIndicators = [
    {
      status: currentData?.bodyControl || 0,
      label: "Body control (PWM, SPI)",
    },
    {
      status: currentData?.acSystem || 0,
      label: "Air conditioning system (PWM, high-low drive)",
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
      {/* backdropfilter*/}
      <div
        className="absolute inset-0 bg-black/40 pointer-events-none"
        style={{
          backdropFilter: "blur(3px)",
        }}
      ></div>

      {/* content container */}
      <div className="relative z-10 flex flex-col h-full p-4 overflow-hidden justify-center mx-auto w-[96%]">
        {/* title */}
        <div className="flex-shrink-0 mb-6 p-4 rounded-lg bg-gray-800/60 backdrop-blur-sm shadow-2xl border-l-4 border-cyan-500">
          <div className="flex items-center justify-between">
            <div className="flex items-center">
              <Cpu className="w-6 h-6 mr-3 text-cyan-400" />
              <h1 className="text-xl font-bold text-white tracking-wide">
                EE Arch <span className="text-cyan-400">System monitor</span>
              </h1>
            </div>
          </div>
          <p className="text-xs text-gray-400 mt-2 ml-9">
            Real-time high-availability domain (ASIL D/B) core performance data
            overview
          </p>
        </div>

        {/* main container */}
        <div className="grid grid-cols-7 gap-4 h-[65%] overflow-hidden flex-shrink-0">
          {/* left side：VM1 - ASIL D */}
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

          {/* right side：VM2 - ASIL B */}
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
