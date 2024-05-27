const express = require('express');
const { MongoClient } = require('mongodb');
require('dotenv').config();

const app = express();
const port = process.env.PORT || 5000;

const mongoUri = process.env.MONGO_URI;
const dbName = process.env.DB_NAME;

async function connectToMongo() {
    const client = new MongoClient(mongoUri, {
        useNewUrlParser: true,
        useUnifiedTopology: true,
        connectTimeoutMS: 10000 // Set the connection timeout to 10 seconds
    });
    try {
        await client.connect();
        console.log("Connected to MongoDB");
        return client.db(dbName);
    } catch (error) {
        console.error('Error connecting to MongoDB:', error);
        throw error;
    }
}

app.get('/api/data', async (req, res) => {
    const db = await connectToMongo();
    const collection = db.collection('pools'); // Adjust the collection name as needed

    try {
        const data = await collection.find({}).sort({ timestamp: -1 }).limit(100).toArray();
        const chartData = data.map(item => ({
            poolName: item.token0Symbol+'-'+item.token1Symbol,
            userTokenSumUSD: item.userTokenSumUSD,
            pendingRewardUSD: item.pendingRewardUSD,
            poolUserAssetUSD: item.poolUserAssetUSD,
            timestamp: item.timestamp,
        }));
        res.json(chartData);
    } catch (error) {
        console.error('Error fetching data from MongoDB:', error);
        res.status(500).send('Error fetching data from MongoDB');
    }
});

app.listen(port, () => {
    console.log(`Server is running on port ${port}`);
});

