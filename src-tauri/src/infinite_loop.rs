//! Infinite algorithmic driving loop
//! Generates trajectory data in real-time without CSV files.

use std::sync::atomic::Ordering;
use std::sync::Arc;
use std::thread;
use std::time::{Duration, Instant};

use anyhow::Result;
use log::{error, info};
use tauri::Emitter;

use crate::can_protocol::create_can_send_packet_fixed;
use crate::{AppState, SendMessage};

/// Vehicle Control Data Structure
#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
pub struct VehicleControl {
    /// 车体行进速度，单位 mm/s (Signed Int16)
    pub linear_velocity_mms: i16,
    /// 转向角度 (degree)
    pub steering_angle: f32,
    /// 档位名称 (P/D/R) - 根据速度推断
    pub gear_name: String,
}

/// Generate vehicle control data based on time
/// Returns (speed_mm_s, steering_angle_deg)
fn generate_control_data(elapsed_sec: f64) -> (i16, f64) {
    // Complex Driving Scenario with Dynamic Speed
    // Speed Range: 500 - 3000 mm/s
    // Straight: Fast (~3000)
    // Turns: Slow (~500-1500 depending on angle)

    // Keyframes: (time, angle, speed)
    let keyframes = [
        (0.0, 0.0, 1500.0),   // Start slow
        (5.0, 0.0, 3000.0),   // Accelerate on straight
        (12.0, 10.0, 2000.0), // Slow down for turn
        (22.0, 18.0, 2000.0), // Maintain speed in turn
        (24.0, 12.0, 1800.0), // Slow more for tighter turn
        (29.0, 5.0, 1600.0),
        (31.0, 0.0, 1500.0), // Slowest for tightest part
        (36.0, 0.0, 2000.0),
        (39.0, -5.0, 2500.0), // Accelerate out of turn
        (49.0, -2.0, 3000.0), // Max speed on straight
        (52.0, 0.0, 1400.0),  // Slow down for sharp right turn
        (62.0, 5.0, 1600.0),
        (70.0, 15.0, 2500.0), // Accelerate slightly as turn widens
        (84.0, 10.0, 2500.0),
        (86.0, 5.0, 2000.0),
        (100.0, 0.0, 1500.0),
        (110.0, 0.0, 1500.0),
    ];

    let cycle_duration = 110.0;
    let t = elapsed_sec % cycle_duration;

    // Find current segment
    let mut steering = 0.0;
    let mut speed = 1000.0;

    for i in 0..keyframes.len() - 1 {
        let (t1, a1, s1) = keyframes[i];
        let (t2, a2, s2) = keyframes[i + 1];

        if t >= t1 && t < t2 {
            // Interpolate
            let progress = (t - t1) / (t2 - t1);
            // Smooth ease-in-out
            let ease = 0.5 * (1.0 - (progress * std::f64::consts::PI).cos());

            steering = a1 + (a2 - a1) * ease;
            speed = s1 + (s2 - s1) * ease;
            break;
        }
    }

    (speed as i16, steering)
}

/// Create CAN data string from control values
fn create_can_data(speed: i16, steering: f64) -> String {
    let steering_int = (steering * 1000.0) as i16;

    // Big Endian packing
    let speed_bytes = speed.to_be_bytes();
    let steering_bytes = steering_int.to_be_bytes();

    format!(
        "{:02X}{:02X}{:02X}{:02X}00000000",
        speed_bytes[0], speed_bytes[1], steering_bytes[0], steering_bytes[1]
    )
}

pub fn run_infinite_drive(state: Arc<AppState>, app_handle: tauri::AppHandle) -> Result<()> {
    info!("🚀 [Rust] Starting Infinite Algorithmic Drive");

    let start_time = Instant::now();
    let interval_ms = 20; // 50Hz update rate
    let can_id = "0x200"; // Standard control ID
    let frame_type = "standard";

    // Loop until stopped
    loop {
        // Check stop condition
        if !state.auto_drive_running.load(Ordering::SeqCst) {
            info!("🛑 [Rust] Infinite drive stopped by user");
            break;
        }

        let elapsed = start_time.elapsed().as_secs_f64();
        let (speed, steering) = generate_control_data(elapsed);
        let can_data = create_can_data(speed, steering);

        // Create packet
        match create_can_send_packet_fixed(can_id, &can_data, frame_type) {
            Ok(packet) => {
                // Send packet
                let tx_send = state.tx_send.lock().unwrap();
                if let Some(ref sender) = *tx_send {
                    if let Err(e) = sender.send(SendMessage { packet }) {
                        error!("Failed to send packet: {}", e);
                    }
                }
            }
            Err(e) => error!("Failed to create packet: {}", e),
        }

        // Emit progress event for frontend visualization
        let _ = app_handle.emit(
            "auto-drive-progress", // Renamed from csv-loop-progress
            serde_json::json!({
                "index": 0, // Dummy value
                "total": 0, // Dummy value
                "vehicle_control": VehicleControl {
                    linear_velocity_mms: speed,
                    steering_angle: steering as f32,
                    gear_name: "D".to_string(), // Assume Drive
                },
                "can_id": can_id,
                "can_data": can_data,
                "interval_ms": interval_ms
            }),
        );

        thread::sleep(Duration::from_millis(interval_ms));
    }

    // Send stop signal (Speed 0, Steering 0)
    let stop_data = create_can_data(0, 0.0);
    if let Ok(packet) = create_can_send_packet_fixed(can_id, &stop_data, frame_type) {
        let tx_send = state.tx_send.lock().unwrap();
        if let Some(ref sender) = *tx_send {
            let _ = sender.send(SendMessage { packet });
        }
    }

    info!("✅ [Rust] Infinite drive ended");
    state.auto_drive_running.store(false, Ordering::SeqCst);

    let _ = app_handle.emit(
        "auto-drive-completed", // Renamed from csv-loop-completed
        serde_json::json!({ "status": "completed" }),
    );

    Ok(())
}
