/**
 * version config
 */

export const APP_VERSION = "v2.3.1";

export const getVersionInfo = () => {
  return {
    version: APP_VERSION,
    name: "vehicle-controller",
    buildDate: new Date().toLocaleDateString("zh-CN"),
  };
};
