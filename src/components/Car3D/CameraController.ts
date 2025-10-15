/**
 * 相机控制器 - 管理运镜系统：轨道、展示、电影等运镜模式
 */
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { ICameraController, CameraAnimationState, CameraAnimationMode } from './types';

export class CameraController implements ICameraController {
  public controls: OrbitControls | null = null;
  public animationState: CameraAnimationState = {
    isActive: false,
    mode: 'orbit',
    startTime: 0,
    duration: 10000, // 10秒
    originalPosition: null,
    originalTarget: null,
    keyframes: [],
    currentKeyframe: 0
  };

  private camera: THREE.PerspectiveCamera;

  constructor(camera: THREE.PerspectiveCamera) {
    this.camera = camera;
  }

  /**
   * 设置轨道控制器
   */
  public setupControls(camera: THREE.PerspectiveCamera, domElement: HTMLElement): void {
    this.controls = new OrbitControls(camera, domElement);
    this.controls.enableDamping = true;
    this.controls.dampingFactor = 0.05;
    this.controls.maxPolarAngle = Math.PI / 2;
    this.controls.minDistance = 2;
    this.controls.maxDistance = 20;
    
    console.log('✅ 相机控制器初始化完成');
  }

  /**
   * 开始运镜动画
   */
  public startAnimation(mode: CameraAnimationMode, duration: number = 10000, keepFinalPosition: boolean = false): void {
    if (this.animationState.isActive) {
      this.stopAnimation();
    }

    this.animationState.isActive = true;
    this.animationState.mode = mode;
    this.animationState.startTime = Date.now();
    this.animationState.duration = duration;
    this.animationState.originalPosition = this.camera.position.clone();
    this.animationState.originalTarget = this.controls ? this.controls.target.clone() : new THREE.Vector3();

    // 添加是否保持最终位置的标记
    (this.animationState as any).keepFinalPosition = keepFinalPosition;

    // 根据模式设置关键帧
    this.setupKeyframes(mode);

    // 禁用手动控制
    if (this.controls) {
      this.controls.enabled = false;
    }

    console.log(`开始${mode}运镜，持续时间: ${duration}ms，保持最终位置: ${keepFinalPosition}`);
  }

  /**
   * 停止运镜动画
   */
  public stopAnimation(): void {
    if (!this.animationState.isActive) return;

    const keepFinalPosition = (this.animationState as any).keepFinalPosition || false;
    this.animationState.isActive = false;

    // 恢复手动控制
    if (this.controls) {
      this.controls.enabled = true;
    }

    // 只有在不保持最终位置时才恢复原始位置
    if (!keepFinalPosition && this.animationState.originalPosition && this.animationState.originalTarget) {
      this.camera.position.copy(this.animationState.originalPosition);
      if (this.controls) {
        this.controls.target.copy(this.animationState.originalTarget);
        this.controls.update();
      }
      console.log('停止运镜动画，恢复原始位置');
    } else {
      console.log('停止运镜动画，保持最终位置');
      // 更新OrbitControls的target以匹配当前相机朝向
      if (this.controls) {
        this.controls.update();
      }
    }
  }

  /**
   * 更新运镜动画
   */
  public update(_delta: number): void {
    if (this.controls) {
      this.controls.update();
    }

    if (this.animationState.isActive) {
      this.updateCameraAnimation();
    }
  }

  /**
   * 设置运镜关键帧
   */
  private setupKeyframes(mode: CameraAnimationMode): void {
    this.animationState.keyframes = [];
    this.animationState.currentKeyframe = 0;

    switch (mode) {
      case 'orbit':
        this.setupOrbitKeyframes();
        break;
      case 'showcase':
        this.setupShowcaseKeyframes();
        break;
      case 'cinematic':
        this.setupCinematicKeyframes();
        break;
      case 'follow':
        this.setupFollowKeyframes();
        break;
      case 'driving':
        this.setupDrivingKeyframes();
        break;
      case 'side':
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
        time: i / steps
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
      { pos: [5, 3, 5], target: [0, 0, 0] }
    ];

    positions.forEach((keyframe, index) => {
      this.animationState.keyframes.push({
        position: new THREE.Vector3(...keyframe.pos),
        target: new THREE.Vector3(...keyframe.target),
        time: index / (positions.length - 1)
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
      { pos: [5, 3, 5], target: [0, 0, 0] }
    ];

    keyframes.forEach((keyframe, index) => {
      this.animationState.keyframes.push({
        position: new THREE.Vector3(...keyframe.pos),
        target: new THREE.Vector3(...keyframe.target),
        time: index / (keyframes.length - 1)
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
      { pos: [0, 1, -5], target: [0, 0, 0] }
    ];

    offsets.forEach((offset, index) => {
      this.animationState.keyframes.push({
        position: new THREE.Vector3(...offset.pos),
        target: new THREE.Vector3(...offset.target),
        time: index / (offsets.length - 1)
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
      { pos: [0, 2, 6], target: [0, 0, 0] }
    ];

    keyframes.forEach((keyframe, index) => {
      this.animationState.keyframes.push({
        position: new THREE.Vector3(...keyframe.pos),
        target: new THREE.Vector3(...keyframe.target),
        time: index / (keyframes.length - 1)
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
      { pos: [7, 2.5, 1], target: [0, 0, 0] }
    ];

    keyframes.forEach((keyframe, index) => {
      this.animationState.keyframes.push({
        position: new THREE.Vector3(...keyframe.pos),
        target: new THREE.Vector3(...keyframe.target),
        time: index / (keyframes.length - 1)
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
    const segmentProgress = (progress - current.time) / (next.time - current.time);
    
    // 位置插值
    const position = current.position.clone().lerp(next.position, segmentProgress);
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
    
    console.log('CameraController资源已清理');
  }
}
