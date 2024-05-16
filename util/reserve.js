//reserve.js
const { ethers } = require('ethers');
const axios = require('axios');
require('dotenv').config();

const UNISWAP_V2_PAIR_ABI = [
    "function getReserves() external view returns (uint112 reserve0, uint112 reserve1, uint32 blockTimestampLast)"
];


// Environment variables
const ALCHEMY_API_URL = process.env.ALCHEMY_ETH;
const PAIR_ADDRESS = process.env.PAIR_ADDRESS; // Address of the Uniswap V2 Pair
const TOKEN0_SYMBOL = process.env.TOKEN0_SYMBOL; // e.g., 'ETH'
const TOKEN1_SYMBOL = process.env.TOKEN1_SYMBOL; // e.g., 'DAI'
const MASTERCHEF_ADDRESS = process.env.MASTERCHEF_ADDRESS; // Address of the MasterChef contract

async function getReserves() {
    const provider = new ethers.providers.JsonRpcProvider(ALCHEMY_API_URL);
    const pairContract = new ethers.Contract(PAIR_ADDRESS, UNISWAP_V2_PAIR_ABI, provider);

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
    } catch (error) {
        console.error('Error fetching prices from Binance:', error);
    }
}

getReserves();
