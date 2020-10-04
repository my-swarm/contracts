const {ethers} = require('@nomiclabs/buidler');

const ZERO_ADDRESS = '0x0000000000000000000000000000000000000000';

async function getAccounts() {
  const accounts = await ethers.getSigners();
  const addresses = await Promise.all(accounts.map(async (x) => await x.getAddress()));

  return {accounts, addresses};
}

async function getAddresses() {
  return (await getAccounts()).addresses;
}

async function getBaseContractsOptions() {
  const [swarmAccount, issuerAccount] = await getAddresses();

  const swmSupply = ethers.utils.parseUnits('10000000'); // 10 million baby
  const swmPrice = [1, 2]; // 0.5 USD in the format for the Oracle constructor
  const stablecoinParams = ['USDC', 'USDC', 6, ethers.utils.parseUnits('1000000000')]; // billion baby
  return {
    swmSupply,
    swarmAccount,
    issuerAccount,
    swmPrice,
    stablecoinParams,
    issuerSwmBalance: ethers.utils.parseUnits('1000000'), // Fmillion baby
  };
}

async function getTokenContractsOptions() {
  const [, issuerAccount] = await getAddresses();
  return {
    issuerAccount,
    features: 0, // token features bitmap
    src20: {
      name: 'Testing Security Token',
      symbol: 'TST',
      decimals: 18,
      supply: ethers.utils.parseUnits('1000000'), // million baby
      kyaHash: '0xedd7337baaf5035c0c572ef6ad7fc00b3f83dc789325ba7c4cfe2cd281637533', // sha256 hash of kya doc
      kyaUrl: 'ipfs://QmNcxu72jVNXgXqtyFGfCWJddM78Mzxmh22T3yMe6VHCV6',
      nav: 1000, // thousand baby!!!
    },
  };
}

function getFundraiserOptions() {
  return {
    label: 'Testing Fundraiser',
    tokensToMint: ethers.utils.parseUnits('100000'), // 10k baby
    startDate: moment().unix(),
    endDate: moment().add(1, 'month').unix(),
    softCap: ethers.utils.parseUnits('5000'),
    hardCap: ethers.utils.parseUnits('10000'),
    tokenPrice: ethers.utils.parseUnits('1'), // 1 token = 1 usd
    contributionsLocked: false,
    contributors: {
      maxNum: 0,
      minAmount: 0,
      maxAmount: 0,
    },
  };
}

async function deployBaseContracts(options) {
  const swm = await deployContract('SwarmTokenMock', [options.swarmAccount, options.swmSupply]);
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
  await swm.transfer(options.issuerAccount, options.issuerSwmBalance);

  return {
    swm,
    swmPriceOracle,
    src20Registry,
    src20Factory,
    assetRegistry,
    getRateMinter,
    setRateMinter,
    affiliateManager,
    usdc,
  };
}

async function deployTokenContracts(baseContracts, options) {
  const {src20Registry, src20Factory, assetRegistry, getRateMinter} = baseContracts;
  const transferRules = await deployContract('TransferRules', [options.issuerAccount]);
  const featured = await deployContract('Featured', [options.issuerAccount, options.features || 0]);
  const roles = await deployContract('SRC20Roles', [
    options.issuerAccount,
    src20Registry.address,
    ZERO_ADDRESS,
  ]);

  const transaction = await src20Factory.create(
    options.src20.name,
    options.src20.symbol,
    options.src20.decimals,
    options.src20.supply,
    options.src20.kyaHash,
    options.src20.kyaUrl,
    options.src20.nav,
    [
      options.issuerAccount,
      ZERO_ADDRESS, // restrictions - not implemented
      transferRules.address,
      roles.address,
      featured.address,
      assetRegistry.address,
      getRateMinter.address,
    ]
  );
  const src20Address = (await getEvent(transaction, 'SRC20Created')).token;
  const src20 = await ethers.getContractAt('SRC20', src20Address);

  return {transferRules, featured, roles, src20};
}

async function deployFundraiserContracts(baseContracts, src20, options) {
  const fundraiser = await deployContract('Fundraiser', [
    options.label,
    src20.address, // label
    options.tokensToMint, // tokensToMint
    options.startDate,
    options.endDate,
    options.softCap,
    options.hardCap,
  ]);
  const contributorRestrictions = await deployContract('ContributorRestrictions', [
    fundraiser.address,
    options.contributors.maxNum,
    options.contributors.minAmount,
    options.contributors.maxAmount,
  ]);

  await fundraiser.setup(
    baseContracts.usdc.address, // baseCurrency
    options.tokenPrice,
    baseContracts.affiliateManager.address,
    contributorRestrictions.address,
    baseContracts.getRateMinter.address,
    options.contributionsLocked
  );

  return {fundraiser, contributorRestrictions};
}

async function getEvent(transaction, eventName) {
  const res = await transaction.wait();
  const event = res.events.find((e) => e.event === 'SRC20Created');
  return event.args;
}

async function deployContract(contractName, constructorParams = []) {
  const factory = await ethers.getContractFactory(contractName);
  const contract = await factory.deploy(...constructorParams);
  await contract.deployed();
  return contract;
}

function dumpContractAddresses(contracts) {
  for (const [key, contract] of Object.entries(contracts)) {
    console.log(`${key}: ${contract.address}`);
  }
}

module.exports = {
  ZERO_ADDRESS,
  getAccounts,
  getBaseContractsOptions,
  getTokenContractsOptions,
  getFundraiserOptions,
  deployBaseContracts,
  deployTokenContracts,
  deployFundraiserContracts,
  deployContract,
  dumpContractAddresses,
};
