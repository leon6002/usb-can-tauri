import { useState } from "react";
import { CarStates, CanCommand } from "../types";

export const useCarControl = () => {
  // Car control commands configuration
  const [canCommands, setCanCommands] = useState<CanCommand[]>([
    {
      id: "left_door_open",
      name: "左门开启",
      canId: "123",
      data: "02",
      description: "打开左车门",
    },
    {
      id: "left_door_close",
      name: "左门关闭",
      canId: "123",
      data: "01",
      description: "关闭左车门",
    },
    {
      id: "left_door_stop",
      name: "左门停止",
      canId: "123",
      data: "00",
      description: "停止左车门",
    },
    {
      id: "right_door_open",
      name: "右门开启",
      canId: "124",
      data: "02",
      description: "打开右车门",
    },
    {
      id: "right_door_close",
      name: "右门关闭",
      canId: "124",
      data: "01",
      description: "关闭右车门",
    },
    {
      id: "right_door_stop",
      name: "右门停止",
      canId: "124",
      data: "00",
      description: "停止右车门",
    },
    {
      id: "fan_level_0",
      name: "风扇档位0",
      canId: "124",
      data: "00",
      description: "风扇关闭",
    },
    {
      id: "fan_level_1",
      name: "风扇档位1",
      canId: "124",
      data: "01",
      description: "风扇低速",
    },
    {
      id: "fan_level_2",
      name: "风扇档位2",
      canId: "124",
      data: "02",
      description: "风扇高速",
    },
    {
      id: "light_mode_1",
      name: "灯带模式1",
      canId: "125",
      data: "00",
      description: "灯带模式1",
    },
    {
      id: "light_mode_2",
      name: "灯带模式2",
      canId: "125",
      data: "01",
      description: "灯带模式2",
    },
    {
      id: "light_mode_3",
      name: "灯带模式3",
      canId: "125",
      data: "02",
      description: "灯带模式3",
    },
    {
      id: "light_mode_4",
      name: "灯带模式4",
      canId: "125",
      data: "03",
      description: "灯带模式4",
    },
    {
      id: "start_driving",
      name: "开始行驶",
      canId: "126",
      data: "01",
      description: "开始车辆行驶动画",
    },
    {
      id: "stop_driving",
      name: "停止行驶",
      canId: "126",
      data: "00",
      description: "停止车辆行驶动画",
    },
    {
      id: "suspension_up",
      name: "悬架升高",
      canId: "127",
      data: "01 02 e3",
      description: "升高车辆悬架",
    },
    {
      id: "suspension_down",
      name: "悬架降低",
      canId: "127",
      data: "02 02 e3",
      description: "降低车辆悬架",
    },
  ]);

  // Car control states
  const [carStates, setCarStates] = useState<CarStates>({
    isDriving: false,
    leftDoorStatus: "停止",
    rightDoorStatus: "停止",
    fanLevel: 0,
    lightMode: 1,
    suspensionStatus: "正常",
  });

  // 更新车辆状态
  const updateCarState = (commandId: string) => {
    setCarStates((prev) => {
      const newState = { ...prev };

      switch (commandId) {
        case "left_door_open":
          newState.leftDoorStatus = "开启";
          break;
        case "left_door_close":
          newState.leftDoorStatus = "关闭";
          break;
        case "left_door_stop":
          newState.leftDoorStatus = "停止";
          break;
        case "right_door_open":
          newState.rightDoorStatus = "开启";
          break;
        case "right_door_close":
          newState.rightDoorStatus = "关闭";
          break;
        case "right_door_stop":
          newState.rightDoorStatus = "停止";
          break;
        case "fan_level_0":
          newState.fanLevel = 0;
          break;
        case "fan_level_1":
          newState.fanLevel = 1;
          break;
        case "fan_level_2":
          newState.fanLevel = 2;
          break;
        case "light_mode_1":
          newState.lightMode = 1;
          break;
        case "light_mode_2":
          newState.lightMode = 2;
          break;
        case "light_mode_3":
          newState.lightMode = 3;
          break;
        case "light_mode_4":
          newState.lightMode = 4;
          break;
        case "start_driving":
          newState.isDriving = true;
          break;
        case "stop_driving":
          newState.isDriving = false;
          break;
        case "suspension_up":
          newState.suspensionStatus = "升高";
          break;
        case "suspension_down":
          newState.suspensionStatus = "降低";
          break;
      }

      return newState;
    });
  };

  // 更新CAN命令配置
  const updateCanCommand = (
    commandId: string,
    field: keyof CanCommand,
    value: string
  ) => {
    setCanCommands((prev) =>
      prev.map((cmd) =>
        cmd.id === commandId ? { ...cmd, [field]: value } : cmd
      )
    );
  };

  return {
    canCommands,
    carStates,
    updateCarState,
    updateCanCommand,
  };
};
