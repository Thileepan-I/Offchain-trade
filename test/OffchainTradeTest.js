const { loadFixture } = require("@nomicfoundation/hardhat-network-helpers");
const { expect } = require("chai");

describe("OffchainTrade Contract", function () {
  let owner, seller, buyer, addr1;

  async function deployContract() {
    [owner, seller, buyer, addr1] = await ethers.getSigners();
    const OffchainTradeFactory = await ethers.getContractFactory("OffchainTrade");
    const offchainTrade = await OffchainTradeFactory.deploy();
    const TestToken = await ethers.getContractFactory("TestToken");
    const testToken = await TestToken.deploy(owner);
    return { offchainTrade,testToken, owner, seller, buyer, addr1 };
  }

  // console.log(ethers.parseEther("1"));

  it("should allow a seller to list an order with ETH", async function () {
    const { offchainTrade, seller } = await loadFixture(deployContract);
    const amount = ethers.parseEther("1"); // Correctly use ethers.utils.parseEther for Wei conversion

    // Adjust the test to reflect the correct handling of Ether to Wei conversion
    await expect(offchainTrade.connect(seller).listOrderAsSeller(1, ethers.ZeroAddress, { value: amount.toString() }))
      .to.emit(offchainTrade, "OrderListed")
      .withArgs(seller.address, 1, ethers.ZeroAddress,0); // Adjusted arguments to match expected function output
  });

  it("should allow a seller to list an order with TestToken", async function () {
    const { offchainTrade, testToken, owner, seller } = await loadFixture(deployContract);
    const tokenAmount = ethers.parseUnits("1"); // Assuming token has 18 decimals
    // console.log(offchainTrade.target,seller.address,testToken.target)


    // Mint tokens to the seller using the deployer (owner) account
    await testToken.connect(owner).mint(seller.address, tokenAmount);

    // Seller approves OffchainTrade contract to spend their tokens
    await testToken.connect(seller).approve(offchainTrade.target, tokenAmount);

    // Seller lists the order
    await expect(offchainTrade.connect(seller).listOrderAsSeller(tokenAmount, testToken.target))
      .to.emit(offchainTrade, "OrderListed")
      .withArgs(seller.address, tokenAmount, testToken.target, 0); // Correct event parameters

    // Verify that the OffchainTrade contract is approved to spend the tokens
    const allowance = await testToken.allowance(seller.address, offchainTrade.target);
    expect(allowance).to.equal(tokenAmount);
  });
});