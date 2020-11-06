const moment = require('moment');
const bre = require('@nomiclabs/buidler');
const { ethers } = require('@nomiclabs/buidler');
const _ = require('lodash');

const ZERO_ADDRESS = '0x0000000000000000000000000000000000000000';

async function getSigners() {
  const signers = await ethers.getSigners();

  return { accounts: signers, addresses };
}

async function getIssuer() {
  const [, issuer] = await ethers.getSigners();
  return issuer;
}

async function getAddresses() {
  const signers = await ethers.getSigners();
  return await Promise.all(signers.map(async (x) => await x.getAddress()));
}

async function getBaseContractsOptions() {
  const [swarm, issuer] = await ethers.getSigners();

  const swmSupply = ethers.utils.parseUnits('10000000'); // 10 million baby
  const swmPrice = [1, 2]; // 0.5 USD in the format for the Oracle constructor
  const stablecoinParams = ['USDC', 'USDC', 6, ethers.utils.parseUnits('1000000000')]; // billion baby
  return {
    swmSupply,
    swarm,
    issuer,
    swmPrice,
    stablecoinParams,
    issuerSwmBalance: ethers.utils.parseUnits('1000000'), // Fmillion baby
  };
}

async function getTokenContractsOptions() {
  const [, issuer] = await ethers.getSigners();
  return {
    issuer,
    features: 15, // token features bitmap: all anabled (1 + 2 + 4 + 8)
    transferRules: false,
    src20: getSrc20Options(),
  };
}

function getSrc20Options(customOptions = {}) {
  return {
    name: 'Testing Security Token',
    symbol: 'TST',
    decimals: 18,
    supply: ethers.utils.parseUnits('1000000'), // million baby
    kyaHash: '0xedd7337baaf5035c0c572ef6ad7fc00b3f83dc789325ba7c4cfe2cd281637533', // sha256 hash of kya doc
    kyaUrl: 'ipfs://QmNcxu72jVNXgXqtyFGfCWJddM78Mzxmh22T3yMe6VHCV6',
    nav: 1000, // thousand baby!!!
    ...customOptions,
  };
}

function getFundraiserOptions() {
  return {
    label: 'Testing Fundraiser',
    supply: ethers.utils.parseUnits('100000'), // 10k baby
    startDate: moment().unix(),
    endDate: moment().add(1, 'month').unix(),
    softCap: ethers.utils.parseUnits('5000', 6),
    hardCap: ethers.utils.parseUnits('10000', 6),
    tokenPrice: 0, // ethers.utils.parseUnits('1'), // 1 token = 1 usd
    contributionsLocked: false,
    contributors: {
      maxNum: 0,
      minAmount: 0,
      maxAmount: 0,
    },
  };
}

async function deployBaseContracts(customOptions = {}) {
  const options = _.merge(await getBaseContractsOptions(), customOptions);
  const swarmAddress = await options.swarm.getAddress();
  const issuerAddress = await options.issuer.getAddress();

  const swm = await deployContract('SwarmTokenMock', [swarmAddress, options.swmSupply]);
  const swmPriceOracle = await deployContract('SWMPriceOracle', options.swmPrice);
  const src20Registry = await deployContract('SRC20Registry', [swm.address]);
  const src20Factory = await deployContract('SRC20Factory', [src20Registry.address]);
  await src20Registry.addFactory(src20Factory.address);
  const assetRegistry = await deployContract('AssetRegistry', [src20Factory.address]);
  const getRateMinter = await deployContract('GetRateMinter', [
    src20Registry.address,
    assetRegistry.address,
    swmPriceOracle.address,
  ]);
  await src20Registry.addMinter(getRateMinter.address);
  const setRateMinter = await deployContract('SetRateMinter', [src20Registry.address]);
  const affiliateManager = await deployContract('AffiliateManager');
  const usdc = await deployContract('ERC20Mock', options.stablecoinParams);
  await swm.transfer(issuerAddress, options.issuerSwmBalance);

  const disperse = bre.network.name === 'local' ? await deployContract('Disperse', []) : null;

  const addresses = {
    swm,
    swmPriceOracle,
    src20Registry,
    src20Factory,
    assetRegistry,
    getRateMinter,
    setRateMinter,
    affiliateManager,
    usdc,
    disperse,
  };
  return [addresses, options];
}

async function deployTokenContracts(baseContracts, customOptions = {}) {
  const options = _.merge(await getTokenContractsOptions(), customOptions);
  const { issuer } = options;
  const issuerAddress = await issuer.getAddress();
  const { src20Registry, assetRegistry, getRateMinter } = baseContracts;
  const transferRules = options.transferRules
    ? await deployContract('TransferRules', [issuerAddress], issuer)
    : undefined;
  const features = await deployContract('Features', [issuerAddress, options.features || 0], issuer);
  const roles = await deployContract(
    'SRC20Roles',
    [issuerAddress, src20Registry.address, transferRules ? transferRules.address : ZERO_ADDRESS],
    issuer
  );

  const addresses = [
    issuerAddress,
    ZERO_ADDRESS, // restrictions - not implemented
    transferRules ? transferRules.address : ZERO_ADDRESS,
    roles.address,
    features.address,
    assetRegistry.address,
    getRateMinter.address,
  ];

  const transaction = await createSrc20(options.src20, addresses);
  const src20Address = (await getEvent(transaction, 'SRC20Created')).token;
  const src20 = await ethers.getContractAt('SRC20', src20Address);

  return [{ ...baseContracts, transferRules, features, roles, src20 }, options];
}
async function createSrc20(src20Factory, options, addresses) {
  const issuer = await getIssuer();
  return src20Factory
    .connect(issuer)
    .create(
      options.name,
      options.symbol,
      options.decimals,
      options.supply,
      options.kyaHash,
      options.kyaUrl,
      options.nav,
      addresses
    );
}

async function deployFundraiser(contracts, options) {
  const [, issuer] = await ethers.getSigners();
  return await deployContract(
    'Fundraiser',
    [
      options.label,
      contracts.src20.address, // label
      options.supply, // supply
      options.startDate,
      options.endDate,
      options.softCap,
      options.hardCap,
    ],
    issuer
  );
}

async function deployContributorRestrictions(fundraiser, options) {
  const [, issuer] = await ethers.getSigners();
  const result = await deployContract(
    'ContributorRestrictions',
    [
      fundraiser.address,
      options.contributors.maxNum,
      options.contributors.minAmount,
      options.contributors.maxAmount,
    ],
    issuer
  );
  return result;
}

async function setupFundraiser(fundraiser, contributorRestrictions, contracts, options) {
  const [, issuer] = await ethers.getSigners();
  await fundraiser.connect(issuer).setup(
    contracts.usdc.address, // baseCurrency
    options.tokenPrice,
    contracts.affiliateManager.address,
    contributorRestrictions.address,
    contracts.getRateMinter.address,
    options.contributionsLocked
  );
}

async function deployFundraiserContracts(contracts, customOptions = {}) {
  const options = _.merge(getFundraiserOptions(), customOptions);
  const fundraiser = await deployFundraiser(contracts, options);
  const contributorRestrictions = await deployContributorRestrictions(fundraiser, options);
  await setupFundraiser(fundraiser, contributorRestrictions, contracts, options);

  return [{ fundraiser, contributorRestrictions }, options];
}

async function getEvent(transaction, eventName) {
  const res = await transaction.wait();
  const event = res.events.find((e) => e.event === 'SRC20Created');
  return event.args;
}

async function deployContract(contractName, constructorParams = [], signer = null) {
  if (signer === null) signer = (await ethers.getSigners())[0];
  const factory = await ethers.getContractFactory(contractName, signer);
  const contract = await factory.deploy(...constructorParams);
  await contract.deployed();
  return contract;
}

function dumpContractAddresses(contracts) {
  for (const [key, contract] of Object.entries(contracts)) {
    console.log(`${key}: ${contract ? contract.address : 'undefined'}`);
  }
}

async function advanceTimeAndBlock(time) {
  const provider = bre.ethers.provider;
  let block = await provider.getBlock('latest');
  console.log('BLOOOK', { block });
  return provider.send('evm_mine', [block['timestamp'] + time]);
}

module.exports = {
  ZERO_ADDRESS,
  getSigners,
  getIssuer,
  getAddresses,
  getBaseContractsOptions,
  getSrc20Options,
  getTokenContractsOptions,
  getFundraiserOptions,
  deployBaseContracts,
  deployContract,
  deployTokenContracts,
  deployFundraiser,
  deployContributorRestrictions,
  setupFundraiser,
  deployFundraiserContracts,
  dumpContractAddresses,
  advanceTimeAndBlock,
  createSrc20,
};
