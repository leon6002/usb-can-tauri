import { invoke } from "@tauri-apps/api/core";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { Activity, Maximize, Minimize } from "lucide-react";
import { Button } from "../ui/button";
import { useState, useEffect } from "react";


const TopStatusBar: React.FC = () => {
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

  const handleOpenSystemMonitor = async () => {
    try {
      await invoke("open_system_monitor_window");
    } catch (error) {
      console.error("Failed to open system monitor window:", error);
    }
  };

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

  return (
    <div className="relative px-6 py-5 bg-transparent pointer-events-none">
      <div className="flex items-center justify-between">
        {/* 中心 Logo */}
        {/* System Monitor - Left */}
        <Button
          onClick={handleOpenSystemMonitor}
          variant={"link"}
          className="absolute left-4 top-1/2 -translate-y-1/2 pointer-events-auto text-white/80 hover:text-cyan-400 transition-colors flex items-center gap-2"
          title="Open system monitor window"
        >
          <Activity size={18} />
          <span className="text-sm font-medium">System monitor</span>
        </Button>

        {/* Center Logo */}
        <div className="flex items-center justify-center flex-1">
          {/* Logo - Center */}
          <img src="/header-renesas.svg" alt="Renesas Logo" />
        </div>

        {/* Fullscreen - Right */}
        <div className="absolute right-10 top-1/2 -translate-y-1/2 flex gap-2">
          <Button
            onClick={toggleFullscreen}
            variant={"link"}
            className="pointer-events-auto text-white/80 hover:text-cyan-400 transition-colors flex items-center gap-2"
            title={isFullscreen ? "Exit Fullscreen" : "Enter Fullscreen"}
          >
            {isFullscreen ? <Minimize size={18} /> : <Maximize size={18} />}
            <span className="text-sm font-medium">{isFullscreen ? "Exit Fullscreen" : "Fullscreen"}</span>
          </Button>
        </div>

      </div>
    </div>
  );
};

export default TopStatusBar;
