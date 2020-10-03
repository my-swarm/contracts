const {ethers} = require('@nomiclabs/buidler');
const {expect} = require('chai');
const {
  deployBaseContracts,
  deployTokenContracts,
  getAccounts,
  dumpContractAddresses,
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
    const {src20} = tokenContracts;
    expect(src20.address).to.match(REGEX_ADDR);
    expect(await src20.owner()).to.equal(issuerAccount);
    expect(await src20.maxTotalSupply()).to.equal(options.src20.supply);
    expect(await src20.name()).to.equal(options.src20.name);
  });
});
