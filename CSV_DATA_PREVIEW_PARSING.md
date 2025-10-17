# CSV 数据预览解析功能文档

## 功能概述

在 CSV 导入界面中，用户现在可以实时看到根据预览数据解析出来的**速度**和**转向角度**。这样可以快速验证 CSV 文件的格式是否正确，以及数据是否能被正确解析。

## 功能位置

在 CAN 配置页面的左侧面板中：
- **CAN Data 列** 输入框下方
- 显示 CAN Data 的十六进制预览
- **新增**：显示解析后的速度和转向角度

## 解析逻辑

### 数据协议

CAN DATA 包含 4 字节的控制数据：

```
Byte 0-1: 线速度 (Signed Int16, Big-Endian, mm/s)
Byte 2-3: 转向角 (Signed Int16, Big-Endian, 0.001 rad/count)
```

### 解析步骤

1. **十六进制字符串转字节数组**
   - 支持格式：`"0B B8 FF 07"` 或 `"0BB8FF07"`
   - 移除空格和 `0x` 前缀
   - 每两个十六进制字符转换为一个字节

2. **提取线速度**
   - 取前两个字节 (data[0], data[1])
   - 使用 Big-Endian 解析为有符号 16 位整数
   - 单位：mm/s

3. **提取转向角**
   - 取后两个字节 (data[2], data[3])
   - 使用 Big-Endian 解析为有符号 16 位整数
   - 乘以 0.001 转换为弧度
   - 单位：rad

## 实现细节

### TypeScript 解析函数

在 `src/types/vehicleControl.ts` 中实现了三个核心函数：

#### 1. `parseCanDataHex(hexStr: string): number[]`

将十六进制字符串转换为字节数组。

```typescript
export function parseCanDataHex(hexStr: string): number[] {
  const cleaned = hexStr
    .replace(/\s/g, "")
    .replace(/0x/gi, "");

  if (cleaned.length % 2 !== 0) {
    throw new Error("十六进制字符串长度必须是偶数");
  }

  const result: number[] = [];
  for (let i = 0; i < cleaned.length; i += 2) {
    const hex = cleaned.substr(i, 2);
    const byte = parseInt(hex, 16);
    if (isNaN(byte)) {
      throw new Error(`无效的十六进制字符: ${hex}`);
    }
    result.push(byte);
  }

  return result;
}
```

#### 2. `parseControlData4Byte(data: number[]): VehicleControl`

解析 4 字节数据为车速和转向角。

```typescript
export function parseControlData4Byte(data: number[]): VehicleControl {
  if (data.length < 4) {
    throw new Error("输入数据长度必须至少是 4 字节");
  }

  // 解析线速度 (Big-Endian)
  const linearVelocityMms =
    (data[0] << 8) | data[1];
  const linearVelocityMmsSigned =
    linearVelocityMms > 32767 ? linearVelocityMms - 65536 : linearVelocityMms;

  // 解析转向角 (Big-Endian)
  const steeringAngleRaw = (data[2] << 8) | data[3];
  const steeringAngleRawSigned =
    steeringAngleRaw > 32767 ? steeringAngleRaw - 65536 : steeringAngleRaw;

  // 转换单位
  const steeringAngleRad = steeringAngleRawSigned * 0.001;

  return {
    linear_velocity_mms: linearVelocityMmsSigned,
    steering_angle_rad: steeringAngleRad,
  };
}
```

#### 3. `extractVehicleControl(canData: string): VehicleControl`

高级接口，直接从 CAN 数据字符串提取车速和转向角。

```typescript
export function extractVehicleControl(canData: string): VehicleControl {
  const dataBytes = parseCanDataHex(canData);
  return parseControlData4Byte(dataBytes);
}
```

### UI 集成

在 `ConnectionPanel.tsx` 中：

1. **导入解析函数**
   ```typescript
   import { extractVehicleControl } from "../../types/vehicleControl";
   ```

2. **使用 useMemo 缓存解析结果**
   ```typescript
   const parsedVehicleControl = useMemo(() => {
     try {
       if (!canDataPreview || canDataPreview.startsWith("未选择")) {
         return null;
       }
       return extractVehicleControl(canDataPreview);
     } catch (error) {
       console.error("Failed to parse vehicle control:", error);
       return null;
     }
   }, [canDataPreview]);
   ```

3. **显示解析结果**
   ```tsx
   {parsedVehicleControl && (
     <div className="mt-2 px-2 py-2 text-xs bg-green-50 border border-green-200 rounded text-green-700 space-y-1">
       <div className="font-semibold">✓ 解析成功</div>
       <div>
         速度: <span className="font-mono font-bold">
           {parsedVehicleControl.linear_velocity_mms}
         </span> mm/s
       </div>
       <div>
         转向角: <span className="font-mono font-bold">
           {parsedVehicleControl.steering_angle_rad.toFixed(4)}
         </span> rad (
         <span className="font-mono font-bold">
           {((parsedVehicleControl.steering_angle_rad * 180) / Math.PI).toFixed(2)}
         </span>°)
       </div>
     </div>
   )}
   ```

## 显示效果

### 成功解析时

显示绿色背景的预览框，包含：
- ✓ 解析成功
- 速度：3000 mm/s
- 转向角：-0.2490 rad (-14.27°)

### 解析失败时

不显示预览框，用户可以检查：
- CAN Data 列索引是否正确
- 数据格式是否正确（十六进制字符串）
- 数据长度是否至少 4 字节

## 使用流程

1. **选择 CSV 文件**
   - 点击"选择"按钮上传 CSV 文件

2. **配置列索引**
   - 设置 CAN ID 列索引
   - 设置 CAN Data 列索引

3. **查看预览**
   - CAN ID 预览显示在 CAN ID 列下方
   - CAN Data 预览显示在 CAN Data 列下方
   - **新增**：解析结果显示在 CAN Data 预览下方

4. **验证数据**
   - 检查速度和转向角是否合理
   - 如果解析失败，调整列索引或检查数据格式

## 错误处理

### 常见错误

| 错误 | 原因 | 解决方案 |
|------|------|--------|
| 十六进制字符串长度必须是偶数 | 数据格式不正确 | 检查 CAN Data 格式 |
| 无效的十六进制字符 | 包含非十六进制字符 | 确保只包含 0-9, A-F |
| 输入数据长度必须至少是 4 字节 | 数据不足 4 字节 | 检查 CAN Data 列索引 |

### 错误恢复

- 解析失败时，预览框不显示
- 用户可以调整配置后重新尝试
- 错误信息会输出到浏览器控制台

## 性能优化

- 使用 `useMemo` 缓存解析结果
- 只在 `canDataPreview` 变化时重新解析
- 避免不必要的重新计算

## 与后端的一致性

前端的解析逻辑与 Rust 后端完全一致：
- 相同的 Big-Endian 字节序
- 相同的有符号整数转换
- 相同的单位转换（0.001 rad）

这确保了预览结果与实际发送时的解析结果一致。

## 修改的文件

1. **src/types/vehicleControl.ts**
   - 添加 `parseCanDataHex()` 函数
   - 添加 `parseControlData4Byte()` 函数
   - 添加 `extractVehicleControl()` 函数

2. **src/components/CanConfig/ConnectionPanel.tsx**
   - 导入解析函数
   - 添加 `parsedVehicleControl` useMemo
   - 添加解析结果显示 UI

## 测试方法

1. **测试数据**
   - 十六进制：`0B B8 FF 07`
   - 预期速度：3000 mm/s
   - 预期转向角：-0.249 rad (-14.27°)

2. **验证步骤**
   - 上传包含此数据的 CSV 文件
   - 设置正确的列索引
   - 检查预览是否显示正确的速度和转向角

3. **边界测试**
   - 测试最大值：`7FFF 7FFF`
   - 测试最小值：`8000 8000`
   - 测试零值：`0000 0000`

