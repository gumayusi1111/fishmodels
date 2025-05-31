const express = require('express');
const multer = require('multer');
const ffmpeg = require('fluent-ffmpeg');
const path = require('path');
const fs = require('fs');
const cors = require('cors');

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
      
      // 返回帧图片的URL
      const frameUrl = `http://localhost:${PORT}/frames/${frameFilename}`;
      res.json({
        success: true,
        frameUrl: frameUrl,
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

// 健康检查接口
app.get('/health', (req, res) => {
  res.json({ status: 'ok', message: '视频抽帧服务运行正常' });
});

app.listen(PORT, () => {
  console.log(`视频抽帧服务启动成功，端口: ${PORT}`);
  console.log(`健康检查: http://localhost:${PORT}/health`);
});