use std::sync::{Arc, Mutex, mpsc};
use std::sync::atomic::AtomicBool;

use serde::{Deserialize, Serialize};

mod vehicle_control;
use vehicle_control::VehicleControl;

mod can_protocol;

mod csv_loop;

mod io_thread;

mod commands;
use commands::{
    get_available_ports, connect_serial, disconnect_serial, send_can_message,
    start_csv_loop, stop_csv_loop, preload_csv_data, start_csv_loop_with_preloaded_data,
    open_system_monitor_window, close_system_monitor_window,
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
            start_csv_loop_with_preloaded_data,
            open_system_monitor_window,
            close_system_monitor_window
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}