import React from "react";
import { Play, Square, CircleArrowUp, CircleArrowDown } from "lucide-react";
import { CarStates } from "../../types";
import { isShowFanControl } from "../../config/appConfig";
import { useCarCommand } from "@/contexts/CarCommandContext";
import LightControl from "./LightControl";

interface CarControlPanelProps {
  isConnected: boolean;
  carStates: CarStates;
  onSteeringChange?: (angle: number) => void;
}

export const CarControlPanel: React.FC<CarControlPanelProps> = ({
  isConnected,
  carStates,
}) => {
  const { sendCarCommand } = useCarCommand();
  // 根据 carStates.suspensionStatus 判断当前状态
  const suspensionControlling =
    carStates.suspensionStatus === "升高"
      ? "up"
      : carStates.suspensionStatus === "降低"
      ? "down"
      : null;
  console.log("suspension status is:", suspensionControlling);
  return (
    <div className="flex-1 overflow-y-auto p-4 space-y-6">
      {/* Main Controls */}
      <div>
        <h4 className="text-sm font-semibold text-gray-700 mb-3">主要控制</h4>
        <button
          onClick={() =>
            sendCarCommand(
              carStates.isDriving ? "stop_driving" : "start_driving"
            )
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

        {/* todo 方向盘UI - 暂时隐藏 */}
        {/* <div className="mt-4 flex justify-center">
          <SteeringWheelUI
            onSteeringChange={onSteeringChange}
            externalSteeringAngle={carStates.currentSteeringAngle}
          />
        </div> */}
      </div>

      {/* Suspension Controls */}
      <div>
        <h4 className="text-sm font-semibold text-gray-700 mb-3">悬架控制</h4>
        <div className="grid grid-cols-2 gap-2">
          <button
            onClick={() => {
              sendCarCommand("suspension_up");
            }}
            disabled={!isConnected || suspensionControlling !== null}
            className={`px-3 py-2 text-sm rounded-lg font-medium ${
              suspensionControlling === "up"
                ? "bg-green-500 text-white border border-green-600"
                : "bg-white border border-gray-300 text-gray-700 hover:bg-green-50 hover:border-green-300"
            } disabled:bg-gray-100 disabled:text-gray-400 disabled:border-gray-200`}
          >
            <span
              className={`${
                suspensionControlling === "up" ? "animate-pulse" : ""
              }`}
            >
              <CircleArrowUp className="w-4 h-4 inline mr-1" />
              {suspensionControlling === "up" ? "升高中" : "升高"}
            </span>
          </button>
          <button
            onClick={() => {
              sendCarCommand("suspension_down");
            }}
            disabled={!isConnected || suspensionControlling !== null}
            className={`px-3 py-2 text-sm rounded-lg font-medium ${
              suspensionControlling === "down"
                ? "bg-orange-500 text-white border border-orange-600"
                : "bg-white border border-gray-300 text-gray-700 hover:bg-orange-50 hover:border-orange-300"
            } disabled:bg-gray-100 disabled:text-gray-400 disabled:border-gray-200`}
          >
            <span
              className={`${
                suspensionControlling === "down" ? "animate-pulse" : ""
              }`}
            >
              <CircleArrowDown className="w-4 h-4 inline mr-1" />
              {suspensionControlling === "down" ? "降低中" : "降低"}
            </span>
          </button>
        </div>
      </div>

      {/* Fan Controls */}
      {isShowFanControl() && (
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
      )}

      {/* Light Controls */}
      <LightControl
        isConnected={isConnected}
        carStates={carStates}
        sendCarCommand={sendCarCommand}
      />
    </div>
  );
};
