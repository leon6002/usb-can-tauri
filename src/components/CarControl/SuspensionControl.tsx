import { isShowSuspension } from "@/config/appConfig";
import { useCarControlStore } from "@/store/carControlStore";
import { useSerialStore } from "@/store/serialStore";
import { CircleArrowDown, CircleArrowUp, MoveVertical } from "lucide-react";

const SuspensionControl: React.FC = ({ }) => {
  if (!isShowSuspension()) return null;
  const isConnected = useSerialStore((state) => state.isConnected);
  const suspensionStatus = useCarControlStore(
    (state) => state.carStates.suspensionStatus
  );
  const isDriving = useCarControlStore((state) => state.carStates.isDriving);
  const sendCarCommand = useCarControlStore((state) => state.sendCarCommand);

  return (
    <div className="flex flex-col gap-1 w-full h-full bg-black/20 p-1.5 rounded-lg backdrop-blur-sm">
      <div className="flex items-center gap-1.5 text-white/80 mb-0.5">
        <MoveVertical className="w-3 h-3" />
        <span className="text-[10px] font-medium">Suspension</span>
      </div>
      <div className="flex gap-1 w-full">
        <button
          onClick={() => sendCarCommand("suspension_up")}
          disabled={!isConnected || suspensionStatus === "Raised" || suspensionStatus === "Lowered" || isDriving}
          className={`flex-1 px-2 py-2 text-xs rounded-lg font-medium transition-all duration-200 border ${suspensionStatus === "Raised"
            ? "bg-blue-500/80 border-blue-400/50 text-white shadow-[0_0_10px_rgba(59,130,246,0.4)]"
            : "bg-white/5 border-white/10 text-white/80 hover:bg-white/10 hover:text-white"
            } disabled:opacity-50 disabled:cursor-not-allowed`}
        >
          <div className="flex flex-col items-center gap-1">
            <CircleArrowUp className={`w-4 h-4 ${suspensionStatus === "Raised" ? "animate-bounce" : ""}`} />
            {/* <span>{suspensionStatus === "Raised" ? "RAISING..." : "RAISE"}</span> */}
          </div>
        </button>

        <button
          onClick={() => sendCarCommand("suspension_down")}
          disabled={!isConnected || suspensionStatus === "Raised" || suspensionStatus === "Lowered" || isDriving}
          className={`flex-1 px-2 py-1 text-xs rounded-lg font-medium transition-all duration-200 border ${suspensionStatus === "Lowered"
            ? "bg-blue-500/80 border-blue-400/50 text-white shadow-[0_0_10px_rgba(59,130,246,0.4)]"
            : "bg-white/5 border-white/10 text-white/80 hover:bg-white/20 hover:text-white"
            } disabled:opacity-50 disabled:cursor-not-allowed`}
        >
          <div className="flex flex-col items-center gap-1">
            <CircleArrowDown className={`w-4 h-4 ${suspensionStatus === "Lowered" ? "animate-bounce" : ""}`} />
            {/* <span>{suspensionStatus === "Lowered" ? "LOWERING..." : "LOWER"}</span> */}
          </div>
        </button>
      </div>
    </div>
  );
};

export default SuspensionControl;
