const { HistoryManager, UserAuthManager } = require('../../utils/fishDetectUtils.js');

Page({
  data: {
    loading: true,
    historyList: [],
    needAuth: false,
    // 详情模态框相关
    showDetailModal: false,
    currentDetail: null
  },

  onLoad() {
    this.loadHistory();
  },

  onShow() {
    // 每次显示页面时刷新历史记录
    this.loadHistory();
  },

  async loadHistory() {
    try {
      this.setData({ loading: true, needAuth: false });
      
      // 检查云开发初始化状态
      console.log('云开发状态:', wx.cloud);
      
      // 检查用户授权状态
      const userInfo = UserAuthManager.checkUserAuth();
      
      console.log('用户授权信息:', userInfo);
      
      if (!userInfo) {
        console.log('用户未授权，显示授权提示');
        this.setData({
          loading: false,
          needAuth: true,
          historyList: []
        });
        return;
      }
      
      // 测试数据库连接
      const db = wx.cloud.database();
      console.log('数据库实例:', db);
      
      // 获取历史记录
      const historyList = await HistoryManager.getHistory();
      
      console.log('查询到的历史记录:', historyList);
      console.log('历史记录数量:', historyList.length);
      
      if (historyList.length > 0) {
        console.log('第一条记录结构:', historyList[0]);
      }
      
      // 格式化时间显示和处理视频封面
      const formattedList = historyList.map((item, index) => {
        console.log(`记录${index}:`, item);
        
        // 清理 mediaUrl 中的反引号、空格和其他特殊字符
        let cleanMediaUrl = item.mediaUrl || '';
        if (cleanMediaUrl) {
          cleanMediaUrl = cleanMediaUrl.trim().replace(/`/g, '').replace(/"/g, '').replace(/'/g, '');
          console.log(`清理前: ${item.mediaUrl}`);
          console.log(`清理后: ${cleanMediaUrl}`);
        }
        
        // 处理视频封面
        let coverUrl = '';
        if (item.mediaType === 'video' && item.result && item.result.keyFrames && item.result.keyFrames.length > 0) {
          // 使用第一帧作为封面
          coverUrl = item.result.keyFrames[0].frameUrl;
        }
        
        return {
          ...item,
          mediaUrl: cleanMediaUrl,
          coverUrl: coverUrl,
          createTime: this.formatTime(item.createTime)
        };
      });
      
      console.log('格式化后的列表:', formattedList);
      
      this.setData({
        historyList: formattedList,
        loading: false,
        needAuth: false
      }, () => {
        console.log('setData完成，当前historyList长度:', this.data.historyList.length);
        console.log('当前页面数据状态:', {
          loading: this.data.loading,
          needAuth: this.data.needAuth,
          historyListLength: this.data.historyList.length,
          firstItem: this.data.historyList[0]
        });
        
        // 检查页面元素是否存在
        wx.createSelectorQuery().in(this)
          .select('.history-list')
          .boundingClientRect((rect) => {
            console.log('history-list元素信息:', rect);
          }).exec();
      });
    } catch (error) {
      console.error('加载历史记录失败:', error);
      console.error('错误详情:', error.message);
      console.error('错误堆栈:', error.stack);
      
      this.setData({ 
        loading: false
      });
      
      wx.showToast({
        title: '加载失败: ' + error.message,
        icon: 'none',
        duration: 3000
      });
    }
  },

  // 用户授权方法
  async getUserProfile() {
    try {
      await UserAuthManager.getUserProfile();
      wx.showToast({
        title: '授权成功',
        icon: 'success'
      });
      // 重新加载历史记录
      this.loadHistory();
    } catch (error) {
      console.error('授权失败:', error);
      wx.showToast({
        title: '授权失败',
        icon: 'error'
      });
    }
  },

  formatTime(time) {
    const date = new Date(time);
    const now = new Date();
    const diff = now - date;
    
    if (diff < 60000) { // 1分钟内
      return '刚刚';
    } else if (diff < 3600000) { // 1小时内
      return Math.floor(diff / 60000) + '分钟前';
    } else if (diff < 86400000) { // 1天内
      return Math.floor(diff / 3600000) + '小时前';
    } else {
      return date.toLocaleDateString() + ' ' + date.toLocaleTimeString().slice(0, 5);
    }
  },

  // 显示详情
  showDetail(e) {
    const item = e.currentTarget.dataset.item;
    this.setData({
      currentDetail: item,
      showDetailModal: true
    });
  },

  // 隐藏详情
  hideDetail() {
    this.setData({
      showDetailModal: false,
      currentDetail: null
    });
  },

  // 分享详情
  shareDetail() {
    const record = this.data.currentDetail;
    if (!record || !record.result) {
      wx.showToast({
        title: '没有可分享的内容',
        icon: 'none'
      });
      return;
    }
    
    const shareText = `鱼类检测结果：\n品种：${record.result.species?.name || record.result.species || '未知'}\n置信度：${record.result.species?.confidence || record.result.confidence || 0}%\n检测时间：${record.createTime}`;
    
    wx.setClipboardData({
      data: shareText,
      success: () => {
        wx.showToast({
          title: '已复制到剪贴板',
          icon: 'success'
        });
      }
    });
  },

  // 删除历史记录
  async deleteHistory(e) {
    const id = e.currentTarget.dataset.id;
    
    const res = await wx.showModal({
      title: '确认删除',
      content: '确定要删除这条历史记录吗？',
      confirmText: '删除',
      confirmColor: '#ff4d4f'
    });
    
    if (res.confirm) {
      try {
        wx.showLoading({ title: '删除中...' });
        
        await HistoryManager.deleteHistory(id);
        
        // 重新加载历史记录
        await this.loadHistory();
        
        // 关闭详情模态框
        this.hideDetail();
        
        wx.hideLoading();
        wx.showToast({
          title: '删除成功',
          icon: 'success'
        });
      } catch (error) {
        console.error('删除历史记录失败:', error);
        wx.hideLoading();
        wx.showToast({
          title: '删除失败',
          icon: 'error'
        });
      }
    }
  },

  // 图片加载错误处理
  onImageError(e) {
    console.log('图片加载失败:', e.detail);
    // 可以设置默认图片
    const index = e.currentTarget.dataset.index;
    if (index !== undefined) {
      console.log('图片加载失败:', this.data.historyList[index]?.mediaUrl);
      
      // 设置默认占位图
      const updateKey = `historyList[${index}].mediaUrl`;
      this.setData({
        [updateKey]: '/images/placeholder.png'
      });
    }
  },

  // 返回上一页
  goBack() {
    wx.navigateBack({
      delta: 1
    });
  },

  // 页面状态检查方法
  checkPageState() {
    const { loading, needAuth, historyList } = this.data;
    console.log('页面状态检查:', {
      loading,
      needAuth,
      historyListLength: historyList.length,
      shouldShowList: !loading && !needAuth && historyList.length > 0,
      shouldShowEmpty: !loading && !needAuth && historyList.length === 0
    });
  }
});