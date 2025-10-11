import { useEffect } from "react";

// 声明全局Three.js对象
declare global {
  interface Window {
    THREE: any;
    GLTFLoader: any;
    OrbitControls: any;
  }
}

interface Car3DViewerProps {
  containerId: string;
}

export function Car3DViewer({ containerId }: Car3DViewerProps) {
  useEffect(() => {
    let scene: any;
    let camera: any;
    let renderer: any;
    let controls: any;
    let animationId: number;

    const initializeScene = () => {
      // 检查Three.js库是否加载
      if (!window.THREE || !window.GLTFLoader || !window.OrbitControls) {
        console.log("Three.js libraries not loaded yet, retrying...");
        setTimeout(initializeScene, 1000);
        return;
      }

      const container = document.getElementById(containerId);
      if (!container) {
        console.log("Container not found, retrying...");
        setTimeout(initializeScene, 500);
        return;
      }

      console.log("Initializing 3D scene...");

      // 创建场景
      scene = new window.THREE.Scene();
      scene.background = new window.THREE.Color(0xf0f0f0);

      // 创建相机
      camera = new window.THREE.PerspectiveCamera(
        40,
        container.clientWidth / container.clientHeight,
        0.2,
        1000
      );
      camera.position.set(-8, 2, 1.5);

      // 创建渲染器
      renderer = new window.THREE.WebGLRenderer({ antialias: true });
      renderer.setSize(container.clientWidth, container.clientHeight);
      renderer.shadowMap.enabled = true;
      renderer.shadowMap.type = window.THREE.PCFSoftShadowMap;

      // 清空容器并添加渲染器
      container.innerHTML = "";
      container.appendChild(renderer.domElement);

      // 添加光源
      const ambientLight = new window.THREE.AmbientLight(0x404040, 2);
      scene.add(ambientLight);

      const directionalLight = new window.THREE.DirectionalLight(0xffffff, 1);
      directionalLight.position.set(-1, 1, 1);
      directionalLight.castShadow = true;
      directionalLight.shadow.mapSize.width = 2048;
      directionalLight.shadow.mapSize.height = 2048;
      scene.add(directionalLight);

      // 添加地面
      const groundGeometry = new window.THREE.PlaneGeometry(20, 20);
      const groundMaterial = new window.THREE.MeshLambertMaterial({
        color: 0xcccccc,
      });
      const ground = new window.THREE.Mesh(groundGeometry, groundMaterial);
      ground.rotation.x = -Math.PI / 2;
      ground.position.y = -0.5;
      ground.receiveShadow = true;
      scene.add(ground);

      // 设置控制器
      controls = new window.THREE.OrbitControls(camera, renderer.domElement);
      controls.enableDamping = true;
      controls.dampingFactor = 0.05;
      controls.screenSpacePanning = false;
      controls.minDistance = 3;
      controls.maxDistance = 20;

      // 加载模型
      const loader = new window.THREE.GLTFLoader();
      console.log("Loading car model...");

      loader.load(
        "/car-assets/models/Car.glb",
        (gltf: any) => {
          console.log("Car model loaded successfully");
          const car = gltf.scene;
          car.scale.set(1, 1, 1);
          car.position.set(0, -0.5, 0);

          car.traverse((child: any) => {
            if (child.isMesh) {
              child.castShadow = true;
              child.receiveShadow = true;
            }
          });

          scene.add(car);

          // 隐藏加载提示
          const loading = container.querySelector(".loading-3d");
          if (loading) {
            (loading as HTMLElement).style.display = "none";
          }
        },
        (progress: any) => {
          console.log(
            "Loading progress:",
            (progress.loaded / progress.total) * 100 + "%"
          );
        },
        (error: any) => {
          console.error("Model loading failed:", error);
          // 显示错误信息
          const loading = container.querySelector(".loading-3d");
          if (loading) {
            loading.innerHTML = `
              <div class="text-center">
                <div class="text-red-500 text-lg mb-2">模型加载失败</div>
                <p class="text-gray-500 text-sm">请检查模型文件是否存在</p>
              </div>
            `;
          }
        }
      );

      // 动画循环
      const animate = () => {
        animationId = requestAnimationFrame(animate);
        if (controls) controls.update();
        if (renderer && scene && camera) {
          renderer.render(scene, camera);
        }
      };
      animate();

      // 窗口大小调整
      const handleResize = () => {
        if (!container || !camera || !renderer) return;

        const width = container.clientWidth;
        const height = container.clientHeight;
        camera.aspect = width / height;
        camera.updateProjectionMatrix();
        renderer.setSize(width, height);
      };

      window.addEventListener("resize", handleResize);

      // 返回清理函数
      return () => {
        console.log("Cleaning up 3D scene...");

        window.removeEventListener("resize", handleResize);

        if (animationId) {
          cancelAnimationFrame(animationId);
        }

        if (controls) {
          controls.dispose();
        }

        if (renderer) {
          if (container && container.contains(renderer.domElement)) {
            container.removeChild(renderer.domElement);
          }
          renderer.dispose();
        }

        if (scene) {
          scene.clear();
        }
      };
    };

    // 开始初始化
    const cleanup = initializeScene();

    return cleanup;
  }, [containerId]);

  return null;
}

export default Car3DViewer;
