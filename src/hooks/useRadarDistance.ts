import { useState, useCallback } from "react";
import { listen } from "@tauri-apps/api/event";
import { RadarDistances, RadarData, RadarMessage } from "../types";

// 雷达CAN ID映射（8位十六进制格式）
const RADAR_CAN_IDS = {
  RADAR_1: "0x00000521",
  RADAR_2: "0x00000522",
  RADAR_3: "0x00000523",
  RADAR_4: "0x00000524",
};

export const useRadarDistance = () => {
  const [radarDistances, setRadarDistances] = useState<RadarDistances>({
    radar1: null,
    radar2: null,
    radar3: null,
    radar4: null,
    lastUpdate: new Date().toLocaleTimeString(),
  });

  const [isListening, setIsListening] = useState(false);

  // 将16进制数据转换为距离值（mm）
  // 例如：0x01 83 02 02 F2 -> 取最后两个字节 02 F2 -> 0x02F2 = 754mm
  const parseDistanceFromData = (data: string): number => {
    try {
      // 移除空格并转换为大写
      const cleanData = data.replace(/\s+/g, "").toUpperCase();
      console.log("📏 [Radar] Raw data:", data, "Clean data:", cleanData);

      // 获取最后4个字符（最后两个字节）
      if (cleanData.length >= 4) {
        const lastTwoBytes = cleanData.slice(-4);
        const distance = parseInt(lastTwoBytes, 16);
        console.log(
          "📏 [Radar] Last two bytes:",
          lastTwoBytes,
          "Distance:",
          distance,
          "mm"
        );
        return distance;
      }
      console.warn("⚠️  [Radar] Data too short:", cleanData);
      return 0;
    } catch (error) {
      console.error("❌ [Radar] Error parsing distance from data:", error);
      return 0;
    }
  };

  // 处理接收到的雷达消息
  const handleRadarMessage = useCallback((message: RadarMessage) => {
    const distance = parseDistanceFromData(message.data);
    const timestamp = new Date().toLocaleTimeString();

    console.log(
      "📡 [Radar Handler] Received message - ID:",
      message.canId,
      "Distance:",
      distance
    );

    const radarData: RadarData = {
      id: message.canId,
      distance,
      rawData: message.data,
      timestamp,
    };

    setRadarDistances((prev) => {
      let updated = prev;
      let hasChanged = false;

      // 根据CAN ID更新对应的雷达数据
      if (message.canId === RADAR_CAN_IDS.RADAR_1) {
        // console.log("✅ [Radar] Updating RADAR_1");
        if (prev.radar1?.distance !== distance) {
          updated = { ...prev, radar1: radarData };
          hasChanged = true;
        }
      } else if (message.canId === RADAR_CAN_IDS.RADAR_2) {
        // console.log("✅ [Radar] Updating RADAR_2");
        if (prev.radar2?.distance !== distance) {
          updated = { ...prev, radar2: radarData };
          hasChanged = true;
        }
      } else if (message.canId === RADAR_CAN_IDS.RADAR_3) {
        // console.log("✅ [Radar] Updating RADAR_3");
        if (prev.radar3?.distance !== distance) {
          updated = { ...prev, radar3: radarData };
          hasChanged = true;
        }
      } else if (message.canId === RADAR_CAN_IDS.RADAR_4) {
        // console.log("✅ [Radar] Updating RADAR_4");
        if (prev.radar4?.distance !== distance) {
          updated = { ...prev, radar4: radarData };
          hasChanged = true;
        }
      } else {
        console.warn("⚠️  [Radar] Unknown radar ID:", message.canId);
      }

      // 只有当数据实际改变时才返回新对象
      return hasChanged ? updated : prev;
    });
  }, []);

  // 启动监听雷达消息
  const startListening = useCallback(async () => {
    try {
      // 监听来自Rust后端的雷达消息事件
      const unlisten = await listen<RadarMessage>("radar-message", (event) => {
        handleRadarMessage(event.payload);
      });

      setIsListening(true);
      console.log("✅ Started listening for radar messages");

      // 返回取消监听函数
      return unlisten;
    } catch (error) {
      console.error("❌ Failed to start listening for radar messages:", error);
      setIsListening(false);
    }
  }, [handleRadarMessage]);

  // 停止监听
  const stopListening = useCallback(async (unlisten?: () => void) => {
    if (unlisten) {
      unlisten();
    }
    setIsListening(false);
    console.log("⏹️  Stopped listening for radar messages");
  }, []);

  // 清空雷达数据
  const clearRadarData = useCallback(() => {
    setRadarDistances({
      radar1: null,
      radar2: null,
      radar3: null,
      radar4: null,
      lastUpdate: new Date().toLocaleTimeString(),
    });
  }, []);

  // 获取所有雷达的距离值
  const getAllDistances = useCallback(() => {
    return {
      radar1: radarDistances.radar1?.distance ?? null,
      radar2: radarDistances.radar2?.distance ?? null,
      radar3: radarDistances.radar3?.distance ?? null,
      radar4: radarDistances.radar4?.distance ?? null,
    };
  }, [radarDistances]);

  return {
    radarDistances,
    isListening,
    startListening,
    stopListening,
    clearRadarData,
    getAllDistances,
    RADAR_CAN_IDS,
  };
};
