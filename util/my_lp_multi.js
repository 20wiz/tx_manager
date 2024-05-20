//reserve.js
const { ethers } = require('ethers');
const axios = require('axios');
const fs = require('fs');
const { MongoClient } = require('mongodb');
require('dotenv').config();

const env = process.env;

const BLOCKS_PER_DAY = (24 * 60 * 60) / 12.07; // Number of seconds in a day divided by block time

// Read the ABI file. (Smart contract ABI needed)
const MASTERCHEF_ABI = JSON.parse(fs.readFileSync("./contract/MasterChef.json"));
const MASTERCHEF_ADDRESS = env.MASTERCHEF_ADDRESS; // Address of the MasterChef contract

async function insertPoolUserData(db, data) {
    const collection = db.collection('pools');
    await collection.insertOne({ ...data, masterChefAddress: MASTERCHEF_ADDRESS });
    console.log("Inserted pool data into MongoDB");
}

// async function insertFarmUserData(db, userData) {
//     const collection = db.collection('farm');
//     await collection.insertOne({ ...userData, masterChefAddress: MASTERCHEF_ADDRESS });
//     console.log("Inserted user data into MongoDB");
// }

async function insertAssetData(db, userAddress, totalUserAssetValueUsd) {
    const assetCollection = db.collection('assets');
    const assetData = {
        type: 'defi farm',
        userAddress: userAddress,
        totalUserAssetValueUsd: totalUserAssetValueUsd,
        timestamp: new Date().toISOString()
    };
    await assetCollection.insertOne(assetData);
    console.log("Inserted asset data into MongoDB");
}

const UNISWAP_V2_PAIR_ABI = JSON.parse(fs.readFileSync("./contract/UniswapV2Pair.json"));

const ALCHEMY_API_URL = env.ALCHEMY_ETH;
const USER_ADDRESS = env.USER_ADDRESS; // 

const provider = new ethers.providers.JsonRpcProvider(ALCHEMY_API_URL);

// Create a wallet instance
// const wallet = new ethers.Wallet(env.PRIVATE_KEY, provider);

// Use the wallet as the signer for your contracts
const masterChefContract = new ethers.Contract(MASTERCHEF_ADDRESS, MASTERCHEF_ABI, provider);

async function getUserPoolInfo(pid, userAddress, userInfo){
    const poolInfo = await masterChefContract.poolInfo(pid);
    const stakeToken = poolInfo[0];
    const rewardToken = poolInfo[1];
    const pairInfo = await getPairInfo(stakeToken);

    const userLPAmount = userInfo[0];
    const userLPShare = (userLPAmount / pairInfo.lpTotalSupply) ;
    const userLPSharePercent = userLPShare * 100;
    console.log(`User LP share: ${userLPSharePercent.toFixed(2)}%`);

    //calc USD valued for user share 
    const userToken0USD = userLPShare * pairInfo.usdValueToken0;
    const userToken1USD = userLPShare * pairInfo.usdValueToken1;
    const userTokenSumUSD = userToken0USD + userToken1USD;

    console.log(`User's share  ${pairInfo.token0Symbol} : $${userToken0USD.toFixed(2)}  ${pairInfo.token1Symbol} : $${userToken1USD.toFixed(2)}`);
    console.log(`Total user's share : $${userTokenSumUSD.toFixed(2)}`);

    const rewardSymbol = await getTokenSymbol(rewardToken);
    // console.log('rewardSymbol=', rewardSymbol);
    const [rewardTokenPriceUSD, pendingReward, totalStakeToken] = await Promise.all([
        getTokenPriceCMC(rewardSymbol),
        getPendingReward(pid, userAddress, rewardSymbol),
        getTokenBalanceOf(stakeToken, MASTERCHEF_ADDRESS)
    ]);

    console.log(`${rewardSymbol} price from CoinMarketCap: $${rewardTokenPriceUSD}`);
    const pendingRewardAmount = (pendingReward / Math.pow(10, 18))
    const pendingRewardUSD = pendingRewardAmount * rewardTokenPriceUSD;
    console.log(`Pending reward for user ${userAddress} ${pendingRewardAmount.toFixed(2)}${rewardSymbol}  $${pendingRewardUSD.toFixed(2)}`);
    // console.log('pendingRewardInUSD=', pendingRewardInUSD.toFixed(2));

    const userStakeShare = userLPAmount / totalStakeToken; // same as useLPShare if all LP deposited to the masterchef
    const dailyReward = poolInfo.rewardPerBlock/1e18 * BLOCKS_PER_DAY * userStakeShare;
    const dailyRewardInUSD = dailyReward * rewardTokenPriceUSD;
    console.log(`Daily reward for user ${userAddress} ${dailyReward.toFixed(2)}${rewardSymbol}  $${dailyRewardInUSD.toFixed(2)}`);
        // Calculate daily reward for the user
        // const dailyReward = poolInfo.rewardPerBlock * BLOCKS_PER_DAY * userLPShare;

        // Add daily reward to userInfo
    pairInfo.dailyReward = dailyReward.toString();
    pairInfo.dailyRewardUSD = dailyReward * rewardTokenPriceUSD;
    const monthlyReward = dailyReward * 30;
    const monthlyRewardInUSD = monthlyReward * rewardTokenPriceUSD;
    console.log(`Monthly reward for user ${userAddress} ${monthlyReward.toFixed(2)}${rewardSymbol}  $${monthlyRewardInUSD.toFixed(2)}`);
    pairInfo.monthlyReward = monthlyReward.toString();
    pairInfo.monthlyRewardUSD = monthlyRewardInUSD.toFixed(2);
    const mpr = (monthlyReward / userTokenSumUSD) * 100;
    pairInfo.mpr = mpr.toFixed(2);

    const yearlyReward = pairInfo.dailyReward * 365;
    const yearlyRewardUSD = pairInfo.dailyRewardUSD * 365;
    pairInfo.yearlyReward = yearlyReward.toString();
    pairInfo.yearlyRewardUSD = yearlyRewardUSD.toFixed(2);
    const apr = (yearlyRewardUSD / userTokenSumUSD) * 100;
    pairInfo.apr = apr.toFixed(2);
    console.log(`APR for user ${userAddress}: ${apr.toFixed(2)}%`);

    const totalUserAssetValue = userTokenSumUSD + pendingRewardUSD;
    console.log(`user's asset in ${pairInfo.token0Symbol}/${pairInfo.token1Symbol}  : $${totalUserAssetValue.toFixed(2)}`);
    console.log('------------------------------')
    return {
        ...pairInfo,
        userToken0USD,
        userToken1USD,
        userTokenSumUSD,
        rewardSymbol,
        rewardTokenPriceUSD,
        pendingRewardAmount,
        pendingRewardUSD,
        totalUserAssetValue
    }
}
// async function getPairInfoFromPid(pid) {
//     const poolInfo = await masterChefContract.poolInfo(pid);
//     const stakeToken = poolInfo[0];
//     // const rewardToken = poolInfo[1];
//     return getPairInfo(stakeToken);
// }
async function getPairInfo(pairAddress) {
    console.log('pairAddress=', pairAddress);
    const pairContract = new ethers.Contract(pairAddress, UNISWAP_V2_PAIR_ABI, provider);
    const [token0Address, token1Address] = await Promise.all([
        pairContract.token0(),
        pairContract.token1()
    ]);

    const token0Contract = new ethers.Contract(token0Address, ERC20ABI, provider);
    const token1Contract = new ethers.Contract(token1Address, ERC20ABI, provider);

    const [token0Symbol, token1SymbolOrg, reserves, lpTotalSupply] = await Promise.all([
        token0Contract.symbol(),
        token1Contract.symbol(),
        pairContract.getReserves(),
        pairContract.totalSupply()        
    ]);
    const token1Symbol = token1SymbolOrg =='WETH'?'ETH':token1SymbolOrg;

    const [reserve0, reserve1] = reserves;

    // console.log(`Reserves - ${TOKEN0_SYMBOL}: ${reserve0}, ${TOKEN1_SYMBOL}: ${reserve1}`);
    console.log(`Reserves - ${token0Symbol}: ${reserve0}, ${token1Symbol}: ${reserve1}`);

    //token1 ETH
    // Fetch prices from Binance API and calculate USD value
    async function getTokenPrice(symbol) {
        try {
            const response = await axios.get(`https://api.binance.com/api/v3/ticker/price?symbol=${symbol}USDT`);
            return parseFloat(response.data.price);
        } catch (error) {
            // console.error(`Error fetching price from Binance for ${symbol}:`, error);
            try {
                const cmcResponse = await axios.get(`https://pro-api.coinmarketcap.com/v1/cryptocurrency/quotes/latest?symbol=${symbol}`, {
                    headers: { 'X-CMC_PRO_API_KEY': process.env.CMC_API_KEY }
                });
                return cmcResponse.data.data[symbol].quote.USD.price;
            } catch (cmcError) {
                console.error(`Error fetching price from CoinMarketCap for ${symbol}:`, cmcError);
                throw cmcError;
            }
        }
    }

    const [token0PriceUSD, token1PriceUSD] = await Promise.all([
        getTokenPrice(token0Symbol),
        getTokenPrice(token1Symbol)
    ]);
    console.log(`${token0Symbol} price : $${token0PriceUSD}, ${token1Symbol} price : $${token1PriceUSD}`);
    const reserveToken0USD = (reserve0 / Math.pow(10, 18)) * token0PriceUSD;
    const reserveToken1USD = (reserve1 / Math.pow(10, 18)) * token1PriceUSD;
    console.log(`Reserve ${token0Symbol} : $${reserveToken0USD.toFixed(2)},  ${token1Symbol} : $${reserveToken1USD.toFixed(2)}`);

    // console.log(`${token1Symbol} price : $${token1PriceInUSD}`);
    // console.log(`Reserve ${token1Symbol} : $${usdValueToken1.toFixed(2)}`);

    return { token0Address, token0Symbol, token1Address, token1Symbol,
        usdValueToken0: reserveToken0USD,
        usdValueToken1: reserveToken1USD,
        lpTotalSupply
    };
}


async function getPoolInfoAll() {
    const poolInfoAll = [];
    const poolLength = await masterChefContract.poolLength();
    const promises = [];

    for (let i = 0; i < poolLength; i++) {
        promises.push(masterChefContract.poolInfo(i));
    }

    const results = await Promise.all(promises);

    for (const poolInfo of results) {
        poolInfoAll.push(poolInfo);
    }

    return poolInfoAll;
}

async function getUserPoolInfoAll(userAddress) {
    const infoMap = new Map();
    const poolLength = await masterChefContract.poolLength();
    const promises = [];

    for (let i = 0; i < poolLength; i++) {
        promises.push(masterChefContract.userInfo(i, userAddress).then(userInfo => ({ pid: i, userInfo })));
    }

    const results = await Promise.all(promises);

    promises.length = 0; // Clear the promises array

    for (const { pid, userInfo } of results) {
        const amount = userInfo[0];
        if (amount.gt(0)) {
            // infoMap.set(pid, userInfo);
            // const {token0Address, token0Symbol, token1Address, token1Symbol} = await getPairInfo(stakeToken);
            // promises.push(getPairInfoFromPid(pid).then(pairInfo => ({ pid, pairInfo })));
            promises.push(getUserPoolInfo(pid, userAddress, userInfo).then(pairInfo => ({ pid, pairInfo })));
        }
    }
    const PairResults = await Promise.all(promises);

    for (const { pid, pairInfo } of PairResults) {
        // console.log(`Pool ${pid} - ${pairInfo.token0Symbol} - ${pairInfo.token1Symbol}`);
        const userInfo = infoMap.get(pid);
        // console.log(`InfoMap Item for Pool ${pid}:`, userInfo);
        const combinedInfo = { ...userInfo, ...pairInfo };
        infoMap.set(pid, combinedInfo);
    }

    return infoMap;
}

const ERC20ABI = JSON.parse(fs.readFileSync("./contract/UniswapV2ERC20.json"));
const rewardTokenContract = new ethers.Contract(env.TOKEN_REWARD_ADDRESS, ERC20ABI, provider);

let rewardTokenSymbol;
async function fetchRewardTokenSymbol() {
    try {
        symbol = await rewardTokenContract.symbol();
        return symbol
    } catch (error) {
        console.error('Error fetching reward token symbol:', error);
    }
}

async function getTokenSymbol(tokenAddress) {
    const tokenContract = new ethers.Contract(tokenAddress, ERC20ABI, provider);
    const symbol = await tokenContract.symbol();
    return symbol;
}


async function getReserves(pairContract, token0Symbol,token1Symbol) {

    const [reserve0, reserve1] = await pairContract.getReserves();

    // console.log(`Reserves - ${TOKEN0_SYMBOL}: ${reserve0}, ${TOKEN1_SYMBOL}: ${reserve1}`);
    console.log(`Reserves - ${token0Symbol}: ${reserve0}, ${token1Symbol}: ${reserve1}`);

    // Fetch prices from Binance API and calculate USD value
    try {
        const prices = await axios.get(`https://api.binance.com/api/v3/ticker/price?symbol=${token0Symbol}USDT`);
        const token0PriceInUSD = parseFloat(prices.data.price);
        console.log(`${token0Symbol} price in USD: $${token0PriceInUSD}`);

        const usdValueToken0 = (reserve0 / Math.pow(10, 18)) * token0PriceInUSD;
        console.log(`Reserve amount of ${token0Symbol} in USD: $${usdValueToken0.toFixed(2)}`);

        const prices1 = await axios.get(`https://api.binance.com/api/v3/ticker/price?symbol=${token1Symbol}USDT`);
        const token1PriceInUSD = parseFloat(prices1.data.price);
        console.log(`${token1Symbol} price in USD: $${token1PriceInUSD}`);

        const usdValueToken1 = (reserve1 / Math.pow(10, 18)) * token1PriceInUSD;
        console.log(`Reserve amount of ${token1Symbol} in USD (TVL): $${usdValueToken1.toFixed(2)}`);
        return {
            usdValueToken0,
            usdValueToken1
        }
    } catch (error) {
        console.error('Error fetching prices from Binance:', error);
    }
}

//get user LP amount from MasterChef (yield farm)
async function getUserLPAmount() {

    try {
        const poolId = process.env.PID; // Replace with the actual pool ID
        const userInfo = await masterChefContract.userInfo(poolId, USER_ADDRESS);
        const userLPAmount = userInfo.amount;
        console.log(`User LP amount: ${userLPAmount.toString()}`);
        const totalSupply = await pairContract.totalSupply();
        const userLPShare = (userLPAmount / totalSupply) ;
        const userLPSharePercent = userLPShare * 100;
        
        console.log(`User LP share: ${userLPSharePercent.toFixed(2)}%`);
        return {
            userLPShare,
            userLPAmount
        }
    } catch (error) {
        console.error('Error fetching user LP amount from MasterChef:', error);
    }
}


async function getPendingReward(pid, userAddress) {
    const pendingReward = await masterChefContract.pendingReward(pid, userAddress);
    return pendingReward;
}
async function getTokenBalanceOf(tokenAddress, userAddress) {
    const tokenContract = new ethers.Contract(tokenAddress, ERC20ABI, provider);
    const balance = await tokenContract.balanceOf(userAddress);
    return balance;
}

const tokenPriceCache = new Map();

async function getTokenPriceCMC(tokenSymbol) {
    const cacheKey = `CMC_${tokenSymbol}`;
    const cachedData = tokenPriceCache.get(cacheKey);
    const now = Date.now();

    if (cachedData && (now - cachedData.timestamp < 10000)) {
        return cachedData.price;
    }

    try {
        const apiKey = env.CMC_API_KEY;
        const url = `https://pro-api.coinmarketcap.com/v1/cryptocurrency/quotes/latest?symbol=${tokenSymbol}`;

        const headers = {
            'X-CMC_PRO_API_KEY': apiKey,
        };

        const response = await axios.get(url, { headers });
        const tokenPriceInUSD = response.data.data[tokenSymbol].quote.USD.price;

        tokenPriceCache.set(cacheKey, { price: tokenPriceInUSD, timestamp: now });

        return tokenPriceInUSD;
        
    } catch (error) {
        console.error('Error fetching token price from CoinMarketCap:', error);
        throw error;
    }
}


// const env = process.env;
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

// async function insertPoolData(db, poolData) {
//     const collection = db.collection('pools');
//     await collection.insertOne(poolData);
//     console.log("Inserted pool data into MongoDB");
// }

// async function insertFarmUserData(db, userData) {
//     const collection = db.collection('users');
//     await collection.insertOne(userData);
//     console.log("Inserted user data into MongoDB");
// }

async function main() {
    const client = await connectToMongo();
    const db = client.db(dbName);

    const farmUserInfoAll = await getUserPoolInfoAll(USER_ADDRESS);
    const totalUserAssetValueSum = Array.from(farmUserInfoAll.values()).reduce((sum, userInfo) => sum + userInfo.totalUserAssetValue, 0);
    // sum of all assets in one farm
    console.log(`Sum of all pool's total asset value: $${totalUserAssetValueSum.toFixed(2)}`);
    await insertAssetData(db, USER_ADDRESS, totalUserAssetValueSum);
    // Collect all promises for inserting data
    const insertPromises = [];

    for (const [pid, userPoolInfo] of farmUserInfoAll.entries()) {
        const currentTime = new Date().toISOString();
        userPoolInfo.lpTotalSupply = userPoolInfo.lpTotalSupply.toString();

        insertPromises.push(insertPoolUserData(db, { userAddress: USER_ADDRESS, pid, ...userPoolInfo, timestamp: currentTime }));
        // insertPromises.push(insertUserData(db, { userAddress: USER_ADDRESS, pid, ...userInfo, timestamp: currentTime }));
    }

    // Execute all insert operations in parallel
    await Promise.all(insertPromises);

    // Close the MongoDB connection
    await client.close();
    console.log("MongoDB connection closed");

    await getRewardTokenBalance(USER_ADDRESS);
}

async function getRewardTokenBalance(userAddress) {
    const rewardTokenContract = new ethers.Contract('0x306ee01a6bA3b4a8e993fA2C1ADC7ea24462000c', ERC20ABI, provider);
    const rewardTokenBalance = await rewardTokenContract.balanceOf(userAddress);
    const rewardTokenBalanceInUSD = rewardTokenBalance / Math.pow(10, 18) * 0.5;

    console.log(`Reward token balance for user ${USER_ADDRESS}: ${rewardTokenBalance.toString()} `);
    console.log(`Reward token balance in USD for user ${USER_ADDRESS}: $${rewardTokenBalanceInUSD.toFixed(2)}`);
    return rewardTokenBalance;
}

main().catch(console.error).finally(() => process.exit(0));


