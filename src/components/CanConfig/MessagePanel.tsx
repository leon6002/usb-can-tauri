import React, { useState } from "react";
import { Send, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useSerialStore } from "@/store/serialStore";
import { useCanMessageStore } from "@/store/canMessageStore";

export const MessagePanel: React.FC = () => {
  const isConnected = useSerialStore((state) => state.isConnected);
  const [sendId, setSendId] = useState("123");
  const [sendData, setSendData] = useState("01 FF FF FF 00 00 00 00");
  const { clearMessages, handleSendMessage } = useCanMessageStore();
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
              onChange={(e) => setSendId(e.target.value)}
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
              onChange={(e) => setSendData(e.target.value)}
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
                handleSendMessage(sendId, sendData);
              }}
              disabled={!isConnected}
              size="sm"
              className="h-8 text-xs"
            >
              <Send className="w-3 h-3 mr-1" />
              发送
            </Button>

            <Button
              onClick={clearMessages}
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
