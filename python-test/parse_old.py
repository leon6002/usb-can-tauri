import csv
import struct
import math
from typing import List, Dict

# --- 核心解析函数 (与之前相同) ---

def hex_string_to_bytes(hex_str: str) -> bytes:
    """
    将十六进制字符串 (可能包含空格) 转换为 bytes 对象。
    例如: "0B B8 FF 07" -> b'\x0B\xB8\xFF\x07'
    """
    cleaned_hex = hex_str.replace(" ", "")
    if len(cleaned_hex) != 8:
        raise ValueError(f"十六进制字符串必须代表 4 字节 (8 个字符)，但收到 {len(cleaned_hex)} 个字符。")
        
    return bytes.fromhex(cleaned_hex)


def parse_control_data_4byte(hex_data: bytes) -> Dict[str, float]:
    """
    解析 4 字节的二进制数据，返回速度 (mm/s) 和弧度 (rad) 的字典。
    """
    if len(hex_data) != 4:
        raise ValueError(f"二进制数据长度必须是 4 字节，但收到了 {len(hex_data)} 字节。")

    # '>h' = Big-Endian (大端序) signed short (i16)
    linear_velocity_mms, = struct.unpack('>h', hex_data[0:2])
    steering_angle_raw, = struct.unpack('>h', hex_data[2:4])

    # 转换转向角单位: 0.001 rad/count -> rad
    steering_angle_rad = steering_angle_raw / 1000.0

    return {
        "linear_velocity_mms": linear_velocity_mms,
        "steering_angle_rad": steering_angle_rad,
    }


def read_and_parse_csv_by_index(input_file_path: str, output_file_path: str, hex_column_index: int = 7):
    """
    循环读取 CSV 文件中指定列的十六进制数据并解析，
    将车速写入第 9 列 (索引 8)，将角度写入第 10 列 (索引 9)。

    Args:
        input_file_path: 输入 CSV 文件路径。
        output_file_path: 输出 CSV 文件路径。
        hex_column_index: 包含十六进制数据的列索引 (从 0 开始计数，第 8 列为 7)。
    """
    
    # 定义新的速度和角度列的索引 (在原数据后追加)
    # 因为是追加，所以它们位于原始数据的长度之后
    parsed_speed_col_index = hex_column_index + 1
    parsed_angle_deg_col_index = hex_column_index + 2
    
    with open(input_file_path, 'r', newline='', encoding='utf-8') as infile, \
         open(output_file_path, 'w', newline='', encoding='utf-8') as outfile:
        
        reader = csv.reader(infile)
        writer = csv.writer(outfile)
        
        # 写入标题行
        try:
            header = next(reader)
            # 假设原始数据有 N 列，新的标题行为 N+2 列
            new_header = header + ['Parsed_Speed_mm_s', 'Parsed_Steering_Deg']
            writer.writerow(new_header)
        except StopIteration:
            # 文件为空，直接返回
            return
        
        # 循环处理数据行
        for row_number, row in enumerate(reader, start=2): # 从第 2 行开始计数
            
            # 创建一个可修改的新行，初始值为原行数据
            new_row = list(row)
            
            # 初始化新的两列数据 (None 或空字符串，方便写入)
            velocity_mms = None
            angle_deg = None
            
            if len(row) > hex_column_index:
                # 获取指定列的十六进制字符串
                hex_str = row[hex_column_index].strip()
                
                try:
                    # 1. 转换为 bytes 并解析
                    data_bytes = hex_string_to_bytes(hex_str)
                    parsed_data = parse_control_data_4byte(data_bytes)
                    
                    velocity_mms = parsed_data['linear_velocity_mms']
                    
                    # 2. 弧度转角度: 角度 = 弧度 * (180 / PI)
                    angle_deg = parsed_data['steering_angle_rad'] * (180 / math.pi)

                except ValueError as e:
                    # 解析错误，保留 None/NaN 或打印警告
                    print(f"警告: 第 {row_number} 行数据 '{hex_str}' 解析错误: {e}. 结果将设置为 'NaN'。")
                except Exception as e:
                    print(f"警告: 第 {row_number} 行未知错误: {e}. 结果将设置为 'NaN'。")
            else:
                print(f"警告: 第 {row_number} 行的列数不足 ({len(row)} 列)，无法读取索引 {hex_column_index} 的数据。")

            # 3. 将解析结果追加到新行末尾
            # Python 的 csv.writer 会将 None 写入空字符串，但我们这里直接使用解析值或 'NaN' 字符串
            new_row.append(f"{velocity_mms}" if velocity_mms is not None else 'NaN')
            new_row.append(f"{angle_deg:.3f}" if angle_deg is not None else 'NaN')
            
            # 4. 写入输出文件
            writer.writerow(new_row)

    print(f"\n✅ 数据处理完成。新数据已保存到: {output_file_path}")
    print(f"   车速 (mm/s) 保存在新文件的第 {parsed_speed_col_index + 1} 列。")
    print(f"   转向角 (度) 保存在新文件的第 {parsed_angle_deg_col_index + 1} 列。")


# --- 示例运行 ---

INPUT_FILE = 'test_data_full.csv'
OUTPUT_FILE = 'output_data_indexed.csv'
# 原始 CAN 数据在第 8 列，其索引为 7
CAN_DATA_INDEX = 7 

# 2. 执行处理
read_and_parse_csv_by_index(INPUT_FILE, OUTPUT_FILE, CAN_DATA_INDEX)

# 3. 打印输出文件内容以供验证
print("\n--- 输出文件内容验证 ---")
with open(OUTPUT_FILE, 'r', newline='', encoding='utf-8') as f:
    print(f.read())