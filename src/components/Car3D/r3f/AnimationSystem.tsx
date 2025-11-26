/**
 * R3F 动画系统组件 - 使用 useFrame 替代原有的 AnimationController
 */
import React, { useEffect, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { use3DStore } from "../../../store/car3DStore"; // 用于直接设置 store 状态
import { CarComponentsR3F } from "./CarComponentsR3F";

export interface AnimationSystemProps {
  car: THREE.Group | null;
}

export interface AnimationSystemHandle {
  startWheelRotation: (speed: number, direction: number) => void;
  stopWheelRotation: () => void;
  updateWheelRotationSpeed: (speed: number) => void;
  startRoadMovement: (speed: number) => void;
  stopRoadMovement: () => void;
  updateRoadMovementSpeed: (speed: number) => void;
  toggleDoor: (door: "left" | "right") => void;
  setLightState: (lightType: string, state: boolean) => void;
  playDoorAnimation: (animationName: string, reverse: boolean) => void;
  updateSteeringAngle: (angle: number, speed?: number) => void;
  resetRoadTexture: () => void;
  setIsDriving: (isDriving: boolean) => void;
  startCameraAnimation: (
    mode: string,
    duration: number,
    keepFinalPosition: boolean
  ) => void;
  startSuspensionUp: () => void;
  startSuspensionDown: () => void;
  stopSuspensionAnimation: () => void;
}

export const AnimationSystem: React.FC<AnimationSystemProps> = ({ car }) => {
  const carComponentsRef = useRef<CarComponentsR3F | null>(null);
  const stateRef = useRef({
    wheelRotation: {
      isRotating: false,
      speed: 0,
      direction: 1,
    },
    roadMovement: {
      isMoving: false,
      speed: 0,
      offset: 0,
    },
    wheels: {
      frontLeft: null as THREE.Object3D | null,
      frontRight: null as THREE.Object3D | null,
      rearLeft: null as THREE.Object3D | null,
      rearRight: null as THREE.Object3D | null,
    },
    steering: {
      angle: 0, // 当前转向角（弧度）
      steeringAxes: {
        frontLeft: null as THREE.Object3D | null,
        frontRight: null as THREE.Object3D | null,
      },
    },
    doorAnimations: {} as { [key: string]: any },
    lights: {
      headlights: [] as THREE.Object3D[],
      taillights: [] as THREE.Object3D[],
      turnSignals: [] as THREE.Object3D[],
    },
    // 渐进停止状态
    gradualStop: {
      isActive: false,
      initialSpeed: 0,
      targetSpeed: 0,
      duration: 3000, // 3秒渐进停止
      startTime: 0,
    },
    // 灯光动画状态
    lightAnimation: null as NodeJS.Timeout | null,
    // 悬挂动画状态
    suspension: {
      isAnimating: false,
      direction: 0, // -1: 升高（车身向上），1: 降低（车身向下）
      startTime: 0,
      duration: 3500, // 3500ms
      maxHeight: 0.03, // 每次升降 3cm
      currentHeight: 0, // 当前累积高度
      minHeight: 0, // 最小高度
      maxHeightLimit: 0.09, // 最大高度限制 30cm
      startPositions: new Map<THREE.Object3D, THREE.Vector3>(),
      suspensions: {
        frontLeft: null as THREE.Object3D | null,
        frontRight: null as THREE.Object3D | null,
        rearLeft: null as THREE.Object3D | null,
        rearRight: null as THREE.Object3D | null,
      },
    },
  });

  // 初始化车辆组件
  useEffect(() => {
    if (!car) return;

    // 初始化 CarComponentsR3F
    if (!carComponentsRef.current) {
      carComponentsRef.current = new CarComponentsR3F();
      carComponentsRef.current.initializeComponents(car);
    }

    // 从 CarComponentsR3F 获取轮子、灯光、转向轴和悬挂
    stateRef.current.wheels = carComponentsRef.current.wheels;
    stateRef.current.lights = carComponentsRef.current.lights;
    stateRef.current.steering.steeringAxes =
      carComponentsRef.current.steeringAxes;

    // 保存悬挂对象的引用（用于悬挂动画）
    stateRef.current.suspension.suspensions =
      carComponentsRef.current.suspensions;

    // 初始化动画混合器
    const mixer = (car as any).mixer;
    const animations = (car as any).animations;

    if (mixer && animations) {
      animations.forEach((clip: THREE.AnimationClip) => {
        const action = mixer.clipAction(clip);
        action.setLoop(THREE.LoopOnce, 1);
        action.clampWhenFinished = true;
        stateRef.current.doorAnimations[clip.name] = action;
        console.log(`[AnimationSystem] Registered animation: ${clip.name}`);
      });
      console.log(
        `[AnimationSystem] Animations initialized:`,
        Object.keys(stateRef.current.doorAnimations)
      );
    }

    // 轮子和灯光已从 CarComponentsR3F 获取
    console.log(
      "[AnimationSystem] Wheels and lights initialized from CarComponentsR3F"
    );

    // 创建动画系统句柄
    const handle: AnimationSystemHandle = {
      startWheelRotation: (speed: number, direction: number) => {
        // 重置渐进停止状态
        stateRef.current.gradualStop.isActive = false;
        stateRef.current.wheelRotation.isRotating = true;
        stateRef.current.wheelRotation.speed = speed;
        stateRef.current.wheelRotation.direction = direction;
        console.log(
          `[AnimationSystem] startWheelRotation: speed=${speed}, direction=${direction}`
        );
      },
      stopWheelRotation: () => {
        // 启动渐进停止
        if (
          !stateRef.current.wheelRotation.isRotating ||
          stateRef.current.wheelRotation.speed <= 0
        ) {
          stateRef.current.wheelRotation.isRotating = false;
          stateRef.current.wheelRotation.speed = 0;
          return;
        }
        stateRef.current.gradualStop.isActive = true;
        stateRef.current.gradualStop.initialSpeed =
          stateRef.current.wheelRotation.speed;
        stateRef.current.gradualStop.targetSpeed = 0;
        stateRef.current.gradualStop.startTime = Date.now();
        console.log(
          `[AnimationSystem] stopWheelRotation: starting gradual stop`
        );
      },
      updateWheelRotationSpeed: (speed: number) => {
        stateRef.current.wheelRotation.speed = speed;
        // console.log(`[AnimationSystem] updateWheelRotationSpeed: ${speed}`);
      },
      startRoadMovement: (speed: number) => {
        // 重置渐进停止状态
        stateRef.current.gradualStop.isActive = false;
        stateRef.current.roadMovement.isMoving = true;
        stateRef.current.roadMovement.speed = speed;
        console.log(`[AnimationSystem] startRoadMovement: speed=${speed}`);
      },
      stopRoadMovement: () => {
        // 启动渐进停止
        if (
          !stateRef.current.roadMovement.isMoving ||
          stateRef.current.roadMovement.speed <= 0
        ) {
          stateRef.current.roadMovement.isMoving = false;
          stateRef.current.roadMovement.speed = 0;
          return;
        }
        stateRef.current.gradualStop.isActive = true;
        stateRef.current.gradualStop.initialSpeed = Math.max(
          stateRef.current.wheelRotation.speed,
          stateRef.current.roadMovement.speed
        );
        stateRef.current.gradualStop.targetSpeed = 0;
        stateRef.current.gradualStop.startTime = Date.now();
        console.log(
          `[AnimationSystem] stopRoadMovement: starting gradual stop`
        );
      },
      updateRoadMovementSpeed: (speed: number) => {
        stateRef.current.roadMovement.speed = speed;
        // console.log(`[AnimationSystem] updateRoadMovementSpeed: ${speed}`);
      },
      toggleDoor: (door: "left" | "right") => {
        console.log(`[AnimationSystem] toggleDoor: ${door}`);
      },
      setLightState: (lightType: string, state: boolean) => {
        const lights =
          stateRef.current.lights[
          lightType as keyof typeof stateRef.current.lights
          ];
        if (lights && Array.isArray(lights)) {
          lights.forEach((light) => {
            if (light.type === "Mesh") {
              const mesh = light as THREE.Mesh;
              if (mesh.material && "emissive" in mesh.material) {
                const material = mesh.material as THREE.MeshStandardMaterial;
                material.emissive.setHex(state ? 0xffff00 : 0x000000);
              }
            }
          });
        }
        console.log(`[AnimationSystem] setLightState: ${lightType} = ${state}`);
      },
      playDoorAnimation: (animationName: string, reverse: boolean) => {
        const action = stateRef.current.doorAnimations[animationName];
        if (!action) {
          console.warn(
            `[AnimationSystem] Door animation ${animationName} not found. Available:`,
            Object.keys(stateRef.current.doorAnimations)
          );
          return;
        }

        // 停止当前动画
        action.stop();
        action.reset();

        if (reverse) {
          // 反向播放（关门）
          action.timeScale = -1;
          action.time = action.getClip().duration;
        } else {
          // 正向播放（开门）
          action.timeScale = 1;
          action.time = 0;
        }

        action.play();
        console.log(
          `[AnimationSystem] Playing door animation: ${animationName}, reverse=${reverse}, duration=${action.getClip().duration
          }s`
        );
      },
      updateSteeringAngle: (angle: number, _speed?: number) => {
        // 使用转向轴来更新前轮转向（分离转向和滚动旋转）
        // 转向角度应用到转向轴的 Z 轴旋转
        const steeringAxes = stateRef.current.steering.steeringAxes;

        // angle 来自 CSV，单位是度数（degrees）
        // 需要转换为弧度：rad = deg * (π / 180)
        const angleInRadians = angle * (Math.PI / 180);

        // 179.1 是初始偏移角度（弧度），angleInRadians * 0.5 是转向比
        const steeringRotation = 179.1 + angleInRadians * 1.5;

        if (steeringAxes.frontLeft) {
          steeringAxes.frontLeft.rotation.z = steeringRotation;
        }
        if (steeringAxes.frontRight) {
          steeringAxes.frontRight.rotation.z = steeringRotation;
        }

        // 保存当前转向角（弧度）
        stateRef.current.steering.angle = angleInRadians;
      },
      resetRoadTexture: () => {
        // 重置道路纹理偏移
        // 注意：这个方法会在 useFrame 之外被调用，所以需要通过 store 访问
        // 实际的重置会在下一帧的 useFrame 中进行
        stateRef.current.roadMovement.offset = 0;
        console.log("[AnimationSystem] Road movement offset reset to 0");
      },
      setIsDriving: (isDriving: boolean) => {
        // 通过 sceneHandle 调用 CameraControls 的 setIsDriving 方法
        const { sceneHandle } = use3DStore.getState();
        console.log(
          `[AnimationSystem] setIsDriving called: ${isDriving}, sceneHandle=${!!sceneHandle}`
        );
        if (sceneHandle) {
          const setIsDrivingFn = (sceneHandle as any).setIsDriving;
          if (setIsDrivingFn) {
            console.log(
              `[AnimationSystem] Calling sceneHandle.setIsDriving(${isDriving})`
            );
            setIsDrivingFn(isDriving);
          } else {
            console.warn(
              `[AnimationSystem] sceneHandle.setIsDriving not found`
            );
          }
        } else {
          console.warn(`[AnimationSystem] sceneHandle not available`);
        }
      },
      startCameraAnimation: (
        mode: string,
        duration: number,
        keepFinalPosition: boolean
      ) => {
        // 通过 sceneHandle 调用 CameraControls 的相机动画
        const { sceneHandle } = use3DStore.getState();
        console.log(
          `[AnimationSystem] startCameraAnimation called: mode=${mode}, duration=${duration}, keepFinalPosition=${keepFinalPosition}`
        );
        console.log(
          `[AnimationSystem] sceneHandle exists: ${!!sceneHandle}, cameraAnimationState exists: ${!!(
            sceneHandle as any
          )?.cameraAnimationState}`
        );

        if (sceneHandle) {
          const cameraAnimState = (sceneHandle as any).cameraAnimationState;
          if (cameraAnimState) {
            cameraAnimState.isActive = true;
            cameraAnimState.mode = mode;
            cameraAnimState.startTime = Date.now();
            cameraAnimState.duration = duration;
            cameraAnimState.keepFinalPosition = keepFinalPosition;

            // 获取相机引用
            const camera = (sceneHandle as any).camera;
            if (camera) {
              cameraAnimState.originalPosition = camera.position.clone();
              cameraAnimState.originalTarget = new THREE.Vector3(0, 0, 0);

              // 设置关键帧 - 从当前位置过渡到目标位置
              cameraAnimState.keyframes = [];
              cameraAnimState.currentKeyframe = 0;

              const currentPos = camera.position.clone();

              if (mode === "side") {
                // 侧面视角关键帧：从当前位置过渡到车的正右侧
                cameraAnimState.keyframes.push({
                  position: currentPos,
                  target: new THREE.Vector3(0, 0, 0),
                  time: 0,
                });
                cameraAnimState.keyframes.push({
                  position: new THREE.Vector3(10, 3, 0),
                  target: new THREE.Vector3(0, 0, 0),
                  time: 1,
                });
              } else if (mode === "driving") {
                // 行驶视角关键帧：从当前位置过渡到车后方
                cameraAnimState.keyframes.push({
                  position: currentPos,
                  target: new THREE.Vector3(0, 0, 0),
                  time: 0,
                });
                cameraAnimState.keyframes.push({
                  position: new THREE.Vector3(0, 3, 5),
                  target: new THREE.Vector3(0, 0, 0),
                  time: 1,
                });
              }
            }

            console.log(
              `[AnimationSystem] Camera animation started, keyframes count: ${cameraAnimState.keyframes?.length}`
            );
          } else {
            console.warn(
              `[AnimationSystem] cameraAnimationState not available in sceneHandle`
            );
          }
        } else {
          console.warn(`[AnimationSystem] sceneHandle not available`);
        }
      },
      startSuspensionUp: () => {
        if (stateRef.current.suspension.isAnimating) {
          console.log(
            "[AnimationSystem] Suspension animation already in progress"
          );
          return;
        }

        // 检查是否已经达到最大高度
        if (
          stateRef.current.suspension.currentHeight >=
          stateRef.current.suspension.maxHeightLimit
        ) {
          console.log(
            `[AnimationSystem] Suspension already at maximum height: ${stateRef.current.suspension.currentHeight.toFixed(
              3
            )}m (limit: ${stateRef.current.suspension.maxHeightLimit}m)`
          );
          return;
        }

        console.log("[AnimationSystem] startSuspensionUp");
        stateRef.current.suspension.isAnimating = true;
        stateRef.current.suspension.direction = -1; // 升高（车身向上）
        stateRef.current.suspension.startTime = Date.now();
        stateRef.current.suspension.startPositions.clear();

        // 保存车身的初始位置
        if (car) {
          stateRef.current.suspension.startPositions.set(
            car,
            car.position.clone()
          );
        }

        // 保存所有悬挂的初始位置
        Object.values(stateRef.current.suspension.suspensions).forEach(
          (suspension) => {
            if (suspension) {
              stateRef.current.suspension.startPositions.set(
                suspension,
                suspension.position.clone()
              );
            }
          }
        );
      },
      startSuspensionDown: () => {
        if (stateRef.current.suspension.isAnimating) {
          console.log(
            "[AnimationSystem] Suspension animation already in progress"
          );
          return;
        }

        // 检查是否已经达到最小高度
        if (
          stateRef.current.suspension.currentHeight <=
          stateRef.current.suspension.minHeight
        ) {
          console.log(
            `[AnimationSystem] Suspension already at minimum height: ${stateRef.current.suspension.currentHeight.toFixed(
              3
            )}m (limit: ${stateRef.current.suspension.minHeight}m)`
          );
          return;
        }

        console.log("[AnimationSystem] startSuspensionDown");
        stateRef.current.suspension.isAnimating = true;
        stateRef.current.suspension.direction = 1; // 降低（车身向下）
        stateRef.current.suspension.startTime = Date.now();
        stateRef.current.suspension.startPositions.clear();

        // 保存车身的初始位置
        if (car) {
          stateRef.current.suspension.startPositions.set(
            car,
            car.position.clone()
          );
        }

        // 保存所有悬挂的初始位置
        Object.values(stateRef.current.suspension.suspensions).forEach(
          (suspension) => {
            if (suspension) {
              stateRef.current.suspension.startPositions.set(
                suspension,
                suspension.position.clone()
              );
            }
          }
        );
      },
      stopSuspensionAnimation: () => {
        console.log("[AnimationSystem] stopSuspensionAnimation");
        stateRef.current.suspension.isAnimating = false;
        stateRef.current.suspension.direction = 0;
        stateRef.current.suspension.startPositions.clear();
      },
    };

    // 直接设置到 store，而不是通过 callback
    // 直接设置到 store，而不是通过 callback
    use3DStore.setState((state) => ({
      sceneHandle: {
        ...state.sceneHandle,
        animationSystem: handle,
        camera: state.sceneHandle?.camera || null,
        scene: state.sceneHandle?.scene || null,
        controls: state.sceneHandle?.controls || undefined,
      },
    }));
    console.log("[AnimationSystem] Scene handle updated in store");
  }, [car]);

  // 动画循环
  useFrame((_state, delta) => {
    if (!car) return;

    const state_ref = stateRef.current;

    // 更新动画混合器
    const mixer = (car as any).mixer;
    if (mixer) {
      mixer.update(delta);
    }

    // 车身不旋转，只保持在原点
    // 转向效果通过道路弯曲来体现

    // 更新渐进停止
    if (state_ref.gradualStop.isActive) {
      const elapsed = Date.now() - state_ref.gradualStop.startTime;
      const progress = Math.min(elapsed / state_ref.gradualStop.duration, 1);

      // 使用缓动函数实现平滑减速
      const easeOut = 1 - Math.pow(1 - progress, 3);
      const currentSpeed = state_ref.gradualStop.initialSpeed * (1 - easeOut);

      // 更新轮子和道路速度
      if (state_ref.wheelRotation.isRotating) {
        state_ref.wheelRotation.speed = currentSpeed;
      }
      if (state_ref.roadMovement.isMoving) {
        state_ref.roadMovement.speed = currentSpeed * 0.05; // 道路移动速度相对较慢
      }

      // 检查是否完成渐进停止
      if (progress >= 1) {
        console.log("[AnimationSystem] Gradual stop completed");
        state_ref.wheelRotation.isRotating = false;
        state_ref.wheelRotation.speed = 0;
        state_ref.roadMovement.isMoving = false;
        state_ref.roadMovement.speed = 0;
        state_ref.gradualStop.isActive = false;
      }
    }

    // 更新轮子旋转
    if (state_ref.wheelRotation.isRotating) {
      const rotationAngle =
        state_ref.wheelRotation.speed *
        state_ref.wheelRotation.direction *
        delta;

      // 前轮旋转（反向）
      if (state_ref.wheels.frontLeft) {
        state_ref.wheels.frontLeft.rotation.x += rotationAngle;
      }
      if (state_ref.wheels.frontRight) {
        state_ref.wheels.frontRight.rotation.x += rotationAngle;
      }

      // 后轮旋转（正向）- 因为后轮模型的方向与前轮相反
      if (state_ref.wheels.rearLeft) {
        state_ref.wheels.rearLeft.rotation.x -= rotationAngle;
      }
      if (state_ref.wheels.rearRight) {
        state_ref.wheels.rearRight.rotation.x -= rotationAngle;
      }

      let rotatingWheelCount = 0;
      if (state_ref.wheels.frontLeft) rotatingWheelCount++;
      if (state_ref.wheels.frontRight) rotatingWheelCount++;
      if (state_ref.wheels.rearLeft) rotatingWheelCount++;
      if (state_ref.wheels.rearRight) rotatingWheelCount++;

      // 调试日志
      // if (rotatingWheelCount > 0) {
      //   console.log(
      //     `[AnimationSystem] Rotating ${rotatingWheelCount} wheels: speed=${
      //       state_ref.wheelRotation.speed
      //     }, direction=${
      //       state_ref.wheelRotation.direction
      //     }, delta=${delta.toFixed(4)}`
      //   );
      // }
    }

    // 更新道路移动
    if (state_ref.roadMovement.isMoving) {
      state_ref.roadMovement.offset += state_ref.roadMovement.speed * delta;

      // 更新道路纹理偏移
      const scene = _state.scene;
      const roadTexture = (scene as any).roadTexture;

      if (roadTexture) {
        roadTexture.offset.y += state_ref.roadMovement.speed * delta;
        if (roadTexture.offset.y >= 1) {
          roadTexture.offset.y = 0;
        }
      }

      // 更新草地贴图偏移
      const groundTexture = (scene as any).groundTexture;
      const groundNormalMap = (scene as any).groundNormalMap;
      const groundRoughnessMap = (scene as any).groundRoughnessMap;
      if (groundTexture) {
        groundTexture.offset.y += state_ref.roadMovement.speed * delta;
        if (groundTexture.offset.y >= 1) {
          groundTexture.offset.y = 0;
        }
      }
      if (groundNormalMap) {
        groundNormalMap.offset.y += state_ref.roadMovement.speed * delta;
        if (groundNormalMap.offset.y >= 1) {
          groundNormalMap.offset.y = 0;
        }
      }
      if (groundRoughnessMap) {
        groundRoughnessMap.offset.y += state_ref.roadMovement.speed * delta;
        if (groundRoughnessMap.offset.y >= 1) {
          groundRoughnessMap.offset.y = 0;
        }
      }
    } else if (state_ref.roadMovement.offset === 0) {
      // 当停止移动且偏移为0时，重置纹理偏移
      const scene = _state.scene;
      const roadTexture = (scene as any).roadTexture;

      if (roadTexture && roadTexture.offset.y !== 0) {
        roadTexture.offset.y = 0;
      }

      // 重置草地贴图偏移
      const groundTexture = (scene as any).groundTexture;
      const groundNormalMap = (scene as any).groundNormalMap;
      const groundRoughnessMap = (scene as any).groundRoughnessMap;
      if (groundTexture && groundTexture.offset.y !== 0) {
        groundTexture.offset.y = 0;
      }
      if (groundNormalMap && groundNormalMap.offset.y !== 0) {
        groundNormalMap.offset.y = 0;
      }
      if (groundRoughnessMap && groundRoughnessMap.offset.y !== 0) {
        groundRoughnessMap.offset.y = 0;
      }
    }

    // 更新悬挂动画
    if (state_ref.suspension.isAnimating && car) {
      const elapsed = Date.now() - state_ref.suspension.startTime;
      const progress = Math.min(elapsed / state_ref.suspension.duration, 1.0);

      // 使用缓动函数使动画更平滑
      const easeProgress = easeInOutQuad(progress);

      // 计算位移
      const displacement =
        state_ref.suspension.direction *
        state_ref.suspension.maxHeight *
        easeProgress;

      // 更新车身位置
      const carBodyStartPos = state_ref.suspension.startPositions.get(car);
      if (carBodyStartPos) {
        car.position.copy(carBodyStartPos);
        car.position.y -= displacement;
      }

      // 更新所有悬挂的位置
      state_ref.suspension.startPositions.forEach((startPos, obj) => {
        if (obj !== car) {
          // 这是悬挂对象
          obj.position.copy(startPos);
          obj.position.y -= displacement;
        }
      });

      // 动画完成
      if (progress >= 1.0) {
        const animationDirection = state_ref.suspension.direction;
        state_ref.suspension.isAnimating = false;
        state_ref.suspension.direction = 0;

        // 更新累积高度
        // 升高时（direction = -1），高度增加 maxHeight
        // 降低时（direction = 1），高度减少 maxHeight
        const heightChange =
          -animationDirection * state_ref.suspension.maxHeight;
        const newHeight = state_ref.suspension.currentHeight + heightChange;

        // 限制在最小和最大高度之间
        state_ref.suspension.currentHeight = Math.max(
          state_ref.suspension.minHeight,
          Math.min(newHeight, state_ref.suspension.maxHeightLimit)
        );

        console.log(
          `[AnimationSystem] Suspension animation completed, currentHeight: ${state_ref.suspension.currentHeight.toFixed(
            3
          )}m (heightChange: ${heightChange.toFixed(3)}m)`
        );
      }
    }
  });

  return null;
};

/**
 * 缓动函数：EaseInOutQuad
 */
function easeInOutQuad(t: number): number {
  return t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t;
}
