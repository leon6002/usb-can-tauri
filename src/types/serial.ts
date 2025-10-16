export interface SerialConfig {
  port: string;
  baudRate: number;
  canBaudRate: number;
  frameType: string;
  protocolLength: string;
  canMode: string;
  csvFilePath?: string;
  csvContent?: string;
  sendIntervalMs?: number;
  canIdColumnIndex?: number;
  canDataColumnIndex?: number;
  csvStartRowIndex?: number;
}
