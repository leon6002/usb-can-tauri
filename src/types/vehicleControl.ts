/**
 * 车辆控制数据类型定义
 */

/** 转向比：方向盘转向角 / 轮胎转向角 */
export const STEERING_RATIO = 15;

export interface VehicleControl {
  /** 车体行进速度，单位 mm/s (Signed Int16) */
  linear_velocity_mms: number;
  /** 转向角度，单位 rad (Signed Int16, 0.001rad/count) */
  steering_angle_rad: number;
}

/** 新协议：8字节数据格式 */
export interface VehicleStatus {
  /** 档位 (0=P, 1=R, 2=N, 3=D, 4=S) */
  gear: number;
  /** 档位名称 */
  gearName: string;
  /** 速度，单位 mm/s */
  speed: number;
  /** 转向角，单位度数 */
  steeringAngle: number;
}

/**
 * 解析新协议的8字节数据 (auto_spd_ctrl_cmd)
 * 根据协议文档表 4-3：
 * 字节0-2 (小端序)：速度值 (20位) + 档位 (4位)
 *   - 低4位 (data[0] & 0x0F): 档位 (4=D档)
 *   - 高20位: 速度值 (mm/s)
 * 字节2-4 (16位补码)：转向角 (0.01度/count)
 *   - 取字节2-4，小端序读取为 data[4] data[3] data[2]
 *   - 去掉首尾半个字节，提取中间的值
 */
export function parseVehicleStatus8Byte(data: number[]): VehicleStatus {
  if (data.length < 8) {
    console.log("data is: ", data);
    throw new Error("输入数据长度必须至少是 8 字节");
  }

  const byte0 = data[0];
  const byte1 = data[1];
  const byte2 = data[2];
  const byte3 = data[3];
  const byte4 = data[4];

  // 解析档位 (字节0的低4位)
  const gearValue = byte0 & 0x0f;
  const gearMap: { [key: number]: string } = {
    0x00: "disable",
    0x01: "P",
    0x02: "R",
    0x03: "N",
    0x04: "D",
  };
  const gearName = gearMap[gearValue] || "Unknown";

  // 解析速度 (字节0-2，小端序)
  // 取前3个字节，转换为小端序的u32
  const speedRaw = byte0 | (byte1 << 8) | (byte2 << 16);
  // 高20位是速度值，低4位是档位
  const speed = (speedRaw >> 4) & 0xfffff; // 取高20位

  // 解析转向角 (字节2-4，16位补码)
  // 取字节2-4（data[2], data[3], data[4]），小端序读取为 data[4] data[3] data[2]
  // 去掉首尾半个字节，提取中间的 F9C0
  // 从 data[4] data[3] data[2] 中提取：
  // - data[4] 的低4位作为高字节的高4位
  // - data[3] 作为高字节的低4位和低字节的高4位
  // - data[2] 的高4位作为低字节的低4位
  const highByte = ((byte4 & 0x0f) << 4) | ((byte3 >> 4) & 0x0f);
  const lowByte = ((byte3 & 0x0f) << 4) | ((byte2 >> 4) & 0x0f);

  // 组合成16位有符号整数
  const angleRaw = (highByte << 8) | lowByte;
  const angleSigned = angleRaw > 32767 ? angleRaw - 65536 : angleRaw;
  const steeringAngleDegrees = angleSigned * 0.01; // 单位：度数

  return {
    gear: gearValue,
    gearName,
    speed,
    steeringAngle: steeringAngleDegrees,
  };
}

/**
 * 从 CAN 数据字符串提取车辆状态（新协议）
 */
export function extractVehicleStatus(canData: string): VehicleStatus {
  const dataBytes = parseCanDataHex(canData);
  return parseVehicleStatus8Byte(dataBytes);
}

/**
 * 从方向盘转向角计算轮胎转向角
 * 轮胎转向角 = 方向盘转向角 / 转向比
 */
export function calculateWheelSteeringAngle(
  steeringWheelAngle: number
): number {
  return steeringWheelAngle / STEERING_RATIO;
}

/**
 * 从十六进制字符串解析 CAN 数据
 * 支持格式: "0B B8 FF 07" 或 "0BB8FF07"
 */
export function parseCanDataHex(hexStr: string): number[] {
  const cleaned = hexStr.replace(/\s/g, "").replace(/0x/gi, "");

  if (cleaned.length % 2 !== 0) {
    throw new Error("十六进制字符串长度必须是偶数");
  }

  const result: number[] = [];
  for (let i = 0; i < cleaned.length; i += 2) {
    const hex = cleaned.substring(i, i + 2);
    const byte = parseInt(hex, 16);
    if (isNaN(byte)) {
      throw new Error(`无效的十六进制字符: ${hex}`);
    }
    result.push(byte);
  }

  return result;
}

/**
 * 解析 8 字节的十六进制数据，转换为车速和转向角
 * 与后端 parse_control_data_4byte 函数逻辑一致
 *
 * 协议:
 * data[0-2] (小端序): 速度值 (20位) + 档位 (4位)
 *   - 低4位 (data[0] & 0x0F): 档位 (4=D档)
 *   - 高20位: 速度值 (mm/s)
 * data[3-4] (小端序, 16位补码): 转向角 (0.01度/count)
 * data[6-7]: 保留
 */
export function parseControlData4Byte(data: number[]): VehicleControl {
  if (data.length < 8) {
    throw new Error("输入数据长度必须至少是 8 字节");
  }

  const byte0 = data[0];
  const byte1 = data[1];
  const byte2 = data[2];
  const byte3 = data[3];
  const byte4 = data[4];

  // 1. 解析速度 (data[0-2], 小端序)
  // 高20位是速度值，低4位是档位
  const speedHighByte = ((byte2 & 0x0f) << 4) | ((byte1 >> 4) & 0x0f);
  const speedLowByte = ((byte1 & 0x0f) << 4) | ((byte0 >> 4) & 0x0f);

  // 组合成16位有符号整数 (Big-Endian)
  const speedRaw = (speedHighByte << 8) | speedLowByte;
  console.log("speedRaw", speedRaw);
  const linearVelocityMmsSigned =
    speedRaw > 32767 ? speedRaw - 65536 : speedRaw;

  // 2. 解析转向角 (data[3-4], 16位补码)
  // 从 data[4] data[3] data[2] 中提取：
  // - data[4] 的低4位作为高字节的高4位
  // - data[3] 作为高字节的低4位和低字节的高4位
  // - data[2] 的高4位作为低字节的低4位
  const highByte = ((byte4 & 0x0f) << 4) | ((byte3 >> 4) & 0x0f);
  const lowByte = ((byte3 & 0x0f) << 4) | ((byte2 >> 4) & 0x0f);

  // 组合成16位有符号整数 (Big-Endian)
  const angleRaw = (highByte << 8) | lowByte;
  const steeringAngleRawSigned = angleRaw > 32767 ? angleRaw - 65536 : angleRaw;

  // 3. 转换转向角单位: 从 0.01度 计数转换为 rad
  // 0.01度 = 0.01 * π/180 rad ≈ 0.0001745 rad
  const steeringAngleRad = (steeringAngleRawSigned * 0.01 * Math.PI) / 180.0;

  return {
    linear_velocity_mms: linearVelocityMmsSigned,
    steering_angle_rad: steeringAngleRad,
  };
}

/**
 * 从 CAN 数据字符串提取车速和转向角
 */
export function extractVehicleControl(canData: string): VehicleControl {
  const dataBytes = parseCanDataHex(canData);
  console.log("dataBytes", dataBytes);
  return parseControlData4Byte(dataBytes);
}

export interface CsvLoopProgress {
  /** 当前记录索引 */
  index: number;
  /** 总记录数 */
  total: number;
  /** CAN ID */
  can_id: string;
  /** CAN 数据 */
  can_data: string;
  /** 解析后的车辆控制数据 */
  vehicle_control: VehicleControl | null;
}

export interface RoadSegment {
  /** 路段索引 */
  index: number;
  /** 路段长度 (mm) */
  distance: number;
  /** 转向角度 (rad) */
  steering_angle: number;
  /** 速度 (mm/s) */
  speed: number;
  /** 路段类型: 'straight' | 'turn' */
  type: "straight" | "turn";
}

/**
 * 从 CSV 循环进度数据生成道路段
 */
export function generateRoadSegments(
  csvData: CsvLoopProgress[],
  segmentDistance: number = 100 // 每个路段的距离 (mm)
): RoadSegment[] {
  const segments: RoadSegment[] = [];

  for (let i = 0; i < csvData.length; i++) {
    const data = csvData[i];
    if (!data.vehicle_control) continue;

    const { linear_velocity_mms, steering_angle_rad } = data.vehicle_control;

    // 判断路段类型
    const type = Math.abs(steering_angle_rad) > 0.01 ? "turn" : "straight";

    segments.push({
      index: i,
      distance: segmentDistance,
      steering_angle: steering_angle_rad,
      speed: linear_velocity_mms,
      type,
    });
  }

  return segments;
}

/**
 * 计算累积距离
 */
export function calculateCumulativeDistance(segments: RoadSegment[]): number[] {
  const distances: number[] = [];
  let cumulative = 0;

  for (const segment of segments) {
    cumulative += segment.distance;
    distances.push(cumulative);
  }

  return distances;
}

/**
 * 获取指定距离处的路段信息
 */
export function getRoadSegmentAtDistance(
  segments: RoadSegment[],
  distance: number
): RoadSegment | null {
  let cumulative = 0;

  for (const segment of segments) {
    cumulative += segment.distance;
    if (distance <= cumulative) {
      return segment;
    }
  }

  return null;
}
