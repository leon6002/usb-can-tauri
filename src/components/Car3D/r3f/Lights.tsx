/**
 * R3F 灯光组件 - 替代原有的 SceneManager 中的灯光创建
 */
import React, { useRef } from "react";
import * as THREE from "three";

export const Lights: React.FC = () => {
  const directionalLightRef = useRef<THREE.DirectionalLight>(null);

  return (
    <>
      {/* 环境光 - 模拟天空散射光，提供柔和的基础照明 */}
      <ambientLight intensity={0.4} color={0xb0c4de} />

      {/* 主光源 - 模拟太阳光，从右前上方照射 */}
      <directionalLight
        ref={directionalLightRef}
        position={[10, 20, 8]}
        intensity={1.5}
        color={0xfff5e6}
        castShadow
        shadow-mapSize-width={2048}
        shadow-mapSize-height={2048}
        shadow-camera-near={5}
        shadow-camera-far={50}
        shadow-camera-left={-20}
        shadow-camera-right={20}
        shadow-camera-top={20}
        shadow-camera-bottom={-20}
        shadow-bias={-0.0001}
      />

      {/* 补光 - 从车辆前方提供柔和的填充光 */}
      <directionalLight
        position={[0, 5, 15]}
        intensity={0.3}
        color={0xffffff}
      />

      {/* 背光 - 从后方提供轮廓光 */}
      <directionalLight
        position={[-5, 8, -10]}
        intensity={0.4}
        color={0xe6f2ff}
      />
    </>
  );
};
