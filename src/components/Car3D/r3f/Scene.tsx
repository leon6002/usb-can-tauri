/**
 * R3F 场景组件 - 主场景容器
 */
import React, { useRef, useState, useCallback, useEffect } from "react";
import { Canvas } from "@react-three/fiber";
import * as THREE from "three";
import { Lights } from "./Lights";
import { CameraControls, CameraAnimationState } from "./CameraControls";
import { Car } from "./Car";
import { AnimationSystem, AnimationSystemHandle } from "./AnimationSystem";
import { InteractionSystem } from "./InteractionSystem";
import { use3DStore } from "../../../store/car3DStore";
import { useCarControlStore } from "../../../store/carControlStore";
import { Environments } from "./Environments";

export interface SceneProps {
  onSceneReady?: (scene: SceneHandle) => void;
  onError?: (error: Error) => void;
}

export interface SceneHandle {
  animationSystem: AnimationSystemHandle | null;
  camera: THREE.PerspectiveCamera | null;
  scene: THREE.Scene | null;
  cameraAnimationState?: CameraAnimationState;
  controls?: any; // OrbitControls 引用
}

export const Scene: React.FC<SceneProps> = ({ onSceneReady, onError }) => {
  const [car, setCar] = useState<THREE.Group | null>(null);
  const doorStateRef = useRef({ left: false, right: false });
  const sceneHandleRef = useRef<SceneHandle>({
    animationSystem: null,
    camera: null,
    scene: null,
  });
  const { sceneHandle, isDriving } = use3DStore();
  const sendCarCommand = useCarControlStore((state) => state.sendCarCommand);

  const handleModelLoaded = useCallback((loadedCar: THREE.Group) => {
    setCar(loadedCar);
  }, []);

  const handleDoorClick = (door: "left" | "right") => {
    console.log(`[Scene] Door clicked: ${door}`);

    if (!sceneHandle?.animationSystem) {
      console.warn("[Scene] Animation system not ready");
      return;
    }

    // 获取当前门状态（两个门状态相同）
    const currentState = doorStateRef.current.left;
    const newState = !currentState;

    // 发送 CAN 命令（只发送一次）
    const commandId = currentState ? "door_close" : "door_open";
    console.log(
      `🚗 门当前状态: ${
        currentState ? "开启" : "关闭"
      }, 发送CAN命令: ${commandId}`
    );
    sendCarCommand(commandId);

    // 更新两个门的状态
    doorStateRef.current.left = newState;
    doorStateRef.current.right = newState;
    console.log(`🚗 两个门状态更新为: ${newState ? "开启" : "关闭"}`);

    // 同时播放两个门的动画
    sceneHandle.animationSystem.playDoorAnimation("DoorFLOpen", currentState);
    sceneHandle.animationSystem.playDoorAnimation("DoorFROpen", currentState);

    console.log(`[Scene] Both door animations triggered, isOpen=${newState}`);
  };

  const handleCameraAnimationStateReady = (
    animationState: CameraAnimationState
  ) => {
    sceneHandleRef.current.cameraAnimationState = animationState;
  };

  // 当所有组件都准备好时，调用 onSceneReady
  useEffect(() => {
    if (
      car &&
      sceneHandle?.animationSystem &&
      sceneHandleRef.current.camera &&
      sceneHandleRef.current.scene &&
      onSceneReady
    ) {
      // 更新 sceneHandleRef 中的 animationSystem
      sceneHandleRef.current.animationSystem = sceneHandle.animationSystem;
      onSceneReady(sceneHandleRef.current);
      console.log("[Scene] Scene ready callback triggered");
    }
  }, [car, sceneHandle?.animationSystem, onSceneReady]);

  return (
    <Canvas
      camera={{
        position: [5, 3, 5],
        fov: 40,
        near: 0.2,
        far: 1000,
      }}
      shadows
      gl={{
        antialias: true,
        outputColorSpace: THREE.SRGBColorSpace,
        toneMapping: THREE.ACESFilmicToneMapping,
        toneMappingExposure: 1,
      }}
      onCreated={(state) => {
        sceneHandleRef.current.camera = state.camera as THREE.PerspectiveCamera;
        sceneHandleRef.current.scene = state.scene;
      }}
    >
      {/* 灯光 */}
      <Lights />

      {/* 环境 */}
      <Environments />

      {/* 相机控制 */}
      <CameraControls
        sceneHandleRef={sceneHandleRef}
        onAnimationStateReady={handleCameraAnimationStateReady}
      />

      {/* 车辆模型 */}
      <Car onModelLoaded={handleModelLoaded} onError={onError} />

      {/* 动画系统 */}
      {car && <AnimationSystem car={car} />}

      {/* 交互系统 */}
      {car && (
        <InteractionSystem
          car={car}
          isDriving={isDriving}
          onDoorClick={handleDoorClick}
          onObjectClick={(obj) => console.log("Clicked:", obj.name)}
        />
      )}
    </Canvas>
  );
};
