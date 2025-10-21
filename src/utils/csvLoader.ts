/**
 * CSV 数据加载工具
 */

export interface CsvRow {
  can_id: string;
  can_data: string;
  interval_ms: number;
}

/**
 * 从 CSV 文本解析数据
 */
export function parseCsvText(csvText: string): CsvRow[] {
  const lines = csvText.trim().split("\n");
  if (lines.length === 0) {
    return [];
  }

  // 跳过标题行
  const dataLines = lines.slice(1);

  return dataLines
    .map((line) => {
      const parts = line.split(",").map((p) => p.trim());
      if (parts.length < 3) {
        return null;
      }

      return {
        can_id: parts[0],
        can_data: parts[1],
        interval_ms: parseInt(parts[2], 10),
      };
    })
    .filter((row): row is CsvRow => row !== null);
}

/**
 * 加载预置的 CSV 数据
 * @param filename 文件名（相对于 public/data/）
 */
export async function loadPresetCsv(filename: string): Promise<CsvRow[]> {
  try {
    const response = await fetch(`/data/${filename}`);
    if (!response.ok) {
      throw new Error(`Failed to load CSV: ${response.statusText}`);
    }
    const csvText = await response.text();
    return parseCsvText(csvText);
  } catch (error) {
    console.error(`Error loading preset CSV ${filename}:`, error);
    throw error;
  }
}

/**
 * 加载默认的示例数据
 */
export async function loadDefaultCsv(): Promise<CsvRow[]> {
  return loadPresetCsv("sample-trajectory.csv");
}

/**
 * 从 File 对象加载 CSV 数据
 */
export async function loadCsvFromFile(file: File): Promise<CsvRow[]> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const csvText = event.target?.result as string;
        const rows = parseCsvText(csvText);
        resolve(rows);
      } catch (error) {
        reject(error);
      }
    };
    reader.onerror = () => {
      reject(new Error("Failed to read file"));
    };
    reader.readAsText(file);
  });
}

/**
 * 获取可用的预置 CSV 文件列表
 */
export const PRESET_CSV_FILES = [
  {
    name: "sample-trajectory.csv",
    label: "示例轨迹",
    description: "预置的示例车辆轨迹数据",
  },
];

