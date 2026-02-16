//! I/O 线程相关的函数
//! 包括：串口读写、消息缓冲、事件发送等功能

use std::sync::atomic::Ordering;
use std::sync::mpsc;
use std::thread;
use std::time::Duration;

use log::{error, info, warn};
use serialport::SerialPort;
use tauri::Emitter;

use crate::can_protocol::{
    parse_distance_from_data, parse_received_can_message, parse_vehicle_status_8byte,
};
use crate::{AppState, SendMessage};

/// 启动 I/O 线程 - 独占拥有串口，处理读写
pub fn start_io_thread(
    mut serial_port: Box<dyn SerialPort>,
    state: AppState,
    rx_send: mpsc::Receiver<SendMessage>,
    app_handle: tauri::AppHandle,
) {
    state.write_thread_running.store(true, Ordering::SeqCst);
    state.receive_thread_running.store(true, Ordering::SeqCst);

    thread::spawn(move || {
        let mut buffer = vec![0u8; 1024];
        let mut message_buffer = Vec::new(); // 消息缓冲区，用于组装完整的消息

        // println!("🚀 [I/O Thread] Started - Ready to handle read/write operations");
        // info!("🚀 [I/O Thread] Started - Ready to handle read/write operations");

        while state.write_thread_running.load(Ordering::SeqCst) {
            // 尝试接收写入请求（非阻塞）
            match rx_send.try_recv() {
                Ok(msg) => {
                    // info!("I/O thread: sending {} bytes", msg.packet.len());
                    match serial_port.write_all(&msg.packet) {
                        Ok(_) => {
                            if let Err(e) = serial_port.flush() {
                                warn!("I/O thread: flush failed: {}", e);
                            }
                        }
                        Err(e) => {
                            error!("I/O thread: write failed: {}", e);
                        }
                    }
                }
                Err(mpsc::TryRecvError::Empty) => {
                    // 没有写入请求，尝试读取
                    match serial_port.read(&mut buffer) {
                        Ok(n) if n > 0 => {
                            let received_data = &buffer[..n];
                            // println!("📥 [I/O Thread] Received {} bytes: {:02X?}", n, received_data);
                            // info!("📥 [I/O Thread] Received {} bytes: {:02X?}", n, received_data);

                            // 将接收到的数据添加到消息缓冲区
                            message_buffer.extend_from_slice(received_data);
                            // println!("📦 [I/O Thread] Message buffer size: {} bytes, content: {:02X?}", message_buffer.len(), message_buffer);

                            // 处理缓冲区中的完整消息
                            process_message_buffer(&mut message_buffer, &app_handle);
                        }
                        Ok(_) => {
                            // 读取0字节，短暂休眠
                            thread::sleep(Duration::from_millis(5));
                        }
                        Err(ref e) if e.kind() == std::io::ErrorKind::TimedOut => {
                            // 超时是正常的，继续循环
                            continue;
                        }
                        Err(e) => {
                            error!("I/O thread: read error: {}", e);
                            println!("❌ [I/O Thread] Read error: {}", e);
                            thread::sleep(Duration::from_millis(10));
                        }
                    }
                }
                Err(mpsc::TryRecvError::Disconnected) => {
                    info!("I/O thread: channel disconnected, exiting");
                    break;
                }
            }
        }

        state.receive_thread_running.store(false, Ordering::SeqCst);
        info!("I/O thread stopped");
    });
}

/// 验证消息的校验和
///
/// 协议格式：固定20字节
/// - 字节0-1: 消息头 (0xAA 0x55)
/// - 字节2-18: 数据部分
/// - 字节19: 校验和 (字节2-18的和的低8位)
fn verify_checksum(message: &[u8]) -> bool {
    if message.len() < 20 {
        return false;
    }

    let checksum_received = message[19];
    let checksum_calculated: u8 = message[2..19].iter().map(|&b| b as u32).sum::<u32>() as u8;

    if checksum_received != checksum_calculated {
        println!(
            "❌ [Checksum] Mismatch - Received: 0x{:02X}, Calculated: 0x{:02X}",
            checksum_received, checksum_calculated
        );
        return false;
    }

    // println!("✅ [Checksum] Valid - 0x{:02X}", checksum_calculated);
    true
}

/// 在缓冲区中查找消息头 (AA 55)
/// 返回消息头的位置，如果找到则清理前面的数据
fn find_and_align_message_header(message_buffer: &mut Vec<u8>) -> bool {
    if let Some(header_pos) = message_buffer.windows(2).position(|w| w == [0xAA, 0x55]) {
        // println!("🎯 [I/O Thread] Found message header at position {}", header_pos);

        if header_pos > 0 {
            println!(
                "⚠️  [I/O Thread] Discarding {} bytes before message header",
                header_pos
            );
            message_buffer.drain(0..header_pos);
        }
        true
    } else {
        // 没有找到完整的消息头，清理无效的字节
        if message_buffer.len() < 2 {
            // println!("⏳ [I/O Thread] Buffer too small to search for header: {} bytes", message_buffer.len());
            return false;
        }

        if message_buffer[0] == 0xAA {
            println!("⚠️  [I/O Thread] Found 0xAA at position 0, but next byte is 0x{:02X} (not 0x55), discarding", message_buffer[1]);
            message_buffer.remove(0);
        } else {
            println!(
                "⚠️  [I/O Thread] First byte is 0x{:02X} (not 0xAA), discarding",
                message_buffer[0]
            );
            message_buffer.remove(0);
        }
        false
    }
}

/// 处理已解析的 CAN 消息
fn handle_parsed_can_message(
    can_id: &str,
    can_data: &str,
    frame_type: &str,
    raw_hex: &str,
    timestamp: &str,
    app_handle: &tauri::AppHandle,
) {
    // println!("✅ [I/O Thread] Parsed CAN message - ID: {}, Data: {}", can_id, can_data);
    // info!("✅ [I/O Thread] Parsed CAN message - ID: {}, Data: {}", can_id, can_data);
    info!("RX: ID={} Data={}", can_id, can_data);

    // 尝试解析新协议的车辆状态（ID: 0x00000123）
    let mut vehicle_status: Option<(String, f32)> = None;
    if can_id == "0x00000123" {
        vehicle_status = parse_vehicle_status_8byte(&can_data);
    }

    // 发送通用CAN消息事件（包含原始数据）
    let mut can_message = serde_json::json!({
        "id": can_id,
        "data": can_data,
        "rawData": raw_hex,
        "timestamp": timestamp,
        "direction": "received",
        "frameType": frame_type,
    });

    // 如果解析了车辆状态，添加到消息中
    if let Some((gear, steering_angle)) = vehicle_status {
        can_message["gear"] = serde_json::json!(gear);
        can_message["steeringAngle"] = serde_json::json!(steering_angle);
    }

    let _ = app_handle.emit("can-message-received", can_message);

    // 检查是否是雷达消息
    if can_id == "0x00000521"
        || can_id == "0x00000522"
        || can_id == "0x00000523"
        || can_id == "0x00000524"
    {
        let distance = parse_distance_from_data(&can_data);
        let radar_message = serde_json::json!({
            "canId": can_id,
            "distance": distance,
            "data": can_data,
            "rawData": raw_hex,
            "timestamp": timestamp,
        });
        let _ = app_handle.emit("radar-message", radar_message);
    } 
    // Handle 0x221 Vehicle Feedback
    else if can_id == "0x00000221" || can_id == "221" {
        // Parse data: 8 bytes logic from user requirement
        // Byte 0-1: Speed (mm/s, signed int16, Big Endian)
        // Byte 6-7: Steering Angle (rad*1000, signed int16, Big Endian)

        // can_data is a space-separated string of hex bytes, e.g., "00 12 00 00 00 00 01 F4"
        let bytes: Vec<u8> = can_data
            .split_whitespace()
            .filter_map(|s| u8::from_str_radix(s, 16).ok())
            .collect();

        if bytes.len() >= 8 {
            let speed_raw = ((bytes[0] as i16) << 8) | (bytes[1] as i16);
            let angle_raw = ((bytes[6] as i16) << 8) | (bytes[7] as i16);

            let feedback_msg = serde_json::json!({
                "canId": can_id,
                "speed_mms": speed_raw, // Speed in mm/s (0.001 m/s * 1000)
                "steering_angle_rad_1000": angle_raw, // Unit: 0.001 rad
                "timestamp": timestamp
            });
            
            // Emit special event for System Monitor to trigger mock data
            let _ = app_handle.emit("vehicle-feedback", feedback_msg);
        }
    }
}

/// 处理解析失败的消息
fn handle_parse_failure(raw_hex: &str, timestamp: &str, app_handle: &tauri::AppHandle) {
    println!("⚠️  [I/O Thread] Failed to parse CAN message, sending raw data");
    info!(
        "⚠️  [I/O Thread] Failed to parse CAN message from raw data: {}",
        raw_hex
    );

    let can_message = serde_json::json!({
        "id": "UNKNOWN",
        "data": raw_hex,
        "rawData": raw_hex,
        "timestamp": timestamp,
        "direction": "received",
        "frameType": "unknown",
    });
    let _ = app_handle.emit("can-message-received", can_message);
}

/// 处理消息缓冲区中的完整消息
///
/// 协议格式：固定20字节
/// 处理 Windows 上消息被截断的情况（例如先发 0xAA，再发剩下的 19 字节）
/// 改进逻辑：使用下一个 AA 55 作为分隔符，防止因校验和失败误删数据
fn process_message_buffer(message_buffer: &mut Vec<u8>, app_handle: &tauri::AppHandle) {
    loop {
        // 第一步：查找并对齐消息头 (确保 buffer 以 AA 55 开头)
        if !find_and_align_message_header(message_buffer) {
            break;
        }

        // 第二步：查找下一个消息头 (AA 55)
        // 从索引 2 开始查找 (跳过当前头的 AA 55)
        let next_header_pos = message_buffer[2..]
            .windows(2)
            .position(|w| w == [0xAA, 0x55])
            .map(|i| i + 2);

        if let Some(pos) = next_header_pos {
            // 情况 A: 找到了下一个消息头
            // 当前包的范围是 [0..pos]
            if pos == 20 {
                // 长度正好是 20 字节，验证校验和
                let candidate = &message_buffer[0..20];
                if verify_checksum(candidate) {
                    // 校验通过，处理消息
                    let timestamp = chrono::Local::now().format("%H:%M:%S%.3f").to_string();
                    let raw_hex = candidate
                        .iter()
                        .map(|b| format!("{:02X}", b))
                        .collect::<Vec<_>>()
                        .join(" ");

                    if let Some((can_id, can_data, frame_type)) =
                        parse_received_can_message(candidate)
                    {
                        handle_parsed_can_message(
                            &can_id,
                            &can_data,
                            &frame_type,
                            &raw_hex,
                            &timestamp,
                            app_handle,
                        );
                    } else {
                        handle_parse_failure(&raw_hex, &timestamp, app_handle);
                    }
                } else {
                    // 校验失败，但在 20 字节处发现了新头
                    // 这意味着当前这 20 字节是损坏的，或者是偶然的 AA 55
                    // 既然下一个头在正确的位置，我们丢弃当前的 20 字节，尝试处理下一个
                    println!("⚠️  [I/O Thread] Checksum failed for aligned packet, discarding current packet");
                }
            } else {
                // 长度不是 20 字节 (例如 19 字节就遇到了 AA 55)
                // 说明当前包不完整或有错误，丢弃到下一个头的位置
                println!("⚠️  [I/O Thread] Invalid packet length: {} (expected 20), discarding up to next header", pos);
            }

            // 无论处理成功与否，都移除当前包，移动到下一个头的位置
            message_buffer.drain(0..pos);
        } else {
            // 情况 B: 没有找到下一个消息头
            // 我们需要判断是否已经有足够的数据来处理一个包
            if message_buffer.len() >= 20 {
                // 尝试验证前 20 字节
                let candidate = &message_buffer[0..20];
                if verify_checksum(candidate) {
                    // 校验通过！这是一个有效的包 (虽然还没收到下一个头)
                    // 处理它
                    let timestamp = chrono::Local::now().format("%H:%M:%S%.3f").to_string();
                    let raw_hex = candidate
                        .iter()
                        .map(|b| format!("{:02X}", b))
                        .collect::<Vec<_>>()
                        .join(" ");

                    if let Some((can_id, can_data, frame_type)) =
                        parse_received_can_message(candidate)
                    {
                        handle_parsed_can_message(
                            &can_id,
                            &can_data,
                            &frame_type,
                            &raw_hex,
                            &timestamp,
                            app_handle,
                        );
                    } else {
                        handle_parse_failure(&raw_hex, &timestamp, app_handle);
                    }

                    // 移除已处理的 20 字节
                    message_buffer.drain(0..20);
                } else {
                    // 校验失败，且后面没有发现 AA 55
                    // 这可能是：
                    // 1. 包还没收完 (虽然有20字节，但可能中间丢了数据，真正的头在后面还没来)
                    // 2. 这是一个坏包
                    //
                    // 策略：等待更多数据 (不移除任何东西)，直到：
                    // - 收到下一个 AA 55 (会进入 情况 A)
                    // - 缓冲区过大 (防止内存泄漏)

                    if message_buffer.len() > 200 {
                        println!(
                            "⚠️  [I/O Thread] Buffer too large ({}), discarding 1 byte to advance",
                            message_buffer.len()
                        );
                        message_buffer.remove(0);
                    } else {
                        // 等待更多数据
                        break;
                    }
                }
            } else {
                // 数据不足 20 字节，且没有下一个头 -> 等待更多数据
                break;
            }
        }
    }
}
