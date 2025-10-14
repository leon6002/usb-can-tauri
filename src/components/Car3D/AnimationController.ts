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
      const { door } = customEvent.detail;
      console.log(`🚗 接收到门按钮点击事件: ${door}`);

      // 根据门的位置播放对应的动画
      if (door === 'left') {
        this.playDoorAnimation('DoorFLOpen');
      } else if (door === 'right') {
        this.playDoorAnimation('DoorFROpen');
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
   * 停止轮子旋转动画
   */
  public stopWheelRotation(): void {
    console.log('停止轮子旋转');
    this.wheelRotation.isRotating = false;
    this.wheelRotation.speed = 0;
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
   * 停止道路移动动画
   */
  public stopRoadMovement(): void {
    console.log('停止道路移动');
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
