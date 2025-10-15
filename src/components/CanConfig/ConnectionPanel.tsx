import React from "react";
import { Wifi, WifiOff } from "lucide-react";
import { SerialConfig } from "../../types";

interface ConnectionPanelProps {
  isConnected: boolean;
  config: SerialConfig;
  availablePorts: string[];
  onConfigChange: (config: SerialConfig) => void;
  onConnect: () => void;
}

export const ConnectionPanel: React.FC<ConnectionPanelProps> = ({
  isConnected,
  config,
  // availablePorts,
  onConfigChange,
  onConnect,
}) => {
  return (
    <div className="p-4 border-b border-gray-200">
      <h3 className="text-lg font-semibold text-gray-800 mb-3">连接配置</h3>

      <div className="space-y-3">
        <div>
          <label className="block text-xs font-medium text-gray-700 mb-1">
            串口
          </label>
          <input
            type="text"
            value={config.port}
            onChange={(e) =>
              onConfigChange({ ...config, port: e.target.value })
            }
            className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            placeholder="COM23"
            disabled={isConnected}
          />
        </div>

        <div className="grid grid-cols-2 gap-2">
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">
              串口波特率
            </label>
            <input
              type="number"
              value={config.baudRate}
              onChange={(e) =>
                onConfigChange({
                  ...config,
                  baudRate: parseInt(e.target.value) || 2000000,
                })
              }
              className="w-full px-2 py-1 text-sm border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500"
              disabled={isConnected}
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">
              CAN波特率
            </label>
            <input
              type="number"
              value={config.canBaudRate}
              onChange={(e) =>
                onConfigChange({
                  ...config,
                  canBaudRate: parseInt(e.target.value) || 500000,
                })
              }
              className="w-full px-2 py-1 text-sm border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500"
              disabled={isConnected}
            />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-2">
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">
              帧类型
            </label>
            <select
              value={config.frameType}
              onChange={(e) =>
                onConfigChange({ ...config, frameType: e.target.value })
              }
              className="w-full px-2 py-1 text-sm border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500"
              disabled={isConnected}
            >
              <option value="standard">标准帧</option>
              <option value="extended">扩展帧</option>
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">
              CAN模式
            </label>
            <select
              value={config.canMode}
              onChange={(e) =>
                onConfigChange({ ...config, canMode: e.target.value })
              }
              className="w-full px-2 py-1 text-sm border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500"
              disabled={isConnected}
            >
              <option value="normal">正常模式</option>
              <option value="loopback">回环模式</option>
              <option value="listen">监听模式</option>
            </select>
          </div>
        </div>

        <button
          onClick={onConnect}
          className={`w-full px-4 py-2 rounded-md text-sm font-medium transition-colors ${
            isConnected
              ? "bg-red-600 hover:bg-red-700 text-white"
              : "bg-green-600 hover:bg-green-700 text-white"
          }`}
        >
          {isConnected ? (
            <>
              <WifiOff className="w-4 h-4 inline mr-2" />
              断开连接
            </>
          ) : (
            <>
              <Wifi className="w-4 h-4 inline mr-2" />
              连接
            </>
          )}
        </button>
      </div>
    </div>
  );
};
