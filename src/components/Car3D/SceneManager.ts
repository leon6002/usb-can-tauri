/**
 * 场景管理器 - 负责Three.js场景、相机、渲染器的创建和管理
 */
import * as THREE from 'three';
import { ISceneManager, SceneConfig, CameraConfig, RendererConfig } from './types';

export class SceneManager implements ISceneManager {
  public scene!: THREE.Scene;
  public camera!: THREE.PerspectiveCamera;
  public renderer!: THREE.WebGLRenderer;
  public container: HTMLElement;
  public roadTexture: THREE.CanvasTexture | null = null; // 暴露道路纹理
  
  private onWindowResizeBound: () => void;

  constructor(container: HTMLElement) {
    this.container = container;
    this.onWindowResizeBound = this.onWindowResize.bind(this);
  }

  /**
   * 创建Three.js场景
   */
  public createScene(config: SceneConfig): void {
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(config.backgroundColor);
    this.scene.fog = new THREE.Fog(config.fogColor, config.fogNear, config.fogFar);
  }

  /**
   * 创建透视相机
   */
  public createCamera(config: CameraConfig): void {
    this.camera = new THREE.PerspectiveCamera(
      config.fov,
      this.container.clientWidth / this.container.clientHeight,
      config.near,
      config.far
    );
    this.camera.position.set(...config.position);
    this.camera.lookAt(...config.lookAt);
  }

  /**
   * 创建WebGL渲染器
   */
  public createRenderer(config: RendererConfig): void {
    this.renderer = new THREE.WebGLRenderer({ antialias: config.antialias });
    this.renderer.setSize(this.container.clientWidth, this.container.clientHeight);
    this.renderer.setPixelRatio(window.devicePixelRatio);
    this.renderer.shadowMap.enabled = config.shadowMapEnabled;
    this.renderer.shadowMap.type = config.shadowMapType;
    this.renderer.outputColorSpace = config.outputColorSpace;
    this.renderer.toneMapping = config.toneMapping;
    this.renderer.toneMappingExposure = config.toneMappingExposure;

    // 清空容器内容，防止重复渲染
    this.container.innerHTML = '';
    this.container.appendChild(this.renderer.domElement);

    // 监听窗口大小变化
    window.addEventListener('resize', this.onWindowResizeBound);
  }

  /**
   * 创建场景灯光
   */
  public createLights(): void {
    // 大幅增强环境光 - 提供强烈的基础照明
    const ambientLight = new THREE.AmbientLight(0xffffff, 1.5);
    this.scene.add(ambientLight);

    // 主光源 - 从右上方照射，产生阴影
    const directionalLight = new THREE.DirectionalLight(0xffffff, 2.0);
    directionalLight.position.set(-8, 15, 12);
    directionalLight.target.position.set(6, -3, -8);
    directionalLight.castShadow = true;
    directionalLight.shadow.mapSize.width = 2048;
    directionalLight.shadow.mapSize.height = 2048;
    directionalLight.shadow.camera.near = 5;
    directionalLight.shadow.camera.far = 40;
    directionalLight.shadow.camera.left = 15;
    directionalLight.shadow.camera.right = -15;
    directionalLight.shadow.camera.top = 15;
    directionalLight.shadow.camera.bottom = -15;
    this.scene.add(directionalLight);
    this.scene.add(directionalLight.target);

    // 创建道路
    this.createRoad();

    // 背光补充光源 - 从左后方照射，照亮背光面
    const backFillLight = new THREE.DirectionalLight(0xffffff, 1.2);
    backFillLight.position.set(-12, 8, -10);
    backFillLight.castShadow = false;
    this.scene.add(backFillLight);

    // 侧面补充光源 - 从右侧照射
    const sideFillLight = new THREE.DirectionalLight(0xffffff, 1.0);
    sideFillLight.position.set(20, 6, 0);
    sideFillLight.castShadow = false;
    this.scene.add(sideFillLight);

    // 左侧补充光源 - 从左侧照射，平衡光照
    const leftFillLight = new THREE.DirectionalLight(0xffffff, 0.8);
    leftFillLight.position.set(-20, 6, 0);
    leftFillLight.castShadow = false;
    this.scene.add(leftFillLight);

    // 前方补充光源 - 从前方照射车头
    const frontFillLight = new THREE.DirectionalLight(0xffffff, 0.6);
    frontFillLight.position.set(0, 8, 15);
    frontFillLight.castShadow = false;
    this.scene.add(frontFillLight);

    // 底部补充光源 - 从下方照射，减少过暗的阴影
    const bottomFillLight = new THREE.DirectionalLight(0xffffff, 0.8);
    bottomFillLight.position.set(0, -3, 0);
    bottomFillLight.castShadow = false;
    this.scene.add(bottomFillLight);

    // 添加点光源 - 在车辆周围提供额外照明
    const pointLight1 = new THREE.PointLight(0xffffff, 1.0, 30);
    pointLight1.position.set(5, 5, 5);
    this.scene.add(pointLight1);

    const pointLight2 = new THREE.PointLight(0xffffff, 1.0, 30);
    pointLight2.position.set(-5, 5, -5);
    this.scene.add(pointLight2);

    // 顶部聚光灯 - 模拟摄影棚效果
    const spotLight = new THREE.SpotLight(0xffffff, 1.5, 50, Math.PI / 6, 0.1);
    spotLight.position.set(0, 20, 0);
    spotLight.target.position.set(0, 0, 0);
    spotLight.castShadow = false;
    this.scene.add(spotLight);
    this.scene.add(spotLight.target);

    console.log('✓ 场景灯光创建完成');
  }

  /**
   * 创建地面
   */
  private createGround(): void {
    const groundGeometry = new THREE.PlaneGeometry(100, 100);
    const groundMaterial = new THREE.MeshLambertMaterial({ color: 0xcccccc });
    const ground = new THREE.Mesh(groundGeometry, groundMaterial);
    ground.rotation.x = -Math.PI / 2;
    ground.position.y = -0.5;
    ground.receiveShadow = true;
    this.scene.add(ground);

    console.log('✓ 地面创建完成');
  }

  /**
   * 创建道路
   */
  private createRoad(): void {
    // 先创建地面
    this.createGround();

    // 创建道路纹理
    const canvas = document.createElement('canvas');
    canvas.width = 512;
    canvas.height = 512;
    const ctx = canvas.getContext('2d')!;

    // 绘制道路背景
    ctx.fillStyle = '#2c2c2c';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // 绘制道路标线
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 4;
    ctx.setLineDash([20, 20]);

    // 中央虚线
    ctx.beginPath();
    ctx.moveTo(canvas.width / 2, 0);
    ctx.lineTo(canvas.width / 2, canvas.height);
    ctx.stroke();

    // 边线
    ctx.setLineDash([]);
    ctx.lineWidth = 6;
    ctx.beginPath();
    ctx.moveTo(50, 0);
    ctx.lineTo(50, canvas.height);
    ctx.stroke();

    ctx.beginPath();
    ctx.moveTo(canvas.width - 50, 0);
    ctx.lineTo(canvas.width - 50, canvas.height);
    ctx.stroke();

    // 创建纹理
    this.roadTexture = new THREE.CanvasTexture(canvas);
    this.roadTexture.wrapS = THREE.RepeatWrapping;
    this.roadTexture.wrapT = THREE.RepeatWrapping;
    this.roadTexture.repeat.set(1, 5); // 重复5次，创建长道路效果

    // 创建道路几何体
    const roadGeometry = new THREE.PlaneGeometry(10, 150);
    const roadMaterial = new THREE.MeshLambertMaterial({
      map: this.roadTexture,
      transparent: false
    });

    const road = new THREE.Mesh(roadGeometry, roadMaterial);
    road.rotation.x = -Math.PI / 2;
    road.position.y = -0.49; // 稍微高于地面，避免z-fighting
    road.receiveShadow = true;

    this.scene.add(road);
    console.log('✓ 道路创建完成');
  }

  /**
   * 处理窗口大小变化
   */
  public onWindowResize(): void {
    const width = this.container.clientWidth;
    const height = this.container.clientHeight;
    
    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
    
    this.renderer.setSize(width, height);
  }

  /**
   * 渲染场景
   */
  public render(): void {
    this.renderer.render(this.scene, this.camera);
  }

  /**
   * 获取默认场景配置
   */
  public static getDefaultSceneConfig(): SceneConfig {
    return {
      backgroundColor: 0xffffff, // 白色背景
      fogColor: 0xffffff,
      fogNear: 10,
      fogFar: 50
    };
  }

  /**
   * 获取默认相机配置
   */
  public static getDefaultCameraConfig(): CameraConfig {
    return {
      fov: 40,
      near: 0.2,
      far: 1000,
      position: [5, 3, 5],
      lookAt: [0, 0, 0]
    };
  }

  /**
   * 获取默认渲染器配置
   */
  public static getDefaultRendererConfig(): RendererConfig {
    return {
      antialias: true,
      shadowMapEnabled: true,
      shadowMapType: THREE.PCFSoftShadowMap,
      outputColorSpace: THREE.SRGBColorSpace,
      toneMapping: THREE.ACESFilmicToneMapping,
      toneMappingExposure: 1
    };
  }

  /**
   * 清理资源
   */
  public dispose(): void {
    // 移除事件监听器
    window.removeEventListener('resize', this.onWindowResizeBound);

    // 清理渲染器
    if (this.renderer) {
      this.renderer.dispose();
    }

    // 清理场景中的对象
    if (this.scene) {
      this.scene.traverse((child) => {
        if (child.type === 'Mesh') {
          const mesh = child as THREE.Mesh;
          if (mesh.geometry) mesh.geometry.dispose();
          if (mesh.material) {
            if (Array.isArray(mesh.material)) {
              mesh.material.forEach(material => material.dispose());
            } else {
              mesh.material.dispose();
            }
          }
        }
      });
      this.scene.clear();
    }

    console.log('SceneManager资源已清理');
  }
}
