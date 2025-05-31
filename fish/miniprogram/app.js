const { CLOUD_CONFIG } = require('./config/env.js');

App({
  async onLaunch() {
    // 初始化云开发
    if (!wx.cloud) {
      console.error('请使用 2.2.3 或以上的基础库以使用云能力');
    } else {
      wx.cloud.init({
        env: CLOUD_CONFIG.envId,
        traceUser: true,
      });
      console.log('云开发初始化成功，当前环境：', CLOUD_CONFIG.currentEnv);
      
      // 自动初始化数据库
      await this.initDatabase();
    }
  },
  
  // 初始化数据库
  async initDatabase() {
    try {
      const result = await wx.cloud.callFunction({
        name: 'initDatabase'
      });
      
      if (result.result.success) {
        console.log('数据库初始化结果:', result.result.results);
        
        // 检查是否有创建失败的集合
        const failedCollections = result.result.results.filter(r => r.status === 'error');
        if (failedCollections.length > 0) {
          console.warn('部分数据库集合创建失败:', failedCollections);
        }
      } else {
        console.error('数据库初始化失败:', result.result.error);
      }
    } catch (error) {
      console.error('调用数据库初始化函数失败:', error);
      // 不影响应用正常启动
    }
  },
  
  globalData: {
    userInfo: null
  }
});
