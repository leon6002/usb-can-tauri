# 转向比实现文档

## 功能概述

实现了**转向比（Steering Ratio）**的转换，使得：
- **方向盘转向角**（从 CSV 数据解析）显示在 UI 上
- **轮胎转向角**（方向盘转向角 ÷ 转向比）用于 3D 模型计算

这样可以更真实地模拟真实车辆的转向特性。

## 转向比定义

```typescript
/** 转向比：方向盘转向角 / 轮胎转向角 */
export const STEERING_RATIO = 15;
```

**转向比 = 15** 意味着：
- 方向盘转 15° → 轮胎转 1°
- 方向盘转 30° → 轮胎转 2°
- 方向盘转 150° → 轮胎转 10°

## 数据流

```
CSV 数据
  ↓
解析 CAN DATA → 方向盘转向角 (steering_angle_rad)
  ↓
┌─────────────────────────────────────────┐
│                                         │
├─ 状态面板显示 → 方向盘转向角 (UI)      │
│                                         │
├─ 方向盘 UI 显示 → 方向盘转向角 (UI)    │
│                                         │
└─ 计算轮胎转向角 → 轮胎转向角           │
   (÷ 转向比)      (用于 3D 模型)        │
   ↓
3D 场景更新
  ├─ 轮胎转向角 → 前轮转向
  ├─ 车速 + 轮胎转向角 → 车身旋转（自行车模型）
  └─ 道路跟随
```

## 实现细节

### 1. 转向比常量和转换函数

**文件**: `src/types/vehicleControl.ts`

```typescript
/** 转向比：方向盘转向角 / 轮胎转向角 */
export const STEERING_RATIO = 15;

/**
 * 从方向盘转向角计算轮胎转向角
 * 轮胎转向角 = 方向盘转向角 / 转向比
 */
export function calculateWheelSteeringAngle(
  steeringWheelAngle: number
): number {
  return steeringWheelAngle / STEERING_RATIO;
}
```

### 2. CSV 循环中的转向角处理

**文件**: `src/App.tsx`

在 `onProgressUpdate` 回调中：

```typescript
const onProgressUpdate = (speed: number, steeringAngle: number) => {
  // steeringAngle 是方向盘转向角，需要转换为轮胎转向角
  const wheelSteeringAngle = calculateWheelSteeringAngle(steeringAngle);

  // 更新状态面板显示方向盘转向角
  updateVehicleControl(speed, steeringAngle);

  // 同时更新3D场景中的车身旋转（基于自行车模型）
  // 使用轮胎转向角来计算车身旋转
  const renderer = car3DRendererRef.current;
  if (renderer) {
    renderer.updateSteeringAngle(wheelSteeringAngle, speed);
  }
};
```

**关键点**：
- `steeringAngle` 是从 CSV 解析出来的**方向盘转向角**
- 用于状态面板显示（保持原值）
- 转换为 `wheelSteeringAngle` 用于 3D 模型计算

### 3. 状态面板显示

**文件**: `src/components/CarControl/CarStatusPanel.tsx`

```tsx
<div className="bg-purple-50 p-3 rounded border border-purple-200">
  <div className="text-xs text-purple-600 font-medium">方向盘转向角</div>
  <div className="text-sm font-semibold text-purple-900">
    {((carStates.currentSteeringAngle * 180) / Math.PI).toFixed(2)}°
  </div>
</div>
```

显示的是**方向盘转向角**（未经转向比转换）。

### 4. 方向盘 UI 显示

**文件**: `src/components/CarControl/SteeringWheelUI.tsx`

添加了 `externalSteeringAngle` prop 来接收外部的方向盘转向角：

```typescript
interface SteeringWheelUIProps {
  onSteeringChange?: (angle: number) => void;
  /** 外部设置的方向盘转向角（用于显示CSV数据中的转向角） */
  externalSteeringAngle?: number;
}

// 当外部转向角变化时，更新方向盘显示
useEffect(() => {
  if (externalSteeringAngle !== undefined && !isControlling) {
    setRotation(externalSteeringAngle);
  }
}, [externalSteeringAngle, isControlling]);
```

**行为**：
- 当用户手动拖动方向盘时，显示用户的转向角
- 当 CSV 数据更新时，自动更新方向盘显示为 CSV 中的转向角
- 用户拖动时不受 CSV 数据影响（`!isControlling` 条件）

### 5. 方向盘 UI 集成

**文件**: `src/components/CarControl/CarControlPanel.tsx`

```tsx
<SteeringWheelUI
  onSteeringChange={onSteeringChange}
  externalSteeringAngle={carStates.currentSteeringAngle}
/>
```

传递 `currentSteeringAngle`（方向盘转向角）给方向盘 UI。

## 使用示例

### 示例 1：CSV 数据中的转向角

假设 CSV 数据中的 CAN DATA 为 `0B B8 FF 07`：

```
解析结果：
  方向盘转向角 = -0.249 rad = -14.27°
  
显示效果：
  状态面板：-14.27°
  方向盘 UI：显示 -14.27° 的转向
  
3D 模型计算：
  轮胎转向角 = -14.27° / 15 = -0.952°
  车身旋转 = f(车速, 轮胎转向角)
```

### 示例 2：用户手动转向

用户拖动方向盘转 30°：

```
用户操作：
  方向盘 UI：显示 30°
  
回调函数：
  onSteeringChange(30°)
  
3D 模型计算：
  轮胎转向角 = 30° / 15 = 2°
  车身旋转 = f(车速, 2°)
```

## 参数调整

### 修改转向比

如果需要调整转向比，修改 `src/types/vehicleControl.ts` 中的常量：

```typescript
export const STEERING_RATIO = 15; // 改为其他值，如 12, 18 等
```

### 修改转向角限制

在 `SteeringWheelUI.tsx` 中修改 `maxRotation`：

```typescript
const maxRotation = Math.PI * 0.85; // ±135°，可改为其他值
```

## 物理模型集成

转向比与自行车模型的集成：

```
车身偏转角速度 = (车速 / 轴距) * tan(轮胎转向角)
                = (车速 / 轴距) * tan(方向盘转向角 / 转向比)
```

这样可以更真实地模拟车辆的转向特性。

## 修改的文件

1. **src/types/vehicleControl.ts**
   - 添加 `STEERING_RATIO` 常量
   - 添加 `calculateWheelSteeringAngle()` 函数

2. **src/App.tsx**
   - 导入 `calculateWheelSteeringAngle`
   - 修改 `onProgressUpdate` 回调，分别处理方向盘角度和轮胎角度

3. **src/components/CarControl/CarStatusPanel.tsx**
   - 修改标签为"方向盘转向角"

4. **src/components/CarControl/SteeringWheelUI.tsx**
   - 添加 `externalSteeringAngle` prop
   - 添加 useEffect 来同步外部转向角

5. **src/components/CarControl/CarControlPanel.tsx**
   - 传递 `externalSteeringAngle` 给 SteeringWheelUI

## 测试方法

1. **验证 CSV 数据解析**
   - 上传包含转向角数据的 CSV 文件
   - 检查状态面板显示的方向盘转向角是否正确

2. **验证方向盘 UI 显示**
   - 手动拖动方向盘，检查显示的角度
   - 启动 CSV 循环，检查方向盘是否自动更新

3. **验证 3D 模型**
   - 启动 CSV 循环
   - 观察轮胎转向角是否比方向盘转向角小（÷15）
   - 观察车身旋转是否符合自行车模型

## 常见问题

### Q: 为什么方向盘转向角和轮胎转向角不同？
A: 这是真实车辆的特性。转向比用于减小驾驶员的操作强度，使得小的方向盘转向可以产生足够的轮胎转向。

### Q: 如何调整转向比？
A: 修改 `src/types/vehicleControl.ts` 中的 `STEERING_RATIO` 常量。

### Q: 方向盘 UI 为什么有时不更新？
A: 当用户正在拖动方向盘时（`isControlling = true`），外部转向角不会更新方向盘显示，以避免冲突。

## 相关文档

- `VEHICLE_DYNAMICS_IMPLEMENTATION.md` - 自行车模型实现
- `CSV_DATA_PREVIEW_PARSING.md` - CSV 数据解析
- `GIMBAL_LOCK_FIX.md` - 万向节锁修复

