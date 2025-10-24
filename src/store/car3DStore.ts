// use3DStore.ts
import { create } from "zustand";

interface ThreeDState {
  rendererInstance: any | null;
  scene3DStatus: "loading" | "ready" | "error";

  // Actions defined in the interface
  setRendererInstance: (renderer: any) => void;
  setSceneStatus: (status: ThreeDState["scene3DStatus"]) => void;

  // ⚠️ Missing properties that caused the error:
  updateDriveAnimation: (speed: number, steeringAngle: number) => void;
  startDriveAnimation: () => void;
  stopDriveAnimation: () => void; // Must be implemented!
  updateSteering: (angle: number, speed: number) => void; // Must be implemented!
  suspensionAnimation: (action: "up" | "down" | "stop") => void;
}

export const use3DStore = create<ThreeDState>((set, get) => ({
  rendererInstance: null,
  scene3DStatus: "loading",

  setRendererInstance: (renderer) => {
    set({ rendererInstance: renderer, scene3DStatus: "ready" });
  },

  setSceneStatus: (status) => set({ scene3DStatus: status }),

  updateDriveAnimation: (speed, steeringAngle) => {
    const { rendererInstance } = get();
    if (rendererInstance) {
      //我自己的
      rendererInstance.updateSteeringAngle(steeringAngle, speed);

      // 根据速度动态更新轮子转速和道路移动速度
      // speed 单位是 mm/s，需要转换为合适的动画速度
      // 假设轮子半径约为 0.3m (300mm)，周长约为 1.88m (1880mm)
      // 轮子转速 (rad/s) = 速度 (mm/s) / 轮子半径 (mm)
      const wheelRadius = 300; // mm
      const wheelRotationSpeed = Math.abs(speed) / wheelRadius;
      // 道路移动速度与轮子转速成正比 调整系数以获得合适的视觉效果
      const roadMovementSpeed = wheelRotationSpeed * 0.05;
      // 更新轮子旋转速度
      rendererInstance.updateWheelRotationSpeed(wheelRotationSpeed);
      // 更新道路移动速度
      rendererInstance.updateRoadMovementSpeed(roadMovementSpeed);
    }
  },
  //开始行驶动画
  startDriveAnimation: () => {
    const { rendererInstance } = get();
    if (rendererInstance) {
      console.log("3D: Starting driving animation.");
      rendererInstance.setIsDriving(true);
      rendererInstance.stopRoadMovement(); // Stop any existing movement before starting
      rendererInstance.startWheelRotation(10, 1);
      rendererInstance.startRoadMovement(0.8);
      rendererInstance.startCameraAnimation("driving", 2000, true);
      rendererInstance.setDoorButtonsVisible(false);
      console.log("🚗 开始行驶动画");
    }
  },

  // ✅ Implementation added for the missing properties:
  stopDriveAnimation: () => {
    const { rendererInstance } = get();
    if (rendererInstance) {
      console.log("3D: Stopping driving animation.");
      rendererInstance.setIsDriving(false);
      rendererInstance.stopWheelRotation();
      rendererInstance.stopRoadMovement();
      rendererInstance.startCameraAnimation("side", 2000, true);
      rendererInstance.setDoorButtonsVisible(true);
    }
  },

  updateSteering: (angle, speed) => {
    const { rendererInstance } = get();
    if (rendererInstance) {
      // Assume rendererInstance has a method to update steering angle
      rendererInstance.updateSteeringAngle(angle, speed);

      // Update wheel rotation and road movement speed based on current speed
      const wheelRadius = 300; // mm
      const wheelRotationSpeed = Math.abs(speed) / wheelRadius;
      const roadMovementSpeed = wheelRotationSpeed * 0.05;

      rendererInstance.updateWheelRotationSpeed(wheelRotationSpeed);
      rendererInstance.updateRoadMovementSpeed(roadMovementSpeed);
    }
  },
  suspensionAnimation: (direction) => {
    const { rendererInstance } = get();
    if (rendererInstance) {
      if (direction === "down") {
        rendererInstance.startSuspensionDown();
        return;
      } else if (direction === "up") {
        rendererInstance.startSuspensionUp();
      } else {
        rendererInstance.stopSuspensionAnimation;
        return;
      }
    }
  },
}));
