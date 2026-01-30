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
        // Find a valid packet: 12 bytes long
        // Byte 4 must be 0
        // Bytes 7, 8, 9, 10, 11 must be 0
        
        // We only care if we have AT LEAST 12 bytes to even start checking.
        if message_buffer.len() < 12 {
            break;
        }

        // Search for a valid packet position
        let packet_start = message_buffer.windows(12).position(|chunk| {
            chunk[4] == 0 && 
            chunk[7] == 0 && 
            chunk[8] == 0 && 
            chunk[9] == 0 && 
            chunk[10] == 0 && 
            chunk[11] == 0
        });

        if let Some(start_index) = packet_start {
            // Discard garbage before valid packet
            if start_index > 0 {
                message_buffer.drain(0..start_index);
            }
            
            // Extract the valid packet
            let packet: Vec<u8> = message_buffer.drain(0..12).collect();
            
            // Emit event
            let _ = app_handle.emit("system-monitor-data", packet);
        } else {
            // No valid packet found in current buffer.
            // To prevent buffer overflow if we keep receiving invalid data, 
            // we should discard some data, but let's be careful not to discard a potential partial match at the end.
            // A simple strategy: keep last 11 bytes just in case they are the start of a valid packet.
            if message_buffer.len() > 11 {
                let discard_len = message_buffer.len() - 11;
                message_buffer.drain(0..discard_len);
            }
            break;
        }
    }
}
