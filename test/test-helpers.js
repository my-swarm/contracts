const moment = require('moment');
const {getAccounts} = require('../scripts/deploy-helpers');
const REGEX_ADDR = /0x[a-z0-9]{40}/i;

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

module.exports = {
  REGEX_ADDR,
  getBaseContractsOptions,
  getTokenContractsOptions,
  getFundraiserOptions,
};
