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
    } catch (error) {
      console.error('分析失败:', error);
      wx.showToast({
        title: '分析失败，请重试',
        icon: 'error'
      });
    } finally {
      this.setData({
        isAnalyzing: false,
        videoAnalysisProgress: null
      });
    }
  },

  // 新增：分析视频
  async analyzeVideo() {
    const { videoFrames, selectedAnalysisMode } = this.data;
    const mode = this.data.analysisModes[selectedAnalysisMode].value;
    
    const frameResults = [];
    const startTime = Date.now();
    
    for (let i = 0; i < videoFrames.length; i++) {
      const frame = videoFrames[i];
      
      // 更新进度
      const progress = Math.round((i / videoFrames.length) * 100);
      const elapsed = (Date.now() - startTime) / 1000;
      const avgTimePerFrame = elapsed / (i + 1);
      const remainingFrames = videoFrames.length - i - 1;
      const eta = Math.round(avgTimePerFrame * remainingFrames);
      
      this.setData({
        loadingText: `正在分析第${i + 1}帧...`,
        loadingProgress: `${progress}%`,
        'videoAnalysisProgress.current': i + 1,
        'videoAnalysisProgress.percent': progress,
        'videoAnalysisProgress.step': `分析第${i + 1}帧`,
        'videoAnalysisProgress.eta': `${eta}秒`
      });
      
      try {
        // 上传帧图片
        const uploadResult = await this.uploadImage(frame.url);
        
        // 分析帧
        const speciesResult = await this.callGPTSpeciesDetection(uploadResult);
        const diseaseResult = await this.callGPTDiseaseDetection(uploadResult);
        
        frameResults.push({
          frameIndex: i,
          time: frame.time,
          species: speciesResult.species,
          confidence: speciesResult.confidence,
          health: diseaseResult.health,
          diseases: diseaseResult.diseases
        });
        
        // 更新帧结果
        this.setData({
          [`videoFrames[${i}].analysisResult`]: {
            species: speciesResult.species,
            confidence: speciesResult.confidence
          }
        });
        
      } catch (error) {
        console.error(`分析第${i + 1}帧失败:`, error);
        frameResults.push({
          frameIndex: i,
          time: frame.time,
          error: '分析失败'
        });
      }
    }
    
    // 综合分析结果
    const finalResult = this.combineVideoResults(frameResults);
    
    // 获取治疗建议
    if (finalResult.species && finalResult.diseases.length > 0) {
      this.getTreatmentAdvice(finalResult);
    }
    
    this.setData({
      result: finalResult,
      showResult: true
    });
    
    // 保存历史记录
    this.saveHistory();
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

  // 上传图片方法
  async uploadImage(imagePath) {
    return new Promise((resolve, reject) => {
      wx.cloud.uploadFile({
        cloudPath: `fish-images/${Date.now()}-${Math.random().toString(36).substr(2, 9)}.jpg`,
        filePath: imagePath,
        success: (res) => {
          console.log('图片上传成功:', res.fileID);
          resolve(res.fileID); // 只返回 fileID
        },
        fail: reject
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

  // 提取帧方法
  extractFrameAtTime(videoPath, time, callback) {
    const that = this;
    
    // 创建临时video元素进行截图
    const videoContext = wx.createVideoContext('temp-video', that);
    videoContext.seek(time);
    
    setTimeout(() => {
      // 使用canvas截图
      const canvas = wx.createCanvasContext('frame-canvas', that);
      canvas.drawImage(videoPath, 0, 0, 200, 150);
      canvas.draw(false, () => {
        wx.canvasToTempFilePath({
          canvasId: 'frame-canvas',
          success: (res) => {
            callback(res.tempFilePath);
          },
          fail: (err) => {
            console.error('截图失败:', err);
            callback(null);
          }
        }, that);
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
      mediaUrl: '',
      mediaType: 'image',
      mediaSize: '',
      videoDuration: 0,
      videoFrames: [],
      isAnalyzing: false,
      showResult: false,
      result: null,
      analysisProgress: null
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
  
  // 视频分析方法（如果还没有的话）
  async analyzeVideo(videoPath) {
    try {
      // 如果视频帧还没有提取，先提取
      if (!this.data.videoFrames || this.data.videoFrames.length === 0) {
        await this.extractVideoFrames(videoPath);
      }
      
      const frames = this.data.videoFrames;
      const results = [];
      
      // 分析每一帧
      for (let i = 0; i < frames.length; i++) {
        const frame = frames[i];
        
        // 更新进度
        this.updateAnalysisProgress({
          current: i + 1,
          total: frames.length,
          status: `正在分析第 ${i + 1} 帧...`
        });
        
        try {
          // 上传帧图片
          const fileID = await this.uploadImage(frame.url);
          
          // 分析物种和健康状态
          const speciesResult = await this.callGPTSpeciesDetection(fileID);
          const diseaseResult = await this.callGPTDiseaseDetection(fileID);
          
          results.push({
            frameIndex: i,
            timestamp: frame.time,
            species: speciesResult,
            health: diseaseResult
          });
          
        } catch (frameError) {
          console.error(`第 ${i + 1} 帧分析失败:`, frameError);
          results.push({
            frameIndex: i,
            timestamp: frame.time,
            error: frameError.message
          });
        }
      }
      
      // 综合分析结果
      const combinedResult = this.combineVideoResults(results);
      
      // 生成治疗建议
      const treatmentAdvice = await this.callGPTTreatmentAdvice(
        combinedResult.species.species,
        combinedResult.health.diseases
      );
      
      const finalResult = {
        type: 'video',
        species: combinedResult.species,
        health: combinedResult.health,
        treatment: treatmentAdvice,
        frames: results,
        timestamp: new Date().toISOString()
      };
      
      this.setData({ result: finalResult });
      
      // 保存到历史记录
      await this.saveHistory(finalResult);
      
      wx.showToast({
        title: '视频分析完成',
        icon: 'success'
      });
      
    } catch (error) {
      console.error('视频分析失败:', error);
      throw error;
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
      this.extractVideoFrames(cleanMediaUrl);
    }
    
    // 显示成功提示
    wx.showToast({
      title: mediaType === 'image' ? '图片选择成功' : '视频选择成功',
      icon: 'success',
      duration: 1000
    });
  }

});
