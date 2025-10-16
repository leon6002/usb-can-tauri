/**
 * Car3D模块的TypeScript类型定义
 */
import * as THREE from "three";

// 门状态类型
export interface DoorStates {
  leftDoor: number; // 0: 关闭, 1: 开启
  rightDoor: number;
}

// 轮子对象类型
export interface WheelObjects {
  frontLeft: THREE.Object3D | null;
  frontRight: THREE.Object3D | null;
  rearLeft: THREE.Object3D | null;
  rearRight: THREE.Object3D | null;
}

// 车灯对象类型
export interface LightObjects {
  headlights: THREE.Object3D[];
  taillights: THREE.Object3D[];
  turnSignals: THREE.Object3D[];
}

// 轮子旋转状态类型
export interface WheelRotationState {
  isRotating: boolean;
  speed: number;
  direction: number; // 1: 前进, -1: 后退
}

// 道路移动状态类型
export interface RoadMovementState {
  isMoving: boolean;
  speed: number;
  objects: THREE.Object3D[];
}

// 运镜动画类型
export type CameraAnimationMode =
  | "orbit"
  | "showcase"
  | "cinematic"
  | "follow"
  | "driving"
  | "side";

// 运镜动画状态类型
export interface CameraAnimationState {
  isActive: boolean;
  mode: CameraAnimationMode;
  startTime: number;
  duration: number;
  originalPosition: THREE.Vector3 | null;
  originalTarget: THREE.Vector3 | null;
  keyframes: any[];
  currentKeyframe: number;
}

// 3D按钮系统类型
export interface DoorButtons {
  leftDoor: THREE.Object3D | null;
  rightDoor: THREE.Object3D | null;
}

// 场景配置类型
export interface SceneConfig {
  backgroundColor: number;
  fogColor: number;
  fogNear: number;
  fogFar: number;
}

// 相机配置类型
export interface CameraConfig {
  fov: number;
  near: number;
  far: number;
  position: [number, number, number];
  lookAt: [number, number, number];
}

// 渲染器配置类型
export interface RendererConfig {
  antialias: boolean;
  shadowMapEnabled: boolean;
  shadowMapType: THREE.ShadowMapType;
  outputColorSpace: THREE.ColorSpace;
  toneMapping: THREE.ToneMapping;
  toneMappingExposure: number;
}

// 模型加载配置类型
export interface ModelConfig {
  path: string;
  scale: [number, number, number];
  position: [number, number, number];
}

// 事件类型
export interface Car3DEvents {
  modelLoaded: CustomEvent;
  doorToggled: CustomEvent<{ door: "left" | "right"; state: number }>;
  animationStarted: CustomEvent<{ type: string }>;
  animationStopped: CustomEvent<{ type: string }>;
}

// 组件接口
export interface ISceneManager {
  scene: THREE.Scene;
  camera: THREE.PerspectiveCamera;
  renderer: THREE.WebGLRenderer;
  container: HTMLElement;

  createScene(config: SceneConfig): void;
  createCamera(config: CameraConfig): void;
  createRenderer(config: RendererConfig): void;
  createLights(): void;
  onWindowResize(): void;
  dispose(): void;
}

export interface IModelLoader {
  loadModel(config: ModelConfig): Promise<THREE.Group>;
  dispose(): void;
}

export interface ICarComponents {
  wheels: WheelObjects;
  lights: LightObjects;
  doorStates: DoorStates;

  initializeComponents(car: THREE.Group): void;
  toggleDoor(door: "left" | "right"): void;
  dispose(): void;
}

export interface IAnimationController {
  mixer: THREE.AnimationMixer | null;
  doorAnimations: { [key: string]: any };
  wheelRotation: WheelRotationState;
  roadMovement: RoadMovementState;

  update(delta: number): void;
  startWheelRotation(speed: number, direction: number): void;
  stopWheelRotation(): void;
  startRoadMovement(speed: number): void;
  stopRoadMovement(): void;
  dispose(): void;
}

export interface ICameraController {
  controls: any | null;
  animationState: CameraAnimationState;

  setupControls(camera: THREE.PerspectiveCamera, domElement: HTMLElement): void;
  startAnimation(
    mode: CameraAnimationMode,
    duration: number,
    keepFinalPosition?: boolean
  ): void;
  stopAnimation(): void;
  update(delta: number): void;
  dispose(): void;
}

export interface IInteractionHandler {
  raycaster: THREE.Raycaster;
  mouse: THREE.Vector2;
  clickableObjects: THREE.Object3D[];
  doorButtons: DoorButtons;

  setupClickHandlers(container: HTMLElement): void;
  create3DDoorButtons(car: THREE.Group): void;
  setDoorButtonsVisible(visible: boolean): void;
  dispose(): void;
}
