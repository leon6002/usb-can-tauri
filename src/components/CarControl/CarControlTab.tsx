import React, { memo } from "react";
import { Car3DViewer } from "./Car3DViewer";
import { CarStatusPanel } from "./CarStatusPanel";
import { CarControlPanel } from "./CarControlPanel";
import { DebugPanel } from "./DebugPanel";
import { DemoQuickConnect } from "../Layout/DemoQuickConnect";
import TopStatusBar from "./TopStatusBar";
import { isDemoMode } from "@/config/appConfig";

const CarControlTabComponent: React.FC = () => {
  // 从 Context 获取状态和函数
  const demoMode = isDemoMode();

  console.log("car control tab rendering");

  return (
    <div className="flex-1 flex flex-col overflow-hidden h-full">
      {/* Top Status Bar */}
      <TopStatusBar />

      {/* Main Content Area */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left Panel - 3D Model and Video */}
        <div className="flex-1 flex flex-col bg-white border-r border-gray-200">
          {/* 3D Model Display */}
          <Car3DViewer />
        </div>

        {/* Right Panel - Controls */}
        <div
          className={`${
            demoMode ? "w-96" : "w-80"
          } bg-white flex flex-col overflow-y-auto`}
        >
          {/* Demo Mode: Quick Connect at Top */}
          {demoMode && (
            <div className="p-3 border-b border-gray-200">
              <DemoQuickConnect />
            </div>
          )}

          {/* Status Panel */}
          <CarStatusPanel />

          {/* Control Panels */}
          <CarControlPanel />
        </div>
      </div>

      {/* Debug Panel */}
      <DebugPanel showToggleButton={!isDemoMode} />
    </div>
  );
};

// 使用 memo 包装，避免不必要的重新渲染
export const CarControlTab = memo(CarControlTabComponent);
