export interface SerialConfig {
  port: string;
  baudRate: number;
  canBaudRate: number;
  frameType: string;
  canMode: string;
  // 回环测试配置
  isLoopbackTest: boolean;
  loopbackPort1: string;
  loopbackPort2: string;
}
