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
    // 1. 处理速度 (16位有符号, 大端序)
    // 限制范围在 -32768 到 32767 之间
    const speed = Math.max(-32768, Math.min(32767, Math.round(speedMms)));

    // 2. 处理转向角 (16位有符号, 大端序)
    // 角度 * 1000, 限制范围
    const angle = Math.max(-32768, Math.min(32767, Math.round(angleDeg * 1000)));

    const buffer = new ArrayBuffer(4);
    const view = new DataView(buffer);

    // 设置速度 (Byte 0-1)
    view.setInt16(0, speed, false); // false = Big Endian

    // 设置转向角 (Byte 2-3)
    view.setInt16(2, angle, false); // false = Big Endian

    const bytes = new Uint8Array(buffer);

    // 转换为十六进制字符串
    return Array.from(bytes)
        .map(b => b.toString(16).toUpperCase().padStart(2, '0'))
        .join(' ');
}
