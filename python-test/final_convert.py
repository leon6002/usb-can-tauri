import struct
import math
import csv
import os

# 定义 16 位有符号整数的限制，用于转向角原始值
I16_MIN = -32768
I16_MAX = 32767

def build_vehicle_control_data(gear: int, linear_velocity_mms: int, steering_angle_raw: int, alive_counter: int, debug: bool = False) -> str:
    """
    根据用户提供的新位域交叉逻辑，反向构建控制指令数据报文。
    
    新位域定义:
    - Speed (16 bits): data[2]<3..0> | data[1]<7..0> | data[0]<7..4>
    - Gear (4 bits): data[0]<3..0>
    - Angle (16 bits, Signed): data[4]<3..0> | data[3]<7..0> | data[2]<7..4>
    
    参数:
        gear (int): 档位原始值 (0x04=D档)。
        linear_velocity_mms (int): 速度值 (单位: mm/s)。
        steering_angle_raw (int): 转向角原始值 (单位: 0.01 degree, 16位有符号整数)。
        alive_counter (int): 心跳计数器 (0x00, 0x10, ..., 0xF0 循环)。
    
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

def export_to_csv(data: list, output_filepath: str):
    """将处理后的数据列表写入 CSV 文件。"""
    if not data:
        print("没有数据可导出。")
        return

    fieldnames = list(data[0].keys())
    
    try:
        with open(output_filepath, mode='w', newline='', encoding='utf-8') as file:
            writer = csv.DictWriter(file, fieldnames=fieldnames)
            writer.writeheader()
            writer.writerows(data)
        print(f"\n✅ 成功导出数据到文件: {output_filepath}")
    except Exception as e:
        print(f"导出 CSV 文件失败: {e}")


def process_csv_to_can(input_filepath: str, output_filepath: str):
    """
    读取CSV文件，处理speed和angle列，生成CAN报文，并导出到新的CSV文件。
    """
    
    # 固定参数
    TARGET_GEAR = 0x04  # D 档 (4 bits)
    ALIVE_COUNTER_STEP = 0x10 # 心跳计数器步长 (16)
    
    # 单位转换常量
    SPEED_M_S_TO_MM_S = 1000
    ANGLE_DEG_TO_RAW = 100
    
    # 心跳计数器初始化
    alive_counter = 0 
    output_data = []


    try:
        if not os.path.exists(input_filepath):
            print(f"错误: 找不到输入文件 '{input_filepath}'。请创建一个示例文件。")
            return

        with open(input_filepath, mode='r', encoding='utf-8') as file:
            reader = csv.DictReader(file)
            
            if 'speed' not in reader.fieldnames or 'angle' not in reader.fieldnames:
                print("错误: CSV文件必须包含 'speed' 和 'angle' 两列。")
                return

            print("\n" + "=" * 70)
            print(f"开始处理 CSV 数据 (第一行启用调试输出)...")
            print("=" * 70)
            
            for row_index, row in enumerate(reader):
                
                    
                try:
                    linear_velocity_mms = int(float(row['speed']))

                    angle_deg = float(row['angle'])
                    steering_angle_raw = int(angle_deg * ANGLE_DEG_TO_RAW)
                    
                    # 生成 Hex 数据，第一行启用调试
                    hex_data = build_vehicle_control_data(
                        gear=TARGET_GEAR,
                        linear_velocity_mms=linear_velocity_mms,
                        steering_angle_raw=steering_angle_raw,
                        alive_counter=alive_counter
                    )
                    
                    # 记录结果
                    raw_angle_value = int(angle_deg * ANGLE_DEG_TO_RAW)
                    clamped_status = "No"
                    if raw_angle_value > I16_MAX or raw_angle_value < I16_MIN:
                        clamped_status = "Yes"
                        
                    output_data.append({
                        "Index": row_index + 1,
                        "Speed_mm/s": f"{linear_velocity_mms}",
                        "Angle_deg": f"{angle_deg:.2f}",
                        "Angle_Clamped": clamped_status,
                        "AliveCounter_Hex": f"{alive_counter:02X}",
                        "HexData": hex_data
                    })
                    
                    # 更新心跳计数器 (00 -> 10 -> ... -> F0 -> 00 循环)
                    alive_counter = (alive_counter + ALIVE_COUNTER_STEP) % 0x100

                except ValueError as e:
                    print(f"警告: 第 {row_index + 1} 行数据转换错误 (值: {row})。跳过。错误: {e}")
                
            # 打印处理结果到控制台
            print("\n" + "=" * 70)
            print(f"数据处理完成，共 {len(output_data)} 行数据。")
            
            # 6. 导出数据到 CSV
            export_to_csv(output_data, output_filepath)
            
    except Exception as e:
        print(f"处理文件时发生未预期的错误: {e}")

if __name__ == "__main__":
    input_csv_file_path = '/Users/cgl/codes/zheng-related/usb-can-tauri/python-test/input.csv'
    output_csv_file_path = 'can_output6.csv'
    
    # 检查示例文件是否存在，如果不存在则提示用户创建
    if not os.path.exists(input_csv_file_path):
        print(f"注意: 找不到 '{input_csv_file_path}' 文件。")
        print("请创建一个名为 'input.csv' 的文件，其中包含 'speed' (m/s) 和 'angle' (deg) 两列。")
        print("--- 示例内容 ---")
        print("speed,angle")
        print("3.0,10.0") # Speed 3000 mm/s, Angle 1000 (0x03E8)
        print("0.5,-5.0")
        print("----------------")
    else:
        process_csv_to_can(input_csv_file_path, output_csv_file_path)
