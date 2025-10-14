export interface CanMessage {
  id: string;
  data: string;
  timestamp: string;
  direction: "sent" | "received";
  frameType: "standard" | "extended";
}

export interface CanCommand {
  id: string;
  name: string;
  canId: string;
  data: string;
  description: string;
}
