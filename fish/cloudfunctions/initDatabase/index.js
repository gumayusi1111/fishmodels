const cloud = require('wx-server-sdk');

cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV
});

const db = cloud.database();

exports.main = async (event, context) => {
  try {
    const collections = [
      {
        name: 'fish_detection_history',
        indexes: [
          {
            name: 'userId_openid_createTime_index',
            definition: {
              userId: 1,
              _openid: 1,
              createTime: -1
            }
          },
          {
            name: 'userId_createTime_index',
            definition: {
              userId: 1,
              createTime: -1
            }
          }
        ]
      },
      {
        name: 'users',
        indexes: [
          {
            name: 'openid_index',
            definition: {
              openid: 1
            }
          }
        ]
      }
    ];

    const results = [];
    
    for (const collection of collections) {
      try {
        // 检查集合是否存在
        await db.collection(collection.name).limit(1).get();
        console.log(`集合 ${collection.name} 已存在`);
        
        // 创建索引
        if (collection.indexes) {
          for (const index of collection.indexes) {
            try {
              await db.collection(collection.name).createIndex({
                name: index.name,
                definition: index.definition
              });
              console.log(`索引 ${index.name} 创建成功`);
            } catch (indexError) {
              console.log(`索引 ${index.name} 可能已存在:`, indexError.message);
            }
          }
        }
        
        results.push({
          collection: collection.name,
          status: 'success',
          message: '集合和索引检查完成'
        });
      } catch (error) {
        if (error.errCode === -502001) {
          // 集合不存在，创建集合
          await db.createCollection(collection.name);
          console.log(`集合 ${collection.name} 创建成功`);
          
          // 创建索引
          if (collection.indexes) {
            for (const index of collection.indexes) {
              await db.collection(collection.name).createIndex({
                name: index.name,
                definition: index.definition
              });
              console.log(`索引 ${index.name} 创建成功`);
            }
          }
          
          results.push({
            collection: collection.name,
            status: 'created',
            message: '集合和索引创建成功'
          });
        } else {
          throw error;
        }
      }
    }
    
    return {
      success: true,
      results: results
    };
  } catch (error) {
    console.error('数据库初始化失败:', error);
    return {
      success: false,
      error: error.message
    };
  }
};