# OSYX Vehicle Controller — CAN Signal Map

> Auto-generated from source code on branch `main`. Last updated: 2026-06-03.

---

## 1. Received Signals (RX)

All incoming CAN messages arrive via serial port → I/O thread (`src-tauri/src/io_thread.rs`) → parsed as 20-byte fixed-protocol packets (header `AA 55`, checksum at byte 19).

### 1.1 Vehicle Status — `0x00000123`

| Field | Detail |
|-------|--------|
| **CAN ID** | `0x00000123` |
| **Event emitted** | `can-message-received` (enriched with `gear` and `steeringAngle`) |
| **Data format** | 8 bytes per protocol doc Table 4-3 |

| Bytes | Content | Type |
|-------|---------|------|
| Byte 0, low 4 bits | Target gear (0=disable, 1=P, 2=R, 3=N, 4=D) | u4 |
| Byte 0, high 4 bits + Byte 1 | Target speed, precision 0.001 m/s | u16 |
| Byte 2–3 | Target steering angle, precision 0.01° | i16 LE |

**Handler:** `canMessageStore.ts:150` — updates `carControlStore` with `gear` and `steeringAngleDegrees`.

**Parse function:** `parse_vehicle_status_8byte()` in `src-tauri/src/can_protocol.rs:418`.

---

### 1.2 Radar Distance Messages — `0x00000521` ~ `0x00000524`

| CAN ID | Radar | Event | Data Format |
|--------|-------|-------|-------------|
| `0x00000521` | Radar 1 | `radar-message` | Last 2 bytes = distance in mm (u16) |
| `0x00000522` | Radar 2 | `radar-message` | Same |
| `0x00000523` | Radar 3 | `radar-message` | Same |
| `0x00000524` | Radar 4 | `radar-message` | Same |

**Handler:** `radarStore.ts:130` — updates `radarDistances` map.
**Parse function:** `parse_distance_from_data()` in `src-tauri/src/can_protocol.rs:401`.

---

### 1.3 Generic CAN Messages — Any CAN ID

| Field | Detail |
|-------|--------|
| **Event emitted** | `can-message-received` |
| **Payload** | `id`, `data`, `rawData`, `timestamp`, `direction: "received"`, `frameType` |
| **Handler** | `canMessageStore.ts:132` — appends to message log panel |

---

## 2. Sent Signals (TX)

All outgoing messages flow through `sendCanCommand()` or `sendVehicleControlCommand()` in the frontend → `invoke("send_can_message", ...)` → Rust `send_can_message` command (`commands.rs:163`) → builds a send packet via `create_can_send_packet_fixed()` or `create_can_send_packet_variable()` → mpsc channel → I/O thread writes to serial port.

### 2.1 Vehicle Control — CAN ID `0x200`

This is the primary control ID. All driving commands (auto and manual) use it.

**Data format (4 bytes):**

| Bytes | Content | Type | Range |
|-------|---------|------|-------|
| Byte 0–1 | Speed (mm/s) | i16 Big Endian | [-32768, 32767] |
| Byte 2–3 | Steering angle × 1000 | i16 Big Endian | [-32768, 32767] |

**Frontend builder:** `buildVehicleControlData()` in `src/utils/canProtocol.ts`.
**Rust builder:** `create_can_data()` in `src-tauri/src/infinite_loop.rs`.

---

#### 2.1.1 START AUTO DRIVE button

| Field | Detail |
|-------|--------|
| **UI** | Green Play button in `DriveControl.tsx` |
| **Flow** | `sendCarCommand("start_driving")` → `startInfiniteDrive()` → `invoke("start_infinite_drive")` |
| **Rust** | Spawns thread running `run_infinite_drive()` in `src-tauri/src/infinite_loop.rs` |
| **CAN ID** | `0x200` |
| **Rate** | 50 Hz (every 20 ms) |
| **Trajectory** | 17 keyframes, 110-second cycle, cosine-eased interpolation, loops forever |
| **Gear** | Always "D" |

**Keyframe table:**

| Time (s) | Speed (mm/s) | Steering (°) | Description |
|----------|-------------|-------------|-------------|
| 0 | 1500 | 0 | Start slow |
| 5 | 3000 | 0 | Accelerate on straight |
| 12 | 2000 | 10 | Slow down for turn |
| 22 | 2000 | 18 | Maintain speed in turn |
| 24 | 1800 | 12 | Slow more for tighter turn |
| 29 | 1600 | 5 | — |
| 31 | 1500 | 0 | Slowest for tightest part |
| 36 | 2000 | 0 | — |
| 39 | 2500 | -5 | Accelerate out of turn |
| 49 | 3000 | -2 | Max speed on straight |
| 52 | 1400 | 0 | Slow down for sharp right turn |
| 62 | 1600 | 5 | — |
| 70 | 2500 | 15 | Accelerate slightly as turn widens |
| 84 | 2500 | 10 | — |
| 86 | 2000 | 5 | — |
| 100 | 1500 | 0 | — |
| 110 | 1500 | 0 | End of cycle |

**Event emitted to frontend:** `auto-drive-progress` (payload: `vehicle_control` { `linear_velocity_mms`, `steering_angle`, `gear_name` }, `can_id`, `can_data`, `interval_ms`)

---

#### 2.1.2 STOP AUTO DRIVE button

| Field | Detail |
|-------|--------|
| **UI** | Red Square button in `DriveControl.tsx` |
| **Flow** | `sendCarCommand("stop_driving")` → `stopAutoDrive()` → `invoke("stop_infinite_drive")` |
| **Effect** | Sets `auto_drive_running = false`, loop exits, sends one final zero frame, emits `auto-drive-completed` |
| **CAN ID** | `0x200` |
| **Final data** | `00 00 00 00` (speed=0, steering=0) |

---

#### 2.1.3 Accelerator Pedal

| Field | Detail |
|-------|--------|
| **UI** | Green pedal button in `Pedals.tsx` (press & hold) |
| **CAN ID** | `0x200` |
| **Data** | Dynamic speed + current steering angle |
| **Rate** | Every 100 ms |
| **Speed increment** | +100 mm/s per tick |
| **Max speed** | 5000 mm/s |
| **Constraints** | Disabled in P gear, disabled during auto-drive |

---

#### 2.1.4 Brake Pedal

| Field | Detail |
|-------|--------|
| **UI** | Red pedal button in `Pedals.tsx` (press & hold) |
| **CAN ID** | `0x200` |
| **Data** | Dynamic speed + current steering angle |
| **Rate** | Every 100 ms |
| **Speed decrement** | -300 mm/s per tick |
| **Min speed** | 0 (stops) |

---

#### 2.1.5 Steering Wheel

| Field | Detail |
|-------|--------|
| **UI** | Steering wheel drag / left-right button hold in `SteeringWheel.tsx` |
| **Hook** | `useSteeringControl.ts` |
| **CAN ID** | `0x200` |
| **Data** | Speed = 0, steering angle = wheel angle / steering ratio (8:1) |
| **Rate** | Throttled to 50 ms, only if angle change > 0.5° |
| **Max wheel angle** | ±200° (→ ±25° tire angle) |

> ⚠️ The comment in `useSteeringControl.ts:9` references CAN ID `0x18C4D2D0`, but the actual code calls `sendVehicleControlCommand()` which uses `0x200`. The comment is outdated.

---

#### 2.1.6 Gear Selector (P / R / D)

| Field | Detail |
|-------|--------|
| **UI** | Three buttons in `Pedals.tsx` |
| **CAN ID** | No direct CAN send on gear change |
| **Effect** | Updates local UI state; enables creep/idle logic |
| **Idle creep D** | Targets +500 mm/s forward |
| **Idle creep R** | Targets -500 mm/s backward |
| **Idle creep P** | No creep |
| **Creep rate** | Every 100 ms via `startIdleDrive()` |

---

#### 2.1.7 Heartbeat Re-send

| Field | Detail |
|-------|--------|
| **CAN ID** | `0x200` |
| **Data** | Last speed + steering angle |
| **Rate** | Every 1 second (if values unchanged) |
| **Purpose** | Keeps the vehicle alive when no state changes |

---

### 2.2 `0x201` Protocol Layout

CAN ID `0x201` is a multi-function body control ID shared by doors, fan, lights, and suspension. Each function occupies a fixed byte position:

```
Byte 0: FF (header/enable)
Byte 1: Right door command  (01=close / 02=open / 03=stop / FF=inactive)
Byte 2: Left door or Suspension command  (01/02/03 / FF=inactive)
Byte 3: FF or Light mode  (00=OFF, 01-03)
Byte 4-7: 00 (reserved)
```

> ⚠️ **Byte 2 collision:** Byte 2 is shared between left door commands and suspension commands (`suspension_up: FF FF 01 FF`, `suspension_down: FF FF 02 FF`, `suspension_stop: FF FF 03 FF`). In linked door mode, Byte 2 is always `FF` to avoid accidentally triggering suspension. In independent door mode, left door commands intentionally use Byte 2 — ensure suspension is not active simultaneously.

---

### 2.2.1 Door Control — Linked Mode (`independentDoors: false`)

When `independentDoors` is `false` (default), clicking either door on the 3D model opens/closes both doors together. The physical wiring connects the right door signal to both doors, so only Byte 1 is used. Byte 2 is kept at `FF` to avoid triggering suspension.

**Trigger:** Click left or right door on the 3D car model in `Scene.tsx`.

| Action | Command ID | Data (8 bytes) | Auto-stop |
|--------|-----------|----------------|-----------|
| Both Open | `door_open` | `FF 02 FF FF 00 00 00 00` | Sends `door_stop` after 4 s |
| Both Close | `door_close` | `FF 01 FF FF 00 00 00 00` | Sends `door_stop` after 4 s |
| Both Stop | `door_stop` | `FF 03 FF FF 00 00 00 00` | Manual or auto |

```
Byte1=02 (right door = both doors physically)  Byte2=FF (skip left/suspension)
```

---

### 2.2.2 Door Control — Independent Mode (`independentDoors: true`)

When `independentDoors` is `true`, clicking the left door only operates the left door, and clicking the right door only operates the right door. Left door commands use Byte 2 (shared with suspension), right door commands use Byte 1 (same data as linked mode).

**Right door:**

| Action | Command ID | Data (8 bytes) | Auto-stop |
|--------|-----------|----------------|-----------|
| Right Open | `right_door_open` | `FF 02 FF FF 00 00 00 00` | Sends `right_door_stop` after 4 s |
| Right Close | `right_door_close` | `FF 01 FF FF 00 00 00 00` | Sends `right_door_stop` after 4 s |
| Right Stop | `right_door_stop` | `FF 03 FF FF 00 00 00 00` | Manual or auto |

```
Byte1=02/01/03 (right door command)  Byte2=FF (skip left/suspension)
```

**Left door:**

| Action | Command ID | Data (8 bytes) | Auto-stop |
|--------|-----------|----------------|-----------|
| Left Open | `left_door_open` | `FF FF 02 FF 00 00 00 00` | Sends `left_door_stop` after 4 s |
| Left Close | `left_door_close` | `FF FF 01 FF 00 00 00 00` | Sends `left_door_stop` after 4 s |
| Left Stop | `left_door_stop` | `FF FF 03 FF 00 00 00 00` | Manual or auto |

```
Byte1=FF (skip right door)  Byte2=02/01/03 (left door command via suspension byte)
```

**Config:** `features.independentDoors` in `src/config/appConfig.ts`.

**Handler:** `handleDoorCommand()` in `src/handlers/doorHandler.ts`. Each command ID maps to its own stop command (e.g. `left_door_open` → `left_door_stop`, `right_door_open` → `right_door_stop`).

---

### 2.3 Fan Control — CAN ID `0x201`

| Button | Command ID | Data (8 bytes) |
|--------|-----------|----------------|
| **Fan OFF** | `fan_level_0` | `00 FF FF FF 00 00 00 00` |
| **Fan Level 1** | `fan_level_1` | `01 FF FF FF 00 00 00 00` |
| **Fan Level 2** | `fan_level_2` | `02 FF FF FF 00 00 00 00` |
| **Fan Level 3** | `fan_level_3` | `03 FF FF FF 00 00 00 00` |

**UI:** Cycling button in `FanControl.tsx`. Cycles 0 → 1 → 2 → 3 → 0.
**Visibility:** Controlled by `features.showFanControl` in `appConfig.ts` (currently `true`).

---

### 2.4 Light Control — CAN ID `0x201`

| Button | Command ID | Data (8 bytes) |
|--------|-----------|----------------|
| **Light OFF** | `light_mode_4` | `FF FF FF 00 00 00 00 00` |
| **Light Mode 1** | `light_mode_1` | `FF FF FF 01 00 00 00 00` |
| **Light Mode 2** | `light_mode_2` | `FF FF FF 02 00 00 00 00` |
| **Light Mode 3** | `light_mode_3` | `FF FF FF 03 00 00 00 00` |

**UI:** 4 buttons in `LightControl.tsx`. Disabled during auto-drive.

---

### 2.5 Suspension Control — CAN ID `0x201`

| Button | Command ID | Data (8 bytes) | Auto-stop |
|--------|-----------|----------------|-----------|
| **RAISE** | `suspension_up` | `FF FF 01 FF 00 00 00 00` | Sends `suspension_stop` after 4 s (configurable) |
| **LOWER** | `suspension_down` | `FF FF 02 FF 00 00 00 00` | Sends `suspension_stop` after 4 s (configurable) |
| **STOP** | `suspension_stop` | `FF FF 03 FF 00 00 00 00` | Manual or auto |

**UI:** Two buttons (RAISE / LOWER) in `SuspensionControl.tsx`.
**Handler:** `handleSuspensionCommand()` in `src/handlers/suspensionHandler.ts`.
**Config:** `suspension.can_stop_duration` in `appConfig.ts` (default: 4000 ms).
Disabled during auto-drive or while already raising/lowering.

---

### 2.6 Manual Message Send

| Field | Detail |
|-------|--------|
| **UI** | "发送" (Send) button in `MessagePanel.tsx` (Debug tab) |
| **CAN ID** | User-defined (default: `123`) |
| **Data** | User-defined (default: `01 FF FF FF 00 00 00 00`) |
| **Frame type** | Uses current serial config (`standard` or `extended`) |
| **Protocol** | Uses current serial config (`fixed` or `variable`) |
| **Handler** | `handleSendMessage()` in `src/store/canMessageStore.ts` |

---

### 2.7 Radar Queries — CAN IDs `0x521` ~ `0x524`

| Radar | CAN ID | Data |
|-------|--------|------|
| Radar 1 | `0x521` | `01 03 01 00 00 01` |
| Radar 2 | `0x522` | `02 03 01 00 00 01` |
| Radar 3 | `0x523` | `03 03 01 00 00 01` |
| Radar 4 | `0x524` | `04 03 01 00 00 01` |

**Rate:** Configurable via `radar.queryIntervalMs` in `appConfig.ts` (default: 1000 ms). All 4 radars queried sequentially each cycle.
**Handler:** `sendRadarQuery()` in `src/store/radarStore.ts`.

---

### 2.8 CAN Configuration Packet (Auto-sent on Connect)

| Field | Detail |
|-------|--------|
| **When** | Automatically sent when serial port connects |
| **Format** | `AA 55` header + config bytes + checksum (NOT a CAN message — this is a serial adapter config packet) |
| **Contents** | Protocol length, CAN baud rate, frame type, filter/mask IDs, CAN mode, auto-resend |
| **Builder** | `create_can_config_packet()` in `src-tauri/src/can_protocol.rs:12` |
| **Sent from** | `connect_serial()` in `src-tauri/src/commands.rs:108` |

---

## 3. CAN ID Quick Reference

| CAN ID | Direction | Purpose |
|--------|-----------|---------|
| `0x00000123` | **RX** | Vehicle status (gear, speed, steering angle) |
| `0x200` | **TX** | All driving: auto-drive loop, pedals, steering wheel, creep, heartbeat |
| `0x201` | **TX** | Body control: doors, fan, lights, suspension |
| `0x521` | **TX + RX** | Radar 1 (query + response) |
| `0x522` | **TX + RX** | Radar 2 (query + response) |
| `0x523` | **TX + RX** | Radar 3 (query + response) |
| `0x524` | **TX + RX** | Radar 4 (query + response) |

---

## 4. Known Issues & Notes

1. **Dead config:** `start_driving` (`0B B8 FF 07 00 00 00 00`) and `stop_driving` (`00 00 00 00 00 00 00 00`) are defined in `src/config/canCommands.ts` but are **never actually sent**. The "START AUTO DRIVE" button uses `startInfiniteDrive()` which generates dynamic CAN data from keyframes at runtime.

2. **Outdated comment:** `src/hooks/useSteeringControl.ts:9` says steering sends on CAN ID `0x18C4D2D0`, but the actual code calls `sendVehicleControlCommand()` which uses `0x200`.

3. **`0x201` Byte 2 collision:** Byte 2 of `0x201` is shared between left door commands and suspension commands. `suspension_down` (`FF FF 02 FF`) and `left_door_open` (`FF FF 02 FF`) use identical data. These must never be active simultaneously. The `independentDoors` config flag in `appConfig.ts` controls this behavior — when set to `false` (linked mode), Byte 2 is always `FF` for door operations to avoid suspension interference.

4. **CAN ID format:** The 20-byte fixed protocol uses 4-byte little-endian CAN ID in the packet (bytes 5–8). Frontend config values like `"200"` are parsed as hex, resulting in `0x00000200`. Received CAN IDs are formatted as `0x00000123` (8 hex digits zero-padded).
