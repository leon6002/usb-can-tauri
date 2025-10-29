import random
import time

class SmoothDataGenerator:
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

    def generate_test_data(self):
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
            *new_cpus,            # cpu1, cpu2, cpu3
            new_memory_rounded,   # memory
            2, 2, 2, 2
        ]
        
        # return [
        #     *new_cpus,            # cpu1, cpu2, cpu3
        #     new_memory_rounded,   # memory
        #     steering, brake, body, ac
        # ]

# --- 示例用法 ---
if __name__ == "__main__":
    generator = SmoothDataGenerator()
    
    print("--- 生成 10 帧平滑数据示例 ---")
    for i in range(10):
        data = generator.generate_test_data()
        print(f"帧 {i+1}: CPU: {data[0:3]}, Mem: {data[3]:.2f}, States: {data[4:]}")
        time.sleep(0.5) # 模拟每 0.5 秒接收一次数据