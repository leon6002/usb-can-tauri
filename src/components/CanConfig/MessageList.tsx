import React from "react";
import { MessageSquare } from "lucide-react";
import { useCanMessageStore } from "@/store/canMessageStore";

export const MessageList: React.FC = () => {
  const messages = useCanMessageStore((state) => state.messages);
  return (
    <div className="flex-1 bg-white flex flex-col">
      {/* Messages Header */}
      <div className="p-4 border-b border-gray-200">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-semibold text-gray-800">消息记录</h3>
          <div className="text-sm text-gray-500">
            共 {messages.length} 条消息
          </div>
        </div>
      </div>

      {/* Messages Content */}
      <div className="flex-1 overflow-y-auto p-4 bg-gray-50">
        {messages.length === 0 ? (
          <div className="flex items-center justify-center h-full">
            <div className="text-center text-gray-500">
              <MessageSquare className="w-12 h-12 mx-auto mb-3 opacity-50" />
              <p className="text-lg">暂无消息</p>
              <p className="text-sm mt-1">发送消息或开始接收以查看数据</p>
            </div>
          </div>
        ) : (
          <div className="space-y-2">
            {messages
              .slice()
              .reverse()
              .map((message, index) => (
                <div
                  key={`${message.timestamp}-${message.id}-${message.data}-${index}`}
                  className={`p-3 rounded-lg shadow-sm border-l-4 transition-all ${
                    message.direction === "sent"
                      ? "bg-blue-50 border-blue-400 hover:shadow-md"
                      : "bg-green-50 border-green-400 hover:shadow-md"
                  }`}
                >
                  {/* Header: Direction, Frame Type, Timestamp */}
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <span
                        className={`px-2 py-0.5 rounded text-xs font-medium ${
                          message.direction === "sent"
                            ? "bg-blue-200 text-blue-800"
                            : "bg-green-200 text-green-800"
                        }`}
                      >
                        {message.direction === "sent" ? "📤 发送" : "📥 接收"}
                      </span>

                      <span className="text-xs text-gray-500">
                        {message.frameType === "extended" ? "扩展帧" : "标准帧"}
                      </span>
                    </div>
                    <span className="text-xs text-gray-400 font-mono">
                      {message.timestamp}
                    </span>
                  </div>

                  {/* ID and Data in one line */}
                  <div className="flex items-center gap-2 mb-2 flex-wrap">
                    <div className="flex items-center gap-1">
                      <span className="text-xs text-gray-500 font-semibold">
                        ID:
                      </span>
                      <code className="text-sm text-gray-900 bg-white px-2 py-1 rounded border border-gray-200">
                        {message.id}
                      </code>
                    </div>
                    <div className="flex items-center gap-1 flex-1">
                      <span className="text-xs text-gray-500 font-semibold">
                        Data:
                      </span>
                      <code className="text-xs text-gray-900 bg-white px-2 py-1 rounded border border-gray-200 flex-1 overflow-x-auto">
                        {message.data}
                      </code>
                    </div>
                  </div>

                  {/* Raw Data */}
                  {message.rawData && (
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-gray-500 font-semibold">
                        Raw:
                      </span>
                      <code className="text-xs text-gray-700 bg-yellow-50 px-2 py-1 rounded border border-yellow-300 flex-1 overflow-x-auto font-mono">
                        {message.rawData}
                      </code>
                    </div>
                  )}
                </div>
              ))}
          </div>
        )}
      </div>
    </div>
  );
};
