import { useCarControlStore } from "@/store/carControlStore";
import { useSerialStore } from "@/store/serialStore";
import { Play, Square } from "lucide-react";

const DriveControl: React.FC = () => {
  const isConnected = useSerialStore((state) => state.isConnected);
  const sendCarCommand = useCarControlStore((state) => state.sendCarCommand);
  const carStates = useCarControlStore((state) => state.carStates);
  return (
    <div>
      <h4 className="text-sm font-semibold text-gray-700 mb-3">主要控制</h4>
      <button
        onClick={() =>
          sendCarCommand(carStates.isDriving ? "stop_driving" : "start_driving")
        }
        disabled={!isConnected}
        className={`w-full px-5 py-3 rounded-xl font-semibold text-lg transition-all duration-300 transform hover:scale-105 disabled:hover:scale-100 disabled:cursor-not-allowed shadow-lg ${
          carStates.isDriving
            ? "bg-gradient-to-r from-red-500 to-red-600 hover:from-red-600 hover:to-red-700 text-white shadow-red-200 disabled:from-gray-300 disabled:to-gray-400"
            : "bg-gradient-to-r from-green-500 to-green-600 hover:from-green-600 hover:to-green-700 text-white shadow-green-200 disabled:from-gray-300 disabled:to-gray-400"
        }`}
      >
        {carStates.isDriving ? (
          <>
            <Square className="w-5 h-5 inline mr-2" />
            停止行驶
          </>
        ) : (
          <>
            <Play className="w-5 h-5 inline mr-2" />
            开始行驶
          </>
        )}
      </button>
    </div>
  );
};

export default DriveControl;
