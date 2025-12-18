import { isShowFanControl } from "@/config/appConfig";
import { useCarControlStore } from "@/store/carControlStore";
import { useSerialStore } from "@/store/serialStore";
import { Fan } from "lucide-react";

const FanSpeedIcon: React.FC<{ level: number }> = ({ level }) => {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-4 h-4 rotate-90">
      {/* Center Dot - Always active or active on level >= 1? Let's treat it as the base (Level 1) or always visible if connected. 
          Actually, for level 0 it should be dim. Level 1 lit. 
      */}
      <circle cx="12" cy="19" r="2" className={`transition-all duration-200 ${level >= 1 ? "fill-white" : "fill-white/20"}`} />
      
      {/* Middle Arc - Level 2 */}
      <path 
        d="M6.34315 13.3431C7.84285 11.8434 9.92015 11 12 11C14.0799 11 16.1571 11.8434 17.6569 13.3431" 
        strokeWidth="2" 
        strokeLinecap="round"
        className={`transition-all duration-200 ${level >= 2 ? "stroke-white" : "stroke-white/20"}`} 
      />

      {/* Outer Arc - Level 3 */}
      <path 
        d="M2.05025 9.05025C4.70014 6.40036 8.24352 5 12 5C15.7565 5 19.2999 6.40036 21.9497 9.05025" 
        strokeWidth="2" 
        strokeLinecap="round"
        className={`transition-all duration-200 ${level >= 3 ? "stroke-white" : "stroke-white/20"}`} 
      />
    </svg>
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
