import React, { useEffect, useRef, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import {
  Terminal, FileCode, Send, Trash2, Activity, ArrowUpFromLine,
  Wifi, WifiOff, Pause, Play, Download, Square, EyeOff, Eye, Cpu,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { CanMessage } from "@/types";
import { useCanMessageStore } from "@/store/canMessageStore";
import { useCarControlStore } from "@/store/carControlStore";
import { validateCanId } from "@/utils/validation";

type DebugTab = "rxtx" | "tx" | "commands" | "system";

interface SystemMonitorEntry {
  timestamp: string;
  raw: number[];
  parsed: {
    cpu1: number; cpu2: number; cpu3: number; cpu4: number;
    vm0_mem: number; vm1_mem: number;
    steeringControl: number; brakeControl: number;
    bodyControl: number; acSystem: number;
  } | null;
}

const STORAGE_KEY_LIMIT = "debugPanel.renderLimit";

function parseSmData(data: number[]): SystemMonitorEntry["parsed"] {
  if (!data || data.length < 18) return null;
  return {
    cpu1: data[2], cpu2: data[3], cpu3: data[4], cpu4: data[5],
    vm0_mem: data[6], vm1_mem: data[7],
    steeringControl: data[14], brakeControl: data[15],
    bodyControl: data[16], acSystem: data[17],
  };
}

// ---- Message list sub-component (shared by RX+TX and TX tabs) ----

interface MessageListPanelProps {
  messages: CanMessage[];
  renderLimit: number;
  isPaused: boolean;
  capLabel: string;
}

const MessageListPanel: React.FC<MessageListPanelProps> = ({
  messages, renderLimit, isPaused, capLabel,
}) => {
  const [pausedSnapshot, setPausedSnapshot] = useState<CanMessage[]>([]);
  const wasPausedRef = useRef(false);

  // Freeze snapshot on pause, clear on resume
  if (isPaused && !wasPausedRef.current) {
    setPausedSnapshot([...messages]);
  }
  if (!isPaused) {
    wasPausedRef.current = false;
  } else {
    wasPausedRef.current = true;
  }

  const displayMessages = (isPaused ? pausedSnapshot : messages).slice(-renderLimit);
  const txCount = messages.filter((m) => m.direction === "sent").length;
  const rxCount = messages.length - txCount;

  return (
    <>
      <div className="flex items-center justify-between mb-2">
        <h3 className="text-sm font-semibold text-gray-700">
          {capLabel} | TX: {txCount} | RX: {rxCount}
          {isPaused && <span className="text-amber-500 ml-2">PAUSED</span>}
        </h3>
      </div>
      {messages.length === 0 ? (
        <div className="text-center text-gray-400 py-20 text-sm">
          No messages yet. Connect serial and send or receive CAN data.
        </div>
      ) : (
        <div className="space-y-1.5">
          {displayMessages.slice().reverse().map((msg, i) => (
            <div
              key={`${msg.timestamp}-${i}`}
              className={`p-2.5 rounded border-l-4 text-xs font-mono ${
                msg.direction === "sent"
                  ? "bg-blue-50 border-blue-400"
                  : "bg-green-50 border-green-400"
              }`}
            >
              <div className="flex items-center gap-2 mb-1">
                <span
                  className={`px-1.5 py-0.5 rounded text-[10px] font-semibold ${
                    msg.direction === "sent"
                      ? "bg-blue-200 text-blue-800"
                      : "bg-green-200 text-green-800"
                  }`}
                >
                  {msg.direction === "sent" ? "TX" : "RX"}
                </span>
                <span className="text-gray-500">{msg.timestamp}</span>
                <span className="text-gray-400">{msg.frameType}</span>
              </div>
              <div className="flex gap-3">
                <span>
                  <span className="text-gray-500">ID: </span>
                  <span className="text-gray-900 font-semibold">{msg.id}</span>
                </span>
                <span className="truncate">
                  <span className="text-gray-500">Data: </span>
                  <span className="text-gray-700">{msg.data}</span>
                </span>
              </div>
              {msg.rawData && (
                <div className="text-[10px] text-gray-400 mt-1 truncate">Raw: {msg.rawData}</div>
              )}
            </div>
          ))}
        </div>
      )}
    </>
  );
};

// ---- Main window component ----

const DebugPanelWindow: React.FC = () => {
  const [activeTab, setActiveTab] = useState<DebugTab>("rxtx");
  const [isConnected, setIsConnected] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [sendId, setSendId] = useState("123");
  const [sendData, setSendData] = useState("01 FF FF FF 00 00 00 00");
  const [csvPath, setCsvPath] = useState("");
  const [csvLogging, setCsvLogging] = useState(false);
  const [renderLimit, setRenderLimit] = useState(() => {
    const saved = localStorage.getItem(STORAGE_KEY_LIMIT);
    return saved ? parseInt(saved, 10) || 200 : 200;
  });

  const messages = useCanMessageStore((state) => state.messages);
  const txMessages = useCanMessageStore((state) => state.txMessages);
  const clearMessages = useCanMessageStore((state) => state.clearMessages);
  const canCommands = useCarControlStore((state) => state.canCommands);
  const updateCanCommand = useCarControlStore((state) => state.updateCanCommand);

  // System monitor data
  const [smEntries, setSmEntries] = useState<SystemMonitorEntry[]>([]);
  const [smConnected, setSmConnected] = useState(false);
  const [smPaused, setSmPaused] = useState(false);
  const smSnapshotRef = useRef<SystemMonitorEntry[]>([]);

  // ID filter: click a CAN ID to hide/show messages with that ID
  const [hiddenIds, setHiddenIds] = useState<Set<string>>(new Set());
  const toggleIdFilter = (id: string) => {
    setHiddenIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  // Derive unique IDs from current messages
  const uniqueIds = [...new Set(messages.map((m) => m.id))].sort();

  // Filtered messages for display
  const filteredMessages = messages.filter((m) => !hiddenIds.has(m.id));

  // Setup listeners on mount
  useEffect(() => {
    useCanMessageStore.getState().setupCanMessageListener();

    let unlistenStatus: (() => void) | null = null;
    listen<any>("serial-status", (event) => {
      setIsConnected(event.payload.connected === true);
    }).then((u) => { unlistenStatus = u; });

    invoke<boolean>("get_connection_status").then(setIsConnected).catch(() => setIsConnected(false));
    const poll = setInterval(() => {
      invoke<boolean>("get_connection_status").then(setIsConnected).catch(() => {});
    }, 5000);

    invoke<{ enabled: boolean; path: string | null }>("get_csv_log_status")
      .then((s) => { setCsvLogging(s.enabled); if (s.path) setCsvPath(s.path); })
      .catch(() => {});

    // Listen for system monitor data
    let unlistenSm: (() => void) | null = null;
    listen<number[]>("system-monitor-data", (event) => {
      const raw = event.payload;
      const parsed = parseSmData(raw);
      setSmEntries((prev) => {
        const next = [...prev, { timestamp: new Date().toLocaleTimeString(), raw, parsed }];
        return next.length > 50 ? next.slice(-50) : next;
      });
      if (parsed) setSmConnected(true);
    }).then((u) => { unlistenSm = u; });

    return () => {
      useCanMessageStore.getState().cleanupCanMessageListener();
      unlistenStatus?.(); unlistenSm?.(); clearInterval(poll);
      useCanMessageStore.getState().cleanupCanMessageListener();
      unlistenStatus?.(); clearInterval(poll);
    };
  }, []);

  const handleSendMessage = async () => {
    try {
      const v = validateCanId(sendId, "standard");
      if (!v.valid) { console.warn("[DebugPanel] Invalid CAN ID:", v.error); return; }
      await invoke("send_can_message", { id: sendId, data: sendData, frameType: "standard", protocolLength: "fixed" });
    } catch (error) { console.error("[DebugPanel] Send failed:", error); }
  };

  const handleStartCsv = async () => {
    if (!csvPath) return;
    try { await invoke("start_csv_logging", { path: csvPath }); setCsvLogging(true); }
    catch (e) { console.error(e); }
  };
  const handleStopCsv = async () => {
    try { await invoke("stop_csv_logging"); setCsvLogging(false); }
    catch (e) { console.error(e); }
  };

  const isMessageTab = activeTab === "rxtx" || activeTab === "tx";

  const tabs = [
    { key: "rxtx" as const, label: "RX+TX", icon: Activity },
    { key: "tx" as const, label: "TX", icon: ArrowUpFromLine },
    { key: "system" as const, label: "System", icon: Cpu },
    { key: "commands" as const, label: "Commands", icon: FileCode },
  ];

  return (
    <div className="flex flex-col h-screen bg-gray-100">
      {/* Header */}
      <div className="bg-gray-900 text-white px-6 py-3 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Terminal className="w-5 h-5 text-emerald-400" />
          <h1 className="text-lg font-semibold">Debug Panel</h1>
        </div>
        <div className="flex items-center gap-3 text-sm">
          {csvLogging && <span className="flex items-center gap-1 text-amber-400 text-xs"><Download className="w-3 h-3" /> CSV recording</span>}
          {isConnected
            ? <span className="flex items-center gap-1.5 text-emerald-400"><Wifi className="w-4 h-4" /> Connected</span>
            : <span className="flex items-center gap-1.5 text-red-400"><WifiOff className="w-4 h-4" /> Disconnected</span>}
        </div>
      </div>

      {/* Tab bar */}
      <div className="bg-gray-800 border-b border-gray-700 flex items-center justify-between pr-3">
        <div className="flex">
          {tabs.map((tab) => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`flex items-center gap-2 px-5 py-2.5 text-sm font-medium transition-colors border-b-2 ${
                activeTab === tab.key
                  ? "text-emerald-400 border-emerald-400 bg-gray-900/50"
                  : "text-gray-400 border-transparent hover:text-gray-200 hover:bg-gray-700/30"
              }`}
            >
              <tab.icon className="w-4 h-4" />
              {tab.label}
            </button>
          ))}
        </div>
        {/* CSV controls (visible on message tabs) */}
        {isMessageTab && (
          <div className="flex items-center gap-2">
            <Input
              type="text" value={csvPath} onChange={(e) => setCsvPath(e.target.value)}
              placeholder="CSV file path (e.g. C:\logs\can.csv)" disabled={csvLogging}
              className="h-7 text-xs font-mono w-80 bg-gray-700 border-gray-600 text-gray-200 placeholder-gray-500"
            />
            {csvLogging ? (
              <Button onClick={handleStopCsv} size="sm" className="h-7 text-xs bg-red-600 hover:bg-red-700"><Square className="w-3 h-3 mr-1" /> Stop</Button>
            ) : (
              <Button onClick={handleStartCsv} size="sm" disabled={!csvPath} className="h-7 text-xs"
                title="Enter a file path above, then click Record to start logging all CAN RX/TX messages to CSV">
                <Download className="w-3 h-3 mr-1" /> Record CSV
              </Button>
            )}
          </div>
        )}
      </div>

      {/* Tab content */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* ---- RX+TX Tab ---- */}
        {activeTab === "rxtx" && (
          <div className="flex-1 flex flex-col overflow-hidden">
            <div className="bg-white border-b border-gray-200 p-3">
              <div className="flex items-end gap-3">
                <div className="w-28">
                  <Label className="text-xs font-medium mb-1 block">CAN ID (HEX)</Label>
                  <Input type="text" value={sendId} onChange={(e) => setSendId(e.target.value)} disabled={!isConnected} className="h-8 text-xs font-mono" />
                </div>
                <div className="flex-1">
                  <Label className="text-xs font-medium mb-1 block">CAN DATA (HEX)</Label>
                  <Input type="text" value={sendData} onChange={(e) => setSendData(e.target.value)} disabled={!isConnected} className="h-8 text-xs font-mono" />
                </div>
                <Button onClick={handleSendMessage} disabled={!isConnected} size="sm" className="h-8 text-xs"><Send className="w-3 h-3 mr-1" /> Send</Button>
                <Button onClick={() => setIsPaused(!isPaused)} size="sm" variant="outline" className="h-8 text-xs">
                  {isPaused ? <Play className="w-3 h-3 mr-1" /> : <Pause className="w-3 h-3 mr-1" />}{isPaused ? "Resume" : "Pause"}
                </Button>
                <Button onClick={clearMessages} size="sm" variant="outline" className="h-8 text-xs"><Trash2 className="w-3 h-3 mr-1" /> Clear</Button>
                <div className="flex items-center gap-1 ml-2">
                  <span className="text-xs text-gray-500">Show</span>
                  <input type="number" value={renderLimit}
                    onChange={(e) => { const v = Math.max(10, Math.min(1000, parseInt(e.target.value) || 200)); setRenderLimit(v); localStorage.setItem(STORAGE_KEY_LIMIT, String(v)); }}
                    className="w-14 h-7 text-xs text-center border border-gray-300 rounded" min={10} max={1000} />
                </div>
              </div>
            </div>
            <div className="flex-1 overflow-y-auto bg-gray-50 p-3">
              {/* ID filter bar */}
              {uniqueIds.length > 0 && (
                <div className="flex items-center gap-1.5 mb-2 flex-wrap">
                  <span className="text-[10px] text-gray-500 mr-1">Filter:</span>
                  {uniqueIds.map((id) => {
                    const hidden = hiddenIds.has(id);
                    return (
                      <button
                        key={id}
                        onClick={() => toggleIdFilter(id)}
                        className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-mono font-medium transition-colors ${
                          hidden
                            ? "bg-gray-200 text-gray-400 line-through"
                            : "bg-blue-100 text-blue-700 hover:bg-blue-200"
                        }`}
                        title={hidden ? `Show ${id}` : `Hide ${id}`}
                      >
                        {id}
                        {hidden ? <Eye className="w-3 h-3" /> : <EyeOff className="w-3 h-3" />}
                      </button>
                    );
                  })}
                  {hiddenIds.size > 0 && (
                    <button
                      onClick={() => setHiddenIds(new Set())}
                      className="text-[10px] text-amber-600 hover:text-amber-800 ml-1"
                    >
                      Clear filter
                    </button>
                  )}
                </div>
              )}
              <MessageListPanel messages={filteredMessages} renderLimit={renderLimit} isPaused={isPaused} capLabel={`All Messages (${filteredMessages.length}/${messages.length})`} />
            </div>
          </div>
        )}

        {/* ---- TX Tab ---- */}
        {activeTab === "tx" && (
          <div className="flex-1 flex flex-col overflow-hidden">
            <div className="bg-white border-b border-gray-200 p-3">
              <div className="flex items-end gap-3">
                <div className="w-28">
                  <Label className="text-xs font-medium mb-1 block">CAN ID (HEX)</Label>
                  <Input type="text" value={sendId} onChange={(e) => setSendId(e.target.value)} disabled={!isConnected} className="h-8 text-xs font-mono" />
                </div>
                <div className="flex-1">
                  <Label className="text-xs font-medium mb-1 block">CAN DATA (HEX)</Label>
                  <Input type="text" value={sendData} onChange={(e) => setSendData(e.target.value)} disabled={!isConnected} className="h-8 text-xs font-mono" />
                </div>
                <Button onClick={handleSendMessage} disabled={!isConnected} size="sm" className="h-8 text-xs"><Send className="w-3 h-3 mr-1" /> Send</Button>
                <Button onClick={() => setIsPaused(!isPaused)} size="sm" variant="outline" className="h-8 text-xs">
                  {isPaused ? <Play className="w-3 h-3 mr-1" /> : <Pause className="w-3 h-3 mr-1" />}{isPaused ? "Resume" : "Pause"}
                </Button>
                <Button onClick={clearMessages} size="sm" variant="outline" className="h-8 text-xs"><Trash2 className="w-3 h-3 mr-1" /> Clear</Button>
                <div className="flex items-center gap-1 ml-2">
                  <span className="text-xs text-gray-500">Show</span>
                  <input type="number" value={renderLimit}
                    onChange={(e) => { const v = Math.max(10, Math.min(1000, parseInt(e.target.value) || 200)); setRenderLimit(v); localStorage.setItem(STORAGE_KEY_LIMIT, String(v)); }}
                    className="w-14 h-7 text-xs text-center border border-gray-300 rounded" min={10} max={1000} />
                </div>
              </div>
            </div>
            <div className="flex-1 overflow-y-auto bg-gray-50 p-3">
              <MessageListPanel messages={txMessages} renderLimit={renderLimit} isPaused={isPaused} capLabel={`TX Only (${txMessages.length} sent)`} />
            </div>
          </div>
        )}

        {/* ---- System Tab ---- */}
        {activeTab === "system" && (() => {
          const displayEntries = smPaused ? smSnapshotRef.current : smEntries;
          const latest = displayEntries.length > 0 ? displayEntries[displayEntries.length - 1] : null;
          const isPercent = (label: string) => label.startsWith("CPU") || label.startsWith("VM");
          const statusColor = (v: number) => v === 2 ? "text-emerald-600" : v === 1 ? "text-amber-600" : "text-red-600";
          return (
          <div className="flex-1 overflow-y-auto bg-gray-50 p-4">
            <div className="flex items-center gap-2 mb-3">
              <Cpu className="w-4 h-4" />
              <h3 className="text-sm font-semibold text-gray-700">
                System Monitor Data
                {smConnected
                  ? <span className="text-emerald-500 ml-2 text-xs">● Live</span>
                  : <span className="text-gray-400 ml-2 text-xs">○ Waiting for data</span>}
                {smPaused && <span className="text-amber-500 ml-2 text-xs">PAUSED</span>}
              </h3>
              <span className="text-xs text-gray-400 ml-auto">{displayEntries.length} entries</span>
              <Button onClick={() => { if (!smPaused) smSnapshotRef.current = [...smEntries]; setSmPaused(!smPaused); }}
                size="sm" variant="outline" className="h-7 text-xs">
                {smPaused ? <Play className="w-3 h-3 mr-1" /> : <Pause className="w-3 h-3 mr-1" />}
                {smPaused ? "Resume" : "Pause"}
              </Button>
            </div>

            {/* Latest parsed values */}
            {latest?.parsed && (
              <div className="grid grid-cols-5 gap-2 mb-3">
                {([
                  ["CPU1", latest.parsed.cpu1],
                  ["CPU2", latest.parsed.cpu2],
                  ["CPU3", latest.parsed.cpu3],
                  ["CPU4", latest.parsed.cpu4],
                  ["VM0 Mem", latest.parsed.vm0_mem],
                  ["VM1 Mem", latest.parsed.vm1_mem],
                  ["Steering", latest.parsed.steeringControl],
                  ["Brake", latest.parsed.brakeControl],
                  ["Body", latest.parsed.bodyControl],
                  ["AC", latest.parsed.acSystem],
                ] as const).map(([label, val]) => (
                  <div key={label} className="bg-white rounded border border-gray-200 p-2 text-center">
                    <div className="text-[10px] text-gray-500">{label}</div>
                    <div className={`text-sm font-mono font-bold ${isPercent(label) ? "text-gray-800" : statusColor(val)}`}>{val}</div>
                    {isPercent(label) && (
                      <div className="w-full bg-gray-200 h-1 mt-1 rounded">
                        <div className="bg-emerald-500 h-1 rounded" style={{ width: `${Math.min(100, val)}%` }} />
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}

            {/* Raw bytes history */}
            <div className="space-y-1">
              {displayEntries.slice().reverse().slice(0, 30).map((entry, i) => (
                <div key={i} className="bg-white rounded border border-gray-200 p-2 text-xs font-mono">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-gray-400">{entry.timestamp}</span>
                    {entry.parsed && (
                      <span className="text-emerald-600 text-[10px]">
                        CPU:{entry.parsed.cpu1}/{entry.parsed.cpu2}/{entry.parsed.cpu3}/{entry.parsed.cpu4}
                        {" "}Mem:{entry.parsed.vm0_mem}/{entry.parsed.vm1_mem}
                        {" "}St:{entry.parsed.steeringControl} Br:{entry.parsed.brakeControl}
                        {" "}Bd:{entry.parsed.bodyControl} AC:{entry.parsed.acSystem}
                      </span>
                    )}
                  </div>
                  <div className="text-gray-500 break-all">
                    [{entry.raw.join(", ")}]
                  </div>
                </div>
              ))}
              {displayEntries.length === 0 && (
                <div className="text-center text-gray-400 py-10 text-sm">
                  No system monitor data. Connect the system monitor serial port to see data here.
                </div>
              )}
            </div>
          </div>
        )})()}

        {/* ---- Commands Tab ---- */}
        {activeTab === "commands" && (
          <div className="flex-1 overflow-y-auto p-4 bg-gray-50">
            <h3 className="text-sm font-semibold text-gray-700 mb-3">CAN Command Editor ({canCommands.length} commands)</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
              {canCommands.map((cmd) => (
                <div key={cmd.id} className="bg-white rounded-lg shadow-sm border border-gray-200 p-3">
                  <div className="space-y-3">
                    <div>
                      <label className="block text-xs font-medium text-gray-700 mb-1">Name</label>
                      <input type="text" value={cmd.name} onChange={(e) => updateCanCommand(cmd.id, "name", e.target.value)} className="w-full px-2 py-1.5 border border-gray-300 rounded text-xs focus:outline-none focus:ring-2 focus:ring-emerald-500" />
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="block text-xs font-medium text-gray-700 mb-1">CAN ID</label>
                        <input type="text" value={cmd.canId} onChange={(e) => updateCanCommand(cmd.id, "canId", e.target.value)} className="w-full px-2 py-1.5 border border-gray-300 rounded text-xs font-mono focus:outline-none focus:ring-2 focus:ring-emerald-500" />
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-gray-700 mb-1">Data</label>
                        <input type="text" value={cmd.data} onChange={(e) => updateCanCommand(cmd.id, "data", e.target.value)} className="w-full px-2 py-1.5 border border-gray-300 rounded text-xs font-mono focus:outline-none focus:ring-2 focus:ring-emerald-500" />
                      </div>
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-700 mb-1">Description</label>
                      <input type="text" value={cmd.description} onChange={(e) => updateCanCommand(cmd.id, "description", e.target.value)} className="w-full px-2 py-1.5 border border-gray-300 rounded text-xs focus:outline-none focus:ring-2 focus:ring-emerald-500" />
                    </div>
                    <div className="text-[10px] text-gray-400 font-mono">ID: {cmd.id}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default DebugPanelWindow;
