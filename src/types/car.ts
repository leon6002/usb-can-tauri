export interface CarStates {
  isDriving: boolean;
  leftDoorStatus: string;
  rightDoorStatus: string;
  fanLevel: number;
  lightMode: number;
}

export type Scene3DStatus = "loading" | "ready" | "error";

export type ActiveTab = "car" | "config" | "buttons";
