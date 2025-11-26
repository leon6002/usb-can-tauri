import { isShowFanControl } from "@/config/appConfig";
import { useCarControlStore } from "@/store/carControlStore";
import { useSerialStore } from "@/store/serialStore";

const FanControl: React.FC = ({ }) => {
  if (isShowFanControl()) return null;
  const isConnected = useSerialStore((state) => state.isConnected);
  const sendCarCommand = useCarControlStore((state) => state.sendCarCommand);
  const carStates = useCarControlStore((state) => state.carStates);
  return (
    <div className="grid grid-cols-4 gap-2 w-full">
      {[0, 1, 2, 3].map((level) => (
        <button
          key={level}
          onClick={() => sendCarCommand(`fan_level_${level}`)}
          disabled={!isConnected}
          className={`px-2 py-2 text-[10px] rounded-lg font-bold transition-all duration-200 backdrop-blur-sm border ${carStates.fanLevel === level
              ? "bg-blue-500/80 border-blue-400/50 text-white shadow-[0_0_10px_rgba(59,130,246,0.4)]"
              : "bg-white/10 border-white/20 text-white/60 hover:bg-white/20 hover:text-white"
            } disabled:opacity-50 disabled:cursor-not-allowed`}
        >
          L{level}
        </button>
      ))}
    </div>
  );
};

export default FanControl;
