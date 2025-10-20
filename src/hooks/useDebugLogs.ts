import { useState, useCallback, useEffect, useRef } from "react";
import { listen } from "@tauri-apps/api/event";

export interface DebugLog {
  id: string;
  timestamp: string;
  action: string;
  commandId: string;
  canId: string;
  data: string;
  description: string;
}

export const useDebugLogs = () => {
  const [logs, setLogs] = useState<DebugLog[]>([]);
  const [isDebugVisible, setIsDebugVisible] = useState(false);
  const unlistenRef = useRef<(() => void) | null>(null);

  // 添加调试日志
  const addDebugLog = useCallback(
    (
      action: string,
      commandId: string,
      canId: string,
      data: string,
      description: string
    ) => {
      const newLog: DebugLog = {
        id: Date.now().toString() + Math.random().toString(36).substr(2, 9),
        timestamp: new Date().toLocaleTimeString("zh-CN", {
          hour12: false,
          hour: "2-digit",
          minute: "2-digit",
          second: "2-digit",
          // fractionalSecondDigits: 3
        }),
        action,
        commandId,
        canId,
        data,
        description,
      };

      setLogs((prevLogs) => {
        const newLogs = [newLog, ...prevLogs];
        // 限制日志数量，最多保留100条
        return newLogs.slice(0, 100);
      });
    },
    []
  );

  // 清空日志
  const clearLogs = useCallback(() => {
    setLogs([]);
  }, []);

  // 切换调试面板显示状态
  const toggleDebugPanel = useCallback(() => {
    setIsDebugVisible((prev) => !prev);
  }, []);

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

          addDebugLog(
            "接收CAN消息",
            "received",
            event.payload.id,
            event.payload.data,
            `接收到CAN消息`
          );
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
    logs,
    isDebugVisible,
    addDebugLog,
    clearLogs,
    toggleDebugPanel,
  };
};
