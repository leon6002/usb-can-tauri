def debug_receiver_thread(ser):
    """带调试信息的接收线程"""
    print("Debug receiver started...")
    packet_count = 0
    
    while True:
        try:
            # 检查可用数据
            available = ser.in_waiting
            if available > 0:
                print(f"Available bytes: {available}")
                
                # 只读1个字节来检查帧头
                first_byte = ser.read(1)
                if first_byte[0] == 0xaa:
                    print("Found frame header 0xaa")
                    # 读取第二个字节
                    second_byte = ser.read(1)
                    print(f"Second byte: 0x{second_byte[0]:02x}")
                    
                    if second_byte[0] & 0xc0 == 0xc0:
                        print("Valid frame type detected")
                        # 解析长度
                        frame_len = second_byte[0] & 0x0f
                        is_extended = (second_byte[0] & 0x20) != 0
                        
                        if is_extended:
                            total_needed = frame_len + 5  # ID(4) + data + end
                        else:
                            total_needed = frame_len + 3  # ID(2) + data + end
                        
                        print(f"Frame length: {frame_len}, Total needed: {total_needed}")
                        
                        # 读取剩余数据
                        remaining = ser.read(total_needed)
                        full_data = first_byte + second_byte + remaining
                        
                        print(f"Full frame: {full_data.hex()}")
                        
                        # 检查结束符
                        if remaining[-1] == 0x55:
                            print("✓ Valid frame with correct end marker")
                            packet_count += 1
                            print(f"Total packets received: {packet_count}")
                        else:
                            print(f"✗ Invalid end marker: 0x{remaining[-1]:02x}")
                    else:
                        print("Invalid frame type")
                else:
                    # 如果不是0xaa，继续读取直到找到帧头或缓冲区清空
                    remaining_data = ser.read(available - 1)
                    print(f"Non-header data: {(first_byte + remaining_data).hex()}")
            else:
                time.sleep(0.01)  # 短时间等待
                
        except Exception as e:
            print(f"Receiver error: {e}")
            break
