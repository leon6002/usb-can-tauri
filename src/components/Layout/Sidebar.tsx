import React from "react";
import {
  Settings,
  // Wifi,
  // WifiOff,
  Car,
  Wrench,
  Gamepad2,
  RefreshCwOff,
  RefreshCw
} from "lucide-react";
import { ActiveTab, SerialConfig } from "../../types";

interface SidebarProps {
  activeTab: ActiveTab;
  setActiveTab: (tab: ActiveTab) => void;
  isConnected: boolean;
  config: SerialConfig;
  onConnect: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
  activeTab,
  setActiveTab,
  isConnected,
  config,
  onConnect,
}) => {
  return (
    <div className="w-64 bg-white shadow-lg flex flex-col">
      {/* Header */}
      <div className="p-4 border-b border-gray-200">
        <div className="flex items-center gap-3">
          <Settings className="w-6 h-6 text-blue-600" />
          <div>
            <h1 className="text-lg font-bold text-gray-900">
              USB-CAN工具
            </h1>
            <div className="flex items-center gap-2 mt-1">
              {isConnected ? (
                <>
                  <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
                  <span className="text-xs text-green-600">已连接</span>
                </>
              ) : (
                <>
                  <div className="w-2 h-2 bg-red-500 rounded-full"></div>
                  <span className="text-xs text-red-600">未连接</span>
                </>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 p-4">
        <div className="space-y-2">
          <button
            onClick={() => setActiveTab("car")}
            className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg font-medium transition-colors ${
              activeTab === "car"
                ? "bg-blue-100 text-blue-700 border border-blue-200"
                : "text-gray-600 hover:bg-gray-100 hover:text-gray-900"
            }`}
          >
            <Car className="w-5 h-5" />
            车辆控制
          </button>
          <button
            onClick={() => setActiveTab("config")}
            className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg font-medium transition-colors ${
              activeTab === "config"
                ? "bg-blue-100 text-blue-700 border border-blue-200"
                : "text-gray-600 hover:bg-gray-100 hover:text-gray-900"
            }`}
          >
            <Wrench className="w-5 h-5" />
            CAN配置
          </button>
          <button
            onClick={() => setActiveTab("buttons")}
            className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg font-medium transition-colors ${
              activeTab === "buttons"
                ? "bg-blue-100 text-blue-700 border border-blue-200"
                : "text-gray-600 hover:bg-gray-100 hover:text-gray-900"
            }`}
          >
            <Gamepad2 className="w-5 h-5" />
            按钮配置
          </button>
        </div>
      </nav>

      {/* Quick Connection Panel */}
      <div className="p-4 border-t border-gray-200">
        <div className="space-y-3">
          <div className="text-xs text-gray-500 font-medium">快速连接</div>
          <div className="flex items-center gap-2 text-xs">
            <span className="text-gray-600">端口:</span>
            <span className="font-mono bg-gray-100 px-2 py-1 rounded">{config.port}</span>
          </div>
          <button
            onClick={onConnect}
            className={`w-full px-3 py-2 rounded-md text-sm font-medium transition-colors ${
              isConnected
                ? "bg-red-100 text-red-700 hover:bg-red-200"
                : "bg-green-100 text-green-700 hover:bg-green-200"
            }`}
          >
            {isConnected ? (
              <>
                <RefreshCwOff className="w-4 h-4 inline mr-2" />
                断开
              </>
            ) : (
              <>
                <RefreshCw className="w-4 h-4 inline mr-2" />
                连接
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};
