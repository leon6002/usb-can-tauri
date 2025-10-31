import { useEffect, useRef } from "react";
import { useCarControlStore } from "@/store/carControlStore";
import { useSerialStore } from "@/store/serialStore";
import { useRadarStore } from "@/store/radarStore";

export const useTauriEvents = () => {
  // 查询可用串口，加载内置csv行驶数据
  const isConnected = useSerialStore((state) => state.isConnected);
  // 使用 useRef 记录是否已初始化
  const initializedRef = useRef(false);
  // 1. 用于保存 Tauri 事件监听器的清理函数
  const unlistenRef = useRef<(() => void) | null>(null);
  // 2. 用于保存组件是否已卸载的状态
  const isMountedRef = useRef(true);

  //初始化串口
  useEffect(() => {
    // 仅在未初始化且处于挂载状态时运行
    if (initializedRef.current === false) {
      console.log("初始化串口（仅运行一次）");
      useSerialStore.getState().initializeSerial();
      initializedRef.current = true;
    }
    // 注意：清理函数通常是空的，因为 initializeSerial 不返回清理函数
    return () => {
      // 如果 initializeSerial 内部没有副作用，清理函数可以为空
    };
  }, []);

  // 初始化监听 CSV 循环完成事件
  useEffect(() => {
    isMountedRef.current = true; // 每次设置 Effect 时标记为 mounted
    console.log("🔧 useTauriEvents: Setting up CSV loop finish listener");
    const setupListener = async () => {
      try {
        console.log("🔧 useTauriEvents: Calling csvLoopFinishListener");
        const unlisten = await useCarControlStore
          .getState()
          .csvLoopFinishListener();
        if (isMountedRef.current) {
          unlistenRef.current = unlisten;
          console.log(
            "✅ useTauriEvents: CSV loop finish listener setup complete"
          );
        } else {
          // 如果在等待异步时组件已卸载，立即清理
          console.log(
            "⚠️ useTauriEvents: Component unmounted during async, cleaning up listener"
          );
          unlisten();
        }
      } catch (error) {
        console.error("❌ useTauriEvents: Failed to setup listener:", error);
      }
    };

    setupListener();

    // 清理函数
    return () => {
      isMountedRef.current = false; // 标记组件为卸载中
      console.log("🧹 useTauriEvents: Cleanup - unmounting");

      // 检查并调用 Tauri 事件监听的清理函数
      if (unlistenRef.current) {
        console.log("🧹 useTauriEvents: Calling unlisten function");
        unlistenRef.current();
      }

      // 执行其他状态清理
      useCarControlStore.getState().stopCsvLoop();
      useSerialStore.getState().handleDisconnect();
    };
  }, []);

  // 定时发送雷达信号并监听雷达数据
  const manageRadar = useRadarStore((state) => state.manageRadar);
  useEffect(() => {
    manageRadar(isConnected);
    return () => {
      manageRadar(false);
    };
  }, [isConnected, manageRadar]);
};
