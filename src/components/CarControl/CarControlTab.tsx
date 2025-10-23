import React, { memo } from "react";
import { Car3DViewer } from "./Car3DViewer";
import { CarStatusPanel } from "./CarStatusPanel";
import { CarControlPanel } from "./CarControlPanel";
import { DebugPanel } from "./DebugPanel";
import { DemoQuickConnect } from "../Layout/DemoQuickConnect";
import { useCarState } from "../../contexts/CarStateContext";
import { useCarCommand } from "../../contexts/CarCommandContext";
import { useDebug } from "../../contexts/DebugContext";
import TopStatusBar from "./TopStatusBar";

interface CarControlTabProps {
  isConnected: boolean;
  isDemoMode?: boolean;
  onDemoConnect?: (port: string) => void;
  onDemoDisconnect?: () => void;
}

const CarControlTabComponent: React.FC<CarControlTabProps> = ({
  isConnected,
  isDemoMode = false,
  onDemoConnect,
  onDemoDisconnect,
}) => {
  // 从 Context 获取状态和函数
  const { mergedCarStates, scene3DStatus, radarDistances } = useCarState();
  const { sendCarCommand } = useCarCommand();
  const { logs, isDebugVisible, toggleDebugPanel, clearLogs } = useDebug();
  const handleSteeringChange = (angle: number) => {
    // 通知3D场景更新前轮转向和车身旋转
    const renderer = (window as any).car3DRenderer;
    if (renderer) {
      renderer.updateSteeringAngle(angle);
    }
  };

  console.log("car control tab rendering", {
    isConnected,
    mergedCarStatesKeys: Object.keys(mergedCarStates),
    scene3DStatusKeys: Object.keys(scene3DStatus),
    debugLogsLength: logs.length,
    isDebugVisible,
    radarDistancesRadar1: radarDistances?.radar1?.distance,
    isDemoMode,
  });

  return (
    <div className="flex-1 flex flex-col overflow-hidden h-full">
      {/* Top Status Bar */}
      <TopStatusBar />

      {/* Main Content Area */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left Panel - 3D Model and Video */}
        <div className="flex-1 flex flex-col bg-white border-r border-gray-200">
          {/* 3D Model Display */}
          <Car3DViewer scene3DStatus={scene3DStatus} />
        </div>

        {/* Right Panel - Controls */}
        <div
          className={`${
            isDemoMode ? "w-96" : "w-80"
          } bg-white flex flex-col overflow-y-auto`}
        >
          {/* Demo Mode: Quick Connect at Top */}
          {isDemoMode && onDemoConnect && onDemoDisconnect && (
            <div className="p-3 border-b border-gray-200">
              <DemoQuickConnect
                isConnected={isConnected}
                onConnect={onDemoConnect}
                onDisconnect={onDemoDisconnect}
              />
            </div>
          )}

          {/* Status Panel */}
          <CarStatusPanel
            carStates={mergedCarStates}
            scene3DStatus={scene3DStatus}
            gear={mergedCarStates.gear}
            steeringAngleDegrees={mergedCarStates.steeringAngleDegrees}
            radarDistances={radarDistances}
            isConnected={isConnected}
          />

          {/* Control Panels */}
          <CarControlPanel
            isConnected={isConnected}
            carStates={mergedCarStates}
            onSendCommand={sendCarCommand}
            onSteeringChange={handleSteeringChange}
          />
        </div>
      </div>

      {/* Debug Panel */}
      <DebugPanel
        isVisible={isDebugVisible}
        onToggle={toggleDebugPanel}
        logs={logs}
        onClearLogs={clearLogs}
        showToggleButton={!isDemoMode}
      />
    </div>
  );
};

// 自定义比较函数来追踪哪个 prop 改变了
const arePropsEqual = (
  prevProps: CarControlTabProps,
  nextProps: CarControlTabProps
): boolean => {
  const keys = Object.keys(prevProps) as (keyof CarControlTabProps)[];

  for (const key of keys) {
    if (prevProps[key] !== nextProps[key]) {
      console.log(`❌ CarControlTab prop changed: ${String(key)}`);
      return false;
    }
  }

  return true;
};

// 使用 memo 包装，避免不必要的重新渲染
export const CarControlTab = memo(CarControlTabComponent, arePropsEqual);
