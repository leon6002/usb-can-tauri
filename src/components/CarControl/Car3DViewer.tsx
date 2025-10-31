import React, { useState, useRef } from "react";
import { Scene, SceneHandle } from "../Car3D/r3f/Scene";
import { use3DStore } from "../../store/car3DStore";

export const Car3DViewer: React.FC = () => {
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const sceneHandleRef = useRef<SceneHandle | null>(null);
  const setSceneHandle = use3DStore((state) => state.setSceneHandle);

  const handleSceneReady = (sceneHandle: SceneHandle) => {
    sceneHandleRef.current = sceneHandle;
    setSceneHandle(sceneHandle as any); // 将 sceneHandle 设置到 store 中
    setIsLoading(false);
    console.log("✅ 3D Scene ready:", sceneHandle);
  };

  const handleError = (error: Error) => {
    console.error("Scene error:", error);
    setError(error.message);
    setIsLoading(false);
  };

  return (
    <div className="flex-1 relative min-h-0">
      <div className="w-full h-full relative bg-gradient-to-br from-blue-50 to-indigo-100">
        {/* 3D Scene */}
        <Scene onSceneReady={handleSceneReady} onError={handleError} />

        {/* Loading Indicator */}
        {isLoading && (
          <div className="loading-3d flex items-center justify-center h-full absolute inset-0 z-10">
            <div className="text-center">
              <div className="w-16 h-16 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
              <p className="text-gray-600 text-lg">3D模型加载中...</p>
              <p className="text-gray-500 text-sm mt-2">
                React Three Fiber 3D车辆模型
              </p>
              <p className="text-gray-400 text-xs mt-2">模型文件: Car.glb</p>
            </div>
          </div>
        )}

        {/* Error Display */}
        {error && (
          <div className="absolute inset-0 flex items-center justify-center z-10 bg-black bg-opacity-50">
            <div className="bg-white p-6 rounded-lg shadow-lg">
              <p className="text-red-600 font-bold">加载失败</p>
              <p className="text-gray-600 text-sm mt-2">{error}</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
