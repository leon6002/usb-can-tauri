import { invoke } from "@tauri-apps/api/core";
import { useState, useCallback } from "react";
import { CsvLoopProgress, RoadSegment, generateRoadSegments } from "../types/vehicleControl";

interface UsePreloadCsvDataOptions {
  onSuccess?: (data: CsvLoopProgress[]) => void;
  onError?: (error: string) => void;
}

export const useCsvDataPreload = (options?: UsePreloadCsvDataOptions) => {
  const [isLoading, setIsLoading] = useState(false);
  const [csvData, setCsvData] = useState<CsvLoopProgress[]>([]);
  const [roadSegments, setRoadSegments] = useState<RoadSegment[]>([]);
  const [error, setError] = useState<string | null>(null);

  const preloadCsvData = useCallback(
    async (
      csvContent: string,
      canIdColumnIndex: number = 0,
      canDataColumnIndex: number = 1,
      csvStartRowIndex: number = 0
    ) => {
      setIsLoading(true);
      setError(null);

      try {
        console.log("📂 Preloading CSV data...");

        const data = await invoke<CsvLoopProgress[]>("preload_csv_data", {
          csv_content: csvContent,
          can_id_column_index: canIdColumnIndex,
          can_data_column_index: canDataColumnIndex,
          csv_start_row_index: csvStartRowIndex,
        });

        console.log(`✅ Preloaded ${data.length} records`);

        // 生成道路段
        const segments = generateRoadSegments(data);
        console.log(`🛣️ Generated ${segments.length} road segments`);

        setCsvData(data);
        setRoadSegments(segments);

        options?.onSuccess?.(data);

        return { data, segments };
      } catch (err) {
        const errorMsg = err instanceof Error ? err.message : String(err);
        console.error("❌ Failed to preload CSV data:", errorMsg);
        setError(errorMsg);
        options?.onError?.(errorMsg);
        throw err;
      } finally {
        setIsLoading(false);
      }
    },
    [options]
  );

  return {
    isLoading,
    csvData,
    roadSegments,
    error,
    preloadCsvData,
  };
};

