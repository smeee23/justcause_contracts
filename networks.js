// All supported networks and related contract addresses are defined here.
//
// LINK token addresses: https://docs.chain.link/resources/link-token-contracts/
// Price feeds addresses: https://docs.chain.link/data-feeds/price-feeds/addresses
// Chain IDs: https://chainlist.org/?testnets=true
const { ethers } = require("ethers");
require("dotenv").config({path: ".env"});

const DEFAULT_VERIFICATION_BLOCK_CONFIRMATIONS = 2
const npmCommand = process.env.npm_lifecycle_event
const isTestEnvironment = npmCommand == "test" || npmCommand == "test:unit"

console.log("phrase", process.env.MNEMONIC)
// Set EVM private key (required)
const PRIVATE_KEY = ethers.Wallet.fromPhrase(process.env.MNEMONIC).privateKey;

if (!isTestEnvironment && !PRIVATE_KEY) {
  throw Error("Set the PRIVATE_KEY environment variable with your EVM wallet private key")
}

const networks = {
  polygon: {
    url: "https://polygon-mainnet.infura.io/v3/c6e0956c0fb4432aac74aaa7dfb7687e",
    accounts: PRIVATE_KEY !== undefined ? [PRIVATE_KEY] : [],
    chainId: 137,
    confirmations: DEFAULT_VERIFICATION_BLOCK_CONFIRMATIONS,
    nativeCurrencySymbol: "MATIC",
    poolAddressesProviderAddr: "0xa97684ead0e402dC232d5A977953DF7ECBaB3CDb",
    wethGatewayAddr: "0x9BdB5fcc80A49640c7872ac089Cc0e00A98451B6",
    multiSig: "0xed8C646e1d73847dBb799D39f193C185D6A8A010",
  },
  polygon_mumbai: {
    url: "https://polygon-mumbai.infura.io/v3/c6e0956c0fb4432aac74aaa7dfb7687e",
    accounts: PRIVATE_KEY !== undefined ? [PRIVATE_KEY] : [],
    chainId: 80001,
    confirmations: DEFAULT_VERIFICATION_BLOCK_CONFIRMATIONS,
    nativeCurrencySymbol: "MATIC",
    poolAddressesProviderAddr: "0x5343b5bA672Ae99d627A1C87866b8E53F47Db2E6",
    wethGatewayAddr: "0x2a58E9bbb5434FdA7FF78051a4B82cb0EF669C17",
    multiSig: "0x78726673245fdb56425c8bd782f6FaA3E447625A",
  },
  arbitrum: {
    url: "https://arbitrum-mainnet.infura.io/v3/c6e0956c0fb4432aac74aaa7dfb7687e",
    accounts: PRIVATE_KEY !== undefined ? [PRIVATE_KEY] : [],
    chainId: 42161,
    confirmations: 2,
    nativeCurrencySymbol: "ETH",
    poolAddressesProviderAddr: "0x770ef9f4fe897e59daCc474EF11238303F9552b6",
    wethGatewayAddr: "0xB5Ee21786D28c5Ba61661550879475976B707099",
    multiSig: "",
  },
  arbitrum_goerli: {
    url: "https://arbitrum-goerli.infura.io/v3/c6e0956c0fb4432aac74aaa7dfb7687e",
    accounts: PRIVATE_KEY !== undefined ? [PRIVATE_KEY] : [],
    chainId: 421613,
    confirmations: 2,
    nativeCurrencySymbol: "ETH",
    poolAddressesProviderAddr: "0x4EEE0BB72C2717310318f27628B3c8a708E4951C",
    wethGatewayAddr: "0xeaDF3f9870b296cB5E86aA085d4339944c6789f3",
    multiSig: "0x78726673245fdb56425c8bd782f6FaA3E447625A",
  },
}

module.exports = {
  networks,
}
