/**
 * R3F 灯光组件 - 替代原有的 SceneManager 中的灯光创建
 */
import React, { useRef } from "react";
import * as THREE from "three";

export const Lights: React.FC = () => {
  const directionalLightRef = useRef<THREE.DirectionalLight>(null);

  return (
    <>
      {/* 大幅增强环境光 - 提供强烈的基础照明 */}
      <ambientLight intensity={1.5} color={0xffffff} />

      {/* 主光源 - 从右上方照射，产生阴影 */}
      <directionalLight
        ref={directionalLightRef}
        position={[-8, 15, 12]}
        intensity={2.0}
        castShadow
        shadow-mapSize-width={2048}
        shadow-mapSize-height={2048}
        shadow-camera-near={5}
        shadow-camera-far={40}
        shadow-camera-left={15}
        shadow-camera-right={-15}
        shadow-camera-top={15}
        shadow-camera-bottom={-15}
      />

      {/* 背光补充光源 - 从左后方照射，照亮背光面 */}
      <directionalLight
        position={[-12, 8, -10]}
        intensity={1.2}
        color={0xffffff}
      />

      {/* 侧面补充光源 - 从右侧照射 */}
      <directionalLight
        position={[20, 6, 0]}
        intensity={1.0}
        color={0xffffff}
      />

      {/* 左侧补充光源 - 从左侧照射，平衡光照 */}
      <directionalLight
        position={[-20, 6, 0]}
        intensity={0.8}
        color={0xffffff}
      />

      {/* 前方补充光源 - 从前方照射车头 */}
      <directionalLight
        position={[0, 8, 15]}
        intensity={0.6}
        color={0xffffff}
      />

      {/* 底部补充光源 - 从下方照射，减少过暗的阴影 */}
      <directionalLight
        position={[0, -3, 0]}
        intensity={0.8}
        color={0xffffff}
      />

      {/* 添加点光源 - 在车辆周围提供额外照明 */}
      <pointLight position={[5, 5, 5]} intensity={1.0} distance={30} />
      <pointLight position={[-5, 5, -5]} intensity={1.0} distance={30} />

      {/* 顶部聚光灯 - 模拟摄影棚效果 */}
      <spotLight
        position={[0, 20, 0]}
        intensity={1.5}
        distance={50}
        angle={Math.PI / 6}
        penumbra={0.1}
      />
    </>
  );
};
