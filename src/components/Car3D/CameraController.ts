/**
 * 相机控制器 - 管理运镜系统：轨道、展示、电影等运镜模式
 */
import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import {
  ICameraController,
  CameraAnimationState,
  CameraAnimationMode,
} from "./types";

export class CameraController implements ICameraController {
  public controls: OrbitControls | null = null;
  public animationState: CameraAnimationState = {
    isActive: false,
    mode: "orbit",
    startTime: 0,
    duration: 3000, // 10秒
    originalPosition: null,
    originalTarget: null,
    keyframes: [],
    currentKeyframe: 0,
  };

  private camera: THREE.PerspectiveCamera;
  private carBodyYaw: number = 0; // 车身偏转角
  private steeringAngle: number = 0; // 前轮转向角（用于动态调整相机位置）
  private cameraDistance: number = 10; // 相机距离车身的距离
  private cameraHeight: number = 2; // 相机高度
  private isDriving: boolean = false; // 是否正在行驶
  private maxCameraLateralOffset: number = 6; // 相机最大横向偏移（米）

  // 停止行驶时的平滑过渡状态
  private stoppingTransition = {
    isTransitioning: false,
    startTime: 0,
    duration: 300, // 300ms 的过渡时间
    startPosition: new THREE.Vector3(),
    targetPosition: new THREE.Vector3(),
  };

  constructor(camera: THREE.PerspectiveCamera) {
    this.camera = camera;
  }

  /**
   * 设置轨道控制器
   */
  public setupControls(
    camera: THREE.PerspectiveCamera,
    domElement: HTMLElement
  ): void {
    this.controls = new OrbitControls(camera, domElement);
    this.controls.enableDamping = true;
    this.controls.dampingFactor = 0.05;
    this.controls.maxPolarAngle = Math.PI / 2;
    this.controls.minDistance = 2;
    this.controls.maxDistance = 20;

    console.log("✅ 相机控制器初始化完成");
  }

  /**
   * 开始运镜动画
   */
  public startAnimation(
    mode: CameraAnimationMode,
    duration: number = 3000,
    keepFinalPosition: boolean = false
  ): void {
    if (this.animationState.isActive) {
      this.stopAnimation();
    }

    this.animationState.isActive = true;
    this.animationState.mode = mode;
    this.animationState.startTime = Date.now();
    this.animationState.duration = duration;
    this.animationState.originalPosition = this.camera.position.clone();
    this.animationState.originalTarget = this.controls
      ? this.controls.target.clone()
      : new THREE.Vector3();

    // 添加是否保持最终位置的标记
    (this.animationState as any).keepFinalPosition = keepFinalPosition;

    // 根据模式设置关键帧
    this.setupKeyframes(mode);
  }

  /**
   * 停止运镜动画
   */
  public stopAnimation(): void {
    if (!this.animationState.isActive) return;

    const keepFinalPosition =
      (this.animationState as any).keepFinalPosition || false;
    this.animationState.isActive = false;

    // 只有在不保持最终位置时才恢复原始位置
    if (
      !keepFinalPosition &&
      this.animationState.originalPosition &&
      this.animationState.originalTarget
    ) {
      this.camera.position.copy(this.animationState.originalPosition);
      if (this.controls) {
        this.controls.target.copy(this.animationState.originalTarget);
        this.controls.enabled = true;
        // 不立即调用 update()，让下一帧的 update() 来处理
        // 这样可以避免相机突然跳动
      }
      console.log("停止运镜动画，恢复原始位置");
    } else {
      console.log("停止运镜动画，保持最终位置");
      // 如果在行驶模式下，立即应用相机补偿以实现无缝衔接
      if (this.isDriving) {
        this.applyCameraRotationCompensation();
      } else if (this.controls) {
        // 非行驶模式下恢复手动控制
        this.controls.enabled = true;
      }
    }
  }

  /**
   * 设置车身偏转角（用于相机位置更新）
   */
  public setCarBodyYaw(yaw: number): void {
    this.carBodyYaw = yaw;
  }

  /**
   * 设置前轮转向角（用于动态调整相机位置）
   */
  public setSteeringAngle(angle: number): void {
    this.steeringAngle = angle;
  }

  /**
   * 设置行驶状态
   */
  public setIsDriving(isDriving: boolean): void {
    this.isDriving = isDriving;
    if (this.controls) {
      if (isDriving) {
        // 开始行驶：禁用 OrbitControls
        this.controls.enabled = false;
        this.stoppingTransition.isTransitioning = false;
      } else {
        // 停止行驶：启动平滑过渡
        this.stoppingTransition.isTransitioning = true;
        this.stoppingTransition.startTime = Date.now();
        this.stoppingTransition.startPosition.copy(this.camera.position);
        // 目标位置设置为当前位置（保持不动）
        this.stoppingTransition.targetPosition.copy(this.camera.position);
        //暂时保持 OrbitControls 禁用，等过渡完成后再启用
        this.controls.enabled = false;
      }
    }
  }

  /**
   * 处理窗口大小变化
   */
  public onWindowResize(): void {
    // OrbitControls 会自动响应相机的 aspect 变化
    // 这里只需要确保控制器状态正确
    if (this.controls) {
      this.controls.update();
    }
  }

  /**
   * 更新运镜动画
   */
  public update(_delta: number): void {
    // 处理停止行驶的平滑过渡
    if (this.stoppingTransition.isTransitioning) {
      this.updateStoppingTransition();
    }

    if (this.animationState.isActive) {
      this.updateCameraAnimation();
    } else if (this.controls) {
      // 只在非动画状态下应用相机补偿和更新控制器
      // 在行驶模式下应用相机补偿（跟随车身）
      if (this.isDriving) {
        this.applyCameraRotationCompensation();
      } else {
        this.controls.update();
      }
    }
  }

  /**
   * 更新停止行驶的平滑过渡
   */
  private updateStoppingTransition(): void {
    const elapsed = Date.now() - this.stoppingTransition.startTime;
    const progress = Math.min(elapsed / this.stoppingTransition.duration, 1);

    // 使用缓动函数使过渡更平滑
    const easeProgress = this.easeOutCubic(progress);

    // 在起始位置和目标位置之间插值
    this.camera.position.lerpVectors(
      this.stoppingTransition.startPosition,
      this.stoppingTransition.targetPosition,
      easeProgress
    );

    // 过渡完成
    if (progress >= 1) {
      this.stoppingTransition.isTransitioning = false;
      // 过渡完成后启用 OrbitControls
      if (this.controls) {
        this.controls.enabled = true;
        // 更新 OrbitControls 的目标点以匹配当前相机位置
        this.controls.target.set(0, 0, 0);
        this.controls.update();
      }
    }
  }

  /**
   * 缓动函数：EaseOutCubic
   */
  private easeOutCubic(t: number): number {
    return 1 - Math.pow(1 - t, 3);
  }

  /**
   * 应用相机旋转补偿
   * 行驶时：相机始终跟在车的后面，看向车的前方
   * 根据转向角动态调整相机的左右位置，向转弯内角方向移动
   * 停止时：相机保持自由控制状态
   */
  private applyCameraRotationCompensation(): void {
    if (!this.controls) return;

    // 只在行驶时应用相机跟随
    if (!this.isDriving) {
      return;
    }

    // 根据转向角计算相机的横向偏移
    // 转向角为正时（向右转），相机向右移动（转弯内角）
    // 转向角为负时（向左转），相机向左移动（转弯内角）
    // 使用 sin 函数使偏移平滑变化
    const lateralOffset =
      Math.sin(this.steeringAngle) * this.maxCameraLateralOffset;

    // 相机相对于车身的位置（车的后方）
    // 在车身坐标系中：后方 = -Z 方向，右侧 = +X 方向
    const relativePos = new THREE.Vector3(
      lateralOffset, // 根据转向角动态调整横向位置
      this.cameraHeight,
      this.cameraDistance + 10 + lateralOffset
    );

    // 创建一个旋转矩阵，根据车身偏转角旋转相机位置
    const quaternion = new THREE.Quaternion();
    quaternion.setFromAxisAngle(new THREE.Vector3(0, 1, 0), this.carBodyYaw);

    // 应用旋转到相机相对位置
    relativePos.applyQuaternion(quaternion);

    // 设置相机位置（车身在原点）
    this.camera.position.copy(relativePos);

    // 相机看向原点（车身位置）
    this.camera.lookAt(0, 0, 0);
  }

  /**
   * 设置运镜关键帧
   */
  private setupKeyframes(mode: CameraAnimationMode): void {
    this.animationState.keyframes = [];
    this.animationState.currentKeyframe = 0;

    switch (mode) {
      case "orbit":
        this.setupOrbitKeyframes();
        break;
      case "showcase":
        this.setupShowcaseKeyframes();
        break;
      case "cinematic":
        this.setupCinematicKeyframes();
        break;
      case "follow":
        this.setupFollowKeyframes();
        break;
      case "driving":
        // 在行驶模式下，暂时禁用相机补偿以获取正确的起点位置
        this.setupDrivingKeyframes();
        break;
      case "side":
        this.setupSideKeyframes();
        break;
    }
  }

  /**
   * 设置环绕运镜关键帧
   */
  private setupOrbitKeyframes(): void {
    const radius = 8;
    const height = 3;
    const steps = 20;

    for (let i = 0; i <= steps; i++) {
      const angle = (i / steps) * Math.PI * 2;
      const x = Math.cos(angle) * radius;
      const z = Math.sin(angle) * radius;

      this.animationState.keyframes.push({
        position: new THREE.Vector3(x, height, z),
        target: new THREE.Vector3(0, 0, 0),
        time: i / steps,
      });
    }
  }

  /**
   * 设置展示运镜关键帧
   */
  private setupShowcaseKeyframes(): void {
    const positions = [
      { pos: [5, 3, 5], target: [0, 0, 0] },
      { pos: [-5, 3, 5], target: [0, 0, 0] },
      { pos: [-5, 3, -5], target: [0, 0, 0] },
      { pos: [5, 3, -5], target: [0, 0, 0] },
      { pos: [0, 8, 0], target: [0, 0, 0] },
      { pos: [5, 3, 5], target: [0, 0, 0] },
    ];

    positions.forEach((keyframe, index) => {
      this.animationState.keyframes.push({
        position: new THREE.Vector3(...keyframe.pos),
        target: new THREE.Vector3(...keyframe.target),
        time: index / (positions.length - 1),
      });
    });
  }

  /**
   * 设置电影运镜关键帧
   */
  private setupCinematicKeyframes(): void {
    const keyframes = [
      { pos: [10, 2, 10], target: [0, 0, 0] },
      { pos: [0, 1, 8], target: [0, 0, 0] },
      { pos: [-8, 4, 0], target: [0, 0, 0] },
      { pos: [0, 6, -8], target: [0, 0, 0] },
      { pos: [8, 2, 0], target: [0, 0, 0] },
      { pos: [5, 3, 5], target: [0, 0, 0] },
    ];

    keyframes.forEach((keyframe, index) => {
      this.animationState.keyframes.push({
        position: new THREE.Vector3(...keyframe.pos),
        target: new THREE.Vector3(...keyframe.target),
        time: index / (keyframes.length - 1),
      });
    });
  }

  /**
   * 设置跟随运镜关键帧
   */
  private setupFollowKeyframes(): void {
    // 跟随模式的关键帧会根据车辆位置动态计算
    const offsets = [
      { pos: [3, 2, 3], target: [0, 0, 0] },
      { pos: [-3, 2, 3], target: [0, 0, 0] },
      { pos: [0, 4, 5], target: [0, 0, 0] },
      { pos: [0, 1, -5], target: [0, 0, 0] },
    ];

    offsets.forEach((offset, index) => {
      this.animationState.keyframes.push({
        position: new THREE.Vector3(...offset.pos),
        target: new THREE.Vector3(...offset.target),
        time: index / (offsets.length - 1),
      });
    });
  }

  /**
   * 设置行驶运镜关键帧 - 移动到车辆后方
   */
  private setupDrivingKeyframes(): void {
    const keyframes = [
      // 从当前位置开始
      { pos: this.camera.position.toArray(), target: [0, 0, 0] },
      // 最终稳定在后方
      { pos: [0, 2, 10], target: [0, 0, 0] },
    ];

    keyframes.forEach((keyframe, index) => {
      this.animationState.keyframes.push({
        position: new THREE.Vector3(...keyframe.pos),
        target: new THREE.Vector3(...keyframe.target),
        time: index / (keyframes.length - 1),
      });
    });
  }

  /**
   * 设置侧面运镜关键帧 - 移动到车辆侧面
   */
  private setupSideKeyframes(): void {
    const keyframes = [
      // 从当前位置开始
      { pos: this.camera.position.toArray(), target: [0, 0, 0] },
      // 最终稳定在侧面
      { pos: [-7, 2.5, 1], target: [0, 0, 0] },
    ];

    keyframes.forEach((keyframe, index) => {
      this.animationState.keyframes.push({
        position: new THREE.Vector3(...keyframe.pos),
        target: new THREE.Vector3(...keyframe.target),
        time: index / (keyframes.length - 1),
      });
    });
  }

  /**
   * 更新运镜动画
   */
  private updateCameraAnimation(): void {
    const elapsed = Date.now() - this.animationState.startTime;
    const progress = Math.min(elapsed / this.animationState.duration, 1);

    if (progress >= 1) {
      this.stopAnimation();
      return;
    }

    // 在关键帧之间插值
    this.interpolateKeyframes(progress);
  }

  /**
   * 关键帧插值
   */
  private interpolateKeyframes(progress: number): void {
    const keyframes = this.animationState.keyframes;
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
    this.camera.position.copy(position);

    // 目标插值
    const target = current.target.clone().lerp(next.target, segmentProgress);
    this.camera.lookAt(target);
  }

  /**
   * 清理资源
   */
  public dispose(): void {
    this.stopAnimation();

    if (this.controls) {
      this.controls.dispose();
      this.controls = null;
    }

    console.log("CameraController资源已清理");
  }
}
