import React, { memo } from "react";
import { Car3DViewer } from "./Car3DViewer";
import { CarStatusPanel } from "./CarStatusPanel";
import { CarControlPanel } from "./CarControlPanel";
import { DebugPanel } from "./DebugPanel";
import { DemoQuickConnect } from "../Layout/DemoQuickConnect";
import { useCarState } from "../../contexts/CarStateContext";
import { useCarCommand } from "../../contexts/CarCommandContext";
import { useDebug } from "../../contexts/DebugContext";

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
      <div className="bg-white border-b border-t border-gray-200 px-6 py-5">
        <div className="flex items-center justify-center">
          <svg
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 366.09 118.04"
            className="h-12 w-auto"
          >
            <defs>
              <style>
                {`
                  .osyx-text { fill: url(#blueGradient); }
                  .osyx-icon { fill: #6be3bf; }
                `}
              </style>
              <linearGradient
                id="blueGradient"
                x1="0%"
                y1="0%"
                x2="100%"
                y2="100%"
              >
                <stop offset="0%" stopColor="#3b82f6" />
                <stop offset="50%" stopColor="#06b6d4" />
                <stop offset="100%" stopColor="#0ea5e9" />
              </linearGradient>
            </defs>
            <g>
              <path
                className="osyx-icon"
                d="m344.55,0h-71c-11.92,0-21.54,9.62-21.54,21.54v71c0,11.92,9.62,21.54,21.54,21.54h71c11.92,0,21.54-9.62,21.54-21.54V21.54c0-11.92-9.62-21.54-21.54-21.54Zm9.54,90.07c0,6.63-5.37,12-12,12h-65.97c-6.68,0-12.1-5.42-12.1-12.1V24.1c0-6.68,5.42-12.1,12.1-12.1h65.97c6.63,0,12,5.37,12,12v66.07Z"
              ></path>
              <path
                className="osyx-text"
                d="m52.39,19.5h-28.71C10.62,19.5,0,30.12,0,43.18v27.71c0,13.05,10.62,23.67,23.67,23.67h28.71c13.05,0,23.67-10.62,23.67-23.67v-27.71c0-13.05-10.62-23.67-23.67-23.67Zm12.22,51.39c0,6.74-5.48,12.22-12.22,12.22h-28.71c-6.74,0-12.22-5.48-12.22-12.22v-27.71c0-6.74,5.48-12.22,12.22-12.22h28.71c6.74,0,12.22,5.48,12.22,12.22v27.71Z"
              ></path>
              <path
                className="osyx-text"
                d="m317.04,57.03l28.31-28.31c1.06-1.08,1.65-2.5,1.65-4.01s-.59-2.92-1.66-4.01c-1.08-1.07-2.5-1.65-4.01-1.65s-2.94.59-4.01,1.65l-28.37,28.36-28.36-28.36c-1.07-1.07-2.49-1.66-4.02-1.66s-2.94.59-4,1.65c-1.08,1.07-1.67,2.49-1.67,4,0,1.52.59,2.95,1.67,4.03l28.3,28.3-28.3,28.29c-1.08,1.08-1.67,2.5-1.67,4.02s.59,2.95,1.67,4.01c1.06,1.06,2.49,1.65,4,1.65s2.94-.59,4.02-1.65l28.37-28.37,28.38,28.37c1.08,1.06,2.5,1.65,4,1.65s2.93-.59,4.01-1.65c2.21-2.2,2.21-5.8,0-8.02l-28.3-28.29Z"
              ></path>
              <path
                className="osyx-text"
                d="m236.42,19c-3.16,0-5.72,2.57-5.72,5.72v58.38h-40.07c-6.74,0-12.22-5.48-12.22-12.22V24.73c0-3.16-2.57-5.72-5.72-5.72s-5.73,2.57-5.73,5.72v46.16c0,13.05,10.62,23.67,23.67,23.67h39.34c-1.75,4.92-6,8.05-10.99,8.05h-31.13c-3.21,0-5.73,2.48-5.73,5.64s2.57,5.81,5.73,5.81h31.13c13.21,0,23.17-9.78,23.17-22.76V24.73c0-3.16-2.57-5.72-5.73-5.72Z"
              ></path>
              <path
                className="osyx-text"
                d="m137.56,51.31h-32.44c-5.87,0-10.67-4.62-10.69-10.31-.01-2.89,1.07-5.57,3.04-7.55,1.7-1.7,4.02-2.5,7.32-2.5h44.56c3.16,0,5.72-2.57,5.72-5.73s-2.57-5.72-5.72-5.72h-44.56c-12.01,0-21.59,9.24-21.8,21.04-.1,5.75,2.11,11.24,6.24,15.44,4.22,4.3,10.08,6.77,16.06,6.77h32.66c2.84,0,5.48,1.09,7.45,3.06,1.97,1.97,3.05,4.63,3.05,7.46-.01,5.51-4.73,9.83-10.73,9.83h-42.68c-3.16,0-5.73,2.57-5.73,5.73s2.57,5.73,5.73,5.73h43.05c12.05,0,21.69-9.15,21.94-20.83.12-5.8-2.1-11.33-6.25-15.57-4.26-4.35-10.17-6.85-16.22-6.85Z"
              ></path>
              <g>
                <path
                  className="osyx-text"
                  d="m11.54,112.61h-3.01c-.93,0-1.69-.67-1.69-1.5v-5.26h4.7c.46,0,.84-.37.84-.83s-.38-.84-.84-.84h-4.7v-2.87c0-.49-.4-.89-.89-.89h-.04c-.47,0-.84.38-.84.84v2.92h-.88c-.47,0-.84.37-.84.83s.37.84.84.84h.88v5.26c0,1.75,1.55,3.18,3.46,3.18h3.01c.46,0,.84-.37.84-.84s-.38-.84-.84-.84Z"
                ></path>
                <path
                  className="osyx-text"
                  d="m28.19,110.07v-2.71c0-1.76-1.55-3.18-3.46-3.18h-6.19c-1.91,0-3.47,1.42-3.47,3.18v3.75c0,1.75,1.56,3.18,3.47,3.18h7.75c.46,0,.84-.38.84-.84s-.38-.84-.84-.84h-7.75c-.94,0-1.69-.67-1.69-1.5v-1.04h11.34Zm-11.34-2.71c0-.83.75-1.51,1.69-1.51h6.19c.93,0,1.69.68,1.69,1.51v1.03h-9.57v-1.03Z"
                ></path>
                <path
                  className="osyx-text"
                  d="m42.38,112.61h-7.75c-.94,0-1.69-.67-1.69-1.5v-3.75c0-.83.75-1.51,1.69-1.51h7.75c.46,0,.84-.37.84-.83s-.38-.84-.84-.84h-7.75c-1.91,0-3.47,1.42-3.47,3.18v3.75c0,1.75,1.56,3.18,3.47,3.18h7.75c.46,0,.84-.37.84-.84s-.38-.84-.84-.84Z"
                ></path>
                <path
                  className="osyx-text"
                  d="m55.88,104.18h-7.88v-2.87c0-.49-.4-.89-.89-.89s-.89.4-.89.89v12.09c0,.49.4.89.89.89s.89-.4.89-.89v-7.55h7.88c.93,0,1.69.68,1.69,1.51v6.04c0,.49.4.89.88.89s.89-.4.89-.89v-6.04c0-1.76-1.55-3.18-3.46-3.18Z"
                ></path>
                <path
                  className="osyx-text"
                  d="m72.38,104.18h-6.19c-1.91,0-3.47,1.42-3.47,3.18v6.04c0,.49.4.89.89.89s.89-.4.89-.89v-6.04c0-.83.76-1.51,1.69-1.51h6.19c.93,0,1.69.68,1.69,1.51v6.04c0,.49.4.89.89.89s.88-.4.88-.89v-6.04c0-1.76-1.55-3.18-3.46-3.18Z"
                ></path>
                <path
                  className="osyx-text"
                  d="m88.68,104.18h-6.19c-1.91,0-3.47,1.42-3.47,3.18v3.75c0,1.75,1.56,3.18,3.47,3.18h6.19c1.91,0,3.46-1.43,3.46-3.18v-3.75c0-1.76-1.55-3.18-3.46-3.18Zm1.69,6.93c0,.83-.76,1.5-1.69,1.5h-6.19c-.94,0-1.69-.67-1.69-1.5v-3.75c0-.83.75-1.51,1.69-1.51h6.19c.93,0,1.69.68,1.69,1.51v3.75Z"
                ></path>
                <path
                  className="osyx-text"
                  d="m101.01,112.61h-2.23c-.93,0-1.69-.67-1.69-1.5v-9.8c0-.49-.4-.89-.89-.89s-.88.4-.88.89v9.8c0,1.75,1.55,3.18,3.46,3.18h2.14c.48,0,.88-.4.88-.89,0-.43-.35-.79-.79-.79Z"
                ></path>
                <path
                  className="osyx-text"
                  d="m113.74,104.18h-6.19c-1.91,0-3.47,1.42-3.47,3.18v3.75c0,1.75,1.56,3.18,3.47,3.18h6.19c1.91,0,3.46-1.43,3.46-3.18v-3.75c0-1.76-1.55-3.18-3.46-3.18Zm1.69,6.93c0,.83-.76,1.5-1.69,1.5h-6.19c-.93,0-1.69-.67-1.69-1.5v-3.75c0-.83.76-1.51,1.69-1.51h6.19c.93,0,1.69.68,1.69,1.51v3.75Z"
                ></path>
                <path
                  className="osyx-text"
                  d="m137.52,104.18c-.46,0-.84.37-.84.84v8.43c0,.46.38.84.84.84h.09c.46,0,.84-.38.84-.84v-8.34c0-.52-.42-.93-.93-.93Z"
                ></path>
                <path
                  className="osyx-text"
                  d="m167.62,108.39h-6.91c-.8,0-1.42-.55-1.42-1.26s.62-1.28,1.42-1.28h8.43c.46,0,.84-.37.84-.83s-.38-.84-.84-.84h-8.43c-1.76,0-3.2,1.32-3.2,2.95s1.44,2.94,3.2,2.94h6.89c.81,0,1.44.56,1.44,1.28s-.63,1.26-1.44,1.26h-8.59c-.47,0-.84.38-.84.84s.37.84.84.84h8.61c1.78,0,3.22-1.32,3.22-2.94s-1.44-2.96-3.22-2.96Z"
                ></path>
                <path
                  className="osyx-text"
                  d="m154.75,110.07v-2.71c0-1.76-1.56-3.18-3.47-3.18h-6.19c-1.91,0-3.46,1.42-3.46,3.18v3.75c0,1.75,1.55,3.18,3.46,3.18h7.75c.47,0,.84-.38.84-.84s-.37-.84-.84-.84h-7.75c-.93,0-1.69-.67-1.69-1.5v-1.04h11.35Zm-11.35-2.71c0-.83.76-1.51,1.69-1.51h6.19c.94,0,1.69.68,1.69,1.51v1.03h-9.57v-1.03Z"
                ></path>
                <path
                  className="osyx-text"
                  d="m137.52,100.42c-.46,0-.84.38-.84.85v.09c0,.46.38.84.84.84h.09c.46,0,.84-.38.84-.84,0-.52-.42-.94-.93-.94Z"
                ></path>
                <path
                  className="osyx-text"
                  d="m129.83,104.18h-6.19c-1.91,0-3.46,1.42-3.46,3.18v3.75c0,1.75,1.55,3.18,3.46,3.18h6.19c.47,0,.92-.08,1.35-.25l.34-.13v.95c0,.83-.76,1.5-1.69,1.5h-7.75c-.46,0-.84.38-.84.84s.38.84.84.84h7.75c1.91,0,3.47-1.43,3.47-3.18v-7.5c0-1.76-1.56-3.18-3.47-3.18Zm1.69,6.93c0,.83-.76,1.5-1.69,1.5h-6.19c-.93,0-1.69-.67-1.69-1.5v-3.75c0-.83.76-1.51,1.69-1.51h6.19c.93,0,1.69.68,1.69,1.51v3.75Z"
                ></path>
              </g>
            </g>
          </svg>
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
