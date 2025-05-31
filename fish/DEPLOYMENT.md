# 鱼类识别小程序部署指南

## 前置要求

1. 微信开发者账号
2. 已开通云开发服务
3. AI API 密钥（支持图像识别的 GPT-4 API）

## 部署步骤

### 1. 环境配置

1. 复制项目到本地
2. 修改 `miniprogram/config/env.js` 中的配置：
   ```javascript
   const CLOUD_CONFIG = {
     envId: 'your-cloud-env-id', // 替换为你的云开发环境ID
     currentEnv: 'development'
   };
   
   const AI_CONFIG = {
     apiKey: 'your-api-key', // 替换为你的AI API密钥
     baseURL: 'https://your-api-endpoint.com/v1/chat/completions',
     defaultModel: 'gpt-4o'
   };