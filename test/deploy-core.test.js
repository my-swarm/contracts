const { ethers } = require('@nomiclabs/buidler');
const { expect } = require('chai');
const { deployBaseContracts, getAddresses } = require('../scripts/deploy-helpers');
const { REGEX_ADDR } = require('./test-helpers');

describe('Properly deploys base contracts', async () => {
  let baseContracts;
  let swarmAddress;
  let issuerAddress;
  let options;

  before(async () => {
    [baseContracts, options] = await deployBaseContracts();
    const addresses = await getAddresses();
    swarmAddress = addresses[0];
    issuerAddress = addresses[1];
  });

  it('Has SWM contract properly setup', async () => {
    const { swm } = baseContracts;
    expect(await swm.address).to.match(REGEX_ADDR);
    expect(await swm.owner()).to.equal(swarmAddress);
    expect(await swm.totalSupply()).to.equal(options.swmSupply);
    expect(await swm.balanceOf(swarmAddress)).to.equal(
      options.swmSupply.sub(options.issuerSwmBalance)
    );
    expect(await swm.balanceOf(issuerAddress)).to.equal(options.issuerSwmBalance);
  });

  it('Has SWMPriceOracle contract properly setup', async () => {
    const { swmPriceOracle } = baseContracts;
    expect(await swmPriceOracle.address).to.match(REGEX_ADDR);
    expect(await swmPriceOracle.owner()).to.equal(swarmAddress);
    const price = await swmPriceOracle.getPrice();
    expect(price.numerator.toNumber()).to.equal(options.swmPrice[0]);
    expect(price.denominator.toNumber()).to.equal(options.swmPrice[1]);
  });

  it('Has SRC20Registry contract properly setup', async () => {
    const { src20Registry } = baseContracts;
    expect(await src20Registry.address).to.match(REGEX_ADDR);
    expect(await src20Registry.owner()).to.equal(swarmAddress);
  });

  it('Has SRC20Factory contract properly setup', async () => {
    const { src20Factory } = baseContracts;
    expect(await src20Factory.address).to.match(REGEX_ADDR);
    // doesn't store owner
  });

  it('Has AssetRegistry contract properly setup', async () => {
    const { assetRegistry } = baseContracts;
    expect(await assetRegistry.address).to.match(REGEX_ADDR);
    // doesn't store owner
  });

  it('Has TokenMinter contract properly setup', async () => {
    const { tokenMinter } = baseContracts;
    expect(await tokenMinter.address).to.match(REGEX_ADDR);
    // doesn't store owner
  });

  it('Has MasterMinter contract properly setup', async () => {
    const { masterMinter } = baseContracts;
    expect(await masterMinter.address).to.match(REGEX_ADDR);
    expect(await masterMinter.owner()).to.equal(swarmAddress);
  });

  it('Has AffiliateManager contract properly setup', async () => {
    const { affiliateManager } = baseContracts;
    expect(await affiliateManager.address).to.match(REGEX_ADDR);
    expect(await affiliateManager.owner()).to.equal(swarmAddress);
  });

  it('Has USDC contract properly setup', async () => {
    const { usdc } = baseContracts;
    expect(await usdc.address).to.match(REGEX_ADDR);
    expect(await usdc.name()).to.equal(options.stablecoinParams[0]);
    expect(await usdc.symbol()).to.equal(options.stablecoinParams[1]);
    expect(await usdc.decimals()).to.equal(options.stablecoinParams[2]);
    expect(await usdc.totalSupply()).to.equal(options.stablecoinParams[3]);
  });
});
