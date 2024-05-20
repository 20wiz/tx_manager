require('dotenv').config();
const { ethers } = require("ethers");  //v6
const fs = require("fs");

const infuraID = process.env.INFURA_ID;

const providerUrl='https://mainnet.infura.io/v3/'+infuraID
// Use the Infura project ID to connect to the Ethereum node.
const infuraProvider = new ethers.providers.JsonRpcProvider(providerUrl);

// Transaction hash
// const txHash = "0x66feb61ff92b968068afbf2bd3c6a74785c4f54de40f318300f85fa69c294f36";

// Read the ABI file. (Smart contract ABI needed)
const abi = JSON.parse(fs.readFileSync("contract/EasyRouter.json"));

// Asynchronous function to fetch the transaction
async function parseTransaction() {
  // Fetch transaction data
  // const tx = await infuraProvider.getTransaction(txHash);
  // Fetch transaction receipt to get the actual gas used
  // const receipt = await infuraProvider.getTransactionReceipt(txHash);

  
    // Transaction's input data
    const txdata = '0x6b7345a9000000000000000000000000111111111117dc0aa78b770fa6a738034120c30200000000000000000000000000000000000000000000007e77ebcce71577855000000000000000000000000000000000000000000000007dd60a9f140228d7d8000000000000000000000000000000000000000000000000044d9cb9622466a6000000000000000000000000109ce173a40ac2e6facfdfa5d145caa43dfe43dc000000000000000000000000000000000000000000000000000000006649fac30000000000000000000000000000000000000000000000000000000000000016000000000000000000000000000000000000000000000000000000000000010000000000000000000000000000000000000000000000000000000000000000010000000000000000000000000000000000000000000000000000000000000000'
    const inputData = txdata;

    // Create smart contract instance
    const contractInterface = new ethers.utils.Interface(abi);
const { Interface } = require("@ethersproject/abi");
const { formatEther } = require("@ethersproject/units");

// Decode input data
const parsedTransaction = contractInterface.parseTransaction({ data: inputData });

console.log("Function Name: ", parsedTransaction.name);
console.log("Function Parameters: ");
// Print argument names
const functionFragment = contractInterface.getFunction(parsedTransaction.name);
const argumentNames = functionFragment.inputs.map(input => input.name);
// console.log("Argument Names: ", argumentNames);
argumentNames.forEach(arg => {
    const val = parsedTransaction.args[arg];
    let valETH = '';
    if (arg.startsWith('amount')) {
        valETH = formatEther(val);
    }
    console.log(arg.padEnd(20, ' '), val, valETH);
});

// Print the ETH value sent with the transaction
// const valueETH = formatEther(tx.value);
// console.log("ETH Value Sent: ", valueETH);
// console.log("Gas Fee: ", tx.gasPrice.toString());
// console.log("Gas Limit: ", tx.gasLimit.toString());
// console.log("Nonce: ", tx.nonce);

    // // Decode input data
    // const parsedTransaction = contractInterface.parseTransaction({ data: inputData });

    // console.log("Function Name: ", parsedTransaction.name);
    // console.log("Function Parameters: ");
    // // Print argument names
    // const functionFragment = contractInterface.getFunction(parsedTransaction.name);
    // const argumentNames = functionFragment.inputs.map(input => input.name);
    // // console.log("Argument Names: ", argumentNames);
    // argumentNames.forEach(arg => {
    //     const val = parsedTransaction.args[arg];
    //     let valETH='';
    //     if (arg.startsWith('amount')) {
    //         valETH = ethers.formatEther(val);
    //     }
    //     console.log(arg.padEnd(20,' '),val, valETH);
    // });
  
    // // Print the ETH value sent with the transaction
    // const valueETH = ethers.formatEther(tx.value);
    // console.log("ETH Value Sent: ", valueETH);
    // console.log("Gas Fee: ", tx.gasPrice);
    // console.log("Gas Limit: ", tx.gasLimit);
    // console.log("Nonce: ", tx.nonce);


  // if (receipt) {
  //   console.log("Gas Used: ", receipt.gasUsed.toString());
  // }
}

parseTransaction();
