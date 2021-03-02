const { expect } = require('chai');
const { ethers } = require('hardhat');
const { parseUnits } = ethers.utils;
const {
  getKnownAccounts,
  getSwarm,
  getAccount,
  deployContract,
  deployBaseContracts,
  deployToken,
  ZERO_ADDRESS,
  takeSnapshot,
  revertToSnapshot,
} = require('../scripts/deploy-helpers');

const { updateAllowance } = require('../scripts/token-helpers');

const { getRandomAddress } = require('./test-helpers');

function parseSwm(x) {
  return parseUnits(x.toString(), 18);
}

describe('Minting and Fee', async () => {
  let snapshotId;

  let swm;
  let swmPriceOracle;
  let src20Registry;
  let tokenMinter;

  let src20;

  let issuer;
  let fee;
  let maxSupply;
  let nav;

  before(async () => {
    const [baseContracts] = await deployBaseContracts();
    swm = baseContracts.swm;
    swmPriceOracle = baseContracts.swmPriceOracle;
    tokenMinter = baseContracts.tokenMinter;
    src20Registry = baseContracts.src20Registry;

    await swmPriceOracle.updatePrice(1, 1); // set nice price 1 swm = 1 usd

    const [tokenContracts, tokenOptions] = await deployToken(baseContracts);
    src20 = tokenContracts.src20;
    maxSupply = tokenOptions.maxSupply;
    nav = tokenOptions.nav;
    fee = await tokenMinter.calcFee(nav);

    [, issuer, treasury, rewardsPool] = await ethers.getSigners();
    snapshotId = await takeSnapshot();
  });

  beforeEach(async function () {
    await revertToSnapshot(snapshotId);
    snapshotId = await takeSnapshot();
  });

  it('Computes stake properly', async () => {
    expect(await tokenMinter.calcFee(1000)).to.equal(parseSwm(1));
    expect(await tokenMinter.calcFee(500000)).to.equal(parseSwm(2500));
    expect(await tokenMinter.calcFee(600000)).to.equal(parseSwm(600000 * 0.005));
    expect(await tokenMinter.calcFee(1000000)).to.equal(parseSwm(1000000 * 0.005));
    expect(await tokenMinter.calcFee(5000000)).to.equal(parseSwm(5000000 * 0.0045));
    expect(await tokenMinter.calcFee(15000000)).to.equal(parseSwm(15000000 * 0.004));
    expect(await tokenMinter.calcFee(50000000)).to.equal(parseSwm(50000000 * 0.0025));
    expect(await tokenMinter.calcFee(100000000)).to.equal(parseSwm(100000000 * 0.002));
    expect(await tokenMinter.calcFee(150000000)).to.equal(parseSwm(150000000 * 0.0015));
    expect(await tokenMinter.calcFee(160000000)).to.equal(parseSwm(160000000 * 0.001));
  });

  it('Can mint as a token issuer with TokenMinter', async () => {
    const issuerSwmBefore = await swm.balanceOf(issuer.address);
    const supply = maxSupply.div(2);

    await swm.connect(issuer).approve(tokenMinter.address, fee);
    await expect(src20.connect(issuer).mint(supply))
      .to.emit(tokenMinter, 'Minted')
      .withArgs(supply, fee, issuer.address)
      .and.to.emit(src20, 'SupplyMinted')
      .withArgs(supply, issuer.address);

    // src20 total supply increased
    expect(await src20.totalSupply()).to.equal(supply);
    // issuer balance increased by supply
    expect(await src20.balanceOf(issuer.address)).to.equal(supply);
    // issuer swm balance decreased
    const issuerSwmAfter = await swm.balanceOf(issuer.address);
    expect(issuerSwmBefore.sub(fee)).to.equal(issuerSwmAfter);
    // 20% of the fee added to treasury
    expect(await swm.balanceOf(treasury.address)).to.equal(fee.mul(2).div(10));
    // 80% of the fee added to rewards pool
    expect(await swm.balanceOf(rewardsPool.address)).to.equal(fee.mul(8).div(10));
  });

  it('Can burn tokens');
  it('Cannot burn zero tokens');
  it('Cannot burn more than balance');
  it('Cannot burn when not owner');

  it('Cannot mint zero tokens', async () => {
    await expect(src20.connect(issuer).mint(0)).to.be.revertedWith(
      'SRC20: Mint amount must be greater than zero'
    );
  });

  it('Cannot directly through minter (as unauthorized)', async () => {
    await expect(tokenMinter.mint(src20.address, issuer.address, maxSupply)).to.be.revertedWith(
      'TokenMinter: Caller not authorized'
    );
  });

  it('Cannot mint more than total supply', async () => {
    await updateAllowance(issuer, swm, tokenMinter.address);
    await expect(src20.connect(issuer).mint(maxSupply.mul(2))).to.be.revertedWith(
      'SRC20: Mint amount exceeds maximum supply'
    );
  });

  /*
  it('Cannot mint unregistered tokens', async () => {
    await src20Registry.remove(src20.address);
    await expect(src20.connect(issuer).mint(src20.address, issuer.address, 1)).to.be.revertedWith(
      'Caller not token minter.'
    );
  });
   */

  it('Mints more if nav increased', async () => {
    await updateAllowance(issuer, swm, tokenMinter.address);
    const supply = maxSupply.div(2);
    await src20.connect(issuer).mint(supply);
    await src20.connect(issuer).updateNav(nav * 2);

    const issuerSwmBefore = await swm.balanceOf(issuer.address);
    const treasuryBefore = await swm.balanceOf(treasury.address);
    const rewardsPoolBefore = await swm.balanceOf(rewardsPool.address);
    await src20.connect(issuer).mint(supply);

    // src20 total supply increased
    expect(await src20.totalSupply()).to.equal(supply.mul(2));
    expect(await src20.balanceOf(issuer.address)).to.equal(supply.mul(2));
    expect(await swm.balanceOf(issuer.address)).to.equal(issuerSwmBefore.sub(fee));
    expect(await swm.balanceOf(treasury.address)).to.equal(treasuryBefore.add(fee.mul(2).div(10)));
    expect(await swm.balanceOf(rewardsPool.address)).to.equal(
      rewardsPoolBefore.add(fee.mul(8).div(10))
    );
  });

  it('Does not mint more if nav not increased', async () => {
    await updateAllowance(issuer, swm, tokenMinter.address);
    const supply = maxSupply.div(2);
    await src20.connect(issuer).mint(supply);

    const issuerSwmBefore = await swm.balanceOf(issuer.address);
    const treasuryBefore = await swm.balanceOf(treasury.address);
    const rewardsPoolBefore = await swm.balanceOf(rewardsPool.address);
    await src20.connect(issuer).mint(supply);

    // supply increases
    expect(await src20.totalSupply()).to.equal(supply.mul(2));
    expect(await src20.balanceOf(issuer.address)).to.equal(supply.mul(2));
    // but fees don't
    expect(await swm.balanceOf(issuer.address)).to.equal(issuerSwmBefore);
    expect(await swm.balanceOf(treasury.address)).to.equal(treasuryBefore);
    expect(await swm.balanceOf(rewardsPool.address)).to.equal(rewardsPoolBefore);
  });

  it('Cannot mint if issuer has not enough SWM balance', async () => {
    // get rid of most of my swm first
    await swm
      .connect(issuer)
      .transfer(getRandomAddress(), (await swm.balanceOf(issuer.address)).sub(1));
    await updateAllowance(issuer, swm, tokenMinter.address);
    await expect(src20.connect(issuer).mint(maxSupply)).to.be.revertedWith(
      'revert ERC20: transfer amount exceeds balance'
    );
  });

  /*
  it('Can increase and decrease supply after initial mint', async () => {
    const supply = maxSupply.div(2);
    await swm.connect(issuer).approve(src20Registry.address, fee.mul(10));
    await src20.connect(issuer).mint(src20.address, supply);
    const issuerSwmBefore = await swm.balanceOf(issuer.address);

    await expect(
      src20Registry.connect(issuer).increaseSupply(src20.address, issuer.address, supply)
    )
      .to.emit(src20Registry, 'SRC20SupplyIncreased')
      .withArgs(src20.address, issuer.address, fee, supply);

    // corect stake
    expect(await src20Registry.getStake(src20.address)).to.equal(fee.mul(2));
    // src20 total supply increased
    expect(await src20.totalSupply()).to.equal(maxSupply);
    // issuer balance increased by supply
    expect(await src20.balanceOf(issuer.address)).to.equal(maxSupply);
    // issuer swm balance decreased
    expect(await swm.balanceOf(issuer.address)).to.equal(issuerSwmBefore.sub(fee));

    await expect(
      src20Registry.connect(issuer).decreaseSupply(src20.address, issuer.address, supply)
    )
      .to.emit(src20Registry, 'SRC20SupplyDecreased')
      .withArgs(src20.address, issuer.address, fee, supply);

    // corect stake
    expect(await src20Registry.getStake(src20.address)).to.equal(fee);
    // src20 total supply decreased
    expect(await src20.totalSupply()).to.equal(supply);
    // issuer balance decreased by supply
    expect(await src20.balanceOf(issuer.address)).to.equal(supply);
    // issuer swm balance increased
    expect(await swm.balanceOf(issuer.address)).to.equal(issuerSwmBefore);
  });

  it('Cannot increase/decrease supply before initial mint', async () => {
    await expect(
      src20Registry.connect(issuer).increaseSupply(src20.address, issuer.address, 1)
    ).to.be.revertedWith('Cannot increase supply before initial stake&mint');
    await expect(
      src20Registry.connect(issuer).decreaseSupply(src20.address, issuer.address, 1)
    ).to.be.revertedWith('Cannot increase supply before initial stake&mint');
  });
   */
});
