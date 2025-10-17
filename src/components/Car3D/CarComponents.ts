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
    console.log("🔍 开始初始化车辆组件...");

    // 保存车身引用
    this.steering.carBody = car;
    console.log("✓ 车身引用已保存");

    // 调试：打印所有对象名称
    console.log("📋 模型中的所有对象：");
    car.traverse((child) => {
      if (child.name) {
        console.log(`  - ${child.name}`);
      }
    });

    // 定义确切的轮子名称
    const wheelNames = {
      frontLeft: "Front_Left_Wheel_36_66",
      frontRight: "Front_Right_Wheel_44_81",
      rearLeft: "Rear_Left_Wheel_28_51",
      rearRight: "Rear_Right_Wheel_52_96",
    };

    // 定义悬挂对象名称（可能的名称模式）
    const suspensionPatterns = {
      frontLeft: [
        "suspension_fl",
        "Suspension_FL",
        "Front_Left_Suspension",
        "FL_Suspension",
      ],
      frontRight: [
        "suspension_fr",
        "Suspension_FR",
        "Front_Right_Suspension",
        "FR_Suspension",
      ],
      rearLeft: [
        "suspension_rl",
        "Suspension_RL",
        "Rear_Left_Suspension",
        "RL_Suspension",
      ],
      rearRight: [
        "suspension_rr",
        "Suspension_RR",
        "Rear_Right_Suspension",
        "RR_Suspension",
      ],
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

        // 查找悬挂对象
        for (const [position, patterns] of Object.entries(suspensionPatterns)) {
          if (patterns.some((pattern) => child.name.includes(pattern))) {
            this.suspensions[position as keyof typeof this.suspensions] = child;
            console.log(`✓ 找到${position}悬挂:`, child.name);
          }
        }
      }
    });

    // 为前轮创建转向轴层次结构（分离转向和滚动旋转）
    this.createSteeringAxisHierarchy();

    // 创建悬挂对象（如果模型中没有，则创建虚拟悬挂）
    this.createSuspensionObjects();

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
    console.log("🎯 找到的悬挂:", {
      frontLeft: this.suspensions.frontLeft?.name || "null",
      frontRight: this.suspensions.frontRight?.name || "null",
      rearLeft: this.suspensions.rearLeft?.name || "null",
      rearRight: this.suspensions.rearRight?.name || "null",
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

    // 创建悬挂 Group（在转向轴外部，用于上下运动）
    const frontLeftSuspension = new THREE.Group();
    frontLeftSuspension.name = "FrontLeftSuspension";
    frontLeftSuspension.position.copy(frontLeftPosition);
    frontLeftSuspension.add(frontLeftAxis);

    // 重置转向轴的位置（相对于悬挂）
    frontLeftAxis.position.set(0, 0, 0);
    frontLeftAxis.rotation.copy(frontLeftRotation);

    // 将悬挂添加回原父对象
    if (frontLeftParent) {
      frontLeftParent.add(frontLeftSuspension);
    }

    this.steeringAxes.frontLeft = frontLeftAxis;
    this.suspensions.frontLeft = frontLeftSuspension;
    console.log("✓ 前左轮转向轴已创建，悬挂已添加");

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

    // 将轮子添加到转向轴
    frontRightAxis.add(this.wheels.frontRight);

    // 创建悬挂 Group（在转向轴外部，用于上下运动）
    const frontRightSuspension = new THREE.Group();
    frontRightSuspension.name = "FrontRightSuspension";
    frontRightSuspension.position.copy(frontRightPosition);
    frontRightSuspension.add(frontRightAxis);

    // 重置转向轴的位置（相对于悬挂）
    frontRightAxis.position.set(0, 0, 0);
    frontRightAxis.rotation.copy(frontRightRotation);

    if (frontRightParent) {
      frontRightParent.add(frontRightSuspension);
    }

    this.steeringAxes.frontRight = frontRightAxis;
    this.suspensions.frontRight = frontRightSuspension;
    console.log("✓ 前右轮转向轴已创建，悬挂已添加");
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
   * 创建悬挂对象
   * 为后轮创建悬挂对象（前轮悬挂已在 createSteeringAxisHierarchy 中创建）
   */
  private createSuspensionObjects(): void {
    // 前轮悬挂已在 createSteeringAxisHierarchy 中创建
    const hasFrontSuspensions =
      this.suspensions.frontLeft !== null ||
      this.suspensions.frontRight !== null;

    if (hasFrontSuspensions) {
      console.log("✓ 前轮悬挂已在转向轴中创建");
    }

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
