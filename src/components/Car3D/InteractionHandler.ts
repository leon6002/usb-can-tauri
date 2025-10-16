/**
 * 交互处理器 - 处理鼠标交互、3D按钮点击等用户交互
 */
import * as THREE from "three";
import { IInteractionHandler, DoorButtons } from "./types";

export class InteractionHandler implements IInteractionHandler {
  public raycaster = new THREE.Raycaster();
  public mouse = new THREE.Vector2();
  public clickableObjects: THREE.Object3D[] = [];
  public doorButtons: DoorButtons = {
    leftDoor: null,
    rightDoor: null,
  };

  // 门状态跟踪 (false = 关闭, true = 开启)
  private doorStates = {
    left: false,
    right: false,
  };

  private container: HTMLElement;
  private camera: THREE.PerspectiveCamera;
  private onClickBound: (event: MouseEvent) => void;
  private onMouseMoveBound: (event: MouseEvent) => void;
  private onSendCommand?: (commandId: string) => void;

  constructor(
    container: HTMLElement,
    camera: THREE.PerspectiveCamera,
    _scene: THREE.Scene,
    onSendCommand?: (commandId: string) => void
  ) {
    this.container = container;
    this.camera = camera;
    this.onSendCommand = onSendCommand;

    this.onClickBound = this.onClick.bind(this);
    this.onMouseMoveBound = this.onMouseMove.bind(this);
  }

  /**
   * 设置点击事件处理器
   */
  public setupClickHandlers(container: HTMLElement): void {
    container.addEventListener("click", this.onClickBound);
    container.addEventListener("mousemove", this.onMouseMoveBound);

    console.log("✅ 交互事件处理器初始化完成");
  }

  /**
   * 创建3D门按钮
   */
  public create3DDoorButtons(car: THREE.Group): void {
    console.log("🔍 开始创建3D门按钮...");

    // 创建左门按钮
    this.createDoorButton("left", car);

    // 创建右门按钮
    this.createDoorButton("right", car);

    console.log(
      "✅ 3D门按钮创建完成，总共可点击对象:",
      this.clickableObjects.length
    );
  }

  /**
   * 创建单个门按钮
   */
  private createDoorButton(side: "left" | "right", car: THREE.Group): void {
    // 查找对应的车门对象
    const doorName = side === "left" ? "Object_347" : "Object_401";
    const doorObject = this.findDoorByName(car, doorName);

    if (!doorObject) {
      console.warn(`⚠️ 未找到${side}门对象: ${doorName}`);
      return;
    }

    // 创建按钮几何体
    const buttonGroup = this.createButtonGeometry();

    // 调整按钮位置到门把手附近
    if (side === "left") {
      // 左门按钮位置 - 门把手附近
      buttonGroup.position.set(-0.2, -1.1, 0.2); // 相对于门的位置
      buttonGroup.rotation.y = Math.PI / 2; // 面向外侧
    } else {
      // 右门按钮位置 - 门把手附近
      buttonGroup.position.set(0.2, -1.2, 0); // 相对于门的位置
      buttonGroup.rotation.y = -Math.PI / 2; // 面向外侧
    }

    // 添加按钮标识
    buttonGroup.userData = {
      type: "doorButton",
      door: side,
      originalOpacity: { outer: 0.8, inner: 0.3 },
      hoverOpacity: { outer: 1.0, inner: 0.5 },
      clickOpacity: { outer: 0.6, inner: 0.2 },
    };

    // 将按钮附加到车门对象上
    doorObject.add(buttonGroup);

    // 保存按钮引用
    this.doorButtons[`${side}Door` as keyof DoorButtons] = buttonGroup;
    this.clickableObjects.push(buttonGroup);

    // 创建按钮文字标签
    // this.createButtonLabel(buttonGroup, side === "left" ? "左门" : "右门");

    console.log(`✓ ${side}门按钮已创建并附加到: ${doorName}`);
    console.log(`按钮位置:`, buttonGroup.position);
    console.log(`按钮缩放:`, buttonGroup.scale);
    console.log(`门对象位置:`, doorObject.position);
    console.log(`门对象子对象数量:`, doorObject.children.length);
  }

  /**
   * 创建按钮几何体
   */
  private createButtonGeometry(): THREE.Group {
    // 创建科技感的白色半透明圆环按钮
    const outerGeometry = new THREE.RingGeometry(0.08, 0.1, 32);
    const innerGeometry = new THREE.CircleGeometry(0.06, 32);

    // 外圆环材质 - 白色半透明，双面可见
    const outerMaterial = new THREE.MeshStandardMaterial({
      color: 0xffffff,
      transparent: true,
      opacity: 0.8,
      emissive: 0x222222,
      metalness: 0.1,
      roughness: 0.8,
      side: THREE.DoubleSide, // 双面渲染
    });

    // 内圆材质 - 更透明的白色，双面可见
    const innerMaterial = new THREE.MeshStandardMaterial({
      color: 0xffffff,
      transparent: true,
      opacity: 0.5,
      emissive: 0x111111,
      metalness: 0.1,
      roughness: 0.8,
      side: THREE.DoubleSide, // 双面渲染
    });

    const outerRing = new THREE.Mesh(outerGeometry, outerMaterial);
    const innerCircle = new THREE.Mesh(innerGeometry, innerMaterial);

    // 创建按钮组
    const buttonGroup = new THREE.Group();
    buttonGroup.add(outerRing);
    buttonGroup.add(innerCircle);

    return buttonGroup;
  }

  /**
   * 根据名称查找车门对象
   */
  private findDoorByName(
    car: THREE.Group,
    doorName: string
  ): THREE.Object3D | null {
    let foundDoor: THREE.Object3D | null = null;

    console.log(`🔍 查找车门对象: ${doorName}`);

    car.traverse((child) => {
      if (child.name === doorName) {
        foundDoor = child;
        console.log(`✓ 找到车门对象: ${doorName}`, child);
      }
    });

    if (!foundDoor) {
      console.log(`❌ 未找到车门对象: ${doorName}`);
      // 列出所有可用的对象名称
      const allNames: string[] = [];
      car.traverse((child) => {
        if (child.name) {
          allNames.push(child.name);
        }
      });
      console.log("可用的对象名称:", allNames.slice(0, 20)); // 只显示前20个
    }

    return foundDoor;
  }

  /**
   * 从点击的对象找到对应的按钮组
   */
  private findButtonGroup(
    clickedObject: THREE.Object3D
  ): THREE.Object3D | null {
    let current = clickedObject;

    // 向上遍历父对象，找到带有doorButton标识的对象
    while (current) {
      if (current.userData && current.userData.type === "doorButton") {
        return current;
      }
      current = current.parent as THREE.Object3D;
    }

    return null;
  }

  /**
   * 鼠标点击事件处理
   */
  private onClick(event: MouseEvent): void {
    console.log("🖱️ 鼠标点击事件触发");
    this.updateMousePosition(event);

    // 射线检测 - 递归检测子对象
    this.raycaster.setFromCamera(this.mouse, this.camera);
    const intersects = this.raycaster.intersectObjects(
      this.clickableObjects,
      true
    );

    console.log(`🎯 射线检测结果: ${intersects.length} 个交点`);
    console.log("可点击对象数量:", this.clickableObjects.length);

    if (intersects.length > 0) {
      const clickedObject = intersects[0].object;
      console.log("点击的对象:", clickedObject);

      // 找到按钮组对象
      const buttonGroup = this.findButtonGroup(clickedObject);
      if (buttonGroup) {
        console.log("找到按钮组:", buttonGroup.userData);
        this.handleObjectClick(buttonGroup);
      } else {
        console.log("未找到按钮组");
      }
    } else {
      console.log("没有点击到任何对象");
    }
  }

  /**
   * 鼠标移动事件处理
   */
  private onMouseMove(event: MouseEvent): void {
    this.updateMousePosition(event);

    // 射线检测 - 递归检测子对象
    this.raycaster.setFromCamera(this.mouse, this.camera);
    const intersects = this.raycaster.intersectObjects(
      this.clickableObjects,
      true
    );

    // 重置所有按钮透明度
    this.resetButtonOpacities();

    if (intersects.length > 0) {
      const hoveredObject = intersects[0].object;
      // 找到按钮组对象
      const buttonGroup = this.findButtonGroup(hoveredObject);
      if (buttonGroup) {
        this.handleObjectHover(buttonGroup);
      }
    }

    // 更新鼠标样式
    this.container.style.cursor = intersects.length > 0 ? "pointer" : "default";
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

    if (userData.type === "doorButton") {
      this.handleDoorButtonClick(userData.door);
      this.animateButtonClick(object);
    }
  }

  /**
   * 处理对象悬停
   */
  private handleObjectHover(object: THREE.Object3D): void {
    const userData = object.userData;

    if (userData.type === "doorButton") {
      this.setButtonOpacity(object, userData.hoverOpacity);
    }
  }

  /**
   * 处理门按钮点击
   */
  private handleDoorButtonClick(door: "left" | "right"): void {
    console.log(`点击了${door === "left" ? "左" : "右"}门按钮`);

    // 获取当前门状态（两个门状态相同）
    const currentState = this.doorStates[door];
    const newState = !currentState;

    // 根据当前状态决定发送开门还是关门命令
    if (this.onSendCommand) {
      let commandId: string;
      if (currentState) {
        // 当前是开启状态，点击后关闭 - 两个门一起关闭
        commandId = "door_close";
      } else {
        // 当前是关闭状态，点击后开启 - 两个门一起开启
        commandId = "door_open";
      }

      console.log(
        `🚗 门当前状态: ${
          currentState ? "开启" : "关闭"
        }, 发送CAN命令: ${commandId}`
      );
      this.onSendCommand(commandId);

      // 更新两个门的状态
      this.doorStates.left = newState;
      this.doorStates.right = newState;
      console.log(`🚗 两个门状态更新为: ${newState ? "开启" : "关闭"}`);
    }

    // 同时触发自定义事件用于3D动画 - 两个门都要动画
    const eventLeft = new CustomEvent("doorButtonClick", {
      detail: { door: "left", isOpening: !currentState },
    });
    const eventRight = new CustomEvent("doorButtonClick", {
      detail: { door: "right", isOpening: !currentState },
    });
    document.dispatchEvent(eventLeft);
    document.dispatchEvent(eventRight);
  }

  /**
   * 重置门状态（用于外部同步）
   */
  public resetDoorStates(): void {
    this.doorStates.left = false;
    this.doorStates.right = false;
    console.log("🚗 门状态已重置为关闭状态");
  }

  /**
   * 获取门状态
   */
  public getDoorState(door: "left" | "right"): boolean {
    return this.doorStates[door];
  }

  /**
   * 设置门状态
   */
  public setDoorState(door: "left" | "right", isOpen: boolean): void {
    this.doorStates[door] = isOpen;
    console.log(`🚗 ${door}门状态设置为: ${isOpen ? "开启" : "关闭"}`);
  }

  /**
   * 设置门按钮可见性
   */
  public setDoorButtonsVisible(visible: boolean): void {
    if (this.doorButtons.leftDoor) {
      this.doorButtons.leftDoor.visible = visible;
    }
    if (this.doorButtons.rightDoor) {
      this.doorButtons.rightDoor.visible = visible;
    }
    console.log(`🚪 门按钮可见性设置为: ${visible ? "可见" : "隐藏"}`);
  }

  /**
   * 按钮点击动画
   */
  private animateButtonClick(button: THREE.Object3D): void {
    const userData = button.userData;
    const originalScale = button.scale.clone();

    // 点击效果：透明度变化和缩放
    this.setButtonOpacity(button, userData.clickOpacity);
    button.scale.multiplyScalar(0.9);

    setTimeout(() => {
      this.setButtonOpacity(button, userData.originalOpacity);
      button.scale.copy(originalScale);
    }, 150);
  }

  /**
   * 设置按钮透明度
   */
  private setButtonOpacity(
    button: THREE.Object3D,
    opacities: { outer: number; inner: number }
  ): void {
    if (button.type === "Group") {
      const group = button as THREE.Group;
      const outerRing = group.children[0] as THREE.Mesh;
      const innerCircle = group.children[1] as THREE.Mesh;

      if (outerRing && outerRing.material) {
        const outerMaterial = outerRing.material as THREE.MeshStandardMaterial;
        outerMaterial.opacity = opacities.outer;
      }

      if (innerCircle && innerCircle.material) {
        const innerMaterial =
          innerCircle.material as THREE.MeshStandardMaterial;
        innerMaterial.opacity = opacities.inner;
      }
    }
  }

  /**
   * 重置所有按钮透明度
   */
  private resetButtonOpacities(): void {
    this.clickableObjects.forEach((obj) => {
      const userData = obj.userData;
      if (userData.type === "doorButton") {
        this.setButtonOpacity(obj, userData.originalOpacity);
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
    this.container.removeEventListener("click", this.onClickBound);
    this.container.removeEventListener("mousemove", this.onMouseMoveBound);

    // 清理3D按钮
    Object.values(this.doorButtons).forEach((button) => {
      if (button && button.parent) {
        button.parent.remove(button);
      }
    });

    this.doorButtons = {
      leftDoor: null,
      rightDoor: null,
    };
    this.clickableObjects = [];

    // 重置鼠标样式
    this.container.style.cursor = "default";

    console.log("InteractionHandler资源已清理");
  }
}
