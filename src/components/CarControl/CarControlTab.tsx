import React from "react";
import { Car3DViewer } from "./Car3DViewer";
import { CarStatusPanel } from "./CarStatusPanel";
import { CarControlPanel } from "./CarControlPanel";
import { RadarDistancePanel } from "./RadarDistancePanel";
import { DebugPanel } from "./DebugPanel";
import { CarStates, Scene3DStatus, RadarDistances } from "../../types";
import { DebugLog } from "../../hooks/useDebugLogs";

interface CarControlTabProps {
  isConnected: boolean;
  carStates: CarStates;
  scene3DStatus: Scene3DStatus;
  onSendCommand: (commandId: string) => void;
  debugLogs: DebugLog[];
  isDebugVisible: boolean;
  onToggleDebug: () => void;
  onClearDebugLogs: () => void;
  radarDistances: RadarDistances;
}

export const CarControlTab: React.FC<CarControlTabProps> = ({
  isConnected,
  carStates,
  scene3DStatus,
  onSendCommand,
  debugLogs,
  isDebugVisible,
  onToggleDebug,
  onClearDebugLogs,
  radarDistances,
}) => {
  const handleSteeringChange = (angle: number) => {
    // 通知3D场景更新前轮转向和车身旋转
    const renderer = (window as any).car3DRenderer;
    if (renderer) {
      renderer.updateSteeringAngle(angle);
    }
  };

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      {/* Top Status Bar */}
      <div className="bg-white border-b border-gray-200 px-6 py-3">
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-semibold text-gray-900">车辆控制</h2>
          {!isConnected && (
            <div className="text-sm text-amber-600 bg-amber-50 px-3 py-1 rounded-full">
              请先在CAN配置页面连接设备
            </div>
          )}
        </div>
      </div>

      {/* Main Content Area */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left Panel - 3D Model and Video */}
        <div className="flex-1 flex flex-col bg-white border-r border-gray-200">
          {/* 3D Model Display */}
          <Car3DViewer scene3DStatus={scene3DStatus} />
        </div>

        {/* Right Panel - Controls */}
        <div className="w-80 bg-white flex flex-col overflow-y-auto">
          {/* Status Panel */}
          <CarStatusPanel carStates={carStates} scene3DStatus={scene3DStatus} />

          {/* Radar Distance Panel */}
          <RadarDistancePanel radarDistances={radarDistances} />

          {/* Control Panels */}
          <CarControlPanel
            isConnected={isConnected}
            carStates={carStates}
            onSendCommand={onSendCommand}
            onSteeringChange={handleSteeringChange}
          />
        </div>
      </div>

      {/* Debug Panel */}
      <DebugPanel
        isVisible={isDebugVisible}
        onToggle={onToggleDebug}
        logs={debugLogs}
        onClearLogs={onClearDebugLogs}
      />
    </div>
  );
};
