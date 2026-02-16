//! CAN 协议相关的函数
//! 包括：配置、发送、接收、解析等功能

use anyhow::{anyhow, Result};
use log::info;

use crate::SerialConfig;

/// 创建 CAN 配置数据包
///
/// 根据配置参数生成 CAN 配置命令数据包
pub fn create_can_config_packet(config: &SerialConfig) -> Vec<u8> {
    info!("Creating CAN config packet");

    let mut packet = vec![0xAA, 0x55]; // Header
    let protocol_length_config = if config.protocol_length == "fixed" {
        0x02
    } else {
        0x12
    };
    packet.push(protocol_length_config); // Config command

    // CAN baud rate config
    let baud_config = match config.can_baud_rate {
        5000 => 0x0c,    // 5kbps
        10000 => 0x0b,   // 10kbps
        20000 => 0x0a,   // 20kbps
        50000 => 0x09,   // 50kbps
        100000 => 0x08,  // 100kbps
        125000 => 0x07,  // 125kbps
        200000 => 0x06,  // 200kbps
        250000 => 0x05,  // 250kbps
        400000 => 0x04,  // 400kbps
        500000 => 0x03,  // 500kbps
        800000 => 0x02,  // 800kbps
        1000000 => 0x01, // 1Mbps
        _ => 0x03,       // Default 500K
    };
    packet.push(baud_config);

    // Frame type: standard=0x01, extended=0x02
    let frame_type_config = if config.frame_type == "extended" {
        0x02
    } else {
        0x01
    };
    packet.push(frame_type_config);

    // Filter ID (4 bytes) + Mask ID (4 bytes)
    packet.extend_from_slice(&[0x00, 0x00, 0x00, 0x00]);
    packet.extend_from_slice(&[0x00, 0x00, 0x00, 0x00]);

    // CAN mode: normal=0x00, silent=0x01, loopback=0x02, loopback_silent=0x03
    let can_mode_config = match config.can_mode.as_str() {
        "normal" => 0x00,
        "silent" => 0x01,
        "loopback" => 0x02,
        "loopback_silent" => 0x03,
        _ => 0x00,
    };
    packet.push(can_mode_config);

    // Auto resend + reserved bytes
    packet.push(0x00);
    packet.extend_from_slice(&[0x00, 0x00, 0x00, 0x00]);

    // Calculate checksum
    let checksum: u8 = packet[2..].iter().map(|&b| b as u32).sum::<u32>() as u8 & 0xFF;
    packet.push(checksum);

    info!(
        "Config packet: {:02X?} (length: {} bytes)",
        packet,
        packet.len()
    );
    packet
}

/// 创建 CAN 发送数据包（固定20字节协议）
///
/// 根据 CAN ID 和数据生成发送数据包
pub fn create_can_send_packet_fixed(id: &str, data: &str, frame_type: &str) -> Result<Vec<u8>> {
    // info!("Creating CAN send packet (fixed) - ID: {}, Data: {}, Type: {}", id, data, frame_type);

    // Parse data - handle both single hex values and space-separated hex values
    let mut data_bytes: Vec<u8> = if data.contains(' ') {
        // Space-separated hex values like "11 22 33 44"
        data.split_whitespace()
            .map(|s| u8::from_str_radix(s, 16))
            .collect::<Result<Vec<u8>, _>>()
            .map_err(|_| anyhow!("Invalid space-separated hex data"))?
    } else {
        // Continuous hex string like "11223344"
        let len = data.len();
        if len % 2 != 0 {
            return Err(anyhow!("Data string is not space-separated and has an odd length, expected two hex digits per byte."));
        }

        data.as_bytes()
            .chunks(2)
            .map(|chunk| {
                let hex_str = std::str::from_utf8(chunk)
                    .map_err(|_| anyhow!("Failed to convert byte chunk to string"))?;
                u8::from_str_radix(hex_str, 16)
                    .map_err(|_| anyhow!("Invalid continuous hex data: {}", hex_str))
            })
            .collect::<Result<Vec<u8>, _>>()?
    };

    // info!("Using original data bytes: {:02X?} (length: {})", data_bytes, data_bytes.len());

    if data_bytes.len() > 8 {
        return Err(anyhow!("CAN data length cannot exceed 8 bytes"));
    }

    // Fill in the 8 digits with 00 at the end
    while data_bytes.len() < 8 {
        data_bytes.push(0x00);
    }

    // Parse CAN ID
    let id_hex_part = id
        .strip_prefix("0x")
        .or_else(|| id.strip_prefix("0X"))
        .unwrap_or(id);
    let can_id = if id_hex_part.is_empty() {
        0x18C4D2D0
    } else {
        u32::from_str_radix(id_hex_part, 16)
            .map_err(|_| anyhow!("Invalid CAN ID format: \"{}\"", id))?
    };

    // info!("Input CAN ID: 0x{:08X}", can_id);

    // Use user-specified frame type
    let is_extended = frame_type == "extended";
    // info!("CAN ID 0x{:08X} -> {} frame (user-specified)", can_id, frame_type);

    // Validate CAN ID based on frame type
    if !is_extended {
        // Standard frame: CAN ID must be 11-bit (0x000 - 0x7FF)
        if can_id > 0x7FF {
            return Err(anyhow!(
                "Invalid CAN ID for standard frame: 0x{:X}. Standard frame CAN ID must be <= 0x7FF (11-bit)",
                can_id
            ));
        }
    } else {
        // Extended frame: CAN ID must be 29-bit (0x00000000 - 0x1FFFFFFF)
        if can_id > 0x1FFFFFFF {
            return Err(anyhow!(
                "Invalid CAN ID for extended frame: 0x{:X}. Extended frame CAN ID must be <= 0x1FFFFFFF (29-bit)",
                can_id
            ));
        }
    }

    // Header: 0xAA, 0x55, 0x01, [frame_type], 0x01
    let frame_type_byte = if is_extended { 0x02 } else { 0x01 };
    let mut packet = vec![0xAA, 0x55, 0x01, frame_type_byte, 0x01];

    // CAN ID: always 4 bytes (little-endian)
    let id_bytes = can_id.to_le_bytes().to_vec();
    packet.extend_from_slice(&id_bytes);
    // info!("CAN ID bytes (4 bytes, little-endian): {:02X?}", id_bytes);

    // Data length: fixed 8 bytes, but special case for 0x421 (Enable CAN Mode) which requires DLC=1
    if can_id == 0x421 {
        packet.push(0x01);
    } else {
        packet.push(0x08);
    }

    // Data content
    packet.extend_from_slice(&data_bytes);
    // info!("Added data bytes: {:02X?}", data_bytes);

    // Reserved byte
    packet.push(0x00);
    let checksum: u8 = packet[2..].iter().map(|&b| b as u32).sum::<u32>() as u8 & 0xFF;
    packet.push(checksum);

    // info!("Send packet: {:02X?} (length: {} bytes)", packet, packet.len());
    Ok(packet)
}

/// 创建 CAN 发送数据包（可变长度协议）
///
/// 协议格式：
/// - 字节0: 0xAA (起始标志)
/// - 字节1: 控制字节
///   - bit7-6: 保留
///   - bit5: 1=扩展帧, 0=标准帧
///   - bit4: 0=数据帧, 1=远程帧
///   - bit3-0: 数据长度 (0-8)
/// - 字节2-3 (标准帧) 或 字节2-5 (扩展帧): CAN ID (小端序)
/// - 字节N-M: CAN 数据 (可变长度)
/// - 最后一字节: 0x55 (结束标志)
///
/// 例子：
/// 标准帧8字节: AA C8 23 01 11 22 33 44 55 66 77 88 55
/// 标准帧2字节: AA C2 03 01 11 22 55
/// 扩展帧8字节: AA E8 67 45 23 01 11 22 33 44 55 66 77 88 55
/// 扩展帧2字节: AA E2 21 30 03 01 11 22 55
pub fn create_can_send_packet_variable(id: &str, data: &str, frame_type: &str) -> Result<Vec<u8>> {
    // info!("Creating CAN send packet (variable) - ID: {}, Data: {}, Type: {}", id, data, frame_type);

    // Parse data - handle both single hex values and space-separated hex values
    let data_bytes: Vec<u8> = if data.contains(' ') {
        // Space-separated hex values like "11 22 33 44"
        data.split_whitespace()
            .map(|s| u8::from_str_radix(s, 16))
            .collect::<Result<Vec<u8>, _>>()
            .map_err(|_| anyhow!("Invalid space-separated hex data"))?
    } else {
        // Continuous hex string like "11223344"
        let len = data.len();
        if len % 2 != 0 {
            return Err(anyhow!("Data string is not space-separated and has an odd length, expected two hex digits per byte."));
        }

        data.as_bytes()
            .chunks(2)
            .map(|chunk| {
                let hex_str = std::str::from_utf8(chunk)
                    .map_err(|_| anyhow!("Failed to convert byte chunk to string"))?;
                u8::from_str_radix(hex_str, 16)
                    .map_err(|_| anyhow!("Invalid continuous hex data: {}", hex_str))
            })
            .collect::<Result<Vec<u8>, _>>()?
    };

    let data_len = data_bytes.len();
    if data_len > 8 {
        return Err(anyhow!("CAN data length cannot exceed 8 bytes"));
    }

    // info!("Using data bytes: {:02X?} (length: {})", data_bytes, data_len);

    // Parse CAN ID
    let id_hex_part = id
        .strip_prefix("0x")
        .or_else(|| id.strip_prefix("0X"))
        .unwrap_or(id);
    let can_id = if id_hex_part.is_empty() {
        0x18C4D2D0
    } else {
        u32::from_str_radix(id_hex_part, 16)
            .map_err(|_| anyhow!("Invalid CAN ID format: \"{}\"", id))?
    };

    // info!("Input CAN ID: 0x{:08X}", can_id);

    // Determine if extended frame
    let is_extended = frame_type == "extended";
    // info!("CAN ID 0x{:08X} -> {} frame (user-specified)", can_id, frame_type);

    // Validate CAN ID based on frame type
    if !is_extended {
        // Standard frame: CAN ID must be 11-bit (0x000 - 0x7FF)
        if can_id > 0x7FF {
            return Err(anyhow!(
                "Invalid CAN ID for standard frame: 0x{:X}. Standard frame CAN ID must be <= 0x7FF (11-bit)",
                can_id
            ));
        }
    } else {
        // Extended frame: CAN ID must be 29-bit (0x00000000 - 0x1FFFFFFF)
        if can_id > 0x1FFFFFFF {
            return Err(anyhow!(
                "Invalid CAN ID for extended frame: 0x{:X}. Extended frame CAN ID must be <= 0x1FFFFFFF (29-bit)",
                can_id
            ));
        }
    }

    // Build packet
    let mut packet = vec![0xAA]; // Start flag

    // Control byte: bit7-6=11, bit5=frame_type, bit4=0(data frame), bit3-0=data_length
    // Standard frame: 0xC0 | data_len (11000000 | data_len)
    // Extended frame: 0xE0 | data_len (11100000 | data_len)
    let control_byte = if is_extended {
        0xE0 | (data_len as u8) // bit5=1 for extended frame
    } else {
        0xC0 | (data_len as u8) // bit5=0 for standard frame
    };
    packet.push(control_byte);
    // info!("Control byte: 0x{:02X} (extended={}, data_len={})", control_byte, is_extended, data_len);

    // CAN ID (little-endian)
    if is_extended {
        // Extended frame: 4 bytes
        let id_bytes = can_id.to_le_bytes();
        packet.extend_from_slice(&id_bytes);
    // info!("Extended CAN ID bytes (4 bytes, little-endian): {:02X?}", id_bytes);
    } else {
        // Standard frame: 2 bytes (only lower 16 bits)
        let id_u16 = (can_id & 0xFFFF) as u16;
        let id_bytes = id_u16.to_le_bytes();
        packet.extend_from_slice(&id_bytes);
        // info!("Standard CAN ID bytes (2 bytes, little-endian): {:02X?}", id_bytes);
    }

    // Data content
    packet.extend_from_slice(&data_bytes);
    // info!("Added data bytes: {:02X?}", data_bytes);

    // End flag
    packet.push(0x55);

    // info!("Send packet (variable): {:02X?} (length: {} bytes)", packet, packet.len());
    Ok(packet)
}

/// 解析接收到的 CAN 消息（固定20字节协议）
///
/// 协议格式（20字节）:
/// - 字节0: 数据包报头 (0xAA)
/// - 字节1: 数据包报头 (0x55)
/// - 字节2: 类型 (0x01)
/// - 字节3: 框架类型 (0x01)
/// - 字节4: 框架模式 (0x01)
/// - 字节5-8: CAN ID (4字节, 小端序)
/// - 字节9: 数据长度 (0x08)
/// - 字节10-17: CAN数据 (8字节)
/// - 字节18: 保留 (0x00)
/// - 字节19: 检查代码 (校验和)
pub fn parse_received_can_message(data: &[u8]) -> Option<(String, String, String)> {
    if data.len() < 20 {
        println!("❌ [Parse] Data too short: {} bytes (need 20)", data.len());
        return None;
    }

    if data[0] != 0xAA || data[1] != 0x55 {
        println!(
            "❌ [Parse] Invalid frame header: {:02X} {:02X}",
            data[0], data[1]
        );
        return None;
    }

    // println!("🔍 [Parse] Fixed 20-byte protocol");
    // println!("🔍 [Parse] Type: 0x{:02X}, Frame Type: 0x{:02X}, Frame Mode: 0x{:02X}",
    //  data[2], data[3], data[4]);

    // Parse frame type (byte 3)
    // 0x01 = Standard frame, 0x02 = Extended frame
    let frame_type_byte = data[3];
    let frame_type = match frame_type_byte {
        0x01 => "standard",
        0x02 => "extended",
        _ => "unknown",
    };
    // println!("🔍 [Parse] Frame Type: {} (0x{:02X})", frame_type, frame_type_byte);

    // Parse CAN ID (bytes 5-8, little-endian)
    let can_id = (data[5] as u32)
        | ((data[6] as u32) << 8)
        | ((data[7] as u32) << 16)
        | ((data[8] as u32) << 24);

    // println!("🔍 [Parse] CAN ID bytes: {:02X} {:02X} {:02X} {:02X} -> 0x{:08X}",
    //  data[5], data[6], data[7], data[8], can_id);

    // Data length (byte 9)
    let data_len = data[9] as usize;
    // println!("🔍 [Parse] Data length: {}", data_len);

    if data_len > 8 {
        println!("❌ [Parse] Invalid data length: {} (max 8)", data_len);
        return None;
    }

    // Extract CAN data (bytes 10-17)
    let can_data = data[10..10 + data_len]
        .iter()
        .map(|b| format!("{:02X}", b))
        .collect::<Vec<_>>()
        .join(" ");

    // println!("🔍 [Parse] CAN Data: {}", can_data);

    // Verify checksum (byte 19)
    let checksum_received = data[19];
    let checksum_calculated: u8 = data[2..19].iter().map(|&b| b as u32).sum::<u32>() as u8;

    // println!("🔍 [Parse] Checksum - Received: 0x{:02X}, Calculated: 0x{:02X}",
    //  checksum_received, checksum_calculated);

    if checksum_received != checksum_calculated {
        println!("⚠️  [Parse] Checksum mismatch!");
    }

    let can_id_str = format!("0x{:08X}", can_id);
    // println!("✅ [Parse] Successfully parsed - ID: {}, Data: {}, Frame Type: {}", can_id_str, can_data, frame_type);
    Some((can_id_str, can_data, frame_type.to_string()))
}

/// 从 CAN 数据中解析距离值（取最后两个字节）
pub fn parse_distance_from_data(data: &str) -> u16 {
    let bytes: Vec<&str> = data.split_whitespace().collect();
    if bytes.len() >= 2 {
        let last_two = format!("{}{}", bytes[bytes.len() - 2], bytes[bytes.len() - 1]);
        if let Ok(distance) = u16::from_str_radix(&last_two, 16) {
            return distance;
        }
    }
    0
}

/// 解析新协议的8字节数据 (auto_spd_ctrl_cmd)
///
/// 根据协议文档表 4-3：
/// - 字节0低4位：目标档位 (00: disable, 01: P, 02: R, 03: N, 04: D)
/// - 字节0高4位 + 字节1：目标车体速度 (16位, Unsigned, 精度0.001 m/s)
/// - 字节2-3：目标车体转向角 (16位, signed, 精度0.01°)
pub fn parse_vehicle_status_8byte(data: &str) -> Option<(String, f32)> {
    let bytes: Vec<&str> = data.split_whitespace().collect();
    if bytes.len() < 4 {
        println!(
            "⚠️  [Parse] Not enough bytes for vehicle status: {}",
            bytes.len()
        );
        return None;
    }

    let byte0 = u8::from_str_radix(bytes[0], 16).ok()?;
    let byte1 = u8::from_str_radix(bytes[1], 16).ok()?;
    let byte2 = u8::from_str_radix(bytes[2], 16).ok()?;
    let byte3 = u8::from_str_radix(bytes[3], 16).ok()?;

    // Parse gear (byte 0 low 4 bits)
    let gear_value = byte0 & 0x0F;
    let gear_name = match gear_value {
        0x00 => "disable",
        0x01 => "P",
        0x02 => "R",
        0x03 => "N",
        0x04 => "D",
        _ => "Unknown",
    };

    // Parse speed (byte 0 high 4 bits + byte 1, 16 bits total)
    let speed_low_4bits = (byte0 >> 4) as u16;
    let speed_high_8bits = byte1 as u16;
    let speed_raw = (speed_high_8bits << 4) | speed_low_4bits;
    let _speed_mms = (speed_raw as f32) * 1.0;

    // Parse steering angle (bytes 2-3, 16 bits signed Little-Endian)
    let angle_raw = (byte2 as i16) | ((byte3 as i16) << 8);
    let steering_angle = angle_raw as f32 * 0.01;

    // println!(
    //     "🚗 [Parse] Raw bytes: byte0=0x{:02X}, byte1=0x{:02X}, byte2=0x{:02X}, byte3=0x{:02X}",
    //     byte0, byte1, byte2, byte3
    // );
    // println!(
    //     "🚗 [Parse] Gear: {}, Speed: {} mm/s ({:.3} m/s), Steering: {:.2}°",
    //     gear_name,
    //     speed_raw,
    //     speed_mms * 0.001,
    //     steering_angle
    // );

    Some((format!("{}", gear_name), steering_angle))
}

#[cfg(test)]
mod tests {
    use super::*;

    // ==================== create_can_config_packet 测试 ====================

    #[test]
    fn test_create_can_config_packet_fixed_protocol() {
        let config = SerialConfig {
            port: "/dev/ttyUSB0".to_string(),
            baud_rate: 115200,
            can_baud_rate: 500000,
            frame_type: "standard".to_string(),
            can_mode: "normal".to_string(),
            protocol_length: "fixed".to_string(),
        };

        let packet = create_can_config_packet(&config);

        // 验证基本结构
        assert_eq!(packet[0], 0xAA, "Header byte 0 should be 0xAA");
        assert_eq!(packet[1], 0x55, "Header byte 1 should be 0x55");
        assert_eq!(
            packet[2], 0x02,
            "Protocol length config should be 0x02 for fixed"
        );
        assert_eq!(packet[3], 0x03, "CAN baud rate 500K should be 0x03");
        assert_eq!(packet[4], 0x01, "Frame type standard should be 0x01");
        assert!(packet.len() > 0, "Packet should not be empty");
    }

    #[test]
    fn test_create_can_config_packet_extended_frame() {
        let config = SerialConfig {
            port: "/dev/ttyUSB0".to_string(),
            baud_rate: 115200,
            can_baud_rate: 125000,
            frame_type: "extended".to_string(),
            can_mode: "loopback".to_string(),
            protocol_length: "variable".to_string(),
        };

        let packet = create_can_config_packet(&config);

        assert_eq!(packet[0], 0xAA);
        assert_eq!(packet[1], 0x55);
        assert_eq!(
            packet[2], 0x12,
            "Protocol length config should be 0x12 for variable"
        );
        assert_eq!(packet[3], 0x07, "CAN baud rate 125K should be 0x07");
        assert_eq!(packet[4], 0x02, "Frame type extended should be 0x02");
    }

    #[test]
    fn test_create_can_config_packet_checksum() {
        let config = SerialConfig {
            port: "/dev/ttyUSB0".to_string(),
            baud_rate: 115200,
            can_baud_rate: 500000,
            frame_type: "standard".to_string(),
            can_mode: "normal".to_string(),
            protocol_length: "fixed".to_string(),
        };

        let packet = create_can_config_packet(&config);
        let checksum_received = packet[packet.len() - 1];
        let checksum_calculated: u8 = packet[2..packet.len() - 1]
            .iter()
            .map(|&b| b as u32)
            .sum::<u32>() as u8;

        assert_eq!(
            checksum_received, checksum_calculated,
            "Checksum should match"
        );
    }

    // ==================== create_can_send_packet_fixed 测试 ====================

    #[test]
    fn test_create_can_send_packet_space_separated_data() {
        let result = create_can_send_packet_fixed("0x123", "11 22 33 44", "standard");
        assert!(result.is_ok(), "Should parse space-separated data");

        let packet = result.unwrap();
        assert_eq!(packet[0], 0xAA, "Header byte 0");
        assert_eq!(packet[1], 0x55, "Header byte 1");
        assert_eq!(packet[2], 0x01, "Type byte");
        assert_eq!(packet[3], 0x01, "Frame type standard");
        assert_eq!(packet[4], 0x01, "Frame mode");
        assert_eq!(packet.len(), 20, "Fixed protocol should be 20 bytes");
    }

    #[test]
    fn test_create_can_send_packet_continuous_hex() {
        let result = create_can_send_packet_fixed("0x456", "AABBCCDD", "extended");
        assert!(result.is_ok(), "Should parse continuous hex data");

        let packet = result.unwrap();
        assert_eq!(packet[3], 0x02, "Frame type extended");
        assert_eq!(packet.len(), 20, "Fixed protocol should be 20 bytes");
    }

    #[test]
    fn test_create_can_send_packet_can_id_parsing() {
        // Test with 0x prefix (standard frame with valid ID)
        let result1 = create_can_send_packet_fixed("0x123", "01 02 03 04", "standard");
        assert!(result1.is_ok());

        // Test without 0x prefix (standard frame with valid ID)
        let result2 = create_can_send_packet_fixed("456", "01 02 03 04", "standard");
        assert!(result2.is_ok());

        // Test with 0X prefix (uppercase, extended frame)
        let result3 = create_can_send_packet_fixed("0X18C4D2D0", "01 02 03 04", "extended");
        assert!(result3.is_ok());
    }

    #[test]
    fn test_create_can_send_packet_data_padding() {
        let result = create_can_send_packet_fixed("0x123", "11 22", "standard");
        assert!(result.is_ok());

        let packet = result.unwrap();
        // Data should be padded to 8 bytes
        // Bytes 10-17 are data
        assert_eq!(packet[10], 0x11);
        assert_eq!(packet[11], 0x22);
        assert_eq!(packet[12], 0x00, "Should be padded with 0x00");
        assert_eq!(packet[13], 0x00, "Should be padded with 0x00");
    }

    #[test]
    fn test_create_can_send_packet_invalid_data_length() {
        let result =
            create_can_send_packet_fixed("0x123", "11 22 33 44 55 66 77 88 99", "standard");
        assert!(result.is_err(), "Should reject data longer than 8 bytes");
    }

    #[test]
    fn test_create_can_send_packet_invalid_hex() {
        let result = create_can_send_packet_fixed("0x123", "GG HH", "standard");
        assert!(result.is_err(), "Should reject invalid hex characters");
    }

    #[test]
    fn test_create_can_send_packet_odd_length_hex() {
        let result = create_can_send_packet_fixed("0x123", "1122334", "standard");
        assert!(result.is_err(), "Should reject odd-length continuous hex");
    }

    #[test]
    fn test_create_can_send_packet_fixed_standard_frame_max_id() {
        // Standard frame max ID: 0x7FF (11-bit)
        let result = create_can_send_packet_fixed("0x7FF", "11 22", "standard");
        assert!(
            result.is_ok(),
            "Should accept max standard frame ID (0x7FF)"
        );
    }

    #[test]
    fn test_create_can_send_packet_fixed_standard_frame_invalid_id() {
        // Standard frame ID > 0x7FF should be rejected
        let result = create_can_send_packet_fixed("0x800", "11 22", "standard");
        assert!(result.is_err(), "Should reject standard frame ID > 0x7FF");
        assert!(result
            .unwrap_err()
            .to_string()
            .contains("Standard frame CAN ID must be <= 0x7FF"));
    }

    #[test]
    fn test_create_can_send_packet_fixed_standard_frame_way_over_limit() {
        // Standard frame ID way over limit
        let result = create_can_send_packet_fixed("0x18C4D2D0", "11 22", "standard");
        assert!(result.is_err(), "Should reject standard frame ID > 0x7FF");
        assert!(result
            .unwrap_err()
            .to_string()
            .contains("Standard frame CAN ID must be <= 0x7FF"));
    }

    #[test]
    fn test_create_can_send_packet_fixed_extended_frame_max_id() {
        // Extended frame max ID: 0x1FFFFFFF (29-bit)
        let result = create_can_send_packet_fixed("0x1FFFFFFF", "11 22", "extended");
        assert!(
            result.is_ok(),
            "Should accept max extended frame ID (0x1FFFFFFF)"
        );
    }

    #[test]
    fn test_create_can_send_packet_fixed_extended_frame_invalid_id() {
        // Extended frame ID > 0x1FFFFFFF should be rejected
        let result = create_can_send_packet_fixed("0x20000000", "11 22", "extended");
        assert!(
            result.is_err(),
            "Should reject extended frame ID > 0x1FFFFFFF"
        );
        assert!(result
            .unwrap_err()
            .to_string()
            .contains("Extended frame CAN ID must be <= 0x1FFFFFFF"));
    }

    // ==================== create_can_send_packet_variable 测试 ====================

    #[test]
    fn test_create_can_send_packet_variable_standard_8byte() {
        // 标准帧第一个例子：AA C8 23 01 11 22 33 44 55 66 77 88 55
        let result =
            create_can_send_packet_variable("0x123", "11 22 33 44 55 66 77 88", "standard");
        assert!(
            result.is_ok(),
            "Should create variable packet for standard frame with 8 bytes"
        );

        let packet = result.unwrap();
        assert_eq!(packet[0], 0xAA, "Start flag should be 0xAA");
        assert_eq!(
            packet[1], 0xC8,
            "Control byte should be 0xC8 (standard frame, 8 bytes)"
        );
        assert_eq!(packet[2], 0x23, "CAN ID low byte");
        assert_eq!(packet[3], 0x01, "CAN ID high byte");
        assert_eq!(packet[4], 0x11, "Data byte 0");
        assert_eq!(packet[5], 0x22, "Data byte 1");
        assert_eq!(packet[12], 0x55, "End flag should be 0x55");
        assert_eq!(
            packet.len(),
            13,
            "Packet should be 13 bytes (AA + C8 + 2-byte ID + 8 data + 55)"
        );
    }

    #[test]
    fn test_create_can_send_packet_variable_standard_2byte() {
        // 标准帧第二个例子：AA C2 03 01 11 22 55
        let result = create_can_send_packet_variable("0x103", "11 22", "standard");
        assert!(
            result.is_ok(),
            "Should create variable packet for standard frame with 2 bytes"
        );

        let packet = result.unwrap();
        assert_eq!(packet[0], 0xAA, "Start flag should be 0xAA");
        assert_eq!(
            packet[1], 0xC2,
            "Control byte should be 0xC2 (standard frame, 2 bytes)"
        );
        assert_eq!(packet[2], 0x03, "CAN ID low byte");
        assert_eq!(packet[3], 0x01, "CAN ID high byte");
        assert_eq!(packet[4], 0x11, "Data byte 0");
        assert_eq!(packet[5], 0x22, "Data byte 1");
        assert_eq!(packet[6], 0x55, "End flag should be 0x55");
        assert_eq!(
            packet.len(),
            7,
            "Packet should be 7 bytes (AA + C2 + 2-byte ID + 2 data + 55)"
        );
    }

    #[test]
    fn test_create_can_send_packet_variable_extended_8byte() {
        // 扩展帧第一个例子：AA E8 67 45 23 01 11 22 33 44 55 66 77 88 55
        let result =
            create_can_send_packet_variable("0x1234567", "11 22 33 44 55 66 77 88", "extended");
        assert!(
            result.is_ok(),
            "Should create variable packet for extended frame with 8 bytes"
        );

        let packet = result.unwrap();
        assert_eq!(packet[0], 0xAA, "Start flag should be 0xAA");
        assert_eq!(
            packet[1], 0xE8,
            "Control byte should be 0xE8 (extended frame, 8 bytes)"
        );
        assert_eq!(packet[2], 0x67, "CAN ID byte 0");
        assert_eq!(packet[3], 0x45, "CAN ID byte 1");
        assert_eq!(packet[4], 0x23, "CAN ID byte 2");
        assert_eq!(packet[5], 0x01, "CAN ID byte 3");
        assert_eq!(packet[6], 0x11, "Data byte 0");
        assert_eq!(packet[14], 0x55, "End flag should be 0x55");
        assert_eq!(
            packet.len(),
            15,
            "Packet should be 15 bytes (AA + E8 + 4-byte ID + 8 data + 55)"
        );
    }

    #[test]
    fn test_create_can_send_packet_variable_extended_2byte() {
        // 扩展帧第二个例子：AA E2 21 30 03 01 11 22 55
        let result = create_can_send_packet_variable("0x1033021", "11 22", "extended");
        assert!(
            result.is_ok(),
            "Should create variable packet for extended frame with 2 bytes"
        );

        let packet = result.unwrap();
        assert_eq!(packet[0], 0xAA, "Start flag should be 0xAA");
        assert_eq!(
            packet[1], 0xE2,
            "Control byte should be 0xE2 (extended frame, 2 bytes)"
        );
        assert_eq!(packet[2], 0x21, "CAN ID byte 0");
        assert_eq!(packet[3], 0x30, "CAN ID byte 1");
        assert_eq!(packet[4], 0x03, "CAN ID byte 2");
        assert_eq!(packet[5], 0x01, "CAN ID byte 3");
        assert_eq!(packet[6], 0x11, "Data byte 0");
        assert_eq!(packet[7], 0x22, "Data byte 1");
        assert_eq!(packet[8], 0x55, "End flag should be 0x55");
        assert_eq!(
            packet.len(),
            9,
            "Packet should be 9 bytes (AA + E2 + 4-byte ID + 2 data + 55)"
        );
    }

    #[test]
    fn test_create_can_send_packet_variable_invalid_data_length() {
        let result =
            create_can_send_packet_variable("0x123", "11 22 33 44 55 66 77 88 99", "standard");
        assert!(result.is_err(), "Should reject data longer than 8 bytes");
    }

    #[test]
    fn test_create_can_send_packet_variable_continuous_hex() {
        let result = create_can_send_packet_variable("0x456", "AABBCCDD", "standard");
        assert!(result.is_ok(), "Should parse continuous hex data");

        let packet = result.unwrap();
        assert_eq!(packet[0], 0xAA, "Start flag");
        assert_eq!(packet[1], 0xC4, "Control byte (standard, 4 bytes data)");
        assert_eq!(packet.len(), 9, "Packet should be 9 bytes");
    }

    #[test]
    fn test_create_can_send_packet_variable_standard_frame_max_id() {
        // Standard frame max ID: 0x7FF (11-bit)
        let result = create_can_send_packet_variable("0x7FF", "11 22", "standard");
        assert!(
            result.is_ok(),
            "Should accept max standard frame ID (0x7FF)"
        );

        let packet = result.unwrap();
        assert_eq!(packet[0], 0xAA, "Start flag");
        assert_eq!(packet[1], 0xC2, "Control byte");
        assert_eq!(packet[2], 0xFF, "CAN ID low byte");
        assert_eq!(packet[3], 0x07, "CAN ID high byte");
    }

    // ==================== parse_received_can_message 测试 ====================

    #[test]
    fn test_parse_received_can_message_valid() {
        // 构造一个有效的20字节消息
        let mut data = vec![
            0xAA, 0x55, 0x01, 0x01, 0x01, // Header + type + frame type + frame mode
            0xD0, 0xD2, 0xC4, 0x18, // CAN ID (0x18C4D2D0, little-endian)
            0x08, // Data length
            0x01, 0x83, 0x02, 0x02, 0xF2, 0x00, 0x00, 0x00, // Data (8 bytes)
            0x00, // Reserved
        ];
        // 计算校验和
        let checksum: u8 = data[2..19].iter().map(|&b| b as u32).sum::<u32>() as u8;
        data.push(checksum);

        let result = parse_received_can_message(&data);
        assert!(result.is_some(), "Should parse valid message");

        let (can_id, can_data, frame_type) = result.unwrap();
        assert_eq!(can_id, "0x18C4D2D0", "CAN ID should match");
        assert_eq!(can_data, "01 83 02 02 F2 00 00 00", "CAN data should match");
        assert_eq!(frame_type, "standard", "Frame type should be standard");
    }

    #[test]
    fn test_parse_received_can_message_invalid_header() {
        let data = vec![
            0xBB, 0x55, 0x01, 0x01, 0x01, // Invalid header
            0xD0, 0xD2, 0xC4, 0x18, 0x08, 0x01, 0x83, 0x02, 0x02, 0xF2, 0x00, 0x00, 0x00, 0x00,
            0x00,
        ];

        let result = parse_received_can_message(&data);
        assert!(result.is_none(), "Should reject invalid header");
    }

    #[test]
    fn test_parse_received_can_message_too_short() {
        let data = vec![0xAA, 0x55, 0x01];
        let result = parse_received_can_message(&data);
        assert!(
            result.is_none(),
            "Should reject message shorter than 20 bytes"
        );
    }

    #[test]
    fn test_parse_received_can_message_invalid_data_length() {
        let mut data = vec![
            0xAA, 0x55, 0x01, 0x01, 0x01, 0xD0, 0xD2, 0xC4, 0x18,
            0x09, // Invalid data length (> 8)
            0x01, 0x83, 0x02, 0x02, 0xF2, 0x00, 0x00, 0x00, 0x00,
        ];
        let checksum: u8 = data[2..19].iter().map(|&b| b as u32).sum::<u32>() as u8;
        data.push(checksum);

        let result = parse_received_can_message(&data);
        assert!(result.is_none(), "Should reject invalid data length");
    }

    #[test]
    fn test_parse_received_can_message_extended_frame() {
        let mut data = vec![
            0xAA, 0x55, 0x01, 0x02, 0x01, // Frame type = 0x02 (extended)
            0xD0, 0xD2, 0xC4, 0x18, 0x08, 0x01, 0x83, 0x02, 0x02, 0xF2, 0x00, 0x00, 0x00, 0x00,
        ];
        let checksum: u8 = data[2..19].iter().map(|&b| b as u32).sum::<u32>() as u8;
        data.push(checksum);

        let result = parse_received_can_message(&data);
        assert!(result.is_some(), "Should parse extended frame message");

        let (can_id, can_data, frame_type) = result.unwrap();
        assert_eq!(can_id, "0x18C4D2D0", "CAN ID should match");
        assert_eq!(can_data, "01 83 02 02 F2 00 00 00", "CAN data should match");
        assert_eq!(frame_type, "extended", "Frame type should be extended");
    }

    // ==================== parse_distance_from_data 测试 ====================

    #[test]
    fn test_parse_distance_from_data_valid() {
        let distance = parse_distance_from_data("01 02 03 04 05 06 07 08");
        assert_eq!(
            distance, 0x0708,
            "Should extract last two bytes as distance"
        );
    }

    #[test]
    fn test_parse_distance_from_data_single_byte() {
        let distance = parse_distance_from_data("FF");
        assert_eq!(distance, 0, "Should return 0 if less than 2 bytes");
    }

    #[test]
    fn test_parse_distance_from_data_empty() {
        let distance = parse_distance_from_data("");
        assert_eq!(distance, 0, "Should return 0 for empty data");
    }

    #[test]
    fn test_parse_distance_from_data_two_bytes() {
        let distance = parse_distance_from_data("AB CD");
        // 最后两个字节是 "AB" 和 "CD"，连接后是 "ABCD" = 0xABCD
        assert_eq!(distance, 0xABCD, "Should parse two bytes correctly");
    }

    // ==================== parse_vehicle_status_8byte 测试 ====================

    #[test]
    fn test_parse_vehicle_status_8byte_gear_d() {
        // Byte 0: 0x04 (gear D in low 4 bits)
        // Byte 1: 0x4B (speed high 8 bits)
        // Byte 2-3: 0x40 0x01 (steering angle = 0x0140 = 320 * 0.01 = 3.2°, Little-Endian)
        let result = parse_vehicle_status_8byte("04 4B 40 01 00 00 00 2B");
        assert!(result.is_some(), "Should parse valid vehicle status");

        let (gear, steering_angle) = result.unwrap();
        assert_eq!(gear, "D", "Gear should be D");
        assert!(
            (steering_angle - 3.2).abs() < 0.01,
            "Steering angle should be approximately 3.2°"
        );
    }

    #[test]
    fn test_parse_vehicle_status_8byte_gear_p() {
        let result = parse_vehicle_status_8byte("01 00 00 00 00 00 00 00");
        assert!(result.is_some());

        let (gear, _) = result.unwrap();
        assert_eq!(gear, "P", "Gear should be P");
    }

    #[test]
    fn test_parse_vehicle_status_8byte_gear_r() {
        let result = parse_vehicle_status_8byte("02 00 00 00 00 00 00 00");
        assert!(result.is_some());

        let (gear, _) = result.unwrap();
        assert_eq!(gear, "R", "Gear should be R");
    }

    #[test]
    fn test_parse_vehicle_status_8byte_gear_n() {
        let result = parse_vehicle_status_8byte("03 00 00 00 00 00 00 00");
        assert!(result.is_some());

        let (gear, _) = result.unwrap();
        assert_eq!(gear, "N", "Gear should be N");
    }

    #[test]
    fn test_parse_vehicle_status_8byte_negative_steering() {
        // Steering angle: -10.00° = -1000 in 0.01° units
        // -1000 in i16 = 0xFC18 (little-endian: 0x18 0xFC)
        let result = parse_vehicle_status_8byte("00 00 18 FC 00 00 00 00");
        assert!(result.is_some());

        let (_, steering_angle) = result.unwrap();
        assert_eq!(steering_angle, -10.0, "Steering angle should be -10.0°");
    }

    #[test]
    fn test_parse_vehicle_status_8byte_insufficient_bytes() {
        let result = parse_vehicle_status_8byte("01 02 03");
        assert!(
            result.is_none(),
            "Should return None for insufficient bytes"
        );
    }

    #[test]
    fn test_parse_vehicle_status_8byte_invalid_hex() {
        let result = parse_vehicle_status_8byte("GG HH II JJ 00 00 00 00");
        assert!(result.is_none(), "Should return None for invalid hex");
    }

    #[test]
    fn test_parse_vehicle_status_8byte_zero_values() {
        let result = parse_vehicle_status_8byte("00 00 00 00 00 00 00 00");
        assert!(result.is_some());

        let (gear, steering_angle) = result.unwrap();
        assert_eq!(gear, "disable", "Gear should be disable");
        assert_eq!(steering_angle, 0.0, "Steering angle should be 0.0°");
    }

    // ==================== Checksum 验证测试 ====================

    #[test]
    fn test_checksum_calculation() {
        // 构造一个有效的20字节消息
        let mut data = vec![
            0xAA, 0x55, 0x01, 0x01, 0x01, // Header + type + frame type + frame mode
            0xD0, 0xD2, 0xC4, 0x18, // CAN ID (0x18C4D2D0, little-endian)
            0x08, // Data length
            0x01, 0x83, 0x02, 0x02, 0xF2, 0x00, 0x00, 0x00, // Data (8 bytes)
            0x00, // Reserved
        ];

        // 计算校验和（字节2-18的和）
        let checksum: u8 = data[2..19].iter().map(|&b| b as u32).sum::<u32>() as u8;
        data.push(checksum);

        assert_eq!(data.len(), 20, "Message should be 20 bytes");

        // 验证校验和
        let checksum_received = data[19];
        let checksum_calculated: u8 = data[2..19].iter().map(|&b| b as u32).sum::<u32>() as u8;
        assert_eq!(
            checksum_received, checksum_calculated,
            "Checksum should match"
        );
    }

    #[test]
    fn test_checksum_with_radar_data() {
        // 测试雷达消息的校验和
        let mut data = vec![
            0xAA, 0x55, 0x01, 0x02, 0x01, // Header + type + frame type + frame mode
            0x21, 0x05, 0x00, 0x00, // CAN ID (0x00000521, little-endian)
            0x04, // Data length
            0x01, 0x83, 0x02, 0xF2, 0x00, 0x00, 0x00, 0x00, // Data (8 bytes)
            0x00, // Reserved
        ];

        let checksum: u8 = data[2..19].iter().map(|&b| b as u32).sum::<u32>() as u8;
        data.push(checksum);

        assert_eq!(data.len(), 20, "Message should be 20 bytes");

        let checksum_received = data[19];
        let checksum_calculated: u8 = data[2..19].iter().map(|&b| b as u32).sum::<u32>() as u8;
        assert_eq!(
            checksum_received, checksum_calculated,
            "Checksum should match"
        );
        assert_eq!(checksum, 0xA6, "Checksum should be 0xA6");
    }

    #[test]
    fn test_checksum_overflow() {
        // 测试校验和溢出（和 > 255）
        let mut data = vec![
            0xAA, 0x55, 0xFF, 0xFF, 0xFF, // Header + high values
            0xFF, 0xFF, 0xFF, 0xFF, // CAN ID with high values
            0x08, // Data length
            0xFF, 0xFF, 0xFF, 0xFF, 0xFF, 0xFF, 0xFF, 0xFF, // Data (all 0xFF)
            0x00, // Reserved
        ];

        let checksum: u8 = data[2..19].iter().map(|&b| b as u32).sum::<u32>() as u8;
        data.push(checksum);

        assert_eq!(data.len(), 20, "Message should be 20 bytes");

        let checksum_received = data[19];
        let checksum_calculated: u8 = data[2..19].iter().map(|&b| b as u32).sum::<u32>() as u8;
        assert_eq!(
            checksum_received, checksum_calculated,
            "Checksum should handle overflow correctly"
        );
    }

    #[test]
    fn test_checksum_zero_data() {
        // 测试全零数据的校验和
        let mut data = vec![
            0xAA, 0x55, 0x00, 0x00, 0x00, // Header + zeros
            0x00, 0x00, 0x00, 0x00, // CAN ID (0x00000000)
            0x00, // Data length
            0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, // Data (all zeros)
            0x00, // Reserved
        ];

        let checksum: u8 = data[2..19].iter().map(|&b| b as u32).sum::<u32>() as u8;
        data.push(checksum);

        assert_eq!(data.len(), 20, "Message should be 20 bytes");
        assert_eq!(checksum, 0x00, "Checksum of all zeros should be 0x00");
    }
}
