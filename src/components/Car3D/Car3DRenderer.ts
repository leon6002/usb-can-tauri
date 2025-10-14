/**
 * 车辆3D渲染器 - 重构版本
 * 作为各个模块的协调器和公共接口
 */
import * as THREE from 'three';
import { SceneManager } from './SceneManager';
import { ModelLoader } from './ModelLoader';
import { CarComponents } from './CarComponents';
import { AnimationController } from './AnimationController';
import { CameraController } from './CameraController';
import { InteractionHandler } from './InteractionHandler';
import { CameraAnimationMode } from './types';

export class Car3DRenderer {
  private container: HTMLElement;
  private clock: THREE.Clock;
  private animationId: number | null = null;
  
  // 模块实例
  private sceneManager: SceneManager;
  private modelLoader: ModelLoader;
  private carComponents: CarComponents;
  private animationController: AnimationController;
  private cameraController: CameraController;
  private interactionHandler: InteractionHandler;
  
  // 车辆模型
  private car: THREE.Group | null = null;

  constructor(containerId: string) {
    const container = document.getElementById(containerId);
    if (!container) {
      throw new Error(`Container with id "${containerId}" not found`);
    }
    
    this.container = container;
    this.clock = new THREE.Clock();
    
    // 初始化模块
    this.sceneManager = new SceneManager(container);
    this.modelLoader = new ModelLoader();
    this.carComponents = new CarComponents();
    
    // 这些模块需要在场景创建后初始化
    this.animationController = new AnimationController(
      this.carComponents.wheels,
      this.carComponents.lights
    );
    
    this.init();
  }

  /**
   * 初始化3D场景
   */
  private async init(): Promise<void> {
    try {
      // 创建场景、相机、渲染器
      this.sceneManager.createScene(SceneManager.getDefaultSceneConfig());
      this.sceneManager.createCamera(SceneManager.getDefaultCameraConfig());
      this.sceneManager.createRenderer(SceneManager.getDefaultRendererConfig());
      this.sceneManager.createLights();
      
      // 初始化相机控制器
      this.cameraController = new CameraController(this.sceneManager.camera);
      this.cameraController.setupControls(this.sceneManager.camera, this.sceneManager.renderer.domElement);
      
      // 初始化交互处理器
      this.interactionHandler = new InteractionHandler(
        this.container,
        this.sceneManager.camera,
        this.sceneManager.scene
      );
      this.interactionHandler.setupClickHandlers(this.container);
      
      // 加载车辆模型
      await this.loadCarModel();
      
      // 开始渲染循环
      this.animate();
      
      console.log('✅ Car3DRenderer初始化完成');
      
    } catch (error) {
      console.error('Car3DRenderer初始化失败:', error);
      this.showLoadError(error as Error);
    }
  }

  /**
   * 加载车辆模型
   */
  private async loadCarModel(): Promise<void> {
    try {
      this.car = await this.modelLoader.loadModel(ModelLoader.getDefaultModelConfig());
      
      // 添加到场景
      this.sceneManager.scene.add(this.car);
      
      // 初始化车辆组件
      this.carComponents.initializeComponents(this.car);
      
      // 初始化动画系统
      this.animationController.initializeAnimations(this.car);
      
      // 创建3D按钮
      this.interactionHandler.create3DDoorButtons(this.car);
      
      // 设置事件监听
      this.setupEventListeners();
      
      this.onModelLoaded();
      
    } catch (error) {
      throw new Error(`模型加载失败: ${error}`);
    }
  }

  /**
   * 设置事件监听器
   */
  private setupEventListeners(): void {
    // 监听门按钮点击事件
    document.addEventListener('doorButtonClick', (event: Event) => {
      const customEvent = event as CustomEvent;
      const { door } = customEvent.detail;
      this.toggleDoor(door);
    });

    // 监听门动画播放事件
    document.addEventListener('playDoorAnimation', (event: Event) => {
      const customEvent = event as CustomEvent;
      const { animationName, reverse } = customEvent.detail;
      this.animationController.playDoorAnimation(animationName, reverse);
    });
  }

  /**
   * 动画循环
   */
  private animate(): void {
    this.animationId = requestAnimationFrame(() => this.animate());

    const delta = this.clock.getDelta();

    // 更新各个模块
    this.animationController.update(delta);
    this.cameraController.update(delta);

    // 渲染场景
    this.sceneManager.render();
  }

  /**
   * 模型加载完成回调
   */
  private onModelLoaded(): void {
    // 隐藏加载提示
    const loadingElement = this.container.querySelector('.loading-3d');
    if (loadingElement) {
      (loadingElement as HTMLElement).style.display = 'none';
    }

    console.log('3D车辆模型加载完成');

    // 触发自定义事件
    const event = new CustomEvent('car3dLoaded');
    document.dispatchEvent(event);
  }

  /**
   * 显示加载错误
   */
  private showLoadError(error: Error): void {
    const errorDiv = document.createElement('div');
    errorDiv.className = 'error-3d';
    errorDiv.innerHTML = `
      <div class="error-content">
        <h3>模型加载失败</h3>
        <p>${error.message}</p>
        <button onclick="location.reload()" class="reload-btn">重新加载</button>
      </div>
    `;
    this.container.appendChild(errorDiv);
  }

  // ==================== 公共API方法 ====================

  /**
   * 切换门状态
   */
  public toggleDoor(door: 'left' | 'right'): void {
    this.carComponents.toggleDoor(door);
  }

  /**
   * 开始运镜动画
   */
  public startCameraAnimation(mode: CameraAnimationMode, duration: number = 10000): void {
    this.cameraController.startAnimation(mode, duration);
  }

  /**
   * 停止运镜动画
   */
  public stopCameraAnimation(): void {
    this.cameraController.stopAnimation();
  }

  /**
   * 开始轮子旋转
   */
  public startWheelRotation(speed: number = 5, direction: number = 1): void {
    this.animationController.startWheelRotation(speed, direction);
  }

  /**
   * 停止轮子旋转
   */
  public stopWheelRotation(): void {
    this.animationController.stopWheelRotation();
  }

  /**
   * 开始道路移动
   */
  public startRoadMovement(speed: number = 2): void {
    this.animationController.startRoadMovement(speed);
  }

  /**
   * 停止道路移动
   */
  public stopRoadMovement(): void {
    this.animationController.stopRoadMovement();
  }

  /**
   * 开始车灯动画
   */
  public startLightAnimation(type: 'headlights' | 'taillights' | 'turnSignals', interval: number = 500): void {
    this.animationController.startLightAnimation(type, interval);
  }

  /**
   * 停止车灯动画
   */
  public stopLightAnimation(): void {
    this.animationController.stopLightAnimation();
  }

  // ==================== 生命周期方法 ====================

  /**
   * 检查渲染器是否仍在运行
   */
  public isActive(): boolean {
    return !!(this.animationId && this.sceneManager.renderer && this.container && this.container.parentNode);
  }

  /**
   * 暂停动画循环
   */
  public pauseAnimation(): void {
    if (this.animationId) {
      cancelAnimationFrame(this.animationId);
      this.animationId = null;
      console.log('3D animation paused');
    }
  }

  /**
   * 恢复动画循环
   */
  public resumeAnimation(): void {
    if (!this.animationId && this.sceneManager.renderer) {
      this.animate();
      console.log('3D animation resumed');
    }
  }

  /**
   * 清理资源
   */
  public dispose(): void {
    // 停止动画循环
    if (this.animationId) {
      cancelAnimationFrame(this.animationId);
      this.animationId = null;
    }

    // 清理各个模块
    this.sceneManager?.dispose();
    this.modelLoader?.dispose();
    this.carComponents?.dispose();
    this.animationController?.dispose();
    this.cameraController?.dispose();
    this.interactionHandler?.dispose();

    console.log('Car3DRenderer资源已清理');
  }
}
