Component({
  properties: {
    mediaType: {
      type: String,
      value: 'auto' // 改为自动检测
    }
  },

  data: {
    // 移除 mediaOptions 数组
  },

  methods: {
    // 移除 selectMediaType 方法

    // 选择媒体文件 - 支持图片和视频
    chooseMedia() {
      wx.chooseMedia({
        count: 1,
        mediaType: ['image', 'video'], // 同时支持图片和视频
        sourceType: ['album', 'camera'],
        maxDuration: 30, // 视频最长30秒
        camera: 'back',
        success: (res) => {
          const media = res.tempFiles[0];
          const mediaType = media.fileType; // 'image' 或 'video'
          
          // 触发事件给父组件
          this.triggerEvent('mediaSelected', {
            mediaType: mediaType,
            mediaUrl: media.tempFilePath,
            mediaSize: this.formatFileSize(media.size),
            duration: media.duration || 0
          });
          
          // 同时触发类型变化事件
          this.triggerEvent('mediaTypeChange', {
            mediaType: mediaType,
            mediaUrl: media.tempFilePath
          });
        },
        fail: (err) => {
          console.error('选择媒体失败:', err);
          wx.showToast({
            title: '选择失败',
            icon: 'error'
          });
        }
      });
    },

    // 格式化文件大小
    formatFileSize(bytes) {
      if (bytes === 0) return '0 B';
      const k = 1024;
      const sizes = ['B', 'KB', 'MB', 'GB'];
      const i = Math.floor(Math.log(bytes) / Math.log(k));
      return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    }
  }
});