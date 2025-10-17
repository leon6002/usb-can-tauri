/**
 * 车辆组件管理器 - 管理车辆的各个组件：门、轮子、灯光等
 */
import * as THREE from "three";
import {
  ICarComponents,
  WheelObjects,
  LightObjects,
  DoorStates,
} from "./types";

export class CarComponents implements ICarComponents {
  // 轮子对象
  public wheels: WheelObjects = {
    frontLeft: null,
    frontRight: null,
    rearLeft: null,
    rearRight: null,
  };

  // 转向轴（用于分离转向和滚动旋转）
  public steeringAxes: {
    frontLeft: THREE.Group | null;
    frontRight: THREE.Group | null;
  } = {
    frontLeft: null,
    frontRight: null,
  };

  // 车灯对象
  public lights: LightObjects = {
    headlights: [],
    taillights: [],
    turnSignals: [],
  };

  // 门状态（只用于跟踪状态，不需要门对象）
  public doorStates: DoorStates = {
    leftDoor: 0, // 0: 关闭, 1: 开启
    rightDoor: 0,
  };

  // 方向盘对象
  public steering: {
    wheel: THREE.Object3D | null;
    frontLeftWheel: THREE.Object3D | null;
    frontRightWheel: THREE.Object3D | null;
    carBody: THREE.Object3D | null; // 车身引用
    currentRotation: number; // 当前转向角度（弧度）
  } = {
    wheel: null,
    frontLeftWheel: null,
    frontRightWheel: null,
    carBody: null,
    currentRotation: 0,
  };

  /**
   * 初始化车辆组件
   */
  public initializeComponents(car: THREE.Group): void {
    console.log("🔍 开始初始化车辆组件...");

    // 保存车身引用
    this.steering.carBody = car;
    console.log("✓ 车身引用已保存");

    // 定义确切的轮子名称
    const wheelNames = {
      frontLeft: "Front_Left_Wheel_36_66",
      frontRight: "Front_Right_Wheel_44_81",
      rearLeft: "Rear_Left_Wheel_28_51",
      rearRight: "Rear_Right_Wheel_52_96",
    };

    car.traverse((child) => {
      if (child.name) {
        // 识别车灯对象
        this.identifyLights(child);

        // 直接通过名称查找轮子对象
        if (child.name === wheelNames.frontLeft) {
          this.wheels.frontLeft = child;
          console.log("✓ 找到前左轮:", child.name);
        } else if (child.name === wheelNames.frontRight) {
          this.wheels.frontRight = child;
          console.log("✓ 找到前右轮:", child.name);
        } else if (child.name === wheelNames.rearLeft) {
          this.wheels.rearLeft = child;
          console.log("✓ 找到后左轮:", child.name);
        } else if (child.name === wheelNames.rearRight) {
          this.wheels.rearRight = child;
          console.log("✓ 找到后右轮:", child.name);
        }
      }
    });

    // 为前轮创建转向轴层次结构（分离转向和滚动旋转）
    this.createSteeringAxisHierarchy();

    // 保存前轮引用用于转向控制
    this.steering.frontLeftWheel = this.wheels.frontLeft;
    this.steering.frontRightWheel = this.wheels.frontRight;

    console.log("✓ 前轮引用已保存，用于UI方向盘控制");

    console.log("✅ 车辆组件初始化完成");
    console.log("🎯 找到的轮子:", {
      frontLeft: this.wheels.frontLeft?.name || "null",
      frontRight: this.wheels.frontRight?.name || "null",
      rearLeft: this.wheels.rearLeft?.name || "null",
      rearRight: this.wheels.rearRight?.name || "null",
    });
    console.log("灯光数量:", Object.keys(this.lights).length);
    console.log("门动画将使用预制动画: DoorFLOpen, DoorFROpen");
  }

  /**
   * 为前轮创建转向轴层次结构
   * 这样可以分离转向旋转（绕Y轴）和滚动旋转（绕X轴），避免万向节锁
   */
  private createSteeringAxisHierarchy(): void {
    if (!this.wheels.frontLeft || !this.wheels.frontRight) {
      console.warn("⚠️ 前轮未找到，无法创建转向轴");
      return;
    }

    // 为前左轮创建转向轴
    const frontLeftAxis = new THREE.Group();
    frontLeftAxis.name = "FrontLeftSteeringAxis";

    // 保存轮子的原始父对象和位置
    const frontLeftParent = this.wheels.frontLeft.parent;
    const frontLeftPosition = this.wheels.frontLeft.position.clone();
    const frontLeftRotation = this.wheels.frontLeft.rotation.clone();

    // 将轮子从原父对象中移除
    if (frontLeftParent) {
      frontLeftParent.remove(this.wheels.frontLeft);
    }

    // 重置轮子的位置和旋转（相对于转向轴）
    this.wheels.frontLeft.position.set(0, 0, 0);
    this.wheels.frontLeft.rotation.set(0, 0, 0);

    // 将轮子添加到转向轴
    frontLeftAxis.add(this.wheels.frontLeft);

    // 将转向轴放置到原始位置
    frontLeftAxis.position.copy(frontLeftPosition);
    frontLeftAxis.rotation.copy(frontLeftRotation);

    // 将转向轴添加回原父对象
    if (frontLeftParent) {
      frontLeftParent.add(frontLeftAxis);
    }

    this.steeringAxes.frontLeft = frontLeftAxis;
    console.log("✓ 前左轮转向轴已创建");

    // 为前右轮创建转向轴
    const frontRightAxis = new THREE.Group();
    frontRightAxis.name = "FrontRightSteeringAxis";

    const frontRightParent = this.wheels.frontRight.parent;
    const frontRightPosition = this.wheels.frontRight.position.clone();
    const frontRightRotation = this.wheels.frontRight.rotation.clone();

    if (frontRightParent) {
      frontRightParent.remove(this.wheels.frontRight);
    }

    this.wheels.frontRight.position.set(0, 0, 0);
    this.wheels.frontRight.rotation.set(0, 0, 0);

    frontRightAxis.add(this.wheels.frontRight);
    frontRightAxis.position.copy(frontRightPosition);
    frontRightAxis.rotation.copy(frontRightRotation);

    if (frontRightParent) {
      frontRightParent.add(frontRightAxis);
    }

    this.steeringAxes.frontRight = frontRightAxis;
    console.log("✓ 前右轮转向轴已创建");
  }

  /**
   * 切换门状态
   */
  public toggleDoor(door: "left" | "right"): void {
    const currentState = this.doorStates[`${door}Door` as keyof DoorStates];
    const newState = currentState === 0 ? 1 : 0;

    // 触发门动画事件，让AnimationController处理
    const animationName = door === "left" ? "DoorFLOpen" : "DoorFROpen";
    const event = new CustomEvent("playDoorAnimation", {
      detail: {
        animationName,
        reverse: newState === 0, // 如果新状态是关闭，则反向播放动画
      },
    });
    document.dispatchEvent(event);

    this.doorStates[`${door}Door` as keyof DoorStates] = newState;

    console.log(
      `${door}门状态切换为: ${
        newState === 0 ? "关闭" : "开启"
      }, 动画: ${animationName}`
    );
  }

  /**
   * 识别车灯对象
   */
  private identifyLights(child: THREE.Object3D): void {
    const childNameLower = child.name.toLowerCase();

    // 识别前大灯
    if (
      childNameLower.includes("headlight") ||
      childNameLower.includes("front_light")
    ) {
      this.lights.headlights.push(child);
      console.log("✓ 找到前大灯:", child.name);
    }

    // 识别尾灯
    if (
      childNameLower.includes("taillight") ||
      childNameLower.includes("rear_light") ||
      childNameLower.includes("brake_light")
    ) {
      this.lights.taillights.push(child);
      console.log("✓ 找到尾灯:", child.name);
    }

    // 识别转向灯
    if (
      childNameLower.includes("turn_signal") ||
      childNameLower.includes("indicator")
    ) {
      this.lights.turnSignals.push(child);
      console.log("✓ 找到转向灯:", child.name);
    }
  }

  /**
   * 清理资源
   */
  public dispose(): void {
    this.wheels = {
      frontLeft: null,
      frontRight: null,
      rearLeft: null,
      rearRight: null,
    };
    this.lights = {
      headlights: [],
      taillights: [],
      turnSignals: [],
    };
    this.steering = {
      wheel: null,
      frontLeftWheel: null,
      frontRightWheel: null,
      carBody: null,
      currentRotation: 0,
    };

    console.log("CarComponents资源已清理");
  }
}
