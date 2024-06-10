const { MongoClient } = require('mongodb');
require('dotenv').config();

const env = process.env;

let collection_pool = 'pools';
let collection_asset = 'assets';
let collection_pool_daily = 'pools_daily';
const debug = true;
if (debug) {
    collection_pool += '_test';
    collection_asset += '_test';
    collection_pool_daily += '_test';
}

const mongoUri = env.MONGO_URI;
const dbName = env.DB_NAME;

async function connectToMongo() {
    const client = new MongoClient(mongoUri, {
        // useNewUrlParser: true,
        // useUnifiedTopology: true,
        connectTimeoutMS: 1000 // Set the connection timeout to 1 seconds
    });
    try {
        await client.connect();
        console.log("Connected to MongoDB");
        return client;
    } catch (error) {
        console.error('Error connecting to MongoDB:', error);
        throw error;
    }
}

async function getLastPoolDataForDay(db, poolId, date) {
    const collection = db.collection('pools');
    const query = { poolId, date };
    const options = { sort: { timestamp: -1 } };
    const lastPoolData = await collection.findOne(query, options);
    return lastPoolData;
}

async function getLastDataForAllPoolsForDay(db, date) {
    const collection = db.collection('pools');
    const pipeline = [
        { $match: { timestamp: { $gte: `${date}T00:00:00.000Z`, $lt: `${date}T24:00:00.000Z` } } },
        { $sort: { timestamp: -1 } },
        { $group: { _id: "$pid", lastData: { $first: "$$ROOT" } } },
        { $replaceRoot: { newRoot: "$lastData" } }
    ];
// console.log(JSON.stringify(pipeline));
    const results = await collection.aggregate(pipeline).toArray();
    // console.log(aggregateResult);
    return results;
}

async function insertPoolDataForDay(db, dataArray) {
    const collection = db.collection(collection_pool_daily);
    if (!Array.isArray(dataArray)) {
        throw new Error("Expected dataArray to be an array");
    }
    await collection.insertMany(dataArray);
    // console.log("Inserted pool data for the specified day into MongoDB");
}

async function processDateRange(startDate, endDate) {
    const client = await connectToMongo();
    const db = client.db(dbName);

    for (let date = new Date(startDate); date <= endDate; date.setDate(date.getDate() + 1)) {
        const formattedDate = date.toISOString().split('T')[0];
        const data = await getLastDataForAllPoolsForDay(db, formattedDate);
        console.log(`Data for ${formattedDate}:`, data);
        const newDataArray = data.map(item => ({ ...item, date: formattedDate }));
        await insertPoolDataForDay(db, newDataArray);
    }
    // Close the MongoDB connection
    await client.close();
    console.log("MongoDB connection closed");
}

async function main() { //  when batch process is required
    const startDate = new Date('2024-05-19'); // Replace with your start date
    const endDate = new Date('2024-06-07'); // Replace with your end date
    await processDateRange(startDate, endDate);
}

// Schedule the task to run at 00:05 every day,  insert close price or assets for the last day
cron.schedule('5 0 * * *', async () => {
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const startDate = new Date(yesterday);
    const endDate = new Date(yesterday);
    await processDateRange(startDate, endDate);
    console.log("Scheduled task completed");
});

// Uncomment to run main function manually
// main();
