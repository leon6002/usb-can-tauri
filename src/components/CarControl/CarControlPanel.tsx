import React from "react";
import { Play } from "lucide-react";
import { CarStates } from "../../types";

interface CarControlPanelProps {
  isConnected: boolean;
  carStates: CarStates;
  onSendCommand: (commandId: string) => void;
}

export const CarControlPanel: React.FC<CarControlPanelProps> = ({
  isConnected,
  carStates,
  onSendCommand,
}) => {
  return (
    <div className="flex-1 overflow-y-auto p-4 space-y-6">
      {/* Main Controls */}
      <div>
        <h4 className="text-sm font-semibold text-gray-700 mb-3">主要控制</h4>
        <div className="space-y-2">
          <button
            onClick={() => onSendCommand("start_driving")}
            disabled={!isConnected}
            className="w-full px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 text-white rounded-md font-medium transition-colors cursor-pointer"
          >
            <Play className="w-4 h-4 inline mr-2" />
            开始行驶
          </button>
          <button
            onClick={() => onSendCommand("update_data")}
            disabled={!isConnected}
            className="w-full px-4 py-2 bg-gray-600 hover:bg-gray-700 disabled:bg-gray-400 text-white rounded-md font-medium transition-colors cursor-pointer"
          >
            数据更新
          </button>
        </div>
      </div>

      {/* Door Controls */}
      <div>
        <h4 className="text-sm font-semibold text-gray-700 mb-3">车门控制</h4>
        <div className="space-y-2">
          <button
            onClick={() => onSendCommand("left_door_open")}
            disabled={!isConnected}
            className="w-full px-4 py-2 bg-green-600 hover:bg-green-700 disabled:bg-gray-400 text-white rounded-md transition-colors cursor-pointer"
          >
            开门
          </button>
          <button
            onClick={() => onSendCommand("left_door_close")}
            disabled={!isConnected}
            className="w-full px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 text-white rounded-md transition-colors cursor-pointer"
          >
            关门
          </button>
          <button
            onClick={() => onSendCommand("left_door_stop")}
            disabled={!isConnected}
            className="w-full px-4 py-2 bg-red-600 hover:bg-red-700 disabled:bg-gray-400 text-white rounded-md transition-colors cursor-pointer"
          >
            停止
          </button>
        </div>
      </div>

      {/* Fan Controls */}
      <div>
        <h4 className="text-sm font-semibold text-gray-700 mb-3">风扇控制</h4>
        <div className="space-y-2">
          {[0, 1, 2].map((level) => (
            <button
              key={level}
              onClick={() => onSendCommand(`fan_level_${level}`)}
              disabled={!isConnected}
              className={`w-full px-4 py-2 rounded-md transition-colors cursor-pointer ${
                carStates.fanLevel === level
                  ? "bg-blue-600 text-white"
                  : "bg-gray-200 hover:bg-gray-300 text-gray-700"
              } disabled:bg-gray-400 disabled:text-gray-600`}
            >
              档位 {level}
            </button>
          ))}
        </div>
      </div>

      {/* Light Controls */}
      <div>
        <h4 className="text-sm font-semibold text-gray-700 mb-3">灯带控制</h4>
        <div className="space-y-2">
          {[1, 2, 3, 4].map((mode) => (
            <button
              key={mode}
              onClick={() => onSendCommand(`light_mode_${mode}`)}
              disabled={!isConnected}
              className={`w-full px-4 py-2 rounded-md transition-colors cursor-pointer ${
                carStates.lightMode === mode
                  ? "bg-yellow-500 text-white"
                  : "bg-gray-200 hover:bg-gray-300 text-gray-700"
              } disabled:bg-gray-400 disabled:text-gray-600`}
            >
              模式 {mode}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
};
