// 单个雷达的距离数据
export interface RadarData {
  id: string; // CAN ID: 0x0521, 0x0522, 0x0523, 0x0524
  distance: number; // 距离值，单位mm
  rawData: string; // 原始16进制数据
  timestamp: string; // 时间戳
}

// 四个雷达的距离数据集合
export interface RadarDistances {
  radar1: RadarData | null; // CAN ID: 0x0521
  radar2: RadarData | null; // CAN ID: 0x0522
  radar3: RadarData | null; // CAN ID: 0x0523
  radar4: RadarData | null; // CAN ID: 0x0524
  lastUpdate: string; // 最后更新时间
}

// 雷达消息接收事件
export interface RadarMessage {
  canId: string;
  data: string;
  timestamp: string;
  distance: number;
}

