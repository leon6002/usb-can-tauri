import random
import time
import abc
from abc import ABC, abstractmethod


class DataGenerator(ABC):
    """
    所有数据生成器的抽象基类。
    强制要求子类实现 generate_data 方法。
    """
    @abstractmethod
    def generate_data(self) -> list[int]:
        """
        抽象方法：生成并返回下一帧数据的字节列表（CAN 帧数据部分或完整数据包）。

        注意：子类需要根据自己的逻辑决定是返回 CAN 帧数据（8字节）还是一个完整数据包。
        对于您的雷达数据，它返回的是 8 字节的 CAN 数据部分。
        """
        pass
class SmoothDataGenerator(DataGenerator):
    """
    生成平滑且符合特定范围的测试数据。
    """
    def __init__(self):
        # 初始化上次的值，用于平滑过渡
        self.last_cpu = [10.0, 10.0, 10.0]
        self.last_memory = 40.0

        # 定义期望的均值和标准差 (Std Dev)
        # CPU: 均值 10，标准差 3 (大部分在 10 ± 6 之间，即 4% 到 16%)
        self.CPU_MEAN = 10.0
        self.CPU_STD = 3.0

        # 内存: 均值 40，标准差 5 (大部分在 40 ± 10 之间，即 30% 到 50%)
        self.MEMORY_MEAN = 40.0
        self.MEMORY_STD = 5.0

        # 定义平滑因子：新值与旧值的混合比例。越小越平滑。
        self.SMOOTHING_FACTOR = 0.20 # 0.15 意味着新值占 15%，旧值占 85%

    def _get_smooth_value(self, last_val, mean, std_dev, min_val=0, max_val=100):
        """生成一个平滑过渡、符合高斯分布且在 min/max 范围内的值。"""

        # 1. 生成基于高斯分布的目标值 (更真实)
        target_val = random.gauss(mean, std_dev)

        # 2. 将目标值限制在 0-100 范围内
        target_val = max(min_val, min(max_val, target_val))

        # 3. 计算平滑后的当前值 (当前值 = 旧值 * (1 - 因子) + 目标值 * 因子)
        new_val = last_val * (1 - self.SMOOTHING_FACTOR) + target_val * self.SMOOTHING_FACTOR

        return new_val

    def generate_data(self):
        """生成一帧新的测试数据"""

        # --- 1. CPU 利用率 (平滑且低值) ---
        new_cpus = []
        for i in range(3):
            new_cpu = self._get_smooth_value(
                self.last_cpu[i],
                self.CPU_MEAN,
                self.CPU_STD
            )
            new_cpus.append(int(round(new_cpu, 0))) # 保留两位小数
            self.last_cpu[i] = new_cpu # 更新上一次的值

        # --- 2. 内存利用率 (平滑且约 40%) ---
        new_memory = self._get_smooth_value(
            self.last_memory,
            self.MEMORY_MEAN,
            self.MEMORY_STD
        )
        new_memory_rounded = int(round(new_memory, 0))
        self.last_memory = new_memory # 更新上一次的值

        # --- 3. 系统状态 (保持随机跳变，因为状态码通常是离散的) ---
        steering = random.randint(0, 2)
        brake = random.randint(0, 2)
        body = random.randint(0, 2)
        ac = random.randint(0, 2)

        return [
            0x09, 0x02, 0x00, 0x00, # CAN ID 0x209
            0x08,                   # data length
            *new_cpus,              # cpu1, cpu2, cpu3
            new_memory_rounded,     # memory
            2, 2, 2, 2
        ]

        # return [
        #     *new_cpus,            # cpu1, cpu2, cpu3
        #     new_memory_rounded,   # memory
        #     steering, brake, body, ac
        # ]


class RadarDataGenerator(DataGenerator):
    """
    生成模拟的雷达数据。
    """
    def __init__(self):
        # 存储4个雷达的距离值，用于平滑
        self.last_distances = [700.0, 750.0, 650.0, 800.0]
        self.current_radar_id = 1
        self.SMOOTHING_FACTOR = 0.25
        self.DISTANCE_STD = 100.0 # 距离波动的标准差

    def _get_smooth_distance(self, index: int, min_dist=200, max_dist=1400) -> int:
        """生成一个平滑过渡的雷达距离值，并在范围内波动。"""

        last_val = self.last_distances[index]

        # 目标值以当前值或中心值(例如700)为中心随机波动
        # 使用当前 last_val 作为均值，模拟围绕当前距离小幅波动
        target_val = random.gauss(last_val, self.DISTANCE_STD)

        # 限制范围
        target_val = max(min_dist, min(max_dist, target_val))

        # 平滑过渡
        new_val = last_val * (1 - self.SMOOTHING_FACTOR) + target_val * self.SMOOTHING_FACTOR

        # 更新并返回整数值
        self.last_distances[index] = new_val
        return int(round(new_val, 0))

    def _distance_to_two_bytes(self, distance: int) -> list[int]:
        """将距离整数转换为 2 字节（高位在前）列表。"""
        # distance 范围在 200-1400，需要 2 字节 (16 bit)
        # 协议通常使用大端序 (big-endian)
        byte_representation = distance.to_bytes(length=2, byteorder='big')
        return list(byte_representation)

    def generate_data(self) -> list[int]:
        """
        生成一个 8 字节的雷达数据包，并自动递增雷达编号 (1-4)。
        """
        radar_id = self.current_radar_id  # 1 到 4

        # 1. 生成平滑距离 (使用当前 ID - 1 作为索引)
        distance_int = self._get_smooth_distance(radar_id - 1)

        # 2. 转换距离为 2 字节
        distance_bytes = self._distance_to_two_bytes(distance_int)

        # 3. 构建 8 字节数据包: [编号, 0x83, 距离高, 距离低, 0x00, 0x00, 0x00, 0x00]
        packet = [
            0x20+radar_id, 0x05, 0x00, 0x00,     #Byte 0-3: CAN ID
            0x04,                # Byte 4: data length
            radar_id,            # Byte 5: 雷达编号 (1-4)
            0x83,                # Byte 6: 固定值 0x83
            distance_bytes[0],   # Byte 7: 距离高字节
            distance_bytes[1],   # Byte 8: 距离低字节
            0x00, 0x00, 0x00, 0x00 # Byte 9-12: 固定为 0x00
        ]

        # 4. 递增雷达编号 (1, 2, 3, 4, 1, 2, ...)
        self.current_radar_id = (self.current_radar_id % 4) + 1

        print(f"   [Radar] ID={radar_id}, Dist={distance_int} -> Hex={format_can_message(distance_bytes)}")

        return packet

# --- 占位符辅助函数 ---
def format_can_message(data):
    """格式化数据为十六进制字符串"""
    return ' '.join(f'{x:02x}' for x in data)
# ---------------------

# --- 示例用法 ---
if __name__ == "__main__":
    generator = RadarDataGenerator()

    print("--- 生成 10 帧平滑数据示例 ---")
    for i in range(10):
        data = generator.generate_data()
        print(format_can_message(data))
        # print(f"帧 {i+1}: CPU: {data[0:3]}, Mem: {data[3]:.2f}, States: {data[4:]}")
        time.sleep(0.5) # 模拟每 0.5 秒接收一次数据