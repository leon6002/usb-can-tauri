import React, { useState, useEffect } from "react";
import { RefreshCw, Zap, ZapOff } from "lucide-react";
import { invoke } from "@tauri-apps/api/core";
import { toast } from "sonner";
import { getDemoQuickConnect } from "../../config/appConfig";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../ui/select";

interface DemoQuickConnectProps {
  isConnected: boolean;
  onConnect: (port: string) => void;
  onDisconnect: () => void;
}

export const DemoQuickConnect: React.FC<DemoQuickConnectProps> = ({
  isConnected,
  onConnect,
  onDisconnect,
}) => {
  const demoConfig = getDemoQuickConnect();
  const [port, setPort] = useState(
    demoConfig?.port || "/dev/tty.usbserial-2110"
  );
  const [availablePorts, setAvailablePorts] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isLoadingPorts, setIsLoadingPorts] = useState(false);

  // 获取可用串口
  useEffect(() => {
    const fetchPorts = async () => {
      setIsLoadingPorts(true);
      try {
        const ports = await invoke<string[]>("get_available_ports");
        setAvailablePorts(ports);
      } catch (error) {
        console.error("Failed to get available ports:", error);
      } finally {
        setIsLoadingPorts(false);
      }
    };

    fetchPorts();
  }, []);

  // 刷新串口列表
  const handleRefreshPorts = async () => {
    setIsLoadingPorts(true);
    try {
      const ports = await invoke<string[]>("get_available_ports");
      setAvailablePorts(ports);
    } catch (error) {
      console.error("Failed to refresh ports:", error);
    } finally {
      setIsLoadingPorts(false);
    }
  };

  const handleConnect = async () => {
    setIsLoading(true);
    try {
      onConnect(port);
      toast.success(`已连接到 ${port}`);
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      toast.error(`连接失败: ${errorMessage}`);
      console.error("Connection error:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleDisconnect = () => {
    onDisconnect();
  };

  return (
    <div className="p-4 bg-white rounded-lg shadow-md border border-gray-200">
      {/* <h3 className="text-sm font-bold text-gray-900 mb-3">快速连接</h3> */}

      {/* Port Select */}
      <div className="mb-3">
        {/* <label className="block text-xs font-medium text-gray-700 mb-1">
          端口快速连接:
        </label> */}
        <div className="flex gap-2">
          <Select value={port} onValueChange={setPort} disabled={isConnected}>
            <SelectTrigger className="flex-1">
              <SelectValue placeholder="选择串口..." />
            </SelectTrigger>
            <SelectContent>
              {availablePorts.length > 0 ? (
                availablePorts.map((p) => (
                  <SelectItem key={p} value={p}>
                    {p}
                  </SelectItem>
                ))
              ) : (
                <SelectItem value="no-ports" disabled>
                  未检测到串口
                </SelectItem>
              )}
            </SelectContent>
          </Select>

          {/* Refresh Button */}
          <button
            onClick={handleRefreshPorts}
            disabled={isConnected || isLoadingPorts}
            className="px-3 py-2 rounded-md border border-gray-300 bg-white hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            title="刷新串口列表"
          >
            <RefreshCw
              className={`w-4 h-4 ${isLoadingPorts ? "animate-spin" : ""}`}
            />
          </button>
        </div>
      </div>

      {/* Connect/Disconnect Button */}
      <button
        onClick={isConnected ? handleDisconnect : handleConnect}
        disabled={isLoading}
        className={`w-full px-4 py-2 text-sm rounded-lg font-medium transition-colors flex items-center justify-center gap-2 ${
          isConnected
            ? "bg-red-100 text-red-700 hover:bg-red-200 border border-red-300"
            : "bg-green-100 text-green-700 hover:bg-green-200 border border-green-300"
        } disabled:opacity-50 disabled:cursor-not-allowed`}
      >
        {isConnected ? (
          <>
            <ZapOff className={`w-4 h-4 ${isLoading ? "animate-pulse" : ""}`} />
            {"断开连接"}
          </>
        ) : (
          <>
            <Zap className={`w-4 h-4 ${!isLoading ? "animate-pulse" : ""}`} />
            {"连接"}
          </>
        )}
      </button>
    </div>
  );
};
