import { useState } from "react";
// 测试Three.js导入
import "./test-threejs";

// Types
import { ActiveTab } from "./types";
import { calculateWheelSteeringAngle } from "./types/vehicleControl";

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
  const {
    isConnected,
    availablePorts,
    config,
    setConfig,
    handleConnect,
    handleDisconnect,
  } = useSerial();
  const {
    messages,
    sendId,
    sendData,
    setSendId,
    setSendData,
    handleSendMessage,
    sendCanCommand,
    clearMessages,
  } = useCanMessages();
  const {
    canCommands,
    carStates,
    updateCarState,
    updateCanCommand,
    updateVehicleControl,
    startCsvLoop,
    stopCsvLoop,
  } = useCarControl();
  const { logs, isDebugVisible, addDebugLog, clearLogs, toggleDebugPanel } =
    useDebugLogs();

  // 发送车辆控制命令
  const sendCarCommand = async (commandId: string) => {
    console.log("📍 sendCarCommand called with:", commandId);
    const command = canCommands.find((cmd) => cmd.id === commandId);
    if (!command) {
      console.log("❌ Command not found:", commandId);
      return;
    }

    try {
      // 处理"开始行驶"命令 - 使用CSV循环发送
      if (commandId === "start_driving") {
        console.log("🚗 Start driving command detected");
        console.log("Config state:", {
          csvFilePath: config.csvFilePath,
          csvContentLength: config.csvContent?.length,
          sendIntervalMs: config.sendIntervalMs,
        });

        if (!config.csvFilePath || !config.csvContent) {
          console.log("❌ CSV file not selected");
          alert("请先在CAN配置页面选择CSV文件");
          return;
        }
        if (!config.sendIntervalMs || config.sendIntervalMs < 1) {
          console.log("❌ Invalid send interval");
          alert("请设置有效的发送间隔（>= 1ms）");
          return;
        }

        console.log("✅ All validations passed, starting CSV loop");
        addDebugLog(
          "开始CSV循环发送",
          commandId,
          "CSV",
          config.csvFilePath,
          `间隔: ${config.sendIntervalMs}ms, 开始行: ${
            config.csvStartRowIndex || 0
          }`
        );

        // 定义进度更新回调
        const onProgressUpdate = (speed: number, steeringAngle: number) => {
          // steeringAngle 是方向盘转向角，需要转换为轮胎转向角
          const wheelSteeringAngle = calculateWheelSteeringAngle(steeringAngle);

          // 更新状态面板显示方向盘转向角
          updateVehicleControl(speed, steeringAngle);

          // 同时更新3D场景中的车身旋转（基于自行车模型）
          // 使用轮胎转向角来计算车身旋转
          const renderer = car3DRendererRef.current;
          if (renderer) {
            renderer.updateSteeringAngle(wheelSteeringAngle, speed);
          }
        };

        // 定义CSV循环完成后的回调函数
        const onCsvLoopComplete = async () => {
          console.log("🎉 CSV loop completed, auto-stopping driving");
          addDebugLog(
            "CSV循环完成",
            "auto_stop",
            "CSV",
            "自动停止",
            "所有数据已发送，自动触发停止行驶"
          );

          // 自动触发停止行驶
          try {
            await stopCsvLoop();
            updateCarState("stop_driving");

            // 触发3D动画
            if (car3DRendererRef.current) {
              const renderer = car3DRendererRef.current;
              console.log("🛑 自动停止行驶动画");
              renderer.stopWheelRotation();
              renderer.stopRoadMovement();
              renderer.resetVehicleDynamics(); // 重置车辆动力学状态
              renderer.startCameraAnimation("side", 2000, true);
            }
          } catch (error) {
            console.error("❌ Failed to auto-stop driving:", error);
          }
        };

        await startCsvLoop(
          config.csvContent,
          config.sendIntervalMs,
          config.canIdColumnIndex || 0,
          config.canDataColumnIndex || 1,
          config.csvStartRowIndex || 0,
          config,
          onCsvLoopComplete,
          onProgressUpdate
        );

        updateCarState(commandId);

        // 触发3D动画
        if (car3DRendererRef.current) {
          const renderer = car3DRendererRef.current;
          console.log("🚗 开始行驶动画");
          renderer.startWheelRotation(20, 1);
          renderer.startRoadMovement(1);
          renderer.startCameraAnimation("driving", 2000, true);
          // 隐藏门按钮
          renderer.setDoorButtonsVisible(false);
        }
      } else if (commandId === "stop_driving") {
        // 停止循环发送
        addDebugLog(
          "停止CSV循环发送",
          commandId,
          "CSV",
          "停止",
          "停止循环发送"
        );

        await stopCsvLoop();
        updateCarState(commandId);

        // 触发3D动画
        if (car3DRendererRef.current) {
          const renderer = car3DRendererRef.current;
          console.log("🛑 停止行驶动画");
          renderer.stopWheelRotation();
          renderer.stopRoadMovement();
          renderer.startCameraAnimation("side", 2000, true);
          // 显示门按钮
          renderer.setDoorButtonsVisible(true);
        }
      } else if (commandId === "door_open" || commandId === "door_close") {
        // 门命令 - 发送开/关命令，动画结束后自动发送停止信号
        addDebugLog(
          "发送车门命令",
          commandId,
          command.canId,
          command.data,
          command.description
        );

        await sendCanCommand(command.canId, command.data, config);
        updateCarState(commandId);

        // 门动画持续时间约为 1.5 秒，动画结束后自动发送停止信号
        const doorAnimationDuration = 1500; // 毫秒
        setTimeout(async () => {
          console.log("🚪 门动画结束，自动发送停止信号");
          const stopCommand = canCommands.find((cmd) => cmd.id === "door_stop");
          if (stopCommand) {
            addDebugLog(
              "自动发送车门停止",
              "door_stop",
              stopCommand.canId,
              stopCommand.data,
              "门动画结束后自动停止"
            );
            await sendCanCommand(stopCommand.canId, stopCommand.data, config);
            updateCarState("door_stop");
          }
        }, doorAnimationDuration);
      } else {
        // 其他命令 - 发送单个CAN消息
        addDebugLog(
          "发送CAN命令",
          commandId,
          command.canId,
          command.data,
          command.description
        );

        await sendCanCommand(command.canId, command.data, config);
        updateCarState(commandId);
      }
    } catch (error) {
      console.error("Send car command error:", error);
      alert(`发送车辆命令错误: ${error}`);
    }
  };

  // 3D场景hook（需要在sendCarCommand定义后调用）
  const { scene3DStatus, car3DRendererRef } = use3DScene(
    activeTab,
    sendCarCommand
  );

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
