export const validateCanId = (
  id: string,
  frameType: string
): { valid: boolean; error?: string } => {
  // ... (原 useCanMessages 中的 validateCanId 逻辑)
  try {
    const idHex = id.toLowerCase().replace(/^0x/, "");
    if (!/^[0-9a-f]+$/.test(idHex)) {
      return { valid: false, error: "CAN ID 必须是有效的十六进制数" };
    }
    const canId = parseInt(idHex, 16);
    if (frameType === "standard" && canId > 0x7ff) {
      return { valid: false, error: `标准帧 CAN ID 不能超过 0x7FF` };
    } else if (frameType === "extended" && canId > 0x1fffffff) {
      return { valid: false, error: `扩展帧 CAN ID 不能超过 0x1FFFFFFF` };
    }
    return { valid: true };
  } catch (error) {
    return { valid: false, error: "CAN ID 格式错误" };
  }
};
