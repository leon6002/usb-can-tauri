export interface SerialConfig {
  port: string;
  baudRate: number;
  canBaudRate: number;
  frameType: "standard" | "extended";
  protocolLength: "fixed" | "variable";
  canMode: string;
  csvFilePath?: string;
  csvContent?: string;
  sendIntervalMs?: number;
  canIdColumnIndex?: number;
  canDataColumnIndex?: number;
  csvStartRowIndex?: number;
}

// 示例CSV数据行（用于 loadDefaultCsv 内部）
export interface CsvRow {
  can_id: string;
  can_data: string;
  interval_ms: number;
}
