const { ethers } = require("ethers"); // ethers v6
const fs = require("fs");
require('dotenv').config();

const infuraID = process.env.INFURA_ID;
const providerUrl = process.env.PROVIDER + infuraID;
const provider = new ethers.JsonRpcProvider(providerUrl);

const privateKey = process.env.PRIVATE_KEY; // Your wallet's private key
const wallet = new ethers.Wallet(privateKey, provider);

const abi = JSON.parse(fs.readFileSync("EasyRouter.json"));
const tokenAddress = process.env.TOKEN_ADDRESS; // R

const contractAddress = process.env.EASYROUTER_ADDRESS; // Replace with your contract address
const contract = new ethers.Contract(contractAddress, abi, wallet);


async function main() {

    const ethAmount = ethers.parseEther("0.01");
    const tokenAmount = await getOptimalAmounts( tokenAddress, ethAmount);
    console.log('tokenAmount, ethAmount=',tokenAmount, ethAmount);
    console.log('tokenAmount, ethAmount=',ethers.formatEther(tokenAmount) , ethers.formatEther(ethAmount));
    // const tokenAmountMin = tokenAmount * BigInt(9) / BigInt(10);
    // const ethAmountMin = ethAmount * BigInt(9) / BigInt(10);
    // console.log('tokenAmountMin, ethAmountMin=',tokenAmountMin, ethAmountMin);
    // console.log('tokenAmountMin, ethAmountMin=',ethers.formatEther(tokenAmountMin) , ethers.formatEther(ethAmountMin)); 
    addLiquidityETH(process.env.PID, tokenAmount, ethAmount);

}
async function getOptimalAmounts( tokenAddress, ethAmount) {
//   const pairAddress = await contract._getPairAddress(tokenAddress, contract.WETH());
  const pairAddress = process.env.PAIR_ADDRESS;
  const pairContract = new ethers.Contract(pairAddress, [
    "function getReserves() external view returns (uint112 reserve0, uint112 reserve1, uint32 blockTimestampLast)"
  ], provider);

  const [reserve0, reserve1] = await pairContract.getReserves();
  const tokenReserve = tokenAddress < contract.WETH() ? BigInt(reserve0) : BigInt(reserve1);
  const ethReserve = tokenAddress < contract.WETH() ? BigInt(reserve1) : BigInt(reserve0);

  const optimalTokenAmount = (ethAmount * tokenReserve) / ethReserve;
  return optimalTokenAmount;
}

async function addLiquidityETH(pid, amount, ethAmount ) {
//   const ethAmount = ethers.utils.parseEther("0.1");
//   const tokenAddress = "0xYourTokenAddress"; // Replace with your token address

// check allowance from tokenContract
const tokenContract = new ethers.Contract(tokenAddress, [
    "function allowance(address owner, address spender) external view returns (uint256)",
    "function approve(address spender, uint256 amount) external returns (bool)"
], provider);

 const allowance = await tokenContract.allowance(wallet.address, contractAddress);
 console.log('allowance=',allowance);

 if (allowance < amount) {
    console.log('allowance < amount');
    const txApprove = await tokenContract.approve(contractAddress, amount * BigInt(2));
    console.log('txApprove=',txApprove);
}



  const tx = await contract.addLiquidityETH(
    tokenAddress,
    amount,
    amount * BigInt(9) / BigInt(10), // amountTokenMin
    ethAmount* BigInt(9) / BigInt(10), // amountETHMin
    wallet.address,
    Math.floor(Date.now() / 1000) + 60 * 5, // 20 minutes from the current Unix time
    pid, // pid
    "0x" // proof
  , { value: ethAmount });

  console.log("Transaction hash:", tx.hash);
}

main().then(() => {
    console.log('done');
});

