import { useCarControlStore } from "@/store/carControlStore";
import { useSerialStore } from "@/store/serialStore";

const LightControl: React.FC = () => {
  const isConnected = useSerialStore((state) => state.isConnected);
  const sendCarCommand = useCarControlStore((state) => state.sendCarCommand);
  const carStates = useCarControlStore((state) => state.carStates);
  const isDriving = carStates.isDriving;
  return (
    <div className="grid grid-cols-4 gap-2 w-full">
      {[1, 2, 3, 4].map((mode) => (
        <button
          key={mode}
          onClick={() => sendCarCommand(`light_mode_${mode}`)}
          disabled={!isConnected || isDriving}
          className={`px-2 py-2 text-[10px] rounded-lg font-bold transition-all duration-200 backdrop-blur-sm border ${carStates.lightMode === mode
            ? "bg-amber-500/80 border-amber-400/50 text-white shadow-[0_0_10px_rgba(245,158,11,0.4)]"
            : "bg-white/10 border-white/20 text-white/60 hover:bg-white/20 hover:text-white"
            } disabled:opacity-50 disabled:cursor-not-allowed`}
        >
          M{mode}
        </button>
      ))}
    </div>
  );
};

export default LightControl;
