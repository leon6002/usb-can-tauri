import React from "react";
import { Zap, ZapOff } from "lucide-react";
import { useSerialStore } from "@/store/serialStore";

export const ConnectionPanel: React.FC = () => {
  const {
    handleConnect,
    updateConfig: onConfigChange,
    config,
    isConnected,
  } = useSerialStore();

  return (
    <div className="p-3 overflow-y-auto max-h-[calc(100vh-20px)]">
      <h3 className="text-sm font-semibold text-gray-800 mb-2">连接配置</h3>

      <div className="space-y-2">
        <div>
          <label className="block text-xs font-medium text-gray-700 mb-1">
            串口
          </label>
          <input
            type="text"
            value={config.port || ""}
            onChange={(e) =>
              onConfigChange({ ...config, port: e.target.value })
            }
            className="w-full px-2 py-1 text-xs border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500"
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

        <div className="grid gap-2 grid-cols-3">
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">
              协议长度
            </label>
            <select
              value={config.protocolLength}
              onChange={(e) =>
                onConfigChange({
                  ...config,
                  protocolLength: (e.target.value || "fixed") as
                    | "fixed"
                    | "variable",
                })
              }
              className="w-full px-2 py-1 text-sm border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500"
              disabled={isConnected}
            >
              <option value="fixed">FIXED（固定20字节）</option>
              <option value="variable">VARIABLE（可变）</option>
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">
              帧类型
            </label>
            <select
              value={config.frameType}
              onChange={(e) =>
                onConfigChange({
                  ...config,
                  frameType: e.target.value as "standard" | "extended",
                })
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
          onClick={handleConnect}
          className={`w-full px-3 py-3 rounded text-xs font-medium transition-colors ${isConnected
            ? "bg-red-600 hover:bg-red-700 text-white"
            : "bg-green-600 hover:bg-green-700 text-white"
            }`}
        >
          {isConnected ? (
            <>
              <ZapOff className="w-3 h-3 inline mr-1" />
              断开
            </>
          ) : (
            <>
              <Zap className="w-3 h-3 inline mr-1" />
              连接
            </>
          )}
        </button>
      </div>
    </div>
  );
};
