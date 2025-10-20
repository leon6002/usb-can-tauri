import React, { useRef, useMemo } from "react";
import { FileUp, RefreshCwOff, RefreshCw } from "lucide-react";
import { SerialConfig } from "../../types";
import { extractVehicleStatus } from "../../types/vehicleControl";

interface ConnectionPanelProps {
  isConnected: boolean;
  config: SerialConfig;
  availablePorts: string[];
  onConfigChange: (config: SerialConfig) => void;
  onConnect: () => void;
}

export const ConnectionPanel: React.FC<ConnectionPanelProps> = ({
  isConnected,
  config,
  // availablePorts,
  onConfigChange,
  onConnect,
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      try {
        // 读取文件内容
        const content = await file.text();

        // 保存文件名和内容
        onConfigChange({
          ...config,
          csvFilePath: file.name,
          csvContent: content,
        });
      } catch (error) {
        console.error("Failed to read CSV file:", error);
        alert("读取 CSV 文件失败");
      }
    }
  };

  // 解析 CSV 并获取指定行指定列的数据
  const getColumnPreview = (
    csvContent: string | undefined,
    columnIndex: number,
    rowIndex: number
  ): string => {
    if (!csvContent) return "未选择文件";

    try {
      const lines = csvContent.trim().split("\n");
      if (lines.length === 0) return "CSV 文件为空";

      if (rowIndex >= lines.length) {
        return `行索引超出范围 (最多 ${lines.length - 1})`;
      }

      const targetLine = lines[rowIndex];
      const columns = targetLine.split(",").map((col) => col.trim());

      if (columnIndex >= columns.length) {
        return `列索引超出范围 (最多 ${columns.length - 1})`;
      }

      return columns[columnIndex] || "无数据";
    } catch (error) {
      return "解析失败";
    }
  };

  // 获取指定行的数据
  const getRowData = (
    csvContent: string | undefined,
    rowIndex: number
  ): string => {
    if (!csvContent) return "未选择文件";

    try {
      const lines = csvContent.trim().split("\n");
      if (lines.length === 0) return "CSV 文件为空";

      if (rowIndex >= lines.length) {
        return `行索引超出范围 (最多 ${lines.length - 1})`;
      }

      return lines[rowIndex] || "无数据";
    } catch (error) {
      return "解析失败";
    }
  };

  // 获取 CSV 文件的总行数
  const getTotalRows = (csvContent: string | undefined): number => {
    if (!csvContent) return 0;
    try {
      const lines = csvContent.trim().split("\n");
      return lines.length;
    } catch (error) {
      return 0;
    }
  };

  // 使用 useMemo 缓存预览数据
  const startRowIndex = config.csvStartRowIndex || 0;

  const rowPreview = useMemo(
    () => getRowData(config.csvContent, startRowIndex),
    [config.csvContent, startRowIndex]
  );

  const canIdPreview = useMemo(
    () =>
      getColumnPreview(
        config.csvContent,
        config.canIdColumnIndex || 0,
        startRowIndex
      ),
    [config.csvContent, config.canIdColumnIndex, startRowIndex]
  );

  const canDataPreview = useMemo(
    () =>
      getColumnPreview(
        config.csvContent,
        config.canDataColumnIndex || 1,
        startRowIndex
      ),
    [config.csvContent, config.canDataColumnIndex, startRowIndex]
  );

  // 解析 CAN DATA 预览数据（使用新的8字节协议）
  const parsedVehicleStatus = useMemo(() => {
    try {
      if (
        !canDataPreview ||
        canDataPreview.startsWith("未选择") ||
        canDataPreview.startsWith("行索引") ||
        canDataPreview.startsWith("列索引") ||
        canDataPreview.startsWith("无数据") ||
        canDataPreview.startsWith("解析失败")
      ) {
        return null;
      }
      return extractVehicleStatus(canDataPreview);
    } catch (error) {
      console.error("Failed to parse vehicle status:", error);
      return null;
    }
  }, [canDataPreview]);

  return (
    <div className="p-3 overflow-y-auto max-h-[calc(100vh-20px)]">
      <h3 className="text-sm font-semibold text-gray-800 mb-2">连接配置</h3>

      <div className="space-y-2">
        <div>
          <label className="block text-xs font-medium text-gray-700 mb-1">
            串口
          </label>
          <input
            type="text"
            value={config.port}
            onChange={(e) =>
              onConfigChange({ ...config, port: e.target.value })
            }
            className="w-full px-2 py-1 text-xs border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500"
            placeholder="COM23"
            disabled={isConnected}
          />
        </div>

        <div className="grid grid-cols-2 gap-2">
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">
              串口波特率
            </label>
            <input
              type="number"
              value={config.baudRate}
              onChange={(e) =>
                onConfigChange({
                  ...config,
                  baudRate: parseInt(e.target.value) || 2000000,
                })
              }
              className="w-full px-2 py-1 text-sm border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500"
              disabled={isConnected}
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">
              CAN波特率
            </label>
            <input
              type="number"
              value={config.canBaudRate}
              onChange={(e) =>
                onConfigChange({
                  ...config,
                  canBaudRate: parseInt(e.target.value) || 500000,
                })
              }
              className="w-full px-2 py-1 text-sm border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500"
              disabled={isConnected}
            />
          </div>
        </div>

        <div
          className={`grid gap-2 ${
            config.protocolLength === "fixed" ? "grid-cols-2" : "grid-cols-3"
          }`}
        >
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">
              协议长度
            </label>
            <select
              value={config.protocolLength}
              onChange={(e) =>
                onConfigChange({ ...config, protocolLength: e.target.value })
              }
              className="w-full px-2 py-1 text-sm border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500"
              disabled={isConnected}
            >
              <option value="fixed">FIXED（固定20字节）</option>
              <option value="variable">VARIABLE（可变）</option>
            </select>
          </div>
          {config.protocolLength !== "fixed" && (
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">
                帧类型
              </label>
              <select
                value={config.frameType}
                onChange={(e) =>
                  onConfigChange({ ...config, frameType: e.target.value })
                }
                className="w-full px-2 py-1 text-sm border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500"
                disabled={isConnected}
              >
                <option value="standard">标准帧</option>
                <option value="extended">扩展帧</option>
              </select>
            </div>
          )}
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">
              CAN模式
            </label>
            <select
              value={config.canMode}
              onChange={(e) =>
                onConfigChange({ ...config, canMode: e.target.value })
              }
              className="w-full px-2 py-1 text-sm border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500"
              disabled={isConnected}
            >
              <option value="normal">正常模式</option>
              <option value="loopback">回环模式</option>
              <option value="listen">监听模式</option>
            </select>
          </div>
        </div>

        {/* CSV Configuration Section */}
        <div className="border-t pt-2 mt-2">
          <h4 className="text-xs font-semibold text-gray-700 mb-2">
            行驶数据配置
          </h4>

          <div className="space-y-2">
            {/* CSV File Selection */}
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">
                CSV文件
              </label>
              <div className="flex gap-2">
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".csv"
                  onChange={handleFileSelect}
                  className="hidden"
                />
                <button
                  onClick={() => fileInputRef.current?.click()}
                  className="flex-1 px-2 py-1 text-xs border border-gray-300 rounded bg-white hover:bg-gray-50 text-gray-700 font-medium transition-colors flex items-center justify-center gap-1"
                >
                  <FileUp className="w-3 h-3" />
                  {config.csvFilePath ? "已选择" : "选择"}
                </button>
                {config.csvFilePath && (
                  <span className="flex-1 px-2 py-1 text-xs bg-blue-50 border border-blue-200 rounded text-blue-700 truncate">
                    {config.csvFilePath}
                  </span>
                )}
              </div>
              {config.csvContent && (
                <div className="mt-1 px-2 py-1 text-xs bg-gray-50 border border-gray-200 rounded text-gray-600">
                  <div className="flex justify-between items-center gap-2">
                    <span>📊总行数: {getTotalRows(config.csvContent)}</span>
                    <span>
                      📝数据行数：{" "}
                      {Math.max(
                        0,
                        getTotalRows(config.csvContent) -
                          (config.csvStartRowIndex || 0)
                      )}
                    </span>
                  </div>
                </div>
              )}
            </div>

            {/* Send Interval */}
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">
                发送间隔 (ms)
              </label>
              <input
                type="number"
                value={config.sendIntervalMs || 20}
                onChange={(e) =>
                  onConfigChange({
                    ...config,
                    sendIntervalMs: parseInt(e.target.value) || 20,
                  })
                }
                className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="20"
                min="1"
              />
            </div>

            {/* Start Row Index */}
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">
                开始行 (0=第一行，1=跳过header)
              </label>
              <input
                type="number"
                value={config.csvStartRowIndex || 0}
                onChange={(e) =>
                  onConfigChange({
                    ...config,
                    csvStartRowIndex: parseInt(e.target.value) || 0,
                  })
                }
                className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="0"
                min="0"
              />
              <div className="mt-1 px-2 py-1 text-xs bg-gray-50 border border-gray-200 rounded text-gray-600">
                预览:{" "}
                <span className="font-mono font-semibold text-gray-800">
                  {rowPreview}
                </span>
              </div>
            </div>

            {/* Column Indices */}
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">
                  CAN ID列
                </label>
                <input
                  type="number"
                  value={config.canIdColumnIndex || 0}
                  onChange={(e) =>
                    onConfigChange({
                      ...config,
                      canIdColumnIndex: parseInt(e.target.value) || 0,
                    })
                  }
                  className="w-full px-2 py-1 text-sm border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500"
                  placeholder="0"
                  min="0"
                />
                <div className="mt-1 px-2 py-1 text-xs bg-gray-50 border border-gray-200 rounded text-gray-600">
                  预览:{" "}
                  <span className="font-mono font-semibold text-gray-800">
                    {canIdPreview}
                  </span>
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">
                  CAN Data列
                </label>
                <input
                  type="number"
                  value={config.canDataColumnIndex || 1}
                  onChange={(e) =>
                    onConfigChange({
                      ...config,
                      canDataColumnIndex: parseInt(e.target.value) || 1,
                    })
                  }
                  className="w-full px-2 py-1 text-sm border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500"
                  placeholder="1"
                  min="0"
                />
                <div className="mt-1 px-2 py-1 text-xs bg-gray-50 border border-gray-200 rounded text-gray-600">
                  预览:{" "}
                  <span className="font-mono font-semibold text-gray-800">
                    {canDataPreview}
                  </span>
                </div>
              </div>
            </div>
            <div className="grid grid-cols-1">
              {/* 解析结果预览 */}
              {parsedVehicleStatus && (
                <div className="mt-2 px-2 py-2 text-xs bg-green-50 border border-green-200 rounded text-green-700 space-y-2">
                  <div className="font-semibold">✓ CAN Data解析成功</div>
                  <div>
                    档位:{" "}
                    <span className="font-mono font-bold">
                      {parsedVehicleStatus.gearName}
                    </span>
                  </div>
                  <div>
                    速度:{" "}
                    <span className="font-mono font-bold">
                      {(parsedVehicleStatus.speed * 0.001).toFixed(3)}
                    </span>{" "}
                    m/s
                  </div>
                  <div>
                    转向角:{" "}
                    <span className="font-mono font-bold">
                      {parsedVehicleStatus.steeringAngle.toFixed(2)}
                    </span>{" "}
                    ° (
                    <span className="font-mono font-bold">
                      {(
                        (parsedVehicleStatus.steeringAngle * Math.PI) /
                        180
                      ).toFixed(4)}
                    </span>
                    {" rad)"})
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        <button
          onClick={onConnect}
          className={`w-full px-3 py-3 rounded text-xs font-medium transition-colors ${
            isConnected
              ? "bg-red-600 hover:bg-red-700 text-white"
              : "bg-green-600 hover:bg-green-700 text-white"
          }`}
        >
          {isConnected ? (
            <>
              <RefreshCwOff className="w-3 h-3 inline mr-1" />
              断开
            </>
          ) : (
            <>
              <RefreshCw className="w-3 h-3 inline mr-1" />
              连接
            </>
          )}
        </button>
      </div>
    </div>
  );
};
