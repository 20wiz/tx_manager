const { MongoClient } = require('mongodb');
require('dotenv').config();
// MongoDB 연결 설정
const mongoUri = process.env.MONGO_URI;
const dbName = process.env.DB_NAME;

const client = new MongoClient(mongoUri, {
    useNewUrlParser: true,
    useUnifiedTopology: true,
    connectTimeoutMS: 2000 // Set the connection timeout to 10 seconds
});
const pool_list_api_url ='https://api.neopin.io/napi/v2/pool/list';

async function insertData() {
  try {
    await client.connect();
    console.log('Connected to MongoDB');

    const database = client.db(dbName);
    // const collection = database.collection('your_collection_name');
    const poolsCollection = database.collection('pool_list');
    
    const apiResponse = await fetch(pool_list_api_url).then(response => response.json());

    const data = apiResponse.data;

    const poolDocuments = [];
    const tokenDocuments = [];

    data.forEach(item => {
      if (item.farm) {
        poolDocuments.push({
          poolID: item.farm.poolID,
          rewardToken: item.farm.rewardToken,
          rewardPerBlock: item.farm.rewardPerBlock
        });
      }

    });

    // const mainResult = await mainCollection.insertMany(data);
    const poolsResult = await poolsCollection.insertMany(poolDocuments);
    // const tokensResult = await tokensCollection.insertMany(tokenDocuments);

    // console.log(`${mainResult.insertedCount} main documents were inserted`);
    console.log(`${poolsResult.insertedCount} pool documents were inserted`);
    // console.log(`${tokensResult.insertedCount} token documents were inserted`);

  } finally {
    await client.close();
  }
}

insertData().catch(console.dir);
