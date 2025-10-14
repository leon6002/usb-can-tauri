/**
 * 模型加载器 - 负责GLTF模型的加载、解析和初始化
 */
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { IModelLoader, ModelConfig } from './types';

export class ModelLoader implements IModelLoader {
  private loader: GLTFLoader;

  constructor() {
    this.loader = new GLTFLoader();
  }

  /**
   * 加载GLTF模型
   */
  public async loadModel(config: ModelConfig): Promise<THREE.Group> {
    return new Promise((resolve, reject) => {
      console.log(`开始加载模型: ${config.path}`);
      
      this.loader.load(
        config.path,
        (gltf) => {
          console.log('车辆模型加载成功');
          const car = gltf.scene;
          
          // 设置模型属性
          this.setupModelProperties(car);
          
          // 设置模型位置和缩放
          car.scale.set(...config.scale);
          car.position.set(...config.position);
          
          // 设置动画混合器（如果有动画）
          if (gltf.animations && gltf.animations.length > 0) {
            const mixer = new THREE.AnimationMixer(car);
            (car as any).mixer = mixer;
            (car as any).animations = gltf.animations;
          }
          
          console.log('✅ 车辆模型初始化完成');
          resolve(car);
        },
        (progress) => {
          const percent = (progress.loaded / progress.total) * 100;
          console.log(`模型加载进度: ${percent.toFixed(1)}%`);
        },
        (error) => {
          console.error('模型加载失败:', error);
          reject(new Error(`模型加载失败: ${error.message}`));
        }
      );
    });
  }

  /**
   * 设置模型属性
   */
  private setupModelProperties(car: THREE.Group): void {
    car.traverse((child) => {
      if (child.type === 'Mesh') {
        const mesh = child as THREE.Mesh;
        mesh.castShadow = true;
        mesh.receiveShadow = false; // 车辆不接收阴影，保持亮度
      }
    });
  }

  /**
   * 获取默认模型配置
   */
  public static getDefaultModelConfig(): ModelConfig {
    return {
      path: '/car-assets/models/Car.glb',
      scale: [1, 1, 1],
      position: [0, -0.5, 0]
    };
  }

  /**
   * 清理资源
   */
  public dispose(): void {
    // GLTFLoader 不需要特殊清理
    console.log('ModelLoader资源已清理');
  }
}
