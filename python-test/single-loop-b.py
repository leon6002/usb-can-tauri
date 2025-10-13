import serial
import time
import threading


def custom_receiver(ser: serial.Serial):
    # Read data from serial port
    try:
        # set_can_configuration(ser, 0x02)
        while ser.is_open:
            print("looping...")
            print("block waiting serial port data")
            data = ser.read(2)
            print("serial port data received")
            hex_data1 = [hex(byte) for byte in data]
            if data and (data[0] == 0xaa) and (data[1] & 0xc0 == 0xc0):  # frame header
                print("data[1] is", data[1])
                len = data[1] & 0x0f
                if data[1] & 0x10 == 0x00:
                    strFrameFormat = "Data Frame"
                else:
                    strFrameFormat = "Remote Frame"

                if data[1] & 0x20 == 0x00:
                    strFrameType = "Standard Frame"
                    len2 = len + 3
                else:
                    strFrameType = "Extended Frame"
                    len2 = len + 5

                data2 = ser.read(len2)
                print("data2 is", data2)
                hex_data = [hex(byte) for byte in data2]
                hex_data1 += hex_data
                print(hex_data1)
                if data2[len2 - 1] == 0x55:  # end code
                    if strFrameType == "Standard Frame":
                        id = data2[1]
                        id <<= 8
                        id += data2[0]
                        strId = hex(id)

                        if len > 0:
                            CanData = hex_data[2:2 + len]
                        else:
                            CanData = ["No Data"]
                    else:
                        id = data2[3]
                        id <<= 8
                        id += data2[2]
                        id <<= 8
                        id += data2[1]
                        id <<= 8
                        id += data2[0]
                        strId = hex(id)
                        if len > 0:
                            CanData = hex_data[4:4 + len]
                        else:
                            CanData = ["No Data"]
                    print("Receive CAN id: " + strId + " Data:", end='')
                    print(CanData)
                    print(strFrameType + ", " + strFrameFormat)
                else:
                    print("Receive Packet header Error")
    except KeyboardInterrupt:
        print("\nReceiver stopped by user")
    finally:
        # Close serial port
        ser.close()
        print("Serial port closed")

def set_can_configuration(ser: serial.Serial, loop_mode):
    # 发送配置命令
    set_can_baudrate = [
        0xaa, 0x55, 0x12, 0x03, 0x02,
        0x00, 0x00, 0x00, 0x00,
        0x00, 0x00, 0x00, 0x00,
        loop_mode,  # 回环模式
        0x00, 0x00, 0x00, 0x00, 0x00
    ]
    
    checksum = sum(set_can_baudrate[2:]) & 0xff
    set_can_baudrate.append(checksum)
    
    print(f"set_can_configuration with {loop_mode}...")
    ser.write(bytes(set_can_baudrate))
    time.sleep(1)  # 等待配置生效

def main():
    try:
        ser = serial.Serial("COM23", 2000000)
        print(f"Connected to {ser.portstr}")
        
        set_can_configuration(ser, 0x02)
        # 启动调试接收线程
        # recv_thread = threading.Thread(target=debug_receiver_thread, args=(ser,))
        # recv_thread = threading.Thread(target=custom_receiver, args=(ser,))
        # recv_thread.daemon = True
        # recv_thread.start()
        
        # 发送测试数据
        test_frame = bytes([
            0xaa, 0xe8,  # 帧头 + 控制
            0x67, 0x45, 0x23, 0x01,  # ID (小端序)
            0x11, 0x22, 0x33, 0x44, 0x55, 0x66, 0x77, 0x88,  # 数据
            0x55  # 结束符
        ])
        
        print("Starting to send test frames...")
        count = 0
        while count < 1:  # 发送10次测试
            sent = ser.write(test_frame)
            print(f"→ Sent frame {count+1}, bytes: {sent}")
            count += 1
            time.sleep(1)  # 每秒发送一次
            
        print("Test completed")
        time.sleep(2)  # 等待最后的接收
        custom_receiver(ser)
        
    except Exception as e:
        print(f"Error: {e}")
    finally:
        if 'ser' in locals():
            # ser.close()
            print("ready to close port in sending")

if __name__ == "__main__":
    main()