const ethers = require('ethers');
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

module.exports = {
  REGEX_ADDR,
  getRandomAddress,
  getRandomAddresses,
};
