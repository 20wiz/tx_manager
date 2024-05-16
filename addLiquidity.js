// use ethers v5
const { ethers } = require("ethers");
const fs = require("fs");
require('dotenv').config();
const axios = require("axios");

const Auth = Buffer.from(
  process.env.INFURA_ID + ":" + process.env.INFURA_SECRET,
).toString("base64");

const chainId = process.env.CHAIN_ID;

const infuraID = process.env.INFURA_ID;
const providerUrl = process.env.PROVIDER + infuraID;
const provider = new ethers.providers.JsonRpcProvider(providerUrl);

const privateKey = process.env.PRIVATE_KEY; // Your wallet's private key
const wallet = new ethers.Wallet(privateKey, provider);

const abi = JSON.parse(fs.readFileSync("EasyRouter.json"));
const tokenAddress = process.env.TOKEN_ADDRESS; // Replace with your token address

const contractAddress = process.env.EASYROUTER_ADDRESS; // Replace with your contract address
const contract = new ethers.Contract(contractAddress, abi, wallet);

async function getGasFees() {
    const Auth = Buffer.from(
        process.env.INFURA_ID + ":" + process.env.INFURA_SECRET,
    ).toString("base64");

    const chainId = process.env.CHAIN_ID;// Ethereum Mainnet

    try {
        const { data } = await axios.get(
            `https://gas.api.infura.io/networks/${chainId}/suggestedGasFees`,
            {
                headers: { Authorization: `Basic ${Auth}` },
            },
        );
        return data;
    } catch (error) {
        console.error("Error fetching gas fees:", error);
        throw error;
    }
}

async function main() {
    const ethAmount = ethers.utils.parseEther("0.01");
    const tokenAmount = await getOptimalAmounts(tokenAddress, ethAmount);
    console.log('tokenAmount, ethAmount=', tokenAmount, ethAmount);
    console.log('tokenAmount, ethAmount=', ethers.utils.formatEther(tokenAmount), ethers.utils.formatEther(ethAmount));
    addLiquidityETH(process.env.PID, tokenAmount, ethAmount);
}

async function getOptimalAmounts(tokenAddress, ethAmount) {
    const pairAddress = process.env.PAIR_ADDRESS;
    const pairContract = new ethers.Contract(pairAddress, [
        "function getReserves() external view returns (uint112 reserve0, uint112 reserve1, uint32 blockTimestampLast)"
    ], provider);

    const [reserve0, reserve1] = await pairContract.getReserves();
    const tokenReserve = tokenAddress < contract.WETH() ? reserve0 : reserve1;
    const ethReserve = tokenAddress < contract.WETH() ? reserve1 : reserve0;

    const optimalTokenAmount = ethAmount.mul(tokenReserve).div(ethReserve);
    return optimalTokenAmount;
}

async function addLiquidityETH(pid, amount, ethAmount) {
    const tokenContract = new ethers.Contract(tokenAddress, [
        "function allowance(address owner, address spender) external view returns (uint256)",
        "function approve(address spender, uint256 amount) external returns (bool)"
    ], wallet);

    const allowance = await tokenContract.allowance(wallet.address, contractAddress);
    console.log('allowance=', allowance);

    if (allowance.lt(amount)) {
        console.log('allowance < amount');
        const txApprove = await tokenContract.approve(contractAddress, amount.mul(2));
        console.log('txApprove=', txApprove);
    }

    const gasFees = await getGasFees();
    const gasLimit = ethers.utils.hexlify(1000000); // Set your desired gas limit
    const gasPrice = ethers.utils.parseUnits(gasFees.medium.suggestedMaxFeePerGas, 'gwei'); // Use medium gas price

    const tx = await contract.addLiquidityETH(
        tokenAddress,
        amount,
        amount.mul(9).div(10), // amountTokenMin
        ethAmount.mul(9).div(10), // amountETHMin
        wallet.address,
        Math.floor(Date.now() / 1000) + 60 * 5, // 5 minutes from the current Unix time
        pid, // pid
        "0x", // proof
        {
            value: ethAmount,
            gasLimit: gasLimit,
            gasPrice: gasPrice,
            nonce: 0
        }
    );

    console.log("Transaction hash:", tx.hash);
}

// Example usage
getPendingRewardInUSD(process.env.PID, process.env.USER_ADDRESS).then((usdValue) => {
    console.log('Pending reward in USD:', usdValue);
}).catch((error) => {
    console.error('Error calculating pending reward in USD:', error);
});


main().then(() => {
    console.log('done');
});

