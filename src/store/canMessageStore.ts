// canMessageStore.ts

import { create } from "zustand";
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { toast } from "sonner";
import { CanMessage } from "../types";
import { useCarControlStore } from "./carControlStore";

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

interface CanMessageState {
  messages: CanMessage[];
  unlisten: (() => void) | null; // 用于存储监听器的清理函数

  addMessage: (msg: CanMessage) => void;

  // Actions
  clearMessages: () => void;
  handleSendMessage: (
    id: string,
    data: string,
    frameType?: string,
    protocolLength?: string
  ) => Promise<void>;

  // 副作用 Actions
  setupCanMessageListener: () => Promise<void>;
  cleanupCanMessageListener: () => void;
}

export const useCanMessageStore = create<CanMessageState>((set, get) => ({
  // --- 状态 ---
  messages: [],
  unlisten: null,

  // --- Actions ---
  clearMessages: () => set({ messages: [] }),

  // 添加消息到列表 (内部 Helper)
  addMessage: (msg: CanMessage) => {
    set((state) => ({ messages: [...state.messages, msg] }));
  },

  /**
   * 核心 Action：发送自定义 CAN 消息
   */
  handleSendMessage: async (id, data, frameType?, protocolLength?) => {
    const { addMessage } = get();
    const validFrameType = frameType === "extended" ? "extended" : "standard";
    const validProtocolLength =
      protocolLength === "variable" ? "variable" : "fixed";
    try {
      const validation = validateCanId(id, validFrameType);
      if (!validation.valid) {
        toast.error(validation.error);
        return;
      }

      await invoke("send_can_message", {
        id,
        data,
        frameType: validFrameType,
        protocolLength: validProtocolLength,
      });

      addMessage({
        id,
        data,
        timestamp: new Date().toLocaleTimeString(),
        direction: "sent",
        frameType: validFrameType,
      });
      toast.success("消息发送成功");
    } catch (error) {
      toast.error(`发送错误: ${error}`);
    }
  },

  /**
   * 副作用 Action：设置监听器
   */
  setupCanMessageListener: async () => {
    const { unlisten: currentUnlisten, addMessage } = get();

    // 清理旧的监听器
    if (currentUnlisten) currentUnlisten();

    try {
      const newUnlisten = await listen<any>("can-message-received", (event) => {
        const receivedMessage: CanMessage = {
          id: event.payload.id,
          data: event.payload.data,
          rawData: event.payload.rawData,
          timestamp: event.payload.timestamp,
          direction: "received",
          frameType: event.payload.frameType || "standard",
        };

        // 1. 将消息加入日志
        addMessage(receivedMessage);

        // 2. 跨 Store 调用：更新车辆控制状态
        if (
          event.payload.gear !== undefined ||
          event.payload.steeringAngle !== undefined
        ) {
          const { setCarState } = useCarControlStore.getState();
          // ⚠️ 假设 updateVehicleControl 接受速度、转向角和档位
          // 你需要根据你的类型进行调整
          setCarState({
            gear: event.payload.gear,
            steeringAngleDegrees: event.payload.steeringAngle,
          });
        }
      });
      set({ unlisten: newUnlisten });
    } catch (error) {
      console.error("Failed to setup CAN message listener:", error);
    }
  },

  /**
   * 副作用 Action：清理监听器
   */
  cleanupCanMessageListener: () => {
    const { unlisten } = get();
    if (unlisten) unlisten();
    set({ unlisten: null });
  },
}));
