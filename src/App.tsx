import { useState } from "react";
// 测试Three.js导入
import "./test-threejs";

// Types
import { ActiveTab } from "./types";

// Hooks
import { useSerial } from "./hooks/useSerial";
import { useCanMessages } from "./hooks/useCanMessages";
import { useCarControl } from "./hooks/useCarControl";
import { use3DScene } from "./hooks/use3DScene";

// Components
import { Sidebar } from "./components/Layout/Sidebar";
import { CarControlTab } from "./components/CarControl/CarControlTab";
import { CanConfigTab } from "./components/CanConfig/CanConfigTab";
import { ButtonConfigTab } from "./components/ButtonConfig/ButtonConfigTab";

function App() {
  const [activeTab, setActiveTab] = useState<ActiveTab>("car");

  // Custom hooks
  const { isConnected, availablePorts, config, setConfig, handleConnect, handleDisconnect } = useSerial();
  const { messages, sendId, sendData, setSendId, setSendData, handleSendMessage, sendCanCommand, clearMessages } = useCanMessages();
  const { canCommands, carStates, updateCarState, updateCanCommand } = useCarControl();
  const { scene3DStatus, car3DRendererRef } = use3DScene(activeTab);

  // 发送车辆控制命令
  const sendCarCommand = async (commandId: string) => {
    const command = canCommands.find((cmd) => cmd.id === commandId);
    if (!command) return;

    try {
      await sendCanCommand(command.canId, command.data, config);
      // 更新车辆状态
      updateCarState(commandId);

      // 触发3D动画
      if (car3DRendererRef.current) {
        const renderer = car3DRendererRef.current;

        switch (commandId) {
          case "start_driving":
            console.log("🚗 开始行驶动画");
            renderer.startWheelRotation(5, 1); // 速度5，前进方向
            renderer.startRoadMovement(2); // 道路移动速度2
            break;
          case "stop_driving":
            console.log("🛑 停止行驶动画");
            renderer.stopWheelRotation();
            renderer.stopRoadMovement();
            break;
        }
      }
    } catch (error) {
      console.error("Send car command error:", error);
      alert(`发送车辆命令错误: ${error}`);
    }
  };

  return (
    <div className="h-screen bg-gray-100 flex overflow-hidden">
      {/* Left Sidebar */}
      <Sidebar
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        isConnected={isConnected}
        config={config}
        onConnect={handleConnect}
      />

      {/* Main Content */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Tab Content */}
        {activeTab === "car" && (
          <CarControlTab
            isConnected={isConnected}
            carStates={carStates}
            scene3DStatus={scene3DStatus}
            onSendCommand={sendCarCommand}
          />
        )}

        {activeTab === "config" && (
          <CanConfigTab
            isConnected={isConnected}
            config={config}
            availablePorts={availablePorts}
            messages={messages}
            sendId={sendId}
            sendData={sendData}
            onConnect={handleConnect}
            onDisconnect={handleDisconnect}
            onConfigChange={setConfig}
            onSendMessage={() => handleSendMessage(config)}
            onClearMessages={clearMessages}
            onSendIdChange={setSendId}
            onSendDataChange={setSendData}
          />
        )}

        {activeTab === "buttons" && (
          <ButtonConfigTab
            canCommands={canCommands}
            onUpdateCanCommand={updateCanCommand}
          />
        )}
      </div>
    </div>
  );
}

export default App;
