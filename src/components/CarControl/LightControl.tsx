import { CarStates } from "@/types";

interface LightControlProps {
  isConnected: boolean;
  carStates: CarStates;
  sendCarCommand: (commandId: string) => Promise<void>;
}

const LightControl: React.FC<LightControlProps> = ({
  isConnected,
  carStates,
  sendCarCommand,
}) => {
  return (
    <div>
      <h4 className="text-sm font-semibold text-gray-700 mb-3">灯带控制</h4>
      <div className="grid grid-cols-2 gap-2">
        {[1, 2, 3, 4].map((mode) => (
          <button
            key={mode}
            onClick={() => sendCarCommand(`light_mode_${mode}`)}
            disabled={!isConnected}
            className={`px-3 py-2 text-sm rounded-lg font-medium transition-all duration-200 ${
              carStates.lightMode === mode
                ? "bg-white border-2 border-amber-500 text-amber-600 shadow-lg transform scale-105"
                : "bg-white border border-gray-300 text-gray-700 hover:bg-amber-50 hover:border-amber-300"
            } disabled:bg-gray-100 disabled:text-gray-400 disabled:border-gray-200`}
          >
            模式{mode}
          </button>
        ))}
      </div>
    </div>
  );
};

export default LightControl;
