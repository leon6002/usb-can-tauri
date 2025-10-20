//! CSV 循环相关的函数
//! 包括：CSV 数据读取、循环处理、发送等功能

use std::sync::Arc;
use std::sync::atomic::Ordering;
use std::thread;
use std::time::Duration;

use anyhow::{Result, anyhow};
use csv::ReaderBuilder;
use log::{info, error};

use crate::{AppState, SendMessage, CsvLoopProgress};
use crate::can_protocol::{create_can_send_packet_fixed, create_can_send_packet_variable};
use crate::vehicle_control::extract_vehicle_control;

/// 运行 CSV 循环 - 从 CSV 内容读取数据并发送
pub fn run_csv_loop(
    csv_content: String,
    interval_ms: u64,
    can_id_column_index: usize,
    can_data_column_index: usize,
    csv_start_row_index: usize,
    config: serde_json::Value,
    state: Arc<AppState>,
) -> Result<()> {
    println!("🔄 [Rust] run_csv_loop started - Start row: {}", csv_start_row_index);

    // Extract frame_type and protocol_length from config
    let frame_type = config.get("frame_type")
        .and_then(|v| v.as_str())
        .unwrap_or("standard")
        .to_string();

    let protocol_length = config.get("protocol_length")
        .and_then(|v| v.as_str())
        .unwrap_or("fixed")
        .to_string();

    // Parse CSV content from string
    let mut reader = ReaderBuilder::new()
        .has_headers(false)
        .from_reader(csv_content.as_bytes());

    let mut records = Vec::new();
    for result in reader.records() {
        let record = result.map_err(|e| anyhow!("CSV read error: {}", e))?;
        records.push(record);
    }

    println!("✅ [Rust] Loaded {} records from CSV", records.len());
    info!("Loaded {} records from CSV", records.len());

    if records.is_empty() {
        println!("❌ [Rust] CSV file is empty");
        return Err(anyhow!("CSV file is empty"));
    }

    // Check if start row index is valid
    if csv_start_row_index >= records.len() {
        println!("❌ [Rust] Start row index {} out of range (max: {})", csv_start_row_index, records.len() - 1);
        return Err(anyhow!("Start row index out of range"));
    }

    // Filter records starting from csv_start_row_index
    let filtered_records: Vec<_> = records.iter().skip(csv_start_row_index).collect();

    if filtered_records.is_empty() {
        println!("❌ [Rust] No records after start row index");
        return Err(anyhow!("No records after start row index"));
    }

    println!("✅ [Rust] Using {} records starting from row {}", filtered_records.len(), csv_start_row_index);

    // Loop through records once
    for (index, record) in filtered_records.iter().enumerate() {
        // Check if loop should stop
        if !state.csv_loop_running.load(Ordering::SeqCst) {
            println!("🛑 [Rust] CSV loop stopped by user");
            break;
        }

        // Get CAN ID and Data from specified columns
        let can_id = record
            .get(can_id_column_index)
            .ok_or_else(|| anyhow!("CAN ID column index out of range"))?
            .to_string();

        let can_data = record
            .get(can_data_column_index)
            .ok_or_else(|| anyhow!("CAN Data column index out of range"))?
            .to_string();

        // Check if CAN data is empty - if so, stop the loop
        if can_data.trim().is_empty() {
            println!("🛑 [Rust] Empty CAN data detected - CSV loop ended");
            info!("Empty CAN data detected - CSV loop ended");
            break;
        }

        // Try to parse vehicle control data (speed and steering angle)
        let vehicle_control = extract_vehicle_control(&can_data).ok();

        if let Some(ref vc) = vehicle_control {
            println!("📊 [Rust] Parsed vehicle control - Speed: {} mm/s, Steering: {:.3} rad",
                     vc.linear_velocity_mms, vc.steering_angle_rad);
            info!("Parsed vehicle control - Speed: {} mm/s, Steering: {:.3} rad",
                  vc.linear_velocity_mms, vc.steering_angle_rad);
        }

        // Create and send packet based on protocol_length
        let packet = if protocol_length == "variable" {
            create_can_send_packet_variable(&can_id, &can_data, &frame_type)?
        } else {
            create_can_send_packet_fixed(&can_id, &can_data, &frame_type)?
        };

        // Send packet through channel
        {
            let tx_send = state.tx_send.lock().unwrap();
            if let Some(ref sender) = *tx_send {
                if let Err(e) = sender.send(SendMessage { packet }) {
                    error!("Failed to send packet through channel: {}", e);
                } else {
                    info!("Sent CAN message - ID: {}, Data: {}", can_id, can_data);
                }
            }
        }

        // Sleep for interval (except after the last record)
        if index < filtered_records.len() - 1 {
            thread::sleep(Duration::from_millis(interval_ms));
        }
    }

    println!("✅ [Rust] CSV loop completed - All records sent");
    info!("CSV loop completed - All records sent");

    // Stop the loop flag
    state.csv_loop_running.store(false, Ordering::SeqCst);

    Ok(())
}

/// 运行预加载 CSV 循环 - 从预加载的数据发送
pub fn run_csv_loop_with_preloaded_data(
    preloaded_data: Vec<CsvLoopProgress>,
    interval_ms: u64,
    config: serde_json::Value,
    state: Arc<AppState>,
) -> Result<()> {
    println!("🔄 [Rust] run_csv_loop_with_preloaded_data started - Records: {}", preloaded_data.len());

    // Loop through records once
    for (index, progress) in preloaded_data.iter().enumerate() {
        // Check if loop should stop
        if !state.csv_loop_running.load(Ordering::SeqCst) {
            println!("🛑 [Rust] CSV loop stopped by user");
            break;
        }

        let can_id = &progress.can_id;
        let can_data = &progress.can_data;

        // Check if CAN data is empty - if so, stop the loop
        if can_data.trim().is_empty() {
            println!("🛑 [Rust] Empty CAN data detected - CSV loop ended");
            info!("Empty CAN data detected - CSV loop ended");
            break;
        }

        // Log vehicle control data if available
        if let Some(ref vc) = progress.vehicle_control {
            println!("📊 [Rust] Record {}/{} - Speed: {} mm/s, Steering: {:.3} rad",
                     index + 1, preloaded_data.len(), vc.linear_velocity_mms, vc.steering_angle_rad);
            info!("Record {}/{} - Speed: {} mm/s, Steering: {:.3} rad",
                  index + 1, preloaded_data.len(), vc.linear_velocity_mms, vc.steering_angle_rad);
        }

        // Create and send packet
        // Extract frame_type and protocol_length from config
        let frame_type = config.get("frame_type")
            .and_then(|v| v.as_str())
            .unwrap_or("standard");

        let protocol_length = config.get("protocol_length")
            .and_then(|v| v.as_str())
            .unwrap_or("fixed");

        let packet = if protocol_length == "variable" {
            create_can_send_packet_variable(&can_id, &can_data, frame_type)?
        } else {
            create_can_send_packet_fixed(&can_id, &can_data, frame_type)?
        };

        // Send packet through channel
        {
            let tx_send = state.tx_send.lock().unwrap();
            if let Some(ref sender) = *tx_send {
                if let Err(e) = sender.send(SendMessage { packet }) {
                    error!("Failed to send packet through channel: {}", e);
                } else {
                    info!("Sent CAN message - ID: {}, Data: {}", can_id, can_data);
                }
            }
        }

        // Sleep for interval (except after the last record)
        if index < preloaded_data.len() - 1 {
            thread::sleep(Duration::from_millis(interval_ms));
        }
    }

    println!("✅ [Rust] CSV loop completed - All records sent");
    info!("CSV loop completed - All records sent");

    // Stop the loop flag
    state.csv_loop_running.store(false, Ordering::SeqCst);

    Ok(())
}

