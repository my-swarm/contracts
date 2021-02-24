const { expect } = require('chai');
const { ethers } = require('hardhat');
const { parseUnits } = ethers.utils;
const {
  deployBaseContracts,
  deployTokenContracts,
  ZERO_ADDRESS,
  getIssuer,
  getAddresses,
  takeSnapshot,
  revertToSnapshot,
} = require('../scripts/deploy-helpers');
const { updateAllowance, stakeAndMint } = require('../scripts/token-helpers');

const { getRandomAddress, getRandomAddresses } = require('./test-helpers');

describe('Transfering SRC20', async () => {
  let snapshotId;

  let issuer;
  let src20;
  let transferRules;
  let features;
  let accounts;
  let addr;
  let supply;
  let balance;
  let amount;

  before(async () => {
    const [baseContracts] = await deployBaseContracts();
    const [tokenContracts] = await deployTokenContracts(baseContracts, { transferRules: true });

    issuer = await getIssuer();

    supply = parseUnits('1000000', 18);
    balance = parseUnits('100', 18);
    amount = parseUnits('20', 18);
    transferRules = tokenContracts.transferRules;
    features = tokenContracts.features;
    src20 = tokenContracts.src20;
    accounts = (await ethers.getSigners()).slice(10, 14);
    addr = (await getAddresses()).slice(10, 14);

    await stakeAndMint({ ...baseContracts, ...tokenContracts }, 1000, supply);

    await src20.connect(issuer).bulkTransfer(
      addr,
      addr.map((x) => balance)
    );
    // now we have addresses 0..3 with 100 tokens
    snapshotId = await takeSnapshot();
  });

  beforeEach(async function () {
    await revertToSnapshot(snapshotId);
    snapshotId = await takeSnapshot();
  });

  it('Allows free transfer from A to B without transfer rules', async () => {
    await src20.connect(issuer).updateTransferRules(ZERO_ADDRESS);
    await expect(src20.connect(accounts[0]).transfer(addr[1], amount))
      .to.emit(src20, 'Transfer')
      .withArgs(addr[0], addr[1], amount);
    expect(await src20.balanceOf(addr[0])).to.equal(balance.sub(amount));
    expect(await src20.balanceOf(addr[1])).to.equal(balance.add(amount));
  });

  it('Does not allow free transfer with transfer rules', async () => {
    await expect(src20.connect(accounts[0]).transfer(addr[1], amount)).to.be.revertedWith(
      'Transfer not authorized'
    );
    expect(await src20.balanceOf(addr[0])).to.equal(balance);
    expect(await src20.balanceOf(addr[1])).to.equal(balance);
  });

  it('Does not allow free transfer with only one listed account', async () => {
    await transferRules.connect(issuer).whitelistAccount(addr[0]);
    await expect(src20.connect(accounts[0]).transfer(addr[1], amount)).to.be.revertedWith(
      'Transfer not authorized'
    );
    await transferRules.connect(issuer).unWhitelistAccount(addr[0]);
    await transferRules.connect(issuer).greylistAccount(addr[0]);
    await expect(src20.connect(accounts[0]).transfer(addr[1], amount)).to.be.revertedWith(
      'Transfer not authorized'
    );
    await transferRules.connect(issuer).unGreylistAccount(addr[0]);
    await transferRules.connect(issuer).whitelistAccount(addr[1]);
    await expect(src20.connect(accounts[0]).transfer(addr[1], amount)).to.be.revertedWith(
      'Transfer not authorized'
    );
    await transferRules.connect(issuer).unWhitelistAccount(addr[1]);
    await transferRules.connect(issuer).greylistAccount(addr[1]);
    await expect(src20.connect(accounts[0]).transfer(addr[1], amount)).to.be.revertedWith(
      'Transfer not authorized'
    );
    await transferRules.connect(issuer).unGreylistAccount(addr[1]);
  });

  it('Allows transfer for two whitelisted accounts', async () => {
    await transferRules.connect(issuer).bulkWhitelistAccount([addr[0], addr[1]]);
    await expect(src20.connect(accounts[0]).transfer(addr[1], amount))
      .to.emit(src20, 'Transfer')
      .withArgs(addr[0], addr[1], amount);
    expect(await src20.balanceOf(addr[0])).to.equal(balance.sub(amount));
    expect(await src20.balanceOf(addr[1])).to.equal(balance.add(amount));
  });

  /*
  it('Creates transfer request if both accounts are graylisted', async () => {
    await transferRules.connect(issuer).bulkGreylistAccount([addr[0], addr[1]]);
    src20.connect(accounts[0]).transfer(addr[1], amount);
  });
*/

  async function createTransferRequest() {
    await transferRules.connect(issuer).bulkGreylistAccount([addr[0], addr[1]]);
    const requestId = await transferRules.requestCounter();
    await expect(src20.connect(accounts[0]).transfer(addr[1], amount))
      .to.emit(transferRules, 'TransferRequested')
      .withArgs(requestId, addr[0], addr[1], amount);
    return requestId;
  }

  it('Creates transfer request, transfers token from account A and increments request counter', async () => {
    const requestId = await createTransferRequest();
    const request = await transferRules.transferRequests(requestId);
    const newRequestId = await transferRules.requestCounter();
    expect(request.from).to.equal(addr[0]);
    expect(request.to).to.equal(addr[1]);
    expect(request.value).to.equal(amount);
    expect(newRequestId).to.equal(requestId.add(1));
    expect(await src20.balanceOf(addr[0])).to.equal(balance.sub(amount));
    expect(await src20.balanceOf(addr[1])).to.equal(balance);
  });

  async function checkEmptyRequest(requestId) {
    const request = await transferRules.transferRequests(requestId);
    expect(request.from).to.equal(ZERO_ADDRESS);
    expect(request.to).to.equal(ZERO_ADDRESS);
    expect(request.value).to.equal(0);
  }

  it('Can approve transfer request as owner', async () => {
    const requestId = await createTransferRequest();
    await expect(transferRules.connect(issuer).approveTransfer(requestId))
      .to.emit(transferRules, 'TransferApproved')
      .withArgs(requestId, addr[0], addr[1], amount);
    expect(await src20.balanceOf(addr[0])).to.equal(balance.sub(amount));
    expect(await src20.balanceOf(addr[1])).to.equal(balance.add(amount));
    await checkEmptyRequest(requestId);
  });

  async function testDeny(as) {
    const requestId = await createTransferRequest();
    await expect(transferRules.connect(issuer).denyTransfer(requestId))
      .to.emit(transferRules, 'TransferDenied')
      .withArgs(requestId, addr[0], addr[1], amount);
    expect(await src20.balanceOf(addr[0])).to.equal(balance);
    expect(await src20.balanceOf(addr[1])).to.equal(balance);
    await checkEmptyRequest(requestId);
  }

  it('Can deny transfer request as owner', async () => {
    await testDeny(issuer);
  });

  it('Can deny transfer request as the account who requested it', async () => {
    await testDeny(accounts[0]);
  });

  it('Cannot approve or deny request as a random account', async () => {
    const requestId = await createTransferRequest();
    await expect(transferRules.connect(accounts[3]).approveTransfer(requestId)).to.be.revertedWith(
      'Ownable: caller is not the owner'
    );
    await expect(transferRules.connect(accounts[3]).denyTransfer(requestId)).to.be.revertedWith(
      'Not owner or sender of the transfer request'
    );
    expect(await src20.balanceOf(addr[0])).to.equal(balance.sub(amount));
    expect(await src20.balanceOf(addr[1])).to.equal(balance);
  });

  it('Does not allow executeTransfer to be called directly', async () => {
    await expect(src20.executeTransfer(addr[0], addr[1], amount)).to.be.revertedWith(
      'Caller not authority'
    );
  });

  it('Allows transferFrom with allowance set', async () => {
    // we don't need to test transferRules variants because the mechanics is exactly the same as transfer
    await src20.connect(issuer).updateTransferRules(ZERO_ADDRESS);
    await updateAllowance(accounts[0], src20, addr[2], amount);
    await expect(src20.connect(accounts[2]).transferFrom(addr[0], addr[1], amount))
      .to.emit(src20, 'Transfer')
      .withArgs(addr[0], addr[1], amount);
    expect(await src20.balanceOf(addr[0])).to.equal(balance.sub(amount));
    expect(await src20.balanceOf(addr[1])).to.equal(balance.add(amount));
  });

  it('Does not transferFrom without anough allowance set', async () => {
    await src20.connect(issuer).updateTransferRules(ZERO_ADDRESS);
    await updateAllowance(accounts[0], src20, addr[2], amount.sub(1));
    await expect(
      src20.connect(accounts[2]).transferFrom(addr[0], addr[1], amount)
    ).to.be.revertedWith('SafeMath: subtraction overflow');
    expect(await src20.balanceOf(addr[0])).to.equal(balance);
    expect(await src20.balanceOf(addr[1])).to.equal(balance);
  });

  it('Checks datasets length for bulk transfer', async () => {
    const addresses = getRandomAddresses(6);
    const values = addresses.map((x) => balance).slice(1, 4);
    await expect(src20.connect(issuer).bulkTransfer(addresses, values)).to.be.revertedWith(
      'Input dataset length mismatch'
    );
  });

  it('Allows bulk transfer to delegate/owner', async () => {
    const addresses = getRandomAddresses(6);
    const values = addresses.map((x) => balance);
    await expect(src20.connect(issuer).bulkTransfer(addresses, values))
      .to.emit(src20, 'Transfer')
      .and.to.emit(src20, 'Transfer')
      .and.to.emit(src20, 'Transfer')
      .and.to.emit(src20, 'Transfer')
      .and.to.emit(src20, 'Transfer')
      .and.to.emit(src20, 'Transfer'); // <-- LOOOL :D
  });

  it('Does not allow bulk transfer to anyone else', async () => {
    await expect(src20.connect(accounts[3]).bulkTransfer([], [])).to.be.revertedWith(
      'Caller not delegate'
    );
  });
});
