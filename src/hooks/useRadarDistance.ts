import { useState, useCallback } from "react";
import { listen } from "@tauri-apps/api/event";
import { RadarDistances, RadarData, RadarMessage } from "../types";

// 雷达CAN ID映射
const RADAR_CAN_IDS = {
  RADAR_1: "0x0521",
  RADAR_2: "0x0522",
  RADAR_3: "0x0523",
  RADAR_4: "0x0524",
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
      console.log("data received", data);
      // 移除空格并转换为大写
      const cleanData = data.replace(/\s+/g, "").toUpperCase();

      // 获取最后4个字符（最后两个字节）
      if (cleanData.length >= 4) {
        const lastTwoBytes = cleanData.slice(-4);
        const distance = parseInt(lastTwoBytes, 16);
        return distance;
      }
      return 0;
    } catch (error) {
      console.error("Error parsing distance from data:", error);
      return 0;
    }
  };

  // 处理接收到的雷达消息
  const handleRadarMessage = useCallback((message: RadarMessage) => {
    const distance = parseDistanceFromData(message.data);
    const timestamp = new Date().toLocaleTimeString();

    const radarData: RadarData = {
      id: message.canId,
      distance,
      rawData: message.data,
      timestamp,
    };

    setRadarDistances((prev) => {
      const updated = { ...prev, lastUpdate: timestamp };

      // 根据CAN ID更新对应的雷达数据
      if (message.canId === RADAR_CAN_IDS.RADAR_1) {
        updated.radar1 = radarData;
      } else if (message.canId === RADAR_CAN_IDS.RADAR_2) {
        updated.radar2 = radarData;
      } else if (message.canId === RADAR_CAN_IDS.RADAR_3) {
        updated.radar3 = radarData;
      } else if (message.canId === RADAR_CAN_IDS.RADAR_4) {
        updated.radar4 = radarData;
      }

      return updated;
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
      console.log("Started listening for radar messages");

      // 返回取消监听函数
      return unlisten;
    } catch (error) {
      console.error("Failed to start listening for radar messages:", error);
      setIsListening(false);
    }
  }, [handleRadarMessage]);

  // 停止监听
  const stopListening = useCallback(async (unlisten?: () => void) => {
    if (unlisten) {
      unlisten();
    }
    setIsListening(false);
    console.log("Stopped listening for radar messages");
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
