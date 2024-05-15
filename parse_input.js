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

  if (tx) {
    // Transaction's input data
    const inputData = tx.data;

    // Create smart contract instance
    const contractInterface = new ethers.Interface(abi);

    // Decode input data
    const parsedTransaction = contractInterface.parseTransaction({ data: inputData });

    console.log("Function Name: ", parsedTransaction.name);
    console.log("Function Parameters: ", parsedTransaction.args);
  } else {
    console.log("Transaction not found");
  }
}

parseTransaction();
