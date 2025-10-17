# 转向方向修复文档

## 问题描述

在实现转向比转换后，发现了一个方向相反的问题：
- **轮胎向左转**时，车身反而**向右旋转**
- **轮胎向右转**时，车身反而**向左旋转**

这是一个坐标系符号约定的问题。

## 根本原因

在 `updateVehicleDynamics` 方法中，使用自行车模型计算车身偏转角速度：

```typescript
const yawRate = (speedMs / wheelbase) * Math.tan(steeringAngle);
```

这个公式中：
- 当 `steeringAngle > 0`（向左转）时，`yawRate > 0`
- 但在 Three.js 中，`rotation.y > 0` 表示向右旋转（绕Y轴正方向）
- 这导致了方向相反的问题

## 解决方案

在计算 `yawRate` 时添加负号，使其与 Three.js 的坐标系方向一致：

```typescript
// 修复前
const yawRate = (speedMs / wheelbase) * Math.tan(steeringAngle);

// 修复后
const yawRate = -(speedMs / wheelbase) * Math.tan(steeringAngle);
```

## 修改的代码

**文件**: `src/components/Car3D/Car3DRenderer.ts`

**方法**: `updateVehicleDynamics()`

```typescript
private updateVehicleDynamics(deltaTime: number): void {
  if (!this.carComponents.steering.carBody) return;

  const { wheelbase, currentSpeed, steeringAngle } = this.vehicleDynamics;

  // 将速度从 mm/s 转换为 m/s
  const speedMs = currentSpeed / 1000;

  // 自行车模型：车身偏转角速度 = (v / L) * tan(delta)
  // 其中 v 是车速，L 是轴距，delta 是前轮转向角
  // 注意：添加负号以匹配坐标系方向（轮胎向左转时，车身应向左旋转）
  if (Math.abs(speedMs) > 0.01) {
    // 只有当车速足够大时才计算偏转
    const yawRate = -(speedMs / wheelbase) * Math.tan(steeringAngle);
    this.vehicleDynamics.bodyYaw += yawRate * deltaTime;

    // 应用到车身
    this.carComponents.steering.carBody.rotation.y =
      this.vehicleDynamics.bodyYaw;
  }
}
```

## 坐标系说明

### Three.js 坐标系

在 Three.js 中：
- **X 轴**：向右为正
- **Y 轴**：向上为正
- **Z 轴**：向观察者为正

### 旋转方向

使用右手法则，绕 Y 轴旋转：
- **rotation.y > 0**：向右旋转（顺时针看向下方）
- **rotation.y < 0**：向左旋转（逆时针看向下方）

### 转向角约定

在车辆控制中：
- **steeringAngle > 0**：向左转
- **steeringAngle < 0**：向右转

### 修复前的问题

```
steeringAngle > 0 (向左转)
  ↓
yawRate = (v/L) * tan(steeringAngle) > 0
  ↓
rotation.y += yawRate * deltaTime > 0
  ↓
车身向右旋转 ❌ (错误)
```

### 修复后的正确行为

```
steeringAngle > 0 (向左转)
  ↓
yawRate = -(v/L) * tan(steeringAngle) < 0
  ↓
rotation.y += yawRate * deltaTime < 0
  ↓
车身向左旋转 ✓ (正确)
```

## 测试方法

### 1. 手动转向测试

1. 打开应用
2. 拖动方向盘向左
3. 观察：
   - 轮胎应该向左转
   - 车身应该向左旋转
4. 拖动方向盘向右
5. 观察：
   - 轮胎应该向右转
   - 车身应该向右旋转

### 2. CSV 数据测试

1. 上传包含转向角数据的 CSV 文件
2. 启动行驶
3. 观察：
   - 轮胎转向方向与 CSV 数据一致
   - 车身旋转方向与轮胎转向方向一致

### 3. 边界测试

| 转向角 | 预期轮胎方向 | 预期车身旋转 |
|--------|------------|-----------|
| +0.1 rad | 向左 | 向左 |
| -0.1 rad | 向右 | 向右 |
| 0 rad | 直行 | 无旋转 |

## 相关参数

### 自行车模型参数

- **轴距 (wheelbase)**: 3.0 m
- **转向比 (STEERING_RATIO)**: 15
- **最小速度阈值**: 0.01 m/s

### 坐标系参数

- **轮胎转向轴**: Z 轴（绕 Z 轴旋转）
- **车身旋转轴**: Y 轴（绕 Y 轴旋转）
- **车身前进方向**: Z 轴负方向

## 物理模型验证

修复后的自行车模型满足以下物理特性：

1. **转向与旋转同向**
   - 轮胎向左转 → 车身向左旋转
   - 轮胎向右转 → 车身向右旋转

2. **速度影响旋转速度**
   - 高速转向 → 车身旋转快
   - 低速转向 → 车身旋转慢

3. **转向角影响旋转速度**
   - 大转向角 → 车身旋转快
   - 小转向角 → 车身旋转慢

## 编译状态

- ✅ TypeScript 编译成功
- ✅ Vite 构建成功
- ✅ 所有代码已构建完成

## 修改的文件

1. **src/components/Car3D/Car3DRenderer.ts**
   - 修改 `updateVehicleDynamics()` 方法
   - 在 `yawRate` 计算中添加负号

## 相关文档

- `VEHICLE_DYNAMICS_IMPLEMENTATION.md` - 自行车模型详细说明
- `STEERING_RATIO_IMPLEMENTATION.md` - 转向比实现说明
- `GIMBAL_LOCK_FIX.md` - 万向节锁修复说明

