const moment = require('moment');
const bre = require('hardhat');
const { ethers } = require('hardhat');
const _ = require('lodash');
const { BigNumber } = ethers;

const ZERO_ADDRESS = '0x0000000000000000000000000000000000000000';

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
    fundraiserManager: {
      fee: BigNumber.from(0), // ethers.utils.parseUnits('2000', 6),
      expirationTime: 7 * 24 * 3600, // a week
    },
  };
}

async function getTokenContractsOptions() {
  const issuer = await getIssuer();
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
    maxSupply: ethers.utils.parseUnits('1000000'), // million baby
    kyaHash: '0x80369b2e08a8d439afd5d7ef90dec05bd456bcf24b369c20e91ac3cbeea37cb2', // keccak256 hash of kya doc
    kyaUrl: 'ipfs:QmWZzX6BgD878piQM9mCse8MfAFLmb6q1K1g3QGW9SFGuj',
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
    affiliateManager: false,
    contributors: {
      maxNum: 0,
      minAmount: 0,
      maxAmount: 0,
    },
  };
}

async function deployBaseContracts(customOptions = {}, log = false) {
  const options = _.merge(await getBaseContractsOptions(), customOptions);
  const swarmAddress = await options.swarm.getAddress();
  const issuerAddress = await options.issuer.getAddress();

  let swm;
  if (bre.network.name === 'mainnet') {
    usdc = await ethers.getContractAt(
      'SwarmTokenMock',
      '0x3505f494c3f0fed0b594e01fa41dd3967645ca39'
    );
    if (log) console.log(`using mainnet usdc: ${usdc.address}`);
  } else {
    swm = await deployContract('SwarmTokenMock', [swarmAddress, options.swmSupply]);
    if (log) console.log(`mock swm deployed: ${swm.address}`);
  }
  const swmPriceOracle = await deployContract('SWMPriceOracle', options.swmPrice);
  if (log) console.log(`swmPriceOracle deployed: ${swmPriceOracle.address}`);
  const src20Registry = await deployContract('SRC20Registry', [swm.address]);
  if (log) console.log(`src20Registry deployed: ${src20Registry.address}`);
  const src20Factory = await deployContract('SRC20Factory', [src20Registry.address]);
  if (log) console.log(`src20Factory deployed: ${src20Factory.address}`);
  await src20Registry.addFactory(src20Factory.address);
  if (log) console.log(`factory added to registry`);
  const assetRegistry = await deployContract('AssetRegistry', [src20Factory.address]);
  if (log) console.log(`assetRegistry deployed: ${assetRegistry.address}`);
  const tokenMinter = await deployContract('TokenMinter', [
    src20Registry.address,
    assetRegistry.address,
    swmPriceOracle.address,
  ]);
  if (log) console.log(`tokenMinter deployed: ${tokenMinter.address}`);
  await src20Registry.addMinter(tokenMinter.address);
  if (log) console.log('minter added to registry');
  let usdc;
  if (bre.network.name === 'mainnet') {
    usdc = await ethers.getContractAt('ERC20Mock', '0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48');
    if (log) console.log(`using mainnet usdc: ${usdc.address}`);
  } else {
    usdc = await deployContract('ERC20Mock', options.stablecoinParams);
    if (log) console.log(`mock usdc deployed: ${usdc.address}`);
  }
  await swm.transfer(issuerAddress, options.issuerSwmBalance);
  if (log) console.log('some SWM sent to token issuer');
  const fundraiserManager = await deployFundraiserManager(options.fundraiserManager);
  if (log) console.log(`fundraiserManager deployed: ${fundraiserManager.address}`);

  let disperse;
  switch (bre.network.name) {
    case 'local':
      disperse = await deployContract('Disperse', []);
      if (log) console.log(`mock disperse deployed: ${disperse.address}`);
      break;
    case 'kovan':
      disperse = await ethers.getContractAt(
        'Disperse',
        '0xD152f549545093347A162Dce210e7293f1452150'
      );
      if (log) console.log(`using konvat disperse: ${disperse.address}`);
      break;
    case 'mainnet':
      disperse = await ethers.getContractAt(
        'Disperse',
        '0xD152f549545093347A162Dce210e7293f1452150'
      );
      if (log) console.log(`using mainnet disperse: ${disperse.address}`);
      break;
  }

  const addresses = {
    swm,
    swmPriceOracle,
    src20Registry,
    src20Factory,
    assetRegistry,
    tokenMinter,
    usdc,
    disperse,
    fundraiserManager,
  };
  return [addresses, options];
}

async function deployTokenContracts(baseContracts, customOptions = {}, skipSrc20 = false) {
  const options = _.merge(await getTokenContractsOptions(), customOptions);
  const { issuer } = options;
  const issuerAddress = await issuer.getAddress();
  const { src20Factory, src20Registry, assetRegistry, tokenMinter } = baseContracts;
  const transferRules = options.transferRules
    ? await deployContract('TransferRules', [issuerAddress], issuer)
    : undefined;
  const features = await deployContract('Features', [issuerAddress, options.features || 0], issuer);
  const roles = await deployContract(
    'SRC20Roles',
    [src20Registry.address, transferRules ? transferRules.address : ZERO_ADDRESS],
    issuer
  );

  const addresses = [
    transferRules ? transferRules.address : ZERO_ADDRESS,
    roles.address,
    features.address,
    assetRegistry.address,
    tokenMinter.address,
  ];

  let src20;
  if (!skipSrc20) {
    const transaction = await createSrc20(src20Factory, options.src20, addresses);
    const src20Address = (await getEvent(transaction, 'SRC20Created')).token;
    src20 = await ethers.getContractAt('SRC20', src20Address);
  }

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
      options.maxSupply,
      options.kyaHash,
      options.kyaUrl,
      options.nav,
      addresses
    );
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
  takeSnapshot,
  revertToSnapshot,
  createSrc20,
  getEvent,
};
