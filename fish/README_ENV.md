# 环境配置说明

## 云开发环境配置

### 1. 创建云开发环境
- 在微信开发者工具中点击「云开发」
- 创建新环境或使用现有环境
- 记录环境ID

### 2. 配置环境ID
在 `miniprogram/config/env.js` 中更新环境ID：
```javascript
const CLOUD_CONFIG = {
  envId: 'your-actual-env-id', // 替换为实际环境ID
  // ...
};