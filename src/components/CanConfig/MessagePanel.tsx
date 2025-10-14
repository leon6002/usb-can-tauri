import React from "react";
import { Send, Trash2 } from "lucide-react";

interface MessagePanelProps {
  isConnected: boolean;
  sendId: string;
  sendData: string;
  onSendIdChange: (id: string) => void;
  onSendDataChange: (data: string) => void;
  onSendMessage: () => void;
  onClearMessages: () => void;
}

export const MessagePanel: React.FC<MessagePanelProps> = ({
  isConnected,
  sendId,
  sendData,
  onSendIdChange,
  onSendDataChange,
  onSendMessage,
  onClearMessages,
}) => {
  return (
    <div className="p-4 border-b border-gray-200">
      <h3 className="text-lg font-semibold text-gray-800 mb-3">发送消息</h3>
      <div className="space-y-3">
        <div>
          <label className="block text-xs font-medium text-gray-700 mb-1">
            CAN ID (十六进制)
          </label>
          <input
            type="text"
            value={sendId}
            onChange={(e) => onSendIdChange(e.target.value)}
            className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            placeholder="123"
            disabled={!isConnected}
          />
        </div>

        <div>
          <label className="block text-xs font-medium text-gray-700 mb-1">
            数据 (十六进制，空格分隔)
          </label>
          <input
            type="text"
            value={sendData}
            onChange={(e) => onSendDataChange(e.target.value)}
            className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            placeholder="01 02 03 04"
            disabled={!isConnected}
          />
        </div>

        <button
          onClick={onSendMessage}
          disabled={!isConnected}
          className="w-full px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 text-white rounded-md text-sm font-medium transition-colors cursor-pointer"
        >
          <Send className="w-4 h-4 inline mr-2" />
          发送消息
        </button>

        <button
          onClick={onClearMessages}
          className="w-full px-3 py-2 bg-gray-600 hover:bg-gray-700 text-white rounded-md text-sm font-medium transition-colors"
        >
          <Trash2 className="w-4 h-4 inline mr-2" />
          清空消息
        </button>
      </div>
    </div>
  );
};
