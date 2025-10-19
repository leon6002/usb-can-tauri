import { useState, useEffect, useRef } from "react";
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { CanMessage, SerialConfig } from "../types";

export const useCanMessages = () => {
  const [messages, setMessages] = useState<CanMessage[]>([]);
  const [sendId, setSendId] = useState("123");
  const [sendData, setSendData] = useState("01 02 03 04");
  const unlistenRef = useRef<(() => void) | null>(null);

  // 发送CAN消息
  const handleSendMessage = async (config: SerialConfig) => {
    try {
      const params = {
        id: sendId,
        data: sendData,
        frameType: config.frameType,
        protocolLength: config.protocolLength,
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

  // 发送CAN命令
  const sendCanCommand = async (
    canId: string,
    data: string,
    config: SerialConfig
  ) => {
    try {
      const params = {
        id: canId,
        data: data,
        frameType: config.frameType,
        protocolLength: config.protocolLength,
      };
      console.log("发送车辆命令参数:", params);
      await invoke("send_can_message", params);

      // 添加到消息列表
      const newMessage: CanMessage = {
        id: canId,
        data: data,
        timestamp: new Date().toLocaleTimeString(),
        direction: "sent",
        frameType: config.frameType as "standard" | "extended",
      };
      setMessages((prev) => [...prev, newMessage]);
    } catch (error) {
      console.error("Send car command error:", error);
      alert(`发送车辆命令错误: ${error}`);
    }
  };

  // 清空消息
  const clearMessages = () => {
    setMessages([]);
  };

  // 监听接收到的CAN消息
  useEffect(() => {
    const setupListener = async () => {
      try {
        const unlisten = await listen<any>("can-message-received", (event) => {
          const receivedMessage: CanMessage = {
            id: event.payload.id,
            data: event.payload.data,
            rawData: event.payload.rawData,
            timestamp: event.payload.timestamp,
            direction: "received",
            frameType: event.payload.frameType || "standard",
          };
          setMessages((prev) => [...prev, receivedMessage]);
        });
        unlistenRef.current = unlisten;
      } catch (error) {
        console.error("Failed to setup CAN message listener:", error);
      }
    };

    setupListener();

    return () => {
      if (unlistenRef.current) {
        unlistenRef.current();
        unlistenRef.current = null;
      }
    };
  }, []);

  return {
    messages,
    sendId,
    sendData,
    setSendId,
    setSendData,
    handleSendMessage,
    sendCanCommand,
    clearMessages,
  };
};
