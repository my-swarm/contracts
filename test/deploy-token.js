const {ethers} = require('@nomiclabs/buidler');
const {expect} = require('chai');
const {
  deployBaseContracts,
  deployTokenContracts,
  deployFundraiserContracts,
  getAccounts,
  getFundraiserOptions,
  getBaseContractsOptions,
  getTokenContractsOptions
  ZERO_ADDRESS,
} = require('../scripts/deploy-helpers');
const {REGEX_ADDR} = require('./test-helpers');

describe('Properly deploys SRC20 token with all sidekick contracts', async () => {
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

  it('Deploys fundraiser contracts', async () => {
    const options = getFundraiserOptions();
    const {fundraiser, contributorRestrictions} = await deployFundraiserContracts(
      baseContracts,
      tokenContracts.src20,
      options
    );

    expect(fundraiser.address).to.match(REGEX_ADDR);
    expect(await fundraiser.label()).to.equal(options.label);
    expect(await fundraiser.token()).to.equal(tokenContracts.src20.address);
    expect(await fundraiser.tokensToMint()).to.equal(options.tokensToMint);
    expect(await fundraiser.startDate()).to.equal(options.startDate);
    expect(await fundraiser.endDate()).to.equal(options.endDate);
    expect(await fundraiser.softCap()).to.equal(options.softCap);
    expect(await fundraiser.hardCap()).to.equal(options.hardCap);

    expect(await fundraiser.baseCurrency()).to.equal(baseContracts.usdc.address);
    expect(await fundraiser.tokenPrice()).to.equal(options.tokenPrice);
    expect(await fundraiser.affiliateManager()).to.equal(baseContracts.affiliateManager.address);
    expect(await fundraiser.contributorRestrictions()).to.equal(contributorRestrictions.address);
    expect(await fundraiser.minter()).to.equal(baseContracts.getRateMinter.address);
    expect(await fundraiser.contributionsLocked()).to.equal(options.contributionsLocked);

    expect(await fundraiser.numContributors()).to.equal(0);
    expect(await fundraiser.amountQualified()).to.equal(0);
    expect(await fundraiser.amountUnqualified()).to.equal(0);
    expect(await fundraiser.amountWithdrawn()).to.equal(0);
    expect(await fundraiser.isFinished()).to.equal(false);
    expect(await fundraiser.isCancelled()).to.equal(false);
    expect(await fundraiser.isSetup()).to.equal(true);
    expect(await fundraiser.isHardcapReached()).to.equal(false);
  });
});
