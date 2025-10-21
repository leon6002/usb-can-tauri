import numpy as np
import pandas as pd
from scipy.interpolate import make_interp_spline
from scipy.signal import savgol_filter
import math

def start_mock(output_filename):

    # --- 参数设定 ---
    DATA_POINTS = 4000  # 总数据量
    MAX_ANGLE = 60      # 最大转向角范围
    MIN_SPEED = 1000    # 最小速度 (必须是 SPEED_STEP 的倍数)
    MAX_SPEED = 3000    # 最大速度 (必须是 SPEED_STEP 的倍数)
    SPEED_STEP = 100    # 速度的步长设置
    
    # 关键修改 1: 显著减少分段数量，减少转弯频率
    SEGMENTS_COUNT = 10 # 调整为 15，意味着总共有约 15 次转弯-直行循环
    
    ZERO_DURATION_RATIO = 0.1 # 增加直行时长比例到 60%
    
    # 确保 MIN/MAX_SPEED 是 SPEED_STEP 的有效倍数
    if MIN_SPEED % SPEED_STEP != 0 or MAX_SPEED % SPEED_STEP != 0:
        print("警告：为了确保速度是步长的精确倍数，建议 MIN_SPEED 和 MAX_SPEED 应是 SPEED_STEP 的倍数。")
        
    # --- 停止区设定 ---
    STOP_PERCENTAGE = 0.10             # 最后 10% 的数据用于缓慢停止
    STOP_POINTS = int(DATA_POINTS * STOP_PERCENTAGE)
    STOP_START_INDEX = DATA_POINTS - STOP_POINTS

    # --- 1. 生成分段的基础转角数据 ---
    np.random.seed(42) 
    # 生成更多的关键点，以便在插值时得到更平缓的曲线
    BASE_ANCHOR_COUNT = SEGMENTS_COUNT * 3 + 1
    anchor_angles = np.random.uniform(-MAX_ANGLE * 0.8, MAX_ANGLE * 0.8, BASE_ANCHOR_COUNT)
    
    # 关键修改 2: 强制开头长时间直行 (保持 5 个关键点为 0)
    INITIAL_STRAIGHT_ANCHORS = 5 
    anchor_angles[:INITIAL_STRAIGHT_ANCHORS] = 0.0
    anchor_angles[-1] = 0.0 

    # 关键修改 3: 使用更多的点进行三次样条插值，曲线更平滑
    x_anchor = np.linspace(0, 1, len(anchor_angles))
    x_full = np.linspace(0, 1, DATA_POINTS)
    # 使用三次样条插值 (Cubic Spline) 确保平滑
    spline = make_interp_spline(x_anchor, anchor_angles)
    raw_angle_data = spline(x_full)
    raw_angle_data = np.clip(raw_angle_data, -MAX_ANGLE, MAX_ANGLE)

    

    # --- 2. 引入直行（大量0值）和转弯过渡逻辑 ---
    final_angle_data = np.zeros(DATA_POINTS)
    segment_length = DATA_POINTS // SEGMENTS_COUNT
    zero_length = int(segment_length * ZERO_DURATION_RATIO)

    turn_length = segment_length - zero_length
    

    # **新增参数：平滑侵入的长度 (让转弯提前开始)**
    # 设定为转弯段长度的 20%，这部分将侵入直行段的末尾
    INCURSION_RATIO = 0.8
    INCURSION_LEN = int(turn_length * INCURSION_RATIO) 
    
    # --- 2. 引入直行（大量0值）和转弯过渡逻辑 ---
    
    # 循环中的核心逻辑将进行修改
    for i in range(SEGMENTS_COUNT):
        start = i * segment_length
        
        # 定义原始的直行和转弯边界
        zero_end = start + zero_length
        turn_start_raw = zero_end
        turn_end = start + segment_length
        
        if turn_start_raw < STOP_START_INDEX:
            
            # **【核心修改】**：让转弯段的起始点向前侵入直行段
            turn_start_smooth = turn_start_raw - INCURSION_LEN
            
            # 确保侵入不会跑到上一个转弯的活动区域
            turn_start_smooth = max(turn_start_smooth, start)
            
            # 确定实际需要处理的段
            segment_start = turn_start_smooth
            segment_end = min(turn_end, STOP_START_INDEX)
            
            raw_segment = raw_angle_data[segment_start:segment_end]
            
            if len(raw_segment) > 0:
                
                # --- Savitzky-Golay 平滑 (用于去噪) ---
                max_possible_window = len(raw_segment)
                window_len = min(31, max_possible_window)
                
                if window_len % 2 == 0:
                    window_len -= 1
                if window_len < 3:
                    smoothed_segment = raw_segment
                else:
                    smoothed_segment = savgol_filter(raw_segment, window_len, 3) 
                
                
                # --- 添加平滑过渡（使转弯更缓慢） ---
                N_seg = len(smoothed_segment)
                
                # 关键：我们使用一个从 0.0 开始的 Cosine 窗，确保平滑进入和退出
                # 使用 Hanning 窗的形状来创建过渡因子 (从 0 升到 1 再降到 0)
                transition_factor = np.hanning(N_seg * 2)[N_seg:] 
                
                transition_segment = smoothed_segment * transition_factor
                
                # 填充到最终数据
                # 由于 segment_start < turn_start_raw，数据现在会覆盖部分 '0' 区，实现平滑进入
                final_angle_data[segment_start:segment_end] = transition_segment
                
                
                # **重要：将侵入区前面的数据强制保持为 0，确保直行段**
                final_angle_data[start:turn_start_smooth] = 0.0

    # --- 3. 停止区：角度平稳归零 ---
    final_angle_data = np.clip(final_angle_data, -MAX_ANGLE, MAX_ANGLE)
    angle_decay_factor = np.linspace(1.0, 0.0, STOP_POINTS)
    final_angle_data[STOP_START_INDEX:] = final_angle_data[STOP_START_INDEX:] * angle_decay_factor


    # --- 4. 生成速度数据 (与角度关联，并应用步长) ---
    normalized_angle_abs = np.abs(final_angle_data) / MAX_ANGLE
    straightness_factor = (1 - normalized_angle_abs)
    speed_range = MAX_SPEED - MIN_SPEED
    raw_speed_data = MIN_SPEED + speed_range * straightness_factor
    speed_noise = np.random.normal(0, 50, DATA_POINTS) 
    speed_data_float = raw_speed_data + speed_noise

    # 处理停止区：速度平稳下降到 MIN_SPEED（浮点数）
    last_speed_before_stop = speed_data_float[STOP_START_INDEX - 1] if STOP_START_INDEX > 0 else MAX_SPEED
    speed_decay_factor = np.linspace(last_speed_before_stop, MIN_SPEED, STOP_POINTS)
    speed_data_float[STOP_START_INDEX:] = speed_decay_factor

    # 应用步长：将浮点数速度四舍五入到最近的 SPEED_STEP 的倍数
    final_speed_data = np.round(speed_data_float / SPEED_STEP) * SPEED_STEP

    # 最终限制速度范围并转换为整数
    final_speed_data = np.clip(final_speed_data, MIN_SPEED, MAX_SPEED).astype(int)

    # --- 5. 整合数据并输出到CSV文件 ---
    output_df = pd.DataFrame({
        'speed': final_speed_data,
        'angle': np.round(final_angle_data, 2), 
    })

    output_df.to_csv(output_filename, index=False)

    # --- 6. 打印结果信息 ---
    print(f"成功生成 {DATA_POINTS} 行模拟行车数据并保存到 {output_filename}")
    print(f"转弯频率: {SEGMENTS_COUNT} 个转弯-直行循环")
    print(f"直行时长占比: {ZERO_DURATION_RATIO*100:.0f}%")
    print("-" * 30)
    print(f"实际速度值的唯一列表: {np.sort(output_df['speed'].unique())}")
    zero_angle_count = (output_df['angle'] == 0).sum()
    print(f"角度为 0.00 的数量: {zero_angle_count} (占总数的 {zero_angle_count / DATA_POINTS * 100:.2f}%)")

def start_mock_new(output_filename):

    # --- 参数设定 ---
    DATA_POINTS = 4000  # 总数据量
    MAX_ANGLE = 60      # 最大转向角范围
    MIN_SPEED = 1000    # 最小速度 (必须是 SPEED_STEP 的倍数)
    MAX_SPEED = 3000    # 最大速度 (必须是 SPEED_STEP 的倍数)
    SPEED_STEP = 100    # 速度的步长设置
    
    # 关键修改 1: 控制转弯频率的关键参数
    BASE_ANCHOR_COUNT = 10 # 降低关键点数量到 25，以确保转弯不频繁
    SMOOTHING_WINDOW = 51 # 增大全局平滑窗口，使曲线更缓和
    ZERO_THRESHOLD = 1.0  # 角度绝对值小于此阈值的将被拉向 0，创建直行区

    # --- 停止区设定 ---
    STOP_PERCENTAGE = 0.10             # 最后 10% 的数据用于缓慢停止
    STOP_POINTS = int(DATA_POINTS * STOP_PERCENTAGE)
    STOP_START_INDEX = DATA_POINTS - STOP_POINTS

    # --- 1. 生成基础的、全局平滑的曲线（角度） ---
    np.random.seed(42) 
    
    # 生成关键点
    anchor_angles = np.random.uniform(-MAX_ANGLE * 0.9, MAX_ANGLE * 0.9, BASE_ANCHOR_COUNT)
    
    # 强制开头长时间直行 (设置前 5 个关键点为 0)
    INITIAL_STRAIGHT_ANCHORS = 5 
    anchor_angles[:INITIAL_STRAIGHT_ANCHORS] = 0.0
    anchor_angles[-1] = 0.0 # 强制结尾为 0

    # 三次样条插值，生成高密度平滑数据
    x_anchor = np.linspace(0, 1, len(anchor_angles))
    x_full = np.linspace(0, 1, DATA_POINTS)
    spline = make_interp_spline(x_anchor, anchor_angles)
    raw_angle_data = spline(x_full)
    
    # 全局平滑 (消除插值带来的局部小波动，使转弯更缓慢)
    window_len = min(SMOOTHING_WINDOW, DATA_POINTS // 2 * 2 + 1)
    if window_len < 3: window_len = 3
    
    raw_angle_data = savgol_filter(raw_angle_data, window_len, 3)
    raw_angle_data = np.clip(raw_angle_data, -MAX_ANGLE, MAX_ANGLE)

    
    # --- 2. 创建平滑的直行区域 (软阈值归零) ---
    final_angle_data = np.copy(raw_angle_data)
    
    # 找到所有角度绝对值小于阈值的点
    small_angle_mask = np.abs(final_angle_data) < ZERO_THRESHOLD
    
    # 对这些点应用一个衰减因子，将其平滑地拉向 0
    if np.any(small_angle_mask):
        # 创建衰减因子：当角度接近 0 时，因子接近 0；当角度接近 ZERO_THRESHOLD 时，因子接近 1
        decay_factor = np.abs(final_angle_data[small_angle_mask]) / ZERO_THRESHOLD
        final_angle_data[small_angle_mask] = final_angle_data[small_angle_mask] * decay_factor

    # --- 3. 停止区：角度平稳归零 ---
    
    # 在停止区，强制角度平稳归零
    angle_decay_factor = np.linspace(1.0, 0.0, STOP_POINTS)
    final_angle_data[STOP_START_INDEX:] = final_angle_data[STOP_START_INDEX:] * angle_decay_factor


    # --- 4. 生成速度数据 (与角度关联，并应用步长) ---

    # 4.1. 基础速度计算（浮点数）
    normalized_angle_abs = np.abs(final_angle_data) / MAX_ANGLE
    straightness_factor = (1 - normalized_angle_abs)
    speed_range = MAX_SPEED - MIN_SPEED
    raw_speed_data = MIN_SPEED + speed_range * straightness_factor
    speed_noise = np.random.normal(0, 50, DATA_POINTS) 
    speed_data_float = raw_speed_data + speed_noise

    # 4.2. 处理停止区：速度平稳下降到 MIN_SPEED（浮点数）
    last_speed_before_stop = speed_data_float[STOP_START_INDEX - 1] if STOP_START_INDEX > 0 else MAX_SPEED
    speed_decay_factor = np.linspace(last_speed_before_stop, MIN_SPEED, STOP_POINTS)
    speed_data_float[STOP_START_INDEX:] = speed_decay_factor

    # 4.3. 应用步长：将浮点数速度四舍五入到最近的 SPEED_STEP 的倍数
    final_speed_data = np.round(speed_data_float / SPEED_STEP) * SPEED_STEP

    # 4.4. 最终限制速度范围并转换为整数
    final_speed_data = np.clip(final_speed_data, MIN_SPEED, MAX_SPEED).astype(int)

    # --- 5. 整合数据并输出到CSV文件 ---
    output_df = pd.DataFrame({
        'speed': final_speed_data,
        'angle': np.round(final_angle_data, 2), 
    })

    output_filename = 'driving_curve_final_smooth_simulation.csv'
    output_df.to_csv(output_filename, index=False)

    # --- 6. 打印结果信息 ---
    print(f"成功生成 {DATA_POINTS} 行模拟行车数据并保存到 {output_filename}")
    print(f"转弯频率由 {BASE_ANCHOR_COUNT} 个关键点控制")
    print(f"直行区域通过角度 < {ZERO_THRESHOLD}° 的软阈值创建")
    print("-" * 30)
    print(f"实际速度值的唯一列表: {np.sort(output_df['speed'].unique())}")
    zero_angle_count = (output_df['angle'] == 0).sum()
    print(f"角度为 0.00 的数量: {zero_angle_count} (占总数的 {zero_angle_count / DATA_POINTS * 100:.2f}%)")

if __name__ == "__main__":
    start_mock('driving_curve_smooth_less_frequent_simulation.csv')