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
    let isMounted = true;
    const setupListener = async () => {
      try {
        // 如果已经有listener，先清理
        if (unlistenRef.current) {
          unlistenRef.current();
          unlistenRef.current = null;
        }

        const unlisten = await listen<any>("can-message-received", (event) => {
          if (!isMounted) return;

          console.log("📨 [Frontend] Received event:", event.payload);
          const receivedMessage: CanMessage = {
            id: event.payload.id,
            data: event.payload.data,
            rawData: event.payload.rawData,
            timestamp: event.payload.timestamp,
            direction: "received",
            frameType: event.payload.frameType || "standard",
          };
          console.log("📨 [Frontend] Adding message to list:", receivedMessage);
          setMessages((prev) => {
            console.log(
              "📨 [Frontend] Previous messages count:",
              prev.length,
              "New total:",
              prev.length + 1
            );
            return [...prev, receivedMessage];
          });
        });

        if (isMounted) {
          unlistenRef.current = unlisten;
        } else {
          unlisten();
        }
      } catch (error) {
        console.error("Failed to setup CAN message listener:", error);
      }
    };

    setupListener();

    return () => {
      isMounted = false;
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
