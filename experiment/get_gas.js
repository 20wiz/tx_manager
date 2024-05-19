const axios = require("axios");
require("dotenv").config();

const Auth = Buffer.from(
  process.env.INFURA_ID + ":" + process.env.INFURA_SECRET,
).toString("base64");

const chainId = process.env.CHAIN_ID; // Ethereum Mainnet

(async () => {
  try {
    const { data } = await axios.get(
      `https://gas.api.infura.io/networks/${chainId}/suggestedGasFees`,
      {
        headers: { Authorization: `Basic ${Auth}` },
      },
    );
    console.log("Suggested gas fees:", JSON.stringify(data,'',' '));
  } catch (error) {
    console.log("Server responded with:", error);
  }
})();

// Suggested gas fees: {low: {…}, medium: {…}, high: {…}, estimatedBaseFee: '5.49655088', networkCongestion: 0.5603, …}