const { ethers, config } = require('@nomiclabs/buidler');
const { readArtifact } = require('@nomiclabs/buidler/plugins');
require('dotenv').config({ path: '.env' });
const moment = require('moment');
const { linkBytecode } = require('./utils');

const {
  SWM_PRICE_USD_NUMERATOR,
  SWM_PRICE_USD_DENOMINATOR,
  SRC20_FEATURES,
  TOKEN_OWNER,
  DEVELOPMENT_SWM_TOKEN_OWNER,
  TOKEN_NAME,
  SYMBOL,
  DECIMALS,
  MAX_TOTAL_SUPPLY,
  KYA_HASH,
  KYA_URL,
  NET_ASSET_VALUE,
} = process.env;

const ercTotalSupply = ethers.utils.parseUnits('100000000');
const label = 'TestFundraise';
const src20tokenSupply = ethers.utils.parseUnits('1000000');
const investmentAmount = ethers.utils.parseUnits('500');
const startDate = moment().unix() + 60; // one minute from the current time
const endDate = moment().unix() + 60 * 60 * 72; // three days from current time;
const softCap = ethers.BigNumber.from('100000000000');
const hardCap = ethers.BigNumber.from('1000000000000');
const maxNumberOfContributors = 0;
const minAmount = ethers.BigNumber.from('50000000');
const maxAmount = ethers.BigNumber.from('1000000000');

module.exports = {
  deployContracts,
};

async function deployContracts(root) {
  const accounts = await ethers.getSigners();
  const deployer = accounts[0];
  const deployerAddress = await deployer.getAddress();

  const Erc20Token = await ethers.getContractFactory('ERC20Mock');
  root.swm = await Erc20Token.deploy('Swarm', 'SWM', 18, ercTotalSupply);
  await root.swm.deployed();

  root.usdc = await Erc20Token.deploy('USD Coin', 'USDC', 6, ercTotalSupply);
  await root.usdc.deployed();

  const SRC20Registry = await ethers.getContractFactory('SRC20Registry');
  root.src20Registry = await SRC20Registry.deploy(root.swm.address);
  await root.src20Registry.deployed();

  const SRC20Factory = await ethers.getContractFactory('SRC20Factory');
  root.src20Factory = await SRC20Factory.deploy(root.src20Registry.address);
  await root.src20Factory.deployed();
  await root.src20Registry.addFactory(root.src20Factory.address);

  const AssetRegistry = await ethers.getContractFactory('AssetRegistry');
  root.assetRegistry = await AssetRegistry.deploy(root.src20Factory.address);
  await root.assetRegistry.deployed();

  const SWMPriceOracle = await ethers.getContractFactory('SWMPriceOracle');
  root.swmPriceOracle = await SWMPriceOracle.deploy(
    SWM_PRICE_USD_NUMERATOR,
    SWM_PRICE_USD_DENOMINATOR
  );

  await root.swmPriceOracle.deployed();
  const TokenMinter = await ethers.getContractFactory('TokenMinter');
  root.TokenMinter = await TokenMinter.deploy(
    root.src20Registry.address,
    root.assetRegistry.address,
    root.swmPriceOracle.address
  );
  await root.src20Registry.addMinter(root.TokenMinter.address);

  const MasterMinter = await ethers.getContractFactory('MasterMinter');
  root.MasterMinter = await MasterMinter.deploy(root.src20Registry.address);
  await root.src20Registry.addMinter(root.MasterMinter.address);

  const TransferRules = await ethers.getContractFactory('TransferRules');
  root.transferRules = await TransferRules.deploy(deployerAddress);
  await root.transferRules.deployed();

  const SRC20Roles = await ethers.getContractFactory('SRC20Roles');
  root.src20Roles = await SRC20Roles.deploy(
    deployerAddress,
    root.src20Registry.address,
    root.transferRules.address
  );
  await root.src20Roles.deployed();

  const Featured = await ethers.getContractFactory('Featured');
  root.featured = await Featured.deploy(deployerAddress, SRC20_FEATURES);
  await root.featured.deployed();

  const tx = await root.src20Factory.create(
    TOKEN_NAME,
    SYMBOL,
    DECIMALS,
    MAX_TOTAL_SUPPLY,
    KYA_HASH,
    KYA_URL,
    NET_ASSET_VALUE,
    [
      deployerAddress,
      root.transferRules.address,
      root.transferRules.address,
      root.src20Roles.address,
      root.featured.address,
      root.assetRegistry.address,
      root.TokenMinter.address,
    ]
  );

  const receipt = await tx.wait(1);
  root.src20Address = ethers.utils.defaultAbiCoder.decode(['address'], receipt.logs[5].data)[0];
  root.src20 = await ethers.getContractAt('SRC20', root.src20Address);

  const AffiliateManager = await ethers.getContractFactory('AffiliateManager');
  root.affiliateManager = await AffiliateManager.deploy();
  await root.affiliateManager.deployed();

  const USDC = await ethers.getContractFactory('ERC20Mock');
  root.usdc = await USDC.deploy('USDC', 'USDC', 6, ethers.BigNumber.from('1000000000000'));
  await root.usdc.deployed();

  const SwarmPoweredFundraise = await ethers.getContractFactory('SwarmPoweredFundraise');
  root.swarmPoweredFundraise = await SwarmPoweredFundraise.deploy(
    'SPF',
    root.src20Address,
    src20tokenSupply,
    startDate,
    endDate,
    softCap,
    hardCap
  );
  await root.swarmPoweredFundraise.deployed();

  const ContributorRestrictions = await ethers.getContractFactory('ContributorRestrictions');
  root.contributorRestrictions = await ContributorRestrictions.deploy(
    root.swarmPoweredFundraise.address,
    maxNumberOfContributors,
    minAmount,
    maxAmount
  );
  await root.contributorRestrictions.deployed();
}
