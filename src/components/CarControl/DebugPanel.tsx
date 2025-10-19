import React, { useState } from "react";
import { Bug, X, Trash2, ChevronDown, ChevronUp } from "lucide-react";

interface DebugLog {
  id: string;
  timestamp: string;
  action: string;
  commandId: string;
  canId: string;
  data: string;
  description: string;
}

interface DebugPanelProps {
  isVisible: boolean;
  onToggle: () => void;
  logs: DebugLog[];
  onClearLogs: () => void;
}

export const DebugPanel: React.FC<DebugPanelProps> = ({
  isVisible,
  onToggle,
  logs,
  onClearLogs,
}) => {
  const [isExpanded, setIsExpanded] = useState(true);

  return (
    <>
      {/* 调试按钮 - 固定在右下角 */}
      <button
        onClick={onToggle}
        className={`fixed bottom-4 right-4 z-50 p-3 rounded-full shadow-lg transition-all duration-300 ${
          isVisible
            ? "bg-red-500 hover:bg-red-600 text-white"
            : "bg-blue-500 hover:bg-blue-600 text-white"
        }`}
        title={isVisible ? "隐藏调试面板" : "显示调试面板"}
      >
        {isVisible ? <X className="w-5 h-5" /> : <Bug className="w-5 h-5" />}
      </button>

      {/* 调试面板 */}
      {isVisible && (
        <div className="fixed bottom-4 right-80 z-40 w-[400px] bg-white border border-gray-300 rounded-lg shadow-xl">
          {/* 面板头部 */}
          <div className="flex items-center justify-between p-3 bg-gray-50 border-b border-gray-200 rounded-t-lg">
            <div className="flex items-center gap-2">
              <Bug className="w-4 h-4 text-blue-500" />
              <h3 className="text-sm font-semibold text-gray-800">
                CAN调试日志
              </h3>
              <span className="text-xs text-gray-500">({logs.length})</span>
            </div>
            <div className="flex items-center gap-1">
              <button
                onClick={() => setIsExpanded(!isExpanded)}
                className="p-1 hover:bg-gray-200 rounded"
                title={isExpanded ? "收起" : "展开"}
              >
                {isExpanded ? (
                  <ChevronUp className="w-4 h-4 text-gray-600" />
                ) : (
                  <ChevronDown className="w-4 h-4 text-gray-600" />
                )}
              </button>
              <button
                onClick={onClearLogs}
                className="p-1 hover:bg-gray-200 rounded"
                title="清空日志"
              >
                <Trash2 className="w-4 h-4 text-gray-600" />
              </button>
            </div>
          </div>

          {/* 面板内容 */}
          {isExpanded && (
            <div className="max-h-80 overflow-y-auto">
              {logs.length === 0 ? (
                <div className="p-4 text-center text-gray-500 text-sm">
                  暂无调试日志
                </div>
              ) : (
                <div className="p-2 space-y-2">
                  {logs.map((log) => {
                    const isReceived = log.action === "接收CAN消息";
                    return (
                      <div
                        key={log.id}
                        className={`border rounded p-2 text-xs transition-all ${
                          isReceived
                            ? "bg-green-50 border-green-200 hover:bg-green-100"
                            : "bg-gray-50 border-gray-200 hover:bg-gray-100"
                        }`}
                      >
                        <div className="flex items-center justify-between mb-1">
                          <span
                            className={`font-medium ${
                              isReceived ? "text-green-600" : "text-blue-600"
                            }`}
                          >
                            {isReceived ? "📥" : "📤"} {log.action}
                          </span>
                          <span className="text-gray-500">{log.timestamp}</span>
                        </div>
                        <div className="grid grid-cols-2 gap-2 text-gray-700">
                          <div>
                            <span className="font-medium">命令ID:</span>{" "}
                            {log.commandId}
                          </div>
                          <div>
                            <span className="font-medium">CAN ID:</span>{" "}
                            <span className="bg-gray-200 px-1 rounded font-mono">
                              {log.canId}
                            </span>
                          </div>
                          <div>
                            <span className="font-medium">数据:</span>{" "}
                            <span className="bg-gray-200 px-1 rounded font-mono">
                              {log.data}
                            </span>
                          </div>
                          <div className="col-span-2">
                            <span className="font-medium">描述:</span>{" "}
                            {log.description}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </>
  );
};
