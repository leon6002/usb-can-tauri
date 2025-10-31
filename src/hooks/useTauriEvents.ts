import { useEffect } from "react";
import { useCarControlStore } from "@/store/carControlStore";

export const useTauriEvents = () => {
  useEffect(() => {
    let isMounted = true;
    let unlistenFunc: (() => void) | null = null;

    const setupListener = async () => {
      try {
        const unlisten = await useCarControlStore
          .getState()
          .csvLoopFinishListener();
        if (isMounted) {
          unlistenFunc = unlisten;
        } else {
          // 如果组件已经卸载，立即清理
          unlisten();
        }
      } catch (error) {
        console.error("Failed to setup listener:", error);
      }
    };

    setupListener();

    return () => {
      isMounted = false;
      if (unlistenFunc) {
        unlistenFunc();
      }
      useCarControlStore.getState().stopCsvLoop();
    };
  }, []);
};
