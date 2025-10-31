import { CanCommand } from "@/types";

interface DoorCommandParams {
  commandId: string;
  command: CanCommand;
  stopCommand: CanCommand;
  sendCanCommand: (canId: string, data: string) => Promise<void>;
  updateCarState: (commandId: string) => void;
  addDebugLog: (
    action: string,
    commandId: string,
    canId: string,
    data: string,
    description: string
  ) => void;
}

export const handleDoorCommand = async ({
  commandId,
  command,
  stopCommand,
  sendCanCommand,
  updateCarState,
  addDebugLog,
}: DoorCommandParams): Promise<() => void> => {
  // 参数验证
  if (!command?.canId || !command?.data) {
    throw new Error("车门命令参数不完整");
  }

  if (!stopCommand?.canId || !stopCommand?.data) {
    throw new Error("停止命令参数不完整");
  }

  try {
    addDebugLog(
      "发送车门命令",
      commandId,
      command.canId,
      command.data,
      command.description
    );

    await sendCanCommand(command.canId, command.data);
    updateCarState(commandId);

    // 门动画持续时间约为 4 秒
    const doorAnimationDuration = 4000;

    const timeoutId = setTimeout(async () => {
      try {
        console.log("🚪 门动画结束，自动发送停止信号");
        addDebugLog(
          "自动发送车门停止",
          "door_stop",
          stopCommand.canId,
          stopCommand.data,
          "门动画结束后自动停止"
        );

        await sendCanCommand(stopCommand.canId, stopCommand.data);
        updateCarState("door_stop");
      } catch (error) {
        console.error("发送车门停止命令失败:", error);
        addDebugLog(
          "发送车门停止命令失败",
          "door_stop",
          stopCommand.canId,
          stopCommand.data,
          `错误: ${error}`
        );
      }
    }, doorAnimationDuration);

    // 返回清理函数
    return () => {
      clearTimeout(timeoutId);
    };
  } catch (error) {
    console.error("车门命令执行失败:", error);
    addDebugLog(
      "车门命令执行失败",
      commandId,
      command.canId,
      command.data,
      `错误: ${error}`
    );
    throw error;
  }
};
