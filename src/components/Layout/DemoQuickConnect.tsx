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
import { useSerialStore } from "@/store/serialStore";

export const DemoQuickConnect: React.FC = () => {
  const isConnected = useSerialStore((state) => state.isConnected);
  const connectToPort = useSerialStore((state) => state.connectToPort);
  const handleDisconnect = useSerialStore((state) => state.handleDisconnect);
  const demoConfig = getDemoQuickConnect();
  const [port, setPort] = useState(demoConfig?.port || undefined);
  const [availablePorts, setAvailablePorts] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isLoadingPorts, setIsLoadingPorts] = useState(false);

  // connect to port
  const onConnect = async (port: string) => {
    try {
      await connectToPort(port);
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      toast.error(`Connection failed: ${errorMessage}`);
      console.error("Demo connect error:", error);
    }
  };

  // fetch ports
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

  // refresh ports
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
    if (!port) {
      toast.error("Please select a port");
      return;
    }
    setIsLoading(true);
    try {
      onConnect(port);
      toast.success(`Connected to port: ${port}`);
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      toast.error(`Connect failed: ${errorMessage}`);
      console.error("Connection error:", error);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="p-4 bg-white rounded-lg shadow-md border border-gray-200">
      {/* Port Select */}
      <div className="mb-3">
        <div className="flex gap-2">
          <Select value={port} onValueChange={setPort} disabled={isConnected}>
            <SelectTrigger className="flex-1 cursor-pointer">
              <SelectValue placeholder="Select a port to connect..." />
            </SelectTrigger>
            <SelectContent>
              {availablePorts.length > 0 ? (
                availablePorts.map((p) => (
                  <SelectItem key={p} value={p} className="cursor-pointer">
                    {p}
                  </SelectItem>
                ))
              ) : (
                <SelectItem value="no-ports" disabled>
                  No ports detected
                </SelectItem>
              )}
            </SelectContent>
          </Select>

          {/* Refresh Button */}
          <button
            onClick={handleRefreshPorts}
            disabled={isConnected || isLoadingPorts}
            className="px-3 py-2 rounded-md border border-gray-300 bg-white hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            title="refresh ports"
          >
            <RefreshCw
              className={`w-4 h-4 ${isLoadingPorts ? "animate-spin" : ""}`}
            />
          </button>
        </div>
      </div>

      {/* Connect/Disconnect Button */}
      <button
        onClick={isConnected ? () => handleDisconnect() : handleConnect}
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
            {"Disconnect"}
          </>
        ) : (
          <>
            <Zap className={`w-4 h-4 ${!isLoading ? "animate-pulse" : ""}`} />
            {"Connect"}
          </>
        )}
      </button>
    </div>
  );
};
