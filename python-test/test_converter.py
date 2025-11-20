import math
import struct
from parse_old import parse_control_data_4byte

def generate_control_data_hex(linear_velocity_mms: int, steering_angle_rad: float) -> str:
    """
    根据给定的线速度(mm/s)和转向角(弧度)生成4字节的控制数据，并以十六进制字符串形式返回。
    
    Args:
        linear_velocity_mms: 线速度，单位 mm/s
        steering_angle_rad: 转向角，单位 弧度
        
    Returns:
        8字符的十六进制字符串，表示4字节的控制数据
    """
    # 限制速度在short范围内(-32768到32767)
    linear_velocity_mms = max(-32768, min(32767, linear_velocity_mms))
    
    # 将弧度转换为原始值(乘以1000)
    steering_angle_raw = int(round(steering_angle_rad * 1000))
    # 限制转向角在short范围内(-32768到32767)
    steering_angle_raw = max(-32768, min(32767, steering_angle_raw))
    
    # 使用大端序打包为4字节
    data_bytes = struct.pack('>hh', linear_velocity_mms, steering_angle_raw)
    
    # 转换为十六进制字符串(无空格)
    hex_str = data_bytes.hex().upper()
    
    return hex_str

def main():
    # 测试
    linear_velocity_mms = 1600
    steering_angle_rad = -0.805
    hex_str = generate_control_data_hex(linear_velocity_mms, steering_angle_rad)
    print(hex_str)
    res = parse_control_data_4byte(bytes.fromhex(hex_str))
    print(res)

def deg_to_rad(degrees):
    """
    将角度转换为弧度
    
    参数:
    degrees -- 角度值
    
    返回:
    对应的弧度值
    """
    return math.radians(degrees)

def rad_to_deg(radians):
    """
    将弧度转换为角度
    
    参数:
    radians -- 弧度值
    
    返回:
    对应的角度值
    """
    return math.degrees(radians)

if __name__ == '__main__':
    # 测试
    main()
    # 04 64 C0 DF 0E 00 00 71
    # res = deg_to_rad(-46.14)
    # res = rad_to_deg(-0.805)
    # print(res)

    
