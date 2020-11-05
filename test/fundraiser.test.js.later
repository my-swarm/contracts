const {expect} = require('chai');
const {
  deployBaseContracts,
  deployTokenContracts,
  deployFundraiserContracts,
  deployFundraiser,
  deployContributorRestrictions,
  setupFundraiser,
  getFundraiserOptions,
  getAddresses,
  ZERO_ADDRESS,
} = require('../scripts/deploy-helpers');
const {getContributors, distributeToken, contribute} = require('../scripts/token-helpers');

describe('Fundraiser tests', async () => {
  let contracts;
  let swarm;
  let issuer;

  before(async () => {
    const [baseContracts] = await deployBaseContracts();
    [contracts] = await deployTokenContracts(baseContracts);
    [swarm, issuer] = await ethers.getSigners();
  });
  /*
  it('Does not deploy if constructor or setup params do not play nice', async () => {
    await expect(
      deployFundraiserContracts(contracts, {hardCap: 100, softCap: 101})
    ).to.be.revertedWith('Hardcap has to be >= Softcap');
    await expect(
      deployFundraiserContracts(contracts, {tokenPrice: 0, supply: 0})
    ).to.be.revertedWith('Either price or amount to mint is needed');
  });

  it('Reverts if trying to setup twice', async () => {
    const {usdc, affiliateManager, getRateMinter} = contracts;
    const [{fundraiser, contributorRestrictions}, options] = await deployFundraiserContracts(
      contracts
    );
    await expect(
      fundraiser.setup(
        usdc.address,
        options.tokenPrice,
        affiliateManager.address,
        contributorRestrictions.address,
        getRateMinter.address,
        options.contributionsLocked
      )
    ).to.be.revertedWith('Contract is already set up');
  });

  it('Reverts if trying to setup a canceled fundraiser', async () => {
    const options = getFundraiserOptions();
    const fundraiser = await deployFundraiser(contracts, options);
    const contributorRestrictions = await deployContributorRestrictions(fundraiser, options);
    await fundraiser.cancel();
    await expect(
      setupFundraiser(fundraiser, contributorRestrictions, contracts, options)
    ).to.be.revertedWith('Fundraiser is canceled');
  });

  it('Does not process invalid contributions', async () => {
    const [{fundraiser}] = await deployFundraiserContracts(contracts);
    const [contributor] = await getContributors(1);
    await expect(fundraiser.connect(contributor).contribute(100, '')).to.be.revertedWith(
      'VM Exception while processing transaction: revert ERC20: transfer amount exceeds balance'
    );
    await expect(fundraiser.connect(contributor).contribute(0, '')).to.be.revertedWith(
      'Amount has to be greater than 0'
    );
  });
*/
  it('Does process contributions', async () => {
    const {usdc} = contracts;
    const [{fundraiser}] = await deployFundraiserContracts(contracts);
    const [c1, c2, affil] = await getContributors(3);
    await distributeToken(usdc, [c1, c2], 1000);
    const a1 = await c1.getAddress();
    const a2 = await c2.getAddress();
    const affilAddress = await affil.getAddress();
    await contribute(usdc, fundraiser, c1, 100);
    await contribute(usdc, fundraiser, c1, 200, affilAddress);
    await contribute(usdc, fundraiser, c2, 400);
    expect(await fundraiser.pendingContributions(a1)).to.equal(300);
    expect(await fundraiser.contributors(a1)).to.equal(true);
    expect(await fundraiser.referrals(a1)).to.equal(affilAddress);
    expect(await fundraiser.amountPending()).to.equal(700);
    expect(await fundraiser.amountQualified()).to.equal(0);
    expect(await fundraiser.amountWithdrawn()).to.equal(0);
    await fundraiser.as(issuer).acceptContributor(await a1);
  });
  /*
  it('Can process contributions', async () => {
    const [{fundraiser}] = deployFundraiserContracts(contracts);
    const [contributor] = getContributors(1);

  });
*/
  it('Can cancel fundraiser and nothing works after', async () => {});
});

/*
 - contribution restricted by contributorRestrictions

 */
