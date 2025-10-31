/**
 * R3F 车辆模型组件 - 使用 @react-three/drei 的 useGLTF
 */
import React, { useEffect, useRef } from "react";
import { useGLTF } from "@react-three/drei";
import * as THREE from "three";

export interface CarProps {
  onModelLoaded?: (car: THREE.Group) => void;
  onError?: (error: Error) => void;
}

export const Car: React.FC<CarProps> = ({ onModelLoaded, onError }) => {
  const groupRef = useRef<THREE.Group>(null);

  // 在组件内部调用 useGLTF
  let gltf;
  try {
    gltf = useGLTF("/car-assets/models/Car.glb");
  } catch (error) {
    console.error("Failed to load car model:", error);
    if (onError) {
      onError(error as Error);
    }
    return null;
  }

  useEffect(() => {
    if (groupRef.current && gltf) {
      // 设置模型属性
      groupRef.current.traverse((child) => {
        if (child instanceof THREE.Mesh) {
          child.castShadow = true;
          child.receiveShadow = false;
        }
      });

      // 暴露模型的 mixer 和 animations
      if (gltf.animations && gltf.animations.length > 0) {
        const mixer = new THREE.AnimationMixer(groupRef.current);
        (groupRef.current as any).mixer = mixer;
        (groupRef.current as any).animations = gltf.animations;
        console.log(
          `[Car] Animations found: ${gltf.animations
            .map((a) => a.name)
            .join(", ")}`
        );
      }

      // 调用回调函数
      if (onModelLoaded) {
        onModelLoaded(groupRef.current);
      }

      console.log("✅ 车辆模型加载完成");
    }
  }, [gltf, onModelLoaded]);

  if (!gltf) {
    return null;
  }

  return (
    <group ref={groupRef} scale={[1, 1, 1]} position={[0, -0.5, 0]}>
      <primitive object={gltf.scene} />
    </group>
  );
};

// 预加载模型
useGLTF.preload("/car-assets/models/Car.glb");
