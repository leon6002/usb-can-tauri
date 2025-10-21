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
    port: string;
    baudRate: number;
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
    port: "/dev/tty.usbserial-2110",
    baudRate: 115200,
  },
};

// ============================================
// 导出配置和工具函数
// ============================================

export const getAppMode = (): AppMode => APP_CONFIG.mode;

export const isDemoMode = (): boolean => APP_CONFIG.mode === "DEMO";

export const isDebugMode = (): boolean => APP_CONFIG.mode === "DEBUG";

export const getDemoQuickConnect = () => APP_CONFIG.demoQuickConnect;

export default APP_CONFIG;
