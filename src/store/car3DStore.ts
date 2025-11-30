import { create } from "zustand";
import { useCarControlStore } from "./carControlStore";
import { getCameraControlConfig } from "@/config/appConfig";

interface SceneHandle {
  animationSystem: any | null;
  camera: any | null;
  scene: any | null;
  controls?: any; // OrbitControls 引用
}

interface VehicleDynamics {
  steeringAngle: number; // 前轮转向角（弧度）
  currentSpeed: number; // 当前速度（mm/s）
  bodyYaw: number; // 车身偏转角（弧度）
  wheelbase: number; // 轴距（m）
}

interface ThreeDState {
  sceneHandle: SceneHandle | null;
  scene3DStatus: "loading" | "ready" | "error";
  vehicleDynamics: VehicleDynamics;
  isDriving: boolean; // 是否正在行驶

  // Actions
  setSceneHandle: (handle: SceneHandle) => void;
  setSceneStatus: (status: ThreeDState["scene3DStatus"]) => void;
  setIsDriving: (isDriving: boolean) => void;

  updateDriveAnimation: (speed: number, steeringAngle: number) => void;
  startDriveAnimation: () => void;
  stopDriveAnimation: () => void;
  updateSteering: (angle: number, speed: number) => void;
  suspensionAnimation: (action: "up" | "down" | "stop") => void;
}

export const use3DStore = create<ThreeDState>((set, get) => ({
  sceneHandle: null,
  scene3DStatus: "loading",
  isDriving: false,
  vehicleDynamics: {
    steeringAngle: 0,
    currentSpeed: 0,
    bodyYaw: 0,
    wheelbase: 2.7, // 轴距 2.7m
  },

  setSceneHandle: (handle) => {
    set({ sceneHandle: handle, scene3DStatus: "ready" });
    console.log("[car3DStore] Scene handle set:", handle);
  },

  setSceneStatus: (status) => set({ scene3DStatus: status }),

  setIsDriving: (isDriving) => {
    set({ isDriving });
    console.log(`[car3DStore] isDriving set to: ${isDriving}`);
  },

  updateDriveAnimation: (speed, steeringAngle) => {
    const { sceneHandle, vehicleDynamics } = get();
    if (sceneHandle?.animationSystem) {
      // console.log("[car3DStore] updateDriveAnimation:", {
      //   speed,
      //   steeringAngle_deg: steeringAngle,
      //   steeringAngle_rad: (steeringAngle * Math.PI) / 180,
      // });

      // 根据速度动态更新轮子转速和道路移动速度
      const wheelRadius = 300; // mm
      // 移除 Math.abs，允许负速度（倒车）
      const wheelRotationSpeed = speed / wheelRadius;
      const roadMovementSpeed = wheelRotationSpeed * 0.05;

      sceneHandle.animationSystem.updateWheelRotationSpeed?.(
        wheelRotationSpeed
      );
      sceneHandle.animationSystem.updateRoadMovementSpeed?.(roadMovementSpeed);

      // 更新转向角度
      sceneHandle.animationSystem.updateSteeringAngle?.(steeringAngle, speed);

      // 保存到 store 用于道路变形计算
      const steeringAngleRad = steeringAngle * (Math.PI / 180);
      set({
        vehicleDynamics: {
          ...vehicleDynamics,
          steeringAngle: steeringAngleRad,
          currentSpeed: speed,
        },
      });
    }
  },

  startDriveAnimation: () => {
    const { sceneHandle, isDriving } = get();
    console.log("[car3DStore] startDriveAnimation");

    // Prevent repeated triggers if already driving
    if (isDriving) {
      return;
    }

    if (sceneHandle?.animationSystem) {
      console.log("[car3DStore] Starting wheel rotation");
      sceneHandle.animationSystem.startWheelRotation?.(10, 1);
      sceneHandle.animationSystem.startRoadMovement?.(0.8);

      // FIX: 开始行驶时，强制停止所有正在进行的相机动画
      if ((sceneHandle as any).stopCameraAnimation) {
        (sceneHandle as any).stopCameraAnimation();
      }

      // 启动相机动画 - 从当前位置过渡到行驶视角（在 setIsDriving 之前）
      // 只有在不允许手动控制视角时，才强制切换到行驶视角
      const cameraConfig = getCameraControlConfig();
      // 注意：这里我们需要直接访问 store 实例，因为我们在 store 内部
      const isAutoDriving = useCarControlStore.getState().carStates.isDriving;

      // 如果是自动驾驶且不允许手动控制，或者手动驾驶且不允许手动控制，则切换视角
      // FIX: 手动模式下永远不自动切换视角
      const shouldSwitchCamera = isAutoDriving
        ? !cameraConfig.allowOrbitControlsInAutoDrive
        : false;

      if (shouldSwitchCamera && (sceneHandle as any).startCameraAnimation) {
        (sceneHandle as any).startCameraAnimation("driving", 1000, true);
      }
      // 禁用 OrbitControls，启用相机跟随（在相机动画之后）
      sceneHandle.animationSystem.setIsDriving?.(true);
      // 更新 store 中的 isDriving 状态
      set({ isDriving: true });
      console.log("🚗 开始行驶动画");
    } else {
      console.error("[car3DStore] Animation system not available");
    }
  },

  stopDriveAnimation: () => {
    const { sceneHandle, vehicleDynamics } = get();
    console.log("[car3DStore] stopDriveAnimation");
    if (sceneHandle?.animationSystem) {
      sceneHandle.animationSystem.stopWheelRotation?.();
      sceneHandle.animationSystem.stopRoadMovement?.();
      // 重置道路纹理
      sceneHandle.animationSystem.resetRoadTexture?.();
      // 重置车辆动力学状态
      set({
        vehicleDynamics: {
          ...vehicleDynamics,
          currentSpeed: 0,
          steeringAngle: 0,
        },
      });

      // 停止行驶时，根据驾驶模式决定相机行为
      // 如果是自动驾驶模式（isDriving 为 true），则切换到侧面视角展示车辆
      // 如果是手动驾驶模式（isDriving 为 false），则恢复到之前的视角
      const isAutoDriving = useCarControlStore.getState().carStates.isDriving;

      if (sceneHandle.animationSystem.startCameraAnimation) {
        if (isAutoDriving) {
          // 自动驾驶结束，展示侧面视角
          sceneHandle.animationSystem.startCameraAnimation("side", 2000, false);
        } else {
          // 手动驾驶结束（或未在自动驾驶中），恢复到开始驾驶前的位置
          // FIX: 手动模式下不自动恢复视角，保持当前视角
          // sceneHandle.animationSystem.startCameraAnimation("restore", 1500, false);
          console.log("[car3DStore] Manual drive stopped, keeping current camera position");
        }
      }

      // 然后重新启用 OrbitControls（在相机动画之后）
      sceneHandle.animationSystem.setIsDriving?.(false);
      // 更新 store 中的 isDriving 状态
      set({ isDriving: false });
    }
  },

  updateSteering: (_angle, speed) => {
    const { sceneHandle } = get();
    if (sceneHandle?.animationSystem) {
      const wheelRadius = 300; // mm
      const wheelRotationSpeed = Math.abs(speed) / wheelRadius;
      const roadMovementSpeed = wheelRotationSpeed * 0.05;

      sceneHandle.animationSystem.updateWheelRotationSpeed?.(
        wheelRotationSpeed
      );
      sceneHandle.animationSystem.updateRoadMovementSpeed?.(roadMovementSpeed);
    }
  },

  suspensionAnimation: (direction) => {
    const { sceneHandle } = get();
    if (sceneHandle?.animationSystem) {
      if (direction === "down") {
        sceneHandle.animationSystem.startSuspensionDown?.();
      } else if (direction === "up") {
        sceneHandle.animationSystem.startSuspensionUp?.();
      } else {
        sceneHandle.animationSystem.stopSuspensionAnimation?.();
      }
    }
  },
}));
