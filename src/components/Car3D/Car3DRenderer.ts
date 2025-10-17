/**
 * 车辆3D渲染器 - 重构版本
 * 作为各个模块的协调器和公共接口
 */
import * as THREE from "three";
import { SceneManager } from "./SceneManager";
import { ModelLoader } from "./ModelLoader";
import { CarComponents } from "./CarComponents";
import { AnimationController } from "./AnimationController";
import { CameraController } from "./CameraController";
import { InteractionHandler } from "./InteractionHandler";
import { CameraAnimationMode } from "./types";

export class Car3DRenderer {
  private container: HTMLElement;
  private clock: THREE.Clock;
  private animationId: number | null = null;
  private onSendCommand?: (commandId: string) => void; // CAN命令发送回调

  // 模块实例
  private sceneManager: SceneManager;
  private modelLoader: ModelLoader;
  private carComponents: CarComponents;
  private animationController: AnimationController;
  private cameraController!: CameraController;
  private interactionHandler!: InteractionHandler;

  // 车辆模型
  private car: THREE.Group | null = null;

  // 车辆动力学参数
  private vehicleDynamics = {
    wheelbase: 3.0, // 轴距（米）
    currentSpeed: 0, // 当前速度（mm/s）
    steeringAngle: 0, // 当前转向角（弧度）
    bodyYaw: 0, // 车身偏转角（弧度）
  };

  constructor(
    containerId: string,
    onSendCommand?: (commandId: string) => void
  ) {
    const container = document.getElementById(containerId);
    if (!container) {
      throw new Error(`Container with id "${containerId}" not found`);
    }

    this.container = container;
    this.clock = new THREE.Clock();
    this.onSendCommand = onSendCommand;

    // 初始化模块
    this.sceneManager = new SceneManager(container);
    this.modelLoader = new ModelLoader();
    this.carComponents = new CarComponents();

    // 这些模块需要在场景创建后初始化
    this.animationController = new AnimationController(
      this.carComponents.wheels,
      this.carComponents.lights,
      this.sceneManager,
      this.carComponents.suspensions,
      null // 车身将在模型加载后设置
    );
    // 注意：车身会在 loadCarModel 中通过 setCarBody() 设置

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
      this.cameraController.setupControls(
        this.sceneManager.camera,
        this.sceneManager.renderer.domElement
      );

      // 初始化交互处理器
      this.interactionHandler = new InteractionHandler(
        this.container,
        this.sceneManager.camera,
        this.sceneManager.scene,
        this.onSendCommand,
        this.carComponents
      );
      this.interactionHandler.setupClickHandlers(this.container);

      // 加载车辆模型
      await this.loadCarModel();

      // 开始渲染循环
      this.animate();

      console.log("✅ Car3DRenderer初始化完成");
    } catch (error) {
      console.error("Car3DRenderer初始化失败:", error);
      this.showLoadError(error as Error);
    }
  }

  /**
   * 加载车辆模型
   */
  private async loadCarModel(): Promise<void> {
    try {
      this.car = await this.modelLoader.loadModel(
        ModelLoader.getDefaultModelConfig()
      );

      // 添加到场景
      this.sceneManager.scene.add(this.car);

      // 初始化车辆组件
      this.carComponents.initializeComponents(this.car);

      // 设置车身引用到动画控制器
      this.animationController.setCarBody(this.car);

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
    document.addEventListener("doorButtonClick", (event: Event) => {
      const customEvent = event as CustomEvent;
      const { door } = customEvent.detail;
      this.toggleDoor(door);
    });

    // 监听门动画播放事件
    document.addEventListener("playDoorAnimation", (event: Event) => {
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

    // 更新车辆动力学（车身偏转角）
    this.updateVehicleDynamics(delta);

    // 渲染场景
    this.sceneManager.render();
  }

  /**
   * 更新车辆动力学（自行车模型）
   * 根据前轮转向角和车速计算车身偏转角
   */
  private updateVehicleDynamics(deltaTime: number): void {
    if (!this.carComponents.steering.carBody) return;

    const { wheelbase, currentSpeed, steeringAngle } = this.vehicleDynamics;

    // 将速度从 mm/s 转换为 m/s
    const speedMs = currentSpeed / 1000;

    // 自行车模型：车身偏转角速度 = (v / L) * tan(delta)
    // 其中 v 是车速，L 是轴距，delta 是前轮转向角
    // 注意：添加负号以匹配坐标系方向（轮胎向左转时，车身应向左旋转）
    if (Math.abs(speedMs) > 0.01) {
      // 只有当车速足够大时才计算偏转
      const yawRate = -(speedMs / wheelbase) * Math.tan(steeringAngle);
      this.vehicleDynamics.bodyYaw += yawRate * deltaTime;

      // 应用到车身
      this.carComponents.steering.carBody.rotation.y =
        this.vehicleDynamics.bodyYaw;
    }
  }

  /**
   * 模型加载完成回调
   */
  private onModelLoaded(): void {
    // 隐藏加载提示
    const loadingElement = this.container.querySelector(".loading-3d");
    if (loadingElement) {
      (loadingElement as HTMLElement).style.display = "none";
    }

    console.log("3D车辆模型加载完成");

    // 触发自定义事件
    const event = new CustomEvent("car3dLoaded");
    document.dispatchEvent(event);
  }

  /**
   * 显示加载错误
   */
  private showLoadError(error: Error): void {
    const errorDiv = document.createElement("div");
    errorDiv.className = "error-3d";
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
  public toggleDoor(door: "left" | "right"): void {
    this.carComponents.toggleDoor(door);
  }

  /**
   * 开始运镜动画
   */
  public startCameraAnimation(
    mode: CameraAnimationMode,
    duration: number = 10000,
    keepFinalPosition: boolean = false
  ): void {
    this.cameraController.startAnimation(mode, duration, keepFinalPosition);
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
  public startLightAnimation(
    type: "headlights" | "taillights" | "turnSignals",
    interval: number = 500
  ): void {
    this.animationController.startLightAnimation(type, interval);
  }

  /**
   * 停止车灯动画
   */
  public stopLightAnimation(): void {
    this.animationController.stopLightAnimation();
  }

  /**
   * 设置门按钮可见性
   */
  public setDoorButtonsVisible(visible: boolean): void {
    this.interactionHandler.setDoorButtonsVisible(visible);
  }

  /**
   * 更新车辆转向角度和速度
   * @param angle 前轮转向角（弧度）
   * @param speed 车速（mm/s），可选
   */
  public updateSteeringAngle(angle: number, speed?: number): void {
    // 使用转向轴来更新前轮转向（分离转向和滚动旋转）
    if (this.carComponents.steeringAxes.frontLeft) {
      this.carComponents.steeringAxes.frontLeft.rotation.z =
        179.1 + angle * 0.5;
    }
    if (this.carComponents.steeringAxes.frontRight) {
      this.carComponents.steeringAxes.frontRight.rotation.z =
        179.1 + angle * 0.5;
    }

    // 更新动力学参数
    this.vehicleDynamics.steeringAngle = angle;
    if (speed !== undefined) {
      this.vehicleDynamics.currentSpeed = speed;
    }

    this.carComponents.steering.currentRotation = angle;
  }

  /**
   * 重置车辆动力学状态
   */
  public resetVehicleDynamics(): void {
    this.vehicleDynamics.bodyYaw = 0;
    this.vehicleDynamics.currentSpeed = 0;
    this.vehicleDynamics.steeringAngle = 0;

    if (this.carComponents.steering.carBody) {
      this.carComponents.steering.carBody.rotation.y = 0;
    }
  }

  /**
   * 开始悬挂升高动画
   */
  public startSuspensionUp(): void {
    this.animationController.startSuspensionUp();
  }

  /**
   * 开始悬挂降低动画
   */
  public startSuspensionDown(): void {
    this.animationController.startSuspensionDown();
  }

  /**
   * 停止悬挂动画
   */
  public stopSuspensionAnimation(): void {
    this.animationController.stopSuspensionAnimation();
  }

  // ==================== 生命周期方法 ====================

  /**
   * 检查渲染器是否仍在运行
   */
  public isActive(): boolean {
    return !!(
      this.animationId &&
      this.sceneManager.renderer &&
      this.container &&
      this.container.parentNode
    );
  }

  /**
   * 暂停动画循环
   */
  public pauseAnimation(): void {
    if (this.animationId) {
      cancelAnimationFrame(this.animationId);
      this.animationId = null;
      console.log("3D animation paused");
    }
  }

  /**
   * 恢复动画循环
   */
  public resumeAnimation(): void {
    if (!this.animationId && this.sceneManager.renderer) {
      this.animate();
      console.log("3D animation resumed");
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

    console.log("Car3DRenderer资源已清理");
  }
}
