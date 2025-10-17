# 车辆动力学实现文档

## 概述

本功能实现了基于**自行车模型（Bicycle Model）**的车辆动力学模拟，使得车身的偏转角不仅取决于前轮转向角，还取决于车速。这样可以实现更加逼真的车辆运动效果。

## 物理模型

### 自行车模型公式

```
车身偏转角速度 (Yaw Rate) = (v / L) * tan(δ)

其中：
- v: 车的纵向速度（m/s）
- L: 轴距（m）
- δ: 前轮转向角（rad）
```

### 参数说明

| 参数 | 值 | 单位 | 说明 |
|------|-----|------|------|
| 轴距 (L) | 3.0 | m | 车辆前后轴之间的距离 |
| 车速 (v) | 实时 | mm/s | 从 CAN 数据解析得到 |
| 转向角 (δ) | 实时 | rad | 从 CAN 数据解析得到 |
| 车身偏转角 (ψ) | 计算 | rad | 根据上述公式计算 |

## 实现细节

### 1. 车辆动力学参数

在 `Car3DRenderer` 中定义：

```typescript
private vehicleDynamics = {
  wheelbase: 3.0,        // 轴距（米）
  currentSpeed: 0,       // 当前速度（mm/s）
  steeringAngle: 0,      // 当前转向角（弧度）
  bodyYaw: 0,            // 车身偏转角（弧度）
};
```

### 2. 动力学更新

在每一帧的 `animate()` 方法中调用 `updateVehicleDynamics()`：

```typescript
private updateVehicleDynamics(deltaTime: number): void {
  const { wheelbase, currentSpeed, steeringAngle } = this.vehicleDynamics;
  
  // 将速度从 mm/s 转换为 m/s
  const speedMs = currentSpeed / 1000;
  
  // 自行车模型计算
  if (Math.abs(speedMs) > 0.01) {
    const yawRate = (speedMs / wheelbase) * Math.tan(steeringAngle);
    this.vehicleDynamics.bodyYaw += yawRate * deltaTime;
    
    // 应用到车身
    this.carComponents.steering.carBody.rotation.y = this.vehicleDynamics.bodyYaw;
  }
}
```

### 3. 更新接口

#### `updateSteeringAngle(angle: number, speed?: number)`

更新前轮转向角和车速：

```typescript
public updateSteeringAngle(angle: number, speed?: number): void {
  // 更新前轮转向
  if (this.carComponents.steering.frontLeftWheel) {
    this.carComponents.steering.frontLeftWheel.rotation.z = angle;
  }
  if (this.carComponents.steering.frontRightWheel) {
    this.carComponents.steering.frontRightWheel.rotation.z = angle;
  }
  
  // 更新动力学参数
  this.vehicleDynamics.steeringAngle = angle;
  if (speed !== undefined) {
    this.vehicleDynamics.currentSpeed = speed;
  }
}
```

#### `resetVehicleDynamics()`

重置车辆动力学状态（停止行驶时调用）：

```typescript
public resetVehicleDynamics(): void {
  this.vehicleDynamics.bodyYaw = 0;
  this.vehicleDynamics.currentSpeed = 0;
  this.vehicleDynamics.steeringAngle = 0;
  
  if (this.carComponents.steering.carBody) {
    this.carComponents.steering.carBody.rotation.y = 0;
  }
}
```

## 数据流

```
CSV 数据
  ↓
解析速度和转向角
  ↓
updateSteeringAngle(angle, speed)
  ↓
更新 vehicleDynamics 参数
  ↓
animate() 循环
  ↓
updateVehicleDynamics(deltaTime)
  ↓
计算 Yaw Rate = (v/L) * tan(δ)
  ↓
更新 bodyYaw += yawRate * deltaTime
  ↓
应用到车身 carBody.rotation.y
```

## 效果说明

### 低速转向
- 当车速很低时，即使转向角很大，车身偏转也很小
- 这符合实际车辆的行为

### 高速转向
- 当车速很高时，相同的转向角会导致更大的车身偏转
- 这也符合实际车辆的行为

### 直线行驶
- 当转向角为 0 时，无论车速多少，车身偏转角速度都为 0
- 车身保持直线方向

## 集成点

### 1. 方向盘控制（CarControlTab.tsx）

```typescript
const handleSteeringChange = (angle: number) => {
  const renderer = (window as any).car3DRenderer;
  if (renderer) {
    renderer.updateSteeringAngle(angle);
  }
};
```

### 2. CSV 循环播放（App.tsx）

```typescript
const onProgressUpdate = (speed: number, steeringAngle: number) => {
  updateVehicleControl(speed, steeringAngle);
  
  const renderer = car3DRendererRef.current;
  if (renderer) {
    renderer.updateSteeringAngle(steeringAngle, speed);
  }
};
```

### 3. 停止行驶（App.tsx）

```typescript
renderer.stopWheelRotation();
renderer.stopRoadMovement();
renderer.resetVehicleDynamics(); // 重置动力学状态
renderer.startCameraAnimation("side", 2000, true);
```

## 参数调整

如需调整车辆的转向特性，可以修改以下参数：

### 轴距（Wheelbase）

```typescript
wheelbase: 3.0  // 增大值 → 转向不灵敏，减小值 → 转向灵敏
```

### 速度阈值

```typescript
if (Math.abs(speedMs) > 0.01)  // 调整此值以改变最小速度阈值
```

## 测试方法

1. **方向盘控制测试**
   - 拖动方向盘，观察车身是否跟随转向
   - 车身应该平滑地旋转

2. **CSV 播放测试**
   - 上传包含速度和转向角的 CSV 文件
   - 观察车身是否根据速度和转向角正确旋转
   - 低速时转向幅度小，高速时转向幅度大

3. **停止行驶测试**
   - 停止行驶后，车身应该回到初始方向（rotation.y = 0）

## 物理模型局限

当前实现的自行车模型有以下局限：

1. **不考虑侧滑**：假设轮胎不会侧滑
2. **不考虑加速度**：只考虑当前速度，不考虑加速过程
3. **不考虑重力和摩擦**：这是一个简化的运动学模型
4. **不考虑转向延迟**：假设转向角立即生效

对于更复杂的模拟，可以考虑使用更高级的动力学模型（如 Pacejka 轮胎模型）。

