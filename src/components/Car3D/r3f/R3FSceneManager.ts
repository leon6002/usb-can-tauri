/**
 * R3F 场景管理器
 */

import * as THREE from "three";

export interface R3FSceneManagerHandle {
  animationSystem: any;
  camera: THREE.Camera | null;
  scene: THREE.Scene | null;
  car: THREE.Group | null;
  controls?: any; // OrbitControls 引用
}

export class R3FSceneManager {
  private handle: R3FSceneManagerHandle;
  private isDriving = false;
  private wheelRotationState = {
    isRotating: false,
    speed: 5,
    direction: 1,
  };
  private roadMovementState = {
    isMoving: false,
    speed: 2,
  };
  private suspensionState = {
    isAnimating: false,
    currentHeight: 0,
    maxHeight: 0.5,
    minHeight: -0.5,
  };
  private cameraAnimationState = {
    isAnimating: false,
    mode: "side",
    duration: 3000,
  };
  private doorButtonsVisible = true;

  constructor(handle: R3FSceneManagerHandle) {
    this.handle = handle;
  }

  /**
   * 设置行驶状态
   */
  public setIsDriving(isDriving: boolean): void {
    this.isDriving = isDriving;

    // 禁用/启用 OrbitControls
    console.log(
      `[R3FSceneManager] setIsDriving: ${isDriving}, controls exists: ${!!this
        .handle.controls}`
    );
    if (this.handle.controls) {
      if (isDriving) {
        // 开始行驶：禁用 OrbitControls
        this.handle.controls.enabled = false;
        console.log(
          `[R3FSceneManager] ✓ OrbitControls disabled for driving, enabled=${this.handle.controls.enabled}`
        );
      } else {
        // 停止行驶：启用 OrbitControls
        this.handle.controls.enabled = true;
        console.log(
          `[R3FSceneManager] ✓ OrbitControls enabled after driving, enabled=${this.handle.controls.enabled}`
        );
      }
    } else {
      console.warn(`[R3FSceneManager] ⚠️ Controls not available!`);
    }
  }

  /**
   * 开始轮子旋转
   */
  public startWheelRotation(speed: number = 5, direction: number = 1): void {
    this.wheelRotationState.isRotating = true;
    this.wheelRotationState.speed = speed;
    this.wheelRotationState.direction = direction;

    if (this.handle.animationSystem?.startWheelRotation) {
      this.handle.animationSystem.startWheelRotation(speed, direction);
    }
    console.log(
      `[R3FSceneManager] startWheelRotation: speed=${speed}, direction=${direction}`
    );
  }

  /**
   * 停止轮子旋转
   */
  public stopWheelRotation(): void {
    this.wheelRotationState.isRotating = false;

    if (this.handle.animationSystem?.stopWheelRotation) {
      this.handle.animationSystem.stopWheelRotation();
    }
    console.log("[R3FSceneManager] stopWheelRotation");
  }

  /**
   * 更新轮子旋转速度
   */
  public updateWheelRotationSpeed(speed: number): void {
    this.wheelRotationState.speed = Math.abs(speed);

    if (this.handle.animationSystem?.updateWheelRotationSpeed) {
      this.handle.animationSystem.updateWheelRotationSpeed(speed);
    }
    console.log(`[R3FSceneManager] updateWheelRotationSpeed: ${speed}`);
  }

  /**
   * 开始道路移动
   */
  public startRoadMovement(speed: number = 2): void {
    this.roadMovementState.isMoving = true;
    this.roadMovementState.speed = speed;

    if (this.handle.animationSystem?.startRoadMovement) {
      this.handle.animationSystem.startRoadMovement(speed);
    }
    console.log(`[R3FSceneManager] startRoadMovement: speed=${speed}`);
  }

  /**
   * 停止道路移动
   */
  public stopRoadMovement(): void {
    this.roadMovementState.isMoving = false;

    if (this.handle.animationSystem?.stopRoadMovement) {
      this.handle.animationSystem.stopRoadMovement();
    }
    console.log("[R3FSceneManager] stopRoadMovement");
  }

  /**
   * 更新道路移动速度
   */
  public updateRoadMovementSpeed(speed: number): void {
    this.roadMovementState.speed = Math.abs(speed);

    if (this.handle.animationSystem?.updateRoadMovementSpeed) {
      this.handle.animationSystem.updateRoadMovementSpeed(speed);
    }
    console.log(`[R3FSceneManager] updateRoadMovementSpeed: ${speed}`);
  }

  /**
   * 开始相机动画
   */
  public startCameraAnimation(
    mode: string,
    duration: number = 10000,
    keepFinalPosition: boolean = false
  ): void {
    console.log(
      `[R3FSceneManager] startCameraAnimation called: mode=${mode}, duration=${duration}, keepFinalPosition=${keepFinalPosition}`
    );

    if (!this.handle.camera) {
      console.warn("[R3FSceneManager] Camera not available");
      return;
    }

    this.cameraAnimationState.mode = mode;
    this.cameraAnimationState.duration = duration;
    this.cameraAnimationState.isAnimating = true;

    // 获取 CameraControls 的动画状态（通过 Scene 组件传递）
    const cameraAnimState = (this.handle as any).cameraAnimationState;
    console.log(
      `[R3FSceneManager] cameraAnimState exists: ${!!cameraAnimState}`
    );

    if (cameraAnimState) {
      cameraAnimState.isActive = true;
      cameraAnimState.mode = mode;
      cameraAnimState.startTime = Date.now();
      cameraAnimState.duration = duration;
      cameraAnimState.originalPosition = this.handle.camera.position.clone();
      cameraAnimState.originalTarget = new THREE.Vector3(0, 0, 0);
      cameraAnimState.keepFinalPosition = keepFinalPosition;

      // 根据模式设置关键帧
      this.setupCameraKeyframes(mode, cameraAnimState);
      console.log(
        `[R3FSceneManager] Camera animation setup complete, keyframes count: ${cameraAnimState.keyframes?.length}`
      );
    } else {
      console.warn(
        "[R3FSceneManager] cameraAnimationState not available in handle"
      );
    }
  }

  /**
   * 停止相机动画
   */
  public stopCameraAnimation(): void {
    this.cameraAnimationState.isAnimating = false;

    const cameraAnimState = (this.handle as any).cameraAnimationState;
    if (cameraAnimState) {
      cameraAnimState.isActive = false;
    }

    console.log("[R3FSceneManager] stopCameraAnimation");
  }

  /**
   * 设置相机动画关键帧
   */
  private setupCameraKeyframes(mode: string, cameraAnimState: any): void {
    cameraAnimState.keyframes = [];
    cameraAnimState.currentKeyframe = 0;

    switch (mode) {
      case "orbit":
        this.setupOrbitKeyframes(cameraAnimState);
        break;
      case "showcase":
        this.setupShowcaseKeyframes(cameraAnimState);
        break;
      case "cinematic":
        this.setupCinematicKeyframes(cameraAnimState);
        break;
      case "driving":
        this.setupDrivingKeyframes(cameraAnimState);
        break;
      case "side":
        this.setupSideKeyframes(cameraAnimState);
        break;
      default:
        console.warn(
          `[R3FSceneManager] Unknown camera animation mode: ${mode}`
        );
    }
  }

  /**
   * 环绕运镜关键帧
   */
  private setupOrbitKeyframes(cameraAnimState: any): void {
    const radius = 8;
    const height = 3;
    const steps = 20;

    for (let i = 0; i <= steps; i++) {
      const angle = (i / steps) * Math.PI * 2;
      const x = Math.cos(angle) * radius;
      const z = Math.sin(angle) * radius;

      cameraAnimState.keyframes.push({
        position: new THREE.Vector3(x, height, z),
        target: new THREE.Vector3(0, 0, 0),
        time: i / steps,
      });
    }
  }

  /**
   * 展示运镜关键帧
   */
  private setupShowcaseKeyframes(cameraAnimState: any): void {
    const positions = [
      { pos: [5, 3, 5], target: [0, 0, 0] },
      { pos: [-5, 3, 5], target: [0, 0, 0] },
      { pos: [-5, 3, -5], target: [0, 0, 0] },
      { pos: [5, 3, -5], target: [0, 0, 0] },
      { pos: [0, 8, 0], target: [0, 0, 0] },
      { pos: [5, 3, 5], target: [0, 0, 0] },
    ];

    positions.forEach((keyframe, index) => {
      cameraAnimState.keyframes.push({
        position: new THREE.Vector3(...keyframe.pos),
        target: new THREE.Vector3(...keyframe.target),
        time: index / (positions.length - 1),
      });
    });
  }

  /**
   * 电影运镜关键帧
   */
  private setupCinematicKeyframes(cameraAnimState: any): void {
    const keyframes = [
      { pos: [10, 2, 10], target: [0, 0, 0] },
      { pos: [0, 1, 8], target: [0, 0, 0] },
      { pos: [-8, 4, 0], target: [0, 0, 0] },
      { pos: [0, 6, -8], target: [0, 0, 0] },
      { pos: [8, 2, 0], target: [0, 0, 0] },
      { pos: [5, 3, 5], target: [0, 0, 0] },
    ];

    keyframes.forEach((keyframe, index) => {
      cameraAnimState.keyframes.push({
        position: new THREE.Vector3(...keyframe.pos),
        target: new THREE.Vector3(...keyframe.target),
        time: index / (keyframes.length - 1),
      });
    });
  }

  /**
   * 行驶运镜关键帧
   */
  private setupDrivingKeyframes(cameraAnimState: any): void {
    const keyframes = [
      { pos: this.handle.camera!.position.toArray(), target: [0, 0, 0] },
      { pos: [0, 2, 10], target: [0, 0, 0] },
    ];

    keyframes.forEach((keyframe, index) => {
      cameraAnimState.keyframes.push({
        position: new THREE.Vector3(...keyframe.pos),
        target: new THREE.Vector3(...keyframe.target),
        time: index / (keyframes.length - 1),
      });
    });
  }

  /**
   * 侧面运镜关键帧
   */
  private setupSideKeyframes(cameraAnimState: any): void {
    const keyframes = [
      { pos: this.handle.camera!.position.toArray(), target: [0, 0, 0] },
      { pos: [10, 3, 0], target: [0, 0, 0] }, // 测试：改到车的正右侧
    ];

    keyframes.forEach((keyframe, index) => {
      cameraAnimState.keyframes.push({
        position: new THREE.Vector3(...keyframe.pos),
        target: new THREE.Vector3(...keyframe.target),
        time: index / (keyframes.length - 1),
      });
    });
  }

  /**
   * 设置门按钮可见性
   */
  public setDoorButtonsVisible(visible: boolean): void {
    console.log(`[R3FSceneManager] setDoorButtonsVisible: ${visible}`);
  }

  /**
   * 切换门状态
   */
  public toggleDoor(door: "left" | "right"): void {
    // 根据门的位置播放对应的动画
    const animationName = door === "left" ? "DoorFLOpen" : "DoorFROpen";
    const isOpening = !(this as any).doorState?.[door] || false;

    if (this.handle.animationSystem?.playDoorAnimation) {
      this.handle.animationSystem.playDoorAnimation(animationName, !isOpening);
    }

    // 保存门的状态
    if (!(this as any).doorState) {
      (this as any).doorState = {};
    }
    (this as any).doorState[door] = isOpening;

    console.log(
      `[R3FSceneManager] toggleDoor: ${door}, isOpening=${isOpening}`
    );
  }

  /**
   * 开始车灯动画
   */
  public startLightAnimation(
    type: "headlights" | "taillights" | "turnSignals",
    interval: number = 500
  ): void {
    // 停止之前的灯光动画
    this.stopLightAnimation();

    let isOn = true;
    const lightAnimationInterval = setInterval(() => {
      if (this.handle.animationSystem?.setLightState) {
        this.handle.animationSystem.setLightState(type, isOn);
      }
      isOn = !isOn;
    }, interval);

    // 保存灯光动画的 interval ID
    (this as any).lightAnimationInterval = lightAnimationInterval;
    console.log(
      `[R3FSceneManager] startLightAnimation: type=${type}, interval=${interval}`
    );
  }

  /**
   * 停止车灯动画
   */
  public stopLightAnimation(): void {
    const lightAnimationInterval = (this as any).lightAnimationInterval;
    if (lightAnimationInterval) {
      clearInterval(lightAnimationInterval);
      (this as any).lightAnimationInterval = null;

      // 重置所有灯光状态
      ["headlights", "taillights", "turnSignals"].forEach((type) => {
        if (this.handle.animationSystem?.setLightState) {
          this.handle.animationSystem.setLightState(type, false);
        }
      });

      console.log("[R3FSceneManager] stopLightAnimation");
    }
  }

  /**
   * 开始悬挂动画（向下）
   */
  public startSuspensionDown(): void {
    if (this.suspensionState.isAnimating) {
      console.log("[R3FSceneManager] Suspension animation already in progress");
      return;
    }

    if (this.suspensionState.currentHeight <= this.suspensionState.minHeight) {
      console.log(
        `[R3FSceneManager] Suspension already at minimum height: ${this.suspensionState.currentHeight}`
      );
      return;
    }

    this.suspensionState.isAnimating = true;
    console.log("[R3FSceneManager] startSuspensionDown");

    // 模拟悬挂动画
    const animationDuration = 500; // ms
    const startHeight = this.suspensionState.currentHeight;
    const targetHeight = Math.max(
      startHeight - 0.1,
      this.suspensionState.minHeight
    );
    const startTime = Date.now();

    const animate = () => {
      const elapsed = Date.now() - startTime;
      const progress = Math.min(elapsed / animationDuration, 1);

      this.suspensionState.currentHeight =
        startHeight + (targetHeight - startHeight) * progress;

      if (progress < 1) {
        requestAnimationFrame(animate);
      } else {
        this.suspensionState.isAnimating = false;
      }
    };

    requestAnimationFrame(animate);
  }

  /**
   * 开始悬挂动画（向上）
   */
  public startSuspensionUp(): void {
    if (this.suspensionState.isAnimating) {
      console.log("[R3FSceneManager] Suspension animation already in progress");
      return;
    }

    const projectedHeight = this.suspensionState.currentHeight + 0.1;
    if (projectedHeight > this.suspensionState.maxHeight) {
      console.log(
        `[R3FSceneManager] Suspension already at maximum height: ${this.suspensionState.currentHeight}`
      );
      return;
    }

    this.suspensionState.isAnimating = true;
    console.log("[R3FSceneManager] startSuspensionUp");

    // 模拟悬挂动画
    const animationDuration = 500; // ms
    const startHeight = this.suspensionState.currentHeight;
    const targetHeight = Math.min(
      startHeight + 0.1,
      this.suspensionState.maxHeight
    );
    const startTime = Date.now();

    const animate = () => {
      const elapsed = Date.now() - startTime;
      const progress = Math.min(elapsed / animationDuration, 1);

      this.suspensionState.currentHeight =
        startHeight + (targetHeight - startHeight) * progress;

      if (progress < 1) {
        requestAnimationFrame(animate);
      } else {
        this.suspensionState.isAnimating = false;
      }
    };

    requestAnimationFrame(animate);
  }

  /**
   * 停止悬挂动画
   */
  public stopSuspensionAnimation(): void {
    this.suspensionState.isAnimating = false;
    console.log("[R3FSceneManager] stopSuspensionAnimation");
  }

  /**
   * 获取当前悬架高度
   */
  public getSuspensionHeight(): number {
    return this.suspensionState.currentHeight;
  }

  /**
   * 获取悬架高度限制信息
   */
  public getSuspensionHeightLimit(): {
    currentHeight: number;
    maxHeight: number;
    minHeight: number;
  } {
    return {
      currentHeight: this.suspensionState.currentHeight,
      maxHeight: this.suspensionState.maxHeight,
      minHeight: this.suspensionState.minHeight,
    };
  }

  /**
   * 重置悬架高度
   */
  public resetSuspensionHeight(): void {
    this.suspensionState.currentHeight = 0;
    console.log("[R3FSceneManager] resetSuspensionHeight");
  }

  /**
   * 获取当前状态
   */
  public getState() {
    return {
      isDriving: this.isDriving,
      wheelRotation: this.wheelRotationState,
      roadMovement: this.roadMovementState,
      suspension: this.suspensionState,
      cameraAnimation: this.cameraAnimationState,
      doorButtonsVisible: this.doorButtonsVisible,
    };
  }
}
