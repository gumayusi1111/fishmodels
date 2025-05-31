const { HistoryManager } = require('../../utils/fishDetectUtils.js');

Page({
  data: {
    loading: true,
    historyList: [],
    // 添加详情相关数据
    showDetail: false,
    currentRecord: null,
    // 添加授权状态
    needAuth: false
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
      
      // 检查用户授权状态
      const { UserAuthManager } = require('../../utils/fishDetectUtils');
      const userInfo = UserAuthManager.checkUserAuth();
      
      console.log('用户授权信息:', userInfo); // 添加调试信息
      
      if (!userInfo) {
        console.log('用户未授权，显示授权提示'); // 添加调试信息
        // 用户未授权，显示授权提示
        this.setData({
          loading: false,
          needAuth: true,
          historyList: [],
          debugInfo: '用户未授权' // 添加调试信息
        });
        return;
      }
      
      // 改为静态方法调用
      const { HistoryManager } = require('../../utils/fishDetectUtils');
      const historyList = await HistoryManager.getHistory();
      
      console.log('查询到的历史记录:', historyList);
      console.log('历史记录数量:', historyList.length); // 添加调试信息
      
      // 格式化时间显示
      const formattedList = historyList.map(item => ({
        ...item,
        createTime: this.formatTime(item.createTime)
      }));
      
      this.setData({
        historyList: formattedList,
        loading: false,
        needAuth: false,
        debugInfo: `已加载${formattedList.length}条记录，用户ID: ${userInfo.openid}` // 添加调试信息
      });
    } catch (error) {
      console.error('加载历史记录失败:', error);
      this.setData({ 
        loading: false,
        debugInfo: `加载失败: ${error.message}` // 添加调试信息
      });
      wx.showToast({
        title: '加载失败',
        icon: 'error'
      });
    }
  },

  // 添加用户授权方法
  async getUserProfile() {
    try {
      const { UserAuthManager } = require('../../utils/fishDetectUtils');
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

  // 在viewDetail方法中添加状态映射
  viewDetail(e) {
    const index = e.currentTarget.dataset.index;
    const record = this.data.historyList[index];
    
    // 添加状态类名映射
    const statusClassMap = {
      '健康': 'status-healthy',
      '异常': 'status-abnormal', 
      '疑似': 'status-suspected'
    };
    
    const processedRecord = {
      ...record,
      statusClass: statusClassMap[record.result?.health?.status] || ''
    };
    
    console.log('查看详情:', processedRecord);
    
    this.setData({
      showDetail: true,
      currentRecord: processedRecord
    });
  },

  // 关闭详情
  closeDetail() {
    this.setData({
      showDetail: false,
      currentRecord: null
    });
  },

  // 删除记录
  async deleteRecord(record) {
    try {
      // 改为静态方法调用
      await HistoryManager.deleteHistory(record._id);
      
      wx.showToast({
        title: '删除成功',
        icon: 'success'
      });
      
      // 重新加载历史记录
      this.loadHistory();
    } catch (error) {
      console.error('删除失败:', error);
      wx.showToast({
        title: '删除失败',
        icon: 'error'
      });
    }
  },

  // 分享记录
  shareRecord() {
    const record = this.data.currentRecord;
    if (!record || !record.result) return;
    
    const shareText = `鱼类检测结果：\n品种：${record.result.species?.name || '未知'}\n健康状态：${record.result.health?.status || '未知'}\n置信度：${record.result.species?.confidence || 0}%`;
    
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

  goBack() {
    wx.navigateBack({
      delta: 1
    });
  },
  
  // 处理滑动事件
  onItemMove(e) {
    const { x } = e.detail;
    const index = e.currentTarget.dataset.index;
    const threshold = -120; // 滑动阈值
    
    // 更新当前项的位置
    const historyList = this.data.historyList;
    historyList[index].x = x;
    
    this.setData({
      historyList: historyList
    });
  },
  
  // 处理触摸结束事件
  onItemTouchEnd(e) {
    const { x } = e.detail;
    const index = e.currentTarget.dataset.index;
    const threshold = -60; // 显示删除按钮的阈值
    
    const historyList = this.data.historyList;
    
    // 如果滑动距离超过阈值，显示删除按钮
    if (x < threshold) {
      historyList[index].x = -120;
    } else {
      historyList[index].x = 0;
    }
    
    this.setData({
      historyList: historyList
    });
  },
  
  // 确认删除
  confirmDelete(e) {
    const index = e.currentTarget.dataset.index;
    const record = this.data.historyList[index];
    
    wx.showModal({
      title: '确认删除',
      content: '确定要删除这条历史记录吗？',
      success: (res) => {
        if (res.confirm) {
          this.deleteRecord(record);
        } else {
          // 取消删除，恢复位置
          const historyList = this.data.historyList;
          historyList[index].x = 0;
          this.setData({
            historyList: historyList
          });
        }
      }
    });
  },
});