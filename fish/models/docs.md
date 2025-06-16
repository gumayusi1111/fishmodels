# 项目快速配置指南

> 本文档说明 **交付后的二次配置** 位置，主要包括：
> 1. 云开发环境 ID 修改
> 2. AI 接口 `apiKey / baseURL` 修改
> 3. 知识库文件替换

---

## 1. 修改云环境 ID（envId）

文件位置：
```
fish/miniprogram/config/env.js
```

```js
const CLOUD_CONFIG = {
  envId: 'cloud1-xxxxxxxxxxxxxxx', // ← 将此处替换为你的云环境 ID
  ...
};
```

修改步骤：
1. 登录微信云开发控制台 → 环境管理，复制目标环境 ID；
2. 替换 `envId` 字段（`currentEnv` 也可改为对应 key，如 `production`）。
3. 保存代码并重新运行小程序即可生效。

---

## 2. 修改 AI 服务配置（API Key & URL）

同文件：`fish/miniprogram/config/env.js`

```js
const AI_CONFIG = {
  apiKey: 'sk-xxxxxxxxxxxxxxxxxxxxxxxx',
  baseURL: 'https://api.example.com/v1/chat/completions',
  defaultModel: 'gpt-4o'
};
```

仅需把 `apiKey` 与 `baseURL` 替换为正式值。

> 🔒 **安全提示**：正式发布前请改为从云函数环境变量或远端配置读取，避免明文保存在代码仓库。

---

## 3. 知识库文件替换

云函数 `fishDetection` 使用 `know.txt` 作为疾病与治疗方案知识库。

文件位置：
```
fish/cloudfunctions/fishDetection/know.txt
```

替换方式：
1. 将新的知识库文本内容覆盖 `know.txt`。
2. 保持 UTF-8 编码，建议控制在 20-30 KB 以内，避免 GPT 请求过长。
3. 重新上传 / 部署云函数后生效。

---

## 4. ONNX 模型更新

当获得新的训练权重时：
1. 复制 `best.onnx` → `fish/backend/predictor/model.onnx`（覆盖原文件）。
2. 若类别顺序有变，同步 `classes.txt`。
3. 重启后端：
   ```bash
   cd fish/backend
   node server.js
   ```

---

完成以上修改后，无需更改其他代码即可在新环境下正常运行。
