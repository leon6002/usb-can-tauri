import serial
import time
import threading


def custom_receiver(ser, stop_event):
    """改进的接收函数，包含更完善的错误处理"""
    print("start receive")
    buffer = bytearray()
    try:
        while not stop_event.is_set():
            try:
                # 使用非阻塞方式读取
                if ser.in_waiting > 0:
                    data = ser.read(ser.in_waiting)
                    buffer.extend(data)
                    
                    # 处理缓冲区中的数据
                    while len(buffer) >= 2:
                        # 查找帧头
                        if buffer[0] == 0xaa and (buffer[1] & 0xc0 == 0xc0):
                            len_val = buffer[1] & 0x0f
                            
                            if buffer[1] & 0x20 == 0x00:
                                frame_length = len_val + 3 + 2  # 标准帧：数据长度 + 3 + 帧头2字节
                            else:
                                frame_length = len_val + 5 + 2  # 扩展帧：数据长度 + 5 + 帧头2字节
                            
                            # 检查是否收到完整帧
                            if len(buffer) >= frame_length:
                                # 提取完整帧
                                frame_data = buffer[:frame_length]
                                buffer = buffer[frame_length:]
                                
                                # 解析帧
                                parse_can_frame(frame_data)
                            else:
                                break  # 数据不完整，等待更多数据
                        else:
                            # 帧头不匹配，丢弃第一个字节
                            print(f"Invalid header: {hex(buffer[0])} {hex(buffer[1])}")
                            buffer.pop(0)
                
                time.sleep(0.01)  # 短暂休眠，避免CPU占用过高
                
            except Exception as e:
                print(f"Error in receiver loop: {e}")
                time.sleep(0.1)
                
    except Exception as e:
        print(f"Receiver thread error: {e}")


def parse_can_frame(frame_data):
    """解析CAN帧数据"""
    try:
        if len(frame_data) < 2:
            return
            
        hex_data = [hex(byte) for byte in frame_data]
        print(f"Raw frame: {hex_data}")
        
        # 解析帧头
        if (frame_data[0] == 0xaa) and (frame_data[1] & 0xc0 == 0xc0):
            len_val = frame_data[1] & 0x0f
            
            if frame_data[1] & 0x10 == 0x00:
                strFrameFormat = "Data Frame"
            else:
                strFrameFormat = "Remote Frame"

            if frame_data[1] & 0x20 == 0x00:
                strFrameType = "Standard Frame"
                data_start = 2
                id_bytes = 2
            else:
                strFrameType = "Extended Frame"
                data_start = 2
                id_bytes = 4

            # 检查帧结束符
            if frame_data[-1] == 0x55:
                # 提取ID
                if strFrameType == "Standard Frame":
                    id_val = (frame_data[3] << 8) | frame_data[2]
                    data_bytes = frame_data[4:4+len_val] if len_val > 0 else []
                else:
                    id_val = (frame_data[5] << 24) | (frame_data[4] << 16) | (frame_data[3] << 8) | frame_data[2]
                    data_bytes = frame_data[6:6+len_val] if len_val > 0 else []
                
                strId = hex(id_val)
                CanData = [hex(byte) for byte in data_bytes] if data_bytes else ["No Data"]
                
                print(f"Receive CAN id: {strId} Data: {CanData}")
                print(f"{strFrameType}, {strFrameFormat}")
            else:
                print("Invalid frame end marker")
        else:
            print("Invalid frame header")
            
    except Exception as e:
        print(f"Error parsing frame: {e}")


def send_configuration(ser):
    """发送配置命令"""
    try:
        set_can_baudrate = bytes([
            0xaa, 0x55, 0x12, 0x03, 0x02,
            0x00, 0x00, 0x00, 0x00,
            0x00, 0x00, 0x00, 0x00,
            0x02,  # 回环模式
            0x00, 0x00, 0x00, 0x00, 0x00,
            0x00  # 校验位先设为0
        ])
        
        # 计算校验和
        checksum = sum(set_can_baudrate[2:-1]) & 0xff
        config_frame = set_can_baudrate[:-1] + bytes([checksum])
        
        print("Sending configuration...")
        ser.write(config_frame)
        time.sleep(1)  # 等待配置生效
        
        # 清空输入缓冲区
        ser.reset_input_buffer()
        print("Configuration sent and buffer cleared")
        
    except Exception as e:
        print(f"Configuration error: {e}")


def main():
    stop_event = threading.Event()
    ser = None
    
    try:
        # 初始化串口
        ser = serial.Serial(
            port="COM22",
            baudrate=2000000,
            timeout=0.1,
            write_timeout=1
        )
        print(f"Connected to {ser.portstr}")
        
        # 发送配置
        send_configuration(ser)
        
        # 启动接收线程
        recv_thread = threading.Thread(target=custom_receiver, args=(ser, stop_event))
        recv_thread.daemon = True
        recv_thread.start()
        
        # 测试帧
        test_frame = bytes([
            0xaa, 0xe8,        # 帧头 + 控制 (扩展帧，数据帧，8字节数据)
            0x67, 0x45, 0x23, 0x01,  # ID (小端序)
            0x11, 0x22, 0x33, 0x44, 0x55, 0x66, 0x77, 0x88,  # 数据
            0x55  # 结束符
        ])
        
        print("Starting test...")
        for count in range(10):
            if stop_event.is_set():
                break
                
            try:
                sent = ser.write(test_frame)
                print(f"→ Sent frame {count+1}, bytes: {sent}")
                time.sleep(1)
            except Exception as e:
                print(f"Send error: {e}")
                break
                
        print("Test completed")
        time.sleep(2)
        
    except Exception as e:
        print(f"Main error: {e}")
    finally:
        print("Cleaning up...")
        stop_event.set()
        time.sleep(1)
        if ser and ser.is_open:
            ser.close()
        print("Done")


if __name__ == "__main__":
    main()