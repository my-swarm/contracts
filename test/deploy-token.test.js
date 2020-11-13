const { expect } = require('chai');
const {
  deployBaseContracts,
  deployTokenContracts,
  deployFundraiserContracts,
  getAddresses,
  ZERO_ADDRESS,
} = require('../scripts/deploy-helpers');
const { REGEX_ADDR } = require('./test-helpers');

describe('Properly deploys SRC20 token with all sidekick contracts', async () => {
  let baseContracts;
  let tokenContracts;
  let swarmAddress;
  let issuerAddress;
  let tokenOptions;

  before(async () => {
    [baseContracts] = await deployBaseContracts();
    [tokenContracts, tokenOptions] = await deployTokenContracts(baseContracts, {
      transferRules: true,
    });
    const addresses = await getAddresses();
    swarmAddress = addresses[0];
    issuerAddress = addresses[1];
  });

  it('Has SRC20 contract properly deployed', async () => {
    const { assetRegistry } = baseContracts;
    const { src20 } = tokenContracts;
    expect(src20.address).to.match(REGEX_ADDR);
    expect(await src20.owner()).to.equal(issuerAddress);
    expect(await src20.maxTotalSupply()).to.equal(tokenOptions.src20.maxSupply);
    expect(await src20.name()).to.equal(tokenOptions.src20.name);
    expect(await src20.assetRegistry()).to.equal(assetRegistry.address);
  });

  it('Has all other contracts inside ', async () => {
    const { src20, roles, features, transferRules } = tokenContracts;

    expect(await src20.roles()).to.equal(roles.address);
    expect(await src20.features()).to.equal(features.address);
    expect(await src20.transferRules()).to.equal(transferRules.address);
  });

  it('Deploys fundraiser contracts', async () => {
    const [{ fundraiser, contributorRestrictions }, options] = await deployFundraiserContracts({
      ...baseContracts,
      ...tokenContracts,
    });

    expect(fundraiser.address).to.match(REGEX_ADDR);
    expect(await fundraiser.label()).to.equal(options.label);
    expect(await fundraiser.token()).to.equal(tokenContracts.src20.address);
    expect(await fundraiser.supply()).to.equal(options.supply);
    expect(await fundraiser.startDate()).to.equal(options.startDate);
    expect(await fundraiser.endDate()).to.equal(options.endDate);
    expect(await fundraiser.softCap()).to.equal(options.softCap);
    expect(await fundraiser.hardCap()).to.equal(options.hardCap);

    expect(await fundraiser.baseCurrency()).to.equal(baseContracts.usdc.address);
    expect(await fundraiser.tokenPrice()).to.equal(options.tokenPrice);
    expect(await fundraiser.affiliateManager()).to.equal(baseContracts.affiliateManager.address);
    expect(await fundraiser.contributorRestrictions()).to.equal(contributorRestrictions.address);
    expect(await fundraiser.fundraiserManager()).to.equal(baseContracts.fundraiserManager.address);
    expect(await fundraiser.minter()).to.equal(baseContracts.tokenMinter.address);
    expect(await fundraiser.contributionsLocked()).to.equal(options.contributionsLocked);

    expect(await fundraiser.numContributors()).to.equal(0);
    expect(await fundraiser.amountQualified()).to.equal(0);
    expect(await fundraiser.amountPending()).to.equal(0);
    expect(await fundraiser.amountWithdrawn()).to.equal(0);
    expect(await fundraiser.isFinished()).to.equal(false);
    expect(await fundraiser.isCanceled()).to.equal(false);
    expect(await fundraiser.isSetup()).to.equal(true);
    expect(await fundraiser.isHardcapReached()).to.equal(false);
  });
});
