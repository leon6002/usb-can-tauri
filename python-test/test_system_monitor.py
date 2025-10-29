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

import threading
import serial
import time
import random
from generator import DataGenerator, RadarDataGenerator, SmoothDataGenerator
import queue

def calculate_checksum(data):
    checksum = sum(data[2:])
    return checksum & 0xff

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
# 定义全局变量和线程安全的队列
stop_event = threading.Event()
# 线程安全的队列，用于存储待发送的完整数据包
SEND_QUEUE = queue.Queue() 

# --- 线程 1: 串口写入器 (Serial Writer) ---
# 负责打开串口，从队列中取出数据并发送
def serial_writer_thread(port_name: str, baud_rate: int):
    """专用的串口写入线程"""
    ser = None
    try:
        ser = serial.Serial(port_name, baud_rate, timeout=0.1)
        print(f"[Writer] ✅ 串口连接已建立到 {port_name}")
        
        while not stop_event.is_set():
            try:
                # 尝试从队列中获取数据包，等待 0.1 秒
                # timeout 避免线程在队列为空时被永久阻塞
                packet = SEND_QUEUE.get(timeout=0.1) 
                
                # 发送数据
                ser.write(bytes(packet))
                
                # 可选：打印发送信息
                # print(f"[Writer] 📤 发送数据包: {format_can_message(packet[:8])}...")
                
                # 通知队列任务完成
                SEND_QUEUE.task_done()
                
            except queue.Empty:
                # 队列为空时，继续循环检查 stop_event
                continue

    except serial.SerialException as e:
        print(f"[Writer] ❌ 致命串口错误: {e}")
    except Exception as e:
        print(f"[Writer] ❌ 发生未知错误: {e}")
        
    finally:
        if ser and ser.is_open:
            ser.close()
            print("[Writer] ✅ 串口已关闭")


# --- 线程 2 & 3: 数据生成器 (Data Generator) ---
# 负责生成数据并放入队列
def data_generator_thread(can_id: list, generator:DataGenerator, delay: float, message_name: str):
    """生成数据并将其放入发送队列"""
    
    # 构建 CAN 消息的固定部分
    packet_header = [0xaa, 0x55, 0x01, 0x01, 0x01] # 头部
    reserved = [0x00]

    try:
        while not stop_event.is_set():
            # 1. 生成 13 字节原始数据(CAN ID(4 byte) + data length(1 byte) + data(8 byte))
            raw_data = generator.generate_data()
            
            # 2. 构建完整数据包
            data_to_checksum = packet_header + raw_data + reserved
            packet_checksum = calculate_checksum(data_to_checksum)
            full_packet = data_to_checksum + [packet_checksum]
            
            # 3. 将完整数据包放入发送队列
            SEND_QUEUE.put(full_packet)
            
            # 4. 打印生成信息
            print(f"[{message_name}] ➕ 准备发送: CAN ID={format_can_message(can_id)}, Data={format_can_message(raw_data)}")
            
            # 5. 等待
            time.sleep(delay)
            
    except Exception as e:
        print(f"[{message_name}] ❌ 数据生成线程发生错误: {e}")


# --- 主控制函数 ---

def start_single_port_multi_sender(port_name="/dev/tty.usbserial-140", baud_rate=2000000):
    
    # 1. 串口写入线程 (SerialWriter) - 只有一个
    writer_thread = threading.Thread(
        target=serial_writer_thread, 
        args=(port_name, baud_rate),
        name="SerialWriter"
    )
    
    # 2. 数据生成线程 A: 系统监控 (CAN ID: 0x209)
    generatorA = SmoothDataGenerator()
    threadA = threading.Thread(
        target=data_generator_thread, 
        args=(
            [0x09, 0x02, 0x00, 0x00], # CAN ID 0x209
            generatorA, 
            0.05,                     # 100ms 频率
            "SYSTEM_MONITOR"
        ),
        name="GeneratorA"
    )
    
    # 3. 数据生成线程 B: 传感器数据 (CAN ID: 0x400)
    generatorB = RadarDataGenerator()
    threadB = threading.Thread(
        target=data_generator_thread, 
        args=(
            [0x00, 0x04, 0x00, 0x00], # CAN ID 0x400
            generatorB, 
            0.25,                     # 500ms 频率 (可以不同)
            "SENSOR_DATA"
        ),
        name="GeneratorB"
    )

    try:
        print("📊 启动单串口多数据源发送器...")
        
        # 启动所有线程
        writer_thread.start()
        threadA.start()
        threadB.start()

        print("按 Ctrl+C 停止所有线程\n")
        
        # 主线程等待
        while True:
            time.sleep(1)

    except KeyboardInterrupt:
        print("\n⏹️  正在请求所有线程安全停止...")
        stop_event.set() # 设置停止事件
        
    # 等待所有线程结束
    writer_thread.join()
    threadA.join()
    threadB.join()

    print("✅ 所有线程已安全退出。")
    
if __name__ == "__main__":
    
    start_single_port_multi_sender("/dev/tty.usbserial-2110")


