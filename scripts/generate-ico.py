#!/usr/bin/env python3

from PIL import Image
import os
import sys

def generate_ico():
    """使用 PIL 生成 ICO 文件"""
    icons_dir = os.path.join(os.path.dirname(__file__), '../src-tauri/icons')
    png_path = os.path.join(icons_dir, 'icon-256.png')
    ico_path = os.path.join(icons_dir, 'icon.ico')
    
    if not os.path.exists(png_path):
        print(f"❌ 找不到 {png_path}")
        return False
    
    try:
        # 打开 PNG 文件
        img = Image.open(png_path)
        
        # 生成多个尺寸的图标
        sizes = [(256, 256), (128, 128), (64, 64), (48, 48), (32, 32), (16, 16)]
        
        # 创建 ICO 文件（包含多个尺寸）
        img.save(ico_path, format='ICO', sizes=sizes)
        
        print(f"✅ 生成: icon.ico (多尺寸: {', '.join([f'{s[0]}x{s[1]}' for s in sizes])})")
        
        # 删除临时的 256x256 PNG
        if os.path.exists(png_path):
            os.remove(png_path)
            print(f"🗑️  删除临时文件: icon-256.png")
        
        return True
    except Exception as e:
        print(f"❌ 生成 icon.ico 失败: {e}")
        return False

if __name__ == '__main__':
    success = generate_ico()
    sys.exit(0 if success else 1)

