import React from "react";
import { CarStates, Scene3DStatus } from "../../types";

interface CarStatusPanelProps {
  carStates: CarStates;
  scene3DStatus: Scene3DStatus;
}

export const CarStatusPanel: React.FC<CarStatusPanelProps> = ({
  carStates,
  scene3DStatus,
}) => {
  return (
    <div className="p-4 border-b border-gray-200">
      <h3 className="text-lg font-semibold text-gray-800 mb-3">系统状态</h3>
      <div className="grid grid-cols-2 gap-3">
        <div className="bg-gray-50 p-3 rounded">
          <div className="text-xs text-gray-600">3D场景</div>
          <div className="text-sm font-semibold flex items-center gap-2">
            {scene3DStatus === "loading" && (
              <>
                <div className="w-2 h-2 bg-yellow-500 rounded-full animate-pulse"></div>
                <span className="text-yellow-700">加载中</span>
              </>
            )}
            {scene3DStatus === "ready" && (
              <>
                <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                <span className="text-green-700">就绪</span>
              </>
            )}
            {scene3DStatus === "error" && (
              <>
                <div className="w-2 h-2 bg-red-500 rounded-full"></div>
                <span className="text-red-700">错误</span>
              </>
            )}
          </div>
        </div>
        <div className="bg-gray-50 p-3 rounded">
          <div className="text-xs text-gray-600">行驶状态</div>
          <div className="text-sm font-semibold text-gray-900">
            {carStates.isDriving ? "行驶中" : "停止"}
          </div>
        </div>
        <div className="bg-gray-50 p-3 rounded">
          <div className="text-xs text-gray-600">左门状态</div>
          <div className="text-sm font-semibold text-gray-900">
            {carStates.leftDoorStatus}
          </div>
        </div>
        <div className="bg-gray-50 p-3 rounded">
          <div className="text-xs text-gray-600">风扇档位</div>
          <div className="text-sm font-semibold text-gray-900">
            档位 {carStates.fanLevel}
          </div>
        </div>
        <div className="bg-gray-50 p-3 rounded">
          <div className="text-xs text-gray-600">灯带模式</div>
          <div className="text-sm font-semibold text-gray-900">
            模式 {carStates.lightMode}
          </div>
        </div>
        <div className="bg-gray-50 p-3 rounded">
          <div className="text-xs text-gray-600">悬架状态</div>
          <div className="text-sm font-semibold text-gray-900">
            {carStates.suspensionStatus}
          </div>
        </div>
        <div className="bg-blue-50 p-3 rounded border border-blue-200">
          <div className="text-xs text-blue-600 font-medium">实时速度</div>
          <div className="text-sm font-semibold text-blue-900">
            {carStates.currentSpeed} mm/s
          </div>
        </div>
        <div className="bg-purple-50 p-3 rounded border border-purple-200">
          <div className="text-xs text-purple-600 font-medium">
            方向盘转向角
          </div>
          <div className="text-sm font-semibold text-purple-900">
            {((carStates.currentSteeringAngle * 180) / Math.PI).toFixed(2)}°
          </div>
        </div>
      </div>
    </div>
  );
};
