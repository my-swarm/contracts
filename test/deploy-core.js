const {ethers} = require('@nomiclabs/buidler');
const {expect} = require('chai');
const {
  deployBaseContracts,
  getAccounts,
  getBaseContractsOptions,
} = require('../scripts/deploy-helpers');
const {REGEX_ADDR} = require('./test-helpers');

describe('Properly deploys base contracts', async () => {
  let baseContracts;
  let swarmAccount;
  let issuerAccount;
  let options;

  before(async () => {
    options = await getBaseContractsOptions();
    baseContracts = await deployBaseContracts(options);
    const {addresses} = await getAccounts();
    swarmAccount = addresses[0];
    issuerAccount = addresses[1];
  });

  it('Has SWM contract properly setup', async () => {
    const {swm} = baseContracts;
    expect(await swm.address).to.match(REGEX_ADDR);
    expect(await swm.owner()).to.equal(swarmAccount);
    expect(await swm.totalSupply()).to.equal(options.swmSupply);
    expect(await swm.balanceOf(swarmAccount)).to.equal(
      options.swmSupply.sub(options.issuerSwmBalance)
    );
    expect(await swm.balanceOf(issuerAccount)).to.equal(options.issuerSwmBalance);
  });

  it('Has SWMPriceOracle contract properly setup', async () => {
    const {swmPriceOracle} = baseContracts;
    expect(await swmPriceOracle.address).to.match(REGEX_ADDR);
    expect(await swmPriceOracle.owner()).to.equal(swarmAccount);
    const price = await swmPriceOracle.getPrice();
    expect(price.priceNumerator.toNumber()).to.equal(options.swmPrice[0]);
    expect(price.priceDenominator.toNumber()).to.equal(options.swmPrice[1]);
  });

  it('Has SRC20Registry contract properly setup', async () => {
    const {src20Registry} = baseContracts;
    expect(await src20Registry.address).to.match(REGEX_ADDR);
    expect(await src20Registry.owner()).to.equal(swarmAccount);
  });

  it('Has SRC20Factory contract properly setup', async () => {
    const {src20Factory} = baseContracts;
    expect(await src20Factory.address).to.match(REGEX_ADDR);
    // doesn't store owner
  });

  it('Has AssetRegistry contract properly setup', async () => {
    const {assetRegistry} = baseContracts;
    expect(await assetRegistry.address).to.match(REGEX_ADDR);
    // doesn't store owner
  });

  it('Has GetRateMinter contract properly setup', async () => {
    const {getRateMinter} = baseContracts;
    expect(await getRateMinter.address).to.match(REGEX_ADDR);
    // doesn't store owner
  });

  it('Has SetRateMinter contract properly setup', async () => {
    const {setRateMinter} = baseContracts;
    expect(await setRateMinter.address).to.match(REGEX_ADDR);
    expect(await setRateMinter.owner()).to.equal(swarmAccount);
  });

  it('Has AffiliateManager contract properly setup', async () => {
    const {affiliateManager} = baseContracts;
    expect(await affiliateManager.address).to.match(REGEX_ADDR);
    expect(await affiliateManager.owner()).to.equal(swarmAccount);
  });

  it('Has USDC contract properly setup', async () => {
    const {usdc} = baseContracts;
    expect(await usdc.address).to.match(REGEX_ADDR);
    expect(await usdc.name()).to.equal(options.stablecoinParams[0]);
    expect(await usdc.symbol()).to.equal(options.stablecoinParams[1]);
    expect(await usdc.decimals()).to.equal(options.stablecoinParams[2]);
    expect(await usdc.totalSupply()).to.equal(options.stablecoinParams[3]);
  });
});
