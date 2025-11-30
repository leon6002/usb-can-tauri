use std::sync::atomic::Ordering;
use std::thread;
use std::time::Duration;

use log::{error, info};
use serialport::SerialPort;
use tauri::Emitter;

use crate::AppState;

/// Start System Monitor Thread
pub fn start_system_monitor_thread(
    mut serial_port: Box<dyn SerialPort>,
    state: AppState,
    app_handle: tauri::AppHandle,
) {
    state
        .system_monitor_thread_running
        .store(true, Ordering::SeqCst);

    thread::spawn(move || {
        let mut buffer = vec![0u8; 1024];
        let mut message_buffer = Vec::new();

        info!("🚀 [SystemMonitor Thread] Started");

        while state.system_monitor_thread_running.load(Ordering::SeqCst) {
            match serial_port.read(&mut buffer) {
                Ok(n) if n > 0 => {
                    let received_data = &buffer[..n];
                    message_buffer.extend_from_slice(received_data);
                    process_system_monitor_buffer(&mut message_buffer, &app_handle);
                }
                Ok(_) => {
                    thread::sleep(Duration::from_millis(5));
                }
                Err(ref e) if e.kind() == std::io::ErrorKind::TimedOut => {
                    continue;
                }
                Err(e) => {
                    error!("SystemMonitor thread: read error: {}", e);
                    thread::sleep(Duration::from_millis(10));
                }
            }
        }

        info!("SystemMonitor thread stopped");
    });
}

fn process_system_monitor_buffer(message_buffer: &mut Vec<u8>, app_handle: &tauri::AppHandle) {
    loop {
        // Find header 0xAA 0x55
        let header_pos = message_buffer.windows(2).position(|w| w == [0xAA, 0x55]);

        if let Some(pos) = header_pos {
            // Discard data before header
            if pos > 0 {
                message_buffer.drain(0..pos);
            }

            // Check if we have enough bytes (18 bytes total)
            if message_buffer.len() >= 18 {
                let packet: Vec<u8> = message_buffer.drain(0..18).collect();

                // Emit event
                let _ = app_handle.emit("system-monitor-data", packet);
            } else {
                // Not enough data yet
                break;
            }
        } else {
            // No header found, keep last byte just in case it's 0xAA
            if message_buffer.len() > 1 {
                let keep_last = if message_buffer.last() == Some(&0xAA) {
                    1
                } else {
                    0
                };
                let len = message_buffer.len();
                if len > keep_last {
                    message_buffer.drain(0..len - keep_last);
                }
            }
            break;
        }
    }
}
