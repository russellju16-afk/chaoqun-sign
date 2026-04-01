# PWA 图标生成说明

## 需要手动生成的文件

- `icon-192.png` — 192×192 PNG，用于 Android 主屏图标
- `icon-512.png` — 512×512 PNG，用于启动画面和 Play Store

## 生成方法

以 `icon.svg` 为源文件，使用以下任一方式转换：

### 方法 1：使用 Inkscape（推荐）
```bash
inkscape icon.svg -w 192 -h 192 -o icon-192.png
inkscape icon.svg -w 512 -h 512 -o icon-512.png
```

### 方法 2：使用 ImageMagick
```bash
convert -background none icon.svg -resize 192x192 icon-192.png
convert -background none icon.svg -resize 512x512 icon-512.png
```

### 方法 3：在线工具
1. 打开 https://cloudconvert.com/svg-to-png
2. 上传 `icon.svg`，分别导出 192×192 和 512×512 两个尺寸

## 图标规格

- 背景色：`#2563eb`（蓝色）
- 内容：白色"超"字
- 圆角：约 18.75%（96/512）
- 图标格式支持 `maskable`（安全区域内容居中）
