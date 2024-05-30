const { ethers } = require('ethers');
require('dotenv').config();

const env = process.env;

// Load environment variables
const providerUrl = process.env.ALCHEMY_ETH; // or any other provider URL
const privateKey = process.env.PRIVATE_KEY; // Your wallet's private key
const contractAddress = process.env.EASYROUTER_ADDRESS; // Address of the deployed contract
const contractABI = require('../contract/EasyRouter.json'); // ABI of the contract

// Initialize provider and wallet
const provider = new ethers.providers.JsonRpcProvider(providerUrl);
const wallet = new ethers.Wallet(privateKey, provider);

const tokenAddress = env.TOKEN_ADDRESS

async function checkTokenAllowance(tokenAddress, ownerAddress, spenderAddress) {
  const tokenABI = [
    "function allowance(address owner, address spender) external view returns (uint256)"
  ];
  const tokenContract = new ethers.Contract(tokenAddress, tokenABI, provider);

  try {
    const allowance = await tokenContract.allowance(ownerAddress, spenderAddress);
    console.log(`Allowance: ${ethers.utils.formatUnits(allowance, 18)} tokens`);
    return allowance;
  } catch (error) {
    console.error('Error checking token allowance:', error);
    throw error;
  }
}
async function approveToken(tokenAddress, spenderAddress, amount) {
  const tokenABI = [
    "function approve(address spender, uint256 amount) external returns (bool)"
  ];
  const tokenContract = new ethers.Contract(tokenAddress, tokenABI, wallet);

  try {
    const tx = await tokenContract.approve(spenderAddress, amount);
    console.log('Transaction hash:', tx.hash);

    // Wait for the transaction to be mined
    const receipt = await tx.wait();
    console.log('Transaction was mined in block:', receipt.blockNumber);
    return receipt;
  } catch (error) {
    console.error('Error approving token allowance:', error);
    throw error;
  }
}



// Initialize contract
const contract = new ethers.Contract(contractAddress, contractABI, wallet);


async function addLiquidityETH(tokenAmount, ethAmount, ethAmountMin) {
  const amountTokenDesired = ethers.utils.parseUnits(tokenAmount, 18); // Replace with the desired token amount
  const amountTokenMin = ethers.utils.parseUnits((0.95 * tokenAmount).toString(), 18); // Replace with the minimum token amount
  const amountETHMin = ethers.utils.parseUnits(""+ethAmountMin, 18); // Replace with the minimum ETH amount
  const to = wallet.address; // Replace with the recipient address
  const deadline = Math.floor(Date.now() / 1000) + 60 * 20; // 20 minutes from the current Unix time
  const pid = 6;  //6 ONDO Sepolia// Replace with the actual pool ID
  const proof = '0x'; // Replace with the actual proof if needed

  // Calculate the value to send with the transaction (amount of ETH)
  const value = ethers.utils.parseUnits(ethAmount, 18); // Replace with the amount of ETH to send
  const gasPrice = ethers.utils.parseUnits('1', 'gwei'); // Replace with the desired gas price
  const gasLimit = 600000; 
//   const nonce = 3
  ;
  try {
    const tx = await contract.addLiquidityETH(
      tokenAddress,
      amountTokenDesired,
      amountTokenMin,
      amountETHMin,
      to,
      deadline,
      pid,
      proof,
      { 
        value,
        gasPrice,
        gasLimit,
        // nonce,
      }
    );

    console.log('Transaction hash:', tx.hash);

    // Wait for the transaction to be mined
    const receipt = await tx.wait();
    console.log('Transaction was mined in block:', receipt.blockNumber);
  } catch (error) {
    console.error('Error adding liquidity:', error);
  }
}

async function main(){
    // Example usage
    const ownerAddress = wallet.address;
    const spenderAddress = contractAddress;
    // const requiredAllowance = ethers.utils.parseUnits('1000000000', 18); // Replace with the required token allowance
    // const maxAllowance = ethers.BigNumber.from("0xffffffffffff");
    const maxAllowance = ethers.BigNumber.from("0xffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff");

    // const allowance = await checkTokenAllowance(tokenAddress, ownerAddress, spenderAddress);
    // console.log('Current allowance:', ethers.utils.formatUnits(allowance, 18));

    // if (allowance.lt(maxAllowance)) {
    //     console.log('Allowance is insufficient. trying to approve the required amount first.');
    //     const tx = await approveToken(tokenAddress, spenderAddress, maxAllowance);
    //     // await tx.wait();
    //     console.log('Token approved.');
    // }


    const ETHamount ="0.01";
    const tokenAmount ="97.3"
    // Call the function
    const rec = await addLiquidityETH(tokenAmount, ETHamount, ETHamount*0.95);
}

main();