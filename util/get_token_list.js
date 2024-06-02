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
const coin_list_api_url ='https://api.neopin.io/napi/v2/coin';

async function insertData() {
  try {
    await client.connect();
    console.log('Connected to MongoDB');

    const database = client.db(dbName);
    // const collection = database.collection('your_collection_name');
    const tokensCollection = database.collection('tokens');
    
    const apiResponse = await fetch(coin_list_api_url).then(response => response.json());

    const data = apiResponse;

    console.log(data);
    // const tokenDocuments = [];

    // data.forEach(item => {
    //   item.tokens.forEach(token => {
    //     tokenDocuments.push({
    //       pairID: item.pairID,
    //       token: token
    //     });
    //   });
    // });

    // const mainResult = await mainCollection.insertMany(data);
    const tokensResult = await tokensCollection.insertMany(data.coinListV2);
    // const tokensResult = await tokensCollection.insertMany(tokenDocuments);

    // console.log(`${mainResult.insertedCount} main documents were inserted`);
    console.log(`${tokensResult.insertedCount} token documents were inserted`);
    // console.log(`${tokensResult.insertedCount} token documents were inserted`);

  } finally {
    await client.close();
  }
}

insertData().catch(console.dir);
