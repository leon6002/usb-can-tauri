import React from "react";
import { CarStates, Scene3DStatus } from "../../types";

interface CarStatusPanelProps {
  carStates: CarStates;
  scene3DStatus: Scene3DStatus;
  gear?: string; // 档位
  steeringAngleDegrees?: number; // 转向角（度数）
}

export const CarStatusPanel: React.FC<CarStatusPanelProps> = ({
  carStates,
  scene3DStatus,
  gear,
  steeringAngleDegrees,
}) => {
  return (
    <div className="p-3 border-b border-gray-200">
      <div className="grid grid-cols-2 gap-2">
        {/* 3D Scene Status - Compact */}
        <div className="bg-gray-50 p-2 rounded text-xs">
          <div className="text-gray-600 mb-1">3D场景</div>
          <div className="flex items-center gap-1">
            {scene3DStatus === "loading" && (
              <>
                <div className="w-1.5 h-1.5 bg-yellow-500 rounded-full animate-pulse"></div>
                <span className="text-yellow-700 text-xs">加载中</span>
              </>
            )}
            {scene3DStatus === "ready" && (
              <>
                <div className="w-1.5 h-1.5 bg-green-500 rounded-full"></div>
                <span className="text-green-700 text-xs">就绪</span>
              </>
            )}
            {scene3DStatus === "error" && (
              <>
                <div className="w-1.5 h-1.5 bg-red-500 rounded-full"></div>
                <span className="text-red-700 text-xs">错误</span>
              </>
            )}
          </div>
        </div>

        {/* Gear - Highlighted */}
        <div className="bg-orange-50 p-2 rounded border border-orange-200">
          <div className="text-orange-600 text-xs font-medium mb-1">档位</div>
          <div className="text-base font-bold text-orange-900">
            {gear || "P"}
          </div>
        </div>

        {/* Real-time Speed - Highlighted */}
        <div className="bg-blue-50 p-2 rounded border border-blue-200">
          <div className="text-blue-600 text-xs font-medium mb-1">实时速度</div>
          <div className="text-base font-bold text-blue-900">
            {((carStates.currentSpeed / 1000) * 3.6).toFixed(1)} km/h
          </div>
        </div>

        {/* Steering Angle - Highlighted */}
        <div className="bg-purple-50 p-2 rounded border border-purple-200">
          <div className="text-purple-600 text-xs font-medium mb-1">转向角</div>
          <div className="text-base font-bold text-purple-900">
            {steeringAngleDegrees !== undefined
              ? steeringAngleDegrees.toFixed(1)
              : ((carStates.currentSteeringAngle * 180) / Math.PI).toFixed(1)}
            °
          </div>
        </div>
      </div>
    </div>
  );
};
