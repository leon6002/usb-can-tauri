import { useState, useEffect, useRef } from "react";
import { invoke } from "@tauri-apps/api/core";
import { Car3DRenderer } from "./components/Car3DRenderer";
// 测试Three.js导入
import "./test-threejs";
import {
  Settings,
  Play,
  Send,
  Trash2,
  Wifi,
  WifiOff,
  Car,
  Wrench,
  MessageSquare,
  Gamepad2,
} from "lucide-react";

interface SerialConfig {
  port: string;
  baudRate: number;
  canBaudRate: number;
  frameType: string;
  canMode: string;
  // 回环测试配置
  isLoopbackTest: boolean;
  loopbackPort1: string;
  loopbackPort2: string;
}

interface CanMessage {
  id: string;
  data: string;
  timestamp: string;
  direction: "sent" | "received";
  frameType: "standard" | "extended";
}

interface CanCommand {
  id: string;
  name: string;
  canId: string;
  data: string;
  description: string;
}

function App() {
  const [activeTab, setActiveTab] = useState<"car" | "config" | "buttons">("car");
  const [isConnected, setIsConnected] = useState(false);

  const [config, setConfig] = useState<SerialConfig>({
    port: "COM22",
    baudRate: 2000000,
    canBaudRate: 2000000,
    frameType: "extended",
    canMode: "normal",
    isLoopbackTest: false,
    loopbackPort1: "COM22",
    loopbackPort2: "COM23",
  });
  const [messages, setMessages] = useState<CanMessage[]>([]);
  const [sendId, setSendId] = useState("123");
  const [sendData, setSendData] = useState("01 02 03 04");
  const [availablePorts, setAvailablePorts] = useState<string[]>([]);

  // Car control commands configuration
  const [canCommands, setCanCommands] = useState<CanCommand[]>([
    {
      id: "left_door_open",
      name: "左门开启",
      canId: "123",
      data: "02",
      description: "打开左车门",
    },
    {
      id: "left_door_close",
      name: "左门关闭",
      canId: "123",
      data: "01",
      description: "关闭左车门",
    },
    {
      id: "left_door_stop",
      name: "左门停止",
      canId: "123",
      data: "00",
      description: "停止左车门",
    },
    {
      id: "fan_level_0",
      name: "风扇档位0",
      canId: "124",
      data: "00",
      description: "风扇关闭",
    },
    {
      id: "fan_level_1",
      name: "风扇档位1",
      canId: "124",
      data: "01",
      description: "风扇低速",
    },
    {
      id: "fan_level_2",
      name: "风扇档位2",
      canId: "124",
      data: "02",
      description: "风扇高速",
    },
    {
      id: "light_mode_1",
      name: "灯带模式1",
      canId: "125",
      data: "00",
      description: "灯带模式1",
    },
    {
      id: "light_mode_2",
      name: "灯带模式2",
      canId: "125",
      data: "01",
      description: "灯带模式2",
    },
    {
      id: "light_mode_3",
      name: "灯带模式3",
      canId: "125",
      data: "02",
      description: "灯带模式3",
    },
    {
      id: "light_mode_4",
      name: "灯带模式4",
      canId: "125",
      data: "03",
      description: "灯带模式4",
    },
  ]);

  // Car control states
  const [carStates, setCarStates] = useState({
    isDriving: false,
    leftDoorStatus: "停止",
    rightDoorStatus: "停止",
    fanLevel: 0,
    lightMode: 1,
  });

  // 3D场景状态
  const [scene3DStatus, setScene3DStatus] = useState<"loading" | "ready" | "error">("loading");

  // 获取可用串口
  useEffect(() => {
    const fetchPorts = async () => {
      try {
        const ports = await invoke<string[]>("get_available_ports");
        setAvailablePorts(ports);
      } catch (error) {
        console.error("Failed to get ports:", error);
      }
    };
    fetchPorts();
  }, []);

  // 3D渲染器引用
  const car3DRendererRef = useRef<Car3DRenderer | null>(null);

  // 初始化3D场景
  useEffect(() => {
    // 只在车辆控制tab激活时初始化3D场景
    if (activeTab !== "car") {
      return;
    }

    const init3DScene = () => {
      const container = document.getElementById("car-3d-container");
      if (!container) {
        console.log("Container not found, will retry...");
        return;
      }
      // 如果已经初始化过了，直接更新状态和UI
      if (car3DRendererRef.current) {
        console.log("3D scene already initialized, updating UI...");
        setScene3DStatus("ready");

        // 隐藏加载提示
        const loadingElement = container.querySelector('.loading-3d');
        if (loadingElement) {
          (loadingElement as HTMLElement).style.display = 'none';
        }
        return;
      }

      try {
        console.log("Initializing 3D car scene with npm Three.js...");
        setScene3DStatus("loading");

        // 创建3D渲染器实例
        const renderer = new Car3DRenderer('car-3d-container');
        car3DRendererRef.current = renderer;

        // 将渲染器实例保存到全局，供按钮控制使用
        (window as any).car3DRenderer = renderer;

        // 隐藏加载提示
        const loadingElement = container.querySelector('.loading-3d');
        if (loadingElement) {
          setTimeout(() => {
            (loadingElement as HTMLElement).style.opacity = '0';
            setTimeout(() => {
              (loadingElement as HTMLElement).style.display = 'none';
            }, 500);
          }, 2000); // 2秒后开始淡出
        }

        console.log("✅ 3D scene initialized successfully with npm packages");
        console.log("🎮 Car3DRenderer instance:", renderer);
        console.log("📦 Available methods:", Object.getOwnPropertyNames(Object.getPrototypeOf(renderer)));

        // 更新状态
        setScene3DStatus("ready");

      } catch (error) {
        console.error("Failed to initialize 3D scene:", error);
        setScene3DStatus("error");

        // 显示错误信息
        const loadingElement = container.querySelector('.loading-3d');
        if (loadingElement) {
          loadingElement.innerHTML = `
            <div class="text-center">
              <div class="text-red-500 text-lg mb-4">❌ 3D场景初始化失败</div>
              <p class="text-gray-600 text-sm">${error}</p>
              <button
                onclick="location.reload()"
                class="mt-4 px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 transition-colors"
              >
                重新加载
              </button>
            </div>
          `;
        }
      }
    };

    // 开始初始化，如果容器不存在则延迟重试
    const container = document.getElementById("car-3d-container");
    if (container) {
      init3DScene();
    } else {
      // 延迟重试
      const timer = setTimeout(() => {
        init3DScene();
      }, 100);
      return () => clearTimeout(timer);
    }

  }, [activeTab]); // 监听activeTab变化

  // 组件卸载时清理3D场景
  useEffect(() => {
    return () => {
      if (car3DRendererRef.current && car3DRendererRef.current.dispose) {
        console.log("Disposing 3D scene...");
        car3DRendererRef.current.dispose();
      }
      // 清理全局引用
      if ((window as any).car3DRenderer === car3DRendererRef.current) {
        delete (window as any).car3DRenderer;
      }
      car3DRendererRef.current = null;
    };
  }, []);

  // 连接/断开串口
  const handleConnect = async () => {
    try {
      if (isConnected) {
        await invoke("disconnect_serial");
        setIsConnected(false);
      } else {
        // 转换字段名为Rust后端期望的格式
        const rustConfig = {
          port: config.port,
          baud_rate: config.baudRate,
          can_baud_rate: config.canBaudRate,
          frame_type: config.frameType,
          can_mode: config.canMode,
          is_loopback_test: config.isLoopbackTest,
          loopback_port1: config.loopbackPort1,
          loopback_port2: config.loopbackPort2,
        };
        await invoke("connect_serial", { config: rustConfig });
        setIsConnected(true);
      }
    } catch (error) {
      console.error("Connection error:", error);
      alert(`连接错误: ${error}`);
    }
  };

  // 断开串口连接
  const handleDisconnect = async () => {
    try {
      await invoke("disconnect_serial");
      setIsConnected(false);
    } catch (error) {
      console.error("Disconnect error:", error);
    }
  };

  // 发送CAN消息
  const handleSendMessage = async () => {
    try {
      const params = {
        id: sendId,
        data: sendData,
        frameType: config.frameType,
      };
      console.log("发送CAN消息参数:", params);
      await invoke("send_can_message", params);

      // 添加到消息列表
      const newMessage: CanMessage = {
        id: sendId,
        data: sendData,
        timestamp: new Date().toLocaleTimeString(),
        direction: "sent",
        frameType: config.frameType as "standard" | "extended",
      };
      setMessages((prev) => [...prev, newMessage]);
    } catch (error) {
      console.error("Send error:", error);
      alert(`发送错误: ${error}`);
    }
  };

  // 发送车辆控制命令
  const sendCarCommand = async (commandId: string) => {
    const command = canCommands.find((cmd) => cmd.id === commandId);
    if (!command) return;

    try {
      const params = {
        id: command.canId,
        data: command.data,
        frame_type: config.frameType,
      };
      console.log("发送车辆命令参数:", params);
      await invoke("send_can_message", params);

      // 添加到消息列表
      const newMessage: CanMessage = {
        id: command.canId,
        data: command.data,
        timestamp: new Date().toLocaleTimeString(),
        direction: "sent",
        frameType: config.frameType as "standard" | "extended",
      };
      setMessages((prev) => [...prev, newMessage]);

      // 更新车辆状态
      updateCarState(commandId);
    } catch (error) {
      console.error("Send car command error:", error);
      alert(`发送车辆命令错误: ${error}`);
    }
  };

  // 更新车辆状态
  const updateCarState = (commandId: string) => {
    setCarStates((prev) => {
      const newState = { ...prev };

      switch (commandId) {
        case "left_door_open":
          newState.leftDoorStatus = "开启";
          break;
        case "left_door_close":
          newState.leftDoorStatus = "关闭";
          break;
        case "left_door_stop":
          newState.leftDoorStatus = "停止";
          break;
        case "fan_level_0":
          newState.fanLevel = 0;
          break;
        case "fan_level_1":
          newState.fanLevel = 1;
          break;
        case "fan_level_2":
          newState.fanLevel = 2;
          break;
        case "light_mode_1":
          newState.lightMode = 1;
          break;
        case "light_mode_2":
          newState.lightMode = 2;
          break;
        case "light_mode_3":
          newState.lightMode = 3;
          break;
        case "light_mode_4":
          newState.lightMode = 4;
          break;
      }

      return newState;
    });
  };



  // 清空消息
  const clearMessages = () => {
    setMessages([]);
  };

  // 更新CAN命令配置
  const updateCanCommand = (
    commandId: string,
    field: keyof CanCommand,
    value: string
  ) => {
    setCanCommands((prev) =>
      prev.map((cmd) =>
        cmd.id === commandId ? { ...cmd, [field]: value } : cmd
      )
    );
  };

  return (
    <div className="h-screen bg-gray-100 flex overflow-hidden">
      {/* Left Sidebar */}
      <div className="w-64 bg-white shadow-lg flex flex-col">
        {/* Header */}
        <div className="p-4 border-b border-gray-200">
          <div className="flex items-center gap-3">
            <Settings className="w-6 h-6 text-blue-600" />
            <div>
              <h1 className="text-lg font-bold text-gray-900">
                USB-CAN工具
              </h1>
              <div className="flex items-center gap-2 mt-1">
                {isConnected ? (
                  <>
                    <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
                    <span className="text-xs text-green-600">已连接</span>
                  </>
                ) : (
                  <>
                    <div className="w-2 h-2 bg-red-500 rounded-full"></div>
                    <span className="text-xs text-red-600">未连接</span>
                  </>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Navigation */}
        <nav className="flex-1 p-4">
          <div className="space-y-2">
            <button
              onClick={() => setActiveTab("car")}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg font-medium transition-colors ${
                activeTab === "car"
                  ? "bg-blue-100 text-blue-700 border border-blue-200"
                  : "text-gray-600 hover:bg-gray-100 hover:text-gray-900"
              }`}
            >
              <Car className="w-5 h-5" />
              车辆控制
            </button>
            <button
              onClick={() => setActiveTab("config")}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg font-medium transition-colors ${
                activeTab === "config"
                  ? "bg-blue-100 text-blue-700 border border-blue-200"
                  : "text-gray-600 hover:bg-gray-100 hover:text-gray-900"
              }`}
            >
              <Wrench className="w-5 h-5" />
              CAN配置
            </button>
            <button
              onClick={() => setActiveTab("buttons")}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg font-medium transition-colors ${
                activeTab === "buttons"
                  ? "bg-blue-100 text-blue-700 border border-blue-200"
                  : "text-gray-600 hover:bg-gray-100 hover:text-gray-900"
              }`}
            >
              <Gamepad2 className="w-5 h-5" />
              按钮配置
            </button>
          </div>
        </nav>

        {/* Quick Connection Panel */}
        <div className="p-4 border-t border-gray-200">
          <div className="space-y-3">
            <div className="text-xs text-gray-500 font-medium">快速连接</div>
            <div className="flex items-center gap-2 text-xs">
              <span className="text-gray-600">端口:</span>
              <span className="font-mono bg-gray-100 px-2 py-1 rounded">{config.port}</span>
            </div>
            <button
              onClick={handleConnect}
              className={`w-full px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                isConnected
                  ? "bg-red-100 text-red-700 hover:bg-red-200"
                  : "bg-green-100 text-green-700 hover:bg-green-200"
              }`}
            >
              {isConnected ? (
                <>
                  <WifiOff className="w-4 h-4 inline mr-2" />
                  断开
                </>
              ) : (
                <>
                  <Wifi className="w-4 h-4 inline mr-2" />
                  连接
                </>
              )}
            </button>
          </div>
        </div>
      </div>

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
            onSendMessage={handleSendMessage}
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

// Car Control Tab Component
interface CarControlTabProps {
  isConnected: boolean;
  carStates: any;
  scene3DStatus: "loading" | "ready" | "error";
  onSendCommand: (commandId: string) => void;
}

function CarControlTab({
  isConnected,
  carStates,
  scene3DStatus,
  onSendCommand,
}: CarControlTabProps) {
  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      {/* Top Status Bar */}
      <div className="bg-white border-b border-gray-200 px-6 py-3">
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-semibold text-gray-900">车辆控制</h2>
          {!isConnected && (
            <div className="text-sm text-amber-600 bg-amber-50 px-3 py-1 rounded-full">
              请先在CAN配置页面连接设备
            </div>
          )}
        </div>
      </div>

      {/* Main Content Area */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left Panel - 3D Model and Video */}
        <div className="flex-1 flex flex-col bg-white border-r border-gray-200">
          {/* 3D Model Display */}
          <div className="flex-1 relative">
            <div id="car-3d-container" className="w-full h-full relative bg-gradient-to-br from-blue-50 to-indigo-100">
              <div className="loading-3d flex items-center justify-center h-full absolute inset-0 z-10">
                <div className="text-center">
                  <div className="w-16 h-16 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
                  <p className="text-gray-600 text-lg">3D模型加载中...</p>
                  <p className="text-gray-500 text-sm mt-2">
                    Three.js 3D车辆模型
                  </p>
                  <p className="text-gray-400 text-xs mt-2">
                    模型文件: Car.glb
                  </p>
                </div>
              </div>

              {/* 运镜控制面板 */}
              <div className="absolute top-4 left-4 flex flex-col gap-2 z-20">
                <button
                  className="bg-blue-600 hover:bg-blue-700 text-white p-2 rounded shadow-lg cursor-pointer transition-colors"
                  onClick={() => {
                    const renderer = (window as any).car3DRenderer;
                    if (renderer) {
                      renderer.setCameraAnimationMode('orbit', 10000);
                    }
                  }}
                  title="环绕运镜"
                >
                  🔄
                </button>
                <button
                  className="bg-green-600 hover:bg-green-700 text-white p-2 rounded shadow-lg cursor-pointer transition-colors"
                  onClick={() => {
                    const renderer = (window as any).car3DRenderer;
                    if (renderer) {
                      renderer.setCameraAnimationMode('showcase', 15000);
                    }
                  }}
                  title="展示运镜"
                >
                  📷
                </button>
                <button
                  className="bg-purple-600 hover:bg-purple-700 text-white p-2 rounded shadow-lg cursor-pointer transition-colors"
                  onClick={() => {
                    const renderer = (window as any).car3DRenderer;
                    if (renderer) {
                      renderer.setCameraAnimationMode('cinematic', 20000);
                    }
                  }}
                  title="电影运镜"
                >
                  🎬
                </button>
                <button
                  className="bg-red-600 hover:bg-red-700 text-white p-2 rounded shadow-lg cursor-pointer transition-colors"
                  onClick={() => {
                    const renderer = (window as any).car3DRenderer;
                    if (renderer) {
                      renderer.stopCameraAnimation();
                    }
                  }}
                  title="停止运镜"
                >
                  ⏹️
                </button>
              </div>

              {/* 门控制面板 */}
              <div className="absolute top-4 right-4 flex flex-col gap-2 z-20">
                <button
                  className="bg-orange-600 hover:bg-orange-700 text-white p-2 rounded shadow-lg cursor-pointer transition-colors"
                  onClick={() => {
                    const renderer = (window as any).car3DRenderer;
                    if (renderer) {
                      renderer.controlLeftDoor(1);
                    }
                  }}
                  title="开左门"
                >
                  🚪←
                </button>
                <button
                  className="bg-orange-600 hover:bg-orange-700 text-white p-2 rounded shadow-lg cursor-pointer transition-colors"
                  onClick={() => {
                    const renderer = (window as any).car3DRenderer;
                    if (renderer) {
                      renderer.controlLeftDoor(2);
                    }
                  }}
                  title="关左门"
                >
                  🚪→
                </button>
              </div>

              {/* 操作提示 */}
              <div className="absolute bottom-4 left-4 bg-black bg-opacity-70 text-white p-3 rounded text-sm max-w-xs z-20">
                <div className="text-xs space-y-1">
                  <div>🖱️ 拖拽旋转 | 🔄 滚轮缩放</div>
                  <div>� 点击蓝色按钮开关车门</div>
                </div>
              </div>
            </div>
          </div>

          {/* Video Display - Bottom */}
          <div className="h-48 bg-gray-50 border-t border-gray-200 p-4">
            <h3 className="text-sm font-semibold text-gray-700 mb-2">演示视频</h3>
            <div className="h-32 bg-gray-100 rounded flex items-center justify-center">
              <video
                controls
                muted
                loop
                className="w-full h-full rounded"
                poster="/car-assets/images/car-preview.jpg"
              >
                <source src="/car-assets/videos/car_demo.mp4" type="video/mp4" />
                您的浏览器不支持视频播放
              </video>
            </div>
          </div>
        </div>

        {/* Right Panel - Controls */}
        <div className="w-80 bg-white flex flex-col">
          {/* Status Panel */}
          <div className="p-4 border-b border-gray-200">
            <h3 className="text-lg font-semibold text-gray-800 mb-3">系统状态</h3>
            <div className="grid grid-cols-2 gap-3">
              <div className="bg-gray-50 p-3 rounded">
                <div className="text-xs text-gray-600">3D场景</div>
                <div className="text-sm font-semibold flex items-center gap-2">
                  {scene3DStatus === "loading" && (
                    <>
                      <div className="w-2 h-2 bg-yellow-500 rounded-full animate-pulse"></div>
                      <span className="text-yellow-700">加载中</span>
                    </>
                  )}
                  {scene3DStatus === "ready" && (
                    <>
                      <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                      <span className="text-green-700">就绪</span>
                    </>
                  )}
                  {scene3DStatus === "error" && (
                    <>
                      <div className="w-2 h-2 bg-red-500 rounded-full"></div>
                      <span className="text-red-700">错误</span>
                    </>
                  )}
                </div>
              </div>
              <div className="bg-gray-50 p-3 rounded">
                <div className="text-xs text-gray-600">行驶状态</div>
                <div className="text-sm font-semibold text-gray-900">
                  {carStates.isDriving ? "行驶中" : "停止"}
                </div>
              </div>
              <div className="bg-gray-50 p-3 rounded">
                <div className="text-xs text-gray-600">左门状态</div>
                <div className="text-sm font-semibold text-gray-900">
                  {carStates.leftDoorStatus}
                </div>
              </div>
              <div className="bg-gray-50 p-3 rounded">
                <div className="text-xs text-gray-600">风扇档位</div>
                <div className="text-sm font-semibold text-gray-900">
                  档位 {carStates.fanLevel}
                </div>
              </div>
              <div className="bg-gray-50 p-3 rounded">
                <div className="text-xs text-gray-600">灯带模式</div>
                <div className="text-sm font-semibold text-gray-900">
                  模式 {carStates.lightMode}
                </div>
              </div>
            </div>
          </div>

          {/* Control Panels */}
          <div className="flex-1 overflow-y-auto p-4 space-y-6">
            {/* Main Controls */}
            <div>
              <h4 className="text-sm font-semibold text-gray-700 mb-3">主要控制</h4>
              <div className="space-y-2">
                <button
                  onClick={() => onSendCommand("start_driving")}
                  disabled={!isConnected}
                  className="w-full px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 text-white rounded-md font-medium transition-colors cursor-pointer"
                >
                  <Play className="w-4 h-4 inline mr-2" />
                  开始行驶
                </button>
                <button
                  onClick={() => onSendCommand("update_data")}
                  disabled={!isConnected}
                  className="w-full px-4 py-2 bg-gray-600 hover:bg-gray-700 disabled:bg-gray-400 text-white rounded-md font-medium transition-colors cursor-pointer"
                >
                  数据更新
                </button>
              </div>
            </div>

            {/* Door Controls */}
            <div>
              <h4 className="text-sm font-semibold text-gray-700 mb-3">车门控制</h4>
              <div className="space-y-2">
                <button
                  onClick={() => onSendCommand("left_door_open")}
                  disabled={!isConnected}
                  className="w-full px-4 py-2 bg-green-600 hover:bg-green-700 disabled:bg-gray-400 text-white rounded-md transition-colors cursor-pointer"
                >
                  开门
                </button>
                <button
                  onClick={() => onSendCommand("left_door_close")}
                  disabled={!isConnected}
                  className="w-full px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 text-white rounded-md transition-colors cursor-pointer"
                >
                  关门
                </button>
                <button
                  onClick={() => onSendCommand("left_door_stop")}
                  disabled={!isConnected}
                  className="w-full px-4 py-2 bg-red-600 hover:bg-red-700 disabled:bg-gray-400 text-white rounded-md transition-colors cursor-pointer"
                >
                  停止
                </button>
              </div>
            </div>

            {/* Fan Controls */}
            <div>
              <h4 className="text-sm font-semibold text-gray-700 mb-3">风扇控制</h4>
              <div className="space-y-2">
                {[0, 1, 2].map((level) => (
                  <button
                    key={level}
                    onClick={() => onSendCommand(`fan_level_${level}`)}
                    disabled={!isConnected}
                    className={`w-full px-4 py-2 rounded-md transition-colors cursor-pointer ${
                      carStates.fanLevel === level
                        ? "bg-blue-600 text-white"
                        : "bg-gray-200 hover:bg-gray-300 text-gray-700"
                    } disabled:bg-gray-400 disabled:text-gray-600`}
                  >
                    档位 {level}
                  </button>
                ))}
              </div>
            </div>

            {/* Light Controls */}
            <div>
              <h4 className="text-sm font-semibold text-gray-700 mb-3">灯带控制</h4>
              <div className="space-y-2">
                {[1, 2, 3, 4].map((mode) => (
                  <button
                    key={mode}
                    onClick={() => onSendCommand(`light_mode_${mode}`)}
                    disabled={!isConnected}
                    className={`w-full px-4 py-2 rounded-md transition-colors cursor-pointer ${
                      carStates.lightMode === mode
                        ? "bg-yellow-500 text-white"
                        : "bg-gray-200 hover:bg-gray-300 text-gray-700"
                    } disabled:bg-gray-400 disabled:text-gray-600`}
                  >
                    模式 {mode}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// CAN Config Tab Component
interface CanConfigTabProps {
  isConnected: boolean;
  config: SerialConfig;
  availablePorts: string[];
  messages: CanMessage[];
  sendId: string;
  sendData: string;
  onConnect: () => void;
  onDisconnect: () => Promise<void>;
  onConfigChange: (config: SerialConfig) => void;
  onSendMessage: () => void;
  onClearMessages: () => void;
  onSendIdChange: (id: string) => void;
  onSendDataChange: (data: string) => void;
}

function CanConfigTab({
  isConnected,
  config,
  availablePorts: _availablePorts,
  messages,
  sendId,
  sendData,
  onConnect,
  onDisconnect: _onDisconnect,
  onConfigChange,
  onSendMessage,
  onClearMessages,
  onSendIdChange,
  onSendDataChange,
}: CanConfigTabProps) {
  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      {/* Top Status Bar */}
      <div className="bg-white border-b border-gray-200 px-6 py-3">
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-semibold text-gray-900">CAN配置</h2>
          <div className="flex items-center gap-4">
            <div className="text-sm text-gray-600">
              端口: <span className="font-mono bg-gray-100 px-2 py-1 rounded">{config.port}</span>
            </div>
            <div className="text-sm text-gray-600">
              波特率: <span className="font-mono bg-gray-100 px-2 py-1 rounded">{config.canBaudRate}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left Panel - Configuration */}
        <div className="w-80 bg-white border-r border-gray-200 flex flex-col">
          <div className="p-4 border-b border-gray-200">
            <h3 className="text-lg font-semibold text-gray-800 mb-3">连接配置</h3>

            <div className="space-y-3">
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">
                  串口
                </label>
                <input
                  type="text"
                  value={config.port}
                  onChange={(e) =>
                    onConfigChange({ ...config, port: e.target.value })
                  }
                  className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="COM22"
                  disabled={isConnected}
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">
                    串口波特率
                  </label>
                  <input
                    type="number"
                    value={config.baudRate}
                    onChange={(e) =>
                      onConfigChange({
                        ...config,
                        baudRate: parseInt(e.target.value) || 2000000,
                      })
                    }
                    className="w-full px-2 py-1 text-sm border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500"
                    disabled={isConnected}
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">
                    CAN波特率
                  </label>
                  <input
                    type="number"
                    value={config.canBaudRate}
                    onChange={(e) =>
                      onConfigChange({
                        ...config,
                        canBaudRate: parseInt(e.target.value) || 2000000,
                      })
                    }
                    className="w-full px-2 py-1 text-sm border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500"
                    disabled={isConnected}
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">
                    帧类型
                  </label>
                  <select
                    value={config.frameType}
                    onChange={(e) =>
                      onConfigChange({ ...config, frameType: e.target.value })
                    }
                    className="w-full px-2 py-1 text-sm border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500"
                    disabled={isConnected}
                  >
                    <option value="standard">标准帧</option>
                    <option value="extended">扩展帧</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">
                    CAN模式
                  </label>
                  <select
                    value={config.canMode}
                    onChange={(e) =>
                      onConfigChange({ ...config, canMode: e.target.value })
                    }
                    className="w-full px-2 py-1 text-sm border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500"
                    disabled={isConnected}
                  >
                    <option value="normal">正常模式</option>
                    <option value="loopback">回环模式</option>
                    <option value="listen">监听模式</option>
                  </select>
                </div>
              </div>

              <button
                onClick={onConnect}
                className={`w-full px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                  isConnected
                    ? "bg-red-600 hover:bg-red-700 text-white"
                    : "bg-green-600 hover:bg-green-700 text-white"
                }`}
              >
                {isConnected ? (
                  <>
                    <WifiOff className="w-4 h-4 inline mr-2" />
                    断开连接
                  </>
                ) : (
                  <>
                    <Wifi className="w-4 h-4 inline mr-2" />
                    连接
                  </>
                )}
              </button>
            </div>
          </div>

          {/* Send Panel */}
          <div className="p-4 border-b border-gray-200">
            <h3 className="text-lg font-semibold text-gray-800 mb-3">发送消息</h3>
            <div className="space-y-3">
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">
                  CAN ID (十六进制)
                </label>
                <input
                  type="text"
                  value={sendId}
                  onChange={(e) => onSendIdChange(e.target.value)}
                  className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="123"
                  disabled={!isConnected}
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">
                  数据 (十六进制，空格分隔)
                </label>
                <input
                  type="text"
                  value={sendData}
                  onChange={(e) => onSendDataChange(e.target.value)}
                  className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="01 02 03 04"
                  disabled={!isConnected}
                />
              </div>

              <button
                onClick={onSendMessage}
                disabled={!isConnected}
                className="w-full px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 text-white rounded-md text-sm font-medium transition-colors cursor-pointer"
              >
                <Send className="w-4 h-4 inline mr-2" />
                发送消息
              </button>

              <button
                onClick={onClearMessages}
                className="w-full px-3 py-2 bg-gray-600 hover:bg-gray-700 text-white rounded-md text-sm font-medium transition-colors"
              >
                <Trash2 className="w-4 h-4 inline mr-2" />
                清空消息
              </button>
            </div>
          </div>


        </div>

        {/* Right Panel - Messages Display */}
        <div className="flex-1 bg-white flex flex-col">
          {/* Messages Header */}
          <div className="p-4 border-b border-gray-200">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold text-gray-800">消息记录</h3>
              <div className="text-sm text-gray-500">
                共 {messages.length} 条消息
              </div>
            </div>
          </div>

          {/* Messages Content */}
          <div className="flex-1 overflow-y-auto p-4 bg-gray-50">
            {messages.length === 0 ? (
              <div className="flex items-center justify-center h-full">
                <div className="text-center text-gray-500">
                  <MessageSquare className="w-12 h-12 mx-auto mb-3 opacity-50" />
                  <p className="text-lg">暂无消息</p>
                  <p className="text-sm mt-1">发送消息或开始接收以查看数据</p>
                </div>
              </div>
            ) : (
              <div className="space-y-2">
                {messages.slice().reverse().map((message, index) => (
                  <div
                    key={messages.length - 1 - index}
                    className={`p-4 rounded-lg shadow-sm ${
                      message.direction === "sent"
                        ? "bg-blue-50 border-l-4 border-blue-500"
                        : "bg-green-50 border-l-4 border-green-500"
                    }`}
                  >
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <span className={`px-2 py-1 rounded text-xs font-medium ${
                          message.direction === "sent"
                            ? "bg-blue-100 text-blue-700"
                            : "bg-green-100 text-green-700"
                        }`}>
                          {message.direction === "sent" ? "发送" : "接收"}
                        </span>
                        <span className={`px-2 py-1 rounded text-xs ${
                          message.frameType === "extended"
                            ? "bg-purple-100 text-purple-700"
                            : "bg-gray-100 text-gray-700"
                        }`}>
                          {message.frameType === "extended" ? "扩展帧" : "标准帧"}
                        </span>
                      </div>
                      <span className="text-xs text-gray-500 font-mono">
                        {message.timestamp}
                      </span>
                    </div>
                    <div className="font-mono text-sm">
                      <div className="flex items-center gap-4">
                        <div>
                          <span className="text-gray-600 text-xs">ID:</span>
                          <span className="ml-1 font-semibold">{message.id}</span>
                        </div>
                        <div className="flex-1">
                          <span className="text-gray-600 text-xs">Data:</span>
                          <span className="ml-1 font-semibold">{message.data}</span>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// Button Config Tab Component
interface ButtonConfigTabProps {
  canCommands: CanCommand[];
  onUpdateCanCommand: (
    commandId: string,
    field: keyof CanCommand,
    value: string
  ) => void;
}

function ButtonConfigTab({
  canCommands,
  onUpdateCanCommand,
}: ButtonConfigTabProps) {
  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      {/* Top Status Bar */}
      <div className="bg-white border-b border-gray-200 px-6 py-3">
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-semibold text-gray-900">按钮配置</h2>
          <div className="text-sm text-gray-600">
            共 {canCommands.length} 个命令按钮
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 overflow-y-auto p-6 bg-gray-50">
        <div className="max-w-4xl mx-auto">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {canCommands.map((command) => (
              <div
                key={command.id}
                className="bg-white rounded-lg shadow-sm border border-gray-200 p-4"
              >
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      命令名称
                    </label>
                    <input
                      type="text"
                      value={command.name}
                      onChange={(e) =>
                        onUpdateCanCommand(command.id, "name", e.target.value)
                      }
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                      placeholder="输入命令名称"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        CAN ID
                      </label>
                      <input
                        type="text"
                        value={command.canId}
                        onChange={(e) =>
                          onUpdateCanCommand(command.id, "canId", e.target.value)
                        }
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm font-mono"
                        placeholder="123"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        数据
                      </label>
                      <input
                        type="text"
                        value={command.data}
                        onChange={(e) =>
                          onUpdateCanCommand(command.id, "data", e.target.value)
                        }
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm font-mono"
                        placeholder="01 02"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      描述
                    </label>
                    <textarea
                      value={command.description}
                      onChange={(e) =>
                        onUpdateCanCommand(
                          command.id,
                          "description",
                          e.target.value
                        )
                      }
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm resize-none"
                      placeholder="输入命令描述"
                      rows={2}
                    />
                  </div>

                  {/* Preview */}
                  <div className="pt-3 border-t border-gray-200">
                    <div className="text-xs text-gray-500 mb-2">预览效果:</div>
                    <button
                      disabled
                      className="w-full px-3 py-2 bg-blue-100 text-blue-700 rounded-md text-sm font-medium cursor-not-allowed"
                    >
                      {command.name || "未命名按钮"}
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Help Text */}
          <div className="mt-8 bg-blue-50 border border-blue-200 rounded-lg p-4">
            <h3 className="text-sm font-semibold text-blue-800 mb-2">💡 配置说明</h3>
            <div className="text-sm text-blue-700 space-y-1">
              <p>• <strong>命令名称</strong>：将显示在车辆控制页面的按钮上</p>
              <p>• <strong>CAN ID</strong>：十六进制格式，如 123、1A2B</p>
              <p>• <strong>数据</strong>：十六进制格式，空格分隔，如 01 02 03</p>
              <p>• <strong>描述</strong>：命令的详细说明，便于理解功能</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default App;
