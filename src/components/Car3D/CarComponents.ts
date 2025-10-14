/**
 * 车辆组件管理器 - 管理车辆的各个组件：门、轮子、灯光等
 */
import * as THREE from 'three';
import { ICarComponents, WheelObjects, LightObjects, DoorStates } from './types';

export class CarComponents implements ICarComponents {
  // 轮子对象
  public wheels: WheelObjects = {
    frontLeft: null,
    frontRight: null,
    rearLeft: null,
    rearRight: null
  };

  // 车灯对象
  public lights: LightObjects = {
    headlights: [],
    taillights: [],
    turnSignals: []
  };

  // 门状态（只用于跟踪状态，不需要门对象）
  public doorStates: DoorStates = {
    leftDoor: 0,  // 0: 关闭, 1: 开启
    rightDoor: 0
  };

  /**
   * 初始化车辆组件
   */
  public initializeComponents(car: THREE.Group): void {
    console.log('🔍 开始初始化车辆组件...');

    // 定义确切的轮子名称
    const wheelNames = {
      frontLeft: 'Front_Left_Wheel_36_66',
      frontRight: 'Front_Right_Wheel_44_81',
      rearLeft: 'Rear_Left_Wheel_28_51',
      rearRight: 'Rear_Right_Wheel_52_96'
    };

    car.traverse((child) => {
      if (child.name) {
        // 识别车灯对象
        this.identifyLights(child);

        // 直接通过名称查找轮子对象
        if (child.name === wheelNames.frontLeft) {
          this.wheels.frontLeft = child;
          console.log('✓ 找到前左轮:', child.name);
        } else if (child.name === wheelNames.frontRight) {
          this.wheels.frontRight = child;
          console.log('✓ 找到前右轮:', child.name);
        } else if (child.name === wheelNames.rearLeft) {
          this.wheels.rearLeft = child;
          console.log('✓ 找到后左轮:', child.name);
        } else if (child.name === wheelNames.rearRight) {
          this.wheels.rearRight = child;
          console.log('✓ 找到后右轮:', child.name);
        }
      }
    });

    console.log('✅ 车辆组件初始化完成');
    console.log('🎯 找到的轮子:', {
      frontLeft: this.wheels.frontLeft?.name || 'null',
      frontRight: this.wheels.frontRight?.name || 'null',
      rearLeft: this.wheels.rearLeft?.name || 'null',
      rearRight: this.wheels.rearRight?.name || 'null'
    });
    console.log('灯光数量:', Object.keys(this.lights).length);
    console.log('门动画将使用预制动画: DoorFLOpen, DoorFROpen');
  }

  /**
   * 切换门状态
   */
  public toggleDoor(door: 'left' | 'right'): void {
    const currentState = this.doorStates[`${door}Door` as keyof DoorStates];
    const newState = currentState === 0 ? 1 : 0;

    // 触发门动画事件，让AnimationController处理
    const animationName = door === 'left' ? 'DoorFLOpen' : 'DoorFROpen';
    const event = new CustomEvent('playDoorAnimation', {
      detail: {
        animationName,
        reverse: newState === 0 // 如果新状态是关闭，则反向播放动画
      }
    });
    document.dispatchEvent(event);

    this.doorStates[`${door}Door` as keyof DoorStates] = newState;

    console.log(`${door}门状态切换为: ${newState === 0 ? '关闭' : '开启'}, 动画: ${animationName}`);
  }

  /**
   * 识别车灯对象
   */
  private identifyLights(child: THREE.Object3D): void {
    const childNameLower = child.name.toLowerCase();
    
    // 识别前大灯
    if (childNameLower.includes('headlight') || childNameLower.includes('front_light')) {
      this.lights.headlights.push(child);
      console.log('✓ 找到前大灯:', child.name);
    }
    
    // 识别尾灯
    if (childNameLower.includes('taillight') || childNameLower.includes('rear_light') || childNameLower.includes('brake_light')) {
      this.lights.taillights.push(child);
      console.log('✓ 找到尾灯:', child.name);
    }
    
    // 识别转向灯
    if (childNameLower.includes('turn_signal') || childNameLower.includes('indicator')) {
      this.lights.turnSignals.push(child);
      console.log('✓ 找到转向灯:', child.name);
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
      rearRight: null
    };
    this.lights = {
      headlights: [],
      taillights: [],
      turnSignals: []
    };

    console.log('CarComponents资源已清理');
  }
}
