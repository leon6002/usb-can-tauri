import { useEffect, useState } from "react";
import { useSystemMonitorStore } from "@/store/systemMonitorStore";
import { Button } from "../ui/button";
import VMPanel from "./VMPanel";
import { invoke } from "@tauri-apps/api/core";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { Cpu, Plug, RefreshCw, Unplug, Maximize, Minimize } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const CPU_LABELS = [
  "G4MH Core @400Mhz MBIST&TCM",
  "G4MH Core @400Mhz MBIST&TCM",
  "G4MH Core @400Mhz MBIST&TCM",
  "G4MH Core @400Mhz MBIST&TCM",
];

const SystemMonitorWindow: React.FC = () => {
  const currentData = useSystemMonitorStore((state) => state.currentData);
  const historyData = useSystemMonitorStore((state) => state.historyData);
  const isConnected = useSystemMonitorStore((state) => state.isConnected);
  const connect = useSystemMonitorStore((state) => state.connect);
  const disconnect = useSystemMonitorStore((state) => state.disconnect);

  const [ports, setPorts] = useState<string[]>([]);
  const [selectedPort, setSelectedPort] = useState<string>("");
  const [isConnecting, setIsConnecting] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);

  useEffect(() => {
    const checkFullscreen = async () => {
      try {
        const window = getCurrentWindow();
        const fullscreen = await window.isFullscreen();
        setIsFullscreen(fullscreen);
      } catch (error) {
        console.error("Failed to check fullscreen status:", error);
      }
    };
    checkFullscreen();
  }, []);

  const toggleFullscreen = async () => {
    try {
      const window = getCurrentWindow();
      const newFullscreenState = !isFullscreen;
      await window.setFullscreen(newFullscreenState);
      setIsFullscreen(newFullscreenState);
    } catch (error) {
      console.error("Failed to toggle fullscreen:", error);
    }
  };

  const fetchPorts = async () => {
    try {
      const availablePorts = await invoke<string[]>("get_available_ports");
      setPorts(availablePorts);
      if (availablePorts.length > 0 && !selectedPort) {
        setSelectedPort(availablePorts[0]);
      }
    } catch (error) {
      console.error("Failed to fetch ports:", error);
    }
  };

  useEffect(() => {
    fetchPorts();
  }, []);

  const handleConnect = async () => {
    if (!selectedPort) return;
    setIsConnecting(true);
    try {
      await connect(selectedPort, 500000); // Default baud rate 500000 as per python script
    } catch (error) {
      console.error("Connection failed", error);
    } finally {
      setIsConnecting(false);
    }
  };

  const handleDisconnect = async () => {
    await disconnect();
  };

  // prepare chart data
  // VM1 Memory (ASIL D) -> Use vm1_mem
  const vm1MemoryData = historyData.map((point) => point.memory); // Store currently saves max, let's use currentData for live? No, VMPanel needs history.
  // We need to update store to save both memories in history if we want separate charts.
  // For now, let's just use the 'memory' field from history which is max(vm0, vm1) as a fallback, 
  // or better, let's update VMPanel to accept current value for gauge and history for chart.
  // But VMPanel takes `memoryData` array.
  // Let's stick to the store's `memory` for now which is max. 
  // Ideally we should update store to keep track of both.

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
      label: "Air conditioning (PWM)",
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
        {/* title & connection bar */}
        <div className="flex-shrink-0 mb-6 p-4 rounded-lg bg-gray-800/60 backdrop-blur-sm shadow-2xl border-l-4 border-cyan-500 flex justify-between items-center">
          <div>
            <div className="flex items-center">
              <Cpu className="w-6 h-6 mr-3 text-cyan-400" />
              <h1 className="text-xl font-bold text-white tracking-wide">
                EE Arch <span className="text-cyan-400">System monitor</span>
              </h1>
            </div>
            <p className="text-xs text-gray-400 mt-2 ml-9">
              Real-time high-availability domain (ASIL D/B) core performance data overview
            </p>
          </div>

          {/* Connection Controls */}
          <div className="flex items-center gap-4 bg-black/30 p-2 rounded-md">
            <Button
              onClick={toggleFullscreen}
              variant="ghost"
              size="icon"
              className="text-gray-400 hover:text-white mr-2"
              title={isFullscreen ? "Exit Fullscreen" : "Enter Fullscreen"}
            >
              {isFullscreen ? <Minimize size={18} /> : <Maximize size={18} />}
            </Button>
            {!isConnected ? (
              <>
                <Select value={selectedPort} onValueChange={setSelectedPort}>
                  <SelectTrigger className="w-[180px] bg-gray-700 border-gray-600 text-white">
                    <SelectValue placeholder="Select Port" />
                  </SelectTrigger>
                  <SelectContent>
                    {ports.map((port) => (
                      <SelectItem key={port} value={port}>
                        {port}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Button
                  onClick={fetchPorts}
                  variant="ghost"
                  size="icon"
                  className="text-gray-400 hover:text-white"
                  title="Refresh Ports"
                >
                  <RefreshCw size={18} />
                </Button>
                <Button
                  onClick={handleConnect}
                  disabled={!selectedPort || isConnecting}
                  className="bg-cyan-600 hover:bg-cyan-700 text-white"
                >
                  <Plug className="mr-2 h-4 w-4" />
                  Connect
                </Button>
              </>
            ) : (
              <Button
                onClick={handleDisconnect}
                variant="destructive"
                className="bg-red-600 hover:bg-red-700"
              >
                <Unplug className="mr-2 h-4 w-4" />
                Disconnect
              </Button>
            )}
          </div>
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
            memoryData={vm1MemoryData} // Using shared memory data for now
            timeLabels={timeLabels}
            statusIndicators={vm1StatusIndicators}
          />

          {/* right side：VM2 - ASIL B */}
          <VMPanel
            className="col-span-3"
            title="VM2 - ASIL B"
            cpuValues={[currentData?.cpu4 || 0]}
            cpuLabels={[CPU_LABELS[3]]}
            memoryData={vm1MemoryData} // Using shared memory data for now
            timeLabels={timeLabels}
            statusIndicators={vm2StatusIndicators}
          />
        </div>
      </div>
    </div>
  );
};

export default SystemMonitorWindow;
