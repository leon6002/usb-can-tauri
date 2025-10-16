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
    <div>
      <h3 className="text-sm font-semibold text-gray-800 mb-2">测试发送消息</h3>
      <div className="space-y-1">
        {/* CAN ID and Data in one row */}
        <div className="flex gap-2">
          <div className="flex-1">
            <label className="block text-xs font-medium text-gray-700 mb-1">
              CAN ID
            </label>
            <input
              type="text"
              value={sendId}
              onChange={(e) => onSendIdChange(e.target.value)}
              className="w-full px-2 py-1 text-xs border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500"
              placeholder="123"
              disabled={!isConnected}
            />
          </div>

          <div className="flex-1">
            <label className="block text-xs font-medium text-gray-700 mb-1">
              CAN DATA
            </label>
            <input
              type="text"
              value={sendData}
              onChange={(e) => onSendDataChange(e.target.value)}
              className="w-full px-2 py-1 text-xs border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500"
              placeholder="01 02 03 04"
              disabled={!isConnected}
            />
          </div>
          {/* Send and Clear buttons in one row */}
          <div className="flex gap-2">
            <button
              onClick={onSendMessage}
              disabled={!isConnected}
              className="flex-1 px-3 py-1 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 text-white rounded text-xs font-medium transition-colors cursor-pointer"
            >
              <Send className="w-3 h-3 inline mr-1" />
              发送
            </button>

            <button
              onClick={onClearMessages}
              className="flex-1 px-3 py-1 bg-gray-600 hover:bg-gray-700 text-white rounded text-xs font-medium transition-colors"
            >
              <Trash2 className="w-3 h-3 inline mr-1" />
              清空
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
