// 云开发环境配置
const CLOUD_CONFIG = {
  // 开发环境ID（需要在微信开发者工具中创建）
  envId: '', // 确保这是正确的环境ID
  
  // 环境配置选项
  environments: {
    // 开发环境
    development: {
      envId: '', // 使用实际的环境ID
      name: '开发环境'
    },
    // 测试环境
    testing: {
      envId: 'cloud1-test-xxx', 
      name: '测试环境'
    },
    // 生产环境
    production: {
      envId: 'cloud1-prod-xxx',
      name: '生产环境'
    }
  },
  
  // 当前使用的环境
  currentEnv: 'development'
};

// AI服务配置
const AI_CONFIG = {
  apiKey: 'sk-91T6x89mHpe72h1dr4RoKxiSyBHzpJJvoAQcq9l3GLsrJyTX',
  baseURL: 'https://yunwu.ai/v1/chat/completions',
  models: {
    gpt4o: 'gpt-4o',
    gpt41: 'gpt-4.1'
  },
  defaultModel: 'gpt-4o'
};

// 鱼类识别服务配置
const FISH_SERVICE_CONFIG = {
  // 品种识别接口
  speciesAPI: '/api/fish/species',
  // 疾病检测接口
  diseaseAPI: '/api/fish/disease',
  // 图片上传配置
  upload: {
    maxSize: 5 * 1024 * 1024, // 5MB
    allowedTypes: ['image/jpeg', 'image/png', 'image/jpg'],
    quality: 0.8
  }
};

// 云数据库配置
const DATABASE_CONFIG = {
  collections: {
    fishHistory: 'fish_detection_history',
    userProfiles: 'user_profiles',
    fishSpecies: 'fish_species_data'
  }
};

module.exports = {
  CLOUD_CONFIG,
  AI_CONFIG,
  FISH_SERVICE_CONFIG,
  DATABASE_CONFIG
};