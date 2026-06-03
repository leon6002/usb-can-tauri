/**
 * R3F 车辆组件管理器 - 管理车辆的各个组件：门、轮子、灯光等
 */
import * as THREE from "three";
import {
  ICarComponents,
  WheelObjects,
  LightObjects,
  DoorStates,
} from "../types";

export class CarComponentsR3F implements ICarComponents {
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

  // 悬挂对象（连接转向轴和轮子之间的悬挂部分）
  public suspensions: {
    frontLeft: THREE.Object3D | null;
    frontRight: THREE.Object3D | null;
    rearLeft: THREE.Object3D | null;
    rearRight: THREE.Object3D | null;
  } = {
    frontLeft: null,
    frontRight: null,
    rearLeft: null,
    rearRight: null,
  };

  /**
   * 初始化车辆组件
   */
  public initializeComponents(car: THREE.Group): void {
    console.log("🔍 [R3F] 开始初始化车辆组件...");

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
          // console.log("✓ 找到前左轮:", child.name);
        } else if (child.name === wheelNames.frontRight) {
          this.wheels.frontRight = child;
          // console.log("✓ 找到前右轮:", child.name);
        } else if (child.name === wheelNames.rearLeft) {
          this.wheels.rearLeft = child;
          // console.log("✓ 找到后左轮:", child.name);
        } else if (child.name === wheelNames.rearRight) {
          this.wheels.rearRight = child;
          // console.log("✓ 找到后右轮:", child.name);
        }
      }
    });

    // 为前轮创建转向轴层次结构（分离转向和滚动旋转）
    this.createSteeringAxisHierarchy();

    // 创建悬挂对象（如果模型中没有，则创建虚拟悬挂）
    this.createSuspensionObjects();

    console.log("✅ [R3F] 车辆组件初始化完成");
    console.log("🎯 找到的轮子:", {
      frontLeft: this.wheels.frontLeft?.name || "null",
      frontRight: this.wheels.frontRight?.name || "null",
      rearLeft: this.wheels.rearLeft?.name || "null",
      rearRight: this.wheels.rearRight?.name || "null",
    });
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

    const frontLeftParent = this.wheels.frontLeft.parent;
    const frontLeftPosition = this.wheels.frontLeft.position.clone();
    const frontLeftRotation = this.wheels.frontLeft.rotation.clone();

    if (frontLeftParent) {
      frontLeftParent.remove(this.wheels.frontLeft);
    }

    this.wheels.frontLeft.position.set(0, 0, 0);
    this.wheels.frontLeft.rotation.set(0, 0, 0);
    frontLeftAxis.add(this.wheels.frontLeft);

    const frontLeftSuspension = new THREE.Group();
    frontLeftSuspension.name = "FrontLeftSuspension";
    frontLeftSuspension.position.copy(frontLeftPosition);
    frontLeftSuspension.add(frontLeftAxis);

    frontLeftAxis.position.set(0, 0, 0);
    frontLeftAxis.rotation.copy(frontLeftRotation);

    if (frontLeftParent) {
      frontLeftParent.add(frontLeftSuspension);
    }

    this.steeringAxes.frontLeft = frontLeftAxis;
    this.suspensions.frontLeft = frontLeftSuspension;
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

    const frontRightSuspension = new THREE.Group();
    frontRightSuspension.name = "FrontRightSuspension";
    frontRightSuspension.position.copy(frontRightPosition);
    frontRightSuspension.add(frontRightAxis);

    frontRightAxis.position.set(0, 0, 0);
    frontRightAxis.rotation.copy(frontRightRotation);

    if (frontRightParent) {
      frontRightParent.add(frontRightSuspension);
    }

    this.steeringAxes.frontRight = frontRightAxis;
    this.suspensions.frontRight = frontRightSuspension;
    console.log("✓ 前右轮转向轴已创建");
  }

  /**
   * 创建悬挂对象
   */
  private createSuspensionObjects(): void {
    // 为后轮创建悬挂对象
    if (this.wheels.rearLeft && !this.suspensions.rearLeft) {
      const rearLeftSuspension = new THREE.Group();
      rearLeftSuspension.name = "RearLeftSuspension";

      const rearLeftParent = this.wheels.rearLeft.parent;
      const rearLeftPosition = this.wheels.rearLeft.position.clone();

      if (rearLeftParent) {
        rearLeftParent.remove(this.wheels.rearLeft);
      }

      this.wheels.rearLeft.position.set(0, 0, 0);
      rearLeftSuspension.add(this.wheels.rearLeft);
      rearLeftSuspension.position.copy(rearLeftPosition);

      if (rearLeftParent) {
        rearLeftParent.add(rearLeftSuspension);
      }

      this.suspensions.rearLeft = rearLeftSuspension;
      console.log("✓ 后左悬挂已创建");
    }

    if (this.wheels.rearRight && !this.suspensions.rearRight) {
      const rearRightSuspension = new THREE.Group();
      rearRightSuspension.name = "RearRightSuspension";

      const rearRightParent = this.wheels.rearRight.parent;
      const rearRightPosition = this.wheels.rearRight.position.clone();

      if (rearRightParent) {
        rearRightParent.remove(this.wheels.rearRight);
      }

      this.wheels.rearRight.position.set(0, 0, 0);
      rearRightSuspension.add(this.wheels.rearRight);
      rearRightSuspension.position.copy(rearRightPosition);

      if (rearRightParent) {
        rearRightParent.add(rearRightSuspension);
      }

      this.suspensions.rearRight = rearRightSuspension;
      console.log("✓ 后右悬挂已创建");
    }
  }

  /**
   * 识别车灯对象
   */
  private identifyLights(child: THREE.Object3D): void {
    const childNameLower = child.name.toLowerCase();

    if (
      childNameLower.includes("headlight") ||
      childNameLower.includes("front_light")
    ) {
      this.lights.headlights.push(child);
      console.log("✓ 找到前大灯:", child.name);
    }

    if (
      childNameLower.includes("taillight") ||
      childNameLower.includes("rear_light") ||
      childNameLower.includes("brake_light")
    ) {
      this.lights.taillights.push(child);
      console.log("✓ 找到尾灯:", child.name);
    }

    if (
      childNameLower.includes("turn_signal") ||
      childNameLower.includes("indicator")
    ) {
      this.lights.turnSignals.push(child);
      console.log("✓ 找到转向灯:", child.name);
    }
  }

  /**
   * 切换门状态
   */
  public toggleDoor(door: "left" | "right"): void {
    const currentState = this.doorStates[`${door}Door` as keyof DoorStates];
    const newState = currentState === 0 ? 1 : 0;
    this.doorStates[`${door}Door` as keyof DoorStates] = newState;
    console.log(`[CarComponents] ${door} door animation state: ${newState === 0 ? "closed" : "open"}`);
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
    console.log("[R3F] CarComponents资源已清理");
  }
}
