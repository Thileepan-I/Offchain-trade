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

  async function signOrderMessage(account, buyerAddress, message) {
    // Step 1: Hash the original message
    const originalMessageHash = ethers.solidityPackedKeccak256(["address", "uint256"], [buyerAddress, message]);
    
    // Note: In Foundry, the message is prefixed and hashed again. In Ethers.js, we simulate this by signing the original hash directly.
    // Ethers.js's signMessage method will automatically prefix the message with "\x19Ethereum Signed Message:\n32" and hash it again internally.

    // Step 2: Sign the message hash
    const signature = await account.signMessage(ethers.getBytes(originalMessageHash));

    // The signature is now in the format that the Ethereum network and your contract's verification method expects.
    // If you need to split the signature into r, s, and v components for any reason, you can do so using ethers.js utilities.
    return signature;
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

  it("should allow a user to register as a buyer for an order", async function () {
    const { offchainTrade, seller, buyer } = await loadFixture(deployContract);
    // Listing an order as a seller with ETH for simplicity
    const amount = ethers.parseEther("1");
    await offchainTrade.connect(seller).listOrderAsSeller(1, ethers.ZeroAddress, { value: amount.toString() });

    // Registering as a buyer for the order
    const orderId = 1; // Assuming this is the first and only order so far
    await expect(offchainTrade.connect(buyer).registerAsBuyer(orderId, 12345))
      .to.emit(offchainTrade, "RegisterAsBuyer")
      .withArgs(buyer.address, orderId);
});

it("should allow the seller to release funds to the registered buyer", async function () {
  const { offchainTrade, seller, buyer } = await loadFixture(deployContract);
  // Listing an order with ETH by the seller


  const orderAmount = ethers.parseEther("1");
  console.log(orderAmount,orderAmount.toString())
  await offchainTrade.connect(seller).listOrderAsSeller(orderAmount.toString(), ethers.ZeroAddress, { value: orderAmount.toString() });
  console.log(ethers.ZeroAddress);

  // Registering as a buyer for the order
  const orderId = 1; // The orderId of the previously listed order
  await offchainTrade.connect(buyer).registerAsBuyer(orderId, 12345);

  // Generating a valid signature
  const message = 12345; // Example message, could be a nonce or order-specific data
  const signature = await signOrderMessage(seller, orderId, buyer.address, message);
console.log(signature);
  // Releasing funds using the valid signature
  await expect(offchainTrade.connect(seller).releaseFunds(orderId, signature, buyer.address))
    .to.emit(offchainTrade, "FundsReleased")
    .withArgs(buyer.address, orderId);
});

});