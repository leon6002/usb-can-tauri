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

interface SerialConfig {
  port: string;
  baudRate: number;
  canBaudRate: number;
  frameType: string;
  canMode: string;
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
    port: "/dev/ttyUSB0",
    baudRate: 115200,
    canBaudRate: 500000,
    frameType: "standard",
    canMode: "normal",
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

  // 连接/断开串口
  const handleConnect = async () => {
    try {
      if (isConnected) {
        await invoke("disconnect_serial");
        setIsConnected(false);
        setIsReceiving(false);
      } else {
        await invoke("connect_serial", { config });
        setIsConnected(true);
      }
    } catch (error) {
      console.error("Connection error:", error);
      alert(`连接错误: ${error}`);
    }
  };

  // 发送CAN消息
  const handleSendMessage = async () => {
    try {
      await invoke("send_can_message", {
        id: sendId,
        data: sendData,
        frame_type: config.frameType,
      });

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
      await invoke("send_can_message", {
        id: command.canId,
        data: command.data,
        frame_type: config.frameType,
      });

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
            onConnect={handleConnect}
            config={config}
            availablePorts={availablePorts}
            onConfigChange={setConfig}
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
  onConnect: () => void;
  config: SerialConfig;
  availablePorts: string[];
  onConfigChange: (config: SerialConfig) => void;
}

function CarControlTab({
  isConnected,
  carStates,
  onSendCommand,
  onConnect,
  config,
  availablePorts,
  onConfigChange,
}: CarControlTabProps) {
  return (
    <div className="space-y-6">
      {/* Connection Panel */}
      <div className="bg-white rounded-lg shadow-md p-6">
        <h3 className="text-xl font-semibold text-gray-800 mb-4">连接配置</h3>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              串口
            </label>
            <select
              value={config.port}
              onChange={(e) =>
                onConfigChange({ ...config, port: e.target.value })
              }
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              disabled={isConnected}
            >
              {availablePorts.map((port) => (
                <option key={port} value={port}>
                  {port}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              CAN波特率
            </label>
            <select
              value={config.canBaudRate}
              onChange={(e) =>
                onConfigChange({
                  ...config,
                  canBaudRate: parseInt(e.target.value),
                })
              }
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              disabled={isConnected}
            >
              <option value={125000}>125K</option>
              <option value={250000}>250K</option>
              <option value={500000}>500K</option>
              <option value={1000000}>1M</option>
            </select>
          </div>
          <div className="flex items-end">
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
              disabled={!isConnected}
              className="px-6 py-3 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 text-white rounded-md font-medium transition-colors"
            >
              <Play className="w-4 h-4 inline mr-2" />
              开始行驶
            </button>
            <button
              onClick={() => onSendCommand("update_data")}
              disabled={!isConnected}
              className="px-6 py-3 bg-gray-600 hover:bg-gray-700 disabled:bg-gray-400 text-white rounded-md font-medium transition-colors"
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
              disabled={!isConnected}
              className="px-4 py-2 bg-green-600 hover:bg-green-700 disabled:bg-gray-400 text-white rounded-md transition-colors"
            >
              开门
            </button>
            <button
              onClick={() => onSendCommand("left_door_close")}
              disabled={!isConnected}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 text-white rounded-md transition-colors"
            >
              关门
            </button>
            <button
              onClick={() => onSendCommand("left_door_stop")}
              disabled={!isConnected}
              className="px-4 py-2 bg-red-600 hover:bg-red-700 disabled:bg-gray-400 text-white rounded-md transition-colors"
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
                  disabled={!isConnected}
                  className={`w-full px-4 py-2 rounded-md transition-colors ${
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
                  disabled={!isConnected}
                  className={`w-full px-4 py-2 rounded-md transition-colors ${
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
  availablePorts,
  canCommands,
  messages,
  sendId,
  sendData,
  isReceiving,
  onConnect,
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
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                串口
              </label>
              <select
                value={config.port}
                onChange={(e) =>
                  onConfigChange({ ...config, port: e.target.value })
                }
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                disabled={isConnected}
              >
                {availablePorts.map((port) => (
                  <option key={port} value={port}>
                    {port}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                串口波特率
              </label>
              <select
                value={config.baudRate}
                onChange={(e) =>
                  onConfigChange({
                    ...config,
                    baudRate: parseInt(e.target.value),
                  })
                }
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                disabled={isConnected}
              >
                <option value={9600}>9600</option>
                <option value={19200}>19200</option>
                <option value={38400}>38400</option>
                <option value={57600}>57600</option>
                <option value={115200}>115200</option>
                <option value={230400}>230400</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                CAN波特率
              </label>
              <select
                value={config.canBaudRate}
                onChange={(e) =>
                  onConfigChange({
                    ...config,
                    canBaudRate: parseInt(e.target.value),
                  })
                }
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                disabled={isConnected}
              >
                <option value={125000}>125K</option>
                <option value={250000}>250K</option>
                <option value={500000}>500K</option>
                <option value={1000000}>1M</option>
              </select>
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
                disabled={!isConnected}
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
                disabled={!isConnected}
              />
            </div>

            <button
              onClick={onSendMessage}
              disabled={!isConnected}
              className="w-full px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 text-white rounded-md font-medium transition-colors"
            >
              <Send className="w-4 h-4 inline mr-2" />
              发送消息
            </button>

            <div className="flex gap-2">
              <button
                onClick={onReceivingToggle}
                disabled={!isConnected}
                className={`flex-1 px-4 py-2 rounded-md font-medium transition-colors ${
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
