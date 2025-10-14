import React from "react";
import { MessageSquare } from "lucide-react";
import { CanMessage } from "../../types";

interface MessageListProps {
  messages: CanMessage[];
}

export const MessageList: React.FC<MessageListProps> = ({ messages }) => {
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
            {messages.slice().reverse().map((message, index) => (
              <div
                key={messages.length - 1 - index}
                className={`p-4 rounded-lg shadow-sm ${
                  message.direction === "sent"
                    ? "bg-blue-50 border-l-4 border-blue-500"
                    : "bg-green-50 border-l-4 border-green-500"
                }`}
              >
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <span className={`px-2 py-1 rounded text-xs font-medium ${
                      message.direction === "sent"
                        ? "bg-blue-100 text-blue-700"
                        : "bg-green-100 text-green-700"
                    }`}>
                      {message.direction === "sent" ? "发送" : "接收"}
                    </span>
                    <span className={`px-2 py-1 rounded text-xs ${
                      message.frameType === "extended"
                        ? "bg-purple-100 text-purple-700"
                        : "bg-gray-100 text-gray-700"
                    }`}>
                      {message.frameType === "extended" ? "扩展帧" : "标准帧"}
                    </span>
                  </div>
                  <span className="text-xs text-gray-500 font-mono">
                    {message.timestamp}
                  </span>
                </div>
                <div className="font-mono text-sm">
                  <div className="flex items-center gap-4">
                    <div>
                      <span className="text-gray-600 text-xs">ID:</span>
                      <span className="ml-1 font-semibold">{message.id}</span>
                    </div>
                    <div className="flex-1">
                      <span className="text-gray-600 text-xs">Data:</span>
                      <span className="ml-1 font-semibold">{message.data}</span>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
