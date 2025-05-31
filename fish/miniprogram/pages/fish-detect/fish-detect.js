const { AI_CONFIG, FISH_SERVICE_CONFIG } = require('../../config/env.js');
const { 
  formatFileSize, 
  generateKeyFrameTimePoints, 
  synthesizeVideoAnalysis,
  UserAuthManager,
  HistoryManager
} = require('../../utils/fishDetectUtils.js');

Page({
  data: {
    mediaType: 'image', // 'image' 或 'video'
    mediaUrl: '',
    mediaSize: '',
    videoDuration: 0, // 视频时长
    videoFrames: [], // 视频帧
    selectedFrame: 0,
    isAnalyzing: false,
    loadingText: '',
    loadingProgress: '',
    result: null,
    showResult: false,
    
    // 添加显示媒体类型和URL字段
    displayMediaType: '',
    displayMediaUrl: '',
    
    // 新增：视频分析配置
    frameIntervals: [
      { label: '每1秒', value: 1 },
      { label: '每2秒', value: 2 },
      { label: '每3秒', value: 3 },
      { label: '每5秒', value: 5 }
    ],
    selectedFrameInterval: 0,
    
    analysisModes: [
      { label: '快速模式', value: 'fast' },
      { label: '标准模式', value: 'standard' },
      { label: '精确模式', value: 'precise' }
    ],
    selectedAnalysisMode: 1,
    
    maxFrames: 5,
    
    // 视频分析进度
    videoAnalysisProgress: null
  },

  onLoad() {
    wx.setNavigationBarTitle({
      title: '智能鱼类诊断'
    });
  },

  // 选择媒体类型
  selectMediaType(e) {
    const type = e.currentTarget.dataset.type;
    this.setData({
      mediaType: type,
      mediaUrl: '',
      videoFrames: [],
      showResult: false
    });
  },

  // 选择媒体文件
  chooseMedia() {
    const that = this;
    const { mediaType } = this.data;
    
    if (mediaType === 'image') {
      this.chooseImage();
    } else {
      this.chooseVideo();
    }
  },

  // 选择图片
  chooseImage() {
    const that = this;
    wx.chooseMedia({
      count: 1,
      mediaType: ['image'],
      sourceType: ['album', 'camera'],
      camera: 'back',
      // 支持更多图片格式
      extension: ['jpg', 'jpeg', 'png', 'gif', 'bmp', 'webp'],
      success(res) {
        const file = res.tempFiles[0];
        
        // 检查文件大小（最大10MB）
        if (file.size > 10 * 1024 * 1024) {
          wx.showToast({
            title: '图片过大，请选择小于10MB的图片',
            icon: 'error',
            duration: 2000
          });
          return;
        }
        
        // 检查图片格式
        const validFormats = ['jpg', 'jpeg', 'png', 'gif', 'bmp', 'webp'];
        const fileExtension = file.tempFilePath.split('.').pop().toLowerCase();
        
        if (!validFormats.includes(fileExtension)) {
          wx.showToast({
            title: '不支持的图片格式',
            icon: 'error'
          });
          return;
        }
        
        that.setData({
          mediaUrl: file.tempFilePath,
          mediaSize: that.formatFileSize(file.size),
          showResult: false
        });
        
        // 压缩图片以提高上传速度
        that.compressImage(file.tempFilePath);
      },
      fail(err) {
        wx.showToast({
          title: '选择图片失败',
          icon: 'error'
        });
      }
    });
  },
  
  // 压缩图片方法
  compressImage(imagePath) {
    return new Promise((resolve, reject) => {
      if (!imagePath) {
        reject(new Error('图片路径不能为空'));
        return;
      }
      
      wx.compressImage({
        src: imagePath,
        quality: 80, // 压缩质量
        success: (res) => {
          console.log('图片压缩成功:', res.tempFilePath);
          resolve(res.tempFilePath);
        },
        fail: (err) => {
          console.log('图片压缩失败，使用原图:', err);
          // 压缩失败时返回原图路径
          resolve(imagePath);
        }
      });
    });
  },

  // 选择视频
  chooseVideo() {
    const that = this;
    wx.chooseMedia({
      count: 1,
      mediaType: ['video'],
      sourceType: ['album', 'camera'],
      maxDuration: 30,
      camera: 'back',
      success(res) {
        const file = res.tempFiles[0];
        that.setData({
          mediaUrl: file.tempFilePath,
          mediaSize: that.formatFileSize(file.size),
          showResult: false
        });
        // 提取视频帧
        that.extractVideoFrames(file.tempFilePath);
      },
      fail(err) {
        wx.showToast({
          title: '选择视频失败',
          icon: 'error'
        });
      }
    });
  },

  // 改进的视频抽帧方法
  extractVideoFrames(videoPath) {
    const that = this;
    
    wx.showLoading({
      title: '正在分析视频...'
    });
    
    // 获取视频信息
    wx.getVideoInfo({
      src: videoPath,
      success: (res) => {
        console.log('视频信息:', res);
        
        const duration = res.duration;
        const frameCount = Math.min(Math.ceil(duration / 2), 10); // 每2秒一帧，最多10帧
        const frames = [];
        let extractedCount = 0;
        
        // 智能选择关键帧时间点
        const timePoints = that.generateKeyFrameTimePoints(duration, frameCount);
        
        timePoints.forEach((time, index) => {
          setTimeout(() => {
            that.extractFrameAtTimeImproved(videoPath, time, (frameData) => {
              if (frameData) {
                frames.push({
                  url: frameData,
                  time: time,
                  index: index
                });
              }
              
              extractedCount++;
              
              // 更新进度
              wx.showLoading({
                title: `提取帧 ${extractedCount}/${frameCount}`
              });
              
              if (extractedCount === frameCount) {
                wx.hideLoading();
                that.setData({
                  videoFrames: frames,
                  selectedFrame: 0
                });
                
                // 自动分析第一帧
                if (frames.length > 0) {
                  that.analyzeVideoFrame(frames[0]);
                }
                
                wx.showToast({
                  title: `成功提取${frames.length}帧`,
                  icon: 'success'
                });
              }
            });
          }, index * 300); // 减少间隔时间
        });
      },
      fail: (err) => {
        wx.hideLoading();
        console.error('获取视频信息失败:', err);
        wx.showToast({
          title: '视频格式不支持',
          icon: 'error'
        });
      }
    });
  },
  
  // 生成关键帧时间点
  generateKeyFrameTimePoints(duration, frameCount) {
    const timePoints = [];
    
    if (duration <= 10) {
      // 短视频：均匀分布
      for (let i = 0; i < frameCount; i++) {
        timePoints.push((duration / frameCount) * i);
      }
    } else {
      // 长视频：重点关注开头、中间和结尾
      timePoints.push(1); // 开头
      timePoints.push(duration * 0.25); // 1/4处
      timePoints.push(duration * 0.5); // 中间
      timePoints.push(duration * 0.75); // 3/4处
      timePoints.push(duration - 2); // 结尾前2秒
      
      // 补充其他时间点
      const remaining = frameCount - 5;
      for (let i = 0; i < remaining; i++) {
        const randomTime = Math.random() * duration;
        timePoints.push(randomTime);
      }
    }
    
    return timePoints.sort((a, b) => a - b).slice(0, frameCount);
  },
  
  // 改进的帧提取方法
  extractFrameAtTimeImproved(videoPath, time, callback) {
    const that = this;
    
    // 使用更稳定的截图方法
    wx.createVideoContext('temp-video', that).seek(time);
    
    setTimeout(() => {
      // 使用截图API（如果可用）
      if (wx.createCameraContext && wx.createCameraContext().takePhoto) {
        // 使用相机截图
        that.captureVideoFrame(time, callback);
      } else {
        // 降级到canvas方法
        that.extractFrameWithCanvas(time, callback);
      }
    }, 800); // 增加等待时间确保视频定位准确
  },
  
  // 分析视频帧
  async analyzeVideoFrame(frameData) {
    try {
      // 上传帧图片
      const uploadResult = await this.uploadImage(frameData.url);
      
      // 调用AI分析
      const analysisResult = await this.callGPTSpeciesDetection(uploadResult);
      
      // 更新结果显示
      this.setData({
        [`videoFrames[${frameData.index}].analysis`]: analysisResult,
        currentFrameAnalysis: analysisResult
      });
      
      wx.showToast({
        title: '帧分析完成',
        icon: 'success'
      });
    } catch (error) {
      console.error('视频帧分析失败:', error);
      wx.showToast({
        title: '分析失败',
        icon: 'error'
      });
    }
  },
  
  // 批量分析所有帧
  async analyzeAllFrames() {
    const frames = this.data.videoFrames;
    if (!frames || frames.length === 0) return;
    
    wx.showLoading({
      title: '批量分析中...'
    });
    
    const results = [];
    
    for (let i = 0; i < frames.length; i++) {
      try {
        const uploadResult = await this.uploadImage(frames[i].url);
        const analysisResult = await this.callGPTSpeciesDetection(uploadResult);
        
        results.push({
          frameIndex: i,
          time: frames[i].time,
          analysis: analysisResult
        });
        
        // 更新进度
        wx.showLoading({
          title: `分析进度 ${i + 1}/${frames.length}`
        });
      } catch (error) {
        console.error(`第${i + 1}帧分析失败:`, error);
      }
    }
    
    wx.hideLoading();
    
    // 综合分析结果
    const finalResult = this.synthesizeVideoAnalysis(results);
    
    this.setData({
      videoAnalysisResults: results,
      finalVideoResult: finalResult,
      showVideoResult: true
    });
  },
  
  // 综合视频分析结果
  synthesizeVideoAnalysis(frameResults) {
    if (!frameResults || frameResults.length === 0) {
      return {
        species: '未识别',
        confidence: 0,
        description: '视频分析失败'
      };
    }
    
    // 统计各种识别结果
    const speciesCount = {};
    let totalConfidence = 0;
    
    frameResults.forEach(result => {
      if (result.analysis && result.analysis.species) {
        const species = result.analysis.species;
        speciesCount[species] = (speciesCount[species] || 0) + 1;
        totalConfidence += result.analysis.confidence || 0;
      }
    });
    
    // 找出最常见的品种
    const mostCommonSpecies = Object.keys(speciesCount).reduce((a, b) => 
      speciesCount[a] > speciesCount[b] ? a : b
    );
    
    const avgConfidence = totalConfidence / frameResults.length;
    
    return {
      species: mostCommonSpecies,
      confidence: Math.round(avgConfidence),
      description: `基于${frameResults.length}帧分析的综合结果`,
      frameCount: frameResults.length,
      detectionRate: (Object.values(speciesCount).reduce((a, b) => a + b, 0) / frameResults.length * 100).toFixed(1) + '%'
    };
  }, // 这里需要添加逗号
  
  // 选择视频帧
  selectFrame(e) {
    const index = e.currentTarget.dataset.index;
    if (index !== undefined && index >= 0 && index < this.data.videoFrames.length) {
      this.setData({
        selectedFrame: parseInt(index)
      });
    } else {
      console.error('Invalid frame index:', index);
      wx.showToast({
        title: '选择帧无效',
        icon: 'error'
      });
    }
  },

  // 新增：抽帧间隔选择
  onFrameIntervalChange(e) {
    this.setData({
      selectedFrameInterval: parseInt(e.detail.value)
    });
  },

  // 新增：分析模式选择
  onAnalysisModeChange(e) {
    this.setData({
      selectedAnalysisMode: parseInt(e.detail.value)
    });
  },

  // 新增：最大帧数变化
  onMaxFramesChange(e) {
    this.setData({
      maxFrames: parseInt(e.detail.value)
    });
  },





  // 改进的视频抽帧方法
  extractVideoFrames(videoPath) {
    const that = this;
    
    wx.showLoading({
      title: '正在分析视频...'
    });
    
    // 获取视频信息
    wx.getVideoInfo({
      src: videoPath,
      success: (res) => {
        console.log('视频信息:', res);
        
        const duration = res.duration;
        const frameCount = Math.min(Math.ceil(duration / 2), 10); // 每2秒一帧，最多10帧
        const frames = [];
        let extractedCount = 0;
        
        // 智能选择关键帧时间点
        const timePoints = that.generateKeyFrameTimePoints(duration, frameCount);
        
        timePoints.forEach((time, index) => {
          setTimeout(() => {
            that.extractFrameAtTimeImproved(videoPath, time, (frameData) => {
              if (frameData) {
                frames.push({
                  url: frameData,
                  time: time,
                  index: index
                });
              }
              
              extractedCount++;
              
              // 更新进度
              wx.showLoading({
                title: `提取帧 ${extractedCount}/${frameCount}`
              });
              
              if (extractedCount === frameCount) {
                wx.hideLoading();
                that.setData({
                  videoFrames: frames,
                  selectedFrame: 0
                });
                
                // 自动分析第一帧
                if (frames.length > 0) {
                  that.analyzeVideoFrame(frames[0]);
                }
                
                wx.showToast({
                  title: `成功提取${frames.length}帧`,
                  icon: 'success'
                });
              }
            });
          }, index * 300); // 减少间隔时间
        });
      },
      fail: (err) => {
        wx.hideLoading();
        console.error('获取视频信息失败:', err);
        wx.showToast({
          title: '视频格式不支持',
          icon: 'error'
        });
      }
    });
  },

  // 修改：分析媒体（增加视频分析进度）
  async analyzeMedia() {
    const { mediaType, mediaUrl, selectedFrame, videoFrames, selectedAnalysisMode } = this.data;
    
    if (mediaType === 'video' && videoFrames.length === 0) {
      wx.showToast({
        title: '请先提取视频帧',
        icon: 'error'
      });
      return;
    }
    
    this.setData({ 
      isAnalyzing: true,
      loadingText: '正在上传文件...',
      loadingProgress: '0%',
      videoAnalysisProgress: mediaType === 'video' ? {
        current: 0,
        total: videoFrames.length,
        percent: 0,
        step: '准备分析...',
        eta: '计算中...'
      } : null
    });
    
    try {
      if (mediaType === 'image') {
        await this.analyzeImage(mediaUrl);
      } else {
        await this.analyzeVideo();
      }
      
      // 识别完成后，如果是通过后端抽帧的，清理帧文件
      if (this.data.frameId) {
        this.cleanupFrameFile(this.data.frameId);
      }
      
    } catch (error) {
      console.error('分析失败:', error);
      wx.showToast({
        title: '分析失败，请重试',
        icon: 'error'
      });
      
      // 即使识别失败，也要清理帧文件
      if (this.data.frameId) {
        this.cleanupFrameFile(this.data.frameId);
      }
    } finally {
      this.setData({
        isAnalyzing: false,
        videoAnalysisProgress: null
      });
    }
  },

  // 修复后的视频分析方法
  async analyzeVideo(videoPath) {
    try {
      this.setData({
        isAnalyzing: true,
        showResult: false,
        result: null,
        analysisProgress: null
      });
      
      this.updateAnalysisProgress(20);
      
      // 方案1：直接分析视频文件（如果云函数支持）
      try {
        console.log('尝试直接分析视频文件:', videoPath);
        const result = await this.analyzeVideoDirectly(videoPath);
        
        if (result && result.confidence > 0) {
          this.updateAnalysisProgress(100);
          
          this.setData({
            result: result,
            showResult: true,
            isAnalyzing: false
          });
          
          wx.showToast({
            title: '分析完成',
            icon: 'success'
          });
          return;
        }
      } catch (directError) {
        console.error('直接视频分析失败:', directError);
      }
      
      // 方案2：使用Canvas截取视频帧
      this.updateAnalysisProgress(40);
      
      try {
        const frameUrl = await this.captureVideoFrameWithTimeout(videoPath);
        console.log('Canvas截取的帧:', frameUrl);
        
        if (frameUrl) {
          const result = await this.analyzeFrameComplete(frameUrl);
          
          if (result && result.confidence > 0) {
            this.updateAnalysisProgress(100);
            
            // 添加截取的帧图片到结果中
            const finalResult = {
              ...result,
              frameImage: frameUrl,  // 添加截取的帧图片URL
              timestamp: new Date().toISOString()
            };
            
            this.setData({
              result: finalResult,
              showResult: true,
              isAnalyzing: false,
              // 将媒体类型改为image，媒体URL改为截取的帧
              displayMediaType: 'image',
              displayMediaUrl: frameUrl
            });
            
            wx.showToast({
              title: '分析完成',
              icon: 'success'
            });
            return;
          }
        }
      } catch (canvasError) {
        console.error('Canvas截取失败:', canvasError);
      }
      
      // 方案3：引导用户手动截图
      this.setData({
        isAnalyzing: false,
        analysisProgress: null
      });
      
      wx.showModal({
        title: '视频分析困难',
        content: '当前视频格式可能不支持自动分析。建议您：\n\n1. 暂停视频到清晰画面\n2. 截图保存\n3. 使用图片分析功能\n\n这样可以获得更准确的分析结果。',
        showCancel: true,
        cancelText: '重试',
        confirmText: '切换图片分析',
        success: (res) => {
          if (res.confirm) {
            this.setData({
              mediaType: 'image',
              mediaUrl: ''
            });
          } else if (res.cancel) {
            // 重试
            setTimeout(() => {
              this.analyzeVideo(videoPath);
            }, 1000);
          }
        }
      });
      
    } catch (error) {
      console.error('视频分析失败:', error);
      
      this.setData({
        isAnalyzing: false,
        analysisProgress: null
      });
      
      wx.showToast({
        title: '分析失败',
        icon: 'error'
      });
    }
  },

  // 直接分析视频的方法
  async analyzeVideoDirectly(videoPath) {
    try {
      // 上传视频到云存储
      const fileID = await this.uploadFile(videoPath);
      
      // 调用云函数进行视频分析
      const result = await wx.cloud.callFunction({
        name: 'fishDetection',
        data: {
          fileID: fileID,
          type: 'video' // 标记为视频类型
        }
      });
      
      return result.result;
    } catch (error) {
      console.error('直接视频分析失败:', error);
      throw error;
    }
  },

  // 生成简单的时间点（固定4个）
  generateSimpleTimePoints(duration, frameCount = 4) {
    if (duration <= 4) {
      // 短视频：每秒一帧
      return Array.from({length: Math.min(frameCount, Math.floor(duration))}, (_, i) => i + 0.5);
    } else {
      // 长视频：均匀分布4个时间点
      return [
        duration * 0.1,  // 10%处
        duration * 0.35, // 35%处
        duration * 0.65, // 65%处
        duration * 0.9   // 90%处
      ];
    }
  },

  // 简化的帧提取方法
  async extractFramesSimple(videoPath, timePoints) {
    const frames = [];
    
    console.log('开始提取视频帧，视频路径:', videoPath);
    console.log('时间点:', timePoints);
    
    for (let i = 0; i < timePoints.length; i++) {
      try {
        const frameUrl = await this.extractSingleFrame(videoPath, timePoints[i]);
        console.log(`第${i+1}帧提取结果:`, frameUrl);
        
        if (frameUrl) {
          frames.push({
            url: frameUrl,
            time: timePoints[i],
            index: i
          });
          console.log(`第${i+1}帧添加成功，URL:`, frameUrl);
        } else {
          console.log(`第${i+1}帧提取失败，返回值为空`);
        }
      } catch (error) {
        console.error(`提取第${i+1}帧失败:`, error);
      }
    }
    
    console.log('最终提取的帧数组:', frames);
    return frames;
  },

  // 提取单个帧（使用canvas方法，避免视频节点问题）
  async extractSingleFrame(videoPath, time) {
    console.log(`开始提取单帧，视频路径: ${videoPath}, 时间: ${time}秒`);
    
    return new Promise((resolve) => {
      // 创建临时视频元素进行帧提取
      const tempFilePath = `${wx.env.USER_DATA_PATH}/temp_frame_${Date.now()}.jpg`;
      console.log('临时文件路径:', tempFilePath);
      
      // 使用微信提供的视频帧提取API（如果可用）
      if (wx.createVideoDecoder) {
        console.log('使用 wx.createVideoDecoder 提取帧');
        const decoder = wx.createVideoDecoder();
        
        decoder.on('frame', (frame) => {
          console.log('视频解码器返回帧数据:', frame);
          // 处理帧数据
          resolve(frame.data);
        });
        
        decoder.on('error', (error) => {
          console.error('视频解码器错误:', error);
          // 降级到文件系统方案
          this.extractFrameWithFileSystem(videoPath, time, resolve);
        });
        
        decoder.start({
          source: videoPath,
          mode: 1
        });
        decoder.seek(time);
      } else {
        console.log('wx.createVideoDecoder 不可用，使用降级方案');
        // 降级方案：使用文件系统API
        this.extractFrameWithFileSystem(videoPath, time, resolve);
      }
    });
  },
  
  // 文件系统方式提取帧
  extractFrameWithFileSystem(videoPath, time, callback) {
    console.log(`降级方案：文件系统提取帧，视频路径: ${videoPath}, 时间: ${time}`);
    
    // 这里是问题所在！直接返回视频路径而不是截图
    // 我们需要实际截取帧或者明确告知这是视频路径
    console.log('警告：降级方案直接返回视频路径，这可能导致分析失败');
    console.log('返回的"帧"路径（实际是视频路径）:', videoPath);
    
    setTimeout(() => {
      callback(videoPath); // 临时返回视频路径
    }, 100);
  },
  
  // 使用Canvas 2D截取视频帧
  async extractFrameWithCanvas(videoPath, time) {
    return new Promise((resolve, reject) => {
      console.log('开始使用Canvas 2D截取视频帧:', videoPath, '时间:', time);
      
      // 创建video组件实例
      const videoContext = wx.createVideoContext('temp-video', this);
      
      if (!videoContext) {
        reject(new Error('无法创建视频上下文'));
        return;
      }
      
      // 设置视频时间
      videoContext.seek(time);
      
      setTimeout(() => {
        // 使用Canvas 2D接口
        const query = wx.createSelectorQuery().in(this);
        query.select('#temp-canvas')
          .node()
          .exec((res) => {
            if (res[0] && res[0].node) {
              const canvas = res[0].node;
              const ctx = canvas.getContext('2d');
              
              // 设置canvas尺寸
              canvas.width = 300;
              canvas.height = 200;
              
              // 获取video元素节点
              const videoQuery = wx.createSelectorQuery().in(this);
              videoQuery.select('#temp-video')
                .node()
                .exec((videoRes) => {
                  if (videoRes[0] && videoRes[0].node) {
                    const videoNode = videoRes[0].node;
                    
                    try {
                      // 绘制视频帧到canvas
                      ctx.drawImage(videoNode, 0, 0, canvas.width, canvas.height);
                      
                      // 导出为临时文件
                      wx.canvasToTempFilePath({
                        canvas: canvas,
                        success: (result) => {
                          console.log('Canvas 2D截取成功:', result.tempFilePath);
                          resolve(result.tempFilePath);
                        },
                        fail: (error) => {
                          console.error('Canvas 2D导出失败:', error);
                          reject(error);
                        }
                      }, this);
                    } catch (error) {
                      console.error('Canvas 2D绘制失败:', error);
                      reject(error);
                    }
                  } else {
                    reject(new Error('无法获取视频节点'));
                  }
                });
            } else {
              reject(new Error('无法获取Canvas 2D节点'));
            }
          });
      }, 800); // 增加等待时间确保视频定位准确
    });
  },
  
  // 保存帧数据到临时文件
  async saveFrameToTempFile(frameData) {
    const tempFilePath = `${wx.env.USER_DATA_PATH}/frame_${Date.now()}.jpg`;
    
    return new Promise((resolve, reject) => {
      wx.getFileSystemManager().writeFile({
        filePath: tempFilePath,
        data: frameData,
        encoding: 'binary',
        success: () => resolve(tempFilePath),
        fail: reject
      });
    });
  },

  // 完整分析单帧
  async analyzeFrameComplete(frameUrl) {
    console.log('开始分析帧:', frameUrl);
    
    try {
      // 上传帧到云存储
      console.log('正在上传帧到云存储...');
      const fileID = await this.uploadFile(frameUrl);
      console.log('帧上传成功，云存储ID:', fileID);
      
      // 调用物种识别
      console.log('开始物种识别...');
      const speciesResult = await this.callGPTSpeciesDetection(fileID);
      console.log('物种识别结果:', speciesResult);
      
      // 调用疾病检测
      console.log('开始疾病检测...');
      const diseaseResult = await this.callGPTDiseaseDetection(fileID);
      console.log('疾病检测结果:', diseaseResult);
      
      // 调用治疗建议
      console.log('开始生成治疗建议...');
      const treatmentResult = await this.callGPTTreatmentAdvice({
        species: speciesResult.species,
        health: diseaseResult.health,
        disease: diseaseResult.disease
      });
      console.log('治疗建议结果:', treatmentResult);
      
      return {
        species: speciesResult.species,
        confidence: speciesResult.confidence,
        description: speciesResult.description,
        habitat: speciesResult.habitat,
        characteristics: speciesResult.characteristics,
        health: diseaseResult.health,
        disease: diseaseResult.disease,
        treatment: treatmentResult.treatment
      };
      
    } catch (error) {
      console.error('帧分析失败，详细错误:', error);
      console.log('失败的帧URL:', frameUrl);
      return null;
    }
  },

  // 获取视频信息的Promise版本
  getVideoInfo(videoPath) {
    return new Promise((resolve, reject) => {
      wx.getVideoInfo({
        src: videoPath,
        success: resolve,
        fail: reject
      });
    });
  },
  
  // 获取治疗建议
  async getTreatmentAdvice(finalResult) {
    try {
      const treatmentResult = await this.callGPTTreatmentAdvice(finalResult.species, finalResult.diseases);
      finalResult.treatment = treatmentResult.advice;
      finalResult.videoAdvice = `基于分析结果，建议持续观察鱼类行为变化。`;
      
      this.setData({
        result: finalResult
      });
    } catch (error) {
      console.error('获取治疗建议失败:', error);
    }
  },
  
  // 分析视频帧
  async analyzeVideoFrame(frameUrl, frameIndex, totalFrames) {
    try {
      // 上传帧图片
      const uploadResult = await this.uploadImage(frameUrl);
      
      // 调用AI分析
      const analysisResult = await this.callGPTSpeciesDetection(uploadResult);
      
      // 更新结果显示
      this.setData({
        [`videoFrames[${frameIndex}].analysis`]: analysisResult,
        currentFrameAnalysis: analysisResult
      });
      
      wx.showToast({
        title: `帧 ${frameIndex + 1}/${totalFrames} 分析完成`,
        icon: 'success'
      });
      
      return analysisResult;
    } catch (error) {
      console.error('视频帧分析失败:', error);
      wx.showToast({
        title: '分析失败',
        icon: 'error'
      });
      return null;
    }
  },
  
  // 使用工具函数替换原有方法
  formatFileSize: formatFileSize,
  
  // 保存历史记录
  async saveHistory(resultData = null) {
    // 如果传入了结果数据，使用传入的数据；否则使用this.data
    const dataToSave = resultData ? {
      ...this.data,
      result: resultData
    } : this.data;
    
    await HistoryManager.saveHistory(dataToSave);
  },
  
  // 查看历史记录
  viewHistory() {
    // 检查用户是否已授权
    const userInfo = UserAuthManager.checkUserAuth();
    if (!userInfo) {
      wx.showModal({
        title: '需要授权',
        content: '查看历史记录需要先授权获取用户信息',
        confirmText: '去授权',
        success: (res) => {
          if (res.confirm) {
            this.getUserProfile();
          }
        }
      });
      return;
    }
    
    // 跳转到历史记录页面
    wx.navigateTo({
      url: '/pages/history/history'
    });
  },
  
  // 获取用户信息授权
  async getUserProfile() {
    try {
      const userInfo = await UserAuthManager.getUserProfile();
      wx.showToast({
        title: '授权成功',
        icon: 'success'
      });
      
      // 如果有分析结果，保存历史记录
      if (this.data.result) {
        this.saveHistory();
      }
    } catch (error) {
      console.error('获取用户信息失败:', error);
      wx.showToast({
        title: '授权失败',
        icon: 'error'
      });
    }
  },
  
  // 重新选择
  reselect() {
    this.setData({
      mediaUrl: '',
      videoFrames: [],
      showResult: false,
      result: null
    });
  },
  
  // 保存结果
  saveResult() {
    if (!this.data.result) {
      wx.showToast({
        title: '没有可保存的结果',
        icon: 'error'
      });
      return;
    }
    
    wx.showActionSheet({
      itemList: ['保存到相册', '分享给朋友'],
      success: (res) => {
        if (res.tapIndex === 0) {
          this.saveToAlbum();
        } else if (res.tapIndex === 1) {
          this.shareResult();
        }
      }
    });
  },
  
  // 保存到相册
  saveToAlbum() {
    wx.showToast({
      title: '功能开发中',
      icon: 'none'
    });
  },
  
  // 分享结果
  shareResult() {
    wx.showToast({
      title: '功能开发中',
      icon: 'none'
    });
  },

  // 保存到历史记录
  async saveToHistory() {
    if (!this.data.result) {
      wx.showToast({
        title: '没有可保存的结果',
        icon: 'error'
      });
      return;
    }

    try {
      // 检查用户授权
      const userProfile = await UserAuthManager.getUserProfile();
      if (!userProfile) {
        wx.showToast({
          title: '请先授权登录',
          icon: 'error'
        });
        return;
      }

      wx.showLoading({
        title: '保存中...'
      });

      // 准备历史记录数据
      const historyData = {
        mediaType: this.data.mediaType,
        mediaUrl: this.data.mediaUrl,
        result: this.data.result,
        createTime: new Date(),
        userId: userProfile.userId
      };

      // 保存到历史记录
      await HistoryManager.saveHistory(historyData);

      wx.hideLoading();
      wx.showToast({
        title: '保存成功',
        icon: 'success'
      });

    } catch (error) {
      console.error('保存历史记录失败:', error);
      wx.hideLoading();
      wx.showToast({
        title: '保存失败',
        icon: 'error'
      });
    }
  },

  // 上传图片方法（添加调试信息）
  async uploadImage(imagePath) {
    console.log('开始上传图片:', imagePath);
    
    return new Promise((resolve, reject) => {
      wx.cloud.uploadFile({
        cloudPath: `fish-images/${Date.now()}-${Math.random().toString(36).substr(2, 9)}.jpg`,
        filePath: imagePath,
        success: (res) => {
          console.log('图片上传成功，云存储ID:', res.fileID);
          console.log('原始文件路径:', imagePath);
          resolve(res.fileID); // 只返回 fileID
        },
        fail: (error) => {
          console.error('图片上传失败:', error);
          console.log('失败的文件路径:', imagePath);
          reject(error);
        }
      });
    });
  },

  // 上传图片方法（兼容性别名）
  async uploadFile(imagePath) {
    return this.uploadImage(imagePath);
  },

  // AI分析方法
  async callGPTSpeciesDetection(fileID) {
    return new Promise((resolve, reject) => {
      wx.cloud.callFunction({
        name: 'fishDetection',
        data: {
          imageFileID: fileID,
          action: 'speciesDetection',
          aiConfig: AI_CONFIG
        },
        success: (res) => {
          if (res.result && res.result.success) {
            resolve(res.result.data);
          } else {
            reject(new Error(res.result?.error || '分析失败'));
          }
        },
        fail: reject
      });
    });
  },

  // 疾病检测方法
  async callGPTDiseaseDetection(fileID) {
    return new Promise((resolve, reject) => {
      wx.cloud.callFunction({
        name: 'fishDetection',
        data: {
          imageFileID: fileID,
          action: 'diseaseDetection',
          aiConfig: AI_CONFIG
        },
        success: (res) => {
          if (res.result && res.result.success) {
            resolve(res.result.data);
          } else {
            reject(new Error(res.result?.error || '分析失败'));
          }
        },
        fail: reject
      });
    });
  },

  // 治疗建议方法
  async callGPTTreatmentAdvice(analysisData) {
    return new Promise((resolve, reject) => {
      // 兼容两种调用方式
      let requestData;
      if (typeof analysisData === 'string') {
        // 旧的调用方式：callGPTTreatmentAdvice(species, diseases)
        requestData = {
          action: 'treatmentAdvice',
          species: analysisData,
          diseases: arguments[1],
          aiConfig: AI_CONFIG
        };
      } else {
        // 新的调用方式：callGPTTreatmentAdvice({species, health, disease})
        requestData = {
          action: 'treatmentAdvice',
          species: analysisData.species,
          health: analysisData.health,
          disease: analysisData.disease,
          diseases: analysisData.diseases,
          aiConfig: AI_CONFIG
        };
      }
      
      wx.cloud.callFunction({
        name: 'fishDetection',
        data: requestData,
        success: (res) => {
          if (res.result && res.result.success) {
            resolve(res.result.data);
          } else {
            reject(new Error(res.result?.error || '治疗建议生成失败'));
          }
        },
        fail: reject
      });
    });
  },

  // 提取帧方法（升级到Canvas 2D）
  extractFrameAtTime(videoPath, time, callback) {
    const that = this;
    
    // 创建临时video元素进行截图
    const videoContext = wx.createVideoContext('temp-video', that);
    videoContext.seek(time);
    
    setTimeout(() => {
      // 使用Canvas 2D截图
      const query = wx.createSelectorQuery().in(that);
      query.select('#frame-canvas')
        .node()
        .exec((res) => {
          if (res[0] && res[0].node) {
            const canvas = res[0].node;
            const ctx = canvas.getContext('2d');
            
            // 设置canvas尺寸
            canvas.width = 200;
            canvas.height = 150;
            
            // 获取video节点
            const videoQuery = wx.createSelectorQuery().in(that);
            videoQuery.select('#temp-video')
              .node()
              .exec((videoRes) => {
                if (videoRes[0] && videoRes[0].node) {
                  const videoNode = videoRes[0].node;
                  
                  try {
                    // 绘制视频帧到canvas
                    ctx.drawImage(videoNode, 0, 0, canvas.width, canvas.height);
                    
                    // 导出canvas为临时文件
                    wx.canvasToTempFilePath({
                      canvas: canvas,
                      success: (result) => {
                        callback(result.tempFilePath);
                      },
                      fail: (err) => {
                        console.error('截图失败:', err);
                        callback(null);
                      }
                    }, that);
                  } catch (error) {
                    console.error('Canvas 2D绘制失败:', error);
                    callback(null);
                  }
                } else {
                  console.error('无法获取视频节点');
                  callback(null);
                }
              });
          } else {
            console.error('无法获取Canvas 2D节点');
            callback(null);
          }
        });
    }, 500);
  },

  // 合并视频结果方法
  combineVideoResults(frameResults) {
    if (!frameResults || frameResults.length === 0) {
      return {
        species: '未识别',
        confidence: 0,
        health: '未知',
        diseases: [],
        description: '视频分析失败'
      };
    }

    // 统计物种识别结果
    const speciesCount = {};
    const healthScores = [];
    const allDiseases = [];
    
    frameResults.forEach(result => {
      if (result.species) {
        speciesCount[result.species] = (speciesCount[result.species] || 0) + 1;
      }
      if (result.confidence) {
        healthScores.push(result.confidence);
      }
      if (result.diseases && result.diseases.length > 0) {
        allDiseases.push(...result.diseases);
      }
    });

    // 找出最常见的物种
    const mostCommonSpecies = Object.keys(speciesCount).reduce((a, b) => 
      speciesCount[a] > speciesCount[b] ? a : b
    );

    // 计算平均置信度
    const avgConfidence = healthScores.length > 0 ? 
      Math.round(healthScores.reduce((a, b) => a + b, 0) / healthScores.length) : 0;

    // 统计疾病
    const diseaseCount = {};
    allDiseases.forEach(disease => {
      diseaseCount[disease] = (diseaseCount[disease] || 0) + 1;
    });

    const commonDiseases = Object.keys(diseaseCount)
      .filter(disease => diseaseCount[disease] >= frameResults.length * 0.3)
      .slice(0, 3);

    return {
      species: mostCommonSpecies,
      confidence: avgConfidence,
      health: avgConfidence > 70 ? '健康' : avgConfidence > 50 ? '一般' : '需要关注',
      diseases: commonDiseases,
      description: `基于${frameResults.length}帧分析的综合结果`,
      frameCount: frameResults.length,
      detectionRate: (Object.values(speciesCount).reduce((a, b) => a + b, 0) / frameResults.length * 100).toFixed(1) + '%'
    };
  },

  // 重新选择媒体
  onReselect() {
    this.setData({
      mediaType: 'image',
      mediaUrl: '',
      mediaSize: '',
      videoDuration: 0,
      videoFrames: [],
      selectedFrame: 0,
      result: null,
      showResult: false,
      isAnalyzing: false,
      loadingText: '',
      loadingProgress: '',
      videoAnalysisProgress: null,
      // 清理显示媒体字段
      displayMediaType: '',
      displayMediaUrl: ''
    });
  },

  // 媒体选择完成事件处理
  // 在onMediaSelected方法前添加以下方法
  
  // 开始分析方法
  async startAnalysis() {
    if (!this.data.mediaUrl) {
      wx.showToast({
        title: '请先选择图片或视频',
        icon: 'none'
      });
      return;
    }
  
    this.setData({ isAnalyzing: true });
  
    try {
      if (this.data.mediaType === 'image') {
        await this.analyzeImage(this.data.mediaUrl);
      } else if (this.data.mediaType === 'video') {
        await this.analyzeVideo(this.data.mediaUrl);
      }
    } catch (error) {
      console.error('分析失败:', error);
      wx.showToast({
        title: '分析失败，请重试',
        icon: 'none'
      });
    } finally {
      this.setData({ isAnalyzing: false });
    }
  },
  
  async analyzeImage(imagePath) {
    this.setData({
      isAnalyzing: true,
      analysisProgress: 0,
      showResult: false,
      result: null
    });

    try {
      console.log('开始图片分析:', imagePath);
      
      // 压缩图片
      const compressedImagePath = await this.compressImage(imagePath);
      console.log('图片压缩完成:', compressedImagePath);
      this.updateAnalysisProgress(20);

      // 上传图片到云存储
      const fileID = await this.uploadFile(compressedImagePath);
      console.log('图片上传完成:', fileID);
      this.updateAnalysisProgress(40);

      // 调用物种识别
      console.log('开始物种识别...');
      const speciesResult = await this.callGPTSpeciesDetection(fileID);
      console.log('物种识别结果:', speciesResult);
      this.updateAnalysisProgress(60);

      // 调用疾病检测
      console.log('开始疾病检测...');
      const diseaseResult = await this.callGPTDiseaseDetection(fileID);
      console.log('疾病检测结果:', diseaseResult);
      this.updateAnalysisProgress(80);

      // 调用治疗建议
      console.log('开始生成治疗建议...');
      const treatmentResult = await this.callGPTTreatmentAdvice({
        species: speciesResult.species,
        health: diseaseResult.health,
        disease: diseaseResult.disease
      });
      console.log('治疗建议结果:', treatmentResult);
      this.updateAnalysisProgress(100);

      // 组合最终结果
      const finalResult = {
        species: speciesResult.species || '未知',
        confidence: speciesResult.confidence || 0,
        description: speciesResult.description || '暂无描述',
        habitat: speciesResult.habitat || '未知',
        characteristics: speciesResult.characteristics || [],
        health: diseaseResult.health || '未知',
        disease: diseaseResult.disease || '无',
        treatment: treatmentResult.treatment || '暂无建议',
        timestamp: new Date().toISOString()
      };

      console.log('最终分析结果:', finalResult);

      this.setData({
        result: finalResult,
        showResult: true
      });

      console.log('设置结果显示:', {
        result: finalResult,
        showResult: true,
        currentShowResult: this.data.showResult
      });

      // 保存到历史记录
      await this.saveHistory();
      console.log('历史记录保存完成');

      wx.showToast({
        title: '分析完成',
        icon: 'success'
      });

    } catch (error) {
      console.error('图片分析失败:', error);
      wx.showToast({
        title: `分析失败: ${error.message}`,
        icon: 'none',
        duration: 3000
      });
    } finally {
      this.setData({
        isAnalyzing: false
      });
    }
  },
  

  
  // 更新分析进度
  updateAnalysisProgress(progress) {
    console.log('更新分析进度:', progress);
    if (typeof progress === 'number') {
      this.setData({
        analysisProgress: {
          percentage: progress,
          // 您可以根据需要添加其他描述性文本
          text: `分析中... ${progress}%` 
        },
      });
    } else if (typeof progress === 'object' && progress !== null) {
      // 如果progress本身就是期望的对象结构，直接使用
      // 或者根据实际情况调整，确保text等字段存在
      this.setData({
        analysisProgress: {
          percentage: progress.percentage !== undefined ? progress.percentage : this.data.analysisProgress.percentage,
          text: progress.text || (progress.percentage !== undefined ? `分析中... ${progress.percentage}%` : '处理中...')
        }
      });
    } else {
      // 处理其他意外情况，例如设置为一个默认的加载状态对象
      this.setData({
        analysisProgress: {
          percentage: 0,
          text: '正在初始化分析...'
        }
      });
    }
    console.log('更新后 analysisProgress:', this.data.analysisProgress);
  },

  // 综合视频分析结果
  combineVideoResults(results) {
    const validResults = results.filter(r => !r.error);
    
    if (validResults.length === 0) {
      throw new Error('所有帧分析都失败了');
    }
    
    // 统计物种识别结果
    const speciesCount = {};
    const healthIssues = [];
    
    validResults.forEach(result => {
      const species = result.species?.species;
      if (species) {
        speciesCount[species] = (speciesCount[species] || 0) + 1;
      }
      
      if (result.health?.diseases) {
        healthIssues.push(...result.health.diseases);
      }
    });
    
    // 确定最可能的物种
    const mostLikelySpecies = Object.keys(speciesCount).reduce((a, b) => 
      speciesCount[a] > speciesCount[b] ? a : b
    );
    
    // 去重健康问题
    const uniqueHealthIssues = [...new Set(healthIssues)];
    
    return {
      species: {
        species: mostLikelySpecies,
        confidence: speciesCount[mostLikelySpecies] / validResults.length,
        details: `在 ${validResults.length} 帧中检测到 ${speciesCount[mostLikelySpecies]} 次`
      },
      health: {
        diseases: uniqueHealthIssues,
        status: uniqueHealthIssues.length > 0 ? '发现健康问题' : '健康状态良好'
      }
    };
  },

  // 媒体类型变化处理
  onMediaTypeChange(e) {
    const { mediaType, mediaUrl } = e.detail;
    console.log('媒体类型变化:', mediaType, mediaUrl);
    
    this.setData({
      mediaType: mediaType,
      mediaUrl: mediaUrl,
      // 重置分析状态
      isAnalyzing: false,
      showResult: false,
      result: null,
      analysisProgress: null
    });
  },

  // 视频帧提取完成处理
  onFramesExtracted(e) {
    const { frames } = e.detail;
    console.log('视频帧提取完成:', frames.length, '帧');
    
    this.setData({
      extractedFrames: frames
    });
    
    // 可以在这里开始分析提取的帧
    if (frames && frames.length > 0) {
      wx.showToast({
        title: `提取了${frames.length}帧`,
        icon: 'success'
      });
    }
  },

  // 视频帧截取方法（升级到Canvas 2D）
  captureVideoFrame(time, callback) {
    const that = this;
    
    try {
      console.log('开始截取视频帧，时间:', time);
      
      // 创建video上下文并定位到指定时间
      const videoContext = wx.createVideoContext('temp-video', that);
      videoContext.seek(time);
      
      setTimeout(() => {
        // 使用Canvas 2D接口截取视频帧
        const query = wx.createSelectorQuery().in(that);
        query.select('#temp-canvas')
          .node()
          .exec((res) => {
            if (res[0] && res[0].node) {
              const canvas = res[0].node;
              const ctx = canvas.getContext('2d');
              
              // 设置canvas尺寸
              canvas.width = 640;
              canvas.height = 480;
              
              // 获取video节点
              const videoQuery = wx.createSelectorQuery().in(that);
              videoQuery.select('#temp-video')
                .node()
                .exec((videoRes) => {
                  if (videoRes[0] && videoRes[0].node) {
                    const videoNode = videoRes[0].node;
                    
                    try {
                      // 绘制当前视频帧到canvas
                      ctx.drawImage(videoNode, 0, 0, canvas.width, canvas.height);
                      
                      // 转换为临时文件
                      wx.canvasToTempFilePath({
                        canvas: canvas,
                        success: (result) => {
                          console.log('视频帧截取成功:', result.tempFilePath);
                          if (callback) callback(result.tempFilePath);
                        },
                        fail: (err) => {
                          console.error('视频帧截取失败:', err);
                          if (callback) callback(null);
                        }
                      }, that);
                    } catch (error) {
                      console.error('Canvas 2D绘制失败:', error);
                      if (callback) callback(null);
                    }
                  } else {
                    console.error('无法获取视频节点');
                    if (callback) callback(null);
                  }
                });
            } else {
              console.error('无法获取Canvas 2D节点');
              if (callback) callback(null);
            }
          });
      }, 800); // 等待视频定位完成
    } catch (error) {
      console.error('captureVideoFrame 错误:', error);
      if (callback) callback(null);
    }
  },
  
    async captureVideoFrameWithCanvas(videoPath) {
    console.log('开始视频抽帧，优先使用后端服务');
    
    // 优先尝试后端抽帧
    try {
      const frameUrl = await this.captureVideoFrameWithBackend(videoPath);
      console.log('后端抽帧成功:', frameUrl);
      return frameUrl;
    } catch (backendError) {
      console.warn('后端抽帧失败，使用Canvas降级方案:', backendError.message);
    }
    
    // 如果后端失败，使用原来的Canvas方案（作为降级）
    console.log('使用Canvas降级抽帧方案');
    const videoContext = wx.createVideoContext('preview-video', this);

    return new Promise((resolve, reject) => {
        // 确保视频加载完成并播放到第一帧
        videoContext.seek(0);
        videoContext.play();

        const onTimeUpdate = (e) => {
            // 确保视频已经播放到第一帧或接近第一帧
            if (e.detail.currentTime >= 0 && e.detail.duration > 0) {
                videoContext.pause();
                videoContext.off('timeupdate', onTimeUpdate);

                wx.createSelectorQuery().in(this).select('#videoCanvas').fields({ node: true, size: true }).exec((res) => {
                    const canvas = res[0].node;
                    const ctx = canvas.getContext('2d');
                    const dpr = wx.getSystemInfoSync().pixelRatio;

                    canvas.width = res[0].width * dpr;
                    canvas.height = res[0].height * dpr;
                    ctx.scale(dpr, dpr);

                    // 创建占位图作为降级方案
                    ctx.fillStyle = '#f0f0f0';
                    ctx.fillRect(0, 0, canvas.width, canvas.height);
                    
                    ctx.fillStyle = '#666';
                    ctx.font = '16px Arial';
                    ctx.textAlign = 'center';
                    ctx.fillText('视频帧截取', canvas.width/2, canvas.height/2 - 10);
                    ctx.fillText('(降级方案)', canvas.width/2, canvas.height/2 + 10);

                    wx.canvasToTempFilePath({
                        canvas: canvas,
                        x: 0,
                        y: 0,
                        width: canvas.width,
                        height: canvas.height,
                        destWidth: canvas.width,
                        destHeight: canvas.height,
                        success: (res) => {
                            console.log('Canvas降级截图成功:', res.tempFilePath);
                            resolve(res.tempFilePath);
                        },
                        fail: (err) => {
                            console.error('Canvas降级截图失败:', err);
                            reject(new Error('Canvas降级截图失败'));
                        }
                    }, this);
                });
            }
        };

        videoContext.on('timeupdate', onTimeUpdate);
        videoContext.on('error', (err) => {
            console.error('视频播放错误:', err);
            videoContext.off('timeupdate', onTimeUpdate);
            reject(new Error('视频播放错误，无法截图。'));
        });
    });
  },

  // 降级Canvas方案
  fallbackCanvasCapture() {
    return new Promise((resolve, reject) => {
      const query = wx.createSelectorQuery().in(this);
      query.select('#video-canvas')
        .node()
        .exec((res) => {
          if (res[0] && res[0].node) {
            const canvas = res[0].node;
            const ctx = canvas.getContext('2d');
            
            canvas.width = 300;
            canvas.height = 200;
            
            // 创建一个带有提示信息的占位图
            ctx.fillStyle = '#f0f0f0';
            ctx.fillRect(0, 0, 300, 200);
            
            ctx.fillStyle = '#666';
            ctx.font = '16px Arial';
            ctx.textAlign = 'center';
            ctx.fillText('视频帧截取', 150, 90);
            ctx.fillText('(占位图片)', 150, 110);
            
            wx.canvasToTempFilePath({
              canvas: canvas,
              success: (result) => {
                console.log('占位图创建成功:', result.tempFilePath);
                resolve(result.tempFilePath);
              },
              fail: reject
            }, this);
          } else {
            reject(new Error('无法获取Canvas节点'));
          }
        });
    });
  },

  // 创建占位图的降级方案
  async createPlaceholderImage() {
    return new Promise((resolve, reject) => {
      const query = wx.createSelectorQuery().in(this);
      query.select('#video-canvas')
        .node()
        .exec((res) => {
          if (res[0] && res[0].node) {
            const canvas = res[0].node;
            const ctx = canvas.getContext('2d');
            
            // 设置canvas尺寸
            canvas.width = 300;
            canvas.height = 200;
            
            // 绘制占位内容
            ctx.fillStyle = '#f0f0f0';
            ctx.fillRect(0, 0, 300, 200);
            
            ctx.fillStyle = '#666';
            ctx.font = '16px Arial';
            ctx.textAlign = 'center';
            ctx.fillText('视频截图失败', 150, 100);
            ctx.fillText('使用占位图片', 150, 120);
            
            // 导出为临时文件
            wx.canvasToTempFilePath({
              canvas: canvas,
              success: (result) => {
                console.log('占位图创建成功:', result.tempFilePath);
                resolve(result.tempFilePath);
              },
              fail: (error) => {
                console.error('占位图创建失败:', error);
                reject(error);
              }
            }, this);
          } else {
            reject(new Error('无法获取Canvas节点'));
          }
        });
    });
  },

  // 新增：调用后端视频抽帧接口
  async captureVideoFrameWithBackend(videoPath) {
    console.log('开始调用后端视频抽帧接口:', videoPath);
    
    try {
      // 检查视频路径是否为本地临时文件
      if (videoPath.includes('__tmp__') || videoPath.includes('127.0.0.1')) {
        console.log('检测到本地临时文件，直接上传到后端');
      }
      
      // 上传视频到后端进行抽帧
      const uploadResult = await new Promise((resolve, reject) => {
        wx.uploadFile({
          url: 'http://localhost:3000/extract-frame', // 后端接口地址
          filePath: videoPath,
          name: 'video',
          header: {
            'Content-Type': 'multipart/form-data'
          },
          success: (res) => {
            console.log('后端抽帧响应:', res);
            try {
              const data = JSON.parse(res.data);
              if (data.success) {
                // 保存frameId用于后续清理
                this.setData({
                  frameId: data.frameId
                });
                resolve(data.frameUrl);
              } else {
                reject(new Error(data.error || '后端抽帧失败'));
              }
            } catch (parseError) {
              console.error('解析后端响应失败:', parseError);
              reject(new Error('解析后端响应失败'));
            }
          },
          fail: (error) => {
            console.error('上传视频到后端失败:', error);
            reject(new Error('上传视频到后端失败: ' + error.errMsg));
          }
        });
      });
      
      console.log('后端抽帧成功，帧图片URL:', uploadResult);
      
      // 下载帧图片到本地临时文件
      const downloadResult = await new Promise((resolve, reject) => {
        wx.downloadFile({
          url: uploadResult,
          success: (res) => {
            if (res.statusCode === 200) {
              console.log('帧图片下载成功:', res.tempFilePath);
              resolve(res.tempFilePath);
            } else {
              reject(new Error('下载帧图片失败，状态码: ' + res.statusCode));
            }
          },
          fail: (error) => {
            console.error('下载帧图片失败:', error);
            reject(new Error('下载帧图片失败: ' + error.errMsg));
          }
        });
      });
      
      return downloadResult;
      
    } catch (error) {
      console.error('后端视频抽帧失败:', error);
      throw error; // 重新抛出错误，让上层处理
    }
  },

  // 添加清理帧文件的方法
  async cleanupFrameFile(frameId) {
    try {
      const response = await wx.request({
        url: 'http://localhost:3000/cleanup-frame/' + frameId,
        method: 'DELETE'
      });
      
      if (response.data.success) {
        console.log('帧文件已清理:', frameId);
      }
    } catch (error) {
      console.error('清理帧文件失败:', error);
    }
  },

  // 带超时处理的Canvas截取方法
  async captureVideoFrameWithTimeout(videoPath, timeout = 10000) {
    return Promise.race([
      this.captureVideoFrameWithCanvas(videoPath),
      new Promise((_, reject) => {
        setTimeout(() => {
          reject(new Error('Canvas截取超时'));
        }, timeout);
      })
    ]);
  },

  // 媒体选择回调
  onMediaSelected(e) {
    const { mediaType, mediaUrl, duration, mediaSize } = e.detail;
    
    // 清理mediaUrl中的反引号和多余空格
    const cleanMediaUrl = mediaUrl ? mediaUrl.trim().replace(/`/g, '') : '';
    
    // 添加参数验证
    if (!cleanMediaUrl) {
      wx.showToast({
        title: '获取媒体文件失败',
        icon: 'none'
      });
      return;
    }
    
    this.setData({
      mediaType: mediaType,
      mediaUrl: cleanMediaUrl,
      mediaSize: mediaSize || '',
      // 重置分析相关状态
      isAnalyzing: false,
      showResult: false,
      result: null,
      analysisProgress: null
    });
    
    if (mediaType === 'video') {
      this.setData({
        videoDuration: duration || 0
      });
    }
    
    // 显示成功提示
    wx.showToast({
      title: mediaType === 'image' ? '图片选择成功' : '视频选择成功',
      icon: 'success',
      duration: 1000
    });
  }

});
