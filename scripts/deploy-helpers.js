const moment = require('moment');
const bre = require('hardhat');
const { ethers } = require('hardhat');
const _ = require('lodash');
const { BigNumber } = ethers;

const ZERO_ADDRESS = '0x0000000000000000000000000000000000000000';

function log(x) {
  if (process.env.LOG === '1') console.log(x);
}

async function getSigners() {
  const signers = await ethers.getSigners();

  return { accounts: signers, addresses };
}

async function getIssuer() {
  const [, issuer] = await ethers.getSigners();
  return issuer;
}

async function getSwarm() {
  const [swarm] = await ethers.getSigners();
  return swarm;
}

async function getAccount(number = 0) {
  const signer = (await ethers.getSigners())[number];
  return [signer, await signer.getAddress()];
}

async function getAddresses() {
  return (await ethers.getSigners()).map((x) => x.address);
}

async function getBaseContractsOptions() {
  const [swarm, issuer, treasury, rewardsPool] = await ethers.getSigners();

  return {
    swmSupply: ethers.utils.parseUnits('10000000'), // 10 million baby,
    swarm,
    issuer,
    treasury,
    rewardsPool,
    swmPrice: [1, 2], // 0.5 USD in the format for the Oracle constructor,
    stablecoinParams: ['Mock USDC', 'USDC', 6],
    stablecoinSupply: ethers.utils.parseUnits('10000000'), // 10 million baby,
    issuerSwmBalance: ethers.utils.parseUnits('1000000'), // million baby
    fundraiserManager: {
      fee: BigNumber.from(0), // ethers.utils.parseUnits('2000', 6),
      expirationTime: 7 * 24 * 3600, // a week
    },
  };
}

function getSrc20Options(customOptions = {}) {
  return {
    name: 'Testing Security Token',
    symbol: 'TST',
    maxSupply: ethers.utils.parseUnits('1000000'), // million baby
    kyaUri: 'ipfs:QmWZzX6BgD878piQM9mCse8MfAFLmb6q1K1g3QGW9SFGuj',
    nav: 1000, // thousand baby!!!
    features: 15, // token features bitmap: all anabled, no transfer rules (1 + 2 + 4 + 8)
    // features: 31, // token features bitmap: all anabled (1 + 2 + 4 + 8 + 16)
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
    affiliateManager: false,
    contributors: {
      maxNum: 0,
      minAmount: 0,
      maxAmount: 0,
    },
  };
}

async function deployBaseContracts(customOptions = {}) {
  const options = _.merge(await getBaseContractsOptions(), customOptions);
  const { treasury, rewardsPool } = options;

  const { swm, usdc } = await deployBaseTokens(options);

  // todo: decide if to redeploy on mainnet
  const swmPriceOracle = await deployContract('SWMPriceOracle', options.swmPrice);
  log(`swmPriceOracle deployed: ${swmPriceOracle.address}`);

  const src20Registry = await deployContract('SRC20Registry', [
    treasury.address,
    rewardsPool.address,
  ]);
  log(`src20Registry deployed: ${src20Registry.address}`);

  const src20Factory = await deployContract('SRC20Factory', [src20Registry.address]);
  log(`src20Factory deployed: ${src20Factory.address}`);

  const tokenMinter = await deployContract('TokenMinter', [swm.address, swmPriceOracle.address]);
  log(`tokenMinter deployed: ${tokenMinter.address}`);

  await src20Registry.addFactory(src20Factory.address);
  log(`factory added to registry`);

  await src20Registry.addMinter(tokenMinter.address);
  log('minter added to registry');

  const fundraiserManager = await deployFundraiserManager(options.fundraiserManager);
  log(`fundraiserManager deployed: ${fundraiserManager.address}`);

  const disperse = await deployDisperse();

  const addresses = {
    swm,
    swmPriceOracle,
    src20Registry,
    src20Factory,
    tokenMinter,
    usdc,
    disperse,
    fundraiserManager,
  };
  return [addresses, options];
}

async function deployBaseTokens(options) {
  const { swarm, issuer } = options;

  let swm;
  let usdc;
  if (bre.network.name === 'mainnet') {
    swm = await ethers.getContractAt('ERC20', '0x3505f494c3f0fed0b594e01fa41dd3967645ca39');
    log(`using mainnet swm: ${swm.address}`);
    usdc = await ethers.getContractAt('ERC20', '0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48');
    log(`using mainnet usdc: ${usdc.address}`);
  } else {
    swm = await deployContract('MockSwm');
    log(`mock swm deployed: ${swm.address}`);
    await swm.mint(swarm.address, options.swmSupply);
    await swm.transfer(issuer.address, options.issuerSwmBalance);
    log('SWM minted and sent to token issuer');
    usdc = await deployContract('MockUsdc');
    log(`mock usdc deployed: ${usdc.address}`);
    await usdc.mint(swarm.address, options.stablecoinSupply);
    log('SWM minted and sent to token issuer');
  }
  return { swm, usdc };
}

async function deployDisperse() {
  let disperse;
  switch (bre.network.name) {
    case 'kovan':
      disperse = await ethers.getContractAt(
        'Disperse',
        '0xD152f549545093347A162Dce210e7293f1452150'
      );
      log(`using konva disperse: ${disperse.address}`);
      break;
    case 'mainnet':
      disperse = await ethers.getContractAt(
        'Disperse',
        '0xD152f549545093347A162Dce210e7293f1452150'
      );
      log(`using mainnet disperse: ${disperse.address}`);
      break;
    default:
      disperse = await deployContract('Disperse', []);
      log(`mock disperse deployed: ${disperse.address}`);
      break;
  }
  return disperse;
}

async function deployToken(baseContracts, customOptions = {}) {
  const options = _.merge(await getSrc20Options(), customOptions);
  log(`Deploying ${options.name} [${options.symbol}]...`);
  const issuer = await getIssuer();

  const transaction = await createSrc20(baseContracts, issuer, options);
  const src20Address = (await getEvent(transaction, 'SRC20Created')).token;
  const src20 = await ethers.getContractAt('SRC20', src20Address);
  const minter = await ethers.getContractAt('TokenMinter', await src20.getMinter());
  const transferRules = await ethers.getContractAt('TransferRules', await src20.transferRules());
  const features = await ethers.getContractAt('Features', await src20.features());

  return [{ ...baseContracts, src20, minter, transferRules, features }, options];
}

async function createSrc20(baseContracts, issuer, options) {
  const { tokenMinter, src20Factory } = baseContracts;
  const params = [
    options.name,
    options.symbol,
    options.maxSupply,
    options.kyaUri,
    options.nav,
    options.features,
    tokenMinter.address,
  ];
  return await src20Factory.connect(issuer).create(...params);
}

async function deployFundraiser(src20Address, options) {
  const issuer = await getIssuer();
  return await deployContract(
    'Fundraiser',
    [
      options.label,
      src20Address, // label
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
  const issuer = await getIssuer();
  return await deployContract(
    'ContributorRestrictions',
    [
      fundraiser.address,
      options.contributors.maxNum,
      options.contributors.minAmount,
      options.contributors.maxAmount,
    ],
    issuer
  );
}

async function deployFundraiserManager(options) {
  return await deployContract('FundraiserManager', [options.expirationTime, options.fee]);
}

async function setupFundraiser(
  fundraiser,
  contributorRestrictions,
  affiliateManager,
  contracts,
  options
) {
  const issuer = await getIssuer();
  await fundraiser.connect(issuer).setup(
    contracts.usdc.address, // baseCurrency
    options.tokenPrice,
    affiliateManager ? affiliateManager.address : ZERO_ADDRESS,
    contributorRestrictions.address,
    contracts.fundraiserManager.address,
    contracts.tokenMinter.address,
    options.contributionsLocked
  );
}

async function deployFundraiserContracts(contracts, customOptions = {}) {
  const options = _.merge(getFundraiserOptions(), customOptions);
  const fundraiser = await deployFundraiser(contracts.src20.address, options);
  const contributorRestrictions = await deployContributorRestrictions(fundraiser, options);
  const affiliateManager = options.affiliateManager
    ? await deployContract('AffiliateManager', [], await getIssuer())
    : null;

  if (!options.skipSetup) {
    await setupFundraiser(
      fundraiser,
      contributorRestrictions,
      affiliateManager,
      contracts,
      options
    );
  }

  return [{ ...contracts, fundraiser, affiliateManager, contributorRestrictions }, options];
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
  return provider.send('evm_mine', [block['timestamp'] + time]);
}

async function takeSnapshot() {
  const provider = bre.ethers.provider;
  const snapshotId = await provider.send('evm_snapshot');
  return snapshotId;
}

async function revertToSnapshot(id) {
  const provider = bre.ethers.provider;
  const result = await provider.send('evm_revert', [id]);
}

module.exports = {
  ZERO_ADDRESS,
  getSigners,
  getAccount,
  getIssuer,
  getSwarm,
  getAddresses,
  getBaseContractsOptions,
  getSrc20Options,
  getFundraiserOptions,
  deployBaseContracts,
  deployContract,
  deployToken,
  deployFundraiser,
  deployContributorRestrictions,
  setupFundraiser,
  deployFundraiserContracts,
  dumpContractAddresses,
  advanceTimeAndBlock,
  takeSnapshot,
  revertToSnapshot,
  getEvent,
  createSrc20,
};
