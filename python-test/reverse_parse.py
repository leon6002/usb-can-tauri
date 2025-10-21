import struct
import math

def build_vehicle_control_data(gear: int, linear_velocity_mms: int, steering_angle_raw: int, alive_counter: int = 0) -> str:
    """
    根据提供的非标准位域交叉逻辑，反向构建FR_mini的控制指令数据报文。

    参数:
        gear (int): 档位原始值 (0x00=disable, 0x01=P, 0x02=R, 0x03=N, 0x04=D)。
        linear_velocity_mms (int): 速度值 (单位: mm/s)。
        steering_angle_raw (int): 转向角原始值 (单位: 0.01 degree, 16位有符号整数)。
        alive_counter (int): 心跳计数器 (0-255)。

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



# --- 待反向解析的参数 ---
TARGET_GEAR = 0x04          # D 档
TARGET_VELOCITY_MMS = 3000  # 1200 mm/s
TARGET_ANGLE_RAW = -95 # 1600 (0.01 degree)
ALIVE_COUNTER = 0           # 心跳计数

# 执行反向解析
try:
    hex_string_spaced = build_vehicle_control_data(
        gear=TARGET_GEAR,
        linear_velocity_mms=TARGET_VELOCITY_MMS,
        steering_angle_raw=TARGET_ANGLE_RAW,
        alive_counter=ALIVE_COUNTER
    )
    
    print(f"输入参数:")
    print(f"  档位 (D档): {TARGET_GEAR}")
    print(f"  速度 (mm/s): {TARGET_VELOCITY_MMS}")
    print(f"  转向角 (0.01°): {TARGET_ANGLE_RAW}")
    print(f"  心跳 (Alive Counter): {ALIVE_COUNTER}")
    print("-" * 30)
    print(f"反向解析结果 (8字节 Hex): {hex_string_spaced}")
    
except Exception as e:
    print(f"反向解析出错: {e}")