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

mod can_protocol;
use can_protocol::{
    create_can_config_packet, create_can_send_packet_fixed,
    parse_received_can_message, parse_distance_from_data, parse_vehicle_status_8byte,
};

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

// USB-CAN protocol functions are now in can_protocol module

// Legacy CAN send packet function (not used with fixed 20-byte protocol)

// create_can_send_packet_fixed moved to can_protocol module



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

// CAN parsing functions moved to can_protocol module

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
        let mut message_buffer = Vec::new();  // 消息缓冲区，用于组装完整的消息

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

                            // 将接收到的数据添加到消息缓冲区
                            message_buffer.extend_from_slice(received_data);
                            println!("📦 [I/O Thread] Message buffer size: {} bytes, content: {:02X?}", message_buffer.len(), message_buffer);

                            // 处理缓冲区中的完整消息
                            loop {
                                println!("🔄 [I/O Thread] Processing buffer, size: {}", message_buffer.len());

                                // 检查是否找到了消息头 (AA 55)
                                if let Some(header_pos) = message_buffer.windows(2).position(|w| w == [0xAA, 0x55]) {
                                    println!("🎯 [I/O Thread] Found message header at position {}", header_pos);

                                    // 如果消息头不在开始位置，丢弃前面的数据
                                    if header_pos > 0 {
                                        println!("⚠️  [I/O Thread] Discarding {} bytes before message header", header_pos);
                                        message_buffer.drain(0..header_pos);
                                    }

                                    // 现在消息头在开始位置，计算消息长度
                                    if message_buffer.len() < 10 {
                                        // 还没有足够的数据来读取数据长度字段
                                        println!("⏳ [I/O Thread] Not enough data to read length field: have {} bytes, need 10", message_buffer.len());
                                        break;
                                    }

                                    // 读取数据长度字段 (字节9)
                                    let data_len = message_buffer[9] as usize;
                                    println!("📏 [I/O Thread] Byte[9] (data_len): 0x{:02X} = {}", message_buffer[9], data_len);

                                    // 验证数据长度是否合理
                                    if data_len > 8 {
                                        println!("❌ [I/O Thread] Invalid data length: {} (max 8), skipping this byte", data_len);
                                        message_buffer.remove(0);
                                        continue;
                                    }

                                    // 计算完整消息长度：10(头部) + data_len + 2(保留+校验)
                                    let message_length = 10 + data_len + 2;
                                    println!("📏 [I/O Thread] Data length: {}, Expected message length: {}", data_len, message_length);

                                    // 检查是否有完整的消息
                                    if message_buffer.len() >= message_length {
                                        let complete_message = message_buffer.drain(0..message_length).collect::<Vec<_>>();

                                        let timestamp = chrono::Local::now().format("%H:%M:%S%.3f").to_string();

                                        // 将原始数据转换为十六进制字符串
                                        let raw_hex = complete_message
                                            .iter()
                                            .map(|b| format!("{:02X}", b))
                                            .collect::<Vec<_>>()
                                            .join(" ");

                                        println!("✅ [I/O Thread] Complete message extracted ({} bytes): {}", complete_message.len(), raw_hex);

                                        if let Some((can_id, can_data)) = parse_received_can_message(&complete_message) {
                                            println!("✅ [I/O Thread] Parsed CAN message - ID: {}, Data: {}", can_id, can_data);
                                            info!("✅ [I/O Thread] Parsed CAN message - ID: {}, Data: {}", can_id, can_data);

                                            // 尝试解析新协议的车辆状态（ID: 0x00000123）
                                            let mut vehicle_status: Option<(String, f32)> = None;
                                            if can_id == "0x00000123" {
                                                vehicle_status = parse_vehicle_status_8byte(&can_data);
                                            }

                                            // 发送通用CAN消息事件（包含原始数据）
                                            let mut can_message = serde_json::json!({
                                                "id": can_id,
                                                "data": can_data,
                                                "rawData": raw_hex.clone(),
                                                "timestamp": timestamp,
                                                "direction": "received",
                                                "frameType": "standard",
                                            });

                                            // 如果解析了车辆状态，添加到消息中
                                            if let Some((gear, steering_angle)) = vehicle_status {
                                                can_message["gear"] = serde_json::json!(gear);
                                                can_message["steeringAngle"] = serde_json::json!(steering_angle);
                                            }

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
                                            info!("⚠️  [I/O Thread] Failed to parse CAN message from raw data: {}", raw_hex);

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
                                        // 继续处理缓冲区中的下一条消息
                                        println!("🔄 [I/O Thread] Continuing to process buffer, remaining: {} bytes", message_buffer.len());
                                        continue;
                                    } else {
                                        // 还没有收到完整的消息，等待更多数据
                                        println!("⏳ [I/O Thread] Incomplete message: have {} bytes, need {} bytes", message_buffer.len(), message_length);
                                        break;
                                    }
                                } else {
                                    // 没有找到完整的消息头 (AA 55)
                                    // 检查缓冲区是否至少有2个字节
                                    if message_buffer.len() < 2 {
                                        // 缓冲区太小，等待更多数据
                                        println!("⏳ [I/O Thread] Buffer too small to search for header: {} bytes", message_buffer.len());
                                        break;
                                    }

                                    // 检查第一个字节是否是 AA
                                    if message_buffer[0] == 0xAA {
                                        // 第一个字节是 AA，但第二个字节不是 55
                                        // 这可能是一个错误的 AA，丢弃它
                                        println!("⚠️  [I/O Thread] Found 0xAA at position 0, but next byte is 0x{:02X} (not 0x55), discarding", message_buffer[1]);
                                        message_buffer.remove(0);
                                        continue;
                                    } else {
                                        // 第一个字节不是 AA，丢弃它
                                        println!("⚠️  [I/O Thread] First byte is 0x{:02X} (not 0xAA), discarding", message_buffer[0]);
                                        message_buffer.remove(0);
                                        continue;
                                    }
                                }
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
    let packet: Vec<u8> = match create_can_send_packet_fixed(&id, &data, &frame_type) {
        Ok(p) => {
            info!("CAN packet created successfully");
            p
        },
        Err(e) => {
            error!("CAN packet creation failed: {}", e);
            return Err(format!("Failed to create packet: {}", e));
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
    config: serde_json::Value,
    state: Arc<AppState>,
) -> Result<()> {
    println!("🔄 [Rust] run_csv_loop started - Start row: {}", csv_start_row_index);

    // Extract frame_type from config
    let frame_type = config.get("frame_type")
        .and_then(|v| v.as_str())
        .unwrap_or("standard")
        .to_string();

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

        // Check if CAN data is empty - if so, stop the loop
        if can_data.trim().is_empty() {
            println!("🛑 [Rust] Empty CAN data detected - CSV loop ended");
            info!("Empty CAN data detected - CSV loop ended");
            break;
        }

        // Try to parse vehicle control data (speed and steering angle)
        let vehicle_control = extract_vehicle_control(&can_data).ok();

        if let Some(ref vc) = vehicle_control {
            println!("📊 [Rust] Parsed vehicle control - Speed: {} mm/s, Steering: {:.3} rad",
                     vc.linear_velocity_mms, vc.steering_angle_rad);
            info!("Parsed vehicle control - Speed: {} mm/s, Steering: {:.3} rad",
                  vc.linear_velocity_mms, vc.steering_angle_rad);
        }

        // Create and send packet
        let packet = create_can_send_packet_fixed(&can_id, &can_data, &frame_type)?;

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
    config: serde_json::Value,
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
    let config_clone = config.clone();
    std::thread::spawn(move || {
        if let Err(e) = run_csv_loop_with_preloaded_data(
            preloaded_data,
            interval_ms,
            config_clone,
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
    config: serde_json::Value,
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

        // Check if CAN data is empty - if so, stop the loop
        if can_data.trim().is_empty() {
            println!("🛑 [Rust] Empty CAN data detected - CSV loop ended");
            info!("Empty CAN data detected - CSV loop ended");
            break;
        }

        // Log vehicle control data if available
        if let Some(ref vc) = progress.vehicle_control {
            println!("📊 [Rust] Record {}/{} - Speed: {} mm/s, Steering: {:.3} rad",
                     index + 1, preloaded_data.len(), vc.linear_velocity_mms, vc.steering_angle_rad);
            info!("Record {}/{} - Speed: {} mm/s, Steering: {:.3} rad",
                  index + 1, preloaded_data.len(), vc.linear_velocity_mms, vc.steering_angle_rad);
        }

        // Create and send packet
        // Extract frame_type from config
        let frame_type = config.get("frame_type")
            .and_then(|v| v.as_str())
            .unwrap_or("standard");
        let packet = create_can_send_packet_fixed(&can_id, &can_data, frame_type)?;

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