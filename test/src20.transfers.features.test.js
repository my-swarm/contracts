const { expect } = require('chai');
const { ethers } = require('hardhat');
const { parseUnits } = ethers.utils;
const {
  deployBaseContracts,
  deployToken,
  ZERO_ADDRESS,
  getIssuer,
  getAddresses,
  takeSnapshot,
  revertToSnapshot,
} = require('../scripts/deploy-helpers');
const { mint } = require('../scripts/token-helpers');

const { getRandomAddress } = require('./test-helpers');

const FEATURE_TRANSFER = 1;
const FEATURE_PAUSABLE = 2;
const FEATURE_ACCOUNT_BURN = 4;
const FEATURE_ACCOUNT_FREEZE = 8;
const FEATURE_TRANSFER_RULES = 16;

describe('Transfering SRC20 with features', async () => {
  let snapshotId;

  let issuer;
  let src20;
  let features;
  let accounts;
  let addr;
  let supply;
  let balance;
  let amount;
  let baseContracts;

  before(async () => {
    [baseContracts] = await deployBaseContracts();
    supply = parseUnits('1000000', 18);
    balance = parseUnits('100', 18);
    amount = parseUnits('20', 18);

    snapshotId = await takeSnapshot();
  });

  beforeEach(async function () {
    await revertToSnapshot(snapshotId);
    snapshotId = await takeSnapshot();
  });

  async function deploy(featuresMap) {
    const [tokenContracts] = await deployToken(baseContracts, { features: featuresMap });

    issuer = await getIssuer();

    features = tokenContracts.features;
    src20 = tokenContracts.src20;
    accounts = (await ethers.getSigners()).slice(10, 14);
    addr = (await getAddresses()).slice(10, 14);

    await mint({ ...baseContracts, ...tokenContracts }, 1000, supply);

    await src20.connect(issuer).bulkTransfer(
      addr,
      addr.map(() => balance)
    );
    // now we have addresses 0..3 with 100 tokens
  }

  it('Can forceTransfer as owner', async () => {
    await deploy(FEATURE_TRANSFER);
    await expect(src20.connect(issuer).forceTransfer(addr[0], addr[1], amount)).to.emit(
      src20,
      'Transfer'
    );
  });
  it('Cannot forceTransfer as a random account', async () => {
    await deploy(FEATURE_TRANSFER);
    await expect(
      src20.connect(accounts[3]).forceTransfer(addr[0], addr[1], amount)
    ).to.be.revertedWith('Ownable: caller is not the owner');
  });

  it('Cannot forceTransfer if not enabled', async () => {
    await deploy(0);
    await expect(
      src20.connect(accounts[3]).forceTransfer(addr[0], addr[1], amount)
    ).to.be.revertedWith('Token feature is not enabled');
  });

  async function checkCanTransfer() {
    await expect(src20.connect(accounts[0]).transfer(addr[1], amount)).to.emit(src20, 'Transfer');
    expect(await src20.balanceOf(addr[0])).to.equal(balance.sub(amount));
    expect(await src20.balanceOf(addr[1])).to.equal(balance.add(amount));
  }

  async function checkCannotTransfer() {
    await expect(src20.connect(accounts[0]).transfer(addr[1], amount)).to.be.revertedWith(
      'Cannot transfer due to disabled feature'
    );
    expect(await src20.balanceOf(addr[0])).to.equal(balance);
    expect(await src20.balanceOf(addr[1])).to.equal(balance);
  }

  it('Cannot transfer if token is frozen (aka paused)', async () => {
    await deploy(FEATURE_PAUSABLE);
    await features.connect(issuer).pause();
    await checkCannotTransfer();
  });

  it('Cannot transfer if first account is frozen', async () => {
    await deploy(FEATURE_ACCOUNT_FREEZE);
    await features.connect(issuer).freezeAccount(addr[0]);
    await checkCannotTransfer();
    await features.connect(issuer).unfreezeAccount(addr[0]);
    await checkCanTransfer();
  });

  it('Cannot transfer if second account is frozen', async () => {
    await deploy(FEATURE_ACCOUNT_FREEZE);
    await features.connect(issuer).freezeAccount(addr[1]);
    await checkCannotTransfer();
    await features.connect(issuer).unfreezeAccount(addr[1]);
    await checkCanTransfer();
  });

  it('Cannot freeze account if not owner', async () => {
    await deploy(FEATURE_ACCOUNT_FREEZE);
    await expect(features.connect(accounts[0]).freezeAccount(addr[0])).to.be.revertedWith(
      'Ownable: caller is not the owner'
    );
  });

  it('Cannot unfreeze account if not owner', async () => {
    await deploy(FEATURE_ACCOUNT_FREEZE);
    await features.connect(issuer).freezeAccount(addr[1]);
    await expect(features.connect(accounts[0]).freezeAccount(addr[0])).to.be.revertedWith(
      'Ownable: caller is not the owner'
    );
  });

  it('Can burn account if enabled', async () => {
    await deploy(FEATURE_ACCOUNT_BURN);
    await expect(src20.connect(issuer).burnAccount(addr[0], amount))
      .to.emit(src20, 'Transfer')
      .withArgs(addr[0], ZERO_ADDRESS, amount);
    expect(await src20.balanceOf(addr[0])).to.equal(balance.sub(amount));
  });

  it('Can not burn account if disabled', async () => {
    await deploy(0);
    await expect(src20.burnAccount(addr[0], amount)).to.be.revertedWith(
      'Token feature is not enabled'
    );
  });

  it('Can change transfer rules contract if enabled', async () => {
    await deploy(FEATURE_TRANSFER_RULES);
    await expect(src20.connect(issuer).updateTransferRules(ZERO_ADDRESS))
      .to.emit(src20, 'TransferRulesUpdated')
      .withArgs(ZERO_ADDRESS);
    expect(await src20.transferRules()).to.equal(ZERO_ADDRESS);
  });

  it('Can not change transfer rules contract if disabled', async () => {
    await deploy(0);
    const address = getRandomAddress();
    await expect(src20.connect(issuer).updateTransferRules(address)).to.be.revertedWith(
      'Token feature is not enabled'
    );
  });

  it('Can not change transfer rules if not an owner', async () => {
    await deploy(FEATURE_TRANSFER_RULES);
    const address = getRandomAddress();
    await expect(src20.connect(accounts[0]).updateTransferRules(address)).to.be.revertedWith(
      'Ownable: caller is not the owner'
    );
  });
});
