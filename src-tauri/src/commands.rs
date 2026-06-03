use std::fs::OpenOptions;
use std::io::Write;
use std::sync::atomic::Ordering;
use std::sync::{mpsc, Arc, Mutex};
use std::thread;
use std::time::Duration;

use anyhow::{anyhow, Result};
use log::{error, info, warn};
use serialport::available_ports;
use tauri::{Emitter, Manager, State};

use crate::can_protocol::{
    create_can_config_packet, create_can_send_packet_fixed, create_can_send_packet_variable,
};
use crate::infinite_loop::run_infinite_drive;
use crate::io_thread::start_io_thread;
use crate::system_monitor_thread::start_system_monitor_thread;
use crate::{AppState, SendMessage, SerialConfig};

/// Get available serial ports
#[tauri::command]
pub async fn get_available_ports() -> Result<Vec<String>, String> {
    match available_ports() {
        Ok(ports) => {
            let port_names: Vec<String> = ports.into_iter().map(|p| p.port_name).collect();
            Ok(port_names)
        }
        Err(e) => {
            error!("Failed to get available ports: {}", e);
            Err(format!("Failed to get available ports: {}", e))
        }
    }
}

/// Send CAN configuration through channel
async fn send_can_config(state: &State<'_, AppState>, config: &SerialConfig) -> Result<()> {
    info!("Sending CAN config");
    let packet = create_can_config_packet(config);

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

/// Connect to serial port
#[tauri::command]
pub async fn connect_serial(
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
    println!(
        "🔌 [Connect] Opening serial port: {} at {} baud",
        config.port, config.baud_rate
    );
    let port = match serialport::new(&config.port, config.baud_rate)
        .timeout(Duration::from_millis(1000))
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

    // Create send channel
    println!("📡 [Connect] Creating send channel");
    let (tx_send, rx_send) = mpsc::channel();

    // Save sender to state
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

    // Start I/O thread
    println!("🧵 [Connect] Starting I/O thread");
    let state_clone = state.inner().clone();
    start_io_thread(port, state_clone, rx_send, app_handle.clone());

    println!("✅ [Connect] Serial port connected successfully - Ready to receive messages!");
    info!("Serial port connected successfully");

    // Emit connection status event so debug panel and other windows can react
    let _ = app_handle.emit("serial-status", serde_json::json!({ "connected": true }));

    Ok("Connected successfully".to_string())
}

/// Disconnect from serial port
#[tauri::command]
pub async fn disconnect_serial(state: State<'_, AppState>, app_handle: tauri::AppHandle) -> Result<String, String> {
    info!("Disconnecting serial port");

    state.receive_thread_running.store(false, Ordering::SeqCst);
    state.write_thread_running.store(false, Ordering::SeqCst);

    {
        let mut tx_send = state.tx_send.lock().unwrap();
        *tx_send = None;
    }

    {
        let mut is_connected = state.is_connected.lock().unwrap();
        *is_connected = false;
    }

    thread::sleep(Duration::from_millis(100));

    info!("Serial port disconnected");

    // Emit connection status event so debug panel and other windows can react
    let _ = app_handle.emit("serial-status", serde_json::json!({ "connected": false }));

    Ok("Disconnected".to_string())
}

/// Get serial connection status
#[tauri::command]
pub async fn get_connection_status(state: State<'_, AppState>) -> Result<bool, String> {
    let is_connected = state.is_connected.lock().unwrap();
    Ok(*is_connected)
}

/// Send CAN message
#[tauri::command]
pub async fn send_can_message(
    id: String,
    data: String,
    frame_type: String,
    protocol_length: String,
    state: State<'_, AppState>,
    app_handle: tauri::AppHandle,
) -> Result<String, String> {
    // info!(
    //     "Sending CAN message - ID: {}, Data: {}, Type: {}, Protocol: {}",
    //     id, data, frame_type, protocol_length
    // );
    info!("TX: ID={} Data={}", id, data);
    println!("🚀 [TX] ID: {}, Data: {}", id, data);

    // Check connection state
    {
        let is_connected = state.is_connected.lock().unwrap();
        if !*is_connected {
            error!("Connection check failed: device not connected");
            return Err("Not connected".to_string());
        }
        // info!("Connection check passed");
    }

    // Create send packet based on protocol_length
    // info!("Creating CAN packet...");
    let packet: Vec<u8> = if protocol_length == "variable" {
        match create_can_send_packet_variable(&id, &data, &frame_type) {
            Ok(p) => {
                // info!("CAN packet (variable) created successfully");
                p
            }
            Err(e) => {
                error!("CAN packet creation failed: {}", e);
                return Err(format!("Failed to create packet: {}", e));
            }
        }
    } else {
        match create_can_send_packet_fixed(&id, &data, &frame_type) {
            Ok(p) => {
                // info!("CAN packet (fixed) created successfully");
                p
            }
            Err(e) => {
                error!("CAN packet creation failed: {}", e);
                return Err(format!("Failed to create packet: {}", e));
            }
        }
    };

    // Send data through channel
    // info!("Preparing to send packet through channel...");
    // info!("Packet content: {:02X?}", packet);

    let tx_send = state.tx_send.lock().unwrap();
    if let Some(ref sender) = *tx_send {
        let raw_data = packet.iter().map(|b| format!("{:02X}", b)).collect::<Vec<_>>().join(" ");
        match sender.send(SendMessage { packet }) {
            Ok(_) => {
                // Emit TX event so all windows can see sent messages
                println!("📤 [TX EVENT] Emitting TX event: ID={} Data={}", id, data);
                let _ = app_handle.emit(
                    "can-message-received",
                    serde_json::json!({
                        "id": format!("0x{}", id.trim_start_matches("0x").trim_start_matches("0X")),
                        "data": data,
                        "rawData": raw_data,
                        "timestamp": chrono::Local::now().format("%H:%M:%S%.3f").to_string(),
                        "direction": "sent",
                        "frameType": frame_type,
                    }),
                );

                // Append to CSV log if enabled
                write_csv_row(&state, &id, &data, "sent", &frame_type);

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
}

/// 打开系统监控窗口
#[tauri::command]
pub async fn open_system_monitor_window(app_handle: tauri::AppHandle) -> Result<(), String> {
    match app_handle.get_webview_window("system-monitor") {
        Some(window) => {
            // 窗口已存在，显示并置于前面
            let _ = window.show();
            let _ = window.set_focus();
            Ok(())
        }
        None => {
            // 窗口不存在，创建新窗口
            tauri::WebviewWindowBuilder::new(
                &app_handle,
                "system-monitor",
                tauri::WebviewUrl::App("system-monitor.html".into()),
            )
            .title("System Monitor")
            .inner_size(1600.0, 1000.0)
            .build()
            .map_err(|e| format!("Failed to create system monitor window: {}", e))?;
            Ok(())
        }
    }
}

/// 关闭系统监控窗口
#[tauri::command]
pub async fn close_system_monitor_window(app_handle: tauri::AppHandle) -> Result<(), String> {
    if let Some(window) = app_handle.get_webview_window("system-monitor") {
        window
            .close()
            .map_err(|e| format!("Failed to close system monitor window: {}", e))?;
    }
    Ok(())
}

/// Open debug panel window
#[tauri::command]
pub async fn open_debug_panel_window(app_handle: tauri::AppHandle) -> Result<(), String> {
    match app_handle.get_webview_window("debug-panel") {
        Some(window) => {
            let _ = window.show();
            let _ = window.set_focus();
            Ok(())
        }
        None => {
            tauri::WebviewWindowBuilder::new(
                &app_handle,
                "debug-panel",
                tauri::WebviewUrl::App("debug-panel.html".into()),
            )
            .title("Debug Panel")
            .inner_size(1200.0, 800.0)
            .build()
            .map_err(|e| format!("Failed to create debug panel window: {}", e))?;
            Ok(())
        }
    }
}

/// Close debug panel window
#[tauri::command]
pub async fn close_debug_panel_window(app_handle: tauri::AppHandle) -> Result<(), String> {
    if let Some(window) = app_handle.get_webview_window("debug-panel") {
        window
            .close()
            .map_err(|e| format!("Failed to close debug panel window: {}", e))?;
    }
    Ok(())
}

/// Connect to System Monitor serial port
#[tauri::command]
pub async fn connect_system_monitor(
    port_name: String,
    baud_rate: u32,
    state: State<'_, AppState>,
    app_handle: tauri::AppHandle,
) -> Result<String, String> {
    info!(
        "Connecting to System Monitor: {} at {}",
        port_name, baud_rate
    );

    {
        let is_connected = state.system_monitor_connected.lock().unwrap();
        if *is_connected {
            return Err("System Monitor already connected".to_string());
        }
    }

    let port = match serialport::new(&port_name, baud_rate)
        .timeout(Duration::from_millis(1000))
        .open()
    {
        Ok(port) => port,
        Err(e) => return Err(format!("Failed to open port: {}", e)),
    };

    {
        let mut is_connected = state.system_monitor_connected.lock().unwrap();
        *is_connected = true;
    }

    let state_clone = state.inner().clone();
    start_system_monitor_thread(port, state_clone, app_handle);

    Ok("Connected to System Monitor".to_string())
}

/// Disconnect System Monitor
#[tauri::command]
pub async fn disconnect_system_monitor(state: State<'_, AppState>) -> Result<String, String> {
    state
        .system_monitor_thread_running
        .store(false, Ordering::SeqCst);

    {
        let mut is_connected = state.system_monitor_connected.lock().unwrap();
        *is_connected = false;
    }

    Ok("Disconnected from System Monitor".to_string())
}

/// Start Infinite Algorithmic Drive
#[tauri::command]
pub async fn start_infinite_drive(
    state: State<'_, AppState>,
    app_handle: tauri::AppHandle,
) -> Result<String, String> {
    info!("🚀 [Rust] start_infinite_drive called");

    if state.auto_drive_running.load(Ordering::SeqCst) {
        return Err("Drive loop already running".to_string());
    }

    {
        let is_connected = state.is_connected.lock().unwrap();
        if !*is_connected {
            return Err("Not connected".to_string());
        }
    }

    state.auto_drive_running.store(true, Ordering::SeqCst);

    let state_clone = Arc::new(AppState {
        tx_send: state.tx_send.clone(),
        is_connected: state.is_connected.clone(),
        auto_drive_running: state.auto_drive_running.clone(),
        receive_thread_running: state.receive_thread_running.clone(),
        write_thread_running: state.write_thread_running.clone(),
        system_monitor_connected: state.system_monitor_connected.clone(),
        system_monitor_thread_running: state.system_monitor_thread_running.clone(),
        csv_log_enabled: state.csv_log_enabled.clone(),
        csv_log_file: Arc::new(Mutex::new(None)),
        csv_log_path: state.csv_log_path.clone(),
    });

    std::thread::spawn(move || {
        if let Err(e) = run_infinite_drive(state_clone, app_handle) {
            error!("Infinite drive error: {}", e);
        }
    });

    Ok("Infinite drive started".to_string())
}

/// Stop Infinite Algorithmic Drive
#[tauri::command]
pub async fn stop_infinite_drive(state: State<'_, AppState>) -> Result<String, String> {
    info!("Stopping infinite drive");
    state.auto_drive_running.store(false, Ordering::SeqCst);
    thread::sleep(Duration::from_millis(100));
    Ok("Infinite drive stopped".to_string())
}

// ==================== CSV Log Helpers & Commands ====================

fn csv_format_row(timestamp: &str, direction: &str, can_id: &str, data: &str, raw_data: &str, frame_type: &str) -> String {
    format!(
        "{},{},{},{},{},{}\n",
        timestamp, direction, can_id, data, raw_data, frame_type
    )
}

fn write_csv_row(state: &AppState, can_id: &str, data: &str, direction: &str, frame_type: &str) {
    if !state.csv_log_enabled.load(Ordering::Relaxed) {
        return;
    }
    let timestamp = chrono::Local::now().format("%H:%M:%S%.3f").to_string();
    let row = csv_format_row(&timestamp, direction, can_id, data, data, frame_type);
    if let Ok(mut file_opt) = state.csv_log_file.lock() {
        if let Some(ref mut file) = *file_opt {
            let _ = file.write_all(row.as_bytes());
            let _ = file.flush();
        }
    }
}

/// Start CSV logging — all CAN RX/TX messages are appended to the given file
#[tauri::command]
pub async fn start_csv_logging(
    path: String,
    state: State<'_, AppState>,
) -> Result<String, String> {
    if state.csv_log_enabled.load(Ordering::SeqCst) {
        // Already logging — close current file first
        if let Ok(mut file_opt) = state.csv_log_file.lock() {
            *file_opt = None;
        }
    }

    match OpenOptions::new().create(true).append(true).open(&path) {
        Ok(file) => {
            // Write CSV header
            let mut file = file;
            let _ = writeln!(file, "timestamp,direction,can_id,data,raw_data,frame_type");
            let _ = file.flush();

            if let Ok(mut file_opt) = state.csv_log_file.lock() {
                *file_opt = Some(file);
            }
            if let Ok(mut log_path) = state.csv_log_path.lock() {
                *log_path = Some(path.clone());
            }
            state.csv_log_enabled.store(true, Ordering::SeqCst);
            info!("CSV logging started: {}", path);
            Ok(format!("CSV logging started: {}", path))
        }
        Err(e) => Err(format!("Failed to open CSV file: {}", e)),
    }
}

/// Stop CSV logging
#[tauri::command]
pub async fn stop_csv_logging(state: State<'_, AppState>) -> Result<String, String> {
    state.csv_log_enabled.store(false, Ordering::SeqCst);
    if let Ok(mut file_opt) = state.csv_log_file.lock() {
        if let Some(ref mut file) = *file_opt {
            let _ = file.flush();
        }
        *file_opt = None;
    }
    if let Ok(mut log_path) = state.csv_log_path.lock() {
        *log_path = None;
    }
    info!("CSV logging stopped");
    Ok("CSV logging stopped".to_string())
}

/// Get CSV logging status
#[tauri::command]
pub async fn get_csv_log_status(state: State<'_, AppState>) -> Result<serde_json::Value, String> {
    let enabled = state.csv_log_enabled.load(Ordering::SeqCst);
    let path = state.csv_log_path.lock().unwrap().clone();
    Ok(serde_json::json!({
        "enabled": enabled,
        "path": path,
    }))
}
