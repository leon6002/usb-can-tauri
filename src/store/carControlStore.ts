import { create } from "zustand";
import { invoke } from "@tauri-apps/api/core";
import { toast } from "sonner";
import { CanCommand, CarStates } from "@/types";
import { useSerialStore } from "./serialStore";
import { useDebugStore } from "./useDebugStore";
import { use3DStore } from "./car3DStore";
import { listen, UnlistenFn } from "@tauri-apps/api/event";
import { CAN_COMMANDS } from "@/config/canCommands";
import { handleDoorCommand } from "@/handlers/doorHandler";
import { handleSuspensionCommand } from "@/handlers/suspensionHandler";
// import { handleStartDriving, handleStopDriving } from "@/handlers/driveHandler";
import { validateCanId } from "@/utils/validation";
import { buildVehicleControlData } from "@/utils/canProtocol";

// Tracking variables for signal optimization
let lastSentSpeed: number | null = null;
let lastSentAngle: number | null = null;
let lastSentTime = 0;

interface CarControlStore {
  canCommands: CanCommand[];
  carStates: CarStates;

  progressIntervalId: NodeJS.Timeout | null;

  // Actions
  updateCanCommand: (
    commandId: string,
    field: keyof CanCommand,
    value: string
  ) => void;
  updateCarState: (commandId: string) => void;
  setCarState: (newState: Partial<CarStates>) => void;
  updateVehicleControl: (
    speed: number,
    steeringAngle: number,
    gear?: string
  ) => void;
  startInfiniteDrive: (
    onProgressUpdate?: (
      speed: number,
      steeringAngle: number,
      gear?: string
    ) => void
  ) => Promise<void>;
  stopAutoDrive: () => Promise<void>;
  sendCarCommand: (commandId: string) => Promise<void>;
  sendCanCommand: (canId: string, data: string) => Promise<void>;

  sendVehicleControlCommand: (speed: number, angle: number) => Promise<void>;
  csvLoopFinishListener: () => Promise<UnlistenFn>;
  unlistenCsvLoopFunc: UnlistenFn | null;
  unlistenCsvProgressFunc: UnlistenFn | null;
}

const initialCarStates: CarStates = {
  isDriving: false,
  leftDoorStatus: "Stopped",
  rightDoorStatus: "Stopped",
  fanLevel: 0,
  lightMode: 1,
  suspensionStatus: "Stopped",
  // Real-time CAN data
  currentSpeed: 0, // mm/s
  currentSteeringAngle: 0, // degree
  // New protocol data
  gear: "P", // Gear (P/R/N/D/S)
  steeringAngleDegrees: 0, // Steering angle (degrees)
};

const findCommandById = (
  commandId: string,
  canCommands: CanCommand[]
): CanCommand | undefined => {
  return canCommands.find((cmd) => cmd.id === commandId);
};

const commandStateMap: Partial<Record<string, Partial<CarStates>>> = {
  door_open: {
    leftDoorStatus: "Open",
    rightDoorStatus: "Open",
  },
  door_close: {
    leftDoorStatus: "Closed",
    rightDoorStatus: "Closed",
  },
  door_stop: {
    leftDoorStatus: "Stopped",
    rightDoorStatus: "Stopped",
  },
  left_door_open: { leftDoorStatus: "Open" },
  left_door_close: { leftDoorStatus: "Closed" },
  left_door_stop: { leftDoorStatus: "Stopped" },
  right_door_open: { rightDoorStatus: "Open" },
  right_door_close: { rightDoorStatus: "Closed" },
  right_door_stop: { rightDoorStatus: "Stopped" },
  fan_level_0: { fanLevel: 0 },
  fan_level_1: { fanLevel: 1 },
  fan_level_2: { fanLevel: 2 },
  fan_level_3: { fanLevel: 3 },
  light_mode_1: { lightMode: 1 },
  light_mode_2: { lightMode: 2 },
  light_mode_3: { lightMode: 3 },
  light_mode_4: { lightMode: 4 },
  start_driving: { isDriving: true },
  stop_driving: { isDriving: false },
  suspension_up: { suspensionStatus: "Raised" },
  suspension_down: { suspensionStatus: "Lowered" },
  suspension_stop: { suspensionStatus: "Normal" },
};

export const useCarControlStore = create<CarControlStore>((set, get) => ({
  // --- State ---
  canCommands: CAN_COMMANDS,
  carStates: initialCarStates,

  progressIntervalId: null,
  unlistenCsvLoopFunc: null,
  unlistenCsvProgressFunc: null,

  /**
   * Update CAN command config
   */
  updateCanCommand: (commandId, field, value) => {
    set((state) => ({
      canCommands: state.canCommands.map((cmd) =>
        cmd.id === commandId ? { ...cmd, [field]: value } : cmd
      ),
    }));
  },
  /**
   * Update vehicle state
   */
  updateCarState: (commandId) => {
    console.log(`🔄 updateCarState called with commandId: ${commandId}`);
    set((state) => {
      const newState = { ...state.carStates };
      const stateUpdate = commandStateMap[commandId];
      if (stateUpdate) {
        console.log(`📝 Applying state update for ${commandId}:`, stateUpdate);
        Object.assign(newState, stateUpdate);
        console.log(`✅ New state after update:`, newState);
      } else {
        console.warn(`⚠️ No state update found for commandId: ${commandId}`);
      }
      return { carStates: newState };
    });
  },
  /**
   * Send CAN command
   * @param canId CAN ID to send
   * @param data CAN data to send
   */
  sendCanCommand: async (canId, data) => {
    // 1. Get config from serial store
    const config = useSerialStore.getState().config;

    try {
      // Validate CAN ID
      const validation = validateCanId(canId, config.frameType);

      if (!validation.valid) {
        console.warn("❌ CAN ID validation failed:", validation.error);
        toast.error(validation.error);
        return;
      }

      const params = {
        id: canId,
        data: data,
        frameType: config.frameType,
        protocolLength: config.protocolLength,
      };

      // 3. Call backend API (TX event now emitted by Rust, no manual addMessage needed)
      await invoke("send_can_message", params);
    } catch (error) {
      console.error("Send car command error:", error);
      toast.error(`send can command error: ${error}`);
      throw error; // Re-throw for upstream callers (e.g. other branches of sendCarCommand)
    }
  },

  sendVehicleControlCommand: async (speed, angle) => {
    try {
      const now = Date.now();
      const HEARTBEAT_INTERVAL = 1000; // 1 second heartbeat

      // Check if values changed or heartbeat interval passed
      const hasChanged =
        lastSentSpeed === null ||
        lastSentAngle === null ||
        speed !== lastSentSpeed ||
        Math.abs(angle - lastSentAngle) > 0.001; // Float comparison

      const timeSinceLastSend = now - lastSentTime;
      const shouldSend = hasChanged || timeSinceLastSend >= HEARTBEAT_INTERVAL;

      if (!shouldSend) {
        return;
      }

      const data = buildVehicleControlData(speed, angle);
      const params = {
        id: '200',
        data: data,
        frameType: "standard",
        protocolLength: "fixed",
      };
      await invoke("send_can_message", params);

      // Update tracking variables
      lastSentSpeed = speed;
      lastSentAngle = angle;
      lastSentTime = now;
    } catch (error) {
      console.error("Send vehicle control command error:", error);
      // toast.error(`Send vehicle control command error: ${error}`);
      // throw error;
    }
  },

  setCarState: (newState) => {
    set((state) => ({
      carStates: {
        ...state.carStates,
        ...newState, // Merge incoming new state
      },
    }));
  },
  /**
   * Update vehicle control values (speed and steering angle)
   */
  updateVehicleControl: (speed, steeringAngle, gear) => {
    set((state) => ({
      carStates: {
        ...state.carStates,
        currentSpeed: speed,
        currentSteeringAngle: steeringAngle,
        gear: gear || state.carStates.gear, // Update gear if provided, otherwise keep current
      },
    }));
  },
  // Start infinite algorithmic drive loop (replaces CSV-based loop)
  startInfiniteDrive: async (
    onProgressUpdate?: (
      speed: number,
      steeringAngle: number,
      gear?: string
    ) => void
  ) => {
    try {
      console.log("🚀 Starting Infinite Drive");

      // Setup listener (same as startCsvLoop)
      if (onProgressUpdate) {
        const { unlistenCsvProgressFunc } = get();
        if (unlistenCsvProgressFunc) {
          unlistenCsvProgressFunc();
        }

        console.log("🎧 Setting up listener for infinite drive progress");
        const unlisten = await listen<any>("auto-drive-progress", (event) => {
          const { vehicle_control } = event.payload;
          if (vehicle_control) {
            onProgressUpdate(
              vehicle_control.linear_velocity_mms,
              vehicle_control.steering_angle,
              vehicle_control.gear_name
            );
          }
        });

        set({ unlistenCsvProgressFunc: unlisten });
      }

      await invoke("start_infinite_drive");

      // Set driving state
      set((state) => ({
        carStates: { ...state.carStates, isDriving: true }
      }));

      // toast.success("Infinite Drive Started");
    } catch (error) {
      console.error("❌ Failed to start infinite drive:", error);
      toast.error(`Failed to start infinite drive: ${error}`);
      throw error;
    }
  },

  // Stop auto-drive
  stopAutoDrive: async () => {
    set((state) => {
      if (state.progressIntervalId) {
        clearTimeout(state.progressIntervalId);
        return { progressIntervalId: null };
      }
      return {};
    });
    // Clean up event listeners
    const { unlistenCsvLoopFunc, unlistenCsvProgressFunc } = get();
    if (unlistenCsvLoopFunc) {
      unlistenCsvLoopFunc();
      set({ unlistenCsvLoopFunc: null });
    }
    if (unlistenCsvProgressFunc) {
      unlistenCsvProgressFunc();
      set({ unlistenCsvProgressFunc: null });
    }

    try {
      await invoke("stop_infinite_drive");
    } catch (e) {
      // Ignore error if not running
    }
    console.log("✓ Auto Drive Stopped");
  },

  // Send vehicle control command
  sendCarCommand: async (commandId: string) => {
    console.log("📍 sendCarCommand called with:", commandId);
    // const { config, driveData: csvContent } = useSerialStore.getState();
    const { addDebugLog } = useDebugStore.getState();

    const {
      updateVehicleControl,
      updateCarState,
      startInfiniteDrive,
      stopAutoDrive,
      sendCanCommand,
      canCommands,
    } = get();
    const command = findCommandById(commandId, canCommands);
    if (!command) {
      console.log("❌ Command not found:", commandId);
      return;
    }
    const {
      startDriveAnimation,
      stopDriveAnimation,
      suspensionAnimation,
      updateDriveAnimation, // Need this for the callback
    } = use3DStore.getState();

    try {
      // Handle "start driving" command - use infinite algorithmic drive
      if (commandId === "start_driving") {
        // handleStartDriving({
        //   config,
        //   csvContent,
        //   addDebugLog,
        //   updateVehicleControl,
        //   updateDriveAnimation,
        //   startCsvLoop,
        //   updateCarState,
        //   startDriveAnimation,
        // });
        // Define progress update callback (similar to handleStartDriving)
        const onProgressUpdate = (
          speed: number,
          steeringAngle: number,
          gear?: string
        ) => {
          // Update status panel
          updateVehicleControl(speed, steeringAngle, gear);
          // Update 3D scene
          updateDriveAnimation(speed, steeringAngle);
        };

        // Use new Infinite Drive logic with callback
        startInfiniteDrive(onProgressUpdate);
        updateCarState(commandId);
        startDriveAnimation();
      } else if (commandId === "stop_driving") {
        // handleStopDriving({
        //   addDebugLog,
        //   stopCsvLoop,
        //   updateVehicleControl,
        //   updateCarState,
        //   stopDriveAnimation,
        // });
        // Stop Infinite Drive
        stopAutoDrive(); // This now stops both
        updateVehicleControl(0, 0);
        updateCarState(commandId);
        stopDriveAnimation();
      } else if (
        commandId === "door_open" ||
        commandId === "door_close" ||
        commandId === "left_door_open" ||
        commandId === "left_door_close" ||
        commandId === "right_door_open" ||
        commandId === "right_door_close"
      ) {
        // Find corresponding stop command by command ID
        const stopId = commandId.startsWith("left_")
          ? "left_door_stop"
          : commandId.startsWith("right_")
          ? "right_door_stop"
          : "door_stop";
        const stopCommand = findCommandById(stopId, canCommands);
        if (!stopCommand) {
          console.error(`❌ Door stop command not found: ${stopId}`);
          return;
        }
        const params = {
          commandId,
          command,
          stopCommand,
          sendCanCommand,
          updateCarState,
          addDebugLog,
        };
        handleDoorCommand(params);
      } else if (
        commandId === "suspension_up" ||
        commandId === "suspension_down"
      ) {
        const stopCommand = findCommandById("suspension_stop", canCommands);
        if (!stopCommand) {
          console.error("❌ Suspension stop command not found");
          return;
        }
        handleSuspensionCommand({
          commandId,
          command,
          stopCommand,
          sendCanCommand,
          updateCarState,
          suspensionAnimation,
          addDebugLog,
        });
      } else {
        // Other commands - send single CAN message
        addDebugLog(
          "Send CAN command",
          commandId,
          command.canId,
          command.data,
          command.description
        );
        await sendCanCommand(command.canId, command.data);
        updateCarState(commandId);
      }
    } catch (error) {
      console.error("Send car command error:", error);
      toast.error(`Send vehicle command error: ${error}`);
    }
  },

  csvLoopFinishListener: async () => {
    console.log("🔧 csvLoopFinishListener: Starting to setup listener");
    const { unlistenCsvLoopFunc } = get();

    if (unlistenCsvLoopFunc) {
      console.log("🔧 csvLoopFinishListener: Cleaning up old listener");
      unlistenCsvLoopFunc();
    }

    console.log(
      "🔧 csvLoopFinishListener: Calling listen() for 'csv-loop-completed'"
    );
    const unlisten = await listen<any>("auto-drive-completed", (event) => {
      console.log("🎉 CSV loop completed event received.", event);
      console.log(
        "📍 Current isDriving state before stop:",
        get().carStates.isDriving
      );

      // Call stop_driving command
      get()
        .sendCarCommand("stop_driving")
        .then(() => {
          console.log("✅ Stop driving command completed");
          console.log(
            "📍 Current isDriving state after stop:",
            get().carStates.isDriving
          );
        })
        .catch((error) => {
          console.error("❌ Failed to stop driving:", error);
        });
    });

    console.log(
      "✅ csvLoopFinishListener: Listener setup complete, storing unlisten function"
    );
    set({ unlistenCsvLoopFunc: unlisten });
    return unlisten;
  },

}));
