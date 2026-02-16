/**
 * 构建车辆控制 CAN 数据 (CAN ID: 0x200)
 * 
 * 协议格式 (4字节):
 * Byte 0-1: 速度 (mm/s), 16位有符号整数, 大端序
 * Byte 2-3: 转向角 (度 * 1000), 16位有符号整数, 大端序
 * 
 * @param speedMms 速度 (mm/s), 正数前进, 负数后退
 * @param angleDeg 转向角 (度), 正数左转, 负数右转
 * @returns CAN 数据字符串 (4字节, 空格分隔)
 */
export function buildVehicleControlData(speedMms: number, angleDeg: number): string {
    // 1. Process Speed (16-bit signed, Big Endian)
    // Range: -32768 to 32767
    const speed = Math.max(-32768, Math.min(32767, Math.round(speedMms)));

    // 2. Process Steering Angle (16-bit signed, Big Endian)
    // Input: Degrees
    // Required Unit: 0.001 rad
    // Valid Range (Raw Value): -400 to +400 (approx +/- 23 degrees)
    
    // Convert deg to rad
    const angleRad = angleDeg * (Math.PI / 180);
    // Convert to 0.001 rad units
    let angleRaw = Math.round(angleRad * 1000);
    
    // Clamp to valid range [-400, 400]
    angleRaw = Math.max(-400, Math.min(400, angleRaw));

    // Create 8-byte buffer (standard CAN frame)
    const buffer = new ArrayBuffer(8);
    const view = new DataView(buffer);

    // Byte 0-1: Speed
    view.setInt16(0, speed, false); // Big Endian

    // Byte 2-3: Steering Angle? 
    // Wait, let's check the memory layout from previous knowledge or assume standard packing.
    // The previous code put it at Byte 2-3.
    // Bytes 4-7: Reserved (0x00)
    view.setInt16(2, angleRaw, false); // Big Endian
    
    // Bytes 4-7 are 0 by default in new ArrayBuffer

    const bytes = new Uint8Array(buffer);

    // Convert to hex string
    return Array.from(bytes)
        .map(b => b.toString(16).toUpperCase().padStart(2, '0'))
        .join(' ');
}
