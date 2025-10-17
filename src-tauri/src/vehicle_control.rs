use std::convert::TryInto;
use serde::{Deserialize, Serialize};

/// 结构体用于存储解析后的控制数据
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct VehicleControl {
    /// 车体行进速度，单位 mm/s (Signed Int16)
    pub linear_velocity_mms: i16,
    /// 转向角度，单位 rad (Signed Int16, 0.001rad/count)
    pub steering_angle_rad: f32,
}

/// 解析 4 字节的十六进制数据，转换为车速和转向角。
///
/// 协议:
/// data[0], data[1]: 线速度高低八位 (signed int16, mm/s)
/// data[2], data[3]: 转角高低八位 (signed int16, 0.001rad)
///
/// # Arguments
/// * `data`: 包含 4 字节控制数据的数组。
///
/// # Returns
/// * `Result<VehicleControl, &'static str>`: 成功时返回 VehicleControl 结构体，
///   失败时返回错误信息（如果输入数据长度不正确）。
pub fn parse_control_data_4byte(data: &[u8]) -> Result<VehicleControl, &'static str> {
    // 检查输入数据长度是否为 4 字节
    if data.len() < 4 {
        return Err("输入数据长度必须至少是 4 字节");
    }

    // 1. 解析线速度 (data[0] 和 data[1])
    // 协议是 High-byte, Low-byte (大端序 Big-Endian)
    let linear_velocity_bytes: [u8; 2] = data[0..2].try_into().unwrap();
    // 使用 from_be_bytes 从大端序字节数组创建 i16
    let linear_velocity_mms = i16::from_be_bytes(linear_velocity_bytes);

    // 2. 解析转向角 (data[2] 和 data[3])
    // 协议是 High-byte, Low-byte (大端序 Big-Endian)
    let steering_angle_bytes: [u8; 2] = data[2..4].try_into().unwrap();
    // 使用 from_be_bytes 从大端序字节数组创建 i16 (单位是 0.001 rad)
    let steering_angle_raw = i16::from_be_bytes(steering_angle_bytes);

    // 3. 转换转向角单位: 从 0.001 rad 计数转换为 rad
    // Scale factor is 0.001
    let steering_angle_rad = steering_angle_raw as f32 * 0.001;

    // 4. 返回解析结果
    Ok(VehicleControl {
        linear_velocity_mms,
        steering_angle_rad,
    })
}

/// 从十六进制字符串解析 CAN 数据
/// 支持格式: "0B B8 FF 07" 或 "0BB8FF07"
pub fn parse_can_data_hex(hex_str: &str) -> Result<Vec<u8>, &'static str> {
    let cleaned = hex_str.replace(" ", "").replace("0x", "").replace("0X", "");
    
    if cleaned.len() % 2 != 0 {
        return Err("十六进制字符串长度必须是偶数");
    }

    cleaned
        .as_bytes()
        .chunks(2)
        .map(|chunk| {
            let hex_str = std::str::from_utf8(chunk)
                .map_err(|_| "Failed to convert byte chunk to string")?;
            u8::from_str_radix(hex_str, 16)
                .map_err(|_| "Invalid hex character")
        })
        .collect()
}

/// 从 CAN 数据字符串提取车速和转向角
pub fn extract_vehicle_control(can_data: &str) -> Result<VehicleControl, String> {
    let data_bytes = parse_can_data_hex(can_data)
        .map_err(|e| format!("Failed to parse CAN data: {}", e))?;
    
    parse_control_data_4byte(&data_bytes)
        .map_err(|e| format!("Failed to parse control data: {}", e))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_parse_control_data_4byte() {
        // 测试数据: 0B B8 FF 07
        let hex_data: [u8; 4] = [0x0B, 0xB8, 0xFF, 0x07];

        match parse_control_data_4byte(&hex_data) {
            Ok(control) => {
                println!("成功解析 4 字节控制数据:");
                println!("  原始十六进制数据: {:?}", hex_data);
                println!("  线速度 (mm/s): {}", control.linear_velocity_mms);
                println!("  转向角 (rad):   {:.3}", control.steering_angle_rad);
                
                assert_eq!(control.linear_velocity_mms, 3000);
                assert_eq!((control.steering_angle_rad * 1000.0).round() as i32, -249);
            }
            Err(e) => {
                panic!("解析失败: {}", e);
            }
        }
    }

    #[test]
    fn test_parse_can_data_hex() {
        let hex_str = "0B B8 FF 07";
        let result = parse_can_data_hex(hex_str).unwrap();
        assert_eq!(result, vec![0x0B, 0xB8, 0xFF, 0x07]);

        let hex_str2 = "0BB8FF07";
        let result2 = parse_can_data_hex(hex_str2).unwrap();
        assert_eq!(result2, vec![0x0B, 0xB8, 0xFF, 0x07]);
    }
}

