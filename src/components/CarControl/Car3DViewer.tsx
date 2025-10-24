import React from "react";

export const Car3DViewer: React.FC = () => {
  return (
    <div className="flex-1 relative min-h-0">
      <div
        id="car-3d-container"
        className="w-full h-full relative bg-gradient-to-br from-blue-50 to-indigo-100"
      >
        <div className="loading-3d flex items-center justify-center h-full absolute inset-0 z-10">
          <div className="text-center">
            <div className="w-16 h-16 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
            <p className="text-gray-600 text-lg">3D模型加载中...</p>
            <p className="text-gray-500 text-sm mt-2">Three.js 3D车辆模型</p>
            <p className="text-gray-400 text-xs mt-2">模型文件: Car.glb</p>
          </div>
        </div>

        {/* 运镜控制面板 */}
        <div className="absolute top-4 left-4 flex flex-col gap-2 z-20">
          <button
            className="bg-blue-600 hover:bg-blue-700 text-white p-2 rounded shadow-lg cursor-pointer transition-colors"
            onClick={() => {
              const renderer = (window as any).car3DRenderer;
              if (renderer) {
                renderer.setCameraAnimationMode("orbit", 10000);
              }
            }}
            title="环绕运镜"
          >
            🔄
          </button>
          <button
            className="bg-green-600 hover:bg-green-700 text-white p-2 rounded shadow-lg cursor-pointer transition-colors"
            onClick={() => {
              const renderer = (window as any).car3DRenderer;
              if (renderer) {
                renderer.setCameraAnimationMode("showcase", 15000);
              }
            }}
            title="展示运镜"
          >
            📷
          </button>
          <button
            className="bg-purple-600 hover:bg-purple-700 text-white p-2 rounded shadow-lg cursor-pointer transition-colors"
            onClick={() => {
              const renderer = (window as any).car3DRenderer;
              if (renderer) {
                renderer.setCameraAnimationMode("cinematic", 20000);
              }
            }}
            title="电影运镜"
          >
            🎬
          </button>
          <button
            className="bg-red-600 hover:bg-red-700 text-white p-2 rounded shadow-lg cursor-pointer transition-colors"
            onClick={() => {
              const renderer = (window as any).car3DRenderer;
              if (renderer) {
                renderer.stopCameraAnimation();
              }
            }}
            title="停止运镜"
          >
            ⏹️
          </button>
        </div>

        {/* 门控制面板 */}
        <div className="absolute top-4 right-4 flex flex-col gap-2 z-20">
          <button
            className="bg-orange-600 hover:bg-orange-700 text-white p-2 rounded shadow-lg cursor-pointer transition-colors"
            onClick={() => {
              const renderer = (window as any).car3DRenderer;
              if (renderer) {
                renderer.controlLeftDoor(1);
              }
            }}
            title="开左门"
          >
            🚪←
          </button>
          <button
            className="bg-orange-600 hover:bg-orange-700 text-white p-2 rounded shadow-lg cursor-pointer transition-colors"
            onClick={() => {
              const renderer = (window as any).car3DRenderer;
              if (renderer) {
                renderer.controlLeftDoor(2);
              }
            }}
            title="关左门"
          >
            🚪→
          </button>
        </div>

        {/* 操作提示 */}
        <div className="absolute bottom-20 left-4 bg-black bg-opacity-70 text-white p-3 rounded text-sm max-w-xs z-20">
          <div className="text-xs space-y-1">
            <div>🖱️ 拖拽旋转 | 🔄 滚轮缩放</div>
            <div>🚪 点击蓝色按钮开关车门</div>
          </div>
        </div>
      </div>
    </div>
  );
};
