import React from "react";
import { Send, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

interface MessagePanelProps {
  isConnected: boolean;
  sendId: string;
  sendData: string;
  onSendIdChange: (id: string) => void;
  onSendDataChange: (data: string) => void;
  onSendMessage: () => void;
  onClearMessages: () => void;
}

export const MessagePanel: React.FC<MessagePanelProps> = ({
  isConnected,
  sendId,
  sendData,
  onSendIdChange,
  onSendDataChange,
  onSendMessage,
  onClearMessages,
}) => {
  return (
    <div>
      <h3 className="text-sm font-semibold text-gray-800 mb-3">测试发送消息</h3>
      <div className="space-y-2">
        {/* CAN ID and Data in one row */}
        <div className="flex gap-3">
          <div className="flex-1">
            <Label htmlFor="can-id" className="text-xs font-medium mb-1 block">
              CAN ID (HEX)
            </Label>
            <Input
              id="can-id"
              type="text"
              value={sendId}
              onChange={(e) => onSendIdChange(e.target.value)}
              placeholder="123"
              disabled={!isConnected}
              className="h-8 text-xs font-mono"
            />
          </div>

          <div className="flex-1">
            <Label
              htmlFor="can-data"
              className="text-xs font-medium mb-1 block"
            >
              CAN DATA (HEX)
            </Label>
            <Input
              id="can-data"
              type="text"
              value={sendData}
              onChange={(e) => onSendDataChange(e.target.value)}
              placeholder="01 02 03 04"
              disabled={!isConnected}
              className="h-8 text-xs font-mono"
            />
          </div>
          {/* Send and Clear buttons in one row */}
          <div className="flex gap-2 items-end">
            <Button
              onClick={() => {
                console.log("📤 Send button clicked");
                onSendMessage();
              }}
              disabled={!isConnected}
              size="sm"
              className="h-8 text-xs"
            >
              <Send className="w-3 h-3 mr-1" />
              发送
            </Button>

            <Button
              onClick={onClearMessages}
              variant="outline"
              size="sm"
              className="h-8 text-xs"
            >
              <Trash2 className="w-3 h-3 mr-1" />
              清空
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
};
