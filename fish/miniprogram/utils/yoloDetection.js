// YOLO 疾病检测模块
class YOLODetection {
  // 调用 YOLO 模型进行疾病检测
  async detectDiseases(imageFileId) {
    try {
      const result = await wx.cloud.callFunction({
        name: 'fishDetection',
        data: {
          action: 'yoloDetection',
          fileID: imageFileId
        }
      });
      
      if (result.result && result.result.success) {
        return {
          success: true,
          detections: result.result.detections,
          confidence: result.result.confidence
        };
      }
      
      return {
        success: false,
        error: result.result?.error || 'YOLO检测失败'
      };
    } catch (error) {
      console.error('YOLO检测调用失败:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }
}

// 导出单例实例 (CommonJS)
const yoloDetection = new YOLODetection();
module.exports = yoloDetection;