const path = require('path');
const {readFileSync, writeFileSync} = require('fs');
const jsonFormat = require('json-format');

const jsonConfig = {
  type: 'space',
  size: 2,
};

const EXPORTABLE_CONTRACTS = [
  'transferRules',
  'features',
  'roles',
  'src20',
  'fundraiser',
  'contributorRestrictions',
];

const EXPORT_PATH = path.resolve(__dirname, '../../issuance/dev_data/addresses.json');

function exportContractAddresses(tokenId, contracts) {
  const data = JSON.parse(readFileSync(EXPORT_PATH).toString()) || {};
  for (const contractName of EXPORTABLE_CONTRACTS) {
    if (!data[tokenId]) {
      data[tokenId] = {};
    }
    data[tokenId][contractName] = contracts[contractName]
      ? contracts[contractName].address
      : undefined;
  }
  writeFileSync(EXPORT_PATH, jsonFormat(data, jsonConfig));
}

module.exports = {
  exportContractAddresses,
};
