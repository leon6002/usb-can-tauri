import struct
import math

def parse_vehicle_control_data(data: bytes) -> dict:
    """
    根据提供的非标准位域交叉逻辑，解析FR_mini的控制指令数据。

    数据: 04 4B 00 64 00 00 00 2B

    参数:
        data (bytes): 8字节的CAN数据报文。

    返回:
        dict: 包含档位、速度和转向角信息的字典。
    """
    if len(data) < 8:
        raise ValueError("输入数据长度必须至少是 8 字节")

    # 0. 解析档位 (data[0]的低4位)
    # -----------------------------------------------------------
    gear_raw = data[0] & 0x0F
    gear_name = {
        0x00: "disable",
        0x01: "P (Parking)",
        0x02: "R (Reverse)",
        0x03: "N (Neutral)",
        0x04: "D (Drive)",
    }.get(gear_raw, "Unknown")

    # 1. 解析速度 (data[0-2], 小端序)
    # 速度值是data[0], data[1], data[2]组成的小端序u32，然后右移4位。
    # 原始单位: mm/s
    # -----------------------------------------------------------
    # 构建 u32: data[2] data[1] data[0] + 0x00
    # struct.unpack('<I', data[0:3] + b'\x00') 实现了小端序 u32 的转换
    speed_raw_u32 = struct.unpack('<I', data[0:3] + b'\x00')[0]
    
    # 右移4位，移除档位信息，得到16位的速度值 (i16)
    # 注意：虽然是 i16，但在这里我们将其视为一个正整数 (u16)
    linear_velocity_mms = (speed_raw_u32 & 0x0FFFF0) >> 4
    
    # 转换为 m/s
    linear_velocity_mps = linear_velocity_mms / 1000.0

    # 2. 解析转向角 (data[2-4]的位域交叉重构, 16位补码)
    # 原始单位: 0.01 degree
    # -----------------------------------------------------------
    
    # 提取位域:
    # High Byte: data[4](3:0) | data[3](7:4)
    high_byte = ((data[4] & 0x0F) << 4) | ((data[3] >> 4) & 0x0F)
    
    # Low Byte: data[3](3:0) | data[2](7:4)
    low_byte = ((data[3] & 0x0F) << 4) | ((data[2] >> 4) & 0x0F)
    
    # 组合为大端序 16 位整数 (i16)
    # 将 high_byte 和 low_byte 组合成 2 字节并解析为有符号 i16
    # struct.unpack('>h', ...): '>'代表大端序，'h'代表 signed short (i16)
    angle_bytes = struct.pack('BB', high_byte, low_byte)
    steering_angle_raw = struct.unpack('>h', angle_bytes)[0]
    
    # 3. 转换转向角单位
    # 0.01度/bit -> degree
    steering_angle_deg = steering_angle_raw * 0.01
    
    # degree -> radian: rad = deg * (pi / 180)
    steering_angle_rad = steering_angle_deg * (math.pi / 180.0)

    return {
        "data_hex": data.hex().upper(),
        "gear_raw": gear_raw,
        "gear_name": gear_name,
        "linear_velocity_mms": linear_velocity_mms,
        "linear_velocity_mps": linear_velocity_mps,
        "steering_angle_raw": steering_angle_raw,
        "steering_angle_deg": steering_angle_deg,
        "steering_angle_rad": steering_angle_rad,
    }

# 待解析数据
# hex_data = "044B00640000002B"
hex_data = "84BB10FA0F0000DA"
data_bytes = bytes.fromhex(hex_data)

# 解析
try:
    result = parse_vehicle_control_data(data_bytes)
    
    print(f"数据报文: {result['data_hex']}")
    print("-" * 30)
    print("【档位解析】")
    print(f"原始值: 0x{result['gear_raw']:02X}")
    print(f"档位名称: {result['gear_name']}")
    print("-" * 30)
    print("【速度解析】")
    print(f"原始速度 (mm/s): {result['linear_velocity_mms']}")
    print(f"速度 (m/s): {result['linear_velocity_mps']:.3f} m/s")
    print("-" * 30)
    print("【转向角解析】")
    print(f"原始值 (0.01°/bit): {result['steering_angle_raw']}")
    print(f"转向角 (degree): {result['steering_angle_deg']:.2f} degrees")
    print(f"转向角 (radian): {result['steering_angle_rad']:.4f} rad")
    
except ValueError as e:
    print(f"解析错误: {e}")