/**
 * Application configuration file
 * Used to switch between Demo mode and Debug mode
 *
 * Demo mode (DEMO):
 * - Show vehicle control UI only
 * - Hide all other tabs
 * - Show quick-connect panel
 *
 * Debug mode (DEBUG):
 * - Show all tabs (Vehicle Control, CAN Config, Button Config)
 * - Show full debug panel
 * - Show all features
 */

export type AppMode = "DEMO" | "DEBUG";

interface AppConfig {
  mode: AppMode;
  // Quick-connect config for demo mode
  demoQuickConnect?: {
    port: string | undefined;
    baudRate: number;
  };
  // UI feature toggles
  features?: {
    // Show fan level control
    showFanControl?: boolean;
    showSteeringWheel?: boolean;
    showSuspension?: boolean;
    // Show radar distance display
    showRadar?: boolean;
    // Show system monitor button
    showSystemMonitor?: boolean;
    // Independent door control (true=left/right separately, false=both together)
    independentDoors?: boolean;
  };
  // Radar config
  radar?: {
    // Radar query interval in milliseconds
    queryIntervalMs?: number;
  };
  suspension: {
    animationDuration: number;
    can_stop_duration: number;
  };
  cameraControl: {
    allowOrbitControlsInAutoDrive: boolean;
    allowOrbitControlsInManualDrive: boolean;
  };
}

// ============================================
// Config entry — edit here to switch modes
// ============================================
const APP_CONFIG: AppConfig = {
  // Mode: "DEMO" or "DEBUG"
  mode: "DEMO",

  // Quick-connect config for demo mode (only used when mode === "DEMO")
  demoQuickConnect: {
    port: undefined,
    baudRate: 2000000,
  },

  // UI feature toggles
  features: {
    // Fan level control (0–3)
    showFanControl: true,
    showSteeringWheel: true,
    // Suspension control
    showSuspension: false,
    // Radar distance display
    showRadar: false,
    // System monitor button
    showSystemMonitor: true,
    // Independent door control
    independentDoors: true,
  },

  // Radar config
  radar: {
    // Radar query interval in milliseconds (default: 1000000 ms)
    queryIntervalMs: 1000000,
  },
  // Delay in milliseconds before auto-sending suspension stop signal after raise/lower (default: 4000 ms)
  suspension: {
    animationDuration: 4000,
    can_stop_duration: 4000,
  },
  // Camera control config
  cameraControl: {
    // Allow manual orbit during auto-drive
    allowOrbitControlsInAutoDrive: false,
    // Allow manual orbit during manual drive
    allowOrbitControlsInManualDrive: true,
  },
};

// ============================================
// Exported config and utility functions
// ============================================

export const getAppMode = (): AppMode => APP_CONFIG.mode;

export const isDemoMode = (): boolean => APP_CONFIG.mode === "DEMO";

export const isDebugMode = (): boolean => APP_CONFIG.mode === "DEBUG";

export const getDemoQuickConnect = () => APP_CONFIG.demoQuickConnect;

export const isShowFanControl = (): boolean =>
  APP_CONFIG.features?.showFanControl ?? false;

export const isShowSteeringWheel = (): boolean =>
  APP_CONFIG.features?.showSteeringWheel ?? false;

export const isShowSuspension = (): boolean =>
  APP_CONFIG.features?.showSuspension ?? false;

export const isShowRadar = (): boolean =>
  APP_CONFIG.features?.showRadar ?? false;

export const isShowSystemMonitor = (): boolean =>
  APP_CONFIG.features?.showSystemMonitor ?? false;

export const isIndependentDoors = (): boolean =>
  APP_CONFIG.features?.independentDoors ?? false;

export const getRadarQueryInterval = (): number =>
  APP_CONFIG.radar?.queryIntervalMs ?? 1000;

export default APP_CONFIG;

export const getSuspensionConfig = (): AppConfig["suspension"] =>
  APP_CONFIG.suspension;

export const getCameraControlConfig = (): AppConfig["cameraControl"] =>
  APP_CONFIG.cameraControl;
