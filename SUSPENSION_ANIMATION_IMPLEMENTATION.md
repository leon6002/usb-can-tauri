# 悬挂动画实现文档

## 功能概述

实现了**悬挂升高/降低动画**功能，使得在升高或降低悬挂时，转向轴和轮子之间的悬挂部分会产生平滑的动画效果。

## 功能特性

- ✅ 悬挂升高动画
- ✅ 悬挂降低动画
- ✅ 悬挂停止控制
- ✅ 平滑的缓动动画（InOutQuad）
- ✅ 自动检测悬挂对象
- ✅ 支持四个轮子的独立悬挂

## 架构设计

### 1. 悬挂对象管理

**文件**: `src/components/Car3D/CarComponents.ts`

```typescript
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
```

### 2. 悬挂对象创建

悬挂对象在两个地方创建：

**前轮悬挂**：在 `createSteeringAxisHierarchy()` 中创建
- 在转向轴和轮子之间插入一个 Group
- 结构：`转向轴 → 悬挂 Group → 轮子`
- 这样可以分离转向旋转和悬挂上下运动

**后轮悬挂**：在 `createSuspensionObjects()` 中创建
- 为后轮创建悬挂 Group
- 结构：`车身 → 悬挂 Group → 轮子`

### 3. 层次结构

```
车身 (carBody)
├─ 前左转向轴 (FrontLeftSteeringAxis)
│  └─ 前左悬挂 (FrontLeftSuspension) ← 可以上下移动
│     └─ 前左轮 (Front_Left_Wheel)
├─ 前右转向轴 (FrontRightSteeringAxis)
│  └─ 前右悬挂 (FrontRightSuspension) ← 可以上下移动
│     └─ 前右轮 (Front_Right_Wheel)
├─ 后左悬挂 (RearLeftSuspension) ← 可以上下移动
│  └─ 后左轮 (Rear_Left_Wheel)
└─ 后右悬挂 (RearRightSuspension) ← 可以上下移动
   └─ 后右轮 (Rear_Right_Wheel)
```

### 3. 动画控制器

**文件**: `src/components/Car3D/AnimationController.ts`

添加了悬挂动画状态管理：

```typescript
private suspensionAnimation = {
  isAnimating: false,
  direction: 0, // 1: 升高, -1: 降低, 0: 停止
  duration: 1000, // 动画持续时间（毫秒）
  startTime: 0,
  startPositions: new Map<THREE.Object3D, THREE.Vector3>(),
  maxHeight: 0.3, // 最大升高距离（米）
};
```

## 实现细节

### 1. 悬挂升高动画

```typescript
public startSuspensionUp(): void {
  if (this.suspensionAnimation.isAnimating) {
    return; // 已在动画中
  }

  this.suspensionAnimation.isAnimating = true;
  this.suspensionAnimation.direction = 1; // 升高
  this.suspensionAnimation.startTime = Date.now();
  this.suspensionAnimation.startPositions.clear();

  // 保存所有悬挂的初始位置
  Object.values(this.suspensions).forEach((suspension) => {
    if (suspension) {
      this.suspensionAnimation.startPositions.set(
        suspension,
        suspension.position.clone()
      );
    }
  });
}
```

### 2. 悬挂降低动画

```typescript
public startSuspensionDown(): void {
  // 类似升高，但 direction = -1
  this.suspensionAnimation.direction = -1; // 降低
  // ...
}
```

### 3. 动画更新

```typescript
private updateSuspensionAnimation(): void {
  if (!this.suspensionAnimation.isAnimating) {
    return;
  }

  const elapsed = Date.now() - this.suspensionAnimation.startTime;
  const progress = Math.min(elapsed / this.suspensionAnimation.duration, 1.0);

  // 使用缓动函数使动画更平滑
  const easeProgress = this.easeInOutQuad(progress);

  // 更新所有悬挂的位置
  this.suspensionAnimation.startPositions.forEach((startPos, suspension) => {
    const displacement =
      this.suspensionAnimation.direction *
      this.suspensionAnimation.maxHeight *
      easeProgress;

    suspension.position.copy(startPos);
    suspension.position.y += displacement;
  });

  // 动画完成
  if (progress >= 1.0) {
    this.suspensionAnimation.isAnimating = false;
    this.suspensionAnimation.direction = 0;
  }
}
```

### 4. 缓动函数

```typescript
private easeInOutQuad(t: number): number {
  return t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t;
}
```

使用 InOutQuad 缓动函数使动画更平滑自然。

## 数据流

```
用户点击悬挂按钮
  ↓
App.tsx 处理命令
  ↓
发送 CAN 消息
  ↓
触发 3D 动画
  ├─ startSuspensionUp() / startSuspensionDown()
  ↓
AnimationController 更新悬挂位置
  ├─ 保存初始位置
  ├─ 计算动画进度
  ├─ 应用缓动函数
  ├─ 更新悬挂 Y 坐标
  └─ 动画完成
```

## 参数配置

### 动画持续时间

```typescript
duration: 1000, // 毫秒（1秒）
```

修改此值可以调整动画速度。

### 最大升高距离

```typescript
maxHeight: 0.3, // 米（0.3m = 30cm）
```

修改此值可以调整悬挂的升降幅度。

## 使用方法

### 1. 升高悬挂

点击"升高"按钮：
- 发送 CAN 消息：`FF FF 01 FF 00 00 00 00`
- 触发 3D 悬挂升高动画
- 悬挂平滑上升 0.3m

### 2. 降低悬挂

点击"降低"按钮：
- 发送 CAN 消息：`FF FF 02 FF 00 00 00 00`
- 触发 3D 悬挂降低动画
- 悬挂平滑下降 0.3m

### 3. 停止悬挂

点击"停止"按钮：
- 发送 CAN 消息：`FF FF 03 FF 00 00 00 00`
- 停止悬挂动画
- 悬挂保持当前位置

## 修改的文件

1. **src/components/Car3D/CarComponents.ts**
   - 添加 `suspensions` 对象
   - 添加悬挂对象检测逻辑

2. **src/components/Car3D/AnimationController.ts**
   - 添加 `suspensionAnimation` 状态
   - 添加 `suspensions` 参数到构造函数
   - 添加 `startSuspensionUp()` 方法
   - 添加 `startSuspensionDown()` 方法
   - 添加 `stopSuspensionAnimation()` 方法
   - 添加 `updateSuspensionAnimation()` 方法
   - 添加 `easeInOutQuad()` 缓动函数
   - 在 `update()` 中调用悬挂动画更新

3. **src/components/Car3D/Car3DRenderer.ts**
   - 修改 AnimationController 初始化，传递悬挂对象
   - 添加 `startSuspensionUp()` 公共方法
   - 添加 `startSuspensionDown()` 公共方法
   - 添加 `stopSuspensionAnimation()` 公共方法

4. **src/App.tsx**
   - 添加 `suspension_up` 命令处理
   - 添加 `suspension_down` 命令处理
   - 添加 `suspension_stop` 命令处理
   - 触发对应的 3D 动画

## 测试方法

1. **启动应用**
   - 打开应用并等待 3D 场景加载完成

2. **测试升高**
   - 点击"升高"按钮
   - 观察悬挂是否平滑上升
   - 检查状态面板显示"升高"

3. **测试降低**
   - 点击"降低"按钮
   - 观察悬挂是否平滑下降
   - 检查状态面板显示"降低"

4. **测试停止**
   - 点击"停止"按钮
   - 观察悬挂是否停止动画
   - 检查状态面板显示"正常"

## 性能优化

- 使用 `Map` 存储悬挂对象的初始位置，避免重复计算
- 使用 `Date.now()` 而不是 `delta` 时间，确保动画时间准确
- 动画完成后立即停止更新，减少不必要的计算

## 扩展可能性

### 1. 添加弹簧效果

可以在缓动函数中添加弹簧效果：

```typescript
private easeElastic(t: number): number {
  // 实现弹簧效果
}
```

### 2. 添加悬挂压缩效果

可以在升降时同时改变悬挂的缩放：

```typescript
suspension.scale.y = 1 - (displacement * 0.5);
```

### 3. 添加轮子跟随效果

可以让轮子跟随悬挂的运动：

```typescript
wheel.position.y += displacement;
```

## 编译状态

- ✅ TypeScript 编译成功
- ✅ Vite 构建成功
- ✅ 所有代码已构建完成

## 相关文档

- `GIMBAL_LOCK_FIX.md` - 万向节锁修复
- `VEHICLE_DYNAMICS_IMPLEMENTATION.md` - 车辆动力学
- `STEERING_RATIO_IMPLEMENTATION.md` - 转向比实现

