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
    // 环境光 - 提供基础照明
    const ambientLight = new THREE.AmbientLight(0x404040, 0.6);
    this.scene.add(ambientLight);

    // 主方向光 - 模拟太阳光
    const directionalLight = new THREE.DirectionalLight(0xffffff, 1.2);
    directionalLight.position.set(10, 10, 5);
    directionalLight.castShadow = true;
    
    // 设置阴影参数
    directionalLight.shadow.mapSize.width = 2048;
    directionalLight.shadow.mapSize.height = 2048;
    directionalLight.shadow.camera.near = 0.5;
    directionalLight.shadow.camera.far = 50;
    directionalLight.shadow.camera.left = -10;
    directionalLight.shadow.camera.right = 10;
    directionalLight.shadow.camera.top = 10;
    directionalLight.shadow.camera.bottom = -10;
    
    this.scene.add(directionalLight);

    // 补充光源 - 从另一个角度照亮车辆
    const fillLight = new THREE.DirectionalLight(0xffffff, 0.4);
    fillLight.position.set(-5, 5, -5);
    this.scene.add(fillLight);

    // 点光源 - 增加车辆周围的亮度
    const pointLight = new THREE.PointLight(0xffffff, 0.8, 20);
    pointLight.position.set(0, 5, 0);
    pointLight.castShadow = true;
    this.scene.add(pointLight);
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
      backgroundColor: 0x87CEEB, // 天蓝色背景
      fogColor: 0x87CEEB,
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
