# OSYX Vehicle Controller

<div align="center">

![Version](https://img.shields.io/badge/version-2.2.0-blue)
![License](https://img.shields.io/badge/license-MIT-green)
![Platform](https://img.shields.io/badge/platform-Windows%20%7C%20macOS%20%7C%20Linux-lightgrey)

A powerful cross-platform vehicle control and monitoring system with real-time 3D visualization, CAN bus communication, and system monitoring.

</div>

## 📋 Project Overview

OSYX Vehicle Controller is a modern desktop application built with **Tauri + React** designed for controlling and monitoring vehicle systems. It provides a comprehensive vehicle control interface, hardware communication management, real-time system monitoring, and 3D visualization capabilities.

### ✨ Core Features

- **🚗 Vehicle Control**
  - Steering wheel control (steering angle adjustment)
  - Throttle and brake pedal control
  - Suspension system control
  - Lighting control system (high beams, low beams, etc.)
  - Fan and air conditioning control
  - Real-time vehicle status monitoring

- **📡 Hardware Communication**
  - CAN bus protocol support
  - Serial/USB device communication
  - Custom protocol message configuration
  - Message send and receive panels
  - Real-time data parsing

- **🎨 3D Visualization**
  - Real-time 3D vehicle model display
  - Interactive camera controls
  - Vehicle component animations
  - Lighting effects and environment rendering
  - Radar distance display

- **📊 System Monitoring**
  - CPU usage rate monitoring
  - Memory usage display
  - Real-time performance charts
  - Virtual machine status indicators

- **⚙️ Configuration Management**
  - CAN device connection configuration
  - Custom button mapping
  - Protocol command editing
  - Parameter saving and loading

- **🎯 Demo Mode**
  - Complete functionality demonstration
  - Simplified user interface
  - Quick prototype testing

---

## 🚀 Technology Stack & Environment

| Category      | Technology     | Description                                                    |
| :------------ | :------------- | :------------------------------------------------------------- |
| **Desktop**   | **Tauri 2.8**  | Modern, secure, lightweight cross-platform desktop framework    |
| **Frontend**  | **React 19.1** | JavaScript library for building user interfaces                |
| **3D Engine** | **Three.js**   | Powerful JavaScript 3D library                                 |
| **3D Binding**| **React Three Fiber** | Integration library for React and Three.js                |
| **UI Libs**   | **Material-UI + Radix UI** | High-quality UI component libraries           |
| **Language**  | **TypeScript** | Typed JavaScript for improved code quality                     |
| **Build Tool**| **Vite 7.0**   | Fast development server and build tool                         |
| **State**     | **Zustand**    | Lightweight state management library                           |
| **Charts**    | **Recharts**   | React component library for charts                             |
| **Styling**   | **Tailwind CSS** | Utility-first CSS framework                                   |

### 💻 Recommended Development Environment

- **[VS Code](https://code.visualstudio.com/)** - Recommended code editor
  - **[Tauri VS Code Extension](https://marketplace.visualstudio.com/items?itemName=tauri-apps.tauri-vscode)** - Tauri development assistance
  - **[rust-analyzer](https://marketplace.visualstudio.com/items?itemName=rust-lang.rust-analyzer)** - Rust code support
  - **[ES7+ React/Redux/React-Native snippets](https://marketplace.visualstudio.com/items?itemName=dsznajder.es7-react-js-snippets)** - React code snippets

### 📦 System Requirements

- **Node.js** >= 16.0
- **npm** >= 8.0 or **pnpm**
- **Rust** >= 1.70 (for building Tauri applications)
- **Windows**, **macOS**, or **Linux**

---

## 📂 Project Structure

```
osyx-vehicle-controller/
├── src/                           # Frontend source code
│   ├── components/                # React components
│   │   ├── CarControl/            # Vehicle control components
│   │   ├── CanConfig/             # CAN configuration components
│   │   ├── ButtonConfig/          # Button configuration components
│   │   ├── Car3D/                 # 3D vehicle rendering
│   │   ├── SystemMonitor/         # System monitoring components
│   │   ├── Layout/                # Layout components
│   │   └── ui/                    # Base UI components
│   ├── hooks/                     # Custom React Hooks
│   ├── lib/                       # Utility functions
│   ├── App.tsx                    # Main application component
│   └── main.tsx                   # Entry point
├── src-tauri/                     # Tauri backend code
│   ├── src/                       # Rust source code
│   ├── build.rs                   # Build script
│   └── Cargo.toml                 # Rust dependencies
├── docs/                          # Documentation and references
│   ├── ThunderSoftSendingCommnad.xlsx
│   ├── 上位机协议CAN.docx         # CAN protocol specification
│   └── csv_protocal.png           # Protocol diagram
├── public/                        # Static assets
│   └── car-assets/                # Vehicle assets (3D models, etc.)
├── package.json                   # Frontend dependencies
├── tsconfig.json                  # TypeScript configuration
├── tailwind.config.js             # Tailwind CSS configuration
├── vite.config.ts                 # Vite configuration
└── README.md                      # Project documentation
```

---

## 🛠️ Installation & Setup

### 1. Clone the Repository

```bash
git clone https://github.com/osyx/osyx-vehicle-controller.git
cd osyx-vehicle-controller
```

### 2. Install Dependencies

```bash
# Using npm
npm install

# Or using pnpm (recommended)
pnpm install
```

### 3. Run Development Mode

```bash
# Start the development server and Tauri application
npm run tauri dev

# Or using pnpm
pnpm tauri dev
```

The development server usually runs at `http://localhost:5173`

### 4. Production Build

```bash
# Compile TypeScript and build
pnpm run build

# Or build Tauri application
pnpm run tauri build
```

Build output location: `src-tauri/target/release/`

---

## 🎮 Usage Guide

### Launch Modes

The application supports two launch modes:

#### 📺 Demo Mode
Displays only the vehicle control interface, suitable for feature demonstrations and quick testing.

#### 🔧 Debug Mode
Shows the complete developer interface, including:
- **Vehicle Control Panel** - Control all vehicle systems
- **CAN Configuration** - Manage hardware communication settings
- **Button Configuration** - Customize control buttons
- **Sidebar Navigation** - Switch between different features

### Main Feature Usage

#### Vehicle Control
1. Select the "Vehicle Control" tab in the left sidebar
2. Use the following controls:
   - **Steering Wheel** - Adjust steering angle
   - **Pedals** - Control throttle and brake
   - **Light Switches** - Control various lights
   - **3D View** - View vehicle status in real-time

#### CAN Communication Configuration
1. Select the "Configuration" tab
2. Configure CAN device connection parameters
3. Manage and edit protocol messages
4. Send and receive data

#### System Monitoring
View CPU usage rate, memory consumption, and other system metrics in real-time.

---

## 🔌 CAN Protocol

The application communicates with vehicle hardware via CAN bus. For detailed protocol specifications, refer to the documentation in the `docs/` directory:

- `上位机协议CAN.docx` - Detailed CAN protocol specification
- `ThunderSoftSendingCommnad.xlsx` - Command reference table
- `csv_protocal.png` - Protocol diagram
- `test_data.csv` - Test data examples

---

## 📱 API & Components

### Main Hooks

- `useR3FScene` - Manages 3D scene initialization
- `useTauriEvents` - Handles Tauri events and communication
- `useCarControl` - Vehicle control logic

### Core Components

- `CarControlTab` - Main vehicle control panel
- `CanConfigTab` - CAN configuration interface
- `Car3DViewer` - 3D vehicle preview
- `SystemMonitorWindow` - System monitoring window

---

## 🐛 Troubleshooting

### Common Issues

**Q: Getting Tauri-related errors on startup**
- Ensure Rust and necessary development tools are installed
- On Windows, you may need to install MSVC build tools
- See [Tauri official documentation](https://tauri.app/v1/guides/getting-started/prerequisites)

**Q: 3D model not displaying**
- Check if model files exist in `public/car-assets/` directory
- Ensure your browser supports WebGL

**Q: CAN communication connection failed**
- Verify hardware device is properly connected
- Check if device drivers are installed
- Check application logs for detailed error messages

---

## 📝 Development Guide

### Adding New Features

1. Create new components in `src/components`
2. Import and use components in `App.tsx`
3. For backend communication, add Rust code in `src-tauri/src/`
4. Run `pnpm run tauri dev` to test

### Style Development

The project uses Tailwind CSS. Use utility classes in components:

```jsx
<div className="flex items-center justify-center h-screen bg-gray-100">
  <button className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600">
    Click
  </button>
</div>
```








