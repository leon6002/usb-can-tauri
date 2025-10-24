import React from "react";
import { ConnectionPanel } from "./ConnectionPanel";
import { MessagePanel } from "./MessagePanel";
import { MessageList } from "./MessageList";
import { useSerialStore } from "@/store/serialStore";

export const CanConfigTab: React.FC = () => {
  console.log("CanConfigTab rendered");
  //写法二
  const port = useSerialStore((state) => state.config.port);
  const canBaudRate = useSerialStore((state) => state.config.canBaudRate);

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      {/* Top Status Bar */}
      <div className="bg-white border-b border-gray-200 px-6 py-3">
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-semibold text-gray-900">CAN配置</h2>
          <div className="flex items-center gap-4">
            <div className="text-sm text-gray-600">
              端口:{" "}
              <span className="font-mono bg-gray-100 px-2 py-1 rounded">
                {port}
              </span>
            </div>
            <div className="text-sm text-gray-600">
              波特率:{" "}
              <span className="font-mono bg-gray-100 px-2 py-1 rounded">
                {canBaudRate}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left Panel - Configuration */}
        <div className="w-96 bg-white border-r border-gray-200 flex flex-col overflow-hidden">
          <ConnectionPanel />
        </div>

        {/* Right Panel - Send Message & Messages Display */}
        <div className="flex-1 flex flex-col overflow-hidden">
          {/* Send Panel */}
          <div className="bg-white border-b border-gray-200 p-4">
            <MessagePanel />
          </div>

          {/* Messages Display */}
          <MessageList />
        </div>
      </div>
    </div>
  );
};
