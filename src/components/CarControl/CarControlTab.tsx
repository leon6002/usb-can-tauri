import React, { memo } from "react";
import { Car3DViewer } from "./Car3DViewer";

import { DebugPanel } from "./DebugPanel";
import { DemoQuickConnect } from "../Layout/DemoQuickConnect";
import { UdpCommunicationPanel } from "../UdpCommunicationPanel";
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

  // 窗口缩放逻辑
  const [scale, setScale] = React.useState(() => {
    if (typeof window === "undefined") return 1;
    const targetHeight = 900;
    const hScale = window.innerHeight / targetHeight;
    const newScale = Math.max(hScale, 0.7);
    return newScale;
  });
  
  React.useEffect(() => {
    const handleResize = () => {
      // 基于 1080p 高度进行缩放，确保垂直方向总是能放下
      // 也可以同时考虑宽度 Math.min(window.innerWidth / 1920, window.innerHeight / 1080)
      const targetHeight = 900; // 调小参考高度，让UI稍微大一点 (之前是 1080)
      const hScale = window.innerHeight / targetHeight;
      // 限制最小缩放比例，防止太小
      const newScale = Math.max(hScale, 0.75); 
      // 直接使用高度比例，或者更保守一点取宽高的最小值以适应各种比例
      // const wScale = window.innerWidth / 1920;
      // 取宽高中较大的缩放比例，或者稍微放宽限制
      // const newScale = Math.min(wScale, hScale);
      
      setScale(newScale);
    };

    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);


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

      {/* HUD Overlay Layer - Specially Scaled */}
      <div 
        className="absolute inset-0 z-10 pointer-events-none origin-top-left"
        style={{
          transform: `scale(${scale})`,
          width: `${100 / scale}%`,
          height: `${100 / scale}%`
        }}
      >

        {/* Bottom Left: Connection Status */}
        <div className="absolute bottom-16 left-4 pointer-events-auto flex flex-col gap-2">
          {demoMode && <DemoQuickConnect />}
          <UdpCommunicationPanel />
        </div>

        {/* Bottom Right: Steering Wheel & Pedals (Draggable) */}
        {isShowSteeringWheel() && (
          <DraggableContainer
            initialPosition={{ 
              x: window.innerWidth / scale - 280, 
              y: (window.innerHeight / scale - 660) / 2 
            }}
            className="pointer-events-auto"
            key={scale} // Force re-mount on scale change to update initialPosition
            scale={scale}
          >
            <div className="p-2">
              <SteeringWheel />
            </div>
          </DraggableContainer>
        )}

        {/* Fan Control */}



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
