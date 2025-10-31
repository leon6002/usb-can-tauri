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
          <div className="loading-3d flex items-center justify-center h-full absolute inset-0 z-10 bg-gradient-to-br from-slate-900 via-blue-900 to-indigo-900">
            <div className="text-center relative">
              {/* 背景光晕效果 */}
              <div className="absolute inset-0 -m-20">
                <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-64 h-64 bg-blue-500/30 rounded-full blur-3xl animate-pulse"></div>
                <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-48 h-48 bg-indigo-500/30 rounded-full blur-2xl animate-pulse delay-75"></div>
              </div>

              {/* 3D 旋转立方体 */}
              <div className="relative mb-8 perspective-1000">
                <div className="w-24 h-24 mx-auto relative preserve-3d animate-spin-3d">
                  {/* 立方体的6个面 */}
                  <div className="absolute w-24 h-24 bg-gradient-to-br from-blue-500 to-indigo-600 border-2 border-blue-300/50 backdrop-blur-sm flex items-center justify-center transform translate-z-12 shadow-lg shadow-blue-500/50">
                    <svg
                      className="w-12 h-12 text-white"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4"
                      />
                    </svg>
                  </div>
                  <div className="absolute w-24 h-24 bg-gradient-to-br from-indigo-500 to-purple-600 border-2 border-indigo-300/50 backdrop-blur-sm flex items-center justify-center transform -translate-z-12 shadow-lg shadow-indigo-500/50">
                    <svg
                      className="w-12 h-12 text-white"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M13 10V3L4 14h7v7l9-11h-7z"
                      />
                    </svg>
                  </div>
                  <div className="absolute w-24 h-24 bg-gradient-to-br from-blue-400 to-cyan-500 border-2 border-cyan-300/50 backdrop-blur-sm flex items-center justify-center transform rotate-y-90 translate-z-12 shadow-lg shadow-cyan-500/50">
                    <svg
                      className="w-12 h-12 text-white"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M9 3v2m6-2v2M9 19v2m6-2v2M5 9H3m2 6H3m18-6h-2m2 6h-2M7 19h10a2 2 0 002-2V7a2 2 0 00-2-2H7a2 2 0 00-2 2v10a2 2 0 002 2zM9 9h6v6H9V9z"
                      />
                    </svg>
                  </div>
                  <div className="absolute w-24 h-24 bg-gradient-to-br from-purple-500 to-pink-600 border-2 border-purple-300/50 backdrop-blur-sm flex items-center justify-center transform rotate-y-90 -translate-z-12 shadow-lg shadow-purple-500/50">
                    <svg
                      className="w-12 h-12 text-white"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4"
                      />
                    </svg>
                  </div>
                  <div className="absolute w-24 h-24 bg-gradient-to-br from-cyan-500 to-blue-600 border-2 border-cyan-300/50 backdrop-blur-sm flex items-center justify-center transform rotate-x-90 translate-z-12 shadow-lg shadow-blue-500/50">
                    <svg
                      className="w-12 h-12 text-white"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M7 21a4 4 0 01-4-4V5a2 2 0 012-2h4a2 2 0 012 2v12a4 4 0 01-4 4zm0 0h12a2 2 0 002-2v-4a2 2 0 00-2-2h-2.343M11 7.343l1.657-1.657a2 2 0 012.828 0l2.829 2.829a2 2 0 010 2.828l-8.486 8.485M7 17h.01"
                      />
                    </svg>
                  </div>
                  <div className="absolute w-24 h-24 bg-gradient-to-br from-pink-500 to-rose-600 border-2 border-pink-300/50 backdrop-blur-sm flex items-center justify-center transform rotate-x-90 -translate-z-12 shadow-lg shadow-pink-500/50">
                    <svg
                      className="w-12 h-12 text-white"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z"
                      />
                    </svg>
                  </div>
                </div>
              </div>

              {/* 加载文字 */}
              <div className="relative z-10">
                <h2 className="text-3xl font-bold text-white mb-3 animate-pulse">
                  3D 模型加载中
                </h2>
                <div className="flex items-center justify-center gap-2 mb-4">
                  <div className="w-2 h-2 bg-blue-400 rounded-full animate-bounce"></div>
                  <div className="w-2 h-2 bg-indigo-400 rounded-full animate-bounce delay-100"></div>
                  <div className="w-2 h-2 bg-purple-400 rounded-full animate-bounce delay-200"></div>
                </div>
                <p className="text-blue-200 text-sm">正在初始化渲染引擎...</p>
              </div>

              {/* 进度条 */}
              <div className="relative z-10 mt-8 w-64 mx-auto">
                <div className="h-1 bg-white/10 rounded-full overflow-hidden backdrop-blur-sm">
                  <div className="h-full bg-gradient-to-r from-blue-500 via-indigo-500 to-purple-500 rounded-full animate-loading-bar"></div>
                </div>
              </div>
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
