//! CAN 协议相关的函数
//! 包括：配置、发送、接收、解析等功能

use anyhow::{Result, anyhow};
use log::info;

use crate::SerialConfig;

/// 创建 CAN 配置数据包
/// 
/// 根据配置参数生成 CAN 配置命令数据包
pub fn create_can_config_packet(config: &SerialConfig) -> Vec<u8> {
    info!("Creating CAN config packet");

    let mut packet = vec![0xAA, 0x55]; // Header
    let protocol_length_config = if config.protocol_length == "fixed" { 0x02 } else { 0x12 };
    packet.push(protocol_length_config); // Config command

    // CAN baud rate config
    let baud_config = match config.can_baud_rate {
        5000 => 0x0c,     // 5kbps
        10000 => 0x0b,    // 10kbps
        20000 => 0x0a,    // 20kbps
        50000 => 0x09,    // 50kbps
        100000 => 0x08,   // 100kbps
        125000 => 0x07,   // 125kbps
        200000 => 0x06,   // 200kbps
        250000 => 0x05,   // 250kbps
        400000 => 0x04,   // 400kbps
        500000 => 0x03,   // 500kbps
        800000 => 0x02,   // 800kbps
        1000000 => 0x01,  // 1Mbps
        _ => 0x03,        // Default 500K
    };
    packet.push(baud_config);

    // Frame type: standard=0x01, extended=0x02
    let frame_type_config = if config.frame_type == "extended" { 0x02 } else { 0x01 };
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

    info!("Config packet: {:02X?} (length: {} bytes)", packet, packet.len());
    packet
}

/// 创建 CAN 发送数据包（固定20字节协议）
/// 
/// 根据 CAN ID 和数据生成发送数据包
pub fn create_can_send_packet_fixed(id: &str, data: &str, frame_type: &str) -> Result<Vec<u8>> {
    info!("Creating CAN send packet (fixed) - ID: {}, Data: {}, Type: {}", id, data, frame_type);

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

    info!("Using original data bytes: {:02X?} (length: {})", data_bytes, data_bytes.len());

    if data_bytes.len() > 8 {
        return Err(anyhow!("CAN data length cannot exceed 8 bytes"));
    }

    // Fill in the 8 digits with 00 at the end
    while data_bytes.len() < 8 {
        data_bytes.push(0x00);
    }

    // Parse CAN ID
    let id_hex_part = id.strip_prefix("0x")
                         .or_else(|| id.strip_prefix("0X"))
                         .unwrap_or(id);
    let can_id = if id_hex_part.is_empty() {
        0x18C4D2D0
    } else {
        u32::from_str_radix(id_hex_part, 16)
            .map_err(|_| anyhow!("Invalid CAN ID format: \"{}\"", id))?
    };

    info!("Input CAN ID: 0x{:08X}", can_id);

    // Use user-specified frame type
    let is_extended = frame_type == "extended";
    info!("CAN ID 0x{:08X} -> {} frame (user-specified)", can_id, frame_type);

    // Header: 0xAA, 0x55, 0x01, [frame_type], 0x01
    let frame_type_byte = if is_extended { 0x02 } else { 0x01 };
    let mut packet = vec![0xAA, 0x55, 0x01, frame_type_byte, 0x01];

    // CAN ID: always 4 bytes (little-endian)
    let id_bytes = can_id.to_le_bytes().to_vec();
    packet.extend_from_slice(&id_bytes);
    info!("CAN ID bytes (4 bytes, little-endian): {:02X?}", id_bytes);

    // Data length: fixed 8 bytes
    packet.push(0x08);
    
    // Data content
    packet.extend_from_slice(&data_bytes);
    info!("Added data bytes: {:02X?}", data_bytes);
    
    // Reserved byte
    packet.push(0x00);
    let checksum: u8 = packet[2..].iter().map(|&b| b as u32).sum::<u32>() as u8 & 0xFF;
    packet.push(checksum);

    info!("Send packet: {:02X?} (length: {} bytes)", packet, packet.len());
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
pub fn parse_received_can_message(data: &[u8]) -> Option<(String, String)> {
    if data.len() < 20 {
        println!("❌ [Parse] Data too short: {} bytes (need 20)", data.len());
        return None;
    }

    if data[0] != 0xAA || data[1] != 0x55 {
        println!("❌ [Parse] Invalid frame header: {:02X} {:02X}", data[0], data[1]);
        return None;
    }

    println!("🔍 [Parse] Fixed 20-byte protocol");
    println!("🔍 [Parse] Type: 0x{:02X}, Frame Type: 0x{:02X}, Frame Mode: 0x{:02X}",
             data[2], data[3], data[4]);

    // Parse CAN ID (bytes 5-8, little-endian)
    let can_id = (data[5] as u32) |
                 ((data[6] as u32) << 8) |
                 ((data[7] as u32) << 16) |
                 ((data[8] as u32) << 24);

    println!("🔍 [Parse] CAN ID bytes: {:02X} {:02X} {:02X} {:02X} -> 0x{:08X}",
             data[5], data[6], data[7], data[8], can_id);

    // Data length (byte 9)
    let data_len = data[9] as usize;
    println!("🔍 [Parse] Data length: {}", data_len);

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

    println!("🔍 [Parse] CAN Data: {}", can_data);

    // Verify checksum (byte 19)
    let checksum_received = data[19];
    let checksum_calculated: u8 = data[2..19].iter().map(|&b| b as u32).sum::<u32>() as u8;

    println!("🔍 [Parse] Checksum - Received: 0x{:02X}, Calculated: 0x{:02X}",
             checksum_received, checksum_calculated);

    if checksum_received != checksum_calculated {
        println!("⚠️  [Parse] Checksum mismatch!");
    }

    let can_id_str = format!("0x{:08X}", can_id);
    println!("✅ [Parse] Successfully parsed - ID: {}, Data: {}", can_id_str, can_data);
    Some((can_id_str, can_data))
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
        println!("⚠️  [Parse] Not enough bytes for vehicle status: {}", bytes.len());
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
    let speed_mms = (speed_raw as f32) * 1.0;

    // Parse steering angle (bytes 2-3, 16 bits signed Little-Endian)
    let angle_raw = (byte2 as i16) | ((byte3 as i16) << 8);
    let steering_angle = angle_raw as f32 * 0.01;

    println!("🚗 [Parse] Raw bytes: byte0=0x{:02X}, byte1=0x{:02X}, byte2=0x{:02X}, byte3=0x{:02X}", byte0, byte1, byte2, byte3);
    println!("🚗 [Parse] Gear: {}, Speed: {} mm/s ({:.3} m/s), Steering: {:.2}°",
             gear_name, speed_raw, speed_mms * 0.001, steering_angle);

    Some((format!("{}", gear_name), steering_angle))
}

