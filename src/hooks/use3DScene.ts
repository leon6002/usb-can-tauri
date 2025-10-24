import { useState, useEffect, useRef } from "react";
import { Car3DRenderer } from "../components/Car3DRenderer";
import { Scene3DStatus, ActiveTab } from "../types";

export const use3DScene = (
  activeTab: ActiveTab,
  onSendCommand?: (commandId: string) => void
) => {
  const [scene3DStatus, setScene3DStatus] = useState<Scene3DStatus>("loading");
  const car3DRendererRef = useRef<Car3DRenderer | null>(null);

  // 初始化3D场景
  useEffect(() => {
    // 只在车辆控制tab激活时初始化3D场景
    if (activeTab !== "car") {
      // 如果切换到其他tab，暂停渲染循环以节省资源
      if (
        car3DRendererRef.current &&
        (car3DRendererRef.current as any).pauseAnimation
      ) {
        console.log("Pausing 3D animation for inactive tab");
        (car3DRendererRef.current as any).pauseAnimation();
      }
      return;
    }

    const init3DScene = () => {
      const container = document.getElementById("car-3d-container");
      if (!container) {
        console.log("Container not found, will retry...");
        return;
      }

      // 检查是否已经初始化过，并且渲染器仍然连接到正确的DOM容器
      if (car3DRendererRef.current) {
        const currentRenderer = car3DRendererRef.current;

        // 如果渲染器存在且连接到正确的容器
        if (
          currentRenderer.isActive &&
          (currentRenderer as any).container === container
        ) {
          // 检查是否需要恢复动画
          if (!currentRenderer.isActive()) {
            console.log("3D scene exists but paused, resuming animation...");
            if ((currentRenderer as any).resumeAnimation) {
              (currentRenderer as any).resumeAnimation();
            }
          } else {
            console.log(
              "3D scene already initialized and active, updating UI..."
            );
          }

          setScene3DStatus("ready");

          // 隐藏加载提示
          const loadingElement = container.querySelector(".loading-3d");
          if (loadingElement) {
            (loadingElement as HTMLElement).style.display = "none";
          }
          return;
        } else {
          // 如果容器不匹配或渲染器已停止，清理旧的渲染器
          console.log(
            "3D renderer inactive or container mismatch, reinitializing..."
          );
          if (currentRenderer.dispose) {
            currentRenderer.dispose();
          }
          car3DRendererRef.current = null;
          // 清理全局引用
          if ((window as any).car3DRenderer === currentRenderer) {
            delete (window as any).car3DRenderer;
          }
        }
      }

      try {
        console.log("Initializing 3D car scene with npm Three.js...");
        setScene3DStatus("loading");

        // 创建3D渲染器实例
        const renderer = new Car3DRenderer("car-3d-container", onSendCommand);
        car3DRendererRef.current = renderer;

        // 将渲染器实例保存到全局，供按钮控制使用
        (window as any).car3DRenderer = renderer;

        // 隐藏加载提示
        const loadingElement = container.querySelector(".loading-3d");
        if (loadingElement) {
          setTimeout(() => {
            (loadingElement as HTMLElement).style.opacity = "0";
            setTimeout(() => {
              (loadingElement as HTMLElement).style.display = "none";
            }, 500);
          }, 2000); // 2秒后开始淡出
        }

        console.log("✅ 3D scene initialized successfully with npm packages");
        console.log("🎮 Car3DRenderer instance:", renderer);
        console.log(
          "📦 Available methods:",
          Object.getOwnPropertyNames(Object.getPrototypeOf(renderer))
        );

        // 更新状态
        setScene3DStatus("ready");
      } catch (error) {
        console.error("Failed to initialize 3D scene:", error);
        setScene3DStatus("error");

        // 显示错误信息
        const loadingElement = container.querySelector(".loading-3d");
        if (loadingElement) {
          loadingElement.innerHTML = `
            <div class="text-center">
              <div class="text-red-500 text-lg mb-4">❌ 3D场景初始化失败</div>
              <p class="text-gray-600 text-sm">${error}</p>
              <button
                onclick="location.reload()"
                class="mt-4 px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 transition-colors"
              >
                重新加载
              </button>
            </div>
          `;
        }
      }
    };

    // 开始初始化，如果容器不存在则延迟重试
    const container = document.getElementById("car-3d-container");
    if (container) {
      init3DScene();
    } else {
      // 延迟重试
      const timer = setTimeout(() => {
        init3DScene();
      }, 100);
      return () => clearTimeout(timer);
    }
  }, [activeTab]); // 监听activeTab变化

  // 组件卸载时清理3D场景
  useEffect(() => {
    return () => {
      if (car3DRendererRef.current && car3DRendererRef.current.dispose) {
        console.log("Disposing 3D scene...");
        car3DRendererRef.current.dispose();
      }
      // 清理全局引用
      if ((window as any).car3DRenderer === car3DRendererRef.current) {
        delete (window as any).car3DRenderer;
      }
      car3DRendererRef.current = null;
    };
  }, []);

  return {
    scene3DStatus,
    car3DRendererRef,
  };
};
