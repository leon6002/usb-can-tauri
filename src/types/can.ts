export interface CanMessage {
  id: string;
  data: string;
  rawData?: string; // 原始十六进制数据
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
