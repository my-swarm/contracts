const path = require('path');
const {readFileSync, writeFileSync} = require('fs');
const jsonFormat = require('json-format');

const jsonConfig = {
  type: 'space',
  size: 2,
};

const TOKEN_CONTRACTS = [
  'transferRules',
  'features',
  'roles',
  'src20',
  'fundraiser',
  'contributorRestrictions',
];

const BASE_CONTRACTS = {
  swm: 'SwmToken',
  swmPriceOracle: 'SWMPriceOracle',
  src20Registry: 'SRC20Registry',
  src20Factory: 'SRC20Factory',
  assetRegistry: 'AssetRegistry',
  getRateMinter: 'GetRateMinter',
  setRateMinter: 'SetRateMinter',
  affiliateManager: 'AffiliateManager',
  usdc: 'USDC',
  disperse: 'Disperse',
};

const BASE_CONTRACTS_PATH = path.resolve(
  __dirname,
  '../../issuance/@contracts/addresses/local.json'
);
const TOKEN_CONTRACTS_PATH = path.resolve(
  __dirname,
  '../../issuance/dev_data/addresses/local.json'
);

function exportBaseContractAddresses(contracts) {
  const data = {};
  for ([contractName, contract] of Object.entries(contracts)) {
    data[BASE_CONTRACTS[contractName]] = contract.address;
  }
  writeFileSync(BASE_CONTRACTS_PATH, jsonFormat(data, jsonConfig));
}

function exportTokenContractAddresses(tokenId, contracts) {
  const data = JSON.parse(readFileSync(TOKEN_CONTRACTS_PATH).toString()) || {};
  for (const contractName of TOKEN_CONTRACTS) {
    if (!data[tokenId]) {
      data[tokenId] = {};
    }
    data[tokenId][contractName] = contracts[contractName]
      ? contracts[contractName].address.toLowerCase()
      : undefined;
  }
  writeFileSync(TOKEN_CONTRACTS_PATH, jsonFormat(data, jsonConfig));
}

module.exports = {
  exportTokenContractAddresses,
  exportBaseContractAddresses,
};
