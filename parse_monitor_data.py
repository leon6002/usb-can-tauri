import struct
import random
import time

def parse_system_monitor_data(data):
    """
    Parses the 18-byte U2AStatus array.
    
    Structure:
    Byte 0: Header 0xAA
    Byte 1: Header 0x55
    Byte 2: Core 1 CPU Usage (%)
    Byte 3: Core 2 CPU Usage (%)
    Byte 4: Core 3 CPU Usage (%) [Real VM1]
    Byte 5: Core 4 CPU Usage (%)
    Byte 6: VM0 Memory Usage (%)
    Byte 7: VM1 Memory Usage (%) [Real VM1]
    Bytes 8-9: Idle Counter
    Bytes 10-11: Max Counter
    Byte 12: Idle % (Debug)
    Byte 13: Real CPU (Debug)
    Byte 14: Steering control (CAN1)
    Byte 15: Brake control (CAN2)
    Byte 16: Body control (PWM, SPI)
    Byte 17: Air conditioning system
    """
    if len(data) != 18:
        print(f"Error: Expected 18 bytes, got {len(data)}")
        return

    if data[0] != 0xAA or data[1] != 0x55:
        print(f"Error: Invalid Header {hex(data[0])} {hex(data[1])}")
        return

    core1_cpu = data[2]
    core2_cpu = data[3]
    core3_cpu = data[4]
    core4_cpu = data[5]
    vm0_mem = data[6]
    vm1_mem = data[7]
    
    # Debug Info
    idle_counter = data[8] | (data[9] << 8)
    max_counter = data[10] | (data[11] << 8)
    idle_pct_debug = data[12]
    real_cpu_debug = data[13]

    # New Variables
    steering_ctrl = data[14]
    brake_ctrl = data[15]
    body_ctrl = data[16]
    ac_system = data[17]

    print("-" * 30)
    print(f"System Monitor Data Parsing:")
    print("-" * 30)
    print(f"Core 1 CPU: {core1_cpu}%")
    print(f"Core 2 CPU: {core2_cpu}%")
    print(f"Core 3 CPU: {core3_cpu}% (VM1 Real)")
    print(f"Core 4 CPU: {core4_cpu}%")
    print(f"VM0 Mem   : {vm0_mem}%")
    print(f"VM1 Mem   : {vm1_mem}% (VM1 Real)")
    print(f"Steering  : {steering_ctrl}")
    print(f"Brake     : {brake_ctrl}")
    print(f"Body Ctrl : {body_ctrl}")
    print(f"A/C Sys   : {ac_system}")
    print(f"DEBUG: Idle={idle_counter}, Max={max_counter}")
    print(f"DEBUG: Idle%={idle_pct_debug}, RealCPU={real_cpu_debug}")
    print("-" * 30)

def generate_mock_data():
    """Generates a mock 18-byte data packet similar to SystemMonitor.c logic."""
    real_cpu = random.randint(10, 90)
    
    core1 = min(100, real_cpu + random.randint(5, 15))
    core2 = min(100, real_cpu + random.randint(5, 15))
    core3 = real_cpu
    core4 = max(0, min(100, real_cpu + random.randint(-2, 2)))
    
    vm0_mem = random.randint(40, 60)
    vm1_mem = random.randint(20, 80) # Mocking real value
    
    data = bytearray(18)
    data[0] = 0xAA
    data[1] = 0x55
    data[2] = core1
    data[3] = core2
    data[4] = core3
    data[5] = core4
    data[6] = vm0_mem
    data[7] = vm1_mem
    # Bytes 8-13 remain 0
    data[14] = 1
    data[15] = 1
    data[16] = 1
    data[17] = 1
    
    return data

if __name__ == "__main__":
    try:
        import serial
    except ImportError:
        print("Error: 'pyserial' module not found. Please install it using: pip install pyserial")
        exit(1)

    SERIAL_PORT = "COM4"
    BAUD_RATE = 500000 # Assumed baud rate, adjust if necessary

    print(f"Connecting to {SERIAL_PORT} at {BAUD_RATE} baud...")
    
    try:
        with serial.Serial(SERIAL_PORT, BAUD_RATE, timeout=1) as ser:
            print("Connected. Waiting for data...")
            
            while True:
                # Read 1 byte to find header
                byte = ser.read(1)
                if byte == b'\xAA':
                    byte2 = ser.read(1)
                    if byte2 == b'\x55':
                        # Header found, read remaining 16 bytes
                        data_payload = ser.read(16)
                        if len(data_payload) == 16:
                            full_data = b'\xAA\x55' + data_payload
                            parse_system_monitor_data(full_data)
                else:
                    # Optional: Print a dot or something to show it's alive but no full packet
                    # print(".", end="", flush=True)
                    pass
                    
    except serial.SerialException as e:
        print(f"Serial Error: {e}")
    except KeyboardInterrupt:
        print("\nStopping...")
