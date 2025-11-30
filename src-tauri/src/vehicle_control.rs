use serde::{Deserialize, Serialize};

/// 结构体用于存储解析后的控制数据
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct VehicleControl {
    /// 车体行进速度，单位 mm/s (Signed Int16)
    pub linear_velocity_mms: i16,
    /// 转向角度 (degree)
    pub steering_angle: f32,
    /// 档位名称 (P/D/R) - 根据速度推断
    pub gear_name: String,
}

/// 解析车辆控制数据 (4字节标准帧)
///
/// 协议:
/// Byte 0-1: 速度 (mm/s), 16位有符号整数, 大端序
/// Byte 2-3: 转向角 (度 * 1000), 16位有符号整数, 大端序
///
/// # Arguments
/// * `data`: 包含至少 4 字节控制数据的数组。
///
/// # Returns
/// * `Result<VehicleControl, &'static str>`: 成功时返回 VehicleControl 结构体
pub fn parse_vehicle_control_data(data: &[u8]) -> Result<VehicleControl, &'static str> {
    // 检查输入数据长度是否至少为 4 字节
    if data.len() < 4 {
        return Err("输入数据长度必须至少是 4 字节");
    }

    // 1. 解析速度 (Byte 0-1, i16 Big Endian)
    let linear_velocity_mms = i16::from_be_bytes([data[0], data[1]]);

    // 2. 解析转向角 (Byte 2-3, i16 Big Endian)
    let steering_angle_raw = i16::from_be_bytes([data[2], data[3]]);

    // 3. 转换转向角单位: 从 0.001度 计数转换为 degree
    // 1 count = 0.001 度
    let steering_angle = steering_angle_raw as f32 * 0.001;

    // 4. 推断档位
    // 速度 > 0: D
    // 速度 < 0: R
    // 速度 = 0: P
    let gear_name = if linear_velocity_mms > 0 {
        "D".to_string()
    } else if linear_velocity_mms < 0 {
        "R".to_string()
    } else {
        "P".to_string()
    };

    log::info!(
        "Parsed Vehicle Control: Bytes={:02X?}, Speed={}mm/s, Angle={:.3}, Gear={}",
        &data[0..4],
        linear_velocity_mms,
        steering_angle,
        gear_name
    );

    Ok(VehicleControl {
        linear_velocity_mms,
        steering_angle,
        gear_name,
    })
}

/// 从十六进制字符串解析 CAN 数据
/// 支持格式: "0B B8 46 50" 或 "0BB84650"
pub fn parse_can_data_hex(hex_str: &str) -> Result<Vec<u8>, &'static str> {
    let cleaned = hex_str.replace(" ", "").replace("0x", "").replace("0X", "");

    if cleaned.len() % 2 != 0 {
        return Err("十六进制字符串长度必须是偶数");
    }

    cleaned
        .as_bytes()
        .chunks(2)
        .map(|chunk| {
            let hex_str =
                std::str::from_utf8(chunk).map_err(|_| "Failed to convert byte chunk to string")?;
            u8::from_str_radix(hex_str, 16).map_err(|_| "Invalid hex character")
        })
        .collect()
}

/// 从 CAN 数据字符串提取车速和转向角
pub fn extract_vehicle_control(can_data: &str) -> Result<VehicleControl, String> {
    let data_bytes =
        parse_can_data_hex(can_data).map_err(|e| format!("Failed to parse CAN data: {}", e))?;

    parse_vehicle_control_data(&data_bytes)
        .map_err(|e| format!("Failed to parse control data: {}", e))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_parse_vehicle_control_data() {
        // 测试数据 1: 0B B8 46 50
        // 速度: 0B B8 = 3000 mm/s
        // 转向角: 46 50 = 18000 -> 18度
        let hex_data: [u8; 4] = [0x0B, 0xB8, 0x46, 0x50];
        match parse_vehicle_control_data(&hex_data) {
            Ok(control) => {
                println!("成功解析控制数据:");
                println!("  线速度 (mm/s): {}", control.linear_velocity_mms);
                println!("  转向角 (deg):   {:.4}", control.steering_angle);
                println!("  档位: {}", control.gear_name);

                assert_eq!(control.linear_velocity_mms, 3000);
                assert_eq!(control.gear_name, "D");
                // 18度
                let expected_angle = 18.0;
                assert!((control.steering_angle - expected_angle).abs() < 0.0001);
            }
            Err(e) => panic!("解析失败: {}", e),
        }

        // 测试数据 2: F4 48 AA 10
        // 速度: F4 48 = -3000 mm/s
        // 转向角: AA 10 = 43536 -> -22000 -> -22度
        let hex_data2: [u8; 4] = [0xF4, 0x48, 0xAA, 0x10];
        match parse_vehicle_control_data(&hex_data2) {
            Ok(control) => {
                assert_eq!(control.linear_velocity_mms, -3000);
                assert_eq!(control.gear_name, "R");
                let expected_angle = -22.0;
                assert!((control.steering_angle - expected_angle).abs() < 0.0001);
            }
            Err(e) => panic!("解析失败: {}", e),
        }
    }
}
