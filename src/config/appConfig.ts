/**
 * 应用配置文件
 * 用于切换演示模式和调试模式
 *
 * 演示模式 (DEMO):
 * - 只显示车辆控制界面
 * - 隐藏所有其他 tab
 * - 显示快速连接面板
 *
 * 调试模式 (DEBUG):
 * - 显示所有 tab（车辆控制、CAN配置、按钮配置）
 * - 显示完整的调试面板
 * - 显示所有功能
 */

export type AppMode = "DEMO" | "DEBUG";

interface AppConfig {
  mode: AppMode;
  // 演示模式下的快速连接配置
  demoQuickConnect?: {
    port: string | undefined;
    baudRate: number;
  };
  // UI 功能开关
  features?: {
    // 是否显示风扇档位控制
    showFanControl?: boolean;
    showSteeringWheel?: boolean;
  };
  // 雷达配置
  radar?: {
    // 雷达查询间隔（毫秒）
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
// 🔧 配置入口 - 修改这里来切换模式
// ============================================
const APP_CONFIG: AppConfig = {
  // 切换模式: "DEMO" 或 "DEBUG"
  mode: "DEMO",

  // 演示模式下的快速连接配置（仅在 mode === "DEMO" 时使用）
  demoQuickConnect: {
    port: undefined,
    baudRate: 2000000,
  },

  // UI 功能开关
  features: {
    // 是否显示风扇档位控制（0-3档）
    showFanControl: false,
    showSteeringWheel: true,
  },

  // 雷达配置
  radar: {
    // 雷达查询间隔（毫秒）- 默认 1000ms (1秒)
    queryIntervalMs: 100000,
  },
  //悬挂升高或者降低之后隔多长时间（毫秒，默认4秒）发送停止升降的can信号
  suspension: {
    animationDuration: 4000,
    can_stop_duration: 4000,
  },
  // 相机控制配置
  cameraControl: {
    // 自动行驶时是否允许手动拖动视角
    allowOrbitControlsInAutoDrive: false,
    // 手动行驶时是否允许手动拖动视角
    allowOrbitControlsInManualDrive: true,
  },
};

// ============================================
// 导出配置和工具函数
// ============================================

export const getAppMode = (): AppMode => APP_CONFIG.mode;

export const isDemoMode = (): boolean => APP_CONFIG.mode === "DEMO";

export const isDebugMode = (): boolean => APP_CONFIG.mode === "DEBUG";

export const getDemoQuickConnect = () => APP_CONFIG.demoQuickConnect;

/**
 * 检查是否显示风扇档位控制
 */
export const isShowFanControl = (): boolean =>
  APP_CONFIG.features?.showFanControl ?? false;

export const isShowSteeringWheel = (): boolean =>
  APP_CONFIG.features?.showSteeringWheel ?? false;

/**
 * 获取雷达查询间隔（毫秒）
 */
export const getRadarQueryInterval = (): number =>
  APP_CONFIG.radar?.queryIntervalMs ?? 1000;

export default APP_CONFIG;

export const getSuspensionConfig = (): AppConfig["suspension"] =>
  APP_CONFIG.suspension;

export const getCameraControlConfig = (): AppConfig["cameraControl"] =>
  APP_CONFIG.cameraControl;
