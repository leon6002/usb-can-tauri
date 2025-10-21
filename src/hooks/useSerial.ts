import { useState, useEffect } from "react";
import { invoke } from "@tauri-apps/api/core";
import { SerialConfig } from "../types";
import { loadDefaultCsv } from "../utils/csvLoader";

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
    canIdColumnIndex: 0,
    canDataColumnIndex: 1,
    csvStartRowIndex: 1,
  });

  // 获取可用串口和加载预置CSV数据
  useEffect(() => {
    const initializeApp = async () => {
      try {
        // 获取可用串口
        const ports = await invoke<string[]>("get_available_ports");
        setAvailablePorts(ports);

        // 加载预置的示例数据
        console.log("📂 Loading preset CSV data on app startup...");
        const csvRows = await loadDefaultCsv();
        const csvText = csvRows
          .map((row) => `${row.can_id},${row.can_data},${row.interval_ms}`)
          .join("\n");

        setConfig((prevConfig) => ({
          ...prevConfig,
          csvFilePath: "sample-trajectory.csv (预置)",
          csvContent: csvText,
        }));
        console.log("✅ Preset CSV data loaded successfully");
      } catch (error) {
        console.error("Failed to initialize app:", error);
      }
    };
    initializeApp();
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

  // 连接到指定端口（用于演示模式快速连接）
  const connectToPort = async (port: string) => {
    try {
      const rustConfig = {
        port,
        baud_rate: config.baudRate,
        can_baud_rate: config.canBaudRate,
        frame_type: config.frameType,
        can_mode: config.canMode,
        protocol_length: config.protocolLength,
      };
      await invoke("connect_serial", { config: rustConfig });
      setIsConnected(true);
      setConfig((prev) => ({
        ...prev,
        port,
      }));
    } catch (error) {
      console.error("Connection error:", error);
      throw error;
    }
  };

  return {
    isConnected,
    availablePorts,
    config,
    setConfig,
    handleConnect,
    handleDisconnect,
    connectToPort,
  };
};
