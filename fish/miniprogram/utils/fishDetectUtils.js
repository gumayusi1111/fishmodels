// 鱼类检测工具函数

// 格式化文件大小
function formatFileSize(bytes) {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

// 生成关键帧时间点
function generateKeyFrameTimePoints(duration, frameCount) {
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
}

// 综合视频分析结果
function synthesizeVideoAnalysis(frameResults) {
  if (!frameResults || frameResults.length === 0) {
    return {
      species: '未识别',
      confidence: 0,
      description: '视频分析失败'
    };
  }
  
  // 统计各种识别结果
  const speciesCount = {};
  const healthCount = {};
  const diseaseCount = {};
  let totalConfidence = 0;
  let validResults = 0;
  
  frameResults.forEach(result => {
    if (result.analysis && result.analysis.species) {
      const species = result.analysis.species;
      speciesCount[species] = (speciesCount[species] || 0) + 1;
      totalConfidence += result.analysis.confidence || 0;
      validResults++;
      
      // 统计健康状况
      if (result.analysis.health) {
        healthCount[result.analysis.health] = (healthCount[result.analysis.health] || 0) + 1;
      }
      
      // 统计疾病
      if (result.analysis.diseases && result.analysis.diseases.length > 0) {
        result.analysis.diseases.forEach(disease => {
          diseaseCount[disease] = (diseaseCount[disease] || 0) + 1;
        });
      }
    }
  });
  
  // 找出最常见的品种
  const mostCommonSpecies = Object.keys(speciesCount).reduce((a, b) => 
    speciesCount[a] > speciesCount[b] ? a : b
  );
  
  // 找出最常见的健康状况
  const mostCommonHealth = Object.keys(healthCount).length > 0 ? 
    Object.keys(healthCount).reduce((a, b) => healthCount[a] > healthCount[b] ? a : b) : '健康';
  
  // 找出最常见的疾病
  const commonDiseases = Object.keys(diseaseCount).sort((a, b) => diseaseCount[b] - diseaseCount[a]);
  
  const avgConfidence = validResults > 0 ? totalConfidence / validResults : 0;
  
  return {
    species: mostCommonSpecies,
    confidence: Math.round(avgConfidence),
    health: mostCommonHealth,
    diseases: commonDiseases,
    description: `基于${frameResults.length}帧分析的综合结果`,
    frameCount: frameResults.length,
    validFrameCount: validResults,
    detectionRate: validResults > 0 ? (validResults / frameResults.length * 100).toFixed(1) + '%' : '0%'
  };
}

// 用户授权相关
class UserAuthManager {
  static async getUserProfile() {
    return new Promise((resolve, reject) => {
      wx.getUserProfile({
        desc: '用于保存和查看历史记录',
        success: async (res) => {
          try {
            // 获取 openid
            const loginRes = await wx.cloud.callFunction({
              name: 'login'
            });
            
            const userInfo = {
              ...res.userInfo,
              openid: loginRes.result.openid
            };
            
            // 保存用户信息到本地存储
            wx.setStorageSync('userInfo', userInfo);
            
            // 保存用户信息到数据库
            const db = wx.cloud.database();
            const usersCollection = db.collection('users');
            
            await usersCollection.doc(userInfo.openid).set({
              data: {
                openid: userInfo.openid,
                nickName: userInfo.nickName,
                avatarUrl: userInfo.avatarUrl,
                lastLoginTime: new Date(),
                createTime: new Date()
              }
            });
            
            resolve(userInfo);
          } catch (error) {
            reject(error);
          }
        },
        fail: (error) => {
          reject(error);
        }
      });
    });
  }
  
  static checkUserAuth() {
    return wx.getStorageSync('userInfo');
  }
}

// 历史记录管理
class HistoryManager {
  static async saveHistory(data) {
    const { result, mediaType, mediaUrl } = data;
    
    if (!result) {
      console.log('没有分析结果，跳过保存历史记录');
      return;
    }
    
    try {
      // 获取用户信息
      const userInfo = UserAuthManager.checkUserAuth();
      if (!userInfo) {
        console.log('用户未授权，跳过保存历史记录');
        return;
      }
      
      const db = wx.cloud.database();
      const historyCollection = db.collection('fish_detection_history');
      
      const historyData = {
        userId: userInfo.openid,
        // 移除 _openid 字段，系统会自动添加
        userNickName: userInfo.nickName,
        userAvatarUrl: userInfo.avatarUrl,
        mediaType: mediaType,
        mediaUrl: mediaUrl,
        result: result,
        createTime: new Date(),
        timestamp: Date.now()
      };
      
      await historyCollection.add({
        data: historyData
      });
      
      console.log('历史记录保存成功');
      return true;
    } catch (error) {
      console.error('保存历史记录失败:', error);
      return false;
    }
  }

  static async getHistory() {
    try {
      // 获取用户信息
      const userInfo = UserAuthManager.checkUserAuth();
      if (!userInfo) {
        console.log('用户未授权，无法获取历史记录');
        return [];
      }

      const db = wx.cloud.database();
      const historyCollection = db.collection('fish_detection_history');
      
      const result = await historyCollection
        .where({
          userId: userInfo.openid
        })
        .orderBy('createTime', 'desc')
        .get();
      
      console.log('查询历史记录成功:', result.data);
      return result.data;
    } catch (error) {
      console.error('查询历史记录失败:', error);
      throw error;
    }
  }

  static async deleteHistory(recordId) {
    try {
      const db = wx.cloud.database();
      const historyCollection = db.collection('fish_detection_history');
      
      await historyCollection.doc(recordId).remove();
      console.log('删除历史记录成功');
      return true;
    } catch (error) {
      console.error('删除历史记录失败:', error);
      throw error;
    }
  }
}

module.exports = {
  formatFileSize,
  generateKeyFrameTimePoints,
  synthesizeVideoAnalysis,
  UserAuthManager,
  HistoryManager
};