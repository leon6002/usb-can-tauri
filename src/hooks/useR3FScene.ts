/**
 * R3F 场景 Hook
 *
 */
import { useState, useEffect, useRef } from "react";
import { Scene3DStatus, ActiveTab } from "../types";
import { SceneHandle } from "../components/Car3D/r3f/Scene";

export const useR3FScene = (activeTab: ActiveTab) => {
  const [scene3DStatus, setScene3DStatus] = useState<Scene3DStatus>("loading");
  const sceneHandleRef = useRef<SceneHandle | null>(null);

  // 初始化3D场景
  useEffect(() => {
    if (activeTab !== "car") {
      console.log("[useR3FScene] 3D scene tab inactive");
      return;
    }

    console.log("[useR3FScene] Initializing R3F 3D car scene...");
    setScene3DStatus("loading");
  }, [activeTab]);

  // 组件卸载时清理3D场景
  useEffect(() => {
    return () => {
      console.log("[useR3FScene] Disposing R3F 3D scene...");
      sceneHandleRef.current = null;
    };
  }, []);

  return {
    scene3DStatus,
    sceneHandleRef,
  };
};
