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

function App() {
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
        frameType: config.frameType,
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

  // 控制接收
  const handleReceiveControl = async () => {
    try {
      if (isReceiving) {
        await invoke("stop_receiving");
        setIsReceiving(false);
      } else {
        await invoke("start_receiving");
        setIsReceiving(true);
        // TODO: 实现消息接收轮询
      }
    } catch (error) {
      console.error("Receive control error:", error);
      alert(`接收控制错误: ${error}`);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 p-4">
      <div className="max-w-6xl mx-auto">
        <h1 className="text-3xl font-bold text-gray-900 mb-6 flex items-center gap-2">
          <Settings className="w-8 h-8" />
          USB-CAN转换器控制台
        </h1>

        {/* 连接状态 */}
        <div className="bg-white rounded-lg shadow-md p-4 mb-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              {isConnected ? (
                <>
                  <CheckCircle className="w-5 h-5 text-green-500" />
                  <span className="text-green-700 font-medium">已连接</span>
                </>
              ) : (
                <>
                  <AlertCircle className="w-5 h-5 text-red-500" />
                  <span className="text-red-700 font-medium">未连接</span>
                </>
              )}
            </div>
            <div className="flex items-center gap-2">
              {isConnected ? (
                <Wifi className="w-5 h-5 text-green-500" />
              ) : (
                <WifiOff className="w-5 h-5 text-gray-400" />
              )}
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* 配置面板 */}
          <div className="bg-white rounded-lg shadow-md p-6">
            <h2 className="text-xl font-semibold text-gray-800 mb-4">
              连接配置
            </h2>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  串口
                </label>
                <select
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  value={config.port}
                  onChange={(e) =>
                    setConfig({ ...config, port: e.target.value })
                  }
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
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  value={config.baudRate}
                  onChange={(e) =>
                    setConfig({ ...config, baudRate: parseInt(e.target.value) })
                  }
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
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  value={config.canBaudRate}
                  onChange={(e) =>
                    setConfig({
                      ...config,
                      canBaudRate: parseInt(e.target.value),
                    })
                  }
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
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  value={config.frameType}
                  onChange={(e) =>
                    setConfig({ ...config, frameType: e.target.value })
                  }
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
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  value={config.canMode}
                  onChange={(e) =>
                    setConfig({ ...config, canMode: e.target.value })
                  }
                  disabled={isConnected}
                >
                  <option value="normal">正常模式</option>
                  <option value="loopback">回环模式</option>
                  <option value="listen">监听模式</option>
                </select>
              </div>

              <button
                className={`w-full py-2 px-4 rounded-md font-medium transition-colors ${
                  isConnected
                    ? "bg-red-600 hover:bg-red-700 text-white"
                    : "bg-blue-600 hover:bg-blue-700 text-white"
                }`}
                onClick={handleConnect}
              >
                {isConnected ? "断开连接" : "连接"}
              </button>
            </div>
          </div>

          {/* 消息发送面板 */}
          <div className="bg-white rounded-lg shadow-md p-6">
            <h2 className="text-xl font-semibold text-gray-800 mb-4">
              发送消息
            </h2>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  CAN ID (十六进制)
                </label>
                <input
                  type="text"
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  value={sendId}
                  onChange={(e) => setSendId(e.target.value)}
                  placeholder="123"
                  disabled={!isConnected}
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  数据 (十六进制，空格分隔)
                </label>
                <textarea
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  rows={3}
                  value={sendData}
                  onChange={(e) => setSendData(e.target.value)}
                  placeholder="01 02 03 04"
                  disabled={!isConnected}
                />
              </div>

              <button
                className="w-full bg-green-600 hover:bg-green-700 text-white py-2 px-4 rounded-md font-medium transition-colors flex items-center justify-center gap-2 disabled:bg-gray-400"
                disabled={!isConnected}
                onClick={handleSendMessage}
              >
                <Send className="w-4 h-4" />
                发送消息
              </button>
            </div>

            <div className="mt-6 pt-4 border-t border-gray-200">
              <div className="flex gap-2">
                <button
                  className={`flex-1 py-2 px-4 rounded-md font-medium transition-colors flex items-center justify-center gap-2 ${
                    isReceiving
                      ? "bg-red-600 hover:bg-red-700 text-white"
                      : "bg-blue-600 hover:bg-blue-700 text-white"
                  } disabled:bg-gray-400`}
                  disabled={!isConnected}
                  onClick={handleReceiveControl}
                >
                  {isReceiving ? (
                    <Square className="w-4 h-4" />
                  ) : (
                    <Play className="w-4 h-4" />
                  )}
                  {isReceiving ? "停止接收" : "开始接收"}
                </button>

                <button
                  className="bg-gray-600 hover:bg-gray-700 text-white py-2 px-4 rounded-md font-medium transition-colors flex items-center justify-center gap-2"
                  onClick={() => setMessages([])}
                >
                  <Trash2 className="w-4 h-4" />
                  清空
                </button>
              </div>
            </div>
          </div>

          {/* 消息显示面板 */}
          <div className="bg-white rounded-lg shadow-md p-6">
            <h2 className="text-xl font-semibold text-gray-800 mb-4">
              消息记录
            </h2>

            <div className="h-96 overflow-y-auto border border-gray-200 rounded-md p-2 bg-gray-50">
              {messages.length === 0 ? (
                <div className="text-center text-gray-500 py-8">暂无消息</div>
              ) : (
                <div className="space-y-2">
                  {messages.map((msg, index) => (
                    <div
                      key={index}
                      className={`p-2 rounded text-sm font-mono ${
                        msg.direction === "sent"
                          ? "bg-blue-100 text-blue-800"
                          : "bg-green-100 text-green-800"
                      }`}
                    >
                      <div className="flex justify-between items-start">
                        <span className="font-semibold">
                          {msg.direction === "sent" ? "发送" : "接收"} ID:{" "}
                          {msg.id}
                        </span>
                        <span className="text-xs opacity-75">
                          {msg.timestamp}
                        </span>
                      </div>
                      <div className="mt-1">数据: {msg.data}</div>
                      <div className="text-xs opacity-75 mt-1">
                        {msg.frameType === "standard" ? "标准帧" : "扩展帧"}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default App;
