# CSV 数据解析和道路生成指南

## 概述

本功能允许从 CSV 文件中解析 CAN 数据，提取车速和转向角信息，并自动生成对应的道路路段。这样可以在实时发送 CAN 数据时，车模型的转向和道路与解析数据保持一致。

## 数据协议

### CAN 数据格式

CAN 数据包含 4 字节的控制信息：

```
Byte 0-1: 线速度 (Signed Int16, Big-Endian, 单位: mm/s)
Byte 2-3: 转向角 (Signed Int16, Big-Endian, 单位: 0.001 rad)
```

### 示例

十六进制数据: `0B B8 FF 07`

- `0B B8` → 3000 mm/s (线速度)
- `FF 07` → -249 × 0.001 = -0.249 rad (转向角)

## 后端实现

### Rust 模块: `vehicle_control.rs`

提供了以下主要函数：

#### `parse_control_data_4byte(data: &[u8]) -> Result<VehicleControl, &'static str>`

解析 4 字节的 CAN 数据，返回 `VehicleControl` 结构体。

```rust
pub struct VehicleControl {
    pub linear_velocity_mms: i16,      // 线速度 (mm/s)
    pub steering_angle_rad: f32,       // 转向角 (rad)
}
```

#### `parse_can_data_hex(hex_str: &str) -> Result<Vec<u8>, &'static str>`

从十六进制字符串解析 CAN 数据，支持格式：
- `"0B B8 FF 07"` (空格分隔)
- `"0BB8FF07"` (连续)

#### `extract_vehicle_control(can_data: &str) -> Result<VehicleControl, String>`

从 CAN 数据字符串直接提取车速和转向角。

### Tauri 命令: `preload_csv_data`

预加载 CSV 文件并解析所有记录的车辆控制数据。

**参数:**
- `csv_content: String` - CSV 文件内容
- `can_id_column_index: usize` - CAN ID 列索引 (默认: 0)
- `can_data_column_index: usize` - CAN 数据列索引 (默认: 1)
- `csv_start_row_index: usize` - 开始行索引 (默认: 0)

**返回:**
```typescript
CsvLoopProgress[] = [
  {
    index: 0,
    total: 100,
    can_id: "201",
    can_data: "0B B8 FF 07",
    vehicle_control: {
      linear_velocity_mms: 3000,
      steering_angle_rad: -0.249
    }
  },
  ...
]
```

## 前端使用

### 类型定义

```typescript
import { CsvLoopProgress, RoadSegment } from "@/types/vehicleControl";
```

### Hook: `useCsvDataPreload`

```typescript
import { useCsvDataPreload } from "@/hooks/useCsvDataPreload";

const { isLoading, csvData, roadSegments, error, preloadCsvData } = useCsvDataPreload({
  onSuccess: (data) => console.log("✅ Data loaded:", data),
  onError: (error) => console.error("❌ Error:", error),
});

// 预加载 CSV 数据
await preloadCsvData(csvContent, 0, 1, 0);

// 使用解析后的数据
console.log("CSV 数据:", csvData);
console.log("道路段:", roadSegments);
```

### 道路段生成

```typescript
import { generateRoadSegments, getRoadSegmentAtDistance } from "@/types/vehicleControl";

// 从 CSV 数据生成道路段
const segments = generateRoadSegments(csvData, 100); // 每段 100mm

// 获取指定距离处的路段
const segment = getRoadSegmentAtDistance(segments, 500);
console.log("当前路段:", segment);
```

## 集成到 3D 场景

### 步骤 1: 预加载数据

在开始行驶前，预加载 CSV 数据：

```typescript
const handleStartDriving = async () => {
  try {
    const { data, segments } = await preloadCsvData(csvContent);
    
    // 保存道路段信息
    setRoadSegments(segments);
    
    // 开始行驶
    startCsvLoop(...);
  } catch (error) {
    console.error("Failed to preload data:", error);
  }
};
```

### 步骤 2: 实时更新 3D 场景

在 CSV 循环中，根据当前的车速和转向角更新 3D 模型：

```typescript
// 在 CSV 循环的每一步
const currentSegment = roadSegments[currentIndex];

if (currentSegment) {
  // 更新车的转向角
  updateSteeringAngle(currentSegment.steering_angle);
  
  // 更新车的速度
  updateVehicleSpeed(currentSegment.speed);
  
  // 更新道路转弯
  updateRoadCurve(currentSegment.steering_angle);
}
```

### 步骤 3: 同步道路和车模型

确保道路的转弯与车的转向角一致：

```typescript
// 道路转弯角度 = 车的转向角
const roadCurveAngle = vehicleControl.steering_angle_rad;

// 更新道路几何体
updateRoadGeometry(roadCurveAngle);

// 更新车的前轮转向
updateFrontWheelRotation(vehicleControl.steering_angle_rad);
```

## 示例 CSV 格式

```csv
CAN_ID,CAN_DATA
201,0B B8 FF 07
201,0B B8 00 00
201,0B B8 01 F4
201,0B B8 FE 0C
```

## 测试

运行 Rust 单元测试：

```bash
cd src-tauri
cargo test vehicle_control
```

## 性能考虑

- 预加载大型 CSV 文件可能需要几秒钟
- 建议在后台线程中进行预加载
- 道路段数据存储在内存中，大型数据集可能占用较多内存

## 故障排除

### 数据解析失败

检查 CAN 数据格式是否正确：
- 必须是 4 字节 (8 个十六进制字符)
- 支持空格分隔或连续格式

### 道路段生成不正确

检查 CSV 列索引是否正确设置：
- `can_id_column_index`: CAN ID 所在列
- `can_data_column_index`: CAN 数据所在列

### 性能问题

- 减少 CSV 记录数
- 增加路段距离 (segmentDistance 参数)
- 使用异步加载

