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
 * 字节0低4位：目标档位 (00: disable, 01: P, 02: R, 03: N, 04: D)
 * 字节0高4位 + 字节1：目标车体速度 (16位, Unsigned, 精度0.001 m/s)
 * 字节2-3：目标车体转向角 (16位, signed, 精度0.01°)
 */
export function parseVehicleStatus8Byte(data: number[]): VehicleStatus {
  if (data.length < 4) {
    throw new Error("输入数据长度必须至少是 4 字节");
  }

  const byte0 = data[0];
  const byte1 = data[1];
  const byte2 = data[2];
  const byte3 = data[3];

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

  // 解析速度 (字节0的高4位 + 字节1，共16位，精度0.001 m/s)
  // 字节0高4位是速度的低4位，字节1是速度的高8位
  // 速度值 = (byte1 << 4) | (byte0 >> 4)
  const speedRaw = (byte1 << 4) | ((byte0 >> 4) & 0x0f);
  const speed = speedRaw * 1; // 精度0.001 m/s = 1 mm/s

  // 解析转向角 (字节2-3，16位 signed Little-Endian，精度0.01°)
  // byte2 是低字节，byte3 是高字节
  const angleRaw = byte2 | (byte3 << 8);
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
 * 解析 4 字节的十六进制数据，转换为车速和转向角
 * 协议:
 * data[0], data[1]: 线速度高低八位 (signed int16, mm/s)
 * data[2], data[3]: 转角高低八位 (signed int16, 0.001rad)
 */
export function parseControlData4Byte(data: number[]): VehicleControl {
  if (data.length < 4) {
    throw new Error("输入数据长度必须至少是 4 字节");
  }

  // 解析线速度 (data[0] 和 data[1]) - Big-Endian
  const linearVelocityBytes = [data[0], data[1]];
  const linearVelocityMms =
    (linearVelocityBytes[0] << 8) | linearVelocityBytes[1];
  // 转换为有符号整数
  const linearVelocityMmsSigned =
    linearVelocityMms > 32767 ? linearVelocityMms - 65536 : linearVelocityMms;

  // 解析转向角 (data[2] 和 data[3]) - Big-Endian
  const steeringAngleBytes = [data[2], data[3]];
  const steeringAngleRaw = (steeringAngleBytes[0] << 8) | steeringAngleBytes[1];
  // 转换为有符号整数
  const steeringAngleRawSigned =
    steeringAngleRaw > 32767 ? steeringAngleRaw - 65536 : steeringAngleRaw;

  // 转换转向角单位: 从 0.001 rad 计数转换为 rad
  const steeringAngleRad = steeringAngleRawSigned * 0.001;

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
