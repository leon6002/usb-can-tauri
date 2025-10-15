export interface CarStates {
  isDriving: boolean;
  leftDoorStatus: string;
  rightDoorStatus: string;
  fanLevel: number;
  lightMode: number;
  suspensionStatus: string;
}

export type Scene3DStatus = "loading" | "ready" | "error";

export type ActiveTab = "car" | "config" | "buttons";
