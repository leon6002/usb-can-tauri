import { SerialConfig } from "@/types";
import { toast } from "sonner";

interface DriveCommandParams {
  config: SerialConfig;
  csvContent: string;
  addDebugLog: (
    action: string,
    commandId: string,
    canId: string,
    data: string,
    description: string
  ) => void;
  updateVehicleControl: (
    speed: number,
    steeringAngle: number,
    gear?: string
  ) => void;
  updateDriveAnimation: (speed: number, steeringAngle: number) => void;
  startCsvLoop: (
    onProgressUpdate?: (
      speed: number,
      steeringAngle: number,
      gear?: string
    ) => void
  ) => void;
  updateCarState: (commandId: string) => void;
  startDriveAnimation: () => void;
}

interface StopDrivingParams {
  addDebugLog: (
    action: string,
    commandId: string,
    canId: string,
    data: string,
    description: string
  ) => void;
  stopCsvLoop: () => Promise<void>;
  updateVehicleControl: (
    speed: number,
    steeringAngle: number,
    gear?: string
  ) => void;
  updateCarState: (commandId: string) => void;
  stopDriveAnimation: () => void;
}

export const handleStartDriving = async ({
  config,
  csvContent,
  addDebugLog,
  updateVehicleControl,
  updateDriveAnimation,
  startCsvLoop,
  updateCarState,
  startDriveAnimation,
}: DriveCommandParams) => {
  const commandId = "start_driving";
  console.log("🚗 Start driving command detected");

  try {
    if (!config.csvFilePath || !csvContent) {
      console.error("❌ CSV file not selected");
      return;
    }
    if (!config.sendIntervalMs || config.sendIntervalMs < 1) {
      console.error("❌ Invalid send interval");
      toast.error("Please set a valid sending interval (>= 1ms)");
      return;
    }

    console.log("✅ All validations passed, starting CSV loop");
    addDebugLog(
      "Start CSV loop sending",
      commandId,
      "CSV",
      config.csvFilePath,
      `Interval: ${config.sendIntervalMs}ms, Start row: ${
        config.csvStartRowIndex || 0
      }`
    );

    // Define progress update callback
    const onProgressUpdate = (
      speed: number,
      steeringAngle: number,
      gear?: string
    ) => {
      // steeringAngle is already the tire steering angle (parsed from new 8-byte data format), unit is radian
      // No need for steering ratio conversion anymore

      // todo Calculate steering wheel angle for display (steering wheel angle = tire steering angle * steering ratio)
      // const steeringWheelAngle = steeringAngle * STEERING_RATIO;

      // Update status panel to show steering wheel angle and gear
      updateVehicleControl(speed, steeringAngle, gear);

      // Update car body rotation in 3D scene simultaneously (based on bicycle model) Use tire steering angle to calculate car body rotation
      updateDriveAnimation(speed, steeringAngle);
    };

    await startCsvLoop(onProgressUpdate);
    updateCarState(commandId);

    // Trigger 3D animation
    console.log("starting drive animation");
    startDriveAnimation();
  } catch (error) {
    console.error(
      `❌ Start driving command execution failed (${commandId}):`,
      error
    );
    // Record failure log
    addDebugLog(
      "Start driving command execution failed",
      commandId,
      "CSV",
      config.csvFilePath || "N/A",
      `Error: ${error instanceof Error ? error.message : String(error)}`
    );
    // Rethrow error to let caller know command failed
    throw error;
  }
};

export const handleStopDriving = async ({
  addDebugLog,
  stopCsvLoop,
  updateVehicleControl,
  updateCarState,
  stopDriveAnimation,
}: StopDrivingParams) => {
  const commandId = "stop_driving";

  try {
    // Stop loop sending
    addDebugLog(
      "Stop CSV loop sending",
      commandId,
      "CSV",
      "Stop",
      "Stop loop sending"
    );

    await stopCsvLoop();
    // Update status panel to show steering wheel angle
    updateVehicleControl(0, 0);
    updateCarState(commandId);
    stopDriveAnimation();
  } catch (error) {
    console.error(
      `❌ Stop driving command execution failed (${commandId}):`,
      error
    );
    // Record failure log
    addDebugLog(
      "Stop driving command execution failed",
      commandId,
      "CSV",
      "N/A",
      `Error: ${error instanceof Error ? error.message : String(error)}`
    );
    throw error;
  }
};
