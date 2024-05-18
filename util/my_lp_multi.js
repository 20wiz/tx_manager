//reserve.js
const { ethers } = require('ethers');
const axios = require('axios');
const fs = require('fs');
require('dotenv').config();


const env = process.env;
// Read the ABI file. (Smart contract ABI needed)
const MASTERCHEF_ABI = JSON.parse(fs.readFileSync("./contract/MasterChef.json"));
const MASTERCHEF_ADDRESS = env.MASTERCHEF_ADDRESS; // Address of the MasterChef contract
const UNISWAP_V2_PAIR_ABI = JSON.parse(fs.readFileSync("./contract/UniswapV2Pair.json"));


const ALCHEMY_API_URL = env.ALCHEMY_ETH;
const PAIR_ADDRESS = env.PAIR_ADDRESS; // Address of the Uniswap V2 Pair
// const TOKEN0_SYMBOL = env.TOKEN0_SYMBOL; // e.g., 'ETH'
// const TOKEN1_SYMBOL = env.TOKEN1_SYMBOL; // e.g., 'DAI'
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
    // const reserves = await getReserves(pairInfo.token0Symbol,pairInfo.token1Symbol);
    // const userLP = await getUserLPAmount();
    //calc USD valued for user share 
    const userUSDValueToken0 = userLPShare * pairInfo.usdValueToken0;
    const userUSDValueToken1 = userLPShare * pairInfo.usdValueToken1;
    const totalUserUSDValue = userUSDValueToken0 + userUSDValueToken1;

    console.log(`User's share  ${pairInfo.token0Symbol} : $${userUSDValueToken0.toFixed(2)}  ${pairInfo.token1Symbol} : $${userUSDValueToken1.toFixed(2)}`);
    console.log(`Total user's share : $${totalUserUSDValue.toFixed(2)}`);

    const rewardSymbol = await getTokenSymbol(rewardToken);
    // console.log('rewardSymbol=', rewardSymbol);
    const [rewardTokenPriceInUSD, pendingReward] = await Promise.all([
        getTokenPriceCMC(rewardSymbol),
        getPendingReward(pid, userAddress, rewardSymbol)
    ]);

    console.log(`${rewardSymbol} price in USD from CoinMarketCap: $${rewardTokenPriceInUSD}`);
    const pendingRewardAmount = (pendingReward / Math.pow(10, 18))
    const pendingRewardInUSD = pendingRewardAmount * rewardTokenPriceInUSD;
    console.log(`Pending reward for user ${userAddress} ${pendingRewardAmount.toFixed(2)}${rewardSymbol}  $${pendingRewardInUSD.toFixed(2)}`);
    // console.log('pendingRewardInUSD=', pendingRewardInUSD.toFixed(2));

    const totalUserAssetValue = userUSDValueToken0 + userUSDValueToken1 + pendingRewardInUSD;
    console.log(`user's asset in ${pairInfo.token0Symbol}/${pairInfo.token1Symbol}  : $${totalUserAssetValue.toFixed(2)}`);
    return {
        ...pairInfo,
        userUSDValueToken0,
        userUSDValueToken1,
        totalUserUSDValue,
        rewardSymbol,
        rewardTokenPriceInUSD,
        pendingRewardAmount,
        pendingRewardInUSD,
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
    const pairContract = new ethers.Contract(pairAddress, UNISWAP_V2_PAIR_ABI, provider);
    const [token0Address, token1Address] = await Promise.all([
        pairContract.token0(),
        pairContract.token1()
    ]);

    const token0Contract = new ethers.Contract(token0Address, ERC20ABI, provider);
    const token1Contract = new ethers.Contract(token1Address, ERC20ABI, provider);

    const [token0Symbol, token1SymbolOrg] = await Promise.all([
        token0Contract.symbol(),
        token1Contract.symbol()
    ]);
    const token1Symbol = token1SymbolOrg =='WETH'?'ETH':token1SymbolOrg;

    const [reserve0, reserve1] = await pairContract.getReserves();
    const lpTotalSupply = await pairContract.totalSupply();

    // console.log(`Reserves - ${TOKEN0_SYMBOL}: ${reserve0}, ${TOKEN1_SYMBOL}: ${reserve1}`);
    console.log(`Reserves - ${token0Symbol}: ${reserve0}, ${token1Symbol}: ${reserve1}`);

    // Fetch prices from Binance API and calculate USD value
    const [prices0, prices1] = await Promise.all([
        axios.get(`https://api.binance.com/api/v3/ticker/price?symbol=${token0Symbol}USDT`),
        axios.get(`https://api.binance.com/api/v3/ticker/price?symbol=${token1Symbol}USDT`)
    ]);

    const token0PriceInUSD = parseFloat(prices0.data.price);
    const token1PriceInUSD = parseFloat(prices1.data.price);
    console.log(`${token0Symbol} price : $${token0PriceInUSD}, ${token1Symbol} price : $${token1PriceInUSD}`);
    const usdValueToken0 = (reserve0 / Math.pow(10, 18)) * token0PriceInUSD;
    const usdValueToken1 = (reserve1 / Math.pow(10, 18)) * token1PriceInUSD;
    console.log(`Reserve ${token0Symbol} : $${usdValueToken0.toFixed(2)},  ${token1Symbol} : $${usdValueToken1.toFixed(2)}`);

    // console.log(`${token1Symbol} price : $${token1PriceInUSD}`);
    // console.log(`Reserve ${token1Symbol} : $${usdValueToken1.toFixed(2)}`);

    return { token0Address, token0Symbol, token1Address, token1Symbol,
        usdValueToken0,
        usdValueToken1,
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
            infoMap.set(pid, userInfo);
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

async function getTokenPriceCMC(tokenSymbol) {
    try {
        const apiKey = env.CMC_API_KEY;
        const url = `https://pro-api.coinmarketcap.com/v1/cryptocurrency/quotes/latest?symbol=${tokenSymbol}`;

        const headers = {
            'X-CMC_PRO_API_KEY': apiKey,
        };

        const response = await axios.get(url, { headers });
        const tokenPriceInUSD = response.data.data[tokenSymbol].quote.USD.price;

        // console.log(`${tokenSymbol} price in USD from CoinMarketCap: $${tokenPriceInUSD}`);
        return tokenPriceInUSD;
        
    } catch (error) {
        console.error('Error fetching token price from Binance:', error);
        throw error;
    }
}


async function main() {
    const currentDateTime = new Date();
    console.log(`Current Date and Time: ${currentDateTime.toString()}`);

    const userInfoAll = await getUserPoolInfoAll(USER_ADDRESS);
    
    const totalUserAssetValueSum = Array.from(userInfoAll.values()).reduce((sum, userInfo) => sum + userInfo.totalUserAssetValue, 0);
    console.log(`Sum of all pool's total asset value: $${totalUserAssetValueSum.toFixed(2)}`);
    // console.log('userInfoAll=', JSON.stringify(userInfoAll, null, 2));
    // userInfoAll.forEach((userInfo, index) => {
    //     console.log(`Pool ${index } - Amount: ${userInfo.amount}`);
    // });

    return;

}

main();

