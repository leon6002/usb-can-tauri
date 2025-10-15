import { useState, useCallback } from "react";

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

  // 添加调试日志
  const addDebugLog = useCallback((
    action: string,
    commandId: string,
    canId: string,
    data: string,
    description: string
  ) => {
    const newLog: DebugLog = {
      id: Date.now().toString() + Math.random().toString(36).substr(2, 9),
      timestamp: new Date().toLocaleTimeString('zh-CN', {
        hour12: false,
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        // fractionalSecondDigits: 3
      }),
      action,
      commandId,
      canId,
      data,
      description
    };

    setLogs(prevLogs => {
      const newLogs = [newLog, ...prevLogs];
      // 限制日志数量，最多保留100条
      return newLogs.slice(0, 100);
    });
  }, []);

  // 清空日志
  const clearLogs = useCallback(() => {
    setLogs([]);
  }, []);

  // 切换调试面板显示状态
  const toggleDebugPanel = useCallback(() => {
    setIsDebugVisible(prev => !prev);
  }, []);

  return {
    logs,
    isDebugVisible,
    addDebugLog,
    clearLogs,
    toggleDebugPanel
  };
};
