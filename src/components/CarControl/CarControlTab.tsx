import React from "react";
import { Car3DViewer } from "./Car3DViewer";
import { CarStatusPanel } from "./CarStatusPanel";
import { CarControlPanel } from "./CarControlPanel";
import { CarStates, Scene3DStatus } from "../../types";

interface CarControlTabProps {
  isConnected: boolean;
  carStates: CarStates;
  scene3DStatus: Scene3DStatus;
  onSendCommand: (commandId: string) => void;
}

export const CarControlTab: React.FC<CarControlTabProps> = ({
  isConnected,
  carStates,
  scene3DStatus,
  onSendCommand,
}) => {
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

          {/* Video Display - Bottom */}
          <div className="h-48 bg-gray-50 border-t border-gray-200 p-4">
            <h3 className="text-sm font-semibold text-gray-700 mb-2">演示视频</h3>
            <div className="h-32 bg-gray-100 rounded flex items-center justify-center">
              <video
                controls
                muted
                loop
                className="w-full h-full rounded"
                poster="/car-assets/images/car-preview.jpg"
              >
                <source src="/car-assets/videos/car_demo.mp4" type="video/mp4" />
                您的浏览器不支持视频播放
              </video>
            </div>
          </div>
        </div>

        {/* Right Panel - Controls */}
        <div className="w-80 bg-white flex flex-col">
          {/* Status Panel */}
          <CarStatusPanel carStates={carStates} scene3DStatus={scene3DStatus} />

          {/* Control Panels */}
          <CarControlPanel
            isConnected={isConnected}
            carStates={carStates}
            onSendCommand={onSendCommand}
          />
        </div>
      </div>
    </div>
  );
};
