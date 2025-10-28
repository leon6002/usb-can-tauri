/**
 * 应用版本配置
 */

export const APP_VERSION = "v1.0.0";

export const getVersionInfo = () => {
  return {
    version: APP_VERSION,
    name: "OSYX 车控系统",
    buildDate: new Date().toLocaleDateString("zh-CN"),
  };
};

