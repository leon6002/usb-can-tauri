import { useCarControlStore } from "@/store/carControlStore";
import { useSerialStore } from "@/store/serialStore";
import { Zap } from "lucide-react";

const LightControl: React.FC = () => {
  const isConnected = useSerialStore((state) => state.isConnected);
  const sendCarCommand = useCarControlStore((state) => state.sendCarCommand);
  const carStates = useCarControlStore((state) => state.carStates);
  const isDriving = carStates.isDriving;
  
  return (
    <div className="flex flex-col gap-1 w-full bg-black/20 p-1.5 rounded-lg backdrop-blur-sm">
      <div className="flex items-center gap-1.5 text-white/80 mb-0.5">
        <Zap className="w-3 h-3" />
        <span className="text-[10px] font-medium">Light Mode</span>
      </div>
      <div className="grid grid-cols-4 gap-1 w-full">
        {[4, 1, 2, 3].map((mode) => (
          <button
            key={mode}
            onClick={() => sendCarCommand(`light_mode_${mode}`)}
            disabled={!isConnected || isDriving}
            className={`px-1 py-1 text-[10px] rounded-md font-bold transition-all duration-200 border ${carStates.lightMode === mode
              ? "bg-amber-500/80 border-amber-400/50 text-white shadow-[0_0_10px_rgba(245,158,11,0.4)]"
              : "bg-white/5 border-white/10 text-white/60 hover:bg-white/10 hover:text-white"
              } disabled:opacity-50 disabled:cursor-not-allowed`}
          >
            {mode === 4 ? "OFF" : `${mode}`}
          </button>
        ))}
      </div>
    </div>
  );
};

export default LightControl;
