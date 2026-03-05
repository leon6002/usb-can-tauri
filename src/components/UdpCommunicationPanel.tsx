import { useState, useEffect, useRef } from "react";
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { Network, Send, Activity } from "lucide-react";
import { toast } from "sonner";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Label } from "./ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "./ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "./ui/select";

// Type map for UDP events
interface UdpMessagePayload {
  data: string;
  sender: string;
}

export function UdpCommunicationPanel() {
  const [isOpen, setIsOpen] = useState(false);
  const [targetIp, setTargetIp] = useState("192.168.1.100");
  const [targetPort, setTargetPort] = useState("5000");
  const [localPort, setLocalPort] = useState("5001");
  const [initialized, setInitialized] = useState(false);
  const [selectedCmd, setSelectedCmd] = useState("");
  const [waitAck, setWaitAck] = useState(true);
  const [logs, setLogs] = useState<string[]>([]);
  
  // Sequence number for commands
  const seqRef = useRef(1001);
  const logEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // Auto scroll logs
    if (logEndRef.current) {
      logEndRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [logs]);

  useEffect(() => {
    // Setup listener
    const unlisten = listen<UdpMessagePayload>("udp-message-received", (event) => {
      const msg = event.payload;
      addLog(`[RECV from ${msg.sender}] ${msg.data}`);

      
      // Attempt to parse JSON
      try {
        const json = JSON.parse(msg.data);
        if (json.body && json.body.cmd_code === 200) {
           // We got an ACK
           toast.success("Received ACK from ZCU");
        }
      } catch (e) {
        // Not a JSON or different format, ignore silently
      }
    });

    return () => {
      unlisten.then(f => f());
    };
  }, []);

  const addLog = (msg: string) => {
    setLogs((prev) => [...prev, `${new Date().toLocaleTimeString()} - ${msg}`]);
  };

  const handleInit = async () => {
    try {
      const resp = await invoke("init_udp_socket", {
        localPort: parseInt(localPort),
      });
      setInitialized(true);
      toast.success(resp as string);
      addLog(`Socket bound to port ${localPort}`);
    } catch (err: any) {
      toast.error(`Failed to initialize: ${err}`);
      addLog(`INIT ERROR: ${err}`);
    }
  };

  const handleUnbind = async () => {
    try {
      await invoke("close_udp_socket");
      setInitialized(false);
      toast.info("Socket unbound");
      addLog("Socket unbound.");
    } catch (err: any) {
      toast.error(`Failed to unbind: ${err}`);
      addLog(`UNBIND ERROR: ${err}`);
    }
  };

  const generatePayload = () => {
    const header = {
      seq: seqRef.current++,
      timestamp: Math.floor(Date.now() / 1000),
      source: "PC_HOST"
    };
    
    let body = { cmd_code: 0, parameters: {} };
    switch (selectedCmd) {
      case "101":
        body = { cmd_code: 101, parameters: { Interface_id: 0 } };
        break;
      case "102":
        body = { cmd_code: 102, parameters: {} };
        break;
      case "103":
        body = { cmd_code: 103, parameters: {} };
        break;
      default:
        return null;
    }
    
    return JSON.stringify({ header, body });
  };

  const handleSend = async () => {
    if (!initialized) {
      toast.error("Please initialize socket first");
      return;
    }

    if (!selectedCmd) {
      toast.error("Please select a command");
      return;
    }

    const payload = generatePayload();
    if (!payload) return;

    try {
      addLog(`[SEND] ${payload}`);
      await invoke("send_udp_command", {
        targetIp,
        targetPort: parseInt(targetPort),
        payloadJson: payload,
      });
      
      if (waitAck) {
        // Wait 2 seconds, if status hasn't changed or we can manually track ACK
        // For simplicity in UI, we just prompt if no immediate message.
        // A more robust way is to store the seq and track if ACK matches.
        const currentSeq = seqRef.current - 1;
        setTimeout(() => {
           // Basic timeout checker log
           addLog(`[INFO] Checked Wait ACK for seq ${currentSeq}.`);
        }, 2000);
      }
    } catch (err: any) {
      toast.error(`Send Failed: ${err}`);
      addLog(`SEND ERROR: ${err}`);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="gap-2 bg-slate-900 text-cyan-400 border-cyan-800 hover:bg-slate-800 hover:text-cyan-300">
          <Network className="w-4 h-4" />
          UDP Comm Test
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[700px] h-[85vh] flex flex-col bg-slate-950 text-slate-200 border-slate-800">
        <DialogHeader>
          <DialogTitle className="text-cyan-400 flex items-center gap-2">
            <Activity className="w-5 h-5" />
            UDP Communication Console
          </DialogTitle>
          <DialogDescription className="text-slate-400">
            Hardware interface testing utility bridging PC and ZCU over UDP.
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 flex flex-col overflow-hidden gap-4 mt-2">
          
          {/* Top Bar: Local Listener Status */}
          <div className="flex items-center justify-between bg-slate-900 border border-slate-800 rounded-lg p-3">
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2">
                <div className={`w-2 h-2 rounded-full ${initialized ? 'bg-cyan-500 shadow-[0_0_8px_rgba(6,182,212,0.8)]' : 'bg-slate-600'}`} />
                <span className="text-sm font-medium text-slate-300">{initialized ? "LISTENER ACTIVE" : "OFFLINE"}</span>
              </div>
              <div className="h-4 w-px bg-slate-700 mx-2" />
              <div className="flex items-center gap-2">
                <Label className="text-xs text-slate-400 uppercase tracking-wider">Local Port</Label>
                <Input
                  value={localPort}
                  onChange={(e) => setLocalPort(e.target.value)}
                  placeholder="5001"
                  disabled={initialized}
                  className="w-20 h-8 bg-slate-950 border-slate-700 text-cyan-300 font-mono text-sm"
                />
              </div>
            </div>
            <div>
              {!initialized ? (
                <Button onClick={handleInit} size="sm" className="bg-cyan-600 hover:bg-cyan-500 text-white h-8 px-4">
                  Start Listen
                </Button>
              ) : (
                <Button onClick={handleUnbind} size="sm" variant="destructive" className="bg-red-900/80 hover:bg-red-800 text-red-200 border border-red-800 h-8 px-4">
                  Stop Listen
                </Button>
              )}
            </div>
          </div>

          {/* Middle: Big Log Terminal */}
          <div className="flex-1 flex flex-col min-h-[300px]">
            <div className="flex items-center justify-between mb-2">
              <Label className="text-xs text-slate-400 uppercase tracking-wider flex items-center gap-2">
                <Network className="w-3 h-3" />
                Terminal Logs
              </Label>
              <Button variant="ghost" size="sm" onClick={() => setLogs([])} className="h-6 text-xs text-slate-500 hover:text-slate-300">
                Clear
              </Button>
            </div>
            <div className="flex-1 border border-slate-800 rounded-lg bg-[#0a0f18] text-emerald-400 p-3 overflow-y-auto font-mono text-[13px] leading-relaxed relative shadow-inner">
              {logs.length === 0 ? (
                <span className="text-slate-700 select-none">Waiting for incoming transmission...</span>
              ) : (
                logs.map((log, i) => {
                  const isSend = log.includes("[SEND]");
                  const isErr = log.includes("ERROR:");
                  return (
                    <div key={i} className={`mb-1 break-all ${isSend ? 'text-cyan-400' : isErr ? 'text-red-400' : 'text-emerald-400'}`}>
                      {log}
                    </div>
                  );
                })
              )}
              <div ref={logEndRef} />
            </div>
          </div>

          {/* Bottom: Send Control Deck */}
          <div className="bg-slate-900 border border-slate-800 rounded-lg p-4 space-y-4">
            
            {/* Target Settings */}
            <div className="flex gap-4">
              <div className="flex-1 space-y-1.5">
                <Label className="text-xs text-slate-400 uppercase tracking-wider">Target IP</Label>
                <Input
                  value={targetIp}
                  onChange={(e) => setTargetIp(e.target.value)}
                  placeholder="192.168.1.100"
                  className="h-8 bg-slate-950 border-slate-700 text-slate-200 font-mono text-sm"
                />
              </div>
              <div className="w-24 space-y-1.5">
                <Label className="text-xs text-slate-400 uppercase tracking-wider">Port</Label>
                <Input
                  value={targetPort}
                  onChange={(e) => setTargetPort(e.target.value)}
                  placeholder="5000"
                  className="h-8 bg-slate-950 border-slate-700 text-slate-200 font-mono text-sm"
                />
              </div>
            </div>

            {/* Command & Execute */}
            <div className="flex items-end gap-3">
              <div className="flex-1 space-y-1.5">
                <Label className="text-xs text-slate-400 uppercase tracking-wider">Payload</Label>
                <Select value={selectedCmd} onValueChange={setSelectedCmd}>
                  <SelectTrigger className="h-9 bg-slate-950 border-slate-700 text-cyan-300 font-mono text-sm">
                    <SelectValue placeholder="Select packet type..." />
                  </SelectTrigger>
                  <SelectContent className="bg-slate-900 border-slate-700">
                    <SelectItem value="101" className="text-slate-200 font-mono text-xs focus:bg-slate-800 focus:text-cyan-300">101: CMD_START_STOP</SelectItem>
                    <SelectItem value="102" className="text-slate-200 font-mono text-xs focus:bg-slate-800 focus:text-cyan-300">102: CMD_GET_STATUS</SelectItem>
                    <SelectItem value="103" className="text-slate-200 font-mono text-xs focus:bg-slate-800 focus:text-cyan-300">103: CMD_PING</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              
              <div className="flex items-center gap-2 mb-2 px-2">
                <input 
                  type="checkbox" 
                  id="waitAck" 
                  checked={waitAck} 
                  onChange={(e) => setWaitAck(e.target.checked)} 
                  className="rounded border-slate-600 bg-slate-950 text-cyan-500 accent-cyan-500"
                />
                <Label htmlFor="waitAck" className="cursor-pointer text-xs text-slate-400 uppercase tracking-wider">Ack Info</Label>
              </div>

              <Button 
                onClick={handleSend} 
                disabled={!initialized || !selectedCmd}
                className="h-9 bg-cyan-600 hover:bg-cyan-500 text-white min-w-[120px] shadow-[0_0_15px_rgba(6,182,212,0.3)] disabled:opacity-50 disabled:shadow-none transition-all"
              >
                <Send className="w-4 h-4 mr-2" />
                Transmit
              </Button>
            </div>
          </div>
          
        </div>
      </DialogContent>
    </Dialog>
  );
}
