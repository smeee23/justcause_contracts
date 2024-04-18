require("@nomicfoundation/hardhat-toolbox");
require("@nomiclabs/hardhat-truffle5");
require("@nomicfoundation/hardhat-verify");

const { networks } = require("./networks")

const SOLC_SETTINGS = {
  optimizer: {
    enabled: true,
    runs: 1_000,
  },
}

/** @type import('hardhat/config').HardhatUserConfig */
module.exports = {
  solidity: {
    compilers: [
      {
        version: "0.8.9",
        settings: SOLC_SETTINGS,
      },
    ]
  },

  networks: {
    /*hardhat: {
      allowUnlimitedContractSize: true,
      accounts: process.env.PRIVATE_KEY
        ? [
            {
              privateKey: process.env.PRIVATE_KEY,
              balance: "10000000000000000000000",
            },
          ]
        : [],
    },*/
    ...networks,
  },

  etherscan: {
    //abritrum
    apiKey: "1CVTWICNSWKHJY73C35GC3JY8JWWNQW7S9"
    //optimism
    //apiKey: "T8XJQ27ZDDDR9YN9WQBKJR8Q6EGJ4EMHKG"
  },
  paths: {
    sources: "./contracts",
    tests: "./test",
    cache: "./build/cache",
    artifacts: "./build/artifacts",
  },
  mocha: {
    timeout: 200000, // 200 seconds max for running tests
  },
};
