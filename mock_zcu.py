import socket
import json
import time

# 模拟 ZCU 的监听地址和端口
ZCU_IP = "0.0.0.1"
ZCU_PORT = 5000

# 上位机的接收端口
PC_PORT = 5001

def start_mock_zcu():
    # 创建 UDP socket
    sock = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
    sock.bind((ZCU_IP, ZCU_PORT))
    
    print(f"[*] Mock ZCU 正在监听 {ZCU_IP}:{ZCU_PORT} ...")
    
    while True:
        try:
            # 接收数据
            data, addr = sock.recvfrom(2048)
            msg = data.decode('utf-8')
            print(f"\n[收到 PC 请求来自 {addr}]:\n{msg}")
            
            # 尝试解析 JSON 来获取原始序列号
            orig_seq = 0
            try:
                json_data = json.loads(msg)
                orig_seq = json_data.get("header", {}).get("seq", 0)
            except Exception as e:
                print("JSON 解析失败:", e)
            
            # 构造按照协议要求的响应格式
            response = {
                "header": {
                    "seq": orig_seq,
                    "timestamp": int(time.time()),
                    "source": "ZCU_TARGET"
                },
                "body": {
                    "cmd_code": 200,
                    "parameters": {
                        "result": "OK",
                        "orig_seq": orig_seq,
                        "msg": "这是一个模拟的应答"
                    }
                }
            }
            
            # 发送响应回上位机的 IP 和设定的本地端口
            resp_bytes = json.dumps(response).encode('utf-8')
            # addr[0] 是上位机的 IP，我们发给上位机监听的 5001 端口
            target_addr = (addr[0], PC_PORT)  
            
            sock.sendto(resp_bytes, target_addr)
            print(f"[发送 ACK 应答至 {target_addr}]: {json.dumps(response)}")
            
        except KeyboardInterrupt:
            print("\n退出模拟器")
            break
        except Exception as e:
            print("发生错误:", e)

if __name__ == "__main__":
    start_mock_zcu()
