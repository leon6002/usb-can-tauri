import React, { useState, useEffect } from "react";
import { RefreshCw, Zap, ZapOff, Link2, ChevronLeft } from "lucide-react";
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
  const [isExpanded, setIsExpanded] = useState(!isConnected);

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

  // Auto-collapse when connected
  useEffect(() => {
    if (isConnected) {
      setIsExpanded(false);
    }
  }, [isConnected]);

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
      // toast.success(`Connected to port: ${port}`);
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      toast.error(`Connect failed: ${errorMessage}`);
      console.error("Connection error:", error);
    } finally {
      setIsLoading(false);
    }
  };

  // Collapsed View (Icon Only)
  if (!isExpanded) {
    return (
      <button
        onClick={() => setIsExpanded(true)}
        className={`p-3 rounded-full shadow-lg transition-all duration-300 backdrop-blur-md border ${isConnected
          ? "bg-green-500/80 hover:bg-green-600/90 border-green-400 text-white"
          : "bg-black/20 hover:bg-black/30 border-white/10 text-white/80"
          }`}
        title={isConnected ? "Connected" : "Disconnected"}
      >
        <Link2 className={`w-5 h-5 ${isConnected ? "animate-pulse" : ""}`} />
      </button>
    );
  }

  // Expanded View
  return (
    <div className="p-4 bg-black/20 backdrop-blur-md rounded-2xl shadow-xl border border-white/10 w-80 transition-all duration-300 animate-in fade-in slide-in-from-top-2">
      <div className="flex justify-between items-center mb-3">
        <h3 className="text-sm font-bold text-white/90 flex items-center gap-2">
          <Link2 className="w-4 h-4" />
          Connection
        </h3>
        <button
          onClick={() => setIsExpanded(false)}
          className="p-1 hover:bg-white/10 rounded-full text-white/60 hover:text-white transition-colors"
        >
          <ChevronLeft className="w-4 h-4" />
        </button>
      </div>

      {/* Port Select */}
      <div className="mb-3">
        <div className="flex gap-2">
          <Select value={port} onValueChange={setPort} disabled={isConnected}>
            <SelectTrigger className="flex-1 cursor-pointer bg-white/10 border-white/20 text-white placeholder:text-white/40">
              <SelectValue placeholder="Select port..." />
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
            className="px-3 py-2 rounded-md border border-white/20 bg-white/10 hover:bg-white/20 text-white disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
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
        className={`w-full px-4 py-2 text-sm rounded-lg font-medium transition-colors flex items-center justify-center gap-2 ${isConnected
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
