#!/bin/bash

echo "开始部署鱼类识别小程序..."

# 检查环境
echo "1. 检查环境配置..."
if [ ! -f "miniprogram/config/env.js" ]; then
    echo "错误：未找到环境配置文件"
    exit 1
fi

# 部署云函数
echo "2. 部署云函数..."
echo "请在微信开发者工具中执行以下步骤："
echo "   - 右键点击 cloudfunctions/fishDetection，选择'上传并部署：云端安装依赖'"
echo "   - 右键点击 cloudfunctions/initDatabase，选择'上传并部署：云端安装依赖'"
echo "   - 等待部署完成"

echo "3. 初始化数据库..."
echo "数据库将在应用首次启动时自动初始化"

echo "4. 配置说明："
echo "   - 请确保在 miniprogram/config/env.js 中配置了正确的 AI API 密钥"
echo "   - 请确保云开发环境已创建并配置正确"

echo "部署完成！请在微信开发者工具中预览或发布小程序。"