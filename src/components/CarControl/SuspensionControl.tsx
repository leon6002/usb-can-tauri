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
      <h4 className="text-sm font-semibold text-gray-700 mb-3">悬架控制</h4>
      <div className="grid grid-cols-2 gap-2">
        <button
          onClick={() => {
            sendCarCommand("suspension_up");
          }}
          disabled={
            !isConnected ||
            suspensionStatus === "升高" ||
            suspensionStatus === "降低"
          }
          className={`px-3 py-2 text-sm rounded-lg font-medium ${
            suspensionStatus === "升高"
              ? "bg-green-500 text-white border border-green-600"
              : "bg-white border border-gray-300 text-gray-700 hover:bg-green-50 hover:border-green-300"
          } disabled:bg-gray-100 disabled:text-gray-400 disabled:border-gray-200`}
        >
          <span
            className={`${suspensionStatus === "升高" ? "animate-pulse" : ""}`}
          >
            <CircleArrowUp className="w-4 h-4 inline mr-1" />
            {suspensionStatus === "升高" ? "升高中" : "升高"}
          </span>
        </button>
        <button
          onClick={() => {
            sendCarCommand("suspension_down");
          }}
          disabled={
            !isConnected ||
            suspensionStatus === "升高" ||
            suspensionStatus === "降低"
          }
          className={`px-3 py-2 text-sm rounded-lg font-medium ${
            suspensionStatus === "降低"
              ? "bg-orange-500 text-white border border-orange-600"
              : "bg-white border border-gray-300 text-gray-700 hover:bg-orange-50 hover:border-orange-300"
          } disabled:bg-gray-100 disabled:text-gray-400 disabled:border-gray-200`}
        >
          <span
            className={`${suspensionStatus === "降低" ? "animate-pulse" : ""}`}
          >
            <CircleArrowDown className="w-4 h-4 inline mr-1" />
            {suspensionStatus === "降低" ? "降低中" : "降低"}
          </span>
        </button>
      </div>
    </div>
  );
};

export default SuspensionControl;
