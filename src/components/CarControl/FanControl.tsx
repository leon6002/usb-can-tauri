import { isShowFanControl } from "@/config/appConfig";
import { useCarControlStore } from "@/store/carControlStore";
import { useSerialStore } from "@/store/serialStore";
import { Fan } from "lucide-react";

const FanSpeedIcon: React.FC<{ level: number }> = ({ level }) => {
  return (
    <div className="flex items-center gap-0.5">
      {/* Reusing standard Fan icon as requested */}
      <Fan 
        className={`w-3.5 h-3.5 transition-all duration-200 ${level >= 1 ? "text-white opacity-100" : "text-white opacity-40"}`} 
      />
      
      {/* 3 Wavy Lines (Wind) - Stacked Vertically */}
      <svg width="10" height="14" viewBox="0 0 10 14" fill="none" xmlns="http://www.w3.org/2000/svg">
        {/* Top Wave (Level 3) */}
        <path 
          d="M1 3 C3 1 7 1 9 3" 
          stroke="currentColor" 
          strokeWidth="1.5" 
          strokeLinecap="round" 
          className={`transition-all duration-200 ${level >= 3 ? "text-white opacity-100" : "text-white opacity-40"}`}
        />
        {/* Middle Wave (Level 2) */}
        <path 
          d="M1 7 C3 5 7 5 9 7" 
          stroke="currentColor" 
          strokeWidth="1.5" 
          strokeLinecap="round" 
          className={`transition-all duration-200 ${level >= 2 ? "text-white opacity-100" : "text-white opacity-40"}`}
        />
        {/* Bottom Wave (Level 1) */}
        <path 
          d="M1 11 C3 9 7 9 9 11" 
          stroke="currentColor" 
          strokeWidth="1.5" 
          strokeLinecap="round" 
          className={`transition-all duration-200 ${level >= 1 ? "text-white opacity-100" : "text-white opacity-40"}`}
        />
      </svg>
    </div>
  );
};

const FanControl: React.FC = ({ }) => {
  if (!isShowFanControl()) return null;
  const isConnected = useSerialStore((state) => state.isConnected);
  const sendCarCommand = useCarControlStore((state) => state.sendCarCommand);
  const carStates = useCarControlStore((state) => state.carStates);
  
  const handleToggle = () => {
    // Cycle 0 -> 1 -> 2 -> 3 -> 0
    const nextLevel = (carStates.fanLevel + 1) % 4;
    sendCarCommand(`fan_level_${nextLevel}`);
  };

  return (
    <div className="flex flex-col gap-1 w-full h-full bg-black/20 p-1.5 rounded-lg backdrop-blur-sm">
      <div className="flex items-center gap-1.5 text-white/80 mb-0.5">
        <Fan className="w-3 h-3" />
        <span className="text-[10px] font-medium">Fan</span>
      </div>
      <div className="w-full flex-1">
        <button
          onClick={handleToggle}
          disabled={!isConnected}
          className={`w-full h-full px-2 py-2 flex flex-col items-center justify-center gap-1 rounded-md font-bold transition-all duration-200 border ${carStates.fanLevel > 0
              ? "bg-blue-500/80 border-blue-400/50 text-white shadow-[0_0_10px_rgba(59,130,246,0.4)]"
              : "bg-white/5 border-white/10 text-white/60 hover:bg-white/10 hover:text-white"
            } disabled:opacity-50 disabled:cursor-not-allowed`}
        >
           <FanSpeedIcon level={carStates.fanLevel} />
           {/* <span className="text-xs">{carStates.fanLevel === 0 ? "OFF" : `Level ${carStates.fanLevel}`}</span> */}
        </button>
      </div>
    </div>
  );
};

export default FanControl;
