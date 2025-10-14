import React from "react";
import { ConnectionPanel } from "./ConnectionPanel";
import { MessagePanel } from "./MessagePanel";
import { MessageList } from "./MessageList";
import { SerialConfig, CanMessage } from "../../types";

interface CanConfigTabProps {
  isConnected: boolean;
  config: SerialConfig;
  availablePorts: string[];
  messages: CanMessage[];
  sendId: string;
  sendData: string;
  onConnect: () => void;
  onDisconnect: () => Promise<void>;
  onConfigChange: (config: SerialConfig) => void;
  onSendMessage: () => void;
  onClearMessages: () => void;
  onSendIdChange: (id: string) => void;
  onSendDataChange: (data: string) => void;
}

export const CanConfigTab: React.FC<CanConfigTabProps> = ({
  isConnected,
  config,
  availablePorts,
  messages,
  sendId,
  sendData,
  onConnect,
  onConfigChange,
  onSendMessage,
  onClearMessages,
  onSendIdChange,
  onSendDataChange,
}) => {
  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      {/* Top Status Bar */}
      <div className="bg-white border-b border-gray-200 px-6 py-3">
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-semibold text-gray-900">CAN配置</h2>
          <div className="flex items-center gap-4">
            <div className="text-sm text-gray-600">
              端口: <span className="font-mono bg-gray-100 px-2 py-1 rounded">{config.port}</span>
            </div>
            <div className="text-sm text-gray-600">
              波特率: <span className="font-mono bg-gray-100 px-2 py-1 rounded">{config.canBaudRate}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left Panel - Configuration */}
        <div className="w-80 bg-white border-r border-gray-200 flex flex-col">
          <ConnectionPanel
            isConnected={isConnected}
            config={config}
            availablePorts={availablePorts}
            onConfigChange={onConfigChange}
            onConnect={onConnect}
          />

          {/* Send Panel */}
          <MessagePanel
            isConnected={isConnected}
            sendId={sendId}
            sendData={sendData}
            onSendIdChange={onSendIdChange}
            onSendDataChange={onSendDataChange}
            onSendMessage={onSendMessage}
            onClearMessages={onClearMessages}
          />
        </div>

        {/* Right Panel - Messages Display */}
        <MessageList messages={messages} />
      </div>
    </div>
  );
};
