// 鱼类疾病知识库模块
class FishKnowledgeBase {
  constructor() {
    this.diseaseDatabase = null;
    this.treatmentDatabase = null;
  }

  // 加载知识库数据
  async loadKnowledgeBase() {
    try {
      // 调用云函数加载 knowledge.docx 文件内容
      const result = await wx.cloud.callFunction({
        name: 'fishDetection',
        data: {
          action: 'loadKnowledge'
        }
      });
      
      if (result.result && result.result.success) {
        this.diseaseDatabase = result.result.diseases;
        this.treatmentDatabase = result.result.treatments;
        return true;
      }
      return false;
    } catch (error) {
      console.error('加载知识库失败:', error);
      return false;
    }
  }

  // 根据疾病名称获取治疗方案
  getTreatmentByDisease(diseaseName) {
    if (!this.treatmentDatabase) {
      console.warn('知识库未加载');
      return null;
    }
    
    return this.treatmentDatabase.find(treatment => 
      treatment.disease === diseaseName
    );
  }

  // 获取疾病详细信息
  getDiseaseInfo(diseaseName) {
    if (!this.diseaseDatabase) {
      console.warn('知识库未加载');
      return null;
    }
    
    return this.diseaseDatabase.find(disease => 
      disease.name === diseaseName
    );
  }

  // 综合分析方法 - 添加 aiConfig 参数
  async comprehensiveAnalysis(speciesResult, yoloResult, aiConfig) {
    try {
      const result = await wx.cloud.callFunction({
        name: 'fishDetection',
        data: {
          action: 'comprehensiveAnalysis',
          species: speciesResult,
          yoloDetection: yoloResult,
          aiConfig: aiConfig,  // 添加这个关键参数
          knowledgeBase: {
            diseases: this.diseaseDatabase,
            treatments: this.treatmentDatabase
          }
        }
      });
      
      // 修改返回值处理
      if (result.result && result.result.success) {
        return result.result.data;
      } else {
        throw new Error(result.result?.error || '综合分析失败');
      }
    } catch (error) {
      console.error('综合分析失败:', error);
      throw error;
    }
  }
}

// 修改导出方式为 CommonJS
const knowledgeBase = new FishKnowledgeBase();
module.exports = knowledgeBase;