def hex_dec_converter(value, target_type='dec', signed=True, bit_width=16):
    """
    十六进制和十进制之间的转换器，支持有符号和无符号。

    参数:
    value: 待转换的值。可以是十六进制字符串（如 'F63C'）或十进制整数（如 -2500）。
    target_type (str): 目标转换类型。'dec' 表示转为十进制，'hex' 表示转为十六进制。
    signed (bool): 
        - True (默认): 进行有符号 (补码) 转换。
        - False: 进行无符号转换。
    bit_width (int): 转换时使用的位宽。默认为 16 位 (2 字节)。
    
    返回:
    转换后的值（str 或 int），如果输入无效则返回 None。
    """
    
    max_unsigned = 2**bit_width
    max_signed = 2**(bit_width - 1) - 1
    min_signed = -2**(bit_width - 1)

    try:
        if target_type == 'dec':
            # --- 从十六进制转为十进制 ---
            # 移除 '0x' 前缀并确保是大写
            hex_str = str(value).strip().upper()
            if hex_str.startswith('0X'):
                hex_str = hex_str[2:]
            
            # 先按无符号方式解析其数值
            unsigned_val = int(hex_str, 16)
            
            if not signed:
                # 无符号转换：直接返回数值
                return unsigned_val
            else:
                # 有符号转换 (补码)
                if unsigned_val > max_signed:
                    # 如果数值大于最大正数 (即符号位为 1)，则为负数
                    # 负数 = 数值 - 2^bit_width
                    signed_val = unsigned_val - max_unsigned
                else:
                    # 如果数值小于等于最大正数 (即符号位为 0)，则为正数
                    signed_val = unsigned_val
                return signed_val

        elif target_type == 'hex':
            # --- 从十进制转为十六进制 ---
            dec_val = int(value)
            
            if not signed:
                # 无符号转换
                if dec_val < 0 or dec_val >= max_unsigned:
                    raise ValueError(f"无符号模式下，十进制值 {dec_val} 超出 {bit_width} 位无符号范围 [0, {max_unsigned - 1}]。")
                
                # 直接转换为十六进制字符串，并填充到所需的位宽
                return f"{dec_val:0{bit_width//4}X}"
            
            else:
                # 有符号转换 (补码)
                if dec_val < min_signed or dec_val > max_signed:
                    raise ValueError(f"有符号模式下，十进制值 {dec_val} 超出 {bit_width} 位有符号范围 [{min_signed}, {max_signed}]。")

                if dec_val >= 0:
                    # 正数：直接转换为十六进制
                    val_to_convert = dec_val
                else:
                    # 负数：转换为其补码表示 (值 = 2^bit_width + 负数)
                    val_to_convert = max_unsigned + dec_val

                # 转换为十六进制字符串，并填充到所需的位宽
                return f"{val_to_convert:0{bit_width//4}X}"

        else:
            print("错误: target_type 必须是 'dec' 或 'hex'。")
            return None

    except ValueError as e:
        print(f"转换失败: 无效的输入或超出范围。\n错误信息: {e}")
        return None
    except Exception as e:
        print(f"发生未知错误: {e}")
        return None

# --- 示例用法 ---
print("="*40)
print("--- 示例 1: 十六进制转十进制 (16位) ---")

# 1. 示例：文档中的 -25度 对应的 Hex
hex_val_neg = input() # 对应十进制 -2500

# 有符号转换
dec_signed = hex_dec_converter(hex_val_neg, target_type='dec', signed=True, bit_width=16)
print(f"Hex '{hex_val_neg}' (16-bit Signed) -> Dec: {dec_signed}")

# 无符号转换
dec_unsigned = hex_dec_converter(hex_val_neg, target_type='dec', signed=False, bit_width=16)
print(f"Hex '{hex_val_neg}' (16-bit Unsigned) -> Dec: {dec_unsigned}")
