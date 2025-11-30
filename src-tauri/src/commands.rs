use std::sync::atomic::Ordering;
use std::sync::{mpsc, Arc};
use std::thread;
use std::time::Duration;

use anyhow::{anyhow, Result};
use log::{error, info, warn};
use serialport::available_ports;
use tauri::{Manager, State};

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
    start_io_thread(port, state_clone, rx_send, app_handle);

    println!("✅ [Connect] Serial port connected successfully - Ready to receive messages!");
    info!("Serial port connected successfully");
    Ok("Connected successfully".to_string())
}

/// Disconnect from serial port
#[tauri::command]
pub async fn disconnect_serial(state: State<'_, AppState>) -> Result<String, String> {
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
    Ok("Disconnected".to_string())
}

/// Send CAN message
#[tauri::command]
pub async fn send_can_message(
    id: String,
    data: String,
    frame_type: String,
    protocol_length: String,
    state: State<'_, AppState>,
) -> Result<String, String> {
    // info!(
    //     "Sending CAN message - ID: {}, Data: {}, Type: {}, Protocol: {}",
    //     id, data, frame_type, protocol_length
    // );
    info!("TX: ID={} Data={}", id, data);

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
        match sender.send(SendMessage { packet }) {
            Ok(_) => {
                // info!("CAN message sent to write thread successfully!");
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
