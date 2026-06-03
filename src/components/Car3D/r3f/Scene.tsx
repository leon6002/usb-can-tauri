/**
 * R3F scene component - main scene container
 */
import React, { Suspense, useRef, useState, useCallback, useEffect } from "react";
import { Canvas } from "@react-three/fiber";
import * as THREE from "three";
import { Lights } from "./Lights";
import { CameraControls, CameraAnimationState } from "./CameraControls";
import { Car } from "./Car";
import { AnimationSystem, AnimationSystemHandle } from "./AnimationSystem";
import { InteractionSystem } from "./InteractionSystem";
import { use3DStore } from "../../../store/car3DStore";
import { useCarControlStore } from "../../../store/carControlStore";
import { isIndependentDoors } from "../../../config/appConfig";
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
  controls?: any; // OrbitControls reference
}

export const Scene: React.FC<SceneProps> = ({ onSceneReady, onError }) => {
  const [car, setCar] = useState<THREE.Group | null>(null);
  const doorStateRef = useRef({ left: false, right: false });
  const sceneHandleRef = useRef<SceneHandle>({
    animationSystem: null,
    camera: null,
    scene: null,
  });
  const sceneHandle = use3DStore((state) => state.sceneHandle);
  const isDriving = use3DStore((state) => state.isDriving);
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

    const independent = isIndependentDoors();

    if (independent) {
      // Independent mode: operate only the clicked door
      const currentState = doorStateRef.current[door];
      const newState = !currentState;
      const prefix = door === "left" ? "left_door" : "right_door";
      const commandId = currentState ? `${prefix}_close` : `${prefix}_open`;
      const animName = door === "left" ? "DoorFLOpen" : "DoorFROpen";

      console.log(
        `[Scene] ${door} door is ${currentState ? "open" : "closed"}, sending: ${commandId}`
      );
      sendCarCommand(commandId);

      doorStateRef.current[door] = newState;
      console.log(`[Scene] ${door} door state updated to: ${newState ? "open" : "closed"}`);

      sceneHandle.animationSystem.playDoorAnimation(animName, currentState);
      console.log(`[Scene] ${door} door animation triggered, isOpen=${newState}`);
    } else {
      // Linked mode: both doors together
      const currentState = doorStateRef.current.left;
      const newState = !currentState;

      const commandId = currentState ? "door_close" : "door_open";
      console.log(
        `[Scene] Doors are ${currentState ? "open" : "closed"}, sending: ${commandId}`
      );
      sendCarCommand(commandId);

      doorStateRef.current.left = newState;
      doorStateRef.current.right = newState;
      console.log(`[Scene] Both doors state updated to: ${newState ? "open" : "closed"}`);

      sceneHandle.animationSystem.playDoorAnimation("DoorFLOpen", currentState);
      sceneHandle.animationSystem.playDoorAnimation("DoorFROpen", currentState);
      console.log(`[Scene] Both door animations triggered, isOpen=${newState}`);
    }
  };

  const handleCameraAnimationStateReady = useCallback((
    animationState: CameraAnimationState
  ) => {
    sceneHandleRef.current.cameraAnimationState = animationState;
  }, []);

  // When all components are ready, call onSceneReady
  useEffect(() => {
    console.log("[Scene] useEffect: Checking if scene is ready", {
      car: !!car,
      animSystem: !!sceneHandle?.animationSystem,
      camera: !!sceneHandleRef.current.camera,
      scene: !!sceneHandleRef.current.scene,
      onSceneReady: !!onSceneReady
    });
    if (
      car &&
      sceneHandle?.animationSystem &&
      sceneHandleRef.current.camera &&
      sceneHandleRef.current.scene &&
      onSceneReady
    ) {
      // Update animationSystem in sceneHandleRef
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
      {/* Lights */}
      <Lights />

      {/* Environment */}
      <Environments />

      {/* Camera controls */}
      <CameraControls
        sceneHandleRef={sceneHandleRef}
        onAnimationStateReady={handleCameraAnimationStateReady}
      />

      {/* Car model */}
      <Suspense fallback={null}>
        <Car onModelLoaded={handleModelLoaded} onError={onError} />
      </Suspense>

      {/* Animation system */}
      {car && <AnimationSystem car={car} />}

      {/* Interaction system */}
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
