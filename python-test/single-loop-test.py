import serial
import time
import threading

def calculate_checksum(data):
    checksum = sum(data[2:])
    return checksum & 0xff

def receiver_thread(ser):
    """独立的接收线程"""
    print("Receiver thread started...")
    while True:
        if ser.in_waiting >= 2:
            data = ser.read(2)
            if (data[0] == 0xaa) and (data[1] & 0xc0 == 0xc0):
                # 解析帧类型和数据长度
                frame_len = data[1] & 0x0f
                if data[1] & 0x20 == 0x00:  # 标准帧
                    total_len = frame_len + 3
                else:  # 扩展帧
                    total_len = frame_len + 5
                
                # 读取剩余数据
                remaining_data = ser.read(total_len)
                full_frame = data + remaining_data
                
                # 解析ID和数据
                if data[1] & 0x20 == 0x00:  # 标准帧
                    can_id = (remaining_data[1] << 8) + remaining_data[0]
                    can_data = remaining_data[2:2+frame_len]
                else:  # 扩展帧
                    can_id = (remaining_data[3] << 24) + (remaining_data[2] << 16) + \
                            (remaining_data[1] << 8) + remaining_data[0]
                    can_data = remaining_data[4:4+frame_len]
                
                print(f"← RECV: ID=0x{can_id:08X}, Data={can_data.hex()}")

def main():
    # 初始化串口
    ser = serial.Serial("COM22", 2000000)
    print(f"Connected to {ser.portstr}")
    
    # 配置CAN转换器为回环模式
    set_can_baudrate = [
        0xaa, 0x55, 0x12, 0x03, 0x02,  # 头 + 类型 + 500kbps + 扩展帧
        0x00, 0x00, 0x00, 0x00, 0x00,  # 过滤器
        0x00, 0x00, 0x00, 0x00, 
        0x02,  # 回环模式 (关键修改)
        0x00, 0x00, 0x00, 0x00, 0x00   # 其他参数
    ]
    
    checksum = calculate_checksum(set_can_baudrate)
    set_can_baudrate.append(checksum)
    ser.write(bytes(set_can_baudrate))
    print("CAN configured to loopback mode")
    time.sleep(1)
    
    # 启动接收线程
    recv_thread = threading.Thread(target=receiver_thread, args=(ser,))
    recv_thread.daemon = True
    recv_thread.start()
    
    # 主线程发送数据
    try:
        test_id = 0x01234567
        test_data = [0x11, 0x22, 0x33, 0x44, 0x55, 0x66, 0x77, 0x88]
        
        while True:
            # 构建CAN数据帧
            can_frame = bytes([
                0xaa, 0xe8,  # 帧头 + 控制 (扩展帧, 8字节数据)
                0x67, 0x45, 0x23, 0x01,  # CAN ID (小端序)
                0x11, 0x22, 0x33, 0x44, 0x55, 0x66, 0x77, 0x88,  # 数据
                0x55  # 结束符
            ])
            
            ser.write(can_frame)
            print(f"→ SEND: ID=0x{test_id:08X}, Data={bytes(test_data).hex()}")
            time.sleep(1)  # 每秒发送一次
            
    except KeyboardInterrupt:
        print("\nTest stopped by user")
    finally:
        print('ready to close')
        ser.close()

if __name__ == "__main__":
    main()