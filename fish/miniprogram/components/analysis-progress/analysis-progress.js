Component({
  properties: {
    isAnalyzing: {
      type: Boolean,
      value: false
    },
    mediaType: {
      type: String,
      value: 'image'
    },
    progress: {
      type: Object,
      value: null
    }
  },
  
  data: {
    loadingTexts: {
      image: ['正在上传图片...', 'AI分析中...', '生成诊断报告...'],
      video: ['正在提取关键帧...', '分析视频内容...', '综合分析结果...']
    },
    currentTextIndex: 0
  },
  
  lifetimes: {
    attached() {
      this.startLoadingAnimation();
    },
    
    detached() {
      this.stopLoadingAnimation();
    }
  },
  
  methods: {
    startLoadingAnimation() {
      if (this.loadingTimer) return;
      
      this.loadingTimer = setInterval(() => {
        if (!this.properties.isAnalyzing) return;
        
        const texts = this.data.loadingTexts[this.properties.mediaType];
        const nextIndex = (this.data.currentTextIndex + 1) % texts.length;
        this.setData({ currentTextIndex: nextIndex });
      }, 2000);
    },
    
    stopLoadingAnimation() {
      if (this.loadingTimer) {
        clearInterval(this.loadingTimer);
        this.loadingTimer = null;
      }
    }
  }
});