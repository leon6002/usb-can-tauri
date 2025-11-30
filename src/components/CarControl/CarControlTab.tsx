import React, { memo } from "react";
import { Car3DViewer } from "./Car3DViewer";

import { DebugPanel } from "./DebugPanel";
import { DemoQuickConnect } from "../Layout/DemoQuickConnect";
import { isDemoMode, isShowSteeringWheel } from "@/config/appConfig";
import { useCarControlStore } from "@/store/carControlStore";
import { useEngineSound } from "@/hooks/useEngineSound";
import SteeringWheel from "./SteeringWheel";
import { DraggableContainer } from "../common/DraggableContainer";
import TopStatusBar from "./TopStatusBar";
import { APP_VERSION } from "@/config/version";

const CarControlTabComponent: React.FC = () => {
  // 从 Context 获取状态和函数
  const demoMode = isDemoMode();

  // 获取行驶状态和速度
  const isDriving = useCarControlStore((state) => state.carStates.isDriving);
  const currentSpeed = useCarControlStore(
    (state) => state.carStates.currentSpeed
  );

  // 使用引擎声音 hook
  useEngineSound(isDriving, currentSpeed);

  console.log("car control tab rendering");

  return (
    <div className="flex-1 flex flex-col overflow-hidden h-full relative bg-gray-100">
      {/* Top Status Bar - Optional, maybe hide in HUD mode or make transparent */}

      <div className="relative z-50 pointer-events-none">
        <TopStatusBar />
      </div>

      {/* Main Content Area - Full Screen 3D */}
      <div className="absolute inset-0 z-0">
        <Car3DViewer />
      </div>

      {/* HUD Overlay Layer */}
      <div className="absolute inset-0 z-10 pointer-events-none">

        {/* Bottom Left: Connection Status */}
        <div className="absolute bottom-16 left-4 pointer-events-auto">
          {demoMode && <DemoQuickConnect />}
        </div>

        {/* Bottom Right: Steering Wheel & Pedals (Draggable) */}
        {isShowSteeringWheel() && (
          <DraggableContainer
            initialPosition={{ x: window.innerWidth - 280, y: (window.innerHeight - 660) / 2 }}
            className="pointer-events-auto"
          >
            <div className="p-2">
              <SteeringWheel />
            </div>
          </DraggableContainer>
        )}



      </div>

      {/* Debug Panel - Keep as is or adjust z-index */}
      <div className="absolute bottom-0 left-0 z-20 pointer-events-auto">
        <DebugPanel showToggleButton={!isDemoMode} />
      </div>

      {/* Version Badge */}
      <div className="absolute bottom-1 left-1 text-[10px] text-white/20 font-medium px-2 py-0.5 rounded-sm z-10 select-none pointer-events-none">
        {APP_VERSION}
      </div>
    </div>
  );
};

// 使用 memo 包装，避免不必要的重新渲染
export const CarControlTab = memo(CarControlTabComponent);
