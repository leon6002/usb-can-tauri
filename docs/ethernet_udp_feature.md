# 以太网 UDP 通信功能说明 (Ethernet UDP Feature)

## 1. 功能概述
该功能允许 OSYX 车辆控制软件通过以太网 (UDP 协议) 直接与 ZCU（区域控制器，ETH-COMM-UDP-001）或其他硬件设备进行通信。支持发送控制指令模板，并实时接收、展示目标设备返回的应答状态。

## 2. 界面与交互说明
在软件界面的侧边栏（或车载控制界面的右上角）点击 **"UDP Comm Test"** 按钮，即可打开 UDP 通信控制台 (UDP Communication Console)。

控制台包含以下几个主要部分：
- **监听配置 (Local Port & Start/Stop Listen)**: 
  - 设置本地电脑接收 UDP 数据的端口（默认 `5001`）。
  - 点击 **"Start Listen"** 会在后台启动一个监听线程。**必须启动监听后，才能收到对方发来的回包 (ACK)**。
  - 点击 **"Stop Listen"** 可以强制中断当前监听任务释放端口，方便在不重启软件的情况下切换端⼝。
- **目标配置 (Target IP & Port)**:
  - 设置目标 ZCU 设备的 IP 地址和接收端口号（默认 IP 为 `192.168.1.100`，端口为 `5000`）。这决定了点击 Transmit 后数据将发往何处。
- **指令发送 (Payload & Transmit)**:
  - 提供了几种预设的指令模板：
    - `101: CMD_START_STOP`
    - `102: CMD_GET_STATUS`
    - `103: CMD_PING`
  - 勾选 `Ack Info` 时，如果在发出后的若干秒内未检测到对方的应答包，会在日志里显示检查记录。
  - 点击 **"Transmit"** 将当前指令打包成 JSON 格式并通过 UDP 发送到目标地址。
- **终端日志 (Terminal Logs)**:
  - 实时显示通信日志，包括本机发送出去的数据 `[SEND]` (青色)，接收到的数据 `[RECV]` (绿色)，以及系统错误信息 `[ERROR]` (红色)。

## 3. 技术实现架构
- **前端 (React/Tsx)**: `UdpCommunicationPanel.tsx` 负责界面交互与状态管理。页面使用 Tauri 的 `invoke` API 桥接后端指令，并通过 `listen` API 订阅 `udp-message-received` 事件，从而实时更新终端面板。
- **后端 (Rust/Tauri)**: `udp.rs` 实现了底层的 UDP Socket 管理。系统将 Socket 以及异步长监听任务保存在 `UdpState` 作为 Tauri 全局托管状态。
  - `init_udp_socket`: 绑定本地接口和端口，并派生一个 `tokio` 异步无限循环任务，持续等待从网络网卡上获取数据。
  - `send_udp_command`: 获取目标地址并调用系统底层 `send_to` 方法发送数据。
  - `close_udp_socket`: 强制中断 (abort) 挂起的异步监听任务并释放 Socket 资源对象，避免地址被长期占用导致 10048 (WinError) 重复绑定错误。

## 4. 数据协议 (JSON)
目前预设所有的 UDP 数据包均采用 JSON 格式传输，支持中文 Unicode 原生编码。
**发送请求格式示例：**
```json
{
  "header": {
    "seq": 1001,
    "timestamp": 1772712057,
    "source": "PC_HOST"
  },
  "body": {
    "cmd_code": 101,
    "parameters": {
      "Interface_id": 0
    }
  }
}
```

**接收应答格式示例：**
```json
{
  "header": {
    "seq": 1001,
    "timestamp": 1772712058,
    "source": "ZCU_TARGET"
  },
  "body": {
    "cmd_code": 200,
    "parameters": {
      "result": "OK",
      "orig_seq": 1001,
      "msg": "这是一个模拟的应答"
    }
  }
}
```

## 5. 本地/硬件测试指南
开发时或者无实体 ZCU 硬件时，可以使用项目根目录下的 `mock_zcu.py` 脚本来模拟真实 ZCU 硬件的应答机制进行测试。

**测试步骤：**
1. **运行模拟器**: 在终端中执行 `python mock_zcu.py`。（注意：确保脚本内的 `ZCU_IP` 设置为 `0.0.0.0`，以便接收局域网内所有网卡的请求，避免仅仅绑定了本地回环 (127.0.0.1) 而拒绝外部通信）
2. **启动接收端**: 打开 OSYX 软件的 UDP 面板，Local Port 保持 `5001`，点击 **"Start Listen"**。
3. **配置发送端**: Target IP 填入运行 Python 脚本的实际机器 IP（如果在树莓派运行则填写树莓派 IP，如果是本机上测试则填 `127.0.0.1` 也行），Target Port 填 `5000`。
4. **发送数据**: 选择一个通信 Payload 发包模板，点击 **"Transmit"**。
5. **验证**: 终端日志中应能按顺序看到青色的 `[SEND]` 日志和绿色的 `[RECV]` 模拟应答日志。
