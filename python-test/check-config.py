import serial
import time

def check_configuration():
    """发送配置并检查响应"""
    ser = serial.Serial("COM22", 2000000, timeout=1)
    
    # 配置命令 - 确保回环模式设置正确
    set_can_baudrate = [
        0xaa, 0x55, 0x12, 0x03, 0x02,  # 头 + 类型 + 500kbps + 扩展帧
        0x00, 0x00, 0x00, 0x00, 0x00,  # 过滤器ID
        0x00, 0x00, 0x00, 0x00,        # 掩码ID
        0x02,  # CAN模式: 0x02 = 回环模式 (关键!)
        0x00, 0x00, 0x00, 0x00, 0x00   # 其他参数
    ]
    
    # 计算校验和
    checksum = sum(set_can_baudrate[2:]) & 0xff
    set_can_baudrate.append(checksum)
    
    print("Sending configuration command...")
    ser.write(bytes(set_can_baudrate))
    
    # 等待可能的响应
    time.sleep(0.5)
    
    # 检查是否有响应数据
    if ser.in_waiting > 0:
        response = ser.read(ser.in_waiting)
        print(f"Configuration response: {response.hex()}")
    else:
        print("No response to configuration command")
    
    ser.close()

if __name__ == "__main__":
    check_configuration()