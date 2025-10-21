import numpy as np
import pandas as pd
from scipy.interpolate import make_interp_spline
from scipy.signal import savgol_filter
import math

def start_mock(output_filename='driving_data_final_version_speed_to_zero.csv'):

    # --- 参数设定 ---
    DATA_POINTS = 4000  # 总数据量
    MAX_ANGLE = 60      # 最大转向角范围
    MIN_SPEED_TARGET = 0 # 【关键修正】: 目标最低速度设置为 0
    DISPLAY_MIN_SPEED = 1000 # 仅用于打印显示的速度最小值，不参与计算
    MAX_SPEED = 3000    # 最大速度 (必须是 SPEED_STEP 的倍数)
    SPEED_STEP = 100    # 速度的步长设置
    
    # 控制转弯稀疏度和缓慢度的关键参数
    BASE_ANCHOR_COUNT = 10 # 减少总转弯次数
    SMOOTHING_WINDOW = 401 # 增大每次转弯耗时，窗口越大，转弯越慢
    ZERO_THRESHOLD = 1.0  # 角度绝对值小于此阈值的将被平滑拉向 0，创建直行区
    FINAL_SMOOTH_WINDOW = 9 # 修复软阈值归零带来的局部跳变

    # 确保 MAX_SPEED 是 SPEED_STEP 的有效倍数
    if MAX_SPEED % SPEED_STEP != 0:
        print("警告：MAX_SPEED 应是 SPEED_STEP 的倍数。")
        
    # --- 停止区设定 ---
    STOP_PERCENTAGE = 0.30             # 最后 10% 的数据用于缓慢停止
    STOP_POINTS = int(DATA_POINTS * STOP_PERCENTAGE)
    STOP_START_INDEX = DATA_POINTS - STOP_POINTS

    # --- 1. 生成基础的、全局平滑的曲线（角度） ---
    np.random.seed(42) 
    
    # 生成关键点
    anchor_angles = np.random.uniform(-MAX_ANGLE * 0.8, MAX_ANGLE * 0.8, BASE_ANCHOR_COUNT) 
    
    # 强制开头和结尾
    INITIAL_STRAIGHT_ANCHORS = 5 
    anchor_angles[:INITIAL_STRAIGHT_ANCHORS] = 0.0
    anchor_angles[-1] = 0.0 

    # 三次样条插值
    x_anchor = np.linspace(0, 1, len(anchor_angles))
    x_full = np.linspace(0, 1, DATA_POINTS)
    spline = make_interp_spline(x_anchor, anchor_angles)
    raw_angle_data = spline(x_full)
    
    # 全局 Savitzky-Golay 平滑
    window_len = min(SMOOTHING_WINDOW, DATA_POINTS // 2 * 2 + 1)
    if window_len % 2 == 0: window_len -= 1
    if window_len < 3: window_len = 3
    
    raw_angle_data = savgol_filter(raw_angle_data, window_len, 3) 
    raw_angle_data = np.clip(raw_angle_data, -MAX_ANGLE, MAX_ANGLE)

    
    # --- 2. 创建平滑的直行区域 (软阈值归零) ---
    final_angle_data = np.copy(raw_angle_data)
    small_angle_mask = np.abs(final_angle_data) < ZERO_THRESHOLD
    
    if np.any(small_angle_mask):
        decay_factor = np.abs(final_angle_data[small_angle_mask]) / ZERO_THRESHOLD
        final_angle_data[small_angle_mask] = final_angle_data[small_angle_mask] * decay_factor

    # --- 3. 消除软阈值导致的局部跳变 (最终平滑修复) ---
    final_window_len = FINAL_SMOOTH_WINDOW
    if final_window_len % 2 == 0: final_window_len -= 1
    if final_window_len < 3: final_window_len = 3
    
    final_angle_data = pd.Series(final_angle_data).rolling(
        window=final_window_len, 
        center=True, 
        min_periods=1
    ).mean().values
    
    
    # --- 4. 停止区：角度平稳归零 ---
    angle_decay_factor = np.linspace(1.0, 0.0, STOP_POINTS)
    final_angle_data[STOP_START_INDEX:] = final_angle_data[STOP_START_INDEX:] * angle_decay_factor


    # --- 5. 生成速度数据 (与角度关联，并应用步长) ---
    
    # 5.1 基础速度计算（浮点数）
    normalized_angle_abs = np.abs(final_angle_data) / MAX_ANGLE
    straightness_factor = (1 - normalized_angle_abs)
    
    # 速度范围现在是从 MIN_SPEED_TARGET (0) 到 MAX_SPEED
    speed_range = MAX_SPEED - MIN_SPEED_TARGET
    raw_speed_data = MIN_SPEED_TARGET + speed_range * straightness_factor
    speed_noise = np.random.normal(0, 50, DATA_POINTS) 
    speed_data_float = raw_speed_data + speed_noise

    # 5.2 处理停止区：速度平稳下降到 MIN_SPEED_TARGET (0)
    last_speed_before_stop = speed_data_float[STOP_START_INDEX - 1] if STOP_START_INDEX > 0 else MAX_SPEED
    
    # 【关键修正】：确保目标速度为 0
    speed_decay_factor = np.linspace(last_speed_before_stop, MIN_SPEED_TARGET, STOP_POINTS)
    speed_data_float[STOP_START_INDEX:] = speed_decay_factor

    # 5.3 应用步长
    final_speed_data = np.round(speed_data_float / SPEED_STEP) * SPEED_STEP
    
    # 5.4 最终限制速度范围并转换为整数，确保速度不低于 0
    final_speed_data = np.clip(final_speed_data, MIN_SPEED_TARGET, MAX_SPEED).astype(int)
    
    # --- 6. 整合数据并输出到CSV文件 ---
    output_df = pd.DataFrame({
        'speed': final_speed_data,
        'angle': np.round(final_angle_data, 2), 
    })

    output_df.to_csv(output_filename, index=False)

    # --- 7. 打印结果信息 ---
    print(f"成功生成 {DATA_POINTS} 行模拟行车数据并保存到 {output_filename}")
    print(f"总转弯次数由 {BASE_ANCHOR_COUNT} 个关键点控制")
    print(f"每次转弯耗时由 {window_len} 的全局平滑窗口控制")
    print("-" * 30)
    print(f"实际速度值的唯一列表: {np.sort(output_df['speed'].unique())}")
    zero_angle_count = (output_df['angle'] == 0).sum()
    print(f"角度为 0.00 的数量: {zero_angle_count} (占总数的 {zero_angle_count / DATA_POINTS * 100:.2f}%)")

if __name__ == "__main__":
    start_mock()