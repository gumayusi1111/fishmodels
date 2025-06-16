const express = require('express');
const multer = require('multer');
const ffmpeg = require('fluent-ffmpeg');
const path = require('path');
const fs = require('fs');
const cors = require('cors');
const { inference } = require('./predictor/modelInfer');

const app = express();
const PORT = 3000;

// 启用 CORS
app.use(cors());
app.use(express.json());

// 配置文件上传
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadDir = path.join(__dirname, 'uploads');
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, file.fieldname + '-' + uniqueSuffix + path.extname(file.originalname));
  }
});

const upload = multer({ storage: storage });

// 静态文件服务
app.use('/frames', express.static(path.join(__dirname, 'frames')));

// 存储帧文件信息，用于后续清理
const frameFiles = new Map();

// 视频抽帧接口
app.post('/extract-frame', upload.single('video'), (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: '没有上传视频文件' });
  }

  const videoPath = req.file.path;
  const frameDir = path.join(__dirname, 'frames');
  
  if (!fs.existsSync(frameDir)) {
    fs.mkdirSync(frameDir, { recursive: true });
  }

  const frameFilename = `frame-${Date.now()}.jpg`;
  const framePath = path.join(frameDir, frameFilename);

  // 使用 ffmpeg 抽取视频第1秒的帧
  ffmpeg(videoPath)
    .seekInput(1) // 跳转到第1秒
    .frames(1) // 只抽取1帧
    .output(framePath)
    .on('end', () => {
      // 删除临时视频文件
      fs.unlinkSync(videoPath);
      
      // 记录帧文件信息，设置30分钟后自动删除
      const frameId = frameFilename.replace('.jpg', '');
      frameFiles.set(frameId, {
        path: framePath,
        filename: frameFilename,
        createdAt: Date.now()
      });
      
      // 设置30分钟后自动删除帧文件
      setTimeout(() => {
        cleanupFrameFile(frameId);
      }, 30 * 60 * 1000); // 30分钟
      
      // 返回帧图片的URL和清理ID
      const frameUrl = `http://localhost:${PORT}/frames/${frameFilename}`;
      res.json({
        success: true,
        frameUrl: frameUrl,
        frameId: frameId,
        message: '视频抽帧成功'
      });
    })
    .on('error', (err) => {
      console.error('FFmpeg 错误:', err);
      // 删除临时视频文件
      if (fs.existsSync(videoPath)) {
        fs.unlinkSync(videoPath);
      }
      res.status(500).json({
        success: false,
        error: '视频抽帧失败: ' + err.message
      });
    })
    .run();
});

// 手动清理帧文件接口
app.delete('/cleanup-frame/:frameId', (req, res) => {
  const frameId = req.params.frameId;
  const success = cleanupFrameFile(frameId);
  
  if (success) {
    res.json({ success: true, message: '帧文件已删除' });
  } else {
    res.status(404).json({ success: false, message: '帧文件不存在或已被删除' });
  }
});

// 清理帧文件的函数
function cleanupFrameFile(frameId) {
  const frameInfo = frameFiles.get(frameId);
  if (frameInfo && fs.existsSync(frameInfo.path)) {
    try {
      fs.unlinkSync(frameInfo.path);
      frameFiles.delete(frameId);
      console.log(`已删除帧文件: ${frameInfo.filename}`);
      return true;
    } catch (error) {
      console.error(`删除帧文件失败: ${frameInfo.filename}`, error);
      return false;
    }
  }
  return false;
}

// 定期清理过期的帧文件（每小时执行一次）
setInterval(() => {
  const now = Date.now();
  const expireTime = 30 * 60 * 1000; // 30分钟
  
  for (const [frameId, frameInfo] of frameFiles.entries()) {
    if (now - frameInfo.createdAt > expireTime) {
      cleanupFrameFile(frameId);
    }
  }
}, 60 * 60 * 1000); // 每小时检查一次

// 健康检查接口
app.get('/health', (req, res) => {
  res.json({ 
    status: 'ok', 
    message: '视频抽帧服务运行正常',
    activeFrames: frameFiles.size
  });
});

// =========================
// 图片疾病检测接口
// =========================
app.post('/predict', upload.single('image'), async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ success: false, error: '未收到图片文件' });
  }

  try {
    // 调用推理模块
    const result = await inference(req.file.path);

    // 推理完成后删除临时上传文件，避免磁盘堆积
    fs.unlink(req.file.path, () => {});

    res.json(result);
  } catch (err) {
    console.error('[predict] 推理失败:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

app.listen(PORT, () => {
  console.log(`视频抽帧服务启动成功，端口: ${PORT}`);
  console.log(`健康检查: http://localhost:${PORT}/health`);
});