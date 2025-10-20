import { useState, useEffect } from "react";
import { invoke } from "@tauri-apps/api/core";
import { SerialConfig } from "../types";

export const useSerial = () => {
  const [isConnected, setIsConnected] = useState(false);
  const [availablePorts, setAvailablePorts] = useState<string[]>([]);
  const [config, setConfig] = useState<SerialConfig>({
    port: "COM23",
    baudRate: 2000000,
    canBaudRate: 500000,
    frameType: "extended",
    protocolLength: "fixed",
    canMode: "normal",
    sendIntervalMs: 10,
    canIdColumnIndex: 4,
    canDataColumnIndex: 8,
    csvStartRowIndex: 1,
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
      } else {
        // 转换字段名为Rust后端期望的格式
        const rustConfig = {
          port: config.port,
          baud_rate: config.baudRate,
          can_baud_rate: config.canBaudRate,
          frame_type: config.frameType,
          can_mode: config.canMode,
          protocol_length: config.protocolLength,
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

  return {
    isConnected,
    availablePorts,
    config,
    setConfig,
    handleConnect,
    handleDisconnect,
  };
};
