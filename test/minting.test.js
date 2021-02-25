const { expect } = require('chai');
const { ethers } = require('hardhat');
const { parseUnits } = ethers.utils;
const {
  getIssuer,
  getSwarm,
  getAccount,
  deployContract,
  deployBaseContracts,
  deployToken,
  ZERO_ADDRESS,
} = require('../scripts/deploy-helpers');

const { getRandomAddress, getRandomAddresses } = require('./test-helpers');

function parseSwm(x) {
  return parseUnits(x.toString(), 18);
}

describe('Minting and Staking', async () => {
  let swm;
  let swmPriceOracle;
  let src20Registry;
  let tokenMinter;

  let src20;

  let issuer;
  let issuerAddress;
  let nav;
  let stake;
  let maxSupply;

  beforeEach(async () => {
    const [baseContracts] = await deployBaseContracts();
    swm = baseContracts.swm;
    swmPriceOracle = baseContracts.swmPriceOracle;
    tokenMinter = baseContracts.tokenMinter;
    src20Registry = baseContracts.src20Registry;

    await swmPriceOracle.updatePrice(1, 1); // set nice price 1 swm = 1 usd

    const [tokenContracts, tokenOptions] = await deployToken(baseContracts);
    src20 = tokenContracts.src20;
    nav = tokenOptions.src20.nav;
    maxSupply = tokenOptions.src20.maxSupply;
    stake = await tokenMinter.calcStake(nav);

    issuer = await getIssuer();
    issuerAddress = await issuer.getAddress();
  });

  it('Computes stake properly', async () => {
    expect(await tokenMinter.calcStake(1000)).to.equal(parseSwm(2500));
    expect(await tokenMinter.calcStake(500000)).to.equal(parseSwm(2500));
    expect(await tokenMinter.calcStake(600000)).to.equal(parseSwm(600000 * 0.005));
    expect(await tokenMinter.calcStake(1000000)).to.equal(parseSwm(1000000 * 0.005));
    expect(await tokenMinter.calcStake(5000000)).to.equal(parseSwm(5000000 * 0.0045));
    expect(await tokenMinter.calcStake(15000000)).to.equal(parseSwm(15000000 * 0.004));
    expect(await tokenMinter.calcStake(50000000)).to.equal(parseSwm(50000000 * 0.0025));
    expect(await tokenMinter.calcStake(100000000)).to.equal(parseSwm(100000000 * 0.002));
    expect(await tokenMinter.calcStake(150000000)).to.equal(parseSwm(150000000 * 0.0015));
    expect(await tokenMinter.calcStake(160000000)).to.equal(parseSwm(160000000 * 0.001));
  });

  it('Can mint as a token issuer with TokenMinter', async () => {
    const issuerSwmBefore = await swm.balanceOf(issuerAddress);
    const supply = maxSupply.div(2);

    await swm.connect(issuer).approve(src20Registry.address, stake);
    await expect(tokenMinter.connect(issuer).mint(src20.address, supply))
      .to.emit(src20Registry, 'SRC20SupplyIncreased')
      .withArgs(src20.address, issuerAddress, stake, supply);

    // corect stake
    expect(await src20Registry.getStake(src20.address)).to.equal(stake);
    // src20 total supply increased
    expect(await src20.totalSupply()).to.equal(supply);
    // issuer balance increased by supply
    expect(await src20.balanceOf(issuerAddress)).to.equal(supply);
    // issuer swm balance decreased
    const issuerSwmAfter = await swm.balanceOf(issuerAddress);
    expect(issuerSwmBefore.sub(stake)).to.equal(issuerSwmAfter);
  });

  it('Cannot mint more than total supply', async () => {
    await swm.connect(issuer).approve(src20Registry.address, stake);
    await expect(
      tokenMinter.connect(issuer).mint(src20.address, maxSupply.mul(2))
    ).to.be.revertedWith('trying to mint too many tokens!');
  });

  it('Cannot mint zero tokens', async () => {
    await expect(tokenMinter.connect(issuer).mint(src20.address, 0)).to.be.revertedWith(
      'SRC20 amount is zero'
    );
  });

  it('Cannot mint unregistered tokens', async () => {
    await src20Registry.remove(src20.address);
    await expect(tokenMinter.connect(issuer).mint(src20.address, 1)).to.be.revertedWith(
      'Caller not token minter.'
    );
    // note: one might expect this revert instead: 'SRC20 token contract not registered'
    // but because the onlyMinter modifier effectively checks if the token is registered too,
    // it's fired before the require
  });

  it('Can increase and decrease supply after initial mint', async () => {
    const supply = maxSupply.div(2);
    await swm.connect(issuer).approve(src20Registry.address, stake.mul(10));
    await tokenMinter.connect(issuer).mint(src20.address, supply);
    const issuerSwmBefore = await swm.balanceOf(issuerAddress);

    await expect(src20Registry.connect(issuer).increaseSupply(src20.address, issuerAddress, supply))
      .to.emit(src20Registry, 'SRC20SupplyIncreased')
      .withArgs(src20.address, issuerAddress, stake, supply);

    // corect stake
    expect(await src20Registry.getStake(src20.address)).to.equal(stake.mul(2));
    // src20 total supply increased
    expect(await src20.totalSupply()).to.equal(maxSupply);
    // issuer balance increased by supply
    expect(await src20.balanceOf(issuerAddress)).to.equal(maxSupply);
    // issuer swm balance decreased
    expect(await swm.balanceOf(issuerAddress)).to.equal(issuerSwmBefore.sub(stake));

    await expect(src20Registry.connect(issuer).decreaseSupply(src20.address, issuerAddress, supply))
      .to.emit(src20Registry, 'SRC20SupplyDecreased')
      .withArgs(src20.address, issuerAddress, stake, supply);

    // corect stake
    expect(await src20Registry.getStake(src20.address)).to.equal(stake);
    // src20 total supply decreased
    expect(await src20.totalSupply()).to.equal(supply);
    // issuer balance decreased by supply
    expect(await src20.balanceOf(issuerAddress)).to.equal(supply);
    // issuer swm balance increased
    expect(await swm.balanceOf(issuerAddress)).to.equal(issuerSwmBefore);
  });

  it('Cannot increase/decrease supply before initial mint', async () => {
    await expect(
      src20Registry.connect(issuer).increaseSupply(src20.address, issuerAddress, 1)
    ).to.be.revertedWith('Cannot increase supply before initial stake&mint');
    await expect(
      src20Registry.connect(issuer).decreaseSupply(src20.address, issuerAddress, 1)
    ).to.be.revertedWith('Cannot increase supply before initial stake&mint');
  });

  it('Cannot mint if issuer has not enough SWM balance', async () => {
    // get rid of most of my swm first
    await swm
      .connect(issuer)
      .transfer(getRandomAddress(), (await swm.balanceOf(issuerAddress)).sub(1));
    await swm.connect(issuer).approve(src20Registry.address, stake.mul(10));
    await expect(tokenMinter.connect(issuer).mint(src20.address, maxSupply)).to.be.revertedWith(
      'revert ERC20: transfer amount exceeds balance'
    );
  });
});
