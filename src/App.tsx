import { useState, useEffect } from "react";
import { invoke } from "@tauri-apps/api/core";
import {
  Settings,
  Play,
  Square,
  Send,
  Trash2,
  Wifi,
  WifiOff,
  AlertCircle,
  CheckCircle,
  Car,
  Wrench,
  MessageSquare,
} from "lucide-react";
// import Car3DViewer from "./components/Car3DViewer";

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
  const [activeTab, setActiveTab] = useState<"car" | "config">("car");
  const [isConnected, setIsConnected] = useState(false);
  const [isReceiving, setIsReceiving] = useState(false);
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

  // 初始化3D场景
  useEffect(() => {
    // 防止重复初始化
    if ((window as any).car3DRenderer) {
      console.log("Car3DRenderer already initialized, skipping...");
      return;
    }

    let car3DRenderer: any = null;
    let retryCount = 0;
    const maxRetries = 10;

    const init3DScene = () => {
      console.log(`Attempting to initialize 3D scene... (attempt ${retryCount + 1}/${maxRetries})`);

      // 再次检查是否已经初始化
      if ((window as any).car3DRenderer) {
        console.log("Car3DRenderer already exists, aborting initialization");
        return;
      }

      // 检查Three.js库和Car3DRenderer类是否加载
      const THREE = (window as any).THREE;
      const Car3DRenderer = (window as any).Car3DRenderer;

      if (
        !THREE ||
        !THREE.GLTFLoader ||
        !THREE.OrbitControls ||
        !Car3DRenderer
      ) {
        console.log("Three.js libraries or Car3DRenderer not loaded yet, retrying...");
        console.log("THREE:", !!THREE);
        console.log("GLTFLoader:", !!(THREE && THREE.GLTFLoader));
        console.log("OrbitControls:", !!(THREE && THREE.OrbitControls));
        console.log("Car3DRenderer:", !!Car3DRenderer);

        retryCount++;
        if (retryCount < maxRetries) {
          setTimeout(init3DScene, 1000);
        } else {
          console.error("Failed to load Three.js libraries or Car3DRenderer after maximum retries");
          const container = document.getElementById("car-3d-container");
          if (container) {
            container.innerHTML = `
              <div class="flex items-center justify-center h-full">
                <div class="text-center">
                  <p class="text-red-600 text-lg">3D库加载失败</p>
                  <p class="text-gray-500 text-sm mt-2">请检查网络连接或刷新页面</p>
                  <button onclick="location.reload()" class="mt-2 px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700">重新加载</button>
                </div>
              </div>
            `;
          }
        }
        return;
      }

      const container = document.getElementById("car-3d-container");
      if (!container) {
        console.log("Container not found, retrying...");
        setTimeout(init3DScene, 500);
        return;
      }

      // 清空容器，防止重复内容
      container.innerHTML = `
        <div class="loading-3d flex items-center justify-center h-full absolute inset-0 z-10">
          <div class="text-center">
            <div class="w-16 h-16 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
            <p class="text-gray-600 text-lg">3D模型加载中...</p>
            <p class="text-gray-500 text-sm mt-2">Three.js 3D车辆模型</p>
            <p class="text-gray-400 text-xs mt-2">模型文件: Car.glb</p>
          </div>
        </div>
      `;

      console.log("Initializing Car3DRenderer...");

      try {
        // 使用Car3DRenderer类初始化3D场景
        car3DRenderer = new Car3DRenderer("car-3d-container");
        // 将渲染器保存到全局变量，以便按钮可以访问
        (window as any).car3DRenderer = car3DRenderer;
        console.log("Car3DRenderer initialized successfully");

        // 监听模型加载完成事件
        const handleModelLoaded = () => {
          console.log("Car 3D model loaded successfully!");
          // 检查门按钮状态
          setTimeout(() => {
            if (car3DRenderer) {
              console.log("检查门按钮状态:", {
                leftButton: !!car3DRenderer.doorButtons?.leftDoor,
                rightButton: !!car3DRenderer.doorButtons?.rightDoor,
                clickableObjects: car3DRenderer.clickableObjects?.length || 0
              });
            }
          }, 1000);
        };
        document.addEventListener('car3dLoaded', handleModelLoaded);

        return () => {
          document.removeEventListener('car3dLoaded', handleModelLoaded);
          if (car3DRenderer) {
            // 清理3D渲染器资源
            console.log("Cleaning up Car3DRenderer");
            // 清理全局引用
            (window as any).car3DRenderer = null;
          }
        };
      } catch (error) {
        console.error("Failed to initialize Car3DRenderer:", error);
        const container = document.getElementById("car-3d-container");
        if (container) {
          container.innerHTML = `
            <div class="flex items-center justify-center h-full">
              <div class="text-center">
                <p class="text-red-600 text-lg">3D渲染器初始化失败</p>
                <p class="text-gray-500 text-sm mt-2">${(error as Error).message || '未知错误'}</p>
                <button onclick="location.reload()" class="mt-2 px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700">重新加载</button>
              </div>
            </div>
          `;
        }
      }
    };

    const cleanup = init3DScene();

    return () => {
      // 清理全局Car3DRenderer引用
      if ((window as any).car3DRenderer) {
        console.log("Cleaning up global Car3DRenderer reference");
        (window as any).car3DRenderer = null;
      }
      // 执行其他清理函数
      if (cleanup && typeof cleanup === 'function') {
        cleanup();
      }
    };
  }, []);

  // 连接/断开串口
  const handleConnect = async () => {
    try {
      if (isConnected) {
        await invoke("disconnect_serial");
        setIsConnected(false);
        setIsReceiving(false);
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
      setIsReceiving(false);
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

  // 控制接收
  const handleReceiving = async () => {
    try {
      if (isReceiving) {
        await invoke("stop_receiving");
        setIsReceiving(false);
      } else {
        await invoke("start_receiving");
        setIsReceiving(true);
      }
    } catch (error) {
      console.error("Receiving control error:", error);
      alert(`接收控制错误: ${error}`);
    }
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
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="bg-white rounded-lg shadow-md p-6 mb-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Settings className="w-8 h-8 text-blue-600" />
              <h1 className="text-3xl font-bold text-gray-900">
                智能小车控制系统
              </h1>
            </div>
            <div className="flex items-center gap-2">
              {isConnected ? (
                <CheckCircle className="w-5 h-5 text-green-500" />
              ) : (
                <AlertCircle className="w-5 h-5 text-red-500" />
              )}
              <span className="text-sm text-gray-600">
                {isConnected ? "已连接" : "未连接"}
              </span>
            </div>
          </div>
        </div>

        {/* Tab Navigation */}
        <div className="bg-white rounded-lg shadow-md mb-6">
          <div className="flex border-b border-gray-200">
            <button
              onClick={() => setActiveTab("car")}
              className={`flex items-center gap-2 px-6 py-4 font-medium transition-colors ${
                activeTab === "car"
                  ? "text-blue-600 border-b-2 border-blue-600"
                  : "text-gray-500 hover:text-gray-700"
              }`}
            >
              <Car className="w-5 h-5" />
              车辆控制
            </button>
            <button
              onClick={() => setActiveTab("config")}
              className={`flex items-center gap-2 px-6 py-4 font-medium transition-colors ${
                activeTab === "config"
                  ? "text-blue-600 border-b-2 border-blue-600"
                  : "text-gray-500 hover:text-gray-700"
              }`}
            >
              <Wrench className="w-5 h-5" />
              CAN配置
            </button>
          </div>
        </div>

        {/* Tab Content */}
        {activeTab === "car" && (
          <CarControlTab
            isConnected={isConnected}
            carStates={carStates}
            onSendCommand={sendCarCommand}
          />
        )}

        {activeTab === "config" && (
          <CanConfigTab
            isConnected={isConnected}
            config={config}
            availablePorts={availablePorts}
            canCommands={canCommands}
            messages={messages}
            sendId={sendId}
            sendData={sendData}
            isReceiving={isReceiving}
            onConnect={handleConnect}
            onDisconnect={handleDisconnect}
            onConfigChange={setConfig}
            onSendMessage={handleSendMessage}
            onReceivingToggle={handleReceiving}
            onClearMessages={clearMessages}
            onSendIdChange={setSendId}
            onSendDataChange={setSendData}
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
  onSendCommand: (commandId: string) => void;
}

function CarControlTab({
  isConnected,
  carStates,
  onSendCommand,
}: CarControlTabProps) {
  return (
    <div className="space-y-6">
      {/* Connection Status */}
      <div className="bg-white rounded-lg shadow-md p-4">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-semibold text-gray-800">连接状态</h3>
          <div className="flex items-center gap-2">
            {isConnected ? (
              <>
                <div className="w-3 h-3 bg-green-500 rounded-full animate-pulse"></div>
                <span className="text-green-600 font-medium">已连接</span>
                <CheckCircle className="w-5 h-5 text-green-600" />
              </>
            ) : (
              <>
                <div className="w-3 h-3 bg-red-500 rounded-full"></div>
                <span className="text-red-600 font-medium">未连接</span>
                <AlertCircle className="w-5 h-5 text-red-600" />
              </>
            )}
          </div>
        </div>
        {!isConnected && (
          <p className="text-sm text-gray-600 mt-2">
            请在"CAN配置"标签页中配置并连接设备
          </p>
        )}
      </div>

      {/* 3D Model and Video Display */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Video Display */}
        <div className="bg-white rounded-lg shadow-md p-6">
          <h3 className="text-xl font-semibold text-gray-800 mb-4">演示视频</h3>
          <div className="aspect-video bg-gray-100 rounded-lg flex items-center justify-center">
            <video
              controls
              muted
              loop
              className="w-full h-full rounded-lg"
              poster="/car-assets/images/car-preview.jpg"
            >
              <source src="/car-assets/videos/car_demo.mp4" type="video/mp4" />
              您的浏览器不支持视频播放
            </video>
          </div>
        </div>

        {/* 3D Model Display */}
        <div className="bg-white rounded-lg shadow-md p-6">
          <h3 className="text-xl font-semibold text-gray-800 mb-4">
            3D车辆模型
          </h3>
          <div className="aspect-video bg-gray-100 rounded-lg relative">
            <div id="car-3d-container" className="w-full h-full rounded-lg relative">
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

              {/* 使用说明面板 */}
              <div className="absolute bottom-2 left-2 bg-black bg-opacity-70 text-white p-3 rounded text-xs max-w-xs z-20">
                <h4 className="font-semibold mb-2">🚗 3D交互说明</h4>
                <ul className="space-y-1 text-xs">
                  <li>🖱️ 拖拽：旋转视角</li>
                  <li>🔄 滚轮：缩放模型</li>
                  <li>🔵 点击蓝色按钮：开关车门</li>
                  <li>✨ 悬停按钮：高亮效果</li>
                </ul>
                <p className="mt-2 text-yellow-300 text-xs">
                  💡 在车门外侧寻找蓝色圆形按钮
                </p>
              </div>

              {/* 运镜控制面板 */}
              <div className="absolute top-2 left-2 flex flex-col gap-1 z-20">
                <button
                  className="bg-blue-600 hover:bg-blue-700 text-white p-2 rounded text-xs shadow-lg cursor-pointer transition-colors"
                  onClick={() => {
                    console.log("环绕运镜按钮被点击");
                    const renderer = (window as any).car3DRenderer;
                    if (renderer) {
                      console.log("调用setCameraAnimationMode('orbit', 10000)");
                      renderer.setCameraAnimationMode('orbit', 10000);
                    } else {
                      console.log("Car3DRenderer未找到");
                    }
                  }}
                  title="环绕运镜"
                >
                  🔄
                </button>
                <button
                  className="bg-green-600 hover:bg-green-700 text-white p-2 rounded text-xs shadow-lg cursor-pointer transition-colors"
                  onClick={() => {
                    console.log("展示运镜按钮被点击");
                    const renderer = (window as any).car3DRenderer;
                    if (renderer) {
                      console.log("调用setCameraAnimationMode('showcase', 15000)");
                      renderer.setCameraAnimationMode('showcase', 15000);
                    } else {
                      console.log("Car3DRenderer未找到");
                    }
                  }}
                  title="展示运镜"
                >
                  📷
                </button>
                <button
                  className="bg-purple-600 hover:bg-purple-700 text-white p-2 rounded text-xs shadow-lg cursor-pointer transition-colors"
                  onClick={() => {
                    console.log("电影运镜按钮被点击");
                    const renderer = (window as any).car3DRenderer;
                    if (renderer) {
                      console.log("调用setCameraAnimationMode('cinematic', 20000)");
                      renderer.setCameraAnimationMode('cinematic', 20000);
                    } else {
                      console.log("Car3DRenderer未找到");
                    }
                  }}
                  title="电影运镜"
                >
                  🎬
                </button>
                <button
                  className="bg-red-600 hover:bg-red-700 text-white p-2 rounded text-xs shadow-lg cursor-pointer transition-colors"
                  onClick={() => {
                    console.log("停止运镜按钮被点击");
                    const renderer = (window as any).car3DRenderer;
                    if (renderer) {
                      console.log("调用stopCameraAnimation()");
                      renderer.stopCameraAnimation();
                    } else {
                      console.log("Car3DRenderer未找到");
                    }
                  }}
                  title="停止运镜"
                >
                  ⏹️
                </button>
              </div>

              {/* 门控制面板 */}
              <div className="absolute top-2 right-2 flex flex-col gap-1 z-20">
                <button
                  className="bg-orange-600 hover:bg-orange-700 text-white p-2 rounded text-xs shadow-lg cursor-pointer transition-colors"
                  onClick={() => {
                    console.log("开左门按钮被点击");
                    const renderer = (window as any).car3DRenderer;
                    if (renderer) {
                      console.log("调用controlLeftDoor(1)");
                      renderer.controlLeftDoor(1);
                    } else {
                      console.log("Car3DRenderer未找到");
                    }
                  }}
                  title="开左门"
                >
                  🚪←
                </button>
                <button
                  className="bg-orange-600 hover:bg-orange-700 text-white p-2 rounded text-xs shadow-lg cursor-pointer transition-colors"
                  onClick={() => {
                    console.log("关左门按钮被点击");
                    const renderer = (window as any).car3DRenderer;
                    if (renderer) {
                      console.log("调用controlLeftDoor(2)");
                      renderer.controlLeftDoor(2);
                    } else {
                      console.log("Car3DRenderer未找到");
                    }
                  }}
                  title="关左门"
                >
                  🚪→
                </button>
              </div>

              <div className="absolute bottom-2 right-2 text-xs text-gray-500 bg-white px-2 py-1 rounded shadow-lg z-20">
                拖拽旋转 | 滚轮缩放
              </div>
            </div>


          </div>
        </div>
      </div>

      {/* Car Control Panel */}
      <div className="bg-white rounded-lg shadow-md p-6">
        <h3 className="text-xl font-semibold text-gray-800 mb-6">
          车辆控制面板
        </h3>

        {/* Main Controls */}
        <div className="mb-8">
          <h4 className="text-lg font-medium text-gray-700 mb-4">主要控制</h4>
          <div className="flex gap-4">
            <button
              onClick={() => onSendCommand("start_driving")}
              disabled={false}
              className="px-6 py-3 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 text-white rounded-md font-medium transition-colors cursor-pointer"
            >
              <Play className="w-4 h-4 inline mr-2" />
              开始行驶
            </button>
            <button
              onClick={() => onSendCommand("update_data")}
              disabled={false}
              className="px-6 py-3 bg-gray-600 hover:bg-gray-700 disabled:bg-gray-400 text-white rounded-md font-medium transition-colors cursor-pointer"
            >
              数据更新
            </button>
          </div>
        </div>

        {/* Door Controls */}
        <div className="mb-8">
          <h4 className="text-lg font-medium text-gray-700 mb-4">车门控制</h4>
          <div className="flex gap-4">
            <button
              onClick={() => onSendCommand("left_door_open")}
              disabled={false}
              className="px-4 py-2 bg-green-600 hover:bg-green-700 disabled:bg-gray-400 text-white rounded-md transition-colors cursor-pointer"
            >
              开门
            </button>
            <button
              onClick={() => onSendCommand("left_door_close")}
              disabled={false}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 text-white rounded-md transition-colors cursor-pointer"
            >
              关门
            </button>
            <button
              onClick={() => onSendCommand("left_door_stop")}
              disabled={false}
              className="px-4 py-2 bg-red-600 hover:bg-red-700 disabled:bg-gray-400 text-white rounded-md transition-colors cursor-pointer"
            >
              停止
            </button>
          </div>
        </div>

        {/* Fan and Light Controls */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div>
            <h4 className="text-lg font-medium text-gray-700 mb-4">风扇控制</h4>
            <div className="space-y-2">
              {[0, 1, 2].map((level) => (
                <button
                  key={level}
                  onClick={() => onSendCommand(`fan_level_${level}`)}
                  disabled={false}
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

          <div>
            <h4 className="text-lg font-medium text-gray-700 mb-4">灯带控制</h4>
            <div className="space-y-2">
              {[1, 2, 3, 4].map((mode) => (
                <button
                  key={mode}
                  onClick={() => onSendCommand(`light_mode_${mode}`)}
                  disabled={false}
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

      {/* Status Panel */}
      <div className="bg-white rounded-lg shadow-md p-6">
        <h3 className="text-xl font-semibold text-gray-800 mb-4">系统状态</h3>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="bg-gray-50 p-4 rounded-lg">
            <label className="block text-sm font-medium text-gray-600">
              行驶状态
            </label>
            <span className="text-lg font-semibold text-gray-900">
              {carStates.isDriving ? "行驶中" : "停止"}
            </span>
          </div>
          <div className="bg-gray-50 p-4 rounded-lg">
            <label className="block text-sm font-medium text-gray-600">
              左门状态
            </label>
            <span className="text-lg font-semibold text-gray-900">
              {carStates.leftDoorStatus}
            </span>
          </div>
          <div className="bg-gray-50 p-4 rounded-lg">
            <label className="block text-sm font-medium text-gray-600">
              风扇档位
            </label>
            <span className="text-lg font-semibold text-gray-900">
              档位 {carStates.fanLevel}
            </span>
          </div>
          <div className="bg-gray-50 p-4 rounded-lg">
            <label className="block text-sm font-medium text-gray-600">
              灯带模式
            </label>
            <span className="text-lg font-semibold text-gray-900">
              模式 {carStates.lightMode}
            </span>
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
  canCommands: CanCommand[];
  messages: CanMessage[];
  sendId: string;
  sendData: string;
  isReceiving: boolean;
  onConnect: () => void;
  onDisconnect: () => Promise<void>;
  onConfigChange: (config: SerialConfig) => void;
  onSendMessage: () => void;
  onReceivingToggle: () => void;
  onClearMessages: () => void;
  onSendIdChange: (id: string) => void;
  onSendDataChange: (data: string) => void;
  onUpdateCanCommand: (
    commandId: string,
    field: keyof CanCommand,
    value: string
  ) => void;
}

function CanConfigTab({
  isConnected,
  config,
  availablePorts: _availablePorts,
  canCommands,
  messages,
  sendId,
  sendData,
  isReceiving,
  onConnect,
  onDisconnect,
  onConfigChange,
  onSendMessage,
  onReceivingToggle,
  onClearMessages,
  onSendIdChange,
  onSendDataChange,
  onUpdateCanCommand,
}: CanConfigTabProps) {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      {/* Configuration Panel */}
      <div className="space-y-6">
        <div className="bg-white rounded-lg shadow-md p-6">
          <h3 className="text-xl font-semibold text-gray-800 mb-4">连接配置</h3>

          {/* 回环测试模式选择 */}
          <div className="mb-6 p-4 bg-gray-50 rounded-lg">
            <div className="flex items-center mb-3">
              <input
                type="checkbox"
                id="loopbackTest"
                checked={config.isLoopbackTest}
                onChange={(e) =>
                  onConfigChange({ ...config, isLoopbackTest: e.target.checked })
                }
                className="mr-2"
                disabled={isConnected}
              />
              <label htmlFor="loopbackTest" className="text-sm font-medium text-gray-700">
                启用双设备回环测试模式
              </label>
            </div>
            <p className="text-xs text-gray-500 mb-2">
              {config.isLoopbackTest
                ? "🔄 双设备模式：使用两个USB-CAN设备进行回环测试"
                : "📡 单设备模式：使用一个USB-CAN设备进行回环测试"}
            </p>
            <div className="text-xs text-blue-600 bg-blue-50 p-2 rounded">
              💡 <strong>单设备回环测试</strong>：适用于只有一个USB-CAN设备的情况，通过设置设备为回环模式来验证功能是否正常。
            </div>
          </div>

          <div className="space-y-4">
            {/* 根据模式显示不同的串口配置 */}
            {config.isLoopbackTest ? (
              // 回环测试模式：显示两个串口
              <>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    发送端口 (Port 1)
                  </label>
                  <input
                    type="text"
                    value={config.loopbackPort1}
                    onChange={(e) =>
                      onConfigChange({ ...config, loopbackPort1: e.target.value })
                    }
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="COM22"
                    disabled={isConnected}
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    接收端口 (Port 2)
                  </label>
                  <input
                    type="text"
                    value={config.loopbackPort2}
                    onChange={(e) =>
                      onConfigChange({ ...config, loopbackPort2: e.target.value })
                    }
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="COM23"
                    disabled={isConnected}
                  />
                </div>
              </>
            ) : (
              // 普通模式：显示单个串口
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  串口
                </label>
                <input
                  type="text"
                  value={config.port}
                  onChange={(e) =>
                    onConfigChange({ ...config, port: e.target.value })
                  }
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="COM22"
                  disabled={isConnected}
                />
              </div>
            )}

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
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
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="2000000"
                disabled={isConnected}
              />
              <p className="text-xs text-gray-500 mt-1">电脑与USB-CAN设备间的通信速度</p>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
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
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="2000000"
                disabled={isConnected}
              />
              <p className="text-xs text-gray-500 mt-1">CAN总线上的通信速度</p>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                帧类型
              </label>
              <select
                value={config.frameType}
                onChange={(e) =>
                  onConfigChange({ ...config, frameType: e.target.value })
                }
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                disabled={isConnected}
              >
                <option value="standard">标准帧</option>
                <option value="extended">扩展帧</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                CAN模式
              </label>
              <select
                value={config.canMode}
                onChange={(e) =>
                  onConfigChange({ ...config, canMode: e.target.value })
                }
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                disabled={isConnected}
              >
                <option value="normal">正常模式</option>
                <option value="loopback">回环模式</option>
                <option value="listen">监听模式</option>
              </select>
            </div>

            <button
              onClick={onConnect}
              className={`w-full px-4 py-2 rounded-md font-medium transition-colors ${
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
        <div className="bg-white rounded-lg shadow-md p-6">
          <h3 className="text-xl font-semibold text-gray-800 mb-4">发送消息</h3>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                CAN ID (十六进制)
              </label>
              <input
                type="text"
                value={sendId}
                onChange={(e) => onSendIdChange(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="123"
                disabled={false}
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                数据 (十六进制，空格分隔)
              </label>
              <input
                type="text"
                value={sendData}
                onChange={(e) => onSendDataChange(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="01 02 03 04"
                disabled={false}
              />
            </div>

            <button
              onClick={onSendMessage}
              disabled={false}
              className="w-full px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 text-white rounded-md font-medium transition-colors cursor-pointer"
            >
              <Send className="w-4 h-4 inline mr-2" />
              发送消息
            </button>

            {/* 参数测试按钮 */}
            <button
              onClick={async () => {
                try {
                  console.log("测试参数传递");
                  const result = await invoke("test_params", {
                    testId: sendId,
                    testData: sendData,
                  });
                  alert(`参数测试成功！\n${result}`);
                } catch (error) {
                  console.error("参数测试失败:", error);
                  alert(`参数测试失败：${error}`);
                }
              }}
              className="w-full px-4 py-2 bg-orange-600 hover:bg-orange-700 text-white rounded-md font-medium transition-colors cursor-pointer"
            >
              测试参数传递
            </button>

            {/* 回环测试说明 */}
            <div className="mb-4 p-3 bg-blue-50 border border-blue-200 rounded-lg">
              <h4 className="text-sm font-semibold text-blue-800 mb-2">🔍 回环测试说明</h4>
              <div className="text-xs text-blue-700 space-y-1">
                <p><strong>单设备回环测试</strong>：验证单个USB-CAN设备功能</p>
                <p>• 自动设置设备为回环模式</p>
                <p>• 发送数据并检查是否能接收到相同数据</p>
                <p>• 适用于只有一个USB-CAN设备的情况</p>
                <p className="text-blue-600 mt-2">💡 如果通电瞬间TX/RX灯闪烁，说明波特率正确</p>
              </div>
            </div>

            {/* 单设备回环测试按钮 */}
            <button
              onClick={async () => {
                try {
                  console.log("开始单设备回环测试");
                  console.log("测试端口:", config.port);

                  // 如果当前已连接，先断开连接以释放端口
                  if (isConnected) {
                    console.log("断开当前连接以释放端口...");
                    await onDisconnect();
                    // 等待端口释放
                    await new Promise(resolve => setTimeout(resolve, 500));
                  }

                  // 调用Rust后端的单设备回环测试命令
                  const result = await invoke("start_loopback_test", {
                    config: {
                      port: config.port,
                      baud_rate: config.baudRate,
                      can_baud_rate: config.canBaudRate,
                      frame_type: config.frameType,
                      can_mode: "loopback", // 强制设置为回环模式
                      is_loopback_test: false, // 单设备测试
                      loopback_port1: config.port,
                      loopback_port2: config.port,
                    },
                    testId: sendId,
                    testData: sendData,
                  });

                  alert(`单设备回环测试结果：\n${result}`);
                  console.log("单设备回环测试结果:", result);
                } catch (error) {
                  console.error("单设备回环测试失败:", error);
                  alert(`单设备回环测试失败：${error}`);
                }
              }}
              disabled={false}
              className="w-full px-4 py-2 bg-green-600 hover:bg-green-700 disabled:bg-gray-400 text-white rounded-md font-medium transition-colors cursor-pointer"
            >
              <MessageSquare className="w-4 h-4 inline mr-2" />
              单设备回环测试
            </button>

            {/* 双设备回环测试按钮 */}
            {config.isLoopbackTest && (
              <button
                onClick={async () => {
                  try {
                    console.log("开始双设备回环测试");
                    console.log("发送端口:", config.loopbackPort1);
                    console.log("接收端口:", config.loopbackPort2);

                    // 如果当前已连接，先断开连接以释放端口
                    if (isConnected) {
                      console.log("断开当前连接以释放端口...");
                      await onDisconnect();
                      // 等待端口释放
                      await new Promise(resolve => setTimeout(resolve, 500));
                    }

                    // 调用Rust后端的双设备回环测试命令
                    const result = await invoke("start_loopback_test", {
                      config: {
                        port: config.port,
                        baud_rate: config.baudRate,
                        can_baud_rate: config.canBaudRate,
                        frame_type: config.frameType,
                        can_mode: config.canMode,
                        is_loopback_test: config.isLoopbackTest,
                        loopback_port1: config.loopbackPort1,
                        loopback_port2: config.loopbackPort2,
                      },
                      testId: sendId,
                      testData: sendData,
                    });

                    alert(`双设备回环测试结果：\n${result}`);
                    console.log("双设备回环测试结果:", result);
                  } catch (error) {
                    console.error("双设备回环测试失败:", error);
                    alert(`双设备回环测试失败：${error}`);
                  }
                }}
                disabled={false}
                className="w-full px-4 py-2 bg-purple-600 hover:bg-purple-700 disabled:bg-gray-400 text-white rounded-md font-medium transition-colors cursor-pointer"
              >
                <MessageSquare className="w-4 h-4 inline mr-2" />
                双设备回环测试
              </button>
            )}

            <div className="flex gap-2">
              <button
                onClick={onReceivingToggle}
                disabled={false}
                className={`flex-1 px-4 py-2 rounded-md font-medium transition-colors cursor-pointer ${
                  isReceiving
                    ? "bg-red-600 hover:bg-red-700 text-white"
                    : "bg-green-600 hover:bg-green-700 text-white"
                } disabled:bg-gray-400`}
              >
                {isReceiving ? (
                  <>
                    <Square className="w-4 h-4 inline mr-2" />
                    停止接收
                  </>
                ) : (
                  <>
                    <Play className="w-4 h-4 inline mr-2" />
                    开始接收
                  </>
                )}
              </button>

              <button
                onClick={onClearMessages}
                className="px-4 py-2 bg-gray-600 hover:bg-gray-700 text-white rounded-md font-medium transition-colors"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* CAN Commands Configuration */}
      <div className="bg-white rounded-lg shadow-md p-6">
        <h3 className="text-xl font-semibold text-gray-800 mb-4">
          CAN命令配置
        </h3>
        <div className="space-y-4 max-h-96 overflow-y-auto">
          {canCommands.map((command) => (
            <div
              key={command.id}
              className="border border-gray-200 rounded-lg p-4"
            >
              <div className="space-y-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    命令名称
                  </label>
                  <input
                    type="text"
                    value={command.name}
                    onChange={(e) =>
                      onUpdateCanCommand(command.id, "name", e.target.value)
                    }
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                  />
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      CAN ID
                    </label>
                    <input
                      type="text"
                      value={command.canId}
                      onChange={(e) =>
                        onUpdateCanCommand(command.id, "canId", e.target.value)
                      }
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      数据
                    </label>
                    <input
                      type="text"
                      value={command.data}
                      onChange={(e) =>
                        onUpdateCanCommand(command.id, "data", e.target.value)
                      }
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    描述
                  </label>
                  <input
                    type="text"
                    value={command.description}
                    onChange={(e) =>
                      onUpdateCanCommand(
                        command.id,
                        "description",
                        e.target.value
                      )
                    }
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                  />
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Messages Display */}
      <div className="bg-white rounded-lg shadow-md p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-xl font-semibold text-gray-800">消息记录</h3>
          <div className="flex items-center gap-2">
            {isReceiving && (
              <div className="flex items-center gap-2 text-green-600">
                <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
                <span className="text-sm">接收中</span>
              </div>
            )}
          </div>
        </div>

        <div className="h-96 overflow-y-auto border border-gray-200 rounded-md p-4 bg-gray-50">
          {messages.length === 0 ? (
            <div className="text-center text-gray-500 py-8">
              <MessageSquare className="w-8 h-8 mx-auto mb-2 opacity-50" />
              <p>暂无消息</p>
            </div>
          ) : (
            <div className="space-y-2">
              {messages.map((message, index) => (
                <div
                  key={index}
                  className={`p-3 rounded-md text-sm ${
                    message.direction === "sent"
                      ? "bg-blue-100 border-l-4 border-blue-500"
                      : "bg-green-100 border-l-4 border-green-500"
                  }`}
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className="font-medium">
                      {message.direction === "sent" ? "发送" : "接收"}
                    </span>
                    <span className="text-xs text-gray-500">
                      {message.timestamp}
                    </span>
                  </div>
                  <div className="font-mono">
                    <span className="text-gray-700">ID: {message.id}</span>
                    <span className="ml-4 text-gray-700">
                      数据: {message.data}
                    </span>
                  </div>
                  <div className="text-xs text-gray-500 mt-1">
                    {message.frameType === "standard" ? "标准帧" : "扩展帧"}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default App;
