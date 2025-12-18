/**
 * 应用版本配置
 */

export const APP_VERSION = "v2.2.0";

export const getVersionInfo = () => {
  return {
    version: APP_VERSION,
    name: "vehicle-controller",
    buildDate: new Date().toLocaleDateString("zh-CN"),
  };
};
