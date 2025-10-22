#!/usr/bin/env node

import sharp from 'sharp';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// 定义需要生成的图标尺寸
const sizes = [
  { name: '32x32.png', size: 32 },
  { name: '128x128.png', size: 128 },
  { name: '128x128@2x.png', size: 256 },
  // Windows Store 图标
  { name: 'Square30x30Logo.png', size: 30 },
  { name: 'Square44x44Logo.png', size: 44 },
  { name: 'Square71x71Logo.png', size: 71 },
  { name: 'Square89x89Logo.png', size: 89 },
  { name: 'Square107x107Logo.png', size: 107 },
  { name: 'Square142x142Logo.png', size: 142 },
  { name: 'Square150x150Logo.png', size: 150 },
  { name: 'Square284x284Logo.png', size: 284 },
  { name: 'Square310x310Logo.png', size: 310 },
  { name: 'StoreLogo.png', size: 50 },
];

const svgPath = path.join(__dirname, '../public/osyx-branco-cor.svg');
const outputDir = path.join(__dirname, '../src-tauri/icons');

// 确保输出目录存在
if (!fs.existsSync(outputDir)) {
  fs.mkdirSync(outputDir, { recursive: true });
}

async function generateIcons() {
  try {
    console.log('🎨 开始生成图标...');
    console.log(`📁 输入: ${svgPath}`);
    console.log(`📁 输出: ${outputDir}\n`);

    // 读取 SVG 文件
    const svgBuffer = fs.readFileSync(svgPath);

    // 生成各种尺寸的 PNG
    for (const { name, size } of sizes) {
      const outputPath = path.join(outputDir, name);

      await sharp(svgBuffer)
        .resize(size, size, {
          fit: 'contain',
          background: { r: 255, g: 255, b: 255, alpha: 0 }, // 透明背景
        })
        .png()
        .toFile(outputPath);

      console.log(`✅ 生成: ${name} (${size}x${size})`);
    }

    // 生成 icon.png (通用 PNG 图标)
    const iconPngPath = path.join(outputDir, 'icon.png');
    await sharp(svgBuffer)
      .resize(512, 512, {
        fit: 'contain',
        background: { r: 255, g: 255, b: 255, alpha: 0 },
      })
      .png()
      .toFile(iconPngPath);
    console.log(`✅ 生成: icon.png (512x512)`);

    // 生成 icon.ico (Windows 图标)
    // 作为临时方案，复制 icon.png 作为 icon.ico
    // 这样可以保证打包时不会出错，但最好还是用专业工具生成
    const icoPath = path.join(outputDir, 'icon.ico');

    try {
      // 复制 icon.png 作为 icon.ico（临时方案）
      fs.copyFileSync(iconPngPath, icoPath);
      console.log(`✅ 生成: icon.ico (临时方案：复制自 icon.png)`);
      console.log(`   💡 建议: 使用专业工具生成更优化的 icon.ico`);
      console.log(`   📝 可以使用以下工具:`);
      console.log(`      - 在线工具: https://convertio.co/png-ico/`);
      console.log(`      - ImageMagick: convert icon.png -define icon:auto-resize=256,128,64,48,32,16 icon.ico`);
      console.log(`      - Python PIL: python3 scripts/generate-ico.py (需要安装 Pillow)`);
    } catch (error) {
      console.log(`⚠️  生成 icon.ico 失败: ${error.message}`);
    }

    // 尝试生成 icon.icns (macOS)
    try {
      const { execSync } = await import('child_process');
      const iconsetDir = path.join(outputDir, 'icon.iconset');

      // 创建 iconset 目录
      if (!fs.existsSync(iconsetDir)) {
        fs.mkdirSync(iconsetDir, { recursive: true });
      }

      // 生成 macOS 所需的各种尺寸
      const macSizes = [
        { size: 16, name: 'icon_16x16.png' },
        { size: 32, name: 'icon_16x16@2x.png' },
        { size: 32, name: 'icon_32x32.png' },
        { size: 64, name: 'icon_32x32@2x.png' },
        { size: 128, name: 'icon_128x128.png' },
        { size: 256, name: 'icon_128x128@2x.png' },
        { size: 256, name: 'icon_256x256.png' },
        { size: 512, name: 'icon_256x256@2x.png' },
        { size: 512, name: 'icon_512x512.png' },
        { size: 1024, name: 'icon_512x512@2x.png' },
      ];

      for (const { size, name } of macSizes) {
        const iconPath = path.join(iconsetDir, name);
        await sharp(svgBuffer)
          .resize(size, size, {
            fit: 'contain',
            background: { r: 255, g: 255, b: 255, alpha: 0 },
          })
          .png()
          .toFile(iconPath);
      }

      // 使用 iconutil 生成 icns 文件
      try {
        execSync(`iconutil -c icns -o "${path.join(outputDir, 'icon.icns')}" "${iconsetDir}"`, {
          stdio: 'pipe',
        });
        console.log(`✅ 生成: icon.icns (使用 iconutil)`);
        // 删除 iconset 目录
        fs.rmSync(iconsetDir, { recursive: true });
      } catch (e) {
        console.log(`⚠️  iconutil 不可用，保留 icon.iconset 目录`);
        console.log(`   请手动使用以下命令生成 icon.icns:`);
        console.log(`   iconutil -c icns -o "${path.join(outputDir, 'icon.icns')}" "${iconsetDir}"`);
      }
    } catch (error) {
      console.log(`⚠️  生成 icon.icns 失败: ${error.message}`);
    }

    console.log('\n✨ 所有图标生成完成！');
    console.log('\n📝 生成的图标文件:');
    console.log('   ✅ PNG 图标: 32x32, 128x128, 128x128@2x, icon.png (512x512)');
    console.log('   ✅ Windows Store 图标: Square*.png, StoreLogo.png');
    console.log('   ⚠️  icon.ico: 需要 ImageMagick 或手动生成');
    console.log('   ⚠️  icon.icns: 需要 macOS 的 iconutil 或手动生成');
  } catch (error) {
    console.error('❌ 生成图标失败:', error);
    process.exit(1);
  }
}

generateIcons();

