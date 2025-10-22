import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { Toaster, toast } from "sonner";
// 测试Three.js导入
import "./test-threejs";

// Types
import { ActiveTab } from "./types";
// import { STEERING_RATIO } from "./types/vehicleControl";

// Config
import { isDemoMode } from "./config/appConfig";

// Hooks
import { useSerial } from "./hooks/useSerial";
import { useCanMessages } from "./hooks/useCanMessages";
import { useCarControl } from "./hooks/useCarControl";
import { use3DScene } from "./hooks/use3DScene";
import { useDebugLogs } from "./hooks/useDebugLogs";
import { useRadarDistance } from "./hooks/useRadarDistance";

// Contexts
import { CarCommandProvider } from "./contexts/CarCommandContext";
import { CarStateProvider } from "./contexts/CarStateContext";
import { DebugProvider } from "./contexts/DebugContext";

// Components
import { Sidebar } from "./components/Layout/Sidebar";
import { CarControlTab } from "./components/CarControl/CarControlTab";
import { CanConfigTab } from "./components/CanConfig/CanConfigTab";
import { ButtonConfigTab } from "./components/ButtonConfig/ButtonConfigTab";

function App() {
  const [activeTab, setActiveTab] = useState<ActiveTab>("car");
  const suspensionTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Custom hooks
  const {
    isConnected: isConnectedRaw,
    availablePorts,
    config: configRaw,
    setConfig,
    handleConnect,
    handleDisconnect,
    connectToPort,
  } = useSerial();

  // 直接使用 hooks 返回的值（不需要 useMemo，因为 hooks 已经 memoize 了函数）
  const isConnected = isConnectedRaw;
  const config = configRaw;
  const {
    messages,
    sendId,
    sendData,
    setSendId,
    setSendData,
    handleSendMessage,
    sendCanCommand,
    clearMessages,
    carStates: canMessageCarStates,
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

  // 合并来自两个hook的carStates
  // 注意：只合并 canMessageCarStates 中有值的字段，不覆盖 carStates 中的值
  const mergedCarStates = useMemo(
    () => ({
      ...carStates,
      ...(canMessageCarStates.gear && { gear: canMessageCarStates.gear }),
      ...(canMessageCarStates.steeringAngleDegrees && {
        steeringAngleDegrees: canMessageCarStates.steeringAngleDegrees,
      }),
    }),
    [
      carStates,
      canMessageCarStates.gear,
      canMessageCarStates.steeringAngleDegrees,
    ]
  );
  const { logs, isDebugVisible, addDebugLog, clearLogs, toggleDebugPanel } =
    useDebugLogs();
  const { radarDistances, startListening, stopListening } = useRadarDistance();

  // 发送车辆控制命令
  const sendCarCommand = useCallback(
    async (commandId: string) => {
      console.log("📍 sendCarCommand called with:", commandId);
      const command = canCommands.find((cmd) => cmd.id === commandId);
      if (!command) {
        console.log("❌ Command not found:", commandId);
        return;
      }

      try {
        // 处理"开始行驶"命令 - 使用CSV循环发送
        if (commandId === "start_driving") {
          const currentConfig = configRef.current;
          console.log("🚗 Start driving command detected");
          console.log("Config state:", {
            csvFilePath: currentConfig.csvFilePath,
            csvContentLength: currentConfig.csvContent?.length,
            sendIntervalMs: currentConfig.sendIntervalMs,
          });

          if (!currentConfig.csvFilePath || !currentConfig.csvContent) {
            console.log("❌ CSV file not selected");
            alert("请先在CAN配置页面选择CSV文件");
            return;
          }
          if (
            !currentConfig.sendIntervalMs ||
            currentConfig.sendIntervalMs < 1
          ) {
            console.log("❌ Invalid send interval");
            alert("请设置有效的发送间隔（>= 1ms）");
            return;
          }

          console.log("✅ All validations passed, starting CSV loop");
          addDebugLog(
            "开始CSV循环发送",
            commandId,
            "CSV",
            currentConfig.csvFilePath,
            `间隔: ${currentConfig.sendIntervalMs}ms, 开始行: ${
              currentConfig.csvStartRowIndex || 0
            }`
          );

          // 定义进度更新回调
          const onProgressUpdate = (
            speed: number,
            steeringAngle: number,
            gear?: string
          ) => {
            // steeringAngle 已经是轮胎转向角（从新的8字节数据格式解析），单位是弧度
            // 不需要再进行转向比转换

            // todo 计算方向盘转向角用于显示（方向盘转向角 = 轮胎转向角 * 转向比）
            // const steeringWheelAngle = steeringAngle * STEERING_RATIO;

            // 更新状态面板显示方向盘转向角和档位
            updateVehicleControl(speed, steeringAngle, gear);

            // 同时更新3D场景中的车身旋转（基于自行车模型）
            // 使用轮胎转向角来计算车身旋转
            const renderer = car3DRendererRef.current;
            if (renderer) {
              renderer.updateSteeringAngle(steeringAngle, speed);

              // 根据速度动态更新轮子转速和道路移动速度
              // speed 单位是 mm/s，需要转换为合适的动画速度
              // 假设轮子半径约为 0.3m (300mm)，周长约为 1.88m (1880mm)
              // 轮子转速 (rad/s) = 速度 (mm/s) / 轮子半径 (mm)
              const wheelRadius = 300; // mm
              const wheelRotationSpeed = Math.abs(speed) / wheelRadius;

              // 道路移动速度与轮子转速成正比
              // 调整系数以获得合适的视觉效果
              const roadMovementSpeed = wheelRotationSpeed * 0.05;

              // 更新轮子旋转速度
              renderer.updateWheelRotationSpeed(wheelRotationSpeed);

              // 更新道路移动速度
              renderer.updateRoadMovementSpeed(roadMovementSpeed);
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
              updateVehicleControl(0, 0);
              updateCarState("stop_driving");

              // 触发3D动画
              if (car3DRendererRef.current) {
                const renderer = car3DRendererRef.current;
                console.log("🛑 自动停止行驶动画");
                renderer.setIsDriving(false); // 解除相机锁定
                renderer.stopWheelRotation();
                renderer.stopRoadMovement();
                renderer.startCameraAnimation("side", 2000, true);
              }
            } catch (error) {
              console.error("❌ Failed to auto-stop driving:", error);
            }
          };

          await startCsvLoop(
            currentConfig.csvContent,
            currentConfig.sendIntervalMs,
            currentConfig.canIdColumnIndex || 0,
            currentConfig.canDataColumnIndex || 1,
            currentConfig.csvStartRowIndex || 0,
            currentConfig,
            onCsvLoopComplete,
            onProgressUpdate
          );

          updateCarState(commandId);

          // 触发3D动画
          if (car3DRendererRef.current) {
            const renderer = car3DRendererRef.current;
            console.log("🚗 开始行驶动画");
            renderer.setIsDriving(true); // 设置行驶状态
            renderer.startWheelRotation(10, 1);
            renderer.startRoadMovement(0.8);
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
          // 更新状态面板显示方向盘转向角
          updateVehicleControl(0, 0);
          updateCarState(commandId);

          // 触发3D动画
          if (car3DRendererRef.current) {
            const renderer = car3DRendererRef.current;
            console.log("🛑 停止行驶动画");
            renderer.setIsDriving(false); // 设置停止行驶状态
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

          await sendCanCommand(command.canId, command.data, configRef.current);
          updateCarState(commandId);

          // 门动画持续时间约为 1.5 秒，动画结束后自动发送停止信号
          const doorAnimationDuration = 1500; // 毫秒
          setTimeout(async () => {
            console.log("🚪 门动画结束，自动发送停止信号");
            const stopCommand = canCommands.find(
              (cmd) => cmd.id === "door_stop"
            );
            if (stopCommand) {
              addDebugLog(
                "自动发送车门停止",
                "door_stop",
                stopCommand.canId,
                stopCommand.data,
                "门动画结束后自动停止"
              );
              await sendCanCommand(
                stopCommand.canId,
                stopCommand.data,
                configRef.current
              );
              updateCarState("door_stop");
            }
          }, doorAnimationDuration);
        } else if (commandId === "suspension_up") {
          // 悬挂升高命令
          addDebugLog(
            "发送悬挂升高命令",
            commandId,
            command.canId,
            command.data,
            command.description
          );

          await sendCanCommand(command.canId, command.data, configRef.current);
          updateCarState(commandId);

          // 触发3D悬挂升高动画
          if (car3DRendererRef.current) {
            car3DRendererRef.current.startSuspensionUp();
          }

          // 2秒后自动发送停止命令
          if (suspensionTimeoutRef.current) {
            clearTimeout(suspensionTimeoutRef.current);
          }
          suspensionTimeoutRef.current = setTimeout(() => {
            sendCarCommand("suspension_stop");
          }, 2000);
        } else if (commandId === "suspension_down") {
          // 悬挂降低命令
          addDebugLog(
            "发送悬挂降低命令",
            commandId,
            command.canId,
            command.data,
            command.description
          );

          await sendCanCommand(command.canId, command.data, configRef.current);
          updateCarState(commandId);

          // 触发3D悬挂降低动画
          if (car3DRendererRef.current) {
            car3DRendererRef.current.startSuspensionDown();
          }

          // 2秒后自动发送停止命令
          if (suspensionTimeoutRef.current) {
            clearTimeout(suspensionTimeoutRef.current);
          }
          suspensionTimeoutRef.current = setTimeout(() => {
            sendCarCommand("suspension_stop");
          }, 2000);
        } else if (commandId === "suspension_stop") {
          // 悬挂停止命令
          addDebugLog(
            "发送悬挂停止命令",
            commandId,
            command.canId,
            command.data,
            command.description
          );

          await sendCanCommand(command.canId, command.data, configRef.current);
          updateCarState("suspension_stop");

          // 停止3D悬挂动画
          if (car3DRendererRef.current) {
            car3DRendererRef.current.stopSuspensionAnimation();
          }

          // 清除定时器
          if (suspensionTimeoutRef.current) {
            clearTimeout(suspensionTimeoutRef.current);
            suspensionTimeoutRef.current = null;
          }
        } else {
          // 其他命令 - 发送单个CAN消息
          addDebugLog(
            "发送CAN命令",
            commandId,
            command.canId,
            command.data,
            command.description
          );

          await sendCanCommand(command.canId, command.data, configRef.current);
          updateCarState(commandId);
        }
      } catch (error) {
        console.error("Send car command error:", error);
        alert(`发送车辆命令错误: ${error}`);
      }
    },
    [
      canCommands,
      sendCanCommand,
      updateCarState,
      addDebugLog,
      startCsvLoop,
      stopCsvLoop,
    ]
  );

  // 3D场景hook（需要在sendCarCommand定义后调用）
  const { scene3DStatus, car3DRendererRef } = use3DScene(
    activeTab,
    sendCarCommand
  );

  // 启动/停止雷达消息监听和定时发送雷达查询命令
  const unlistenRef = useRef<(() => void) | null>(null);
  const radarIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const configRef = useRef(config);
  const isConnectedRef = useRef(isConnected);

  // 同步最新的 config 和 isConnected 到 ref
  useEffect(() => {
    configRef.current = config;
  }, [config]);

  useEffect(() => {
    isConnectedRef.current = isConnected;
  }, [isConnected]);

  // 雷达查询命令配置
  const RADAR_QUERIES = [
    { id: "0x521", data: "01 03 01 00 00 01" },
    { id: "0x522", data: "02 03 01 00 00 01" },
    { id: "0x523", data: "03 03 01 00 00 01" },
    { id: "0x524", data: "04 03 01 00 00 01" },
  ];

  // 发送雷达查询命令
  const sendRadarQuery = useCallback(async () => {
    if (!isConnectedRef.current) return;

    try {
      for (const radar of RADAR_QUERIES) {
        await sendCanCommand(radar.id, radar.data, configRef.current);
      }
    } catch (error) {
      console.error("❌ Failed to send radar query:", error);
    }
  }, []);

  useEffect(() => {
    if (isConnected) {
      // 连接后启动监听
      if (!unlistenRef.current) {
        startListening().then((unlisten) => {
          unlistenRef.current = unlisten || null;
        });
      }

      console.log("radar lisening");

      // 启动定时发送雷达查询命令（每隔1秒）
      if (!radarIntervalRef.current) {
        radarIntervalRef.current = setInterval(() => {
          sendRadarQuery();
        }, 10000);
        console.log("📡 [Radar] Started sending radar queries every 1 second");
      }
    } else {
      // 断开连接后停止监听
      if (unlistenRef.current) {
        stopListening(unlistenRef.current || undefined);
        unlistenRef.current = null;
      }

      // 停止发送雷达查询命令
      if (radarIntervalRef.current) {
        clearInterval(radarIntervalRef.current);
        radarIntervalRef.current = null;
        console.log("📡 [Radar] Stopped sending radar queries");
      }
    }

    return () => {
      // 组件卸载时清理
      if (unlistenRef.current) {
        stopListening(unlistenRef.current);
        unlistenRef.current = null;
      }
      if (radarIntervalRef.current) {
        clearInterval(radarIntervalRef.current);
        radarIntervalRef.current = null;
      }
    };
  }, [isConnected, startListening, stopListening, sendRadarQuery]);

  // 演示模式下的快速连接处理
  const handleDemoConnect = useCallback(
    async (port: string) => {
      try {
        await connectToPort(port);
        toast.success(`已连接到 ${port}`);
      } catch (error) {
        const errorMessage =
          error instanceof Error ? error.message : String(error);
        toast.error(`连接失败: ${errorMessage}`);
        console.error("Demo connect error:", error);
      }
    },
    [connectToPort]
  );

  const demoMode = isDemoMode();

  // 追踪 sendCarCommand 的依赖项是否改变（用于调试）
  const prevDepsRef = useRef({
    canCommands,
    sendCanCommand,
    updateCarState,
    addDebugLog,
    startCsvLoop,
    stopCsvLoop,
  });

  useEffect(() => {
    const currentDeps = {
      canCommands,
      sendCanCommand,
      updateCarState,
      addDebugLog,
      startCsvLoop,
      stopCsvLoop,
    };

    const keys = Object.keys(currentDeps) as (keyof typeof currentDeps)[];
    let hasChanged = false;
    for (const key of keys) {
      if (prevDepsRef.current[key] !== currentDeps[key]) {
        console.log(`⚠️  sendCarCommand dependency changed: ${key}`);
        hasChanged = true;
      }
    }

    if (!hasChanged) {
      console.log("✅ sendCarCommand dependencies are stable");
    }

    prevDepsRef.current = currentDeps;
  }, [
    canCommands,
    sendCanCommand,
    updateCarState,
    addDebugLog,
    startCsvLoop,
    stopCsvLoop,
  ]);

  console.log("app rendering", {
    isConnected,
    mergedCarStatesKeys: Object.keys(mergedCarStates),
    scene3DStatusKeys: Object.keys(scene3DStatus),
    logsLength: logs.length,
    isDebugVisible,
    radarDistancesRadar1: radarDistances?.radar1?.distance,
  });

  return (
    <div className="h-screen bg-gray-100 flex overflow-hidden">
      <Toaster position="top-right" theme="light" richColors />

      {/* 使用 Context Providers 包装应用 */}
      <CarCommandProvider
        canCommands={canCommands}
        sendCarCommand={sendCarCommand}
        updateCanCommand={updateCanCommand}
      >
        <CarStateProvider
          carStates={carStates}
          mergedCarStates={mergedCarStates}
          scene3DStatus={scene3DStatus}
          radarDistances={radarDistances}
          updateCarState={updateCarState}
          updateVehicleControl={updateVehicleControl}
        >
          <DebugProvider
            logs={logs}
            isDebugVisible={isDebugVisible}
            addDebugLog={addDebugLog}
            clearLogs={clearLogs}
            toggleDebugPanel={toggleDebugPanel}
          >
            {/* 演示模式：只显示车辆控制界面 */}
            {demoMode ? (
              <div className="w-full h-full overflow-hidden">
                <CarControlTab
                  isConnected={isConnected}
                  isDemoMode={true}
                  onDemoConnect={handleDemoConnect}
                  onDemoDisconnect={handleDisconnect}
                />
              </div>
            ) : (
              /* 调试模式：显示完整界面 */
              <>
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
                    <CarControlTab isConnected={isConnected} />
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

                  {activeTab === "buttons" && <ButtonConfigTab />}
                </div>
              </>
            )}
          </DebugProvider>
        </CarStateProvider>
      </CarCommandProvider>
    </div>
  );
}

export default App;
