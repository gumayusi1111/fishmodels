Component({
  properties: {
    result: {
      type: Object,
      value: null
    },
    mediaType: {
      type: String,
      value: 'image'
    },
    showResult: {
      type: Boolean,
      value: false
    }
  },
  
  data: {
    expandedSections: {
      basic: true,
      detailed: false,
      advice: false,
      trend: false
    }
  },
  
  methods: {
    // 切换展开状态
    toggleSection(e) {
      const section = e.currentTarget.dataset.section;
      const key = `expandedSections.${section}`;
      this.setData({
        [key]: !this.data.expandedSections[section]
      });
    },
    
    // 保存结果（原有功能保持不变）
    saveResult() {
      this.triggerEvent('saveResult');
    },
    
    // 保存到历史记录（新增）
    saveToHistory() {
      this.triggerEvent('saveToHistory');
    },
    
    // 分享结果
    shareResult() {
      this.triggerEvent('shareResult');
    },
    
    // 查看历史
    viewHistory() {
      this.triggerEvent('viewHistory');
    },
    
    // 重新选择
    reselect() {
      this.triggerEvent('reselect');
    }
  }
});