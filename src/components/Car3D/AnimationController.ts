/**
 * 动画控制器 - 管理所有动画：门动画、轮子旋转、灯光动画等
 */
import * as THREE from 'three';
import { IAnimationController, WheelRotationState, RoadMovementState, WheelObjects, LightObjects } from './types';

export class AnimationController implements IAnimationController {
  public mixer: THREE.AnimationMixer | null = null;
  public doorAnimations: { [key: string]: any } = {};
  public wheelRotation: WheelRotationState = {
    isRotating: false,
    speed: 0,
    direction: 1 // 1: 前进, -1: 后退
  };
  public roadMovement: RoadMovementState = {
    isMoving: false,
    speed: 0,
    objects: []
  };

  // 渐进停止状态
  private gradualStop = {
    isActive: false,
    initialSpeed: 0,
    targetSpeed: 0,
    duration: 5000, // 3秒渐进停止
    startTime: 0
  };

  private wheels: WheelObjects;
  private lights: LightObjects;
  private lightAnimation: NodeJS.Timeout | null = null;
  private sceneManager: any; // SceneManager引用

  constructor(wheels: WheelObjects, lights: LightObjects, sceneManager?: any) {
    this.wheels = wheels;
    this.lights = lights;
    this.sceneManager = sceneManager;

    // 监听门按钮点击事件
    this.setupDoorButtonListener();
  }

  /**
   * 设置门按钮事件监听器
   */
  private setupDoorButtonListener(): void {
    document.addEventListener('doorButtonClick', (event: Event) => {
      const customEvent = event as CustomEvent;
      const { door, isOpening } = customEvent.detail;
      console.log(`🚗 接收到门按钮点击事件: ${door}, 是否开门: ${isOpening}`);

      // 根据门的位置播放对应的动画
      if (door === 'left') {
        this.playDoorAnimation('DoorFLOpen', !isOpening); // 如果是开门则正向播放，关门则反向播放
      } else if (door === 'right') {
        this.playDoorAnimation('DoorFROpen', !isOpening); // 如果是开门则正向播放，关门则反向播放
      }
    });

    console.log('✅ 门按钮事件监听器设置完成');
  }

  /**
   * 初始化动画系统
   */
  public initializeAnimations(car: THREE.Group): void {
    // 设置动画混合器（如果模型有预制动画）
    const mixer = (car as any).mixer;
    const animations = (car as any).animations;

    if (mixer && animations) {
      this.mixer = mixer;
      animations.forEach((clip: THREE.AnimationClip) => {
        const action = this.mixer!.clipAction(clip);
        action.setLoop(THREE.LoopOnce, 1);
        action.clampWhenFinished = true;
        this.doorAnimations[clip.name] = action;
        console.log(`✓ 注册动画: ${clip.name}`);
      });
      console.log('✅ 动画系统初始化完成，可用动画:', Object.keys(this.doorAnimations));
    } else {
      console.warn('⚠️ 模型没有预制动画');
    }
  }

  /**
   * 更新所有动画
   */
  public update(delta: number): void {
    // 更新动画混合器
    if (this.mixer) {
      this.mixer.update(delta);
    }

    // 更新渐进停止
    this.updateGradualStop();

    // 更新轮子旋转
    this.updateWheelRotation(delta);

    // 更新道路移动
    this.updateRoadMovement(delta);
  }

  /**
   * 开始轮子旋转动画
   */
  public startWheelRotation(speed: number = 5, direction: number = 1): void {
    console.log('开始轮子旋转，速度:', speed);
    this.wheelRotation.speed = speed;
    this.wheelRotation.direction = direction;
    this.wheelRotation.isRotating = true;

    // 显示找到的轮子状态
    console.log('轮子状态:', {
      frontLeft: !!this.wheels.frontLeft,
      frontRight: !!this.wheels.frontRight,
      rearLeft: !!this.wheels.rearLeft,
      rearRight: !!this.wheels.rearRight
    });
  }

  /**
   * 停止轮子旋转动画（渐进停止）
   */
  public stopWheelRotation(): void {
    console.log('开始渐进停止轮子旋转');

    // 只有在轮子正在旋转时才启动渐进停止
    if (!this.wheelRotation.isRotating || this.wheelRotation.speed <= 0) {
      console.log('轮子未在旋转，直接停止');
      this.wheelRotation.isRotating = false;
      this.wheelRotation.speed = 0;
      return;
    }

    // 启动渐进停止，但保持isRotating为true直到完全停止
    this.gradualStop.isActive = true;
    this.gradualStop.initialSpeed = this.wheelRotation.speed;
    this.gradualStop.targetSpeed = 0;
    this.gradualStop.startTime = Date.now();

    console.log(`从速度 ${this.gradualStop.initialSpeed} 渐进停止到 0，持续时间: ${this.gradualStop.duration}ms`);
  }

  /**
   * 立即停止轮子旋转动画
   */
  public stopWheelRotationImmediately(): void {
    console.log('立即停止轮子旋转');
    this.wheelRotation.isRotating = false;
    this.wheelRotation.speed = 0;
    this.gradualStop.isActive = false;
  }

  /**
   * 开始道路移动动画
   */
  public startRoadMovement(speed: number = 2): void {
    console.log('开始道路移动，速度:', speed);
    this.roadMovement.speed = speed;
    this.roadMovement.isMoving = true;
  }

  /**
   * 停止道路移动动画（渐进停止）
   */
  public stopRoadMovement(): void {
    console.log('开始渐进停止道路移动');

    // 只有在道路正在移动时才需要处理
    if (!this.roadMovement.isMoving || this.roadMovement.speed <= 0) {
      console.log('道路未在移动，直接停止');
      this.roadMovement.isMoving = false;
      this.roadMovement.speed = 0;
      return;
    }

    // 道路移动和轮子旋转应该同步停止
    // 如果渐进停止还没有激活，则激活它
    if (!this.gradualStop.isActive) {
      this.gradualStop.isActive = true;
      this.gradualStop.initialSpeed = Math.max(this.wheelRotation.speed, this.roadMovement.speed);
      this.gradualStop.targetSpeed = 0;
      this.gradualStop.startTime = Date.now();
      console.log(`道路移动渐进停止，初始速度: ${this.gradualStop.initialSpeed}`);
    }
  }

  /**
   * 立即停止道路移动动画
   */
  public stopRoadMovementImmediately(): void {
    console.log('立即停止道路移动');
    this.roadMovement.isMoving = false;
    this.roadMovement.speed = 0;
  }

  /**
   * 开始车灯闪烁动画
   */
  public startLightAnimation(type: 'headlights' | 'taillights' | 'turnSignals', interval: number = 500): void {
    this.stopLightAnimation(); // 先停止之前的动画
    
    const targetLights = this.lights[type];
    if (targetLights.length === 0) {
      console.warn(`没有找到${type}灯光对象`);
      return;
    }

    let isOn = true;
    this.lightAnimation = setInterval(() => {
      targetLights.forEach(light => {
        if (light.type === 'Mesh') {
          const mesh = light as THREE.Mesh;
          if (mesh.material) {
            const material = mesh.material as THREE.MeshStandardMaterial;
            material.emissive.setHex(isOn ? 0xffff00 : 0x000000);
          }
        }
      });
      isOn = !isOn;
    }, interval);

    console.log(`开始${type}闪烁动画`);
  }

  /**
   * 停止车灯动画
   */
  public stopLightAnimation(): void {
    if (this.lightAnimation) {
      clearInterval(this.lightAnimation);
      this.lightAnimation = null;
      
      // 重置所有灯光状态
      Object.values(this.lights).flat().forEach(light => {
        if (light.type === 'Mesh') {
          const mesh = light as THREE.Mesh;
          if (mesh.material) {
            const material = mesh.material as THREE.MeshStandardMaterial;
            material.emissive.setHex(0x000000);
          }
        }
      });
      
      console.log('停止车灯动画');
    }
  }

  /**
   * 更新渐进停止
   */
  private updateGradualStop(): void {
    if (!this.gradualStop.isActive) return;

    const elapsed = Date.now() - this.gradualStop.startTime;
    const progress = Math.min(elapsed / this.gradualStop.duration, 1);

    // 使用缓动函数实现平滑减速
    const easeOut = 1 - Math.pow(1 - progress, 3);
    const currentSpeed = this.gradualStop.initialSpeed * (1 - easeOut);

    // 更新轮子和道路速度
    if (this.wheelRotation.isRotating) {
      this.wheelRotation.speed = currentSpeed;
    }
    if (this.roadMovement.isMoving) {
      // 道路移动速度应该与轮子速度成比例
      this.roadMovement.speed = currentSpeed * 0.05; // 道路移动速度相对较慢
    }

    // 添加调试日志
    if (elapsed % 500 < 50) { // 每500ms输出一次日志
      console.log(`渐进停止进度: ${(progress * 100).toFixed(1)}%, 当前速度: ${currentSpeed.toFixed(2)}`);
    }

    // 检查是否完成渐进停止
    if (progress >= 1) {
      console.log('🛑 渐进停止完成');
      this.wheelRotation.isRotating = false;
      this.wheelRotation.speed = 0;
      this.roadMovement.isMoving = false;
      this.roadMovement.speed = 0;
      this.gradualStop.isActive = false;
    }
  }

  /**
   * 更新轮子旋转
   */
  private updateWheelRotation(delta: number): void {
    if (this.wheelRotation.isRotating && this.wheelRotation.speed > 0) {
      // 计算旋转角度
      const rotationAngle = this.wheelRotation.speed * this.wheelRotation.direction * delta;

      // 旋转所有轮子
      Object.values(this.wheels).forEach(wheel => {
        if (wheel) {
          wheel.rotation.x -= rotationAngle;
        }
      });
    }
  }

  /**
   * 更新道路移动
   */
  private updateRoadMovement(delta: number): void {
    if (this.roadMovement.isMoving && this.roadMovement.speed > 0 && this.sceneManager?.roadTexture) {
      // 移动道路纹理的偏移
      this.sceneManager.roadTexture.offset.y += this.roadMovement.speed * delta;

      // 当偏移超过1时重置，创建无缝循环
      if (this.sceneManager.roadTexture.offset.y >= 1) {
        this.sceneManager.roadTexture.offset.y = 0;
      }
    }
  }

  /**
   * 播放门动画
   */
  public playDoorAnimation(animationName: string, reverse: boolean = false): void {
    const action = this.doorAnimations[animationName];
    if (!action) {
      console.warn(`门动画 ${animationName} 未找到，可用动画:`, Object.keys(this.doorAnimations));
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
    console.log(`播放门动画: ${animationName}, 反向: ${reverse}, 持续时间: ${action.getClip().duration}s`);
  }


  /**
   * 清理资源
   */
  public dispose(): void {
    // 停止所有动画
    this.stopWheelRotation();
    this.stopRoadMovement();
    this.stopLightAnimation();

    // 清理动画混合器
    if (this.mixer) {
      this.mixer.stopAllAction();
      this.mixer = null;
    }

    // 清理道路对象
    this.roadMovement.objects.forEach(obj => {
      if (obj.parent) {
        obj.parent.remove(obj);
      }
    });
    this.roadMovement.objects = [];

    this.doorAnimations = {};
    
    console.log('AnimationController资源已清理');
  }
}
