const ethers = require('ethers');
const { deployContract } = require('../scripts/deploy-helpers');
const REGEX_ADDR = /0x[a-z0-9]{40}/i;

function getRandomAddress() {
  const chars = '012345679abcdef';
  let result = '0x';
  for (let i = 0; i < 40; i++) {
    result += chars[Math.floor(Math.random() * chars.length)];
  }
  return ethers.utils.getAddress(result);
}

function getRandomAddresses(count) {
  let result = [];
  for (let i = 0; i < count; i++) result.push(getRandomAddress());
  return result;
}

async function deploySrc20Mock() {
  deployContract('SRC20Mock', [
    'Mock SRC20 COntract',
    'SRM',
    18,
    parseUnits(1000, 18),
    getRandomAddresses(5),
  ]);
}

module.exports = {
  REGEX_ADDR,
  getRandomAddress,
  getRandomAddresses,
};
