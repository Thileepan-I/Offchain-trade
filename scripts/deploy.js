const hre = require("hardhat");
const fs = require("fs");
const path = require("path");

async function main() {
  // Deploy HFT contract
  const offchainTrade = await hre.ethers.deployContract("OffchainTrade");
  await offchainTrade.waitForDeployment();
  console.log(`Offchain deployed to: ${offchainTrade.target}`);

    // Addresses object to be written into JSON
    const contractAddress = offchainTrade.target;
  
    // Writing the addresses to a JSON file
    const filePath = path.join('./frontend/abis', 'deployedAddress.json');
    fs.writeFileSync(filePath, JSON.stringify(contractAddress, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
