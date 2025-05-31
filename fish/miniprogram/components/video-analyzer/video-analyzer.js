const { generateKeyFrameTimePoints } = require('../../utils/fishDetectUtils.js');

Component({
  properties: {
    videoUrl: {
      type: String,
      value: ''
    },
    analysisConfig: {
      type: Object,
      value: {}
    }
  },
  
  data: {
    videoFrames: [],
    selectedFrame: 0,
    videoDuration: 0,
    isExtracting: false,
    extractProgress: 0
  },
  
  methods: {
    // 提取视频帧
    async extractFrames() {
      if (!this.properties.videoUrl) return;
      
      this.setData({ isExtracting: true, extractProgress: 0 });
      
      try {
        const videoInfo = await this.getVideoInfo(this.properties.videoUrl);
        const duration = videoInfo.duration;
        const frameCount = Math.min(Math.ceil(duration / 2), 10);
        
        this.setData({ videoDuration: duration });
        
        const timePoints = generateKeyFrameTimePoints(duration, frameCount);
        const frames = [];
        
        for (let i = 0; i < timePoints.length; i++) {
          const time = timePoints[i];
          const frameUrl = await this.extractFrameAtTime(time);
          
          if (frameUrl) {
            frames.push({
              url: frameUrl,
              time: time,
              index: i
            });
          }
          
          this.setData({
            extractProgress: Math.round((i + 1) / timePoints.length * 100)
          });
        }
        
        this.setData({ 
          videoFrames: frames,
          isExtracting: false 
        });
        
        this.triggerEvent('framesExtracted', { frames });
        
      } catch (error) {
        console.error('视频帧提取失败:', error);
        this.setData({ isExtracting: false });
        this.triggerEvent('extractError', { error });
      }
    },
    
    // 获取视频信息
    getVideoInfo(videoUrl) {
      return new Promise((resolve, reject) => {
        wx.getVideoInfo({
          src: videoUrl,
          success: resolve,
          fail: reject
        });
      });
    },
    
    // 在指定时间提取帧
    extractFrameAtTime(time) {
      return new Promise((resolve) => {
        const videoContext = wx.createVideoContext('temp-video', this);
        videoContext.seek(time);
        
        setTimeout(() => {
          this.captureFrame(resolve);
        }, 800);
      });
    },
    
    // 捕获帧
    captureFrame(callback) {
      // 使用 Canvas 截图的简化实现
      const query = wx.createSelectorQuery().in(this);
      query.select('#temp-video')
        .fields({ node: true })
        .exec((res) => {
          if (res[0] && res[0].node) {
            // 实际的截图逻辑
            this.createFrameFromVideo(res[0].node, callback);
          } else {
            callback(null);
          }
        });
    },
    
    // 从视频创建帧
    createFrameFromVideo(videoNode, callback) {
      try {
        const canvas = wx.createOffscreenCanvas({ type: '2d' });
        const ctx = canvas.getContext('2d');
        
        canvas.width = 320;
        canvas.height = 240;
        
        ctx.drawImage(videoNode, 0, 0, canvas.width, canvas.height);
        
        canvas.toDataURL({
          format: 'jpeg',
          quality: 0.8,
          success: (res) => callback(res.tempFilePath),
          fail: () => callback(null)
        });
      } catch (error) {
        console.error('创建帧失败:', error);
        callback(null);
      }
    },
    
    // 选择帧
    selectFrame(e) {
      const index = e.currentTarget.dataset.index;
      this.setData({ selectedFrame: index });
      this.triggerEvent('frameSelected', { 
        index, 
        frame: this.data.videoFrames[index] 
      });
    }
  }
});