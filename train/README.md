和用户沟通清楚：
	•	他们需要识别哪些疾病种类（例如：鳞片发黑、身体腐烂、眼睛发白等）
	•	每种是否算一个类别？是否还有“正常鱼类”作为对比类？
	•	类别一旦确定，你就可以编写 classes.txt 和 dataset.yaml

    告诉他们正确的标注格式（YOLO格式）

每张图要配一个 .txt 文件，内容格式如下：
class_id x_center y_center width height

•	class_id: 类别编号，从 0 开始（按 classes.txt 的顺序）
	•	其他4个数值为归一化坐标（0–1 之间）：
	•	x_center, y_center: 目标中心点坐标
	•	width, height: 目标宽高

class_id
类别编号，对应 classes.txt 的顺序（从 0 开始）
整数值
0、1、2 等
x_center
目标的中心点横坐标（占图像宽度的比例）
0 ~ 1
0.512
y_center
目标的中心点纵坐标（占图像高度的比例）
0 ~ 1
0.635
width
目标宽度（占图像宽度的比例）
0 ~ 1
0.22
height
目标高度（占图像高度的比例）
0 ~ 1
0.18





你需要的是下面这个结构：
data/
├── images/
│   ├── train/
│   └── val/
├── labels/
│   ├── train/
│   └── val/
图片和对应的 .txt 文件需要名称一致。

文件组织结构应如下：
data/
├── images/train/    # 训练图像
├── images/val/      # 验证图像
├── labels/train/    # 训练图像对应的 txt 标注
└── labels/val/      # 验证图像对应的 txt 标注