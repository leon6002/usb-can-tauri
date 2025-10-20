export interface CarStates {
  isDriving: boolean;
  leftDoorStatus: string;
  rightDoorStatus: string;
  fanLevel: number;
  lightMode: number;
  suspensionStatus: string;
  // 实时 CAN 数据
  currentSpeed: number; // mm/s
  currentSteeringAngle: number; // rad
  // 新协议数据
  gear?: string; // 档位 (P/R/N/D/S)
  steeringAngleDegrees?: number; // 转向角（度数）
}

export type Scene3DStatus = "loading" | "ready" | "error";

export type ActiveTab = "car" | "config" | "buttons";
