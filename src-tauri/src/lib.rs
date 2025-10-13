use std::sync::{Arc, Mutex};

use serialport::{SerialPort, available_ports};
use serde::{Deserialize, Serialize};
use tauri::State;
use anyhow::{Result, anyhow};
use log::{info, error, warn};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SerialConfig {
    port: String,
    baud_rate: u32,
    can_baud_rate: u32,
    frame_type: String,
    can_mode: String,
    // 回环测试配置
    is_loopback_test: bool,
    loopback_port1: String,
    loopback_port2: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CanMessage {
    id: String,
    data: String,
    timestamp: String,
    direction: String,
    frame_type: String,
}

// 应用状态
pub struct AppState {
    serial_port: Arc<Mutex<Option<Box<dyn SerialPort>>>>,
    // 回环测试的双串口
    loopback_port1: Arc<Mutex<Option<Box<dyn SerialPort>>>>, // 发送端口
    loopback_port2: Arc<Mutex<Option<Box<dyn SerialPort>>>>, // 接收端口
    is_connected: Arc<Mutex<bool>>,
    is_receiving: Arc<Mutex<bool>>,
    config: Arc<Mutex<Option<SerialConfig>>>,
    received_messages: Arc<Mutex<Vec<CanMessage>>>,
}

impl Default for AppState {
    fn default() -> Self {
        Self {
            serial_port: Arc::new(Mutex::new(None)),
            loopback_port1: Arc::new(Mutex::new(None)),
            loopback_port2: Arc::new(Mutex::new(None)),
            is_connected: Arc::new(Mutex::new(false)),
            is_receiving: Arc::new(Mutex::new(false)),
            config: Arc::new(Mutex::new(None)),
            received_messages: Arc::new(Mutex::new(Vec::new())),
        }
    }
}

// USB-CAN协议相关函数
fn create_can_config_packet(config: &SerialConfig) -> Vec<u8> {
    let mut packet = vec![0xAA, 0x55]; // 包头

    // 配置命令
    packet.push(0x12); // 配置命令

    // CAN波特率配置 
    // 参考：https://www.waveshare.net/wiki/%E4%BA%8C%E6%AC%A1%E5%BC%80%E5%8F%91%E2%80%94%E4%B8%B2%E8%A1%8C%E8%BD%AC%E6%8D%A2CAN%E5%8D%8F%E8%AE%AE%E7%9A%84%E5%AE%9A%E4%B9%89
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
        2000000 => 0x03,  // 2Mbps
        _ => 0x03,        // 默认500K
    };
    packet.push(baud_config);

    // 帧类型和模式
    let frame_mode = match (config.frame_type.as_str(), config.can_mode.as_str()) {
        ("standard", "normal") => 0x00,
        ("extended", "normal") => 0x01,
        ("standard", "loopback") => 0x02,
        ("extended", "loopback") => 0x03,
        ("standard", "listen") => 0x04,
        ("extended", "listen") => 0x05,
        _ => 0x00,
    };
    packet.push(frame_mode);

    // 计算校验和
    let checksum: u8 = packet[2..].iter().sum::<u8>() & 0xFF;
    packet.push(checksum);

    packet
}

fn create_can_send_packet(id: &str, data: &str, frame_type: &str) -> Result<Vec<u8>> {
    let mut packet = vec![0xAA, 0x55]; // 包头

    // 发送命令
    packet.push(0x10);

    // 解析CAN ID
    let can_id = u32::from_str_radix(id, 16)
        .map_err(|_| anyhow!("Invalid CAN ID format"))?;

    // 帧类型标志
    let frame_flag = if frame_type == "extended" { 0x80 } else { 0x00 };

    if frame_type == "extended" {
        // 扩展帧：4字节ID
        packet.extend_from_slice(&(can_id | 0x80000000).to_be_bytes());
    } else {
        // 标准帧：2字节ID
        packet.extend_from_slice(&((can_id as u16) | (frame_flag as u16)).to_be_bytes());
    }

    // 解析数据
    let data_bytes: Result<Vec<u8>, _> = data
        .split_whitespace()
        .map(|s| u8::from_str_radix(s, 16))
        .collect();

    let data_bytes = data_bytes.map_err(|_| anyhow!("Invalid data format"))?;

    if data_bytes.len() > 8 {
        return Err(anyhow!("CAN data length cannot exceed 8 bytes"));
    }

    // 数据长度
    packet.push(data_bytes.len() as u8);

    // 数据内容
    packet.extend_from_slice(&data_bytes);

    // 计算校验和
    let checksum: u8 = packet[2..].iter().sum::<u8>() & 0xFF;
    packet.push(checksum);

    Ok(packet)
}

// Tauri命令函数
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

#[tauri::command]
async fn connect_serial(
    config: SerialConfig,
    state: State<'_, AppState>,
) -> Result<String, String> {
    info!("Attempting to connect to serial port: {}", config.port);

    // 检查是否已连接
    {
        let is_connected = state.is_connected.lock().unwrap();
        if *is_connected {
            return Err("Already connected".to_string());
        }
    }

    // 尝试打开串口
    match serialport::new(&config.port, config.baud_rate)
        .timeout(std::time::Duration::from_millis(1000))
        .open()
    {
        Ok(port) => {
            // 保存串口连接
            {
                let mut serial_port = state.serial_port.lock().unwrap();
                *serial_port = Some(port);
            }

            // 保存配置
            {
                let mut app_config = state.config.lock().unwrap();
                *app_config = Some(config.clone());
            }

            // 设置连接状态
            {
                let mut is_connected = state.is_connected.lock().unwrap();
                *is_connected = true;
            }

            // 发送CAN配置
            if let Err(e) = send_can_config(&state, &config).await {
                warn!("Failed to send CAN config: {}", e);
            }

            info!("Successfully connected to {}", config.port);
            Ok("Connected successfully".to_string())
        }
        Err(e) => {
            error!("Failed to open serial port {}: {}", config.port, e);
            Err(format!("Failed to open serial port: {}", e))
        }
    }
}

async fn send_can_config(state: &State<'_, AppState>, config: &SerialConfig) -> Result<()> {
    let packet = create_can_config_packet(config);

    let mut serial_port = state.serial_port.lock().unwrap();
    if let Some(ref mut port) = *serial_port {
        port.write_all(&packet)?;
        info!("CAN configuration sent");
    }

    Ok(())
}

#[tauri::command]
async fn disconnect_serial(state: State<'_, AppState>) -> Result<String, String> {
    info!("Disconnecting serial port");

    // 停止接收
    {
        let mut is_receiving = state.is_receiving.lock().unwrap();
        *is_receiving = false;
    }

    // 关闭串口
    {
        let mut serial_port = state.serial_port.lock().unwrap();
        *serial_port = None;
    }

    // 设置连接状态
    {
        let mut is_connected = state.is_connected.lock().unwrap();
        *is_connected = false;
    }

    info!("Serial port disconnected");
    Ok("Disconnected successfully".to_string())
}

#[tauri::command]
async fn send_can_message(
    id: String,
    data: String,
    frame_type: String,
    state: State<'_, AppState>,
) -> Result<String, String> {
    info!("Sending CAN message - ID: {}, Data: {}, Type: {}", id, data, frame_type);

    // 检查连接状态
    {
        let is_connected = state.is_connected.lock().unwrap();
        if !*is_connected {
            return Err("Not connected".to_string());
        }
    }

    // 创建发送数据包
    let packet = match create_can_send_packet(&id, &data, &frame_type) {
        Ok(p) => p,
        Err(e) => return Err(format!("Failed to create packet: {}", e)),
    };

    // 发送数据
    {
        let mut serial_port = state.serial_port.lock().unwrap();
        if let Some(ref mut port) = *serial_port {
            match port.write_all(&packet) {
                Ok(_) => {
                    info!("CAN message sent successfully");
                    Ok("Message sent successfully".to_string())
                }
                Err(e) => {
                    error!("Failed to send CAN message: {}", e);
                    Err(format!("Failed to send message: {}", e))
                }
            }
        } else {
            Err("Serial port not available".to_string())
        }
    }
}

#[tauri::command]
async fn start_receiving(state: State<'_, AppState>) -> Result<String, String> {
    info!("Starting to receive CAN messages");

    // 检查连接状态
    {
        let is_connected = state.is_connected.lock().unwrap();
        if !*is_connected {
            return Err("Not connected".to_string());
        }
    }

    // 设置接收状态
    {
        let mut is_receiving = state.is_receiving.lock().unwrap();
        *is_receiving = true;
    }

    // TODO: 启动接收线程
    // 这里应该启动一个后台线程来持续读取串口数据

    Ok("Started receiving".to_string())
}

#[tauri::command]
async fn stop_receiving(state: State<'_, AppState>) -> Result<String, String> {
    info!("Stopping CAN message reception");

    {
        let mut is_receiving = state.is_receiving.lock().unwrap();
        *is_receiving = false;
    }

    Ok("Stopped receiving".to_string())
}

#[tauri::command]
async fn get_received_messages(state: State<'_, AppState>) -> Result<Vec<CanMessage>, String> {
    let messages = state.received_messages.lock().unwrap();
    Ok(messages.clone())
}

#[tauri::command]
async fn start_loopback_test(
    config: SerialConfig,
    test_id: String,
    test_data: String,
    state: State<'_, AppState>,
) -> Result<String, String> {
    info!("Starting loopback test with ports: {} -> {}", config.loopback_port1, config.loopback_port2);
    info!("Test ID: {}, Test Data: {}", test_id, test_data);
    info!("CAN Mode: {}, Is dual device test: {}", config.can_mode, config.is_loopback_test);

    // 检查是单设备回环测试还是双设备回环测试
    let is_single_device = !config.is_loopback_test || config.loopback_port1 == config.loopback_port2;

    if is_single_device {
        return start_single_device_loopback_test(config, test_id, test_data, state).await;
    }

    // 打开发送端口
    let send_port = match serialport::new(&config.loopback_port1, config.baud_rate)
        .timeout(std::time::Duration::from_millis(1000))
        .open()
    {
        Ok(port) => port,
        Err(e) => return Err(format!("Failed to open send port {}: {}", config.loopback_port1, e)),
    };

    // 打开接收端口
    let receive_port = match serialport::new(&config.loopback_port2, config.baud_rate)
        .timeout(std::time::Duration::from_millis(1000))
        .open()
    {
        Ok(port) => port,
        Err(e) => return Err(format!("Failed to open receive port {}: {}", config.loopback_port2, e)),
    };

    // 保存端口到状态
    {
        let mut port1 = state.loopback_port1.lock().unwrap();
        *port1 = Some(send_port);
    }
    {
        let mut port2 = state.loopback_port2.lock().unwrap();
        *port2 = Some(receive_port);
    }

    // 配置发送端口的CAN设置
    if let Err(e) = send_can_config_to_port(&state.loopback_port1, &config).await {
        warn!("Failed to configure send port: {}", e);
    }

    // 配置接收端口的CAN设置
    if let Err(e) = send_can_config_to_port(&state.loopback_port2, &config).await {
        warn!("Failed to configure receive port: {}", e);
    }

    // 等待配置生效
    tokio::time::sleep(std::time::Duration::from_millis(500)).await;

    // 清空接收端口的缓冲区，准备接收新数据
    {
        let mut port2 = state.loopback_port2.lock().unwrap();
        if let Some(ref mut port) = *port2 {
            // 清空输入缓冲区
            if let Err(e) = port.clear(serialport::ClearBuffer::Input) {
                warn!("Failed to clear receive buffer: {}", e);
            }
            info!("Receive port buffer cleared, ready to receive");
        }
    }

    // 等待一小段时间确保接收端准备好
    tokio::time::sleep(std::time::Duration::from_millis(200)).await;

    // 现在发送测试数据
    let packet = match create_can_send_packet(&test_id, &test_data, &config.frame_type) {
        Ok(p) => p,
        Err(e) => return Err(format!("Failed to create test packet: {}", e)),
    };

    // 打印发送的数据包内容
    let hex_packet: Vec<String> = packet.iter().map(|b| format!("{:02X}", b)).collect();
    info!("Sending packet: {}", hex_packet.join(" "));

    // 通过发送端口发送数据
    {
        let mut port1 = state.loopback_port1.lock().unwrap();
        if let Some(ref mut port) = *port1 {
            match port.write_all(&packet) {
                Ok(_) => {
                    info!("Test packet sent successfully ({} bytes)", packet.len());
                    // 确保数据被发送
                    if let Err(e) = port.flush() {
                        warn!("Failed to flush send port: {}", e);
                    }
                }
                Err(e) => return Err(format!("Failed to send test packet: {}", e)),
            }
        } else {
            return Err("Send port not available".to_string());
        }
    }

    // 现在尝试接收数据 - 简化版本，避免Send trait问题
    info!("Starting receive monitoring...");
    let mut received_data = None;

    // 尝试多次读取，总共3秒
    for attempt in 1..=30 {
        tokio::time::sleep(std::time::Duration::from_millis(100)).await;

        {
            let mut port2 = state.loopback_port2.lock().unwrap();
            if let Some(ref mut port) = *port2 {
                // 设置短超时
                if let Err(e) = port.set_timeout(std::time::Duration::from_millis(50)) {
                    warn!("Failed to set timeout: {}", e);
                }

                // 检查是否有数据可读
                match port.bytes_to_read() {
                    Ok(available_bytes) => {
                        if available_bytes >= 2 {
                            info!("Attempt {}/30: {} bytes available", attempt, available_bytes);

                            // 尝试读取所有可用数据
                            let mut buffer = vec![0u8; available_bytes as usize];
                            match port.read_exact(&mut buffer) {
                                Ok(_) => {
                                    let hex_data: Vec<String> = buffer.iter()
                                        .map(|b| format!("{:02X}", b)).collect();
                                    info!("Read {} bytes: {}", buffer.len(), hex_data.join(" "));

                                    // 简单验证：检查是否包含帧头
                                    if buffer.len() >= 2 && buffer[0] == 0xaa {
                                        info!("Found valid frame header");
                                        received_data = Some(buffer);
                                        break;
                                    }
                                }
                                Err(e) => {
                                    warn!("Failed to read data: {}", e);
                                }
                            }
                        }
                    }
                    Err(e) => {
                        warn!("Failed to check available bytes: {}", e);
                    }
                }
            }
        } // 锁在这里自动释放
    }

    // 关闭端口
    {
        let mut port1 = state.loopback_port1.lock().unwrap();
        *port1 = None;
    }
    {
        let mut port2 = state.loopback_port2.lock().unwrap();
        *port2 = None;
    }

    if let Some(data) = received_data {
        let hex_data: Vec<String> = data.iter().map(|b| format!("{:02X}", b)).collect();
        Ok(format!("Loopback test successful! Received: {}", hex_data.join(" ")))
    } else {
        Err("No data received in loopback test".to_string())
    }
}

async fn send_can_config_to_port(
    port_mutex: &Arc<Mutex<Option<Box<dyn SerialPort>>>>,
    config: &SerialConfig,
) -> Result<()> {
    let packet = create_can_config_packet(config);

    let mut port = port_mutex.lock().unwrap();
    if let Some(ref mut p) = *port {
        p.write_all(&packet)?;
        info!("CAN configuration sent to port");
    }

    Ok(())
}

// 单设备回环测试函数
async fn start_single_device_loopback_test(
    config: SerialConfig,
    test_id: String,
    test_data: String,
    state: State<'_, AppState>,
) -> Result<String, String> {
    info!("Starting single device loopback test on port: {}", config.loopback_port1);
    info!("CAN Mode: {}, Baud Rate: {}", config.can_mode, config.can_baud_rate);

    // 打开串口
    let port = match serialport::new(&config.loopback_port1, config.baud_rate)
        .timeout(std::time::Duration::from_millis(1000))
        .open()
    {
        Ok(port) => port,
        Err(e) => return Err(format!("Failed to open port {}: {}", config.loopback_port1, e)),
    };

    // 保存端口到状态
    {
        let mut serial_port = state.serial_port.lock().unwrap();
        *serial_port = Some(port);
    }

    // 设置连接状态
    {
        let mut is_connected = state.is_connected.lock().unwrap();
        *is_connected = true;
    }

    // 发送CAN配置（确保设置为回环模式）
    let mut loopback_config = config.clone();
    loopback_config.can_mode = "loopback".to_string(); // 强制设置为回环模式

    if let Err(e) = send_can_config(&state, &loopback_config).await {
        warn!("Failed to configure CAN settings: {}", e);
    }

    // 等待配置生效
    tokio::time::sleep(std::time::Duration::from_millis(500)).await;

    // 清空接收缓冲区
    {
        let mut serial_port = state.serial_port.lock().unwrap();
        if let Some(ref mut port) = *serial_port {
            if let Err(e) = port.clear(serialport::ClearBuffer::Input) {
                warn!("Failed to clear input buffer: {}", e);
            }
            info!("Input buffer cleared, ready for loopback test");
        }
    }

    // 等待一小段时间确保准备好
    tokio::time::sleep(std::time::Duration::from_millis(200)).await;

    // 创建测试数据包
    let packet = match create_can_send_packet(&test_id, &test_data, &loopback_config.frame_type) {
        Ok(p) => p,
        Err(e) => return Err(format!("Failed to create test packet: {}", e)),
    };

    // 打印发送的数据包内容
    let hex_packet: Vec<String> = packet.iter().map(|b| format!("{:02X}", b)).collect();
    info!("Sending loopback test packet: {}", hex_packet.join(" "));

    // 发送数据
    {
        let mut serial_port = state.serial_port.lock().unwrap();
        if let Some(ref mut port) = *serial_port {
            match port.write_all(&packet) {
                Ok(_) => {
                    info!("Loopback test packet sent successfully ({} bytes)", packet.len());
                    // 确保数据被发送
                    if let Err(e) = port.flush() {
                        warn!("Failed to flush port: {}", e);
                    }
                }
                Err(e) => return Err(format!("Failed to send test packet: {}", e)),
            }
        } else {
            return Err("Serial port not available".to_string());
        }
    }

    // 尝试接收回环数据
    info!("Waiting for loopback data...");
    let mut received_data = None;
    let mut total_received = Vec::new();

    // 尝试多次读取，总共3秒
    for attempt in 1..=30 {
        tokio::time::sleep(std::time::Duration::from_millis(100)).await;

        {
            let mut serial_port = state.serial_port.lock().unwrap();
            if let Some(ref mut port) = *serial_port {
                let mut buffer = [0u8; 256];
                match port.read(&mut buffer) {
                    Ok(bytes_read) if bytes_read > 0 => {
                        let data = buffer[..bytes_read].to_vec();
                        total_received.extend_from_slice(&data);

                        let hex_data: Vec<String> = data.iter().map(|b| format!("{:02X}", b)).collect();
                        info!("Attempt {}: Received {} bytes: {}", attempt, bytes_read, hex_data.join(" "));

                        // 检查是否接收到完整的回环数据
                        if total_received.len() >= packet.len() {
                            received_data = Some(total_received.clone());
                            break;
                        }
                    }
                    Ok(_) => {
                        // 没有数据可读
                    }
                    Err(ref e) if e.kind() == std::io::ErrorKind::TimedOut => {
                        // 超时是正常的，继续尝试
                    }
                    Err(e) => {
                        warn!("Error reading from port: {}", e);
                    }
                }
            }
        }
    }

    // 断开连接
    {
        let mut serial_port = state.serial_port.lock().unwrap();
        *serial_port = None;
    }
    {
        let mut is_connected = state.is_connected.lock().unwrap();
        *is_connected = false;
    }

    // 分析结果
    if let Some(data) = received_data {
        let hex_sent: Vec<String> = packet.iter().map(|b| format!("{:02X}", b)).collect();
        let hex_received: Vec<String> = data.iter().map(|b| format!("{:02X}", b)).collect();

        info!("Loopback test completed successfully");
        info!("Sent:     {}", hex_sent.join(" "));
        info!("Received: {}", hex_received.join(" "));

        // 检查数据是否匹配
        if data.starts_with(&packet) {
            Ok(format!(
                "✅ 单设备回环测试成功！\n\n📤 发送数据: {}\n📥 接收数据: {}\n\n✨ 数据匹配，USB-CAN设备功能正常！\n\n💡 说明：设备已正确设置为回环模式，发送的CAN数据被成功回环接收。",
                hex_sent.join(" "),
                hex_received.join(" ")
            ))
        } else {
            Ok(format!(
                "⚠️ 单设备回环测试部分成功\n\n📤 发送数据: {}\n📥 接收数据: {}\n\n❓ 接收到数据但不完全匹配，可能包含额外的协议数据。",
                hex_sent.join(" "),
                hex_received.join(" ")
            ))
        }
    } else {
        Err(format!(
            "❌ 单设备回环测试失败\n\n📤 已发送数据: {}\n📥 未接收到回环数据\n\n🔧 请检查：\n1. 设备是否支持回环模式\n2. 波特率设置是否正确（推荐2M）\n3. 设备连接是否正常\n4. TX/RX指示灯是否闪烁",
            hex_packet.join(" ")
        ))
    }
}

#[tauri::command]
async fn test_params(test_id: String, test_data: String) -> Result<String, String> {
    info!("Test params - ID: {}, Data: {}", test_id, test_data);
    Ok(format!("Received ID: {}, Data: {}", test_id, test_data))
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    // 初始化日志
    env_logger::init();

    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .manage(AppState::default())
        .invoke_handler(tauri::generate_handler![
            get_available_ports,
            connect_serial,
            disconnect_serial,
            send_can_message,
            start_receiving,
            stop_receiving,
            get_received_messages,
            start_loopback_test,
            test_params
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
