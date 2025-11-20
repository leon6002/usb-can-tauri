import { useCarControlStore } from "@/store/carControlStore";
import { useSerialStore } from "@/store/serialStore";
import { CircleArrowDown, CircleArrowUp } from "lucide-react";

const SuspensionControl: React.FC = ({}) => {
  const isConnected = useSerialStore((state) => state.isConnected);
  const suspensionStatus = useCarControlStore(
    (state) => state.carStates.suspensionStatus
  );
  const sendCarCommand = useCarControlStore((state) => state.sendCarCommand);
  console.log("suspension component rendered");
  return (
    <div>
      <h4 className="text-sm font-semibold text-gray-700 mb-3">Suspension</h4>
      <div className="grid grid-cols-2 gap-2">
        <button
          onClick={() => {
            sendCarCommand("suspension_up");
          }}
          disabled={
            !isConnected ||
            suspensionStatus === "Raising" ||
            suspensionStatus === "Lowering"
          }
          className={`px-3 py-2 text-sm rounded-lg font-medium ${
            suspensionStatus === "Raising"
              ? "bg-green-500 text-white border border-green-600"
              : "bg-white border border-gray-300 text-gray-700 hover:bg-green-50 hover:border-green-300"
          } disabled:bg-gray-100 disabled:text-gray-400 disabled:border-gray-200`}
        >
          <span
            className={`${suspensionStatus === "Raising" ? "animate-pulse" : ""}`}
          >
            <CircleArrowUp className="w-4 h-4 inline mr-1" />
            {suspensionStatus === "Raising" ? "Raising..." : "Raise"}
          </span>
        </button>
        <button
          onClick={() => {
            sendCarCommand("suspension_down");
          }}
          disabled={
            !isConnected ||
            suspensionStatus === "Raising" ||
            suspensionStatus === "Lowering"
          }
          className={`px-3 py-2 text-sm rounded-lg font-medium ${
            suspensionStatus === "Lowering"
              ? "bg-orange-500 text-white border border-orange-600"
              : "bg-white border border-gray-300 text-gray-700 hover:bg-orange-50 hover:border-orange-300"
          } disabled:bg-gray-100 disabled:text-gray-400 disabled:border-gray-200`}
        >
          <span
            className={`${suspensionStatus === "Lowering" ? "animate-pulse" : ""}`}
          >
            <CircleArrowDown className="w-4 h-4 inline mr-1" />
            {suspensionStatus === "Lowering" ? "Lowering..." : "Lower"}
          </span>
        </button>
      </div>
    </div>
  );
};

export default SuspensionControl;
