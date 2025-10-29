#!/usr/bin/env python3
"""
系统监控测试数据生成脚本
生成 CAN ID 0x209 的测试消息

数据格式：
- DATA[0]: CPU1 利用率 (0-100)
- DATA[1]: CPU2 利用率 (0-100)
- DATA[2]: CPU3 利用率 (0-100)
- DATA[3]: Memory 利用率 (0-100)
- DATA[4]: 转向控制状态 (0=红, 1=黄, 2=绿)
- DATA[5]: 制动控制状态 (0=红, 1=黄, 2=绿)
- DATA[6]: 车身控制状态 (0=红, 1=黄, 2=绿)
- DATA[7]: 空气调节系统 (0=红, 1=黄, 2=绿)
"""

import serial
import time
import random
from generator import SmoothDataGenerator


def calculate_checksum(data):
    checksum = sum(data[2:])
    return checksum & 0xff
def generate_test_data():
    """生成测试数据"""
    # CPU 利用率 (0-100)
    cpu1 = random.randint(10, 80)
    cpu2 = random.randint(10, 80)
    cpu3 = random.randint(10, 80)
    
    # 内存利用率 (0-100)
    memory = random.randint(30, 90)
    
    # 系统状态 (0=红, 1=黄, 2=绿)
    steering = random.randint(0, 2)
    brake = random.randint(0, 2)
    body = random.randint(0, 2)
    ac = random.randint(0, 2)
    return [cpu1, cpu2, cpu3, memory, 2, 2, 2, 2]
    # return [cpu1, cpu2, cpu3, memory, steering, brake, body, ac]

def format_can_message(data):
    """格式化 CAN 消息"""
    # 转换为十六进制字符串
    hex_data = " ".join(f"{byte:02X}" for byte in data)
    return hex_data

def send_test_message(port_name="/dev/tty.usbserial-140", baud_rate=2000000):
    """发送测试消息"""
    try:
        ser = serial.Serial(port_name, baud_rate, timeout=1)
        print(f"✅ 已连接到 {port_name}")
        
        # 发送 CAN 配置命令（如果需要）
        # 这里假设已经配置好了
        
        print("📊 开始发送系统监控测试数据...")
        print("按 Ctrl+C 停止\n")
        generator = SmoothDataGenerator()
        
        while True:
            # 生成测试数据
            # data = generate_test_data()
            data = generator.generate_test_data()
            hex_data = format_can_message(data)
            
            # 构建 CAN 消息
            packet_header = [
                0xaa,     # 0  Packet header
                0x55,     # 1  Packet header
                0x01,     # 类型
                0x01,     # 框架类型 0x01-标准帧 0x02-扩展帧
                0x01,     # 框架格式
            ]
            packet_id = [0x09, 0x02, 0x00, 0x00]
            packet_data = data
            data_length = [0x08]
            reserved = [0x00]
            data_to_checksum = packet_header + packet_id + data_length + packet_data + reserved
            packet_checksum = calculate_checksum(data_to_checksum)
            packet = data_to_checksum + [packet_checksum]
            print(f"full packet: {format_can_message(packet)}")
            # 发送消息
            ser.write(bytes(packet))
            
            # 打印信息
            print(f"📤 发送: CAN ID=0x209, Data={hex_data}")
            print(f"   CPU1={data[0]}%, CPU2={data[1]}%, CPU3={data[2]}%, Memory={data[3]}%")
            print(f"   转向={data[4]}, 制动={data[5]}, 车身={data[6]}, AC={data[7]}")
            print()
            
            # 等待 1 秒
            time.sleep(0.1)
            
    except serial.SerialException as e:
        print(f"❌ 串口错误: {e}")
    except KeyboardInterrupt:
        print("\n⏹️  已停止")
    finally:
        if 'ser' in locals() and ser.is_open:
            ser.close()
            print("✅ 串口已关闭")

if __name__ == "__main__":
    # 获取可用的串口
    # import serial.tools.list_ports
    
    # ports = serial.tools.list_ports.comports()
    # if not ports:
    #     print("❌ 未找到可用的串口")
    #     exit(1)
    
    # print("📋 可用的串口:")
    # for i, port in enumerate(ports):
    #     print(f"  {i}: {port.device} - {port.description}")
    
    # while True:
    #     input_index_str = input("请选择串口序号: ")
    #     try:
    #         # 1. 尝试将输入字符串转换为整数
    #         input_index = int(input_index_str)
            
    #         # 2. 检查索引是否在有效范围内
    #         if 0 <= input_index < len(ports):
    #             # 找到选定的端口设备名
    #             port_name = ports[input_index].device
    #             print(f"✅ 已选择串口: {port_name}")
    #             break  # 退出循环
    #         else:
    #             print(f"❌ 序号 '{input_index}' 超出范围，请重新输入 0 到 {len(ports) - 1} 之间的数字。")
                
    #     except ValueError:
    #         # 3. 捕获非数字输入
    #         print("❌ 输入无效，请输入数字序号。")
    
    send_test_message("/dev/tty.usbserial-2110")
    
    result: list = generate_test_data()
    for r in result:
        print(r, end=" ")

