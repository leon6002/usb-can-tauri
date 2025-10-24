import { useState, useEffect } from "react";
import { Toaster } from "sonner";

// Types
import { ActiveTab } from "./types";

// Config
import { isDemoMode } from "./config/appConfig";

// Hooks
import { use3DScene } from "./hooks/use3DScene";

// Components
import { Sidebar } from "./components/Layout/Sidebar";
import { CarControlTab } from "./components/CarControl/CarControlTab";
import { CanConfigTab } from "./components/CanConfig/CanConfigTab";
import { ButtonConfigTab } from "./components/ButtonConfig/ButtonConfigTab";
import { useSerialStore } from "./store/serialStore";
import { useCarControlStore } from "./store/carControlStore";
import { use3DStore } from "./store/car3DStore";
import { useRadarStore } from "./store/radarStore";

function App() {
  const [activeTab, setActiveTab] = useState<ActiveTab>("car");
  const isConnected = useSerialStore((state) => state.isConnected);

  console.log("app rendered");

  // 查询可用串口，加载内置csv行驶数据
  const initializeSerial = useSerialStore((state) => state.initializeSerial);
  useEffect(() => {
    initializeSerial();
  }, []);

  // 监听 CSV 数据循环完成事件
  const csvLoopFinishListener = useCarControlStore(
    (state) => state.csvLoopFinishListener
  );
  const stopCsvLoopListen = useCarControlStore(
    (state) => state.stopCsvLoopListen
  );
  useEffect(() => {
    csvLoopFinishListener();
    return () => {
      stopCsvLoopListen();
    };
  }, [csvLoopFinishListener, stopCsvLoopListen]);

  // 注入3D渲染器实例到 Store
  const sendCarCommand = useCarControlStore((state) => state.sendCarCommand);
  const { car3DRendererRef } = use3DScene(activeTab, sendCarCommand);
  const { setRendererInstance } = use3DStore();
  useEffect(() => {
    // 当 renderer 实例创建后，设置到 Store 中
    if (car3DRendererRef.current) {
      setRendererInstance(car3DRendererRef.current);
    }
  }, [car3DRendererRef.current, setRendererInstance]);

  // 定时发送雷达信号并监听雷达数据
  const manageRadar = useRadarStore((state) => state.manageRadar);
  useEffect(() => {
    manageRadar(isConnected);
    return () => {
      manageRadar(false);
    };
  }, [isConnected, manageRadar]);

  //是否演示模式
  const demoMode = isDemoMode();

  return (
    <div className="h-screen bg-gray-100 flex overflow-hidden">
      <Toaster position="top-right" theme="light" richColors />

      {/* 演示模式：只显示车辆控制界面 */}
      {demoMode ? (
        <div className="w-full h-full overflow-hidden">
          <CarControlTab />
        </div>
      ) : (
        /* 调试模式：显示完整界面 */
        <>
          {/* Left Sidebar */}
          <Sidebar activeTab={activeTab} setActiveTab={setActiveTab} />

          {/* Main Content */}
          <div className="flex-1 flex flex-col overflow-hidden">
            {/* Tab Content */}
            {activeTab === "car" && <CarControlTab />}

            {activeTab === "config" && <CanConfigTab />}

            {activeTab === "buttons" && <ButtonConfigTab />}
          </div>
        </>
      )}
    </div>
  );
}

export default App;
