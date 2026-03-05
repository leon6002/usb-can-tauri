use std::sync::atomic::AtomicBool;
use std::sync::{mpsc, Arc, Mutex};

use serde::{Deserialize, Serialize};

mod can_protocol;

mod infinite_loop;

mod io_thread;
mod system_monitor_thread;

mod commands;
mod udp;
use commands::{
    close_system_monitor_window, connect_serial, connect_system_monitor, disconnect_serial,
    disconnect_system_monitor, get_available_ports, open_system_monitor_window, send_can_message,
    start_infinite_drive, stop_infinite_drive,
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
    auto_drive_running: Arc<AtomicBool>,
    receive_thread_running: Arc<AtomicBool>,
    write_thread_running: Arc<AtomicBool>,

    // System Monitor State
    pub system_monitor_connected: Arc<Mutex<bool>>,
    pub system_monitor_thread_running: Arc<AtomicBool>,
}

impl Default for AppState {
    fn default() -> Self {
        Self {
            tx_send: Arc::new(Mutex::new(None)),
            is_connected: Arc::new(Mutex::new(false)),
            auto_drive_running: Arc::new(AtomicBool::new(false)),
            receive_thread_running: Arc::new(AtomicBool::new(false)),
            write_thread_running: Arc::new(AtomicBool::new(false)),

            system_monitor_connected: Arc::new(Mutex::new(false)),
            system_monitor_thread_running: Arc::new(AtomicBool::new(false)),
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
        .manage(udp::UdpState {
            socket: tokio::sync::Mutex::new(None),
        })
        .invoke_handler(tauri::generate_handler![
            get_available_ports,
            connect_serial,
            disconnect_serial,
            send_can_message,
            open_system_monitor_window,
            close_system_monitor_window,
            connect_system_monitor,
            disconnect_system_monitor,
            start_infinite_drive,
            stop_infinite_drive,
            udp::init_udp_socket,
            udp::send_udp_command
        ])
        .setup(|app| {
            use log::info;
            use std::sync::atomic::Ordering;
            use tauri::Manager;

            // 获取主窗口
            let window = app.get_webview_window("main").unwrap();
            let app_handle = app.handle().clone();

            // 监听窗口关闭事件
            window.on_window_event(move |event| {
                if let tauri::WindowEvent::CloseRequested { .. } = event {
                    info!("🚪 Window close requested - cleaning up serial connection...");

                    // 获取 AppState
                    if let Some(state) = app_handle.try_state::<AppState>() {
                        // 停止所有线程
                        state.auto_drive_running.store(false, Ordering::SeqCst);
                        state.receive_thread_running.store(false, Ordering::SeqCst);
                        state.write_thread_running.store(false, Ordering::SeqCst);

                        // Stop system monitor thread
                        state
                            .system_monitor_thread_running
                            .store(false, Ordering::SeqCst);

                        // 清理发送通道
                        if let Ok(mut tx_send) = state.tx_send.lock() {
                            *tx_send = None;
                        }

                        // 更新连接状态
                        if let Ok(mut is_connected) = state.is_connected.lock() {
                            *is_connected = false;
                        }

                        if let Ok(mut sm_connected) = state.system_monitor_connected.lock() {
                            *sm_connected = false;
                        }

                        info!("✅ Serial connection cleanup completed");
                    }

                    // 清理完成后，退出应用
                    info!("🚪 Exiting application...");
                    app_handle.exit(0);
                }
            });

            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
