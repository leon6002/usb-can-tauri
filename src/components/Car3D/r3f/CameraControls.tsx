/**
 * R3F 相机控制组件 - 使用 @react-three/drei 的 OrbitControls
 */
import React, { useEffect, useRef } from "react";
import { OrbitControls } from "@react-three/drei";
import { useThree, useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { use3DStore } from "../../../store/car3DStore";

export interface CameraKeyframe {
  position: THREE.Vector3;
  target: THREE.Vector3;
  time: number;
}

export interface CameraAnimationState {
  isActive: boolean;
  mode: string;
  startTime: number;
  duration: number;
  originalPosition: THREE.Vector3 | null;
  originalTarget: THREE.Vector3 | null;
  keyframes: CameraKeyframe[];
  currentKeyframe: number;
  keepFinalPosition: boolean;
}

export interface CameraControlsProps {
  sceneHandleRef?: React.MutableRefObject<any>;
  onAnimationStateReady?: (animationState: CameraAnimationState) => void;
}

export const CameraControls: React.FC<CameraControlsProps> = ({
  sceneHandleRef,
  onAnimationStateReady,
}) => {
  const { camera } = useThree();
  const controlsRef = useRef<any>(null);
  const controlsSavedOnceRef = useRef(false);
  const animationStateRef = useRef<CameraAnimationState>({
    isActive: false,
    mode: "orbit",
    startTime: 0,
    duration: 2000,
    originalPosition: null,
    originalTarget: null,
    keyframes: [],
    currentKeyframe: 0,
    keepFinalPosition: false,
  });
  const isDrivingRef = useRef(false);
  const cameraHeightRef = useRef(1);
  const cameraDistanceRef = useRef(8);
  const maxCameraLateralOffsetRef = useRef(14);

  // 设置相机动画关键帧
  const setupCameraKeyframes = (mode: string): CameraKeyframe[] => {
    const keyframes: CameraKeyframe[] = [];
    const currentPos = camera.position.clone();

    switch (mode) {
      case "driving":
        // 行驶视角：从当前位置过渡到车后方
        keyframes.push(
          { position: currentPos, target: new THREE.Vector3(0, 0, 0), time: 0 },
          {
            position: new THREE.Vector3(
              0,
              cameraHeightRef.current,
              cameraDistanceRef.current
            ),
            target: new THREE.Vector3(0, 0, 0),
            time: 1,
          }
        );
        break;
      case "side":
        // 侧面视角：从当前位置过渡到车的侧面
        // 测试：改到车的正右侧 (X=10, Y=3, Z=0)
        keyframes.push(
          { position: currentPos, target: new THREE.Vector3(0, 0, 0), time: 0 },
          {
            position: new THREE.Vector3(10, 3, 0),
            target: new THREE.Vector3(0, 0, 0),
            time: 1,
          }
        );
        break;
      default:
        keyframes.push(
          { position: currentPos, target: new THREE.Vector3(0, 0, 0), time: 0 },
          { position: currentPos, target: new THREE.Vector3(0, 0, 0), time: 1 }
        );
    }

    return keyframes;
  };

  useEffect(() => {
    // 设置初始相机位置
    camera.position.set(-8, 1, 4);
    camera.lookAt(0, 0, 0);

    if (onAnimationStateReady) {
      onAnimationStateReady(animationStateRef.current);
    }

    // 延迟一帧，确保 OrbitControls 已经初始化
    const timer = setTimeout(() => {
      if (
        controlsRef.current &&
        sceneHandleRef &&
        !controlsSavedOnceRef.current
      ) {
        console.log(
          "[CameraControls] Initializing controls and camera animation methods"
        );

        sceneHandleRef.current.controls = controlsRef.current;

        // 暴露 setIsDriving 方法
        sceneHandleRef.current.setIsDriving = (isDriving: boolean) => {
          isDrivingRef.current = isDriving;
          if (controlsRef.current) {
            controlsRef.current.enabled = !isDriving;
          }
          console.log(`[CameraControls] setIsDriving: ${isDriving}`);
        };

        // 暴露相机动画方法
        sceneHandleRef.current.startCameraAnimation = (
          mode: string,
          duration: number = 3000,
          keepFinalPosition: boolean = false
        ) => {
          const animState = animationStateRef.current;
          animState.isActive = true;
          animState.mode = mode;
          animState.startTime = Date.now();
          animState.duration = duration;
          animState.originalPosition = camera.position.clone();
          animState.originalTarget =
            controlsRef.current?.target?.clone() || new THREE.Vector3(0, 0, 0);
          animState.keepFinalPosition = keepFinalPosition;
          animState.keyframes = setupCameraKeyframes(mode);
          animState.currentKeyframe = 0;
          console.log(
            `[CameraControls] startCameraAnimation: mode=${mode}, duration=${duration}, keepFinalPosition=${keepFinalPosition}`
          );
        };

        sceneHandleRef.current.stopCameraAnimation = () => {
          const animState = animationStateRef.current;
          animState.isActive = false;
          console.log("[CameraControls] stopCameraAnimation");
        };

        // 同时更新 store 中的 sceneHandle
        const { sceneHandle: storeSceneHandle } = use3DStore.getState();
        if (storeSceneHandle) {
          (storeSceneHandle as any).startCameraAnimation =
            sceneHandleRef.current.startCameraAnimation;
          (storeSceneHandle as any).stopCameraAnimation =
            sceneHandleRef.current.stopCameraAnimation;
          (storeSceneHandle as any).setIsDriving =
            sceneHandleRef.current.setIsDriving;
          (storeSceneHandle as any).controls = controlsRef.current;
          console.log(
            "[CameraControls] Camera animation methods and controls added to store sceneHandle"
          );
        }

        controlsSavedOnceRef.current = true;
      }
    }, 100);

    return () => clearTimeout(timer);
  }, [camera, onAnimationStateReady, sceneHandleRef, setupCameraKeyframes]);

  // 相机动画循环
  useFrame(() => {
    const animState = animationStateRef.current;

    if (animState.isActive && animState.keyframes.length >= 2) {
      const elapsed = Date.now() - animState.startTime;
      const progress = Math.min(elapsed / animState.duration, 1);

      // 在关键帧之间插值
      interpolateKeyframes(
        progress,
        animState,
        camera as THREE.PerspectiveCamera,
        controlsRef.current
      );

      // 动画完成
      if (progress >= 1) {
        console.log(
          `[CameraControls] Animation completed: mode=${animState.mode}, keepFinalPosition=${animState.keepFinalPosition}, isDriving=${isDrivingRef.current}`
        );
        animState.isActive = false;
        if (
          !animState.keepFinalPosition &&
          animState.originalPosition &&
          animState.originalTarget
        ) {
          camera.position.copy(animState.originalPosition);
          if (controlsRef.current) {
            controlsRef.current.target.copy(animState.originalTarget);
            controlsRef.current.enabled = true;
          }
        } else {
          // 动画完成后，如果是行驶模式，启用相机旋转补偿
          if (isDrivingRef.current && animState.mode === "driving") {
            console.log(
              "[CameraControls] Camera animation completed, enabling rotation compensation"
            );
          }
        }
      }
    } else if (isDrivingRef.current) {
      // 行驶时应用相机旋转补偿（但不在动画进行中）
      applyCameraRotationCompensation(
        camera,
        isDrivingRef.current,
        cameraHeightRef.current,
        cameraDistanceRef.current,
        maxCameraLateralOffsetRef.current
      );
    }
  });

  return (
    <OrbitControls
      ref={controlsRef}
      enableDamping
      dampingFactor={0.05}
      maxPolarAngle={Math.PI / 2}
      minDistance={2}
      maxDistance={20}
      autoRotate={false}
    />
  );
};

/**
 * 应用相机旋转补偿
 * 行驶时：相机始终跟在车的后面，看向车的前方
 * 根据转向角动态调整相机的左右位置，向转弯内角方向移动
 */
function applyCameraRotationCompensation(
  camera: THREE.Camera,
  isDriving: boolean,
  cameraHeight: number,
  cameraDistance: number,
  maxCameraLateralOffset: number
): void {
  if (!isDriving) return;

  const { vehicleDynamics } = use3DStore.getState();
  const { steeringAngle } = vehicleDynamics;

  // 根据转向角计算相机的横向偏移
  // 转向角为正时（向右转），相机向右移动（转弯内角）
  // 转向角为负时（向左转），相机向左移动（转弯内角）
  // 使用 sin 函数使偏移平滑变化，并减小偏移量（乘以 0.8）
  const lateralOffset = Math.sin(steeringAngle) * maxCameraLateralOffset * 0.8;

  // 调试日志
  // if (Math.abs(steeringAngle) > 0.01) {
  //   console.log(
  //     `[CameraControls] steeringAngle=${(
  //       (steeringAngle * 180) /
  //       Math.PI
  //     ).toFixed(2)}°, lateralOffset=${lateralOffset.toFixed(2)}, bodyYaw=${(
  //       (bodyYaw * 180) /
  //       Math.PI
  //     ).toFixed(2)}°`
  //   );
  // }

  // 相机位置：始终在车后方，只有横向偏移
  // 不跟随车身旋转，始终保持在世界坐标系的后方（+Z 方向）
  camera.position.set(
    lateralOffset, // X: 根据转向角动态调整横向位置
    cameraHeight, // Y: 固定高度
    cameraDistance // Z: 固定距离（始终在后方）
  );

  // 相机看向车身位置（原点）
  camera.lookAt(0, 0, 0);
}

/**
 * 关键帧插值
 */
function interpolateKeyframes(
  progress: number,
  animState: CameraAnimationState,
  camera: THREE.PerspectiveCamera,
  controls: any
): void {
  const keyframes = animState.keyframes;
  if (keyframes.length < 2) return;

  // 找到当前进度对应的关键帧区间
  let currentIndex = 0;
  for (let i = 0; i < keyframes.length - 1; i++) {
    if (progress >= keyframes[i].time && progress <= keyframes[i + 1].time) {
      currentIndex = i;
      break;
    }
  }

  const current = keyframes[currentIndex];
  const next = keyframes[currentIndex + 1];

  if (!current || !next) return;

  // 计算区间内的插值进度
  const segmentProgress =
    (progress - current.time) / (next.time - current.time);

  // 位置插值
  const position = current.position
    .clone()
    .lerp(next.position, segmentProgress);
  camera.position.copy(position);

  // 目标插值
  const target = current.target.clone().lerp(next.target, segmentProgress);
  camera.lookAt(target);

  // 更新 OrbitControls 的目标
  if (controls) {
    controls.target.copy(target);
  }
}
