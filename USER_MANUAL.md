# OSYX Car Controller - User Manual

## 1. Car Control Tab

The **Car Control Tab** is the main interface for interacting with the vehicle simulation and hardware. It provides a 3D visualization of the car, manual driving controls, and system configuration options.

### 1.1 Interface Overview

![Car Control Tab Interface](./docs/car_control_tab.png)

#### **A. 3D Visualization**
-   **Central View**: Displays a real-time 3D rendering of the vehicle on a simulated road.
-   **Camera**: The camera automatically follows the car during driving. In manual mode, you can rotate the view using your mouse.

#### **B. Radar System (Top Right)**
Displays real-time telemetry data:
-   **SPEED**: Current vehicle speed in km/h.
-   **ANGLE**: Current steering angle in degrees.

#### **C. Manual Controls (Right Side)**
-   **Steering Wheel**: Visualizes the current steering angle. When "Manual Drive" is active, you can drag the wheel to steer.
-   **Gear Selector**:
    -   **P**: Park
    -   **R**: Reverse
    -   **D**: Drive
-   **Pedals**:
    -   **BRAKE**: Visualizes brake pressure.
    -   **ACCEL**: Visualizes accelerator pressure.

#### **D. Vehicle Controls (Bottom Right Panel)**
-   **START AUTO DRIVE**: Toggles the automated driving mode. When active, the system takes control of steering and speed based on the pre-loaded trajectory.
-   **Suspension**:
    -   **RAISE**: Increases the vehicle's suspension height.
    -   **LOWER**: Decreases the vehicle's suspension height.
-   **Mode Selection**:
    -   **M1 / M2 / M3**: Preset driving or configuration modes.
    -   **OFF**: Turns off the active mode.

#### **E. Connection Panel (Bottom Left)**
-   **Port Selector**: Dropdown menu to select the serial port (e.g., COM3, /dev/ttyUSB0).
-   **Refresh**: Refreshes the list of available ports.
-   **Connect/Disconnect**: Establishes or terminates the connection to the vehicle hardware/simulator.
    -   *Note: Controls are disabled until a successful connection is made.*

---

## 2. System Monitor

The **System Monitor** provides a high-level overview of the vehicle's electronic architecture (EE Arch), monitoring the performance of different computing domains.

### 2.1 Interface Overview

![System Monitor Interface](./docs/system_monitor.png)

#### **A. Header Controls**
-   **Port Selection**: Select the COM port for the system monitor data stream.
-   **Connect**: Connect to the monitoring stream.

#### **B. VM1 - ASIL D (Safety Critical Domain)**
Monitors the high-safety domain responsible for critical vehicle functions.
-   **CPU Load**: Gauge showing the usage of the G4MH Core (@400Mhz).
-   **Memory Stack**: Real-time graph showing memory usage trends.
-   **Subsystem Status**:
    -   **Steering control (CAN1)**: Indicator light (Red/Green) showing the health of the steering subsystem.
    -   **Brake control (CAN2)**: Indicator light showing the health of the braking subsystem.

#### **C. VM2 - ASIL B (Body & Comfort Domain)**
Monitors the domain responsible for non-critical body and comfort functions.
-   **CPU Load**: Gauge showing the usage of the G4MH Core (@400Mhz).
-   **Memory Stack**: Real-time graph showing memory usage trends.
-   **Subsystem Status**:
    -   **Body control (PWM, SPI)**: Indicator light showing the status of body electronics (windows, locks, etc.).
    -   **Air conditioning (PWM)**: Indicator light showing the status of the HVAC system.
