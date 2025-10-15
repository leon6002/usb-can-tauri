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
import { useDebugLogs } from "./hooks/useDebugLogs";

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
  const { logs, isDebugVisible, addDebugLog, clearLogs, toggleDebugPanel } = useDebugLogs();

  // 发送车辆控制命令
  const sendCarCommand = async (commandId: string) => {
    const command = canCommands.find((cmd) => cmd.id === commandId);
    if (!command) return;

    try {
      // 记录调试日志
      addDebugLog(
        "发送CAN命令",
        commandId,
        command.canId,
        command.data,
        command.description
      );

      await sendCanCommand(command.canId, command.data, config);
      // 更新车辆状态
      updateCarState(commandId);

      // 触发3D动画和运镜
      if (car3DRendererRef.current) {
        const renderer = car3DRendererRef.current;

        switch (commandId) {
          case "start_driving":
            console.log("🚗 开始行驶动画");
            // 启动轮子旋转和道路移动
            renderer.startWheelRotation(20, 1); // 速度5，前进方向
            renderer.startRoadMovement(1); // 道路移动速度2
            // 运镜到车辆后方，并保持最终位置
            renderer.startCameraAnimation('driving', 2000, true); // 2秒运镜到后方，保持位置
            break;
          case "stop_driving":
            console.log("🛑 停止行驶动画");
            // 渐进停止轮子旋转和道路移动
            renderer.stopWheelRotation();
            renderer.stopRoadMovement();
            // 立即运镜到车辆侧面，并保持最终位置
            renderer.startCameraAnimation('side', 2000, true); // 立即运镜到侧面，保持位置
            break;
        }
      }
    } catch (error) {
      console.error("Send car command error:", error);
      alert(`发送车辆命令错误: ${error}`);
    }
  };

  // 3D场景hook（需要在sendCarCommand定义后调用）
  const { scene3DStatus, car3DRendererRef } = use3DScene(activeTab, sendCarCommand);

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
            debugLogs={logs}
            isDebugVisible={isDebugVisible}
            onToggleDebug={toggleDebugPanel}
            onClearDebugLogs={clearLogs}
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
