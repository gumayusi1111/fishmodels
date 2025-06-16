// Remove these ES6 import lines:
// import knowledgeBase from '../../utils/knowledgeBase.js';
// import yoloDetection from '../../utils/yoloDetection.js';

// Replace with CommonJS require:
const knowledgeBase = require('../../utils/knowledgeBase.js');
const yoloDetection = require('../../utils/yoloDetection.js');
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

  // 改进的视频分析方法
  async analyzeVideo(videoPath) {
    try {
      this.updateAnalysisProgress(10);
      
      // 1. 调用后端抽帧
      const frameUrl = await this.captureVideoFrameWithBackend(videoPath);
      
      this.updateAnalysisProgress(40);
      
      // 2. 上传帧图片
      const fileID = await this.uploadImage(frameUrl);
      
      // 3. 分析帧图片（复用图片分析逻辑）
      await this.analyzeImage(frameUrl);
      
      // 4. 清理后端临时文件
      if (this.data.frameId) {
        await this.cleanupFrameFile(this.data.frameId);
      }
      
    } catch (error) {
      console.error('视频分析失败:', error);
      wx.showToast({
        title: '视频分析失败: ' + error.message,
        icon: 'none'
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
      
      // 移除自动保存逻辑
      // if (this.data.result) {
      //   this.saveHistory();
      // }
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
  
  // 改进的图片分析方法
  async analyzeImage(imagePath) {
    try {
      this.updateAnalysisProgress(10);
      
      // 1. 压缩并上传图片
      const compressedPath = await this.compressImage(imagePath);
      const fileID = await this.uploadImage(compressedPath);
      
      this.updateAnalysisProgress(30);
      
      // 2. 确保知识库已加载
      if (!knowledgeBase.diseaseDatabase) {
        await knowledgeBase.loadKnowledgeBase();
      }
      
      this.updateAnalysisProgress(40);
      
      // 3. 并行执行物种识别和YOLO疾病检测
      const [speciesResult, yoloResult] = await Promise.all([
        this.callGPTSpeciesDetection(fileID),
        yoloDetection.detectDiseases(fileID)
      ]);
      
      this.updateAnalysisProgress(70);
      
      // 4. 综合分析
      const comprehensiveResult = await knowledgeBase.comprehensiveAnalysis(
        speciesResult, 
        yoloResult,
        AI_CONFIG  // 添加这个参数
      );
      
      this.updateAnalysisProgress(100);
      
      // 5. 显示结果
      this.setData({
        result: comprehensiveResult,
        showResult: true
      });
      
    } catch (error) {
      console.error('图片分析失败:', error);
      wx.showToast({
        title: '分析失败: ' + error.message,
        icon: 'none'
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
      const res = await new Promise((resolve, reject) => {
        wx.request({
          url: `http://127.0.0.1:3000/cleanup-frame/${frameId}`,
          method: 'DELETE',
          success: resolve,
          fail: reject
        });
      });
      if (res && res.data && res.data.success) {
        console.log('帧文件已删除');
      } else {
        console.log('帧文件删除接口响应异常');
      }
    } catch (error) {
      console.warn('清理帧文件失败:', error);
    }
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
