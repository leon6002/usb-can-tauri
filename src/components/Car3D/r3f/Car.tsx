/**
 * R3F car model component using @react-three/drei useGLTF
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

  // Hooks must be called unconditionally before any early return
  const gltf = useGLTF("/car-assets/models/Car.glb");

  useEffect(() => {
    if (!gltf || !gltf.scene) {
      const err = new Error("Car model not loaded");
      console.error("Failed to load car model:", err);
      onError?.(err);
      return;
    }

    if (groupRef.current) {
      // Set model properties
      groupRef.current.traverse((child) => {
        if (child instanceof THREE.Mesh) {
          child.castShadow = true;
          child.receiveShadow = false;
        }
      });

      // Expose mixer and animations
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

      onModelLoaded?.(groupRef.current);
      console.log("[Car] Model loaded successfully");
    }
  }, [gltf, onModelLoaded]);

  if (!gltf || !gltf.scene) {
    return null;
  }

  return (
    <group ref={groupRef} scale={[1, 1, 1]} position={[0, -0.5, 0]}>
      <primitive object={gltf.scene} />
    </group>
  );
};

// Preload model
useGLTF.preload("/car-assets/models/Car.glb");
