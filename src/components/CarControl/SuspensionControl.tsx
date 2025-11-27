import { useCarControlStore } from "@/store/carControlStore";
import { useSerialStore } from "@/store/serialStore";
import { CircleArrowDown, CircleArrowUp } from "lucide-react";

const SuspensionControl: React.FC = ({ }) => {
  const isConnected = useSerialStore((state) => state.isConnected);
  const suspensionStatus = useCarControlStore(
    (state) => state.carStates.suspensionStatus
  );
  const isDriving = useCarControlStore((state) => state.carStates.isDriving);
  const sendCarCommand = useCarControlStore((state) => state.sendCarCommand);

  return (
    <div className="flex gap-2 w-full">
      <button
        onClick={() => sendCarCommand("suspension_up")}
        disabled={!isConnected || suspensionStatus === "升高" || suspensionStatus === "降低" || isDriving}
        className={`flex-1 px-3 py-2 text-xs rounded-lg font-medium transition-all duration-200 backdrop-blur-sm border ${suspensionStatus === "升高"
          ? "bg-blue-500/80 border-blue-400/50 text-white shadow-[0_0_10px_rgba(59,130,246,0.4)]"
          : "bg-white/10 border-white/20 text-white/80 hover:bg-white/20 hover:text-white"
          } disabled:opacity-50 disabled:cursor-not-allowed`}
      >
        <div className="flex flex-col items-center gap-1">
          <CircleArrowUp className={`w-4 h-4 ${suspensionStatus === "升高" ? "animate-bounce" : ""}`} />
          <span>{suspensionStatus === "升高" ? "RAISING..." : "RAISE"}</span>
        </div>
      </button>

      <button
        onClick={() => sendCarCommand("suspension_down")}
        disabled={!isConnected || suspensionStatus === "升高" || suspensionStatus === "降低" || isDriving}
        className={`flex-1 px-3 py-2 text-xs rounded-lg font-medium transition-all duration-200 backdrop-blur-sm border ${suspensionStatus === "降低"
          ? "bg-blue-500/80 border-blue-400/50 text-white shadow-[0_0_10px_rgba(59,130,246,0.4)]"
          : "bg-white/10 border-white/20 text-white/80 hover:bg-white/20 hover:text-white"
          } disabled:opacity-50 disabled:cursor-not-allowed`}
      >
        <div className="flex flex-col items-center gap-1">
          <CircleArrowDown className={`w-4 h-4 ${suspensionStatus === "降低" ? "animate-bounce" : ""}`} />
          <span>{suspensionStatus === "降低" ? "LOWERING..." : "LOWER"}</span>
        </div>
      </button>
    </div>
  );
};

export default SuspensionControl;
