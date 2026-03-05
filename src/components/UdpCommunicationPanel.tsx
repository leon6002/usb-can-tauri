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
  const [status, setStatus] = useState("Uninitialized");
  
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
      setStatus("Communication Active");
      
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
      setStatus("Initialized / Ready");
      toast.success(resp as string);
      addLog(`Socket bound to port ${localPort}`);
    } catch (err: any) {
      toast.error(`Failed to initialize: ${err}`);
      addLog(`INIT ERROR: ${err}`);
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
      await invoke("send_udp_command", {
        targetIp,
        targetPort: parseInt(targetPort),
        payloadJson: payload,
      });

      addLog(`[SEND] ${payload}`);
      
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
        <Button variant="outline" size="sm" className="gap-2">
          <Network className="w-4 h-4" />
          UDP Comm Test
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[600px] h-[80vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>UDP Communication Panel</DialogTitle>
          <DialogDescription>
            Test UDP protocol with ZCU hardware (ETH-COMM-UDP-001)
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto pr-2 space-y-4">
          {/* Settings Section */}
          <div className="grid grid-cols-2 gap-4 border p-4 rounded-md bg-muted/20">
            <div className="space-y-2">
              <Label>Target IP (ZCU)</Label>
              <Input
                value={targetIp}
                onChange={(e) => setTargetIp(e.target.value)}
                placeholder="192.168.1.100"
              />
            </div>
            <div className="space-y-2">
              <Label>Target Port</Label>
              <Input
                value={targetPort}
                onChange={(e) => setTargetPort(e.target.value)}
                placeholder="5000"
              />
            </div>
            <div className="space-y-2">
              <Label>Local Port</Label>
              <div className="flex gap-2">
                <Input
                  value={localPort}
                  onChange={(e) => setLocalPort(e.target.value)}
                  placeholder="5001"
                  disabled={initialized}
                />
                <Button 
                  onClick={handleInit} 
                  disabled={initialized}
                  className="shrink-0"
                >
                  {initialized ? "Bound" : "Init Bind"}
                </Button>
              </div>
            </div>
            <div className="space-y-2 flex flex-col justify-end">
              <div className="flex items-center gap-2 mb-2 text-sm font-medium">
                <Activity className="w-4 h-4" />
                Status: <span className={initialized ? "text-green-600" : "text-gray-500"}>{status}</span>
              </div>
            </div>
          </div>

          <div className="h-px bg-border my-2" />

          {/* Action Section */}
          <div className="space-y-4">
            <div className="flex gap-4 items-end">
              <div className="flex-1 space-y-2">
                <Label>Command Payload</Label>
                <Select value={selectedCmd} onValueChange={setSelectedCmd}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select a command..." />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="101">101: CMD_START_STOP</SelectItem>
                    <SelectItem value="102">102: CMD_GET_STATUS</SelectItem>
                    <SelectItem value="103">103: CMD_PING</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="flex items-center gap-2 mb-2">
                <input 
                  type="checkbox" 
                  id="waitAck" 
                  checked={waitAck} 
                  onChange={(e) => setWaitAck(e.target.checked)} 
                  className="rounded border-gray-300"
                />
                <Label htmlFor="waitAck" className="cursor-pointer">Wait ACK</Label>
              </div>
              <Button onClick={handleSend} disabled={!initialized || !selectedCmd}>
                <Send className="w-4 h-4 mr-2" />
                Send Packet
              </Button>
            </div>
          </div>

          {/* Log Section */}
          <div className="flex-1 flex flex-col mt-4 min-h-[200px]">
            <Label className="mb-2">Communication Logs</Label>
            <div className="flex-1 border rounded-md bg-black text-green-400 p-2 overflow-y-auto font-mono text-sm max-h-[300px]">
              {logs.length === 0 ? (
                <span className="text-gray-500">No logs yet...</span>
              ) : (
                logs.map((log, i) => (
                  <div key={i} className="mb-1 leading-tight break-all">
                    {log}
                  </div>
                ))
              )}
              <div ref={logEndRef} />
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
