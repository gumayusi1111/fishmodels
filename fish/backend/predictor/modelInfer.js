/*
 * 统一的模型推理入口（支持 ONNX / Mock）。
 *
 * 调用方式：
 *   const { inference } = require('./predictor/modelInfer');
 *   const results = await inference(imageAbsolutePath);
 *
 * 返回格式：
 *   [ {
 *       classId: Number,        // 类别索引
 *       className: String,      // 类别中文名称
 *       confidence: Number,     // 0~1 置信度
 *       bbox: [x1, y1, x2, y2]  // 可选，检测框坐标
 *     }, ... ]
 *
 * 当模型文件不存在时自动回退为模拟数据，确保上层无需修改。
 */

const fs = require('fs');
const path = require('path');

// ---------- 配置区 ---------- //
const MODEL_DIR = path.join(__dirname); // 模型文件夹（与本文件同级）
const MODEL_NAME = 'model.onnx';        // 你后续只需把真正模型重命名为此即可
const CLASSES_FILE = 'classes.txt';     // 类别名称表（每行一个中文名）
const INPUT_SIZE = 640; // 如果导出模型使用其他尺寸可修改
const CONF_THRESH = 0.25; // 放宽阈值，避免无检测

// -------------------------------- //

// 读取类别名称
let CLASSES = [];
try {
  const classesPath = path.join(MODEL_DIR, CLASSES_FILE);
  CLASSES = fs.readFileSync(classesPath, 'utf8').trim().split(/\r?\n/);
} catch (e) {
  console.warn('[modelInfer] 未找到 classes.txt，使用空类别列表');
}

// 尝试加载 ONNXRuntime
let ort = null;
try {
  ort = require('onnxruntime-node');
} catch (e) {
  console.warn('[modelInfer] 未安装 onnxruntime-node，将仅提供 mock 推理');
}

// 尝试加载模型
let session = null;
(async () => {
  const modelPath = path.join(MODEL_DIR, MODEL_NAME);
  if (ort && fs.existsSync(modelPath)) {
    try {
      session = await ort.InferenceSession.create(modelPath, {
        executionProviders: ['cpu']
      });
      console.log('[modelInfer] ONNX 模型加载成功');
    } catch (err) {
      console.error('[modelInfer] 模型加载失败，进入 mock 模式：', err.message);
    }
  } else {
    console.warn('[modelInfer] 未找到模型文件，进入 mock 模式');
  }
})();

// 工具：将图片读取为 Float32Array 并归一化到 [0,1]
async function preprocess(imagePath) {
  const sharp = require('sharp');
  const INPUT_SIZE = 640; // 依据训练时设置，可调整

  const imgBuffer = await sharp(imagePath)
    .resize(INPUT_SIZE, INPUT_SIZE)
    .raw()
    .toBuffer();

  const floatArray = new Float32Array(imgBuffer.length);
  for (let i = 0; i < imgBuffer.length; i++) {
    floatArray[i] = imgBuffer[i] / 255.0;
  }

  // NHWC -> NCHW & float32  (简单实现，效率不是重点)
  const chw = new Float32Array(imgBuffer.length);
  const channelSize = INPUT_SIZE * INPUT_SIZE;
  for (let i = 0; i < channelSize; i++) {
    chw[i] = floatArray[i * 3];             // R
    chw[i + channelSize] = floatArray[i * 3 + 1]; // G
    chw[i + 2 * channelSize] = floatArray[i * 3 + 2]; // B
  }
  return new ort.Tensor('float32', chw, [1, 3, INPUT_SIZE, INPUT_SIZE]);
}

// 工具：sigmoid
function sigmoid(x) {
  return 1 / (1 + Math.exp(-x));
}

// 计算IoU
function bboxIou(box1, box2) {
  const [x1, y1, x2, y2] = box1;
  const [x1b, y1b, x2b, y2b] = box2;
  const interArea = Math.max(0, Math.min(x2, x2b) - Math.max(x1, x1b)) *
                    Math.max(0, Math.min(y2, y2b) - Math.max(y1, y1b));
  const box1Area = (x2 - x1) * (y2 - y1);
  const box2Area = (x2b - x1b) * (y2b - y1b);
  return interArea / (box1Area + box2Area - interArea + 1e-6);
}

// 非极大值抑制
function nms(dets, iouThresh = 0.45) {
  const sorted = dets.sort((a, b) => b.confidence - a.confidence);
  const keep = [];
  while (sorted.length) {
    const current = sorted.shift();
    keep.push(current);
    for (let i = sorted.length - 1; i >= 0; i--) {
      if (bboxIou(current.bbox, sorted[i].bbox) > iouThresh && current.classId === sorted[i].classId) {
        sorted.splice(i, 1);
      }
    }
  }
  return keep;
}

// 工具：解析 YOLOv8 ONNX 输出为检测结果
function postprocess(onnxTensor, confThreshold = CONF_THRESH) {
  if (!onnxTensor) return [];
  const { dims, data } = onnxTensor; // 可能是 [1,85,8400] 或 [1,8400,85]
  let boxesDim, featLen, isChannelsFirst;

  // 判断是哪种布局
  if (dims[1] <= 120 && dims[2] > 1000) {
    // [1, 85, 8400] 这种：feature在前
    featLen = dims[1];
    boxesDim = dims[2];
    isChannelsFirst = true;
  } else {
    // 默认使用原先 [1, boxes, 85]
    boxesDim = dims[1];
    featLen = dims[2];
    isChannelsFirst = false;
  }

  const nc = featLen - 5;
  const INPUT_SIZE = 640;
  const detections = [];

  for (let i = 0; i < boxesDim; i++) {
    // 按布局读取值
    const read = (featureIndex) => isChannelsFirst ? data[featureIndex * boxesDim + i] : data[i * featLen + featureIndex];

    const xc = read(0);
    const yc = read(1);
    const w  = read(2);
    const h  = read(3);
    const obj = sigmoid( read(4) );

    // 类别最大概率
    let bestCls = 0;
    let bestProb = 0;
    for (let c = 0; c < nc; c++) {
      const clsProb = sigmoid( read(5 + c) );
      if (clsProb > bestProb) {
        bestProb = clsProb;
        bestCls = c;
      }
    }

    const conf = obj * bestProb;
    if (conf < confThreshold) continue;

    // 过滤超过类别长度
    if (bestCls >= CLASSES.length) continue;

    const x1 = (xc - w / 2) * INPUT_SIZE;
    const y1 = (yc - h / 2) * INPUT_SIZE;
    const x2 = (xc + w / 2) * INPUT_SIZE;
    const y2 = (yc + h / 2) * INPUT_SIZE;

    detections.push({
      classId: bestCls,
      className: CLASSES[bestCls] || `cls_${bestCls}`,
      confidence: parseFloat(conf.toFixed(3)),
      bbox: [Math.max(0, x1), Math.max(0, y1), Math.min(INPUT_SIZE, x2), Math.min(INPUT_SIZE, y2)]
    });
  }

  return nms(detections);
}

/**
 * 主推理函数
 * @param {string} imagePath - 图片绝对路径
 * @returns {Promise<Array>} detections
 */
async function inference(imagePath) {
  // 如果没有加载模型，返回模拟数据，保证上层不报错
  if (!session) {
    return [
      {
        classId: 0,
        className: CLASSES[0] || '示例疾病',
        confidence: 0.9,
        bbox: [100, 100, 400, 400]
      }
    ];
  }

  try {
    const inputTensor = await preprocess(imagePath);
    const outputs = await session.run({ images: inputTensor }); // 根据模型的 input name 调整
    const firstKey = Object.keys(outputs)[0];
    const detections = postprocess(outputs[firstKey]);

    // 取置信度最高的一项
    const best = detections.sort((a, b) => b.confidence - a.confidence)[0] || null;
    return {
      success: true,
      topClass: best
    };
  } catch (err) {
    console.error('[modelInfer] 推理过程出错：', err);
    return [];
  }
}

module.exports = { inference }; 