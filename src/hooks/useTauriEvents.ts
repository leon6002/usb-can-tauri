import { useEffect } from "react";
import { useCarControlStore } from "@/store/carControlStore";

export const useTauriEvents = () => {
  useEffect(() => {
    console.log("🔧 useTauriEvents: Setting up CSV loop finish listener");
    let isMounted = true;
    let unlistenFunc: (() => void) | null = null;

    const setupListener = async () => {
      try {
        console.log("🔧 useTauriEvents: Calling csvLoopFinishListener");
        const unlisten = await useCarControlStore
          .getState()
          .csvLoopFinishListener();
        console.log(
          "✅ useTauriEvents: CSV loop finish listener setup complete"
        );
        if (isMounted) {
          unlistenFunc = unlisten;
        } else {
          // 如果组件已经卸载，立即清理
          console.log(
            "⚠️ useTauriEvents: Component unmounted, cleaning up listener"
          );
          unlisten();
        }
      } catch (error) {
        console.error("❌ useTauriEvents: Failed to setup listener:", error);
      }
    };

    setupListener();

    return () => {
      console.log("🧹 useTauriEvents: Cleanup - unmounting");
      isMounted = false;
      if (unlistenFunc) {
        console.log("🧹 useTauriEvents: Calling unlisten function");
        unlistenFunc();
      }
      useCarControlStore.getState().stopCsvLoop();
    };
  }, []);
};
