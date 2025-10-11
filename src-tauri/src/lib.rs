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
    is_connected: Arc<Mutex<bool>>,
    is_receiving: Arc<Mutex<bool>>,
    config: Arc<Mutex<Option<SerialConfig>>>,
    received_messages: Arc<Mutex<Vec<CanMessage>>>,
}

impl Default for AppState {
    fn default() -> Self {
        Self {
            serial_port: Arc::new(Mutex::new(None)),
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
    let baud_config = match config.can_baud_rate {
        125000 => 0x03,
        250000 => 0x02,
        500000 => 0x01,
        1000000 => 0x00,
        _ => 0x01, // 默认500K
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
            get_received_messages
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
