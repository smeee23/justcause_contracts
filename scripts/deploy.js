//require("dotenv").config({path: "../.env"});
const networks = require('../networks')
const hre = require("hardhat");

const { ethers } = require('ethers');

console.log('network');

let txReceipt;

async function followTransaction(transactionHash) {
  const transactionReceipt = await hre.ethers.provider.getTransactionReceipt(transactionHash);

  if (transactionReceipt === null) {
    // Transaction not mined yet, wait and try again
    await new Promise((resolve) => setTimeout(resolve, 5000)); // Wait for 5 seconds
    await followTransaction(transactionHash); // Recursive call to continue tracking
  } else {
    // Transaction is mined, report the details
    console.log('Transaction Mined!');
    console.log('Transaction Hash:', transactionHash);
    console.log('Block Number:', transactionReceipt.blockNumber);
    console.log('Gas Used:', transactionReceipt.gasUsed.toString());
    console.log('Status:', transactionReceipt.status === 1 ? 'Success' : 'Failure');
    console.log("transactionReceipt", transactionReceipt.status);
    txReceipt = transactionReceipt;
  }
}

async function main(){

  const [deployer] = await hre.ethers.getSigners();

  console.log('Deploying contracts with the account:', deployer.address);

  // Retrieve the network name
  const network = await hre.ethers.provider.getNetwork();

  
  //Load the network configuration from networks.js
  let networkConfig = networks["networks"][network.name];
  //console.log("network", network.name, Object.keys(networks["networks"]), networkConfig);

  if(!networkConfig){
    networkConfig = {
      poolAddressesProviderAddr: "0x4EEE0BB72C2717310318f27628B3c8a708E4951C",
      wethGatewayAddr: "0xeaDF3f9870b296cB5E86aA085d4339944c6789f3",
      multiSig: "0x78726673245fdb56425c8bd782f6FaA3E447625A",
    };
  }
  const PoolTracker =  await hre.ethers.getContractFactory("PoolTracker");
  const poolTracker = await PoolTracker.deploy(
    networkConfig.poolAddressesProviderAddr, 
    networkConfig.wethGatewayAddr, 
    networkConfig.multiSig,
  );

  await followTransaction(poolTracker.deploymentTransaction().hash);

  if(txReceipt.status === 1){
    console.log('PoolTracker Deployment Success!');
    console.log('PoolTracker Address:', poolTracker.target);
    console.log('Network:', network.name);
  }
  else{
    console.log('PoolTracker Deployment Failure');
  }

}

// Run the deployment script
main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
