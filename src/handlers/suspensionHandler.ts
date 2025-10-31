import { getSuspensionConfig } from "@/config/appConfig";
import { CanCommand } from "@/types";

interface SuspensionCommandParams {
  commandId: string;
  command: CanCommand;
  stopCommand: CanCommand;
  sendCanCommand: (canId: string, data: string) => Promise<void>;
  updateCarState: (commandId: string) => void;
  suspensionAnimation: (mode: "up" | "down" | "stop") => void;
  addDebugLog: (
    action: string,
    commandId: string,
    canId: string,
    data: string,
    description: string
  ) => void;
}

interface SuspensionStopCommandParams {
  stopCommand: CanCommand;
  sendCanCommand: (canId: string, data: string) => Promise<void>;
  updateCarState: (commandId: string) => void;
  suspensionAnimation: (mode: "up" | "down" | "stop") => void;
  addDebugLog: (
    action: string,
    commandId: string,
    canId: string,
    data: string,
    description: string
  ) => void;
}

const handleStop = async ({
  stopCommand,
  sendCanCommand,
  updateCarState,
  suspensionAnimation,
  addDebugLog,
}: SuspensionStopCommandParams) => {
  await sendCanCommand(stopCommand.canId, stopCommand.data);
  updateCarState("suspension_stop");
  suspensionAnimation("stop");
  addDebugLog(
    "发送悬挂停止命令",
    "suspension_stop",
    stopCommand.canId,
    stopCommand.data,
    "手动发送停止命令"
  );
};

export const handleSuspensionCommand = async ({
  commandId,
  command,
  stopCommand,
  sendCanCommand,
  updateCarState,
  suspensionAnimation,
  addDebugLog,
}: SuspensionCommandParams): Promise<() => void> => {
  // 必须确保命令参数完整
  if (!command?.canId || !command?.data) {
    throw new Error("悬挂命令参数不完整");
  }
  // 默认返回一个空的清理函数
  let cleanup = () => {};
  try {
    if (
      commandId === "suspension_up" ||
      commandId === "suspension_down" ||
      commandId === "suspension_stop"
    ) {
      const direction =
        commandId === "suspension_up"
          ? "up"
          : commandId === "suspension_down"
          ? "down"
          : "stop";
      addDebugLog(
        "发送悬挂命令",
        commandId,
        command.canId,
        command.data,
        command.description
      );
      await sendCanCommand(command.canId, command.data);
      updateCarState(commandId);
      suspensionAnimation(direction);

      if (direction === "stop") {
        return cleanup;
      }

      // n秒后自动发送停止命令
      const duration = getSuspensionConfig().can_stop_duration;
      const newSuspensionTimeoutId = setTimeout(() => {
        try {
          handleStop({
            stopCommand,
            sendCanCommand,
            updateCarState,
            suspensionAnimation,
            addDebugLog,
          });
        } catch (error) {
          console.error("自动发送悬挂停止命令失败:", error);
          addDebugLog(
            "自动发送悬挂停止失败",
            "suspension_stop_auto",
            "N/A",
            "N/A",
            `错误: ${error}`
          );
        }
      }, duration);

      cleanup = () => {
        clearTimeout(newSuspensionTimeoutId);
      };
    } else {
      throw new Error(`不支持的悬挂命令: ${commandId}`);
    }
    return cleanup;
  } catch (error) {
    console.error(`悬挂命令执行失败 (${commandId}):`, error);
    addDebugLog(
      "悬挂命令执行失败",
      commandId,
      command.canId,
      command.data,
      `错误: ${error}`
    );
    // 或者直接抛出错误，让调用方处理：
    throw error;
  }
};
