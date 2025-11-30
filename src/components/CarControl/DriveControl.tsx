import { useCarControlStore } from "@/store/carControlStore";
import { useSerialStore } from "@/store/serialStore";
import { Play, Square } from "lucide-react";

const DriveControl: React.FC = () => {
  const isConnected = useSerialStore((state) => state.isConnected);
  const sendCarCommand = useCarControlStore((state) => state.sendCarCommand);
  const carStates = useCarControlStore((state) => state.carStates);
  return (
    <div className="w-full">
      <button
        onClick={() =>
          sendCarCommand(carStates.isDriving ? "stop_driving" : "start_driving")
        }
        disabled={!isConnected}
        className={`w-full px-4 py-3 rounded-xl font-semibold text-sm transition-all duration-300 backdrop-blur-md border ${carStates.isDriving
          ? "bg-red-500/80 border-red-400/50 text-white hover:bg-red-600/90 shadow-[0_0_15px_rgba(239,68,68,0.4)]"
          : "bg-emerald-500/80 border-emerald-400/50 text-white hover:bg-emerald-600/90 shadow-[0_0_15px_rgba(16,185,129,0.4)]"
          } disabled:opacity-50 disabled:cursor-not-allowed`}
      >
        {carStates.isDriving ? (
          <div className="flex items-center justify-center gap-2">
            <Square className="w-4 h-4 fill-current" />
            <span>STOP AUTO DRIVE</span>
          </div>
        ) : (
          <div className="flex items-center justify-center gap-2">
            <Play className="w-4 h-4 fill-current" />
            <span>START AUTO DRIVE</span>
          </div>
        )}
      </button>
    </div>
  );
};

export default DriveControl;
