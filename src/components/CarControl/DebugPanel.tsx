import React, { useState } from "react";
import {
  Bug,
  X,
  Trash2,
  ChevronDown,
  ChevronUp,
  ArrowUpFromLine,
  ArrowDownToLine,
} from "lucide-react";
import { DebugLog, useDebugStore } from "@/store/useDebugStore";

interface DebugPanelProps {
  showToggleButton?: boolean;
}

export const DebugPanel: React.FC<DebugPanelProps> = ({
  showToggleButton = true,
}) => {
  const [isExpanded, setIsExpanded] = useState(true);

  const { logs, isDebugVisible, toggleDebugPanel, clearLogs } = useDebugStore();

  return (
    <>
      {/* 调试按钮 - 固定在右下角 */}
      {showToggleButton && (
        <button
          onClick={toggleDebugPanel}
          className={`fixed bottom-4 right-4 z-50 p-3 rounded-full shadow-lg transition-all duration-300 ${
            isDebugVisible
              ? "bg-red-500 hover:bg-red-600 text-white"
              : "bg-blue-500 hover:bg-blue-600 text-white"
          }`}
          title={isDebugVisible ? "隐藏调试面板" : "显示调试面板"}
        >
          {isDebugVisible ? (
            <X className="w-5 h-5" />
          ) : (
            <Bug className="w-5 h-5" />
          )}
        </button>
      )}

      {/* 调试面板 */}
      {isDebugVisible && (
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
                onClick={clearLogs}
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
                  {logs.map((log: DebugLog) => {
                    const isReceived = log.action === "接收CAN消息";
                    return (
                      <div
                        key={log.id}
                        className={`border rounded p-3 text-xs transition-all ${
                          isReceived
                            ? "bg-green-50 border-green-200 hover:bg-green-100"
                            : "bg-blue-50 border-blue-200 hover:bg-blue-100"
                        }`}
                      >
                        {/* 标题行 */}
                        <div className="flex items-center justify-between mb-2">
                          <span
                            className={`font-semibold flex items-center ${
                              isReceived ? "text-green-700" : "text-blue-700"
                            }`}
                          >
                            {isReceived ? (
                              <ArrowDownToLine className="w-4 h-4 mr-1.5" />
                            ) : (
                              <ArrowUpFromLine className="w-4 h-4 mr-1.5" />
                            )}
                            {log.action}
                          </span>
                          <span className="text-gray-500 text-xs">
                            {log.timestamp}
                          </span>
                        </div>

                        {/* 内容行 - 紧凑布局 */}
                        <div className="space-y-1.5 text-gray-700">
                          {/* 第一行：命令ID 和 CAN ID */}
                          <div className="flex gap-4 text-xs">
                            <div className="flex gap-1">
                              <span className="font-medium text-gray-600">
                                命令ID:
                              </span>
                              <span className="font-mono text-gray-800">
                                {log.commandId}
                              </span>
                            </div>
                            <div className="flex gap-1">
                              <span className="font-medium text-gray-600">
                                CAN ID:
                              </span>
                              <span className="font-mono text-gray-800">
                                {log.canId}
                              </span>
                            </div>
                          </div>

                          {/* 第二行：数据 */}
                          <div className="flex gap-1 text-xs">
                            <span className="font-medium text-gray-600 flex-shrink-0">
                              数据:
                            </span>
                            <span className="font-mono text-gray-800 break-all">
                              {log.data}
                            </span>
                          </div>

                          {/* 第三行：描述 */}
                          <div className="flex gap-1 text-xs">
                            <span className="font-medium text-gray-600 flex-shrink-0">
                              描述:
                            </span>
                            <span className="text-gray-700 break-words">
                              {log.description}
                            </span>
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
