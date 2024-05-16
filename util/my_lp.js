//reserve.js
const { ethers } = require('ethers');
const axios = require('axios');
const fs = require('fs');
require('dotenv').config();

const UNISWAP_V2_PAIR_ABI = [
    "function getReserves() external view returns (uint112 reserve0, uint112 reserve1, uint32 blockTimestampLast)",
    "function totalSupply() external view returns (uint256)"
];

const env = process.env;
// Read the ABI file. (Smart contract ABI needed)
const MASTERCHEF_ABI = JSON.parse(fs.readFileSync("./contract/MasterChef.json"));
const MASTERCHEF_ADDRESS = process.env.MASTERCHEF_ADDRESS; // Address of the MasterChef contract

const ALCHEMY_API_URL = process.env.ALCHEMY_ETH;
const PAIR_ADDRESS = process.env.PAIR_ADDRESS; // Address of the Uniswap V2 Pair
const TOKEN0_SYMBOL = process.env.TOKEN0_SYMBOL; // e.g., 'ETH'
const TOKEN1_SYMBOL = process.env.TOKEN1_SYMBOL; // e.g., 'DAI'
const USER_ADDRESS = process.env.USER_ADDRESS; // 

const provider = new ethers.providers.JsonRpcProvider(ALCHEMY_API_URL);
const pairContract = new ethers.Contract(PAIR_ADDRESS, UNISWAP_V2_PAIR_ABI, provider);
const masterChefContract = new ethers.Contract(MASTERCHEF_ADDRESS, MASTERCHEF_ABI, provider);


async function getReserves() {

    const [reserve0, reserve1] = await pairContract.getReserves();

    console.log(`Reserves - ${TOKEN0_SYMBOL}: ${reserve0}, ${TOKEN1_SYMBOL}: ${reserve1}`);

    // Fetch prices from Binance API and calculate USD value
    try {
        const prices = await axios.get(`https://api.binance.com/api/v3/ticker/price?symbol=${TOKEN0_SYMBOL}USDT`);
        const token0PriceInUSD = parseFloat(prices.data.price);
        console.log(`${TOKEN0_SYMBOL} price in USD: $${token0PriceInUSD}`);

        const usdValueToken0 = (reserve0 / Math.pow(10, 18)) * token0PriceInUSD;
        console.log(`Reserve amount of ${TOKEN0_SYMBOL} in USD: $${usdValueToken0.toFixed(2)}`);

        const prices1 = await axios.get(`https://api.binance.com/api/v3/ticker/price?symbol=${TOKEN1_SYMBOL}USDT`);
        const token1PriceInUSD = parseFloat(prices1.data.price);
        console.log(`${TOKEN1_SYMBOL} price in USD: $${token1PriceInUSD}`);

        const usdValueToken1 = (reserve1 / Math.pow(10, 18)) * token1PriceInUSD;
        console.log(`Reserve amount of ${TOKEN1_SYMBOL} in USD (TVL): $${usdValueToken1.toFixed(2)}`);
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

async function main() {
    const reserves = await getReserves();
    const userLP = await getUserLPAmount();
    //calc USD valued for user share 
    const userUSDValueToken0 = userLP.userLPShare * reserves.usdValueToken0;
    const userUSDValueToken1 = userLP.userLPShare * reserves.usdValueToken1;
    const totalUserUSDValue = userUSDValueToken0 + userUSDValueToken1;

    console.log(`User's share of ${TOKEN0_SYMBOL} in USD: $${userUSDValueToken0.toFixed(2)}`);
    console.log(`User's share of ${TOKEN1_SYMBOL} in USD: $${userUSDValueToken1.toFixed(2)}`);
    console.log(`Total user's share in USD: $${totalUserUSDValue.toFixed(2)}`);

    
}

main();

