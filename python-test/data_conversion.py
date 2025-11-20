import struct
from typing import Dict



TARGET_GEAR = 0x04  # D 档 (4 bits)
ALIVE_COUNTER_STEP = 0x10 # 心跳计数器步长 (16)

def parse_control_data_4byte(hex_data: bytes) -> Dict[str, float]:
    """
    解析 4 字节的二进制数据，返回速度 (mm/s) 和弧度 (rad) 的字典。
    """
    if len(hex_data) != 4:
        raise ValueError(f"二进制数据长度必须是 4 字节，但收到了 {len(hex_data)} 字节。")

    # '>h' = Big-Endian (大端序) signed short (i16)
    linear_velocity_mms, = struct.unpack('>h', hex_data[0:2])
    steering_angle_raw, = struct.unpack('>h', hex_data[2:4])

    return {
        "linear_velocity_mms": int(linear_velocity_mms),
        "steering_angle_rad": int(steering_angle_raw),
    }


def build_vehicle_control_data(gear: int, linear_velocity_mms: int, steering_angle_raw: int, alive_counter: int, debug: bool = False) -> str:
    """
    根据用户提供的新位域交叉逻辑，反向构建控制指令数据报文。
    
    新位域定义:
    - Speed (16 bits): data[2]<3..0> | data[1]<7..0> | data[0]<7..4>
    - Gear (4 bits): data[0]<3..0>
    - Angle (16 bits, Signed): data[4]<3..0> | data[3]<7..0> | data[2]<7..4>
    
    参数:
        gear (int): 档位原始值 (0x04=D档)。
        linear_velocity_mms (int): 速度值 (单位: mm/s)。
        steering_angle_raw (int): 转向角原始值 (单位: 0.01 degree, 16位有符号整数)。
        alive_counter (int): 心跳计数器 (0x00, 0x10, ..., 0xF0 循环)。
    
    返回:
        str: 8字节的CAN数据报文十六进制字符串，字节间用空格分隔。
    """
    
    # --- 1. 组合 data[0], data[1], data[2] (档位和速度) ---
    # 原始 u32 = (速度值 << 4) | 档位值
    speed_shifted = linear_velocity_mms << 4
    raw_u32 = speed_shifted | (gear & 0x0F)
    
    # 转换为 4 字节的小端序，只取前 3 字节
    raw_bytes = struct.pack('<I', raw_u32)
    data0 = raw_bytes[0]
    data1 = raw_bytes[1]
    data2 = raw_bytes[2]
    
    # --- 2. 组合 data[2], data[3], data[4] (转向角) ---
    # 转向角 (steering_angle_raw) 是一个 i16，需要分解为 high_byte 和 low_byte
    angle_bytes = struct.pack('>h', steering_angle_raw)
    high_byte = angle_bytes[0]
    low_byte = angle_bytes[1]
    
    # 逆向重构 data[2], data[3], data[4] 的位域
    
    # 重构 data[4] (data[4]的低4位是 high_byte 的高4位)
    data4 = (high_byte >> 4) & 0x0F
    
    # 重构 data[3] (data[3]的高4位是 high_byte 的低4位，低4位是 low_byte 的高4位)
    data3 = ((high_byte & 0x0F) << 4) | (low_byte >> 4)
    
    # 重构 data[2] (data[2]的高4位是 low_byte 的低4位)，与步骤 1 的 data[2] 进行或操作
    data2 = data2 | ((low_byte & 0x0F) << 4)
    
    # --- 3. 填充 data[5] 和 data[6] ---
    data5 = 0x00  # Target Vehicle Braking (假设 0x00 为无制动)
    data6 = alive_counter & 0xFF  # Alive Rolling Counter
    
    # --- 4. 组合前 7 字节并计算校验和 (BCC) ---
    payload = [data0, data1, data2, data3, data4, data5, data6]
    
    # 计算 BCC (异或校验)
    bcc = 0
    for byte in payload:
        bcc ^= byte
    
    data7 = bcc
    
    # --- 5. 组合成最终的 8 字节报文 ---
    final_data = bytes(payload + [data7])
    
    # 转换为十六进制字符串，并用空格分隔
    hex_string_spaced = ' '.join([f'{b:02X}' for b in final_data])
    
    return hex_string_spaced

def convert_to_new_protocol(hex_data_4_bytes: bytes, alive_counter) -> bytes:

    
    """
    将原始的 4 字节控制数据转换为新的 8 字节协议格式。
    """
    res: {int, int}= parse_control_data_4byte(hex_data_4_bytes)
    print(res)

    speedMs = int(res.get('linear_velocity_mms'))
    rad = res.get('steering_angle_rad') / 1000
    print(f"弧度: {rad}")
    deg = rad_to_deg(rad)
    print(f"角度: {deg}")
    steering_angle_raw = int(deg * 100)
    print(f"转向角原始值: {steering_angle_raw}")

    hex_data = build_vehicle_control_data(
                        gear=TARGET_GEAR,
                        linear_velocity_mms=speedMs,
                        steering_angle_raw=steering_angle_raw,
                        alive_counter=alive_counter
                    )
    # 更新心跳计数器 (00 -> 10 -> ... -> F0 -> 00 循环)
    alive_counter = (alive_counter + ALIVE_COUNTER_STEP) % 0x100
    return {
        "can_id":"0x18C4D2D0",
        "can_data": hex_data,
    }

def rad_to_deg(rad):
    return rad * 180 / 3.141592653589793


def main():
    # hex_data = b'\x0b\xb8\xff\x07'
    hex_data = b'\x0b\xb8\xff\x07'
    result = convert_to_new_protocol(hex_data, 0)
    print(result)

if __name__ == "__main__":
    main()