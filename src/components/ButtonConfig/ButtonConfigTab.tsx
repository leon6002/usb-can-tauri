import React from "react";
import { CanCommand } from "../../types";

interface ButtonConfigTabProps {
  canCommands: CanCommand[];
  onUpdateCanCommand: (
    commandId: string,
    field: keyof CanCommand,
    value: string
  ) => void;
}

export const ButtonConfigTab: React.FC<ButtonConfigTabProps> = ({
  canCommands,
  onUpdateCanCommand,
}) => {
  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      {/* Top Status Bar */}
      <div className="bg-white border-b border-gray-200 px-6 py-3">
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-semibold text-gray-900">按钮配置</h2>
          <div className="text-sm text-gray-600">
            共 {canCommands.length} 个命令按钮
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 overflow-y-auto p-6 bg-gray-50">
        <div className="max-w-4xl mx-auto">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {canCommands.map((command) => (
              <div
                key={command.id}
                className="bg-white rounded-lg shadow-sm border border-gray-200 p-4"
              >
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      命令名称
                    </label>
                    <input
                      type="text"
                      value={command.name}
                      onChange={(e) =>
                        onUpdateCanCommand(command.id, "name", e.target.value)
                      }
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                      placeholder="输入命令名称"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        CAN ID
                      </label>
                      <input
                        type="text"
                        value={command.canId}
                        onChange={(e) =>
                          onUpdateCanCommand(
                            command.id,
                            "canId",
                            e.target.value
                          )
                        }
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm font-mono"
                        placeholder="123"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        数据
                      </label>
                      <input
                        type="text"
                        value={command.data}
                        onChange={(e) =>
                          onUpdateCanCommand(command.id, "data", e.target.value)
                        }
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm font-mono"
                        placeholder="01 02"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      描述
                    </label>
                    <textarea
                      value={command.description}
                      onChange={(e) =>
                        onUpdateCanCommand(
                          command.id,
                          "description",
                          e.target.value
                        )
                      }
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm resize-none"
                      placeholder="输入命令描述"
                      rows={2}
                    />
                  </div>

                  {/* Preview */}
                  <div className="pt-3 border-t border-gray-200">
                    <div className="text-xs text-gray-500 mb-2">预览效果:</div>
                    <button
                      disabled
                      className="w-full px-3 py-2 bg-blue-100 text-blue-700 rounded-md text-sm font-medium cursor-not-allowed"
                    >
                      {command.name || "未命名按钮"}
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Help Text */}
          <div className="mt-8 bg-blue-50 border border-blue-200 rounded-lg p-4">
            <h3 className="text-sm font-semibold text-blue-800 mb-2">
              💡 配置说明
            </h3>
            <div className="text-sm text-blue-700 space-y-1">
              <p>
                • <strong>命令名称</strong>：将显示在车辆控制页面的按钮上
              </p>
              <p>
                • <strong>CAN ID</strong>：十六进制格式，如 123、1A2B
              </p>
              <p>
                • <strong>数据</strong>：十六进制格式，空格分隔，如 01 02 03
              </p>
              <p>
                • <strong>描述</strong>：命令的详细说明，便于理解功能
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
