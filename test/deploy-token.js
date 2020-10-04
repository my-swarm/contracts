const {ethers} = require('@nomiclabs/buidler');
const {expect} = require('chai');
const {
  deployBaseContracts,
  deployTokenContracts,
  getAccounts,
  dumpContractAddresses,
  ZERO_ADDRESS,
} = require('../scripts/deploy-helpers');
const {REGEX_ADDR, getBaseContractsOptions, getTokenContractsOptions} = require('./test-helpers');

describe('Properly deploys SRC20 token', async () => {
  let baseContracts;
  let tokenContracts;
  let swarmAccount;
  let issuerAccount;
  let options;

  before(async () => {
    baseContracts = await deployBaseContracts(await getBaseContractsOptions());
    options = await getTokenContractsOptions();
    tokenContracts = await deployTokenContracts(baseContracts, options);
    const {addresses} = await getAccounts();
    swarmAccount = addresses[0];
    issuerAccount = addresses[1];
  });

  it('Has SRC20 contract properly deployed', async () => {
    const {assetRegistry} = baseContracts;
    const {src20} = tokenContracts;
    expect(src20.address).to.match(REGEX_ADDR);
    expect(await src20.owner()).to.equal(issuerAccount);
    expect(await src20.maxTotalSupply()).to.equal(options.src20.supply);
    expect(await src20.name()).to.equal(options.src20.name);
    expect(await src20.assetRegistry()).to.equal(assetRegistry.address);
  });

  it('Has all other contracts inside ', async () => {
    const {src20, roles, featured, transferRules} = tokenContracts;

    expect(await src20.roles()).to.equal(roles.address);
    expect(await src20.features()).to.equal(featured.address);
    expect(await src20.rules()).to.equal(transferRules.address);
  });

  it('Acknowledges that restrictions contract is not setup (zero address)', async () => {
    const {src20} = tokenContracts;
    expect(await src20.restrictions()).to.equal(ZERO_ADDRESS);
  });
});
