/**
 * R3F 环境组件 - 创建场景背景、雾、地面、道路、天空等
 */
import React, { useEffect, useRef, useMemo } from "react";
import * as THREE from "three";
import { useThree, useFrame } from "@react-three/fiber";
import { useTexture, Environment } from "@react-three/drei";
import { use3DStore } from "../../../store/car3DStore";

export interface EnvironmentsHandle {
  roadTexture: THREE.Texture | null;
  setRoadTextureOffset: (offset: number) => void;
}

export const Environments: React.FC = () => {
  const { scene, gl } = useThree();
  const roadRef = useRef<THREE.Mesh>(null);
  const groundRef = useRef<THREE.Mesh>(null);
  const roadTextureRef = useRef<THREE.Texture | null>(null);
  const groundTextureRef = useRef<THREE.Texture | null>(null);
  const roadOriginalPositionsRef = useRef<Float32Array | null>(null);

  // 加载草地贴图
  //
  const [groundDiffuse, groundNormal, groundRoughness] = useTexture([
    "/textures/aerial_beach_01_diff_1k.jpg",
    "/textures/aerial_beach_01_nor_gl_1k.jpg",
    "/textures/aerial_beach_01_rough_1k.jpg",
  ]);

  // 配置草地贴图
  useEffect(() => {
    const maxAnisotropy = gl.capabilities.getMaxAnisotropy();

    [groundDiffuse, groundNormal, groundRoughness].forEach((texture, index) => {
      texture.wrapS = THREE.RepeatWrapping;
      texture.wrapT = THREE.RepeatWrapping;
      texture.repeat.set(30, 30);
      texture.anisotropy = maxAnisotropy; // 启用各向异性过滤，提高清晰度
      texture.minFilter = THREE.LinearMipmapLinearFilter;
      texture.magFilter = THREE.LinearFilter;
      // 必须加这个needUpdate，不然模糊的不行
      texture.needsUpdate = true;

      texture.colorSpace =
        index === 0 ? THREE.SRGBColorSpace : THREE.NoColorSpace;
    });
  }, [gl, groundDiffuse, groundNormal, groundRoughness]);

  // 创建车道线纹理（浅灰色背景 + 白线 + 边缘渐变）
  const roadLinesTexture = useMemo(() => {
    const canvas = document.createElement("canvas");
    canvas.width = 512;
    canvas.height = 512;
    const ctx = canvas.getContext("2d")!;

    // 填充浅灰色道路背景（更接近真实沥青颜色）
    ctx.fillStyle = "#6a6a6a";
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // 添加左右边缘渐变（从道路颜色渐变到透明）
    const edgeWidth = 50; // 渐变宽度

    // 左边缘渐变
    const leftGradient = ctx.createLinearGradient(0, 0, edgeWidth, 0);
    leftGradient.addColorStop(0, "rgba(88, 88, 88, 0)"); // 完全透明
    leftGradient.addColorStop(1, "rgba(88, 88, 88, 1)"); // 道路颜色
    ctx.fillStyle = leftGradient;
    ctx.fillRect(0, 0, edgeWidth, canvas.height);

    // 右边缘渐变
    const rightGradient = ctx.createLinearGradient(
      canvas.width - edgeWidth,
      0,
      canvas.width,
      0
    );
    rightGradient.addColorStop(0, "rgba(74, 74, 74, 1)"); // 道路颜色
    rightGradient.addColorStop(1, "rgba(74, 74, 74, 0)"); // 完全透明
    ctx.fillStyle = rightGradient;
    ctx.fillRect(canvas.width - edgeWidth, 0, edgeWidth, canvas.height);

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
    scene.background = new THREE.Color(0x7a8faf);

    // 使用指数雾（FogExp2）替代线性雾，让过渡更自然
    // 密度值越小，雾效越淡，过渡越平滑
    scene.fog = new THREE.FogExp2(0x7a8faf, 0.0085);

    // 暴露纹理给 R3FSceneManager 和 AnimationSystem
    roadTextureRef.current = roadLinesTexture;
    groundTextureRef.current = groundDiffuse;
    (scene as any).roadTexture = roadLinesTexture;
    (scene as any).roadLinesTexture = roadLinesTexture;
    (scene as any).groundTexture = groundDiffuse;
    (scene as any).groundNormalMap = groundNormal;
    (scene as any).groundRoughnessMap = groundRoughness;

    return () => {
      // 清理
    };
  }, [scene, roadLinesTexture, groundDiffuse, groundNormal, groundRoughness]);

  // 保存道路原始顶点位置
  useEffect(() => {
    if (roadRef.current) {
      const geometry = roadRef.current.geometry as THREE.BufferGeometry;
      const positionAttribute = geometry.getAttribute("position");

      if (
        positionAttribute &&
        positionAttribute.array instanceof Float32Array
      ) {
        roadOriginalPositionsRef.current = new Float32Array(
          positionAttribute.array
        );
      }
    }
  }, []);

  // 更新道路变形（根据转向角弯曲道路）
  useFrame(() => {
    if (!roadRef.current || !roadOriginalPositionsRef.current) return;

    const { vehicleDynamics } = use3DStore.getState();
    const { steeringAngle } = vehicleDynamics;

    // 计算弯曲半径（基于转向角）
    // 调整此系数以匹配轮胎转向角和道路扭曲程度
    // 较小的值会导致更急的弯曲，较大的值会导致更平缓的弯曲
    const ROAD_CURVATURE_FACTOR = 10; // 原值为 15
    const isSteeringSignificant = Math.abs(steeringAngle) > 0.001;
    const curveRadius = isSteeringSignificant
      ? ROAD_CURVATURE_FACTOR / Math.tan(steeringAngle)
      : Infinity;

    // 更新道路
    const roadGeometry = roadRef.current.geometry as THREE.BufferGeometry;
    const roadPositionAttr = roadGeometry.getAttribute("position");

    if (roadPositionAttr && roadPositionAttr.array instanceof Float32Array) {
      const positions = roadPositionAttr.array as Float32Array;
      const originalPositions = roadOriginalPositionsRef.current;

      for (let i = 0; i < originalPositions.length; i += 3) {
        const origX = originalPositions[i];
        const origY = originalPositions[i + 1];
        const origZ = originalPositions[i + 2];

        if (isSteeringSignificant && Math.abs(curveRadius) > 1) {
          const angle = origY / curveRadius;
          const newX = origX + (curveRadius - Math.cos(angle) * curveRadius);
          positions[i] = newX;
          positions[i + 1] = origY;
          positions[i + 2] = origZ;
        } else {
          positions[i] = origX;
          positions[i + 1] = origY;
          positions[i + 2] = origZ;
        }
      }

      roadPositionAttr.needsUpdate = true;
      roadGeometry.computeVertexNormals();
    }
  });

  return (
    <>
      <Environment
        files="/textures/qwantani_puresky_1k.exr" // 确保 HDR 文件在 public 目录下
        background={true}
      />

      {/* 平面地面（草地） */}
      <mesh
        ref={groundRef}
        rotation={[-Math.PI / 2, 0, 0]}
        position={[0, -0.5, 0.5]}
        receiveShadow
      >
        <planeGeometry args={[300, 300]} />
        <meshStandardMaterial
          map={groundDiffuse}
          normalMap={groundNormal}
          roughnessMap={groundRoughness}
          roughness={1}
        />
      </mesh>

      {/* 道路 */}
      <mesh
        ref={roadRef}
        position={[0, -0.49, 0]}
        rotation={[-Math.PI / 2, 0, 0]}
        receiveShadow
        name="Road"
      >
        <planeGeometry args={[10, 300, 2, 300]} />
        <meshLambertMaterial
          map={roadLinesTexture}
          transparent={true}
          alphaTest={0.01}
          side={THREE.DoubleSide}
        />
      </mesh>
    </>
  );
};
