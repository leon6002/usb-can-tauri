/**
 * 交互处理器 - 处理鼠标交互、3D按钮点击等用户交互
 */
import * as THREE from 'three';
import { IInteractionHandler, DoorButtons } from './types';

export class InteractionHandler implements IInteractionHandler {
  public raycaster = new THREE.Raycaster();
  public mouse = new THREE.Vector2();
  public clickableObjects: THREE.Object3D[] = [];
  public doorButtons: DoorButtons = {
    leftDoor: null,
    rightDoor: null
  };

  private container: HTMLElement;
  private camera: THREE.PerspectiveCamera;
  private scene: THREE.Scene;
  private onClickBound: (event: MouseEvent) => void;
  private onMouseMoveBound: (event: MouseEvent) => void;

  constructor(container: HTMLElement, camera: THREE.PerspectiveCamera, scene: THREE.Scene) {
    this.container = container;
    this.camera = camera;
    this.scene = scene;
    
    this.onClickBound = this.onClick.bind(this);
    this.onMouseMoveBound = this.onMouseMove.bind(this);
  }

  /**
   * 设置点击事件处理器
   */
  public setupClickHandlers(container: HTMLElement): void {
    container.addEventListener('click', this.onClickBound);
    container.addEventListener('mousemove', this.onMouseMoveBound);
    
    console.log('✅ 交互事件处理器初始化完成');
  }

  /**
   * 创建3D门按钮
   */
  public create3DDoorButtons(car: THREE.Group): void {
    // 创建左门按钮
    this.createDoorButton('left', car);
    
    // 创建右门按钮
    this.createDoorButton('right', car);
    
    console.log('✅ 3D门按钮创建完成');
  }

  /**
   * 创建单个门按钮
   */
  private createDoorButton(side: 'left' | 'right', car: THREE.Group): void {
    // 按钮几何体
    const geometry = new THREE.SphereGeometry(0.15, 16, 16);
    const material = new THREE.MeshStandardMaterial({
      color: 0x4CAF50,
      emissive: 0x004400,
      metalness: 0.3,
      roughness: 0.4
    });
    
    const button = new THREE.Mesh(geometry, material);
    
    // 设置按钮位置
    const x = side === 'left' ? -2 : 2;
    button.position.set(x, 1.5, 1);
    
    // 添加按钮标识
    button.userData = {
      type: 'doorButton',
      door: side,
      originalColor: 0x4CAF50,
      hoverColor: 0x66BB6A,
      clickColor: 0x388E3C
    };
    
    // 添加到场景
    this.scene.add(button);
    
    // 保存按钮引用
    this.doorButtons[`${side}Door` as keyof DoorButtons] = button;
    this.clickableObjects.push(button);
    
    // 创建按钮文字标签
    this.createButtonLabel(button, side === 'left' ? '左门' : '右门');
  }

  /**
   * 创建按钮文字标签
   */
  private createButtonLabel(button: THREE.Object3D, text: string): void {
    // 创建文字纹理
    const canvas = document.createElement('canvas');
    const context = canvas.getContext('2d')!;
    canvas.width = 128;
    canvas.height = 64;
    
    context.fillStyle = 'rgba(255, 255, 255, 0.8)';
    context.fillRect(0, 0, canvas.width, canvas.height);
    
    context.fillStyle = '#333333';
    context.font = '20px Arial';
    context.textAlign = 'center';
    context.textBaseline = 'middle';
    context.fillText(text, canvas.width / 2, canvas.height / 2);
    
    // 创建文字精灵
    const texture = new THREE.CanvasTexture(canvas);
    const spriteMaterial = new THREE.SpriteMaterial({ map: texture });
    const sprite = new THREE.Sprite(spriteMaterial);
    
    sprite.scale.set(1, 0.5, 1);
    sprite.position.set(0, 0.5, 0);
    
    button.add(sprite);
  }

  /**
   * 鼠标点击事件处理
   */
  private onClick(event: MouseEvent): void {
    this.updateMousePosition(event);
    
    // 射线检测
    this.raycaster.setFromCamera(this.mouse, this.camera);
    const intersects = this.raycaster.intersectObjects(this.clickableObjects);
    
    if (intersects.length > 0) {
      const clickedObject = intersects[0].object;
      this.handleObjectClick(clickedObject);
    }
  }

  /**
   * 鼠标移动事件处理
   */
  private onMouseMove(event: MouseEvent): void {
    this.updateMousePosition(event);
    
    // 射线检测
    this.raycaster.setFromCamera(this.mouse, this.camera);
    const intersects = this.raycaster.intersectObjects(this.clickableObjects);
    
    // 重置所有按钮颜色
    this.resetButtonColors();
    
    if (intersects.length > 0) {
      const hoveredObject = intersects[0].object;
      this.handleObjectHover(hoveredObject);
    }
    
    // 更新鼠标样式
    this.container.style.cursor = intersects.length > 0 ? 'pointer' : 'default';
  }

  /**
   * 更新鼠标位置
   */
  private updateMousePosition(event: MouseEvent): void {
    const rect = this.container.getBoundingClientRect();
    this.mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
    this.mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
  }

  /**
   * 处理对象点击
   */
  private handleObjectClick(object: THREE.Object3D): void {
    const userData = object.userData;
    
    if (userData.type === 'doorButton') {
      this.handleDoorButtonClick(userData.door);
      this.animateButtonClick(object);
    }
  }

  /**
   * 处理对象悬停
   */
  private handleObjectHover(object: THREE.Object3D): void {
    const userData = object.userData;
    
    if (userData.type === 'doorButton') {
      this.setButtonColor(object, userData.hoverColor);
    }
  }

  /**
   * 处理门按钮点击
   */
  private handleDoorButtonClick(door: 'left' | 'right'): void {
    console.log(`点击了${door === 'left' ? '左' : '右'}门按钮`);
    
    // 触发自定义事件
    const event = new CustomEvent('doorButtonClick', {
      detail: { door }
    });
    document.dispatchEvent(event);
  }

  /**
   * 按钮点击动画
   */
  private animateButtonClick(button: THREE.Object3D): void {
    const userData = button.userData;
    const originalScale = button.scale.clone();
    
    // 点击效果：颜色变化和缩放
    this.setButtonColor(button, userData.clickColor);
    button.scale.multiplyScalar(0.9);
    
    setTimeout(() => {
      this.setButtonColor(button, userData.originalColor);
      button.scale.copy(originalScale);
    }, 150);
  }

  /**
   * 设置按钮颜色
   */
  private setButtonColor(button: THREE.Object3D, color: number): void {
    if (button.type === 'Mesh') {
      const mesh = button as THREE.Mesh;
      const material = mesh.material as THREE.MeshStandardMaterial;
      material.color.setHex(color);
    }
  }

  /**
   * 重置所有按钮颜色
   */
  private resetButtonColors(): void {
    this.clickableObjects.forEach(obj => {
      const userData = obj.userData;
      if (userData.type === 'doorButton') {
        this.setButtonColor(obj, userData.originalColor);
      }
    });
  }

  /**
   * 添加可点击对象
   */
  public addClickableObject(object: THREE.Object3D): void {
    this.clickableObjects.push(object);
  }

  /**
   * 移除可点击对象
   */
  public removeClickableObject(object: THREE.Object3D): void {
    const index = this.clickableObjects.indexOf(object);
    if (index > -1) {
      this.clickableObjects.splice(index, 1);
    }
  }

  /**
   * 清理资源
   */
  public dispose(): void {
    // 移除事件监听器
    this.container.removeEventListener('click', this.onClickBound);
    this.container.removeEventListener('mousemove', this.onMouseMoveBound);
    
    // 清理3D按钮
    Object.values(this.doorButtons).forEach(button => {
      if (button && button.parent) {
        button.parent.remove(button);
      }
    });
    
    this.doorButtons = {
      leftDoor: null,
      rightDoor: null
    };
    this.clickableObjects = [];
    
    // 重置鼠标样式
    this.container.style.cursor = 'default';
    
    console.log('InteractionHandler资源已清理');
  }
}
