/**
 * R3F 环境组件 - 创建场景背景、雾、地面、道路、天空等
 */
import React, { useEffect, useRef, useMemo } from "react";
import * as THREE from "three";
import { useThree, useFrame } from "@react-three/fiber";
import { use3DStore } from "../../../store/car3DStore";

export interface EnvironmentHandle {
  roadTexture: THREE.Texture | null;
  setRoadTextureOffset: (offset: number) => void;
}

export const Environment: React.FC = () => {
  const { scene } = useThree();
  const roadRef = useRef<THREE.Mesh>(null);
  const groundRef = useRef<THREE.Mesh>(null);
  const roadTextureRef = useRef<THREE.Texture | null>(null);
  const groundTextureRef = useRef<THREE.Texture | null>(null);
  const roadOriginalPositionsRef = useRef<Float32Array | null>(null);

  // 创建天空纹理
  const skyTexture = useMemo(() => {
    const canvas = document.createElement("canvas");
    canvas.width = 1024;
    canvas.height = 512;
    const ctx = canvas.getContext("2d")!;

    // 绘制蓝天渐变背景
    const gradient = ctx.createLinearGradient(0, 0, 0, canvas.height);
    gradient.addColorStop(0, "#87CEEB"); // 浅蓝色（天顶）
    gradient.addColorStop(0.5, "#87CEEB"); // 中间蓝色
    gradient.addColorStop(1, "#E0F6FF"); // 浅蓝色（地平线）
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // 绘制白云
    ctx.fillStyle = "rgba(255, 255, 255, 0.8)";
    drawCloud(ctx, 100, 80, 40);
    drawCloud(ctx, 400, 100, 60);
    drawCloud(ctx, 750, 120, 50);
    drawCloud(ctx, 150, 250, 30);
    drawCloud(ctx, 850, 280, 40);

    const texture = new THREE.CanvasTexture(canvas);
    texture.wrapS = THREE.ClampToEdgeWrapping;
    texture.wrapT = THREE.ClampToEdgeWrapping;
    texture.magFilter = THREE.LinearFilter;
    texture.minFilter = THREE.LinearFilter;
    return texture;
  }, []);

  // 创建地面纹理（草地）
  const groundTexture = useMemo(() => {
    const groundCanvas = document.createElement("canvas");
    groundCanvas.width = 512;
    groundCanvas.height = 512;
    const groundCtx = groundCanvas.getContext("2d")!;

    // 绘制草地纹理
    groundCtx.fillStyle = "#3d7d3d";
    groundCtx.fillRect(0, 0, groundCanvas.width, groundCanvas.height);

    // 添加草地细节纹理
    groundCtx.fillStyle = "rgba(76, 153, 76, 0.6)";
    for (let i = 0; i < 1000; i++) {
      const x = Math.random() * groundCanvas.width;
      const y = Math.random() * groundCanvas.height;
      const size = Math.random() * 3 + 1;
      groundCtx.fillRect(x, y, size, size * 2);
    }

    // 添加更细的草纹
    groundCtx.fillStyle = "rgba(102, 178, 102, 0.4)";
    for (let i = 0; i < 1000; i++) {
      const x = Math.random() * groundCanvas.width;
      const y = Math.random() * groundCanvas.height;
      const size = Math.random() * 1.5;
      groundCtx.fillRect(x, y, size, size * 3);
    }

    const texture = new THREE.CanvasTexture(groundCanvas);
    texture.wrapS = THREE.RepeatWrapping;
    texture.wrapT = THREE.RepeatWrapping;
    texture.repeat.set(4, 4);
    texture.magFilter = THREE.LinearFilter;
    texture.minFilter = THREE.LinearFilter;
    return texture;
  }, []);

  // 创建道路纹理
  const roadTexture = useMemo(() => {
    const canvas = document.createElement("canvas");
    canvas.width = 512;
    canvas.height = 512;
    const ctx = canvas.getContext("2d")!;

    // 绘制道路背景
    ctx.fillStyle = "#2c2c2c";
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // 绘制道路标线
    ctx.strokeStyle = "#ffffff";
    ctx.lineWidth = 4;
    ctx.setLineDash([63, 192]);

    // 中央虚线
    ctx.beginPath();
    ctx.moveTo(canvas.width / 2, 0);
    ctx.lineTo(canvas.width / 2, canvas.height);
    ctx.stroke();

    // 边线
    ctx.setLineDash([]);
    ctx.lineWidth = 6;
    ctx.beginPath();
    ctx.moveTo(50, 0);
    ctx.lineTo(50, canvas.height);
    ctx.stroke();

    ctx.beginPath();
    ctx.moveTo(canvas.width - 50, 0);
    ctx.lineTo(canvas.width - 50, canvas.height);
    ctx.stroke();

    const texture = new THREE.CanvasTexture(canvas);
    texture.wrapS = THREE.RepeatWrapping;
    texture.wrapT = THREE.RepeatWrapping;
    texture.repeat.set(1, 5);
    return texture;
  }, []);

  useEffect(() => {
    // 设置场景背景和雾
    scene.background = new THREE.Color(0x87ceeb);
    scene.fog = new THREE.Fog(0xe0f6ff, 10, 1000);

    // 暴露纹理给 R3FSceneManager
    roadTextureRef.current = roadTexture;
    groundTextureRef.current = groundTexture;
    (scene as any).roadTexture = roadTexture;
    (scene as any).groundTexture = groundTexture;

    return () => {
      // 清理
    };
  }, [scene, roadTexture, groundTexture]);

  // 保存道路原始顶点位置
  useEffect(() => {
    if (!roadRef.current) return;

    const geometry = roadRef.current.geometry as THREE.BufferGeometry;
    const positionAttribute = geometry.getAttribute("position");

    if (positionAttribute && positionAttribute.array instanceof Float32Array) {
      // 创建原始数据的副本
      roadOriginalPositionsRef.current = new Float32Array(
        positionAttribute.array
      );
    }
  }, []);

  // 更新道路变形（根据转向角弯曲道路）
  useFrame(() => {
    if (!roadRef.current || !roadOriginalPositionsRef.current) return;

    const { vehicleDynamics } = use3DStore.getState();
    const { steeringAngle } = vehicleDynamics;

    // 道路不旋转，只弯曲

    // 根据转向角弯曲道路
    const geometry = roadRef.current.geometry as THREE.BufferGeometry;
    const positionAttribute = geometry.getAttribute("position");

    if (positionAttribute && positionAttribute.array instanceof Float32Array) {
      const positions = positionAttribute.array as Float32Array;
      const originalPositions = roadOriginalPositionsRef.current;

      // 计算弯曲半径（基于转向角）
      // 使用更小的系数让弯曲更明显
      const isSteeringSignificant = Math.abs(steeringAngle) > 0.001;
      const curveRadius = isSteeringSignificant
        ? 15 / Math.tan(steeringAngle) // 从 50 改为 15，让弯曲更明显
        : Infinity;

      // 从原始数据计算弯曲后的顶点位置
      // 注意：道路被旋转了 -90 度，所以 Y 坐标是道路的长度方向
      for (let i = 0; i < originalPositions.length; i += 3) {
        const origX = originalPositions[i]; // 道路宽度方向（左右）
        const origY = originalPositions[i + 1]; // 道路长度方向（前后）
        const origZ = originalPositions[i + 2]; // 高度（应该都是 0）

        // 根据 Y 坐标（沿道路长度）计算弯曲
        if (isSteeringSignificant && Math.abs(curveRadius) > 1) {
          // 计算弯曲后的 X 坐标
          const angle = origY / curveRadius;
          const newX = origX + (curveRadius - Math.cos(angle) * curveRadius);

          positions[i] = newX;
          positions[i + 1] = origY;
          positions[i + 2] = origZ;
        } else {
          // 直线道路 - 直接使用原始坐标
          positions[i] = origX;
          positions[i + 1] = origY;
          positions[i + 2] = origZ;
        }
      }

      positionAttribute.needsUpdate = true;
      geometry.computeVertexNormals();
    }
  });

  return (
    <>
      {/* 天空球体 */}
      <Sky skyTexture={skyTexture} />

      {/* 圆形地面（草地） */}
      <mesh
        ref={groundRef}
        rotation={[-Math.PI / 2, 0, 0]}
        position={[0, -0.5, 0.5]}
        receiveShadow
      >
        <circleGeometry args={[75, 64]} />
        <meshLambertMaterial map={groundTexture} color={0xffffff} />
      </mesh>

      {/* 道路 */}
      <mesh
        ref={roadRef}
        position={[0, -0.49, 0]}
        rotation={[-Math.PI / 2, 0, 0]}
        receiveShadow
        name="Road"
      >
        <planeGeometry args={[10, 150, 2, 100]} />
        <meshLambertMaterial
          map={roadTexture}
          transparent={false}
          side={THREE.DoubleSide}
        />
      </mesh>
    </>
  );
};

/**
 * 天空球体组件
 */
const Sky: React.FC<{ skyTexture: THREE.Texture }> = ({ skyTexture }) => {
  const { camera } = useThree();
  const skyRef = useRef<THREE.Mesh>(null);

  useFrame(() => {
    // 每帧更新天空位置，使其始终跟随相机
    if (skyRef.current) {
      skyRef.current.position.copy(camera.position);
    }
  });

  return (
    <mesh ref={skyRef}>
      <sphereGeometry args={[500, 64, 64]} />
      <meshBasicMaterial
        map={skyTexture}
        side={THREE.BackSide}
        toneMapped={false}
      />
    </mesh>
  );
};

/**
 * 绘制云朵
 */
function drawCloud(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  size: number
): void {
  ctx.beginPath();
  ctx.arc(x - size, y, size * 0.6, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.arc(x, y - size * 0.3, size * 0.8, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.arc(x + size, y, size * 0.6, 0, Math.PI * 2);
  ctx.fill();
}
