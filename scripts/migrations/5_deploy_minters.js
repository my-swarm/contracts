const SRC20Registry = artifacts.require('SRC20Registry');
const AssetRegistry = artifacts.require('AssetRegistry');
const SWMPriceOracle = artifacts.require('SWMPriceOracle');
const TokenMinter = artifacts.require('TokenMinter');
const MasterMinter = artifacts.require('MasterMinter');

module.exports = function (deployer) {
  return SRC20Registry.deployed().then(async (SRC20Registry) => {
    return AssetRegistry.deployed().then(async (assetRegistry) => {
      return SWMPriceOracle.deployed().then(async (swmPriceOracle) => {
        return deployer
          .deploy(TokenMinter, SRC20Registry.address, assetRegistry.address, swmPriceOracle.address)
          .then(async (TokenMinter) => {
            await SRC20Registry.addMinter(TokenMinter.address);

            return deployer
              .deploy(MasterMinter, SRC20Registry.address)
              .then(async (MasterMinter) => {
                await SRC20Registry.addMinter(MasterMinter.address);
              });
          });
      });
    });
  });
};
