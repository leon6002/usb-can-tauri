use std::sync::Arc;
use tauri::{AppHandle, Emitter, State};
use tokio::net::UdpSocket;
use tokio::sync::Mutex;
use serde::Serialize;

// The state structural to hold our UDP socket
pub struct UdpState {
    pub socket: Mutex<Option<Arc<UdpSocket>>>,
}

#[derive(Clone, Serialize)]
pub struct UdpMessagePayload {
    pub data: String,
    pub sender: String,
}

#[tauri::command]
pub async fn init_udp_socket(local_port: u16, app_handle: AppHandle, state: State<'_, UdpState>) -> Result<String, String> {
    // Bind to the local port
    let bind_addr = format!("0.0.0.0:{}", local_port);
    let socket = match UdpSocket::bind(&bind_addr).await {
        Ok(s) => Arc::new(s),
        Err(e) => return Err(format!("Failed to bind UDP socket on port {}: {}", local_port, e)),
    };

    let socket_clone = socket.clone();
    
    // Store the sender so we can send out later
    *state.socket.lock().await = Some(socket.clone());

    // Spawn listener task
    tokio::spawn(async move {
        let mut buf = [0u8; 2048];
        log::info!("UDP listener started on port {}", local_port);
        loop {
            match socket_clone.recv_from(&mut buf).await {
                Ok((len, src)) => {
                    let msg_str = String::from_utf8_lossy(&buf[..len]).into_owned();
                    log::info!("Received UDP from {}: {}", src, msg_str);
                    
                    let payload = UdpMessagePayload {
                        data: msg_str,
                        sender: src.to_string(),
                    };
                    
                    // Emit event to frontend
                    if let Err(e) = app_handle.emit("udp-message-received", payload) {
                        log::error!("Failed to emit udp-message-received event: {}", e);
                    }
                }
                Err(e) => {
                    log::error!("UDP receive error: {}", e);
                    // Decide if we should break or continue. Let's just log and continue for now.
                    // If the socket is dropped, it will error out and we can break.
                    break;
                }
            }
        }
    });

    Ok(format!("UDP socket initialized on port {}", local_port))
}

#[tauri::command]
pub async fn send_udp_command(
    target_ip: String,
    target_port: u16,
    payload_json: String,
    state: State<'_, UdpState>,
) -> Result<String, String> {
    let socket_guard = state.socket.lock().await;
    let socket = match &*socket_guard {
        Some(s) => s,
        None => return Err("UDP socket is not initialized. Call init_udp_socket first.".into()),
    };

    let target_addr = format!("{}:{}", target_ip, target_port);
    
    match socket.send_to(payload_json.as_bytes(), &target_addr).await {
        Ok(bytes_sent) => {
            log::info!("Sent {} bytes to {}", bytes_sent, target_addr);
            Ok(format!("Sent {} bytes", bytes_sent))
        }
        Err(e) => {
            log::error!("Failed to send UDP data to {}: {}", target_addr, e);
            Err(format!("Send error: {}", e))
        }
    }
}

#[tauri::command]
pub async fn close_udp_socket(state: State<'_, UdpState>) -> Result<String, String> {
    let mut socket_guard = state.socket.lock().await;
    if socket_guard.is_some() {
        // By setting it to None, the Arc is dropped. 
        // If the listener task receives an error (e.g., socket closed) it will gracefully exit its loop.
        *socket_guard = None;
        log::info!("UDP socket closed.");
        Ok("UDP socket closed successfully".into())
    } else {
        Err("No active UDP socket to close".into())
    }
}
