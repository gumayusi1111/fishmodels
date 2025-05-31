Component({
  properties: {
    mediaType: {
      type: String,
      value: 'image'
    }
  },

  data: {
    mediaOptions: [
      { 
        type: 'image', 
        text: '图片识别', 
        icon: '📷', // 使用emoji或者设置为空
        useTextIcon: true // 标记使用文字图标
      },
      { 
        type: 'video', 
        text: '视频分析', 
        icon: '🎬', // 使用emoji或者设置为空
        useTextIcon: true // 标记使用文字图标
      }
    ]
  },

  methods: {
    // 选择媒体类型
    selectMediaType(e) {
      const type = e.currentTarget.dataset.type;
      this.setData({ mediaType: type });
      
      // 触发事件给父组件
      this.triggerEvent('mediaTypeChange', { type });
    },

    // 选择媒体文件
    chooseMedia() {
      if (this.data.mediaType === 'image') {
        this.chooseImage();
      } else {
        this.chooseVideo();
      }
    },

    // 选择图片
    chooseImage() {
      wx.chooseMedia({
        count: 1,
        mediaType: ['image'],
        sourceType: ['album', 'camera'],
        camera: 'back',
        success: (res) => {
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
          
          this.triggerEvent('mediaSelected', {
            mediaUrl: file.tempFilePath,
            mediaSize: this.formatFileSize(file.size),
            mediaType: 'image'
          });
        },
        fail: (err) => {
          console.error('选择图片失败:', err);
          wx.showToast({
            title: '选择图片失败',
            icon: 'error'
          });
        }
      });
    },

    // 选择视频
    chooseVideo() {
      wx.chooseMedia({
        count: 1,
        mediaType: ['video'],
        sourceType: ['album', 'camera'],
        maxDuration: 30,
        camera: 'back',
        success: (res) => {
          const file = res.tempFiles[0];
          
          // 检查文件大小（最大50MB）
          if (file.size > 50 * 1024 * 1024) {
            wx.showToast({
              title: '视频过大，请选择小于50MB的视频',
              icon: 'error',
              duration: 2000
            });
            return;
          }
          
          this.triggerEvent('mediaSelected', {
            mediaUrl: file.tempFilePath,
            mediaSize: this.formatFileSize(file.size),
            mediaType: 'video'
          });
        },
        fail: (err) => {
          console.error('选择视频失败:', err);
          wx.showToast({
            title: '选择视频失败',
            icon: 'error'
          });
        }
      });
    },

    // 格式化文件大小
    formatFileSize(size) {
      if (size < 1024) {
        return size + 'B';
      } else if (size < 1024 * 1024) {
        return (size / 1024).toFixed(1) + 'KB';
      } else {
        return (size / (1024 * 1024)).toFixed(1) + 'MB';
      }
    }
  }
});