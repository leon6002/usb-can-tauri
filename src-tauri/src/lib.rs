use std::sync::{Arc, Mutex, mpsc};
use std::sync::atomic::{AtomicBool, Ordering};
use std::thread;
use std::time::Duration;

use serialport::{SerialPort, available_ports};
use serde::{Deserialize, Serialize};
use tauri::{State, Emitter};
use anyhow::{Result, anyhow};
use log::{info, error, warn};
use csv::ReaderBuilder;

mod vehicle_control;
use vehicle_control::{extract_vehicle_control, VehicleControl};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SerialConfig {
    port: String,
    baud_rate: u32,
    can_baud_rate: u32,
    frame_type: String,
    protocol_length: String,
    can_mode: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CanMessage {
    id: String,
    data: String,
    timestamp: String,
    direction: String,
    frame_type: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CsvLoopProgress {
    pub index: usize,
    pub total: usize,
    pub can_id: String,
    pub can_data: String,
    pub vehicle_control: Option<VehicleControl>,
}

// 发送通道消息类型
#[derive(Debug, Clone)]
pub struct SendMessage {
    pub packet: Vec<u8>,
}

// Application state
#[derive(Clone)]
pub struct AppState {
    // 发送通道的发送端 - 用于将数据发送到写入线程
    tx_send: Arc<Mutex<Option<mpsc::Sender<SendMessage>>>>,
    is_connected: Arc<Mutex<bool>>,
    csv_loop_running: Arc<AtomicBool>,
    receive_thread_running: Arc<AtomicBool>,
    write_thread_running: Arc<AtomicBool>,
}

impl Default for AppState {
    fn default() -> Self {
        Self {
            tx_send: Arc::new(Mutex::new(None)),
            is_connected: Arc::new(Mutex::new(false)),
            csv_loop_running: Arc::new(AtomicBool::new(false)),
            receive_thread_running: Arc::new(AtomicBool::new(false)),
            write_thread_running: Arc::new(AtomicBool::new(false)),
        }
    }
}

// USB-CAN protocol functions
// refer: https://www.waveshare.net/wiki/%E4%BA%8C%E6%AC%A1%E5%BC%80%E5%8F%91%E2%80%94%E4%B8%B2%E8%A1%8C%E8%BD%AC%E6%8D%A2CAN%E5%8D%8F%E8%AE%AE%E7%9A%84%E5%AE%9A%E4%B9%89#CAN.E9.85.8D.E7.BD.AE.E5.91.BD.E4.BB.A4
fn create_can_config_packet(config: &SerialConfig) -> Vec<u8> {
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
    let frame_type_config = if config.protocol_length == "variable" && config.frame_type == "extended" { 0x02 } else { 0x01 };
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

fn create_can_send_packet(id: &str, data: &str, frame_type: &str) -> Result<Vec<u8>> {
    info!("Creating CAN send packet - ID: {}, Data: {}, Type: {}", id, data, frame_type);

    // Parse data - handle both single hex values and space-separated hex values
    let data_bytes: Result<Vec<u8>, _> = if data.contains(' ') {
        // Space-separated hex values like "11 22 33 44"
        data.split_whitespace()
            .map(|s| u8::from_str_radix(s, 16))
            .collect()
    } else {
        // Single hex value like "01" or "02"
        match u8::from_str_radix(data, 16) {
            Ok(byte) => Ok(vec![byte]),
            Err(e) => Err(e),
        }
    };

    let data_bytes = data_bytes.map_err(|_| anyhow!("Invalid data format"))?;

    // Don't pad data - send exactly what was requested
    info!("Using original data bytes: {:02X?} (length: {})", data_bytes, data_bytes.len());

    if data_bytes.len() > 8 {
        return Err(anyhow!("CAN data length cannot exceed 8 bytes"));
    }

    // Parse CAN ID
    let can_id = u32::from_str_radix(id, 16)
        .map_err(|_| anyhow!("Invalid CAN ID format"))?;

    let mut packet = vec![0xAA]; // Header

    // Use user-specified frame type, but warn if ID is out of typical range
    let is_id_in_standard_range = can_id <= 0x7FF;
    if frame_type == "standard" && !is_id_in_standard_range {
        info!("Warning: CAN ID 0x{:X} is outside standard frame range (0x000-0x7FF)", can_id);
        return Err(anyhow!("Standard frame CAN ID must be in range 0x000-0x7FF"));
    }
    if frame_type == "extended" && is_id_in_standard_range {
        info!("Info: CAN ID 0x{:X} is in standard range but using extended frame as requested", can_id);
        return Err(anyhow!("Extended frame CAN ID must be in range 0x000-0x1FFFFFFF"));
    }

    // Control byte: match official protocol examples exactly
    let control_byte = if frame_type == "extended" {
        0xE0 | (data_bytes.len() as u8)  // 扩展帧：0xE0 + 数据长度
    } else {
        0xC0 | (data_bytes.len() as u8)  // 标准帧：0xC0 + 数据长度
    };
    packet.push(control_byte);
    info!("Control byte: 0x{:02X} (frame type: {}, {} bytes data, matches official protocol)",
          control_byte, frame_type, data_bytes.len());

    if frame_type == "extended" {
        // Extended frame: 4-byte ID, little-endian
        let id_bytes = can_id.to_le_bytes();
        packet.extend_from_slice(&id_bytes);
        info!("Extended frame ID bytes (little-endian): {:02X?}", id_bytes);
    } else {
        // Standard frame: 2-byte ID, little-endian
        let id_bytes = (can_id as u16).to_le_bytes();
        packet.extend_from_slice(&id_bytes);
        info!("Standard frame ID bytes (little-endian): {:02X?}", id_bytes);
    }

    info!("CAN ID 0x{:X} -> Using {} frame as requested by user", can_id, frame_type);

    // Data content
    packet.extend_from_slice(&data_bytes);
    info!("Added data bytes: {:02X?}", data_bytes);

    // End marker
    packet.push(0x55);

    info!("Send packet: {:02X?} (length: {} bytes)", packet, packet.len());
    info!("Python comparison - Expected length: 15 bytes, Actual length: {} bytes", packet.len());
    Ok(packet)
}

fn create_can_send_packet_fixed(id: &str, data: &str) -> Result<Vec<u8>> {
    info!("Creating CAN send packet (fixed) - ID: {}, Data: {}", id, data);

    // Parse data - handle both single hex values and space-separated hex values
    let mut data_bytes: Vec<u8> = if data.contains(' ') {
        // Space-separated hex values like "11 22 33 44"
        data.split_whitespace()
            .map(|s| u8::from_str_radix(s, 16))
            .collect::<Result<Vec<u8>, _>>()
            .map_err(|_| anyhow!("Invalid space-separated hex data"))?
    } else {
        // 逻辑 B: 连续的十六进制字符串，如 "11223344"
        let len = data.len();
        if len % 2 != 0 {
            // 如果长度不是偶数，则格式不正确，不能成对解析
            return Err(anyhow!("Data string is not space-separated and has an odd length, expected two hex digits per byte."));
        }

        // 将连续的字符串每两个字符分块，然后解析为 u8
        data.as_bytes()
            .chunks(2)
            .map(|chunk| {
                // 将 [u8] 切片转换为 &str，然后解析
                let hex_str = std::str::from_utf8(chunk)
                    .map_err(|_| anyhow!("Failed to convert byte chunk to string"))?;

                u8::from_str_radix(hex_str, 16)
                    .map_err(|_| anyhow!("Invalid continuous hex data: {}", hex_str))
            })
            .collect::<Result<Vec<u8>, _>>() // 收集结果
            .map_err(|e| anyhow!("{}", e))?
    };

    // Don't pad data - send exactly what was requested
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
                         .unwrap_or(id); // 如果没有前缀，则使用原始字符串
    // 2. 判断剩余部分是否为空，如果为空，则默认设置为十六进制的 0x200 (即十进制的 512)
    let can_id = if id_hex_part.is_empty() {
        // 如果输入字符串是 "0x" 或 "0X"，则 id_hex_part 为空。
        // 十六进制的 200 (u32)
        0x200 
    } else {
        // 3. 否则，进行正常的十六进制解析
        u32::from_str_radix(id_hex_part, 16)
            .map_err(|_| anyhow!("Invalid CAN ID format: \"{}\"", id))?
    };

    let mut packet = vec![0xAA, 0x55, 0x01, 0x01, 0x01]; // Header

    // Extended frame: 4-byte ID, little-endian
    let id_bytes = can_id.to_le_bytes();
    packet.extend_from_slice(&id_bytes);
    info!("Extended frame ID bytes (little-endian): {:02X?}", id_bytes);
    

    // Data length，fixed 8 bytes
    packet.push(0x08);
    
    // Data content
    packet.extend_from_slice(&data_bytes);
    info!("Added data bytes: {:02X?}", data_bytes);
    
    // reserved byte
    packet.push(0x00);
    let checksum: u8 = packet[2..].iter().map(|&b| b as u32).sum::<u32>() as u8 & 0xFF;
    //checksum byte
    packet.push(checksum);

    info!("Send packet: {:02X?} (length: {} bytes)", packet, packet.len());
    info!("Python comparison - Expected length: 15 bytes, Actual length: {} bytes", packet.len());
    Ok(packet)
}



// Tauri command functions
#[tauri::command]
async fn get_available_ports() -> Result<Vec<String>, String> {
    match available_ports() {
        Ok(ports) => {
            let port_names: Vec<String> = ports
                .into_iter()
                .map(|p| p.port_name)
                .collect();
            Ok(port_names)
        }
        Err(e) => {
            error!("Failed to get available ports: {}", e);
            Err(format!("Failed to get available ports: {}", e))
        }
    }
}

// 解析接收到的CAN消息 - 固定20字节协议
// 协议格式（20字节）:
// 字节位置 | 字段 | 说明
// 0 | 数据包报头 | 0xAA
// 1 | 数据包报头 | 0x55
// 2 | 类型 | 0x01
// 3 | 框架类型 | 0x01
// 4 | 框架模式 | 0x01
// 5-8 | CAN ID | 4字节 (小端序)
// 9 | 数据长度 | 0x08
// 10-17 | CAN数据 | 8字节
// 18 | 保留 | 0x00
// 19 | 检查代码 | 校验和
fn parse_received_can_message(data: &[u8]) -> Option<(String, String)> {
    // 检查长度
    if data.len() < 20 {
        println!("❌ [Parse] Data too short: {} bytes (need 20)", data.len());
        return None;
    }

    // 检查帧头
    if data[0] != 0xAA || data[1] != 0x55 {
        println!("❌ [Parse] Invalid frame header: {:02X} {:02X}", data[0], data[1]);
        return None;
    }

    println!("🔍 [Parse] Fixed 20-byte protocol");
    println!("🔍 [Parse] Type: 0x{:02X}, Frame Type: 0x{:02X}, Frame Mode: 0x{:02X}",
             data[2], data[3], data[4]);

    // 解析CAN ID (字节5-8，小端序)
    let can_id = (data[5] as u32) |
                 ((data[6] as u32) << 8) |
                 ((data[7] as u32) << 16) |
                 ((data[8] as u32) << 24);

    println!("🔍 [Parse] CAN ID bytes: {:02X} {:02X} {:02X} {:02X} -> 0x{:08X}",
             data[5], data[6], data[7], data[8], can_id);

    // 数据长度 (字节9)
    let data_len = data[9] as usize;
    println!("🔍 [Parse] Data length: {}", data_len);

    if data_len > 8 {
        println!("❌ [Parse] Invalid data length: {} (max 8)", data_len);
        return None;
    }

    // 提取CAN数据 (字节10-17)
    let can_data = data[10..10 + data_len]
        .iter()
        .map(|b| format!("{:02X}", b))
        .collect::<Vec<_>>()
        .join(" ");

    println!("🔍 [Parse] CAN Data: {}", can_data);

    // 验证校验和 (字节19)
    let checksum_received = data[19];
    let checksum_calculated: u8 = data[2..19].iter().map(|&b| b as u32).sum::<u32>() as u8;

    println!("🔍 [Parse] Checksum - Received: 0x{:02X}, Calculated: 0x{:02X}",
             checksum_received, checksum_calculated);

    if checksum_received != checksum_calculated {
        println!("⚠️  [Parse] Checksum mismatch!");
        // 继续处理，不中断
    }

    let can_id_str = format!("0x{:08X}", can_id);
    println!("✅ [Parse] Successfully parsed - ID: {}, Data: {}", can_id_str, can_data);
    Some((can_id_str, can_data))
}

// 从CAN数据中解析距离值（取最后两个字节）
fn parse_distance_from_data(data: &str) -> u16 {
    let bytes: Vec<&str> = data.split_whitespace().collect();
    if bytes.len() >= 2 {
        let last_two = format!("{}{}", bytes[bytes.len() - 2], bytes[bytes.len() - 1]);
        if let Ok(distance) = u16::from_str_radix(&last_two, 16) {
            return distance;
        }
    }
    0
}

// 启动I/O线程 - 独占拥有串口，处理读写
fn start_io_thread(
    mut serial_port: Box<dyn SerialPort>,
    state: AppState,
    rx_send: mpsc::Receiver<SendMessage>,
    app_handle: tauri::AppHandle,
) {
    state.write_thread_running.store(true, Ordering::SeqCst);
    state.receive_thread_running.store(true, Ordering::SeqCst);

    thread::spawn(move || {
        let mut buffer = vec![0u8; 1024];
        println!("🚀 [I/O Thread] Started - Ready to handle read/write operations");
        info!("🚀 [I/O Thread] Started - Ready to handle read/write operations");

        while state.write_thread_running.load(Ordering::SeqCst) {
            // 尝试接收写入请求（非阻塞）
            match rx_send.try_recv() {
                Ok(msg) => {
                    info!("I/O thread: sending {} bytes", msg.packet.len());
                    match serial_port.write_all(&msg.packet) {
                        Ok(_) => {
                            info!("I/O thread: packet sent successfully");
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
                            // 打印原始数据
                            println!("📥 [I/O Thread] Received {} bytes: {:02X?}", n, received_data);
                            info!("📥 [I/O Thread] Received {} bytes: {:02X?}", n, received_data);

                            let timestamp = chrono::Local::now().format("%H:%M:%S%.3f").to_string();

                            // 将原始数据转换为十六进制字符串
                            let raw_hex = received_data
                                .iter()
                                .map(|b| format!("{:02X}", b))
                                .collect::<Vec<_>>()
                                .join(" ");

                            if let Some((can_id, can_data)) = parse_received_can_message(received_data) {
                                println!("✅ [I/O Thread] Parsed CAN message - ID: {}, Data: {}", can_id, can_data);
                                info!("✅ [I/O Thread] Parsed CAN message - ID: {}, Data: {}", can_id, can_data);

                                // 发送通用CAN消息事件（包含原始数据）
                                let can_message = serde_json::json!({
                                    "id": can_id,
                                    "data": can_data,
                                    "rawData": raw_hex.clone(),
                                    "timestamp": timestamp,
                                    "direction": "received",
                                    "frameType": "standard",
                                });
                                let _ = app_handle.emit("can-message-received", can_message);

                                // 检查是否是雷达消息
                                if can_id == "0x0521" || can_id == "0x0522" || can_id == "0x0523" || can_id == "0x0524" {
                                    let distance = parse_distance_from_data(&can_data);
                                    println!("🎯 [I/O Thread] Radar message - ID: {}, Distance: {} mm", can_id, distance);
                                    info!("🎯 [I/O Thread] Radar message - ID: {}, Distance: {} mm", can_id, distance);
                                    let radar_message = serde_json::json!({
                                        "id": can_id,
                                        "distance": distance,
                                        "data": can_data,
                                        "rawData": raw_hex.clone(),
                                        "timestamp": timestamp,
                                    });
                                    let _ = app_handle.emit("radar-message", radar_message);
                                }
                            } else {
                                // 即使解析失败，也发送原始数据事件
                                println!("⚠️  [I/O Thread] Failed to parse CAN message, sending raw data");
                                info!("⚠️  [I/O Thread] Failed to parse CAN message from raw data: {:02X?}", received_data);

                                // 发送原始数据事件
                                let can_message = serde_json::json!({
                                    "id": "UNKNOWN",
                                    "data": raw_hex.clone(),
                                    "rawData": raw_hex,
                                    "timestamp": timestamp,
                                    "direction": "received",
                                    "frameType": "unknown",
                                });
                                let _ = app_handle.emit("can-message-received", can_message);
                            }
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



async fn send_can_config(state: &State<'_, AppState>, config: &SerialConfig) -> Result<()> {
    info!("Sending CAN config");
    let packet = create_can_config_packet(config);

    // 通过通道发送配置包
    let tx_send = state.tx_send.lock().unwrap();
    if let Some(ref sender) = *tx_send {
        sender.send(SendMessage { packet }).map_err(|e| {
            error!("Failed to send config packet through channel: {}", e);
            anyhow!("Failed to send config packet")
        })?;
        info!("Config packet sent through channel");
    } else {
        error!("Send channel not available");
        return Err(anyhow!("Send channel not available"));
    }

    Ok(())
}

#[tauri::command]
async fn connect_serial(
    config: SerialConfig,
    state: State<'_, AppState>,
    app_handle: tauri::AppHandle,
) -> Result<String, String> {
    info!("Connecting to serial port: {}", config.port);

    // Check if already connected
    {
        let is_connected = state.is_connected.lock().unwrap();
        if *is_connected {
            return Err("Already connected".to_string());
        }
    }

    // Open serial port
    println!("🔌 [Connect] Opening serial port: {} at {} baud", config.port, config.baud_rate);
    let port = match serialport::new(&config.port, config.baud_rate)
        .timeout(std::time::Duration::from_millis(1000))
        .open()
    {
        Ok(port) => {
            println!("✅ [Connect] Serial port opened successfully");
            port
        }
        Err(e) => {
            println!("❌ [Connect] Failed to open port: {}", e);
            return Err(format!("Failed to open port: {}", e));
        }
    };

    // 创建发送通道
    println!("📡 [Connect] Creating send channel");
    let (tx_send, rx_send) = mpsc::channel();

    // 保存发送端到state
    {
        let mut tx_send_guard = state.tx_send.lock().unwrap();
        *tx_send_guard = Some(tx_send);
    }

    // Set connection state
    {
        let mut is_connected = state.is_connected.lock().unwrap();
        *is_connected = true;
    }

    // Send CAN config through channel
    println!("⚙️  [Connect] Sending CAN configuration");
    if let Err(e) = send_can_config(&state, &config).await {
        warn!("Failed to send CAN configuration: {}", e);
        println!("⚠️  [Connect] Failed to send CAN configuration: {}", e);
    }

    // Start single I/O thread that handles both read and write
    println!("🧵 [Connect] Starting I/O thread");
    let state_clone = state.inner().clone();
    start_io_thread(port, state_clone, rx_send, app_handle);

    println!("✅ [Connect] Serial port connected successfully - Ready to receive messages!");
    info!("Serial port connected successfully");
    Ok("Connected successfully".to_string())
}

#[tauri::command]
async fn disconnect_serial(state: State<'_, AppState>) -> Result<String, String> {
    info!("Disconnecting serial port");

    // Stop receive thread
    state.receive_thread_running.store(false, Ordering::SeqCst);

    // Stop write thread
    state.write_thread_running.store(false, Ordering::SeqCst);

    // Clear send channel
    {
        let mut tx_send = state.tx_send.lock().unwrap();
        *tx_send = None;
    }

    {
        let mut is_connected = state.is_connected.lock().unwrap();
        *is_connected = false;
    }

    // 等待线程停止
    thread::sleep(Duration::from_millis(100));

    info!("Serial port disconnected");
    Ok("Disconnected".to_string())
}

#[tauri::command]
async fn send_can_message(
    id: String,
    data: String,
    frame_type: String,
    protocol_length: String,
    state: State<'_, AppState>,
) -> Result<String, String> {
    info!("Sending CAN message - ID: {}, Data: {}, Type: {}, Protocol: {}", id, data, frame_type, protocol_length);

    // Check connection state
    {
        let is_connected = state.is_connected.lock().unwrap();
        if !*is_connected {
            error!("Connection check failed: device not connected");
            return Err("Not connected".to_string());
        }
        info!("Connection check passed");
    }

    // Create send packet
    info!("Creating CAN packet...");
    let packet: Vec<u8> = {
        if protocol_length == "fixed" {
            match create_can_send_packet_fixed(&id, &data) {
                Ok(p) => {
                    info!("CAN packet created successfully (Fixed)");
                    p
                },
                Err(e) => {
                    error!("CAN packet creation failed: {}", e);
                    return Err(format!("Failed to create packet: {}", e));
                }
            }
        } else {
            match create_can_send_packet(&id, &data, &frame_type) {
                Ok(p) => {
                    info!("CAN packet created successfully");
                    p
                },
                Err(e) => {
                    error!("CAN packet creation failed: {}", e);
                    return Err(format!("Failed to create packet: {}", e));
                }
            }
        }
    };


    // Send data through channel
    info!("Preparing to send packet through channel...");
    info!("Packet content: {:02X?}", packet);

    let tx_send = state.tx_send.lock().unwrap();
    if let Some(ref sender) = *tx_send {
        match sender.send(SendMessage { packet }) {
            Ok(_) => {
                info!("CAN message sent to write thread successfully!");
                Ok("Message sent successfully".to_string())
            }
            Err(e) => {
                error!("Failed to send message through channel: {}", e);
                Err(format!("Failed to send message: {}", e))
            }
        }
    } else {
        error!("Send channel not available");
        Err("Send channel not available".to_string())
    }


    // {
    //     let mut serial_port = state.serial_port.lock().unwrap();
    //     if let Some(ref mut port) = *serial_port {
    //         info!("Serial port available, sending {} bytes", packet.len());
    //         info!("Packet content: {:02X?}", packet);

    //         match port.write_all(&packet) {
    //             Ok(_) => {
    //                 info!("Packet written to serial port successfully");

    //                 // Try to flush buffer
    //                 match port.flush() {
    //                     Ok(_) => {
    //                         info!("Serial port buffer flushed successfully");
    //                     }
    //                     Err(e) => {
    //                         warn!("Serial port buffer flush failed: {}", e);
    //                     }
    //                 }

    //                 info!("CAN message send completed!");
    //                 Ok("Message sent successfully".to_string())
    //             }
    //             Err(e) => {
    //                 error!("Serial port write failed: {}", e);
    //                 Err(format!("Failed to send message: {}", e))
    //             }
    //         }
    //     } else {
    //         error!("Serial port not available");
    //         Err("Serial port not available".to_string())
    //     }
    // }
}

#[tauri::command]
async fn start_csv_loop(
    csv_content: String,
    interval_ms: u64,
    can_id_column_index: usize,
    can_data_column_index: usize,
    csv_start_row_index: usize,
    config: serde_json::Value,
    state: State<'_, AppState>,
) -> Result<String, String> {
    println!("🚀 [Rust] start_csv_loop called - Interval: {}ms, CSV length: {}, Start row: {}", interval_ms, csv_content.len(), csv_start_row_index);
    info!("Starting CSV loop - Interval: {}ms, Start row: {}", interval_ms, csv_start_row_index);

    // Check if already running
    if state.csv_loop_running.load(Ordering::SeqCst) {
        println!("❌ [Rust] CSV loop already running");
        return Err("CSV loop already running".to_string());
    }

    // Check connection
    {
        let is_connected = state.is_connected.lock().unwrap();
        if !*is_connected {
            println!("❌ [Rust] Not connected");
            return Err("Not connected".to_string());
        }
    }
    println!("✅ [Rust] Connection check passed");

    // Set running flag
    state.csv_loop_running.store(true, Ordering::SeqCst);

    // Clone state for the loop thread
    let state_clone = Arc::new(AppState {
        tx_send: state.tx_send.clone(),
        is_connected: state.is_connected.clone(),
        csv_loop_running: state.csv_loop_running.clone(),
        receive_thread_running: state.receive_thread_running.clone(),
        write_thread_running: state.write_thread_running.clone(),
    });
    let csv_content_clone = csv_content.clone();
    let config_clone = config.clone();

    // Spawn thread for CSV loop
    std::thread::spawn(move || {
        if let Err(e) = run_csv_loop(
            csv_content_clone,
            interval_ms,
            can_id_column_index,
            can_data_column_index,
            csv_start_row_index,
            config_clone,
            state_clone,
        ) {
            error!("CSV loop error: {}", e);
        }
    });

    Ok("CSV loop started".to_string())
}

fn run_csv_loop(
    csv_content: String,
    interval_ms: u64,
    can_id_column_index: usize,
    can_data_column_index: usize,
    csv_start_row_index: usize,
    _config: serde_json::Value,
    state: Arc<AppState>,
) -> Result<()> {
    println!("🔄 [Rust] run_csv_loop started - Start row: {}", csv_start_row_index);

    // Parse CSV content from string
    let mut reader = ReaderBuilder::new()
        .has_headers(false)
        .from_reader(csv_content.as_bytes());

    let mut records = Vec::new();
    for result in reader.records() {
        let record = result.map_err(|e| anyhow!("CSV read error: {}", e))?;
        records.push(record);
    }

    println!("✅ [Rust] Loaded {} records from CSV", records.len());
    info!("Loaded {} records from CSV", records.len());

    if records.is_empty() {
        println!("❌ [Rust] CSV file is empty");
        return Err(anyhow!("CSV file is empty"));
    }

    // Check if start row index is valid
    if csv_start_row_index >= records.len() {
        println!("❌ [Rust] Start row index {} out of range (max: {})", csv_start_row_index, records.len() - 1);
        return Err(anyhow!("Start row index out of range"));
    }

    // Filter records starting from csv_start_row_index
    let filtered_records: Vec<_> = records.iter().skip(csv_start_row_index).collect();

    if filtered_records.is_empty() {
        println!("❌ [Rust] No records after start row index");
        return Err(anyhow!("No records after start row index"));
    }

    println!("✅ [Rust] Using {} records starting from row {}", filtered_records.len(), csv_start_row_index);

    // Loop through records once
    for (index, record) in filtered_records.iter().enumerate() {
        // Check if loop should stop
        if !state.csv_loop_running.load(Ordering::SeqCst) {
            println!("🛑 [Rust] CSV loop stopped by user");
            break;
        }

        // Get CAN ID and Data from specified columns
        let can_id = record
            .get(can_id_column_index)
            .ok_or_else(|| anyhow!("CAN ID column index out of range"))?
            .to_string();

        let can_data = record
            .get(can_data_column_index)
            .ok_or_else(|| anyhow!("CAN Data column index out of range"))?
            .to_string();

        // Try to parse vehicle control data (speed and steering angle)
        let vehicle_control = extract_vehicle_control(&can_data).ok();

        if let Some(ref vc) = vehicle_control {
            println!("📊 [Rust] Parsed vehicle control - Speed: {} mm/s, Steering: {:.3} rad",
                     vc.linear_velocity_mms, vc.steering_angle_rad);
            info!("Parsed vehicle control - Speed: {} mm/s, Steering: {:.3} rad",
                  vc.linear_velocity_mms, vc.steering_angle_rad);
        }

        // Create and send packet
        let packet = create_can_send_packet_fixed(&can_id, &can_data)?;

        // Send packet through channel
        {
            let tx_send = state.tx_send.lock().unwrap();
            if let Some(ref sender) = *tx_send {
                if let Err(e) = sender.send(SendMessage { packet }) {
                    error!("Failed to send packet through channel: {}", e);
                } else {
                    info!("Sent CAN message - ID: {}, Data: {}", can_id, can_data);
                }
            }
        }

        // Sleep for interval (except after the last record)
        if index < filtered_records.len() - 1 {
            thread::sleep(Duration::from_millis(interval_ms));
        }
    }

    println!("✅ [Rust] CSV loop completed - All records sent");
    info!("CSV loop completed - All records sent");

    // Stop the loop flag
    state.csv_loop_running.store(false, Ordering::SeqCst);

    Ok(())
}

#[tauri::command]
async fn stop_csv_loop(state: State<'_, AppState>) -> Result<String, String> {
    info!("Stopping CSV loop");
    state.csv_loop_running.store(false, Ordering::SeqCst);

    // Give thread time to stop
    thread::sleep(Duration::from_millis(100));

    Ok("CSV loop stopped".to_string())
}

/// 预加载 CSV 数据并解析车辆控制信息
#[tauri::command]
async fn preload_csv_data(
    csv_content: String,
    can_id_column_index: usize,
    can_data_column_index: usize,
    csv_start_row_index: usize,
) -> Result<Vec<CsvLoopProgress>, String> {
    println!("📂 [Rust] preload_csv_data called");

    // Parse CSV content from string
    let mut reader = ReaderBuilder::new()
        .has_headers(false)
        .from_reader(csv_content.as_bytes());

    let mut records = Vec::new();
    for result in reader.records() {
        let record = result.map_err(|e| format!("CSV read error: {}", e))?;
        records.push(record);
    }

    println!("✅ [Rust] Loaded {} records from CSV", records.len());

    if records.is_empty() {
        return Err("CSV file is empty".to_string());
    }

    // Check if start row index is valid
    if csv_start_row_index >= records.len() {
        return Err(format!("Start row index {} out of range (max: {})", csv_start_row_index, records.len() - 1));
    }

    // Filter records starting from csv_start_row_index
    let filtered_records: Vec<_> = records.iter().skip(csv_start_row_index).collect();
    let total = filtered_records.len();

    let mut progress_list = Vec::new();

    // Parse each record
    for (index, record) in filtered_records.iter().enumerate() {
        let can_id = record
            .get(can_id_column_index)
            .ok_or_else(|| "CAN ID column index out of range".to_string())?
            .to_string();

        let can_data = record
            .get(can_data_column_index)
            .ok_or_else(|| "CAN Data column index out of range".to_string())?
            .to_string();

        // Try to parse vehicle control data
        let vehicle_control = extract_vehicle_control(&can_data).ok();

        progress_list.push(CsvLoopProgress {
            index,
            total,
            can_id,
            can_data,
            vehicle_control,
        });
    }

    println!("✅ [Rust] Preloaded {} records with vehicle control data", progress_list.len());
    Ok(progress_list)
}

/// 使用预解析的数据启动 CSV 循环
#[tauri::command]
async fn start_csv_loop_with_preloaded_data(
    preloaded_data: Vec<CsvLoopProgress>,
    interval_ms: u64,
    _config: serde_json::Value,
    state: State<'_, AppState>,
) -> Result<String, String> {
    println!("🚀 [Rust] start_csv_loop_with_preloaded_data called - Interval: {}ms, Records: {}", interval_ms, preloaded_data.len());
    info!("Starting CSV loop with preloaded data - Interval: {}ms, Records: {}", interval_ms, preloaded_data.len());

    // Check if already running
    if state.csv_loop_running.load(Ordering::SeqCst) {
        println!("❌ [Rust] CSV loop already running");
        return Err("CSV loop already running".to_string());
    }

    // Set running flag
    state.csv_loop_running.store(true, Ordering::SeqCst);

    // Create Arc wrapper for the state
    let state_arc = Arc::new(AppState {
        tx_send: state.tx_send.clone(),
        is_connected: state.is_connected.clone(),
        csv_loop_running: state.csv_loop_running.clone(),
        receive_thread_running: state.receive_thread_running.clone(),
        write_thread_running: state.write_thread_running.clone(),
    });

    // Spawn thread for CSV loop
    std::thread::spawn(move || {
        if let Err(e) = run_csv_loop_with_preloaded_data(
            preloaded_data,
            interval_ms,
            state_arc,
        ) {
            error!("CSV loop error: {}", e);
        }
    });

    Ok("CSV loop started".to_string())
}

fn run_csv_loop_with_preloaded_data(
    preloaded_data: Vec<CsvLoopProgress>,
    interval_ms: u64,
    state: Arc<AppState>,
) -> Result<()> {
    println!("🔄 [Rust] run_csv_loop_with_preloaded_data started - Records: {}", preloaded_data.len());

    // Loop through records once
    for (index, progress) in preloaded_data.iter().enumerate() {
        // Check if loop should stop
        if !state.csv_loop_running.load(Ordering::SeqCst) {
            println!("🛑 [Rust] CSV loop stopped by user");
            break;
        }

        let can_id = &progress.can_id;
        let can_data = &progress.can_data;

        // Log vehicle control data if available
        if let Some(ref vc) = progress.vehicle_control {
            println!("📊 [Rust] Record {}/{} - Speed: {} mm/s, Steering: {:.3} rad",
                     index + 1, preloaded_data.len(), vc.linear_velocity_mms, vc.steering_angle_rad);
            info!("Record {}/{} - Speed: {} mm/s, Steering: {:.3} rad",
                  index + 1, preloaded_data.len(), vc.linear_velocity_mms, vc.steering_angle_rad);
        }

        // Create and send packet
        let packet = create_can_send_packet_fixed(&can_id, &can_data)?;

        // Send packet through channel
        {
            let tx_send = state.tx_send.lock().unwrap();
            if let Some(ref sender) = *tx_send {
                if let Err(e) = sender.send(SendMessage { packet }) {
                    error!("Failed to send packet through channel: {}", e);
                } else {
                    info!("Sent CAN message - ID: {}, Data: {}", can_id, can_data);
                }
            }
        }

        // Sleep for interval (except after the last record)
        if index < preloaded_data.len() - 1 {
            thread::sleep(Duration::from_millis(interval_ms));
        }
    }

    println!("✅ [Rust] CSV loop completed - All records sent");
    info!("CSV loop completed - All records sent");

    // Stop the loop flag
    state.csv_loop_running.store(false, Ordering::SeqCst);

    Ok(())
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    // Initialize logger with debug level
    std::env::set_var("RUST_LOG", "debug");
    env_logger::init();

    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .manage(AppState::default())
        .invoke_handler(tauri::generate_handler![
            get_available_ports,
            connect_serial,
            disconnect_serial,
            send_can_message,
            start_csv_loop,
            stop_csv_loop,
            preload_csv_data,
            start_csv_loop_with_preloaded_data
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}