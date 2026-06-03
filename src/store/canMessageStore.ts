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
  txMessages: CanMessage[];
  unlisten: (() => void) | null;

  addMessage: (msg: CanMessage) => void;
  addMessages: (msgs: CanMessage[]) => void;

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

function cappedPush<T>(arr: T[], items: T[], cap: number): T[] {
  const next = [...arr, ...items];
  return next.length > cap ? next.slice(next.length - cap) : next;
}

export const useCanMessageStore = create<CanMessageState>((set, get) => ({
  messages: [],
  txMessages: [],
  unlisten: null,

  clearMessages: () => set({ messages: [], txMessages: [] }),

  MAX_MESSAGES: 200,

  addMessage: (msg: CanMessage) => {
    set((state) => {
      const txNext = msg.direction === "sent"
        ? cappedPush(state.txMessages, [msg], 200)
        : state.txMessages;
      return {
        messages: cappedPush(state.messages, [msg], 200),
        txMessages: txNext,
      };
    });
  },

  addMessages: (msgs: CanMessage[]) => {
    if (msgs.length === 0) return;
    set((state) => {
      // Dedup: skip messages identical to the last 50 already stored (same ts+id+data)
      const recentKeys = new Set(
        state.messages.slice(-50).map((m) => `${m.timestamp}|${m.id}|${m.data}`)
      );
      const deduped = msgs.filter((m) => !recentKeys.has(`${m.timestamp}|${m.id}|${m.data}`));
      if (deduped.length === 0) return {};

      const txItems = deduped.filter((m) => m.direction === "sent");
      return {
        messages: cappedPush(state.messages, deduped, 200),
        txMessages: txItems.length > 0
          ? cappedPush(state.txMessages, txItems, 200)
          : state.txMessages,
      };
    });
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
      toast.success("success");
    } catch (error) {
      toast.error(`error: ${error}`);
    }
  },

  /**
   * Setup CAN message listener with throttled batch processing.
   * Events arrive at up to 100 Hz; we batch them and flush to store at ~10 Hz
   * to avoid overwhelming React with re-renders. CSV logging in Rust captures
   * every single message losslessly regardless of frontend throttling.
   */
  setupCanMessageListener: async () => {
    const { unlisten: currentUnlisten, addMessages } = get();

    // Clean up old listener
    if (currentUnlisten) currentUnlisten();

    // Module-level batch buffer shared across all store instances in this window
    const buffer: CanMessage[] = [];
    let flushTimer: ReturnType<typeof setInterval> | null = null;

    try {
      const newUnlisten = await listen<any>("can-message-received", (event) => {
        const msg: CanMessage = {
          id: event.payload.id,
          data: event.payload.data,
          rawData: event.payload.rawData,
          timestamp: event.payload.timestamp,
          direction: event.payload.direction || "received",
          frameType: event.payload.frameType || "standard",
        };

        buffer.push(msg);

        // Update vehicle control state immediately (low-volume, needs to be real-time)
        if (
          event.payload.gear !== undefined ||
          event.payload.steeringAngle !== undefined
        ) {
          const { setCarState } = useCarControlStore.getState();
          setCarState({
            gear: event.payload.gear,
            steeringAngleDegrees: event.payload.steeringAngle,
          });
        }
      });

      // Flush buffer to store every 100ms (10 batches/sec)
      flushTimer = setInterval(() => {
        if (buffer.length > 0) {
          addMessages(buffer.splice(0));
        }
      }, 100);

      set({ unlisten: newUnlisten });
    } catch (error) {
      console.error("Failed to setup CAN message listener:", error);
      if (flushTimer) clearInterval(flushTimer);
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
