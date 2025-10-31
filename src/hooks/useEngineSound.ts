import { useEffect, useRef } from "react";

/**
 * 引擎声音管理 Hook
 * 根据行驶状态和速度控制引擎声音的播放和音量
 * 使用双缓冲技术实现无缝循环
 */
export const useEngineSound = (
  isDriving: boolean,
  currentSpeed: number // mm/s
) => {
  const audio1Ref = useRef<HTMLAudioElement | null>(null);
  const audio2Ref = useRef<HTMLAudioElement | null>(null);
  const currentAudioRef = useRef<1 | 2>(1); // 当前播放的是哪个音频
  const fadeIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const fadeInterval1Ref = useRef<NodeJS.Timeout | null>(null); // audio1 的淡出定时器
  const fadeInterval2Ref = useRef<NodeJS.Timeout | null>(null); // audio2 的淡出定时器
  const isInitializedRef = useRef(false);
  const isDrivingRef = useRef(isDriving); // 使用 ref 保存最新的 isDriving 状态

  // 更新 isDrivingRef
  useEffect(() => {
    isDrivingRef.current = isDriving;
  }, [isDriving]);

  // 初始化双音频缓冲
  useEffect(() => {
    const audioPath = "/sound/inside-car-noise-while-driving-29978.mp3";

    console.log("🎵 Initializing engine sound system...");

    // 创建两个音频实例
    const audio1 = new Audio(audioPath);
    const audio2 = new Audio(audioPath);

    // 配置音频属性
    [audio1, audio2].forEach((audio, index) => {
      audio.preload = "auto"; // 预加载
      audio.volume = 0; // 初始音量为 0

      // 添加加载事件监听
      audio.addEventListener("canplaythrough", () => {
        console.log(`✅ Audio ${index + 1} loaded and ready to play`);
      });

      audio.addEventListener("error", (e) => {
        console.error(`❌ Audio ${index + 1} failed to load:`, e);
      });
    });

    audio1Ref.current = audio1;
    audio2Ref.current = audio2;

    // 监听第一个音频的播放进度，在快结束时启动第二个
    const handleTimeUpdate1 = () => {
      if (!audio1.duration) return;
      const timeLeft = audio1.duration - audio1.currentTime;

      // 在结束前 0.1 秒启动第二个音频
      if (timeLeft <= 0.1 && timeLeft > 0.05 && currentAudioRef.current === 1) {
        if (audio2.paused && isDrivingRef.current) {
          audio2.currentTime = 0;
          audio2.volume = audio1.volume; // 同步音量
          audio2.play().catch((error) => {
            console.error("Failed to play audio2:", error);
          });
          currentAudioRef.current = 2;
        }
      }
    };

    // 监听第二个音频的播放进度，在快结束时启动第一个
    const handleTimeUpdate2 = () => {
      if (!audio2.duration) return;
      const timeLeft = audio2.duration - audio2.currentTime;

      // 在结束前 0.1 秒启动第一个音频
      if (timeLeft <= 0.1 && timeLeft > 0.05 && currentAudioRef.current === 2) {
        if (audio1.paused && isDrivingRef.current) {
          audio1.currentTime = 0;
          audio1.volume = audio2.volume; // 同步音量
          audio1.play().catch((error) => {
            console.error("Failed to play audio1:", error);
          });
          currentAudioRef.current = 1;
        }
      }
    };

    // 当音频结束时停止播放
    const handleEnded1 = () => {
      audio1.pause();
      audio1.currentTime = 0;
    };

    const handleEnded2 = () => {
      audio2.pause();
      audio2.currentTime = 0;
    };

    audio1.addEventListener("timeupdate", handleTimeUpdate1);
    audio2.addEventListener("timeupdate", handleTimeUpdate2);
    audio1.addEventListener("ended", handleEnded1);
    audio2.addEventListener("ended", handleEnded2);

    isInitializedRef.current = true;
    console.log("✅ Engine sound system initialized");

    return () => {
      // 清理：停止播放并释放资源
      [audio1, audio2].forEach((audio) => {
        audio.pause();
        audio.src = "";
      });

      audio1.removeEventListener("timeupdate", handleTimeUpdate1);
      audio2.removeEventListener("timeupdate", handleTimeUpdate2);
      audio1.removeEventListener("ended", handleEnded1);
      audio2.removeEventListener("ended", handleEnded2);

      audio1Ref.current = null;
      audio2Ref.current = null;

      // 清理所有定时器
      if (fadeIntervalRef.current) {
        clearInterval(fadeIntervalRef.current);
      }
      if (fadeInterval1Ref.current) {
        clearInterval(fadeInterval1Ref.current);
      }
      if (fadeInterval2Ref.current) {
        clearInterval(fadeInterval2Ref.current);
      }
    };
  }, []);

  // 根据行驶状态控制播放/停止
  useEffect(() => {
    if (!isInitializedRef.current) return;

    const audio1 = audio1Ref.current;
    const audio2 = audio2Ref.current;
    if (!audio1 || !audio2) return;

    if (isDriving) {
      // 开始行驶：播放第一个音频并设置初始音量
      console.log("🔊 Starting engine sound, isDriving:", isDriving);
      currentAudioRef.current = 1;
      audio1.currentTime = 0;
      audio1.volume = 0.3; // 设置初始音量（从 0.1 提高到 0.3）
      audio1
        .play()
        .then(() => {
          console.log(
            "✅ Audio1 started playing successfully, volume:",
            audio1.volume
          );
        })
        .catch((error: Error) => {
          console.error("❌ Failed to play engine sound:", error);
        });
    } else {
      // 停止行驶：淡出并停止所有音频
      console.log("🔇 Stopping engine sound");
      fadeOut(audio1, fadeInterval1Ref, () => {
        console.log("🛑 Audio1 paused");
        audio1.pause();
        audio1.currentTime = 0;
      });
      fadeOut(audio2, fadeInterval2Ref, () => {
        console.log("🛑 Audio2 paused");
        audio2.pause();
        audio2.currentTime = 0;
      });
    }
  }, [isDriving]);

  // 根据速度调整音量（同时调整两个音频的音量）
  useEffect(() => {
    if (!isInitializedRef.current) return;

    const audio1 = audio1Ref.current;
    const audio2 = audio2Ref.current;
    if (!audio1 || !audio2 || !isDriving) return;

    // 速度范围：0 - 3000 mm/s (0 - 3 m/s)
    // 音量范围：0.3 - 1.0（调大音量范围）
    const minVolume = 0.3; // 最小音量从 0.1 提高到 0.3
    const maxVolume = 1.0; // 最大音量从 0.8 提高到 1.0
    const maxSpeed = 3000; // mm/s

    // 计算音量：速度越快，音量越大
    const normalizedSpeed = Math.min(currentSpeed / maxSpeed, 1); // 归一化到 0-1
    const targetVolume = minVolume + normalizedSpeed * (maxVolume - minVolume);

    // 平滑过渡两个音频的音量
    smoothVolumeTransition(audio1, targetVolume, 200); // 200ms 过渡时间
    smoothVolumeTransition(audio2, targetVolume, 200);
  }, [currentSpeed, isDriving]);

  /**
   * 平滑音量过渡
   */
  const smoothVolumeTransition = (
    audio: HTMLAudioElement,
    targetVolume: number,
    duration: number
  ) => {
    if (fadeIntervalRef.current) {
      clearInterval(fadeIntervalRef.current);
    }

    const startVolume = audio.volume;
    const volumeDiff = targetVolume - startVolume;
    const steps = 10; // 分 10 步过渡
    const stepDuration = duration / steps;
    const stepSize = volumeDiff / steps;

    let currentStep = 0;

    fadeIntervalRef.current = setInterval(() => {
      currentStep++;
      if (currentStep >= steps) {
        audio.volume = Math.max(0, Math.min(1, targetVolume));
        if (fadeIntervalRef.current) {
          clearInterval(fadeIntervalRef.current);
          fadeIntervalRef.current = null;
        }
      } else {
        audio.volume = Math.max(
          0,
          Math.min(1, startVolume + stepSize * currentStep)
        );
      }
    }, stepDuration);
  };

  /**
   * 淡出效果（为每个音频使用独立的定时器）
   */
  const fadeOut = (
    audio: HTMLAudioElement,
    fadeIntervalRef: { current: NodeJS.Timeout | null },
    onComplete?: () => void
  ) => {
    if (fadeIntervalRef.current) {
      clearInterval(fadeIntervalRef.current);
    }

    const startVolume = audio.volume;
    const steps = 10;
    const stepDuration = 300 / steps; // 300ms 淡出
    const stepSize = startVolume / steps;

    let currentStep = 0;

    console.log(`🔇 Starting fadeOut from volume ${startVolume}`);

    fadeIntervalRef.current = setInterval(() => {
      currentStep++;
      if (currentStep >= steps) {
        audio.volume = 0;
        if (fadeIntervalRef.current) {
          clearInterval(fadeIntervalRef.current);
          fadeIntervalRef.current = null;
        }
        console.log(`✅ FadeOut complete, calling onComplete`);
        if (onComplete) {
          onComplete();
        }
      } else {
        audio.volume = Math.max(0, startVolume - stepSize * currentStep);
      }
    }, stepDuration);
  };
};
