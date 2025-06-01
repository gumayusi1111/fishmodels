const cloud = require('wx-server-sdk');
const axios = require('axios');

cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV
});

exports.main = async (event, context) => {
  const { action, aiConfig } = event;
  
  console.log('云函数开始执行:', { action, timestamp: new Date().toISOString() });
  
  try {
    // 验证必要参数
    if (!aiConfig || !aiConfig.apiKey || !aiConfig.baseURL) {
      throw new Error('AI配置信息不完整');
    }
    
    let result;
    switch (action) {
      case 'speciesDetection':
        result = await handleSpeciesDetection(event, aiConfig);
        break;
      case 'diseaseDetection':
        result = await handleDiseaseDetection(event, aiConfig);
        break;
      case 'treatmentAdvice':
        result = await handleTreatmentAdvice(event, aiConfig);
        break;
      case 'comprehensiveAnalysis':
        result = await handleComprehensiveAnalysis(event, aiConfig);
        break;
      default:
        throw new Error('未知的操作类型');
    }
    
    console.log('云函数执行成功:', result);
    return result;
  } catch (error) {
    console.error('云函数执行失败:', {
      error: error.message,
      stack: error.stack,
      action,
      timestamp: new Date().toISOString()
    });
    return {
      success: false,
      error: error.message
    };
  }
};

// 处理品种识别
async function handleSpeciesDetection(event, aiConfig) {
  const { imageFileID } = event;
  
  try {
    // 获取图片临时链接
    const fileResult = await cloud.getTempFileURL({
      fileList: [imageFileID]
    });
    
    const imageUrl = fileResult.fileList[0].tempFileURL;
    
    const prompt = `请仔细分析这张鱼类图片，识别鱼的品种。请以JSON格式返回结果，包含以下字段：
- species: 鱼类品种名称（中文）
- confidence: 识别置信度（0-100的数字）
- description: 该品种的简要描述（50字以内）
- habitat: 栖息环境
- characteristics: 主要特征（数组格式）

请确保返回的是有效的JSON格式，不要包含任何其他文本。`;
    
    const response = await callGPTAPI(aiConfig, prompt, imageUrl);
    
    // 统一的JSON解析逻辑
    const result = parseGPTResponse(response, {
      species: '未知品种',
      confidence: 0,
      description: '识别失败，请重试',
      habitat: '未知',
      characteristics: []
    });
    
    return {
      success: true,
      data: result
    };
  } catch (error) {
    console.error('品种识别处理失败:', error);
    return {
      success: false,
      error: error.message,
      data: {
        species: '未知品种',
        confidence: 0,
        description: '识别失败，请重试',
        habitat: '未知',
        characteristics: []
      }
    };
  }
}

// 处理治疗建议
async function handleTreatmentAdvice(event, aiConfig) {
  const { species, diseases, health } = event;
  
  try {
    let prompt = `作为专业的水产养殖专家，请为以下情况提供治疗建议：\n\n`;
    prompt += `鱼类品种：${species}\n`;
    prompt += `健康状况：${health}\n`;
    
    if (diseases && diseases.length > 0) {
      prompt += `检测到的疾病：${diseases.join('、')}\n\n`;
      prompt += `请提供详细的治疗方案，包括：\n1. 病因分析\n2. 治疗药物和用量\n3. 环境改善建议\n4. 预防措施\n5. 预计康复时间\n\n`;
    } else {
      prompt += `\n鱼类目前健康状况良好，请提供：\n1. 日常护理建议\n2. 营养搭配\n3. 环境维护\n4. 疾病预防\n\n`;
    }
    
    prompt += `请以JSON格式返回，包含treatment字段（字符串格式，包含完整的建议内容）。不要包含任何其他文本。`;
    
    const response = await callGPTAPI(aiConfig, prompt);
    
    // 使用统一的JSON解析逻辑
    const result = parseGPTResponse(response, {
      treatment: '暂时无法提供治疗建议，请咨询专业兽医。'
    });
    
    return {
      success: true,
      data: result
    };
  } catch (error) {
    console.error('治疗建议处理失败:', error);
    return {
      success: false,
      error: error.message,
      data: {
        treatment: '暂时无法提供治疗建议，请咨询专业兽医。'
      }
    };
  }
}

// 统一的GPT响应解析函数
function parseGPTResponse(response, defaultData) {
  let cleanResponse = ''; // 将变量声明移到外层
  
  try {
    // 记录原始响应用于调试
    console.log('GPT API原始响应:', response);
    
    // 清理响应内容
    cleanResponse = response.trim();
    
    // 移除可能的markdown标记
    if (cleanResponse.startsWith('```json')) {
      cleanResponse = cleanResponse.replace(/```json\s*/, '').replace(/```\s*$/, '');
    } else if (cleanResponse.startsWith('```')) {
      cleanResponse = cleanResponse.replace(/```\s*/, '').replace(/```\s*$/, '');
    }
    
    // 移除可能的前后缀文本，只保留JSON部分
    const jsonStart = cleanResponse.indexOf('{');
    const jsonEnd = cleanResponse.lastIndexOf('}');
    
    if (jsonStart !== -1 && jsonEnd !== -1 && jsonEnd > jsonStart) {
      cleanResponse = cleanResponse.substring(jsonStart, jsonEnd + 1);
    }
    
    console.log('清理后的响应:', cleanResponse);
    
    // 尝试解析JSON
    const result = JSON.parse(cleanResponse);
    
    // 验证结果，如果缺少必要字段则使用默认值补充
    const finalResult = { ...defaultData, ...result };
    
    console.log('解析成功的结果:', finalResult);
    return finalResult;
    
  } catch (parseError) {
    console.error('JSON解析失败:', {
      error: parseError.message,
      originalResponse: response,
      cleanedResponse: cleanResponse // 现在可以访问了
    });
    
    // 如果JSON解析失败，返回默认数据
    return defaultData;
  }
}

// 处理疾病检测（暂时模拟）
async function handleDiseaseDetection(event, aiConfig) {
  // 这里将来集成YOLO模型
  return {
    success: true,
    data: {
      health: '健康',
      diseases: [],
      healthScore: 95,
      confidence: 90
    }
  };
}

// 调用GPT API
async function callGPTAPI(aiConfig, prompt, imageUrl = null) {
  const messages = [
    {
      role: "user",
      content: imageUrl ? [
        {
          type: "text",
          text: prompt
        },
        {
          type: "image_url",
          image_url: {
            url: imageUrl
          }
        }
      ] : prompt
    }
  ];
  
  try {
    console.log('发送API请求:', { model: aiConfig.defaultModel, prompt: prompt.substring(0, 100) + '...' });
    
    const response = await axios.post(aiConfig.baseURL, {
      model: aiConfig.defaultModel,
      messages: messages,
      max_tokens: 1000,
      temperature: 0.7
    }, {
      headers: {
        'Authorization': `Bearer ${aiConfig.apiKey}`,
        'Content-Type': 'application/json'
      },
      timeout: 25000
    });
    
    console.log('API响应状态:', response.status);
    console.log('API响应内容:', response.data.choices[0].message.content.substring(0, 200) + '...');
    
    return response.data.choices[0].message.content;
  } catch (error) {
    console.error('API调用详细错误:', {
      message: error.message,
      response: error.response?.data,
      status: error.response?.status
    });
    
    if (error.code === 'ECONNABORTED') {
      throw new Error('API请求超时，请稍后重试');
    }
    if (error.response?.status === 401) {
      throw new Error('API密钥无效，请检查配置');
    }
    if (error.response?.status === 429) {
      throw new Error('API调用频率超限，请稍后重试');
    }
    
    throw new Error(`API调用失败: ${error.message}`);
  }
}

// 新增：处理综合分析
async function handleComprehensiveAnalysis(event, aiConfig) {
  const { species, yoloDetection, knowledgeBase } = event;
  
  try {
    // 读取知识库文件
    const fs = require('fs');
    const path = require('path');
    const knowledgeContent = fs.readFileSync(path.join(__dirname, 'know.txt'), 'utf8');
    
    // 构建GPT分析提示词
    const prompt = `
作为专业的鱼类疾病诊断专家，请基于以下信息进行综合分析：

**检测结果：**
- 鱼类品种：${species?.species || '未识别'}
- 品种置信度：${species?.confidence || 0}%
- YOLO检测结果：${JSON.stringify(yoloDetection)}

**专业知识库：**
${knowledgeContent}

请在现有数据结构基础上，完善以下字段的内容：

1. **species**: 完善品种信息
2. **confidence**: 综合置信度
3. **health**: 健康状态评估
4. **healthScore**: 健康评分(0-100)
5. **diseases**: 检测到的疾病列表
6. **treatment**: 详细治疗建议
7. **description**: 品种详细描述
8. **habitat**: 栖息地和饲养环境要求
9. **characteristics**: 品种特征列表

请返回JSON格式，严格按照现有字段结构：
{
  "species": "品种名称",
  "confidence": 置信度数值,
  "health": "健康状态",
  "healthScore": 评分数值,
  "diseases": ["疾病1", "疾病2"],
  "treatment": "详细治疗建议",
  "description": "品种详细描述",
  "habitat": "栖息地和饲养要求",
  "characteristics": ["特征1", "特征2", "特征3"]
}
`;
    
    // 调用GPT API
    const gptResponse = await callGPTAPI(aiConfig, prompt);
    
    // 解析GPT响应
    const analysisResult = parseGPTResponse(gptResponse, {
      species: species?.species || '未知品种',
      confidence: species?.confidence || 0,
      health: '健康',
      healthScore: 85,
      diseases: [],
      treatment: '暂无特殊治疗建议，请保持良好的水质环境。',
      description: '暂无详细描述',
      habitat: '请根据品种特性提供适宜的饲养环境',
      characteristics: ['待补充特征信息']
    });
    
    return {
      success: true,
      data: analysisResult
    };
    
  } catch (error) {
    console.error('综合分析失败:', error);
    return {
      success: false,
      error: error.message,
      data: {
        species: species?.species || '未知品种',
        confidence: species?.confidence || 0,
        health: '无法评估',
        healthScore: 0,
        diseases: [],
        treatment: '分析失败，请重试',
        description: '分析失败',
        habitat: '分析失败',
        characteristics: []
      }
    };
  }
}