//reserve.js
const { ethers } = require('ethers');
const axios = require('axios');
const fs = require('fs');
require('dotenv').config();

// const UNISWAP_V2_PAIR_ABI = [
//     "function getReserves() external view returns (uint112 reserve0, uint112 reserve1, uint32 blockTimestampLast)",
//     "function totalSupply() external view returns (uint256)"
// ];

const env = process.env;
// Read the ABI file. (Smart contract ABI needed)
const MASTERCHEF_ABI = JSON.parse(fs.readFileSync("./contract/MasterChef.json"));
const MASTERCHEF_ADDRESS = env.MASTERCHEF_ADDRESS; // Address of the MasterChef contract

const ALCHEMY_API_URL = env.ALCHEMY_ETH;
const PAIR_ADDRESS = env.PAIR_ADDRESS; // Address of the Uniswap V2 Pair
// const TOKEN0_SYMBOL = env.TOKEN0_SYMBOL; // e.g., 'ETH'
// const TOKEN1_SYMBOL = env.TOKEN1_SYMBOL; // e.g., 'DAI'
const USER_ADDRESS = env.USER_ADDRESS; // 

const provider = new ethers.providers.JsonRpcProvider(ALCHEMY_API_URL);


const UNISWAP_V2_PAIR_ABI = JSON.parse(fs.readFileSync("./contract/UniswapV2Pair.json"));

const pairContract = new ethers.Contract(PAIR_ADDRESS, UNISWAP_V2_PAIR_ABI, provider);
const masterChefContract = new ethers.Contract(MASTERCHEF_ADDRESS, MASTERCHEF_ABI, provider);

async function getPairInfo() {
    const token0Address = await pairContract.token0();
    const token0Contract = new ethers.Contract(token0Address, ERC20ABI, provider);
    const token0Symbol = await token0Contract.symbol();
    const token1Address = await pairContract.token1();
    const token1Contract = new ethers.Contract(token1Address, ERC20ABI, provider);
    const token1SymbolOrg = (await token1Contract.symbol()) ;
    const token1Symbol = token1SymbolOrg =='WETH'?'ETH':token1SymbolOrg;
    return { token0Address, token0Symbol, token1Address, token1Symbol };
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


async function getReserves(token0Symbol,token1Symbol) {

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

    const {token0Address, token0Symbol, token1Address, token1Symbol} = await getPairInfo();

    const reserves = await getReserves(token0Symbol,token1Symbol);
    const userLP = await getUserLPAmount();
    //calc USD valued for user share 
    const userUSDValueToken0 = userLP.userLPShare * reserves.usdValueToken0;
    const userUSDValueToken1 = userLP.userLPShare * reserves.usdValueToken1;
    const totalUserUSDValue = userUSDValueToken0 + userUSDValueToken1;

    console.log(`User's share of ${token0Symbol} in USD: $${userUSDValueToken0.toFixed(2)}`);
    console.log(`User's share of ${token1Symbol} in USD: $${userUSDValueToken1.toFixed(2)}`);
    console.log(`Total user's share in USD: $${totalUserUSDValue.toFixed(2)}`);

    const rewardSymbol = await fetchRewardTokenSymbol();
    // console.log('rewardSymbol=', rewardSymbol);
    const rewardTokenPriceInUSD = await getTokenPriceCMC(rewardSymbol);
    console.log(`${rewardSymbol} price in USD from CoinMarketCap: $${rewardTokenPriceInUSD}`);

    const pid = env.PID;
    const pendingReward = await getPendingReward(pid, USER_ADDRESS, rewardSymbol);
    const pendingRewardAmount = (pendingReward / Math.pow(10, 18))
    const pendingRewardInUSD = pendingRewardAmount * rewardTokenPriceInUSD;
    console.log(`Pending reward for user ${USER_ADDRESS} ${pendingRewardAmount.toFixed(2)}`);
    console.log('pendingRewardInUSD=', pendingRewardInUSD.toFixed(2));

    const totalUserAssetValue = userUSDValueToken0 + userUSDValueToken1 + pendingRewardInUSD;
    console.log(`Total user's asset in USD: $${totalUserAssetValue.toFixed(2)}`);
}

main();

