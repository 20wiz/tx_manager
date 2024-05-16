require('dotenv').config();
const { ethers } = require("ethers");  //v6
const fs = require("fs");

const infuraID = process.env.INFURA_ID;

const providerUrl='https://mainnet.infura.io/v3/'+infuraID
// Use the Infura project ID to connect to the Ethereum node.
const infuraProvider = new ethers.JsonRpcProvider(providerUrl);

// Transaction hash
const txHash = "0x66feb61ff92b968068afbf2bd3c6a74785c4f54de40f318300f85fa69c294f36";

// Read the ABI file. (Smart contract ABI needed)
const abi = JSON.parse(fs.readFileSync("EasyRouter.json"));

// Asynchronous function to fetch the transaction
async function parseTransaction() {
  // Fetch transaction data
  const tx = await infuraProvider.getTransaction(txHash);
  // Fetch transaction receipt to get the actual gas used
  const receipt = await infuraProvider.getTransactionReceipt(txHash);

  if (tx) {
    // Transaction's input data
    const inputData = tx.data;

    // Create smart contract instance
    const contractInterface = new ethers.Interface(abi);

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
        let valETH='';
        if (arg.startsWith('amount')) {
            valETH = ethers.formatEther(val);
        }
        console.log(arg.padEnd(20,' '),val, valETH);
    });
  
    // Print the ETH value sent with the transaction
    const valueETH = ethers.formatEther(tx.value);
    console.log("ETH Value Sent: ", valueETH);
    console.log("Gas Fee: ", tx.gasPrice);
    console.log("Gas Limit: ", tx.gasLimit);
    console.log("Nonce: ", tx.nonce);
  } else {
    console.log("Transaction not found");
  }

  if (receipt) {
    console.log("Gas Used: ", receipt.gasUsed.toString());
  }
}

parseTransaction();
