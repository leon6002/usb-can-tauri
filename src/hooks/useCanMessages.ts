import { useState, useEffect, useRef } from "react";
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { toast } from "sonner";
import { CanMessage, SerialConfig, CarStates } from "../types";

// 验证 CAN ID 是否有效
const validateCanId = (
  id: string,
  frameType: string
): { valid: boolean; error?: string } => {
  try {
    // 移除 0x 前缀
    const idHex = id.toLowerCase().replace(/^0x/, "");

    // 验证是否为有效的十六进制
    if (!/^[0-9a-f]+$/.test(idHex)) {
      return { valid: false, error: "CAN ID 必须是有效的十六进制数" };
    }

    // 转换为数字
    const canId = parseInt(idHex, 16);

    // 验证范围
    if (frameType === "standard") {
      if (canId > 0x7ff) {
        return {
          valid: false,
          error: `标准帧 CAN ID 不能超过 0x7FF (当前: 0x${canId
            .toString(16)
            .toUpperCase()})`,
        };
      }
    } else if (frameType === "extended") {
      if (canId > 0x1fffffff) {
        return {
          valid: false,
          error: `扩展帧 CAN ID 不能超过 0x1FFFFFFF (当前: 0x${canId
            .toString(16)
            .toUpperCase()})`,
        };
      }
    }

    return { valid: true };
  } catch (error) {
    return { valid: false, error: "CAN ID 格式错误" };
  }
};

export const useCanMessages = () => {
  const [messages, setMessages] = useState<CanMessage[]>([]);
  const [sendId, setSendId] = useState("123");
  const [sendData, setSendData] = useState("01 02 03 04");
  const [carStates, setCarStates] = useState<Partial<CarStates>>({});
  const unlistenRef = useRef<(() => void) | null>(null);

  // 发送CAN消息
  const handleSendMessage = async (config: SerialConfig) => {
    try {
      // 验证 CAN ID
      console.log("🔍 验证 CAN ID:", { sendId, frameType: config.frameType });
      const validation = validateCanId(sendId, config.frameType);
      console.log("✅ 验证结果:", validation);

      if (!validation.valid) {
        console.warn("❌ CAN ID 验证失败:", validation.error);
        toast.error(validation.error);
        return;
      }

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
      toast.success("消息发送成功");
    } catch (error) {
      console.error("Send error:", error);
      toast.error(`发送错误: ${error}`);
    }
  };

  // 发送CAN命令
  const sendCanCommand = async (
    canId: string,
    data: string,
    config: SerialConfig
  ) => {
    try {
      // 验证 CAN ID
      console.log("🔍 验证车辆命令 CAN ID:", {
        canId,
        frameType: config.frameType,
      });
      const validation = validateCanId(canId, config.frameType);
      console.log("✅ 验证结果:", validation);

      if (!validation.valid) {
        console.warn("❌ CAN ID 验证失败:", validation.error);
        toast.error(validation.error);
        return;
      }

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
      toast.error(`发送车辆命令错误: ${error}`);
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

          // 如果包含车辆状态信息，更新carStates
          if (
            event.payload.gear !== undefined ||
            event.payload.steeringAngle !== undefined
          ) {
            console.log(
              "🚗 [Frontend] Updating vehicle status - Gear:",
              event.payload.gear,
              "Steering:",
              event.payload.steeringAngle
            );
            setCarStates((prev) => ({
              ...prev,
              gear: event.payload.gear,
              steeringAngleDegrees: event.payload.steeringAngle,
            }));
          }
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
    carStates,
  };
};
