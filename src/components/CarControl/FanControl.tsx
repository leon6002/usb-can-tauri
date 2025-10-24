import { isShowFanControl } from "@/config/appConfig";
import { useCarControlStore } from "@/store/carControlStore";
import { useSerialStore } from "@/store/serialStore";

const FanControl: React.FC = ({}) => {
  if (isShowFanControl()) return;
  const isConnected = useSerialStore((state) => state.isConnected);
  const sendCarCommand = useCarControlStore((state) => state.sendCarCommand);
  const carStates = useCarControlStore((state) => state.carStates);
  return (
    <div>
      <h4 className="text-sm font-semibold text-gray-700 mb-3">风扇控制</h4>
      <div className="grid grid-cols-4 gap-2">
        {[0, 1, 2, 3].map((level) => (
          <button
            key={level}
            onClick={() => sendCarCommand(`fan_level_${level}`)}
            disabled={!isConnected}
            className={`px-3 py-2 text-sm rounded-lg font-medium transition-all duration-200 ${
              carStates.fanLevel === level
                ? "bg-white border-2 border-blue-500 text-blue-600 shadow-lg transform scale-105"
                : "bg-white border border-gray-300 text-gray-700 hover:bg-blue-50 hover:border-blue-300"
            } disabled:bg-gray-100 disabled:text-gray-400 disabled:border-gray-200`}
          >
            {level}档
          </button>
        ))}
      </div>
    </div>
  );
};

export default FanControl;
