// YOLO 疾病检测模块
class YOLODetection {
  // 调用 YOLO 模型进行疾病检测 (本地优先)
  async detectDiseases(imagePathOrId) {
    try {
      // 判断是否为本地临时文件路径（小程序通常以 wxfile:// 开头）
      const isLocalFile = /^(wxfile|file):\/\//.test(imagePathOrId);

      let localPath = imagePathOrId;

      // 如果是云文件 ID，先换取临时 URL 并下载到本地
      if (!isLocalFile) {
        const cloudRes = await wx.cloud.getTempFileURL({ fileList: [imagePathOrId] });
        const tempUrl = cloudRes.fileList[0].tempFileURL;
        const dlResPath = await new Promise((resolve, reject) => {
          wx.downloadFile({
            url: tempUrl,
            success: res => {
              if (res.statusCode === 200) return resolve(res.tempFilePath);
              reject(new Error('下载云文件失败'));
            },
            fail: err => reject(err)
          });
        });
        localPath = dlResPath;
      }

      // 1) 调用本地后端推理
      const uploadRes = await new Promise((resolve, reject) => {
        wx.uploadFile({
          url: 'http://127.0.0.1:3000/predict',
          filePath: localPath,
          name: 'image',
          success: res => resolve(res),
          fail: err => reject(err)
        });
      });

      const data = JSON.parse(uploadRes.data || '{}');
      console.log('[本地 /predict 返回]', data);
      if (data.success) {
        // 后端已仅返回 topClass，无需再计算
        return data;
      }
      throw new Error(data.error || '本地推理失败');
    } catch (localError) {
      console.warn('本地推理失败，尝试云函数：', localError.message);

      // 2) 退回云函数（保持兼容）
      try {
        const cloudResult = await wx.cloud.callFunction({
          name: 'fishDetection',
          data: { action: 'yoloDetection', fileID: imagePathOrId }
        });
        if (cloudResult.result && cloudResult.result.success) {
          console.log('[云函数 yoloDetection 返回]', cloudResult.result);
          return cloudResult.result;
        }
        return { success: false, error: cloudResult.result?.error || '云函数YOLO检测失败' };
      } catch (e) {
        return { success: false, error: e.message };
      }
    }
  }
}

// 导出单例实例 (CommonJS)
const yoloDetection = new YOLODetection();
module.exports = yoloDetection;