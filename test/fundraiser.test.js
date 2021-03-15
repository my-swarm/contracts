const { expect } = require('chai');
const { ethers } = require('hardhat');
const moment = require('moment');
const { parseUnits } = ethers.utils;
const { BigNumber } = ethers;
const {
  deployBaseContracts,
  deployToken,
  getIssuer,
  getSwarm,
  deployFundraiser,
  getFundraiserOptions,
} = require('../scripts/deploy-helpers');
const { distributeToken, updateAllowance } = require('../scripts/token-helpers');
const {
  REGEX_ADDR,
  advanceTimeAndBlock,
  takeSnapshot,
  revertToSnapshot,
} = require('./test-helpers');

const stateProps = [
  'numContributors',
  'amountQualified',
  'amountPending',
  'isFinished',
  'isHardcapReached',
];

function parseUsd(x) {
  return parseUnits(x.toString(), 6);
}

describe('Fundraiser', async function () {
  let snapshotId;

  let accounts;
  let addr;
  let issuer;
  let softCap;
  let hardCap;
  let fee;
  let expirationTime;

  let contracts;
  let usdc;
  let fundraiser;
  let cRestrictions;
  let amount;
  let amount2;
  let amount3;
  let amount9;
  let affil = 'affil1';
  let affil2 = 'affil2';
  let affil3 = 'affil3';

  let prevState;

  before(async function () {
    issuer = await getIssuer();
    const [baseContracts, baseOptions] = await deployBaseContracts();
    [contracts] = await deployToken(baseContracts);

    accounts = (await ethers.getSigners()).slice(10, 13);
    addr = accounts.map((a) => a.address);

    // everyone gets 100k USDC, that should suffice for all tests
    await distributeToken(
      await getSwarm(),
      contracts.usdc,
      [...addr, issuer.address],
      parseUsd(200000)
    );

    amount = parseUsd(1000);
    amount2 = parseUsd(2000);
    amount3 = parseUsd(3000);
    amount9 = parseUsd(9000);

    fee = baseOptions.fundraiserManager.fee;
    expirationTime = baseOptions.fundraiserManager.expirationTime;
    usdc = baseContracts.usdc;

    snapshotId = await takeSnapshot();
  });

  beforeEach(async function () {
    await revertToSnapshot(snapshotId);
    snapshotId = await takeSnapshot();
    if (!this.currentTest.title.match(/@nodeploy/)) {
      await createFundraiser({});
    }
  });

  async function createFundraiser(customOptions = {}) {
    // default options: softCap: 5000, hardCap: 10000, supply: 100K, startDate: now, endDate: 1 month
    const options = getFundraiserOptions(customOptions);
    const c = await deployFundraiser(contracts, options);
    fundraiser = c.fundraiser;
    cRestrictions = c.contributorRestrictions;
    softCap = options.softCap;
    hardCap = options.hardCap;

    // just allow all spending, we are not here to test erc20 allowance
    for (const account of accounts) {
      await updateAllowance(account, contracts.usdc, fundraiser.address);
    }
    await updateAllowance(issuer, contracts.swm, contracts.tokenMinter.address); // for paying fee
    // await updateAllowance(issuer, contracts.usdc, fundraiser.address); // for staking
  }

  it('Can start @nodeploy', async () => {
    const options = getFundraiserOptions({
      affiliateManager: true,
      startDate: moment().add(1, 'day').unix(),
    });
    const { fundraiser, contributorRestrictions } = await deployFundraiser(contracts, options);

    expect(fundraiser.address).to.match(REGEX_ADDR);
    expect(await fundraiser.minter()).to.equal(contracts.tokenMinter.address);
    expect(await fundraiser.fundraiserManager()).to.equal(contracts.fundraiserManager.address);
    expect(await fundraiser.affiliateManager()).to.match(REGEX_ADDR);
    expect(await fundraiser.contributorRestrictions()).to.match(REGEX_ADDR);
    expect(await fundraiser.label()).to.equal(options.label);
    expect(await fundraiser.token()).to.equal(contracts.src20.address);
    expect(await fundraiser.supply()).to.equal(options.supply);
    expect(await fundraiser.startDate()).to.equal(options.startDate);
    expect(await fundraiser.endDate()).to.equal(options.endDate);
    expect(await fundraiser.softCap()).to.equal(options.softCap);
    expect(await fundraiser.hardCap()).to.equal(options.hardCap);

    expect(await fundraiser.baseCurrency()).to.equal(contracts.usdc.address);
    expect(await fundraiser.tokenPrice()).to.equal(options.tokenPrice);
    expect(await fundraiser.contributionsLocked()).to.equal(options.contributionsLocked);

    expect(await fundraiser.numContributors()).to.equal(0);
    expect(await fundraiser.amountQualified()).to.equal(0);
    expect(await fundraiser.amountPending()).to.equal(0);
    expect(await fundraiser.amountWithdrawn()).to.equal(0);
    expect(await fundraiser.isFinished()).to.equal(false);
    expect(await fundraiser.isCanceled()).to.equal(false);
    expect(await fundraiser.isSetup()).to.equal(true);
    expect(await fundraiser.isHardcapReached()).to.equal(false);

    expect(await contributorRestrictions.maxCount()).to.equal(options.contributors.maxCount);
    expect(await contributorRestrictions.minAmount()).to.equal(options.contributors.minAmount);
    expect(await contributorRestrictions.maxAmount()).to.equal(options.contributors.maxAmount);
  });

  it('Cannot be crated if startDate > endDate @nodeploy', async () => {
    await expect(
      deployFundraiser(
        contracts,
        getFundraiserOptions({
          startDate: moment().add(20, 'day').unix(),
          endDate: moment().add(10, 'day').unix(),
        })
      )
    ).to.be.revertedWith('Fundraiser: End date has to be after start date');
  });
  it('Cannot be crated if softCap > hardCap @nodeploy', async () => {
    await expect(
      deployFundraiser(
        contracts,
        getFundraiserOptions({
          softCap: 2000,
          hardCap: 1000,
        })
      )
    ).to.be.revertedWith('Fundraiser: Hardcap has to be >= Softcap');
  });

  it('Can only be created by token owner @nodeploy', async () => {
    const randomAccount = accounts[1];
    await expect(
      deployFundraiser(
        contracts,
        getFundraiserOptions({
          softCap: 2000,
          hardCap: 1000,
        }),
        randomAccount
      )
    ).to.be.revertedWith('Only token owner can initiate fundraise');
  });

  it('When startDate not provided, uses the current date @nodeploy', async () => {
    const { fundraiser } = await deployFundraiser(
      contracts,
      getFundraiserOptions({ startDate: 0 })
    );
    expect((await fundraiser.startDate()).toNumber()).to.be.greaterThan(Date.now() / 1000 - 60);
  });

  async function testContributeAcceptRemoveRevert(message) {
    await expect(
      fundraiser.connect(accounts[0]).contribute(amount, affil),
      'Contribute should revert'
    ).to.be.revertedWith(message);
    await expect(
      cRestrictions.connect(issuer).whitelistAccount(addr[0]),
      'WhitelistAccount should revert'
    ).to.be.revertedWith(message);
    await expect(
      cRestrictions.connect(issuer).unWhitelistAccount(addr[0]),
      'UnWhitelistAccount should revert'
    ).to.be.revertedWith(message);
  }

  async function payFee() {
    if ((await fundraiser.fee()).eq(0)) return;
    await fundraiser.connect(issuer).payFee(fee);
  }

  async function setTokenAllowance() {
    await updateAllowance(issuer, contracts.src20, fundraiser.address);
    await updateAllowance(issuer, contracts.src20, contracts.tokenMinter.address);
  }

  async function conclude(setAllowance = true) {
    if (setAllowance) await setTokenAllowance();
    // need to approve both minter and fundraiser
    await fundraiser.connect(issuer).concludeFundraise(true);
  }

  async function runAndFinishFundraiser(contributions = [hardCap]) {
    for (const accountId in contributions) {
      await contributeApproved(accountId, contributions[accountId]);
    }
    await payFee();
    await conclude();
  }

  async function contributeApproved(accountId, amount, aff = affil) {
    await cRestrictions.connect(issuer).whitelistAccount(addr[accountId]);
    await fundraiser.connect(accounts[accountId]).contribute(amount, aff);
  }

  async function whitelistContributor(address) {
    await expect(cRestrictions.connect(issuer).whitelistAccount(address))
      .to.emit(cRestrictions, 'AccountWhitelisted')
      .withArgs(address, issuer.address);
  }

  async function storeState() {
    const state = {};
    for (const prop of stateProps) {
      state[prop] = await fundraiser[prop]();
    }
    prevState = state;
    return state;
  }

  async function compareState(newState) {
    for (const prop of stateProps) {
      if (newState[prop]) {
        expect(await fundraiser[prop]()).to.equal(
          newState[prop],
          `${prop} should have changed from ${prevState[prop]} to  ${newState[prop]}`
        );
      } else {
        expect(await fundraiser[prop]()).to.equal(
          prevState[prop],
          `${prop} should have stayed the original value ${prevState[prop]}`
        );
      }
    }
  }

  it('Can whitelist and unwhitelist contributors', async function () {
    await expect(cRestrictions.connect(issuer).whitelistAccount(addr[0]))
      .to.emit(cRestrictions, 'AccountWhitelisted')
      .withArgs(addr[0], issuer.address);
    expect(await cRestrictions.isWhitelisted(addr[0])).to.equal(true);

    await expect(cRestrictions.connect(issuer).unWhitelistAccount(addr[0]))
      .to.emit(cRestrictions, 'AccountUnWhitelisted')
      .withArgs(addr[0], issuer.address);
    expect(await cRestrictions.isWhitelisted(addr[0])).to.equal(false);
  });

  it('Can bulk whitelist and unwhitelist contributors', async function () {
    await expect(cRestrictions.connect(issuer).bulkWhitelistAccount([addr[0], addr[1], addr[2]]))
      .to.emit(cRestrictions, 'AccountWhitelisted')
      .and.to.emit(cRestrictions, 'AccountWhitelisted')
      .and.to.emit(cRestrictions, 'AccountWhitelisted');
    expect(await cRestrictions.isWhitelisted(addr[0])).to.equal(true);
    expect(await cRestrictions.isWhitelisted(addr[1])).to.equal(true);
    expect(await cRestrictions.isWhitelisted(addr[2])).to.equal(true);

    await expect(cRestrictions.connect(issuer).bulkUnWhitelistAccount([addr[0], addr[2]]))
      .to.emit(cRestrictions, 'AccountUnWhitelisted')
      .and.to.emit(cRestrictions, 'AccountUnWhitelisted')
      .and.to.emit(cRestrictions, 'AccountUnWhitelisted');

    expect(await cRestrictions.isWhitelisted(addr[0])).to.equal(false);
    expect(await cRestrictions.isWhitelisted(addr[1])).to.equal(true);
    expect(await cRestrictions.isWhitelisted(addr[2])).to.equal(false);
  });

  it('Automatically accepts contributions from whitelisted contributors', async function () {
    await whitelistContributor(addr[0]);
    await storeState();
    // await fundraiser.connect(accounts[0]).contribute(amount, affil);
    await expect(fundraiser.connect(accounts[0]).contribute(amount, affil))
      .to.emit(fundraiser, 'ContributionAdded')
      .withArgs(addr[0], amount);
    await compareState({
      numContributors: prevState.numContributors.add(1),
      amountQualified: prevState.amountQualified.add(amount),
    });
  });

  it('Accepts unqualified contributions as pending', async function () {
    await storeState();
    await expect(fundraiser.connect(accounts[0]).contribute(amount, affil)).to.emit(
      fundraiser,
      'ContributionPending'
    );
    await compareState({
      amountPending: prevState.amountPending.add(amount),
    });
  });

  it('Cannot contribute zero', async function () {
    await expect(fundraiser.connect(accounts[0]).contribute(0, affil)).to.be.revertedWith(
      'Fundraiser: cannot contribute 0'
    );
  });

  it('Does not accept qualified investments above hardCap and refunds what is over hardCap', async function () {
    await storeState();
    await cRestrictions.connect(issuer).bulkWhitelistAccount(addr);
    await fundraiser.connect(accounts[0]).contribute(amount9, affil);
    // first over hardcap gets refunded
    await expect(fundraiser.connect(accounts[1]).contribute(amount3, affil))
      .to.emit(fundraiser, 'ContributionRefunded')
      .withArgs(addr[1], parseUsd(2000));
    // sedcond over hardcap fails
    await expect(fundraiser.connect(accounts[2]).contribute(amount2, affil)).to.be.revertedWith(
      'HardCap has been reached'
    );
    await compareState({ numContributors: 2, amountQualified: hardCap, isHardcapReached: true });
    expect(await fundraiser.qualifiedContributions(addr[0])).to.equal(amount9);
    expect(await fundraiser.qualifiedContributions(addr[1])).to.equal(parseUsd(1000)); // 1k insted of 3k
    expect(await fundraiser.qualifiedContributions(addr[2])).to.equal(0);

    expect(await fundraiser.contributors(addr[0])).to.equal(true);
    expect(await fundraiser.contributors(addr[1])).to.equal(true);
    expect(await fundraiser.contributors(addr[2])).to.equal(false);
  });

  it('Works exactly the same if pending contributors are accepted after the fact', async function () {
    await storeState();
    await expect(fundraiser.connect(accounts[0]).contribute(amount9, affil)).to.emit(
      fundraiser,
      'ContributionPending'
    );
    await expect(fundraiser.connect(accounts[1]).contribute(amount3, affil)).to.emit(
      fundraiser,
      'ContributionPending'
    );
    await expect(fundraiser.connect(accounts[2]).contribute(amount2, affil)).to.emit(
      fundraiser,
      'ContributionPending'
    );

    await expect(cRestrictions.connect(issuer).whitelistAccount(addr[0])).to.emit(
      fundraiser,
      'ContributionAdded'
    );
    await expect(cRestrictions.connect(issuer).whitelistAccount(addr[1]))
      .to.emit(fundraiser, 'ContributionAdded')
      .withArgs(addr[1], parseUsd(1000))
      .and.to.emit(fundraiser, 'ContributionRefunded');
    await expect(cRestrictions.connect(issuer).whitelistAccount(addr[2])).to.be.revertedWith(
      'HardCap has been reached'
    );

    await compareState({
      numContributors: 2,
      amountQualified: hardCap,
      amountPending: parseUsd(2000), // 2nd contributor got refunded, third stays pending!
      isHardcapReached: true,
    });
    expect(await fundraiser.qualifiedContributions(addr[0])).to.equal(amount9);
    expect(await fundraiser.qualifiedContributions(addr[1])).to.equal(parseUsd(1000)); // 1k insted of 3k
    expect(await fundraiser.qualifiedContributions(addr[2])).to.equal(0);
    expect(await fundraiser.pendingContributions(addr[0])).to.equal(0);
    expect(await fundraiser.pendingContributions(addr[1])).to.equal(0);
    // again: pending contributions don't ret automatically refunded after reaching hardcap. Only after fundraiser ends.
    expect(await fundraiser.pendingContributions(addr[2])).to.equal(parseUsd(2000));

    expect(await fundraiser.contributors(addr[0])).to.equal(true);
    expect(await fundraiser.contributors(addr[1])).to.equal(true);
    expect(await fundraiser.contributors(addr[2])).to.equal(false);
  });

  it('Allows contributor to make multiple unqualified contributions', async function () {
    await storeState();
    await fundraiser.connect(accounts[0]).contribute(amount, affil);
    await fundraiser.connect(accounts[0]).contribute(amount2, affil);
    const sum = amount.add(amount2);
    await compareState({
      amountPending: sum,
    });

    await expect(await fundraiser.pendingContributions(addr[0])).to.equal(sum);
  });

  it('Allows contributor to make multiple qualified contributions', async function () {
    await storeState();
    await cRestrictions.connect(issuer).whitelistAccount(addr[0]);
    await fundraiser.connect(accounts[0]).contribute(amount, affil);
    await fundraiser.connect(accounts[0]).contribute(amount2, affil);
    const sum = amount.add(amount2);
    await compareState({
      amountQualified: sum,
      numContributors: 1,
    });

    await expect(await fundraiser.qualifiedContributions(addr[0])).to.equal(sum);
  });

  it('Does not allow to contribute more than maxAmount when not accepted yet @nodeploy', async function () {
    const maxAmount = parseUsd(2000);
    await createFundraiser({ contributors: { maxAmount } });
    await expect(fundraiser.connect(accounts[0]).contribute(amount2, affil)).to.emit(
      fundraiser,
      'ContributionPending'
    );
    await expect(fundraiser.connect(accounts[0]).contribute(amount, affil)).to.be.revertedWith(
      'Cannot invest more than maxAmount'
    );
    const usdBefore = await usdc.balanceOf(addr[1]);
    // if contribution is over max and difference is nonzero, it still goes through and diff is returned
    await expect(fundraiser.connect(accounts[1]).contribute(amount3, affil)).to.emit(
      fundraiser,
      'ContributionPending'
    );
    expect(await fundraiser.pendingContributions(addr[1])).to.equal(maxAmount);
    expect(await usdc.balanceOf(addr[1])).to.equal(usdBefore.sub(maxAmount));
  });

  it('Does not allow to contribute more than maxAmount when qualified @nodeploy', async function () {
    const maxAmount = parseUsd(2000);
    await createFundraiser({ contributors: { maxAmount } });
    await cRestrictions.connect(issuer).whitelistAccount(addr[0]);
    await cRestrictions.connect(issuer).whitelistAccount(addr[1]);

    await expect(fundraiser.connect(accounts[0]).contribute(amount2, affil)).to.emit(
      fundraiser,
      'ContributionAdded'
    );
    await expect(fundraiser.connect(accounts[0]).contribute(amount, affil)).to.be.revertedWith(
      'Cannot invest more than maxAmount'
    );
    const usdBefore = await usdc.balanceOf(addr[1]);
    // if contribution is over max and difference is nonzero, it still goes through and diff is returned
    await expect(fundraiser.connect(accounts[1]).contribute(amount3, affil)).to.emit(
      fundraiser,
      'ContributionAdded'
    );
    expect(await fundraiser.qualifiedContributions(addr[1])).to.equal(maxAmount);
    expect(await usdc.balanceOf(addr[1])).to.equal(usdBefore.sub(maxAmount));
  });

  it('Does not allow to contribute less than minAmount @nodeploy', async () => {
    const minAmount = parseUsd(2000);
    await createFundraiser({ contributors: { minAmount } });
    await cRestrictions.connect(issuer).whitelistAccount(addr[1]);

    await expect(fundraiser.connect(accounts[0]).contribute(amount, affil)).to.be.revertedWith(
      'Cannot invest less than minAmount'
    );
    const usdBefore = await usdc.balanceOf(addr[1]);
    await expect(fundraiser.connect(accounts[1]).contribute(amount, affil)).to.be.revertedWith(
      'Cannot invest less than minAmount'
    );
    expect(await usdc.balanceOf(addr[1])).to.equal(usdBefore);
  });

  it('Does not check max number of non-accepted contributors @nodeploy', async () => {
    const maxCount = 2;
    await createFundraiser({ contributors: { maxCount } });
    for (let i = 0; i <= maxCount; i++) {
      await expect(fundraiser.connect(accounts[i]).contribute(amount, affil)).to.emit(
        fundraiser,
        'ContributionPending'
      );
    }
  });

  it('Does not allow more contributors than maxCount @nodeploy', async () => {
    const maxCount = 2;
    await createFundraiser({ contributors: { maxCount } });
    for (let i = 0; i <= maxCount; i++) {
      await cRestrictions.connect(issuer).whitelistAccount(addr[i]);
    }
    for (let i = 0; i < maxCount; i++) {
      await expect(fundraiser.connect(accounts[i]).contribute(amount, affil)).to.emit(
        fundraiser,
        'ContributionAdded'
      );
    }
    await expect(
      fundraiser.connect(accounts[maxCount]).contribute(amount, affil)
    ).to.be.revertedWith('Maximum number of contributors reached');
  });

  it('Does not allow to contribute/accept/remove if finished', async () => {
    await runAndFinishFundraiser();
    await testContributeAcceptRemoveRevert('Fundraise has finished');
  });

  it('Does not allow to contribute/accept/remove if hardcap reached @nodeploy', async () => {
    const hardCap = parseUsd('1000');
    const softCap = hardCap;
    await createFundraiser({ hardCap, softCap });
    await contributeApproved(0, amount);
    await testContributeAcceptRemoveRevert('HardCap has been reached');
  });

  it('Does not allow to contribute/accept/remove if before startDate @nodeploy', async () => {
    await createFundraiser({
      startDate: moment().add(2, 'days').unix(),
      endDate: moment().add(5, 'days').unix(),
    });
    await testContributeAcceptRemoveRevert('Fundraise has not started yet');
  });

  it('Does not allow to contribute/accept/remove after endDate @nodeploy', async () => {
    await createFundraiser({
      endDate: moment().add(1, 'days').unix(),
    });
    await advanceTimeAndBlock(2 * 24 * 3600);
    await testContributeAcceptRemoveRevert('Fundraise has ended');
  });

  it('Allows to pay fee and returns what is over required fee', async () => {
    if ((await fundraiser.fee()).eq(0)) return;

    await expect(fundraiser.connect(issuer).payFee(0)).to.be.revertedWith(
      'Fundraiser: Fee must be greater than 0.'
    );
    await expect(fundraiser.connect(issuer).payFee(fee.sub(1)))
      .to.emit(fundraiser, 'FeePaid')
      .withArgs(issuer.address, fee.sub(1));
    expect(await fundraiser.isFeePaid()).to.equal(false);
    expect(await fundraiser.totalFeePaid()).to.equal(fee.sub(1));

    const usdBefore = await usdc.balanceOf(issuer.address);
    await expect(fundraiser.connect(issuer).payFee(2))
      .to.emit(fundraiser, 'FeePaid')
      .withArgs(issuer.address, 1);
    expect(await fundraiser.isFeePaid()).to.equal(true);
    expect(await fundraiser.totalFeePaid()).to.equal(fee);
    expect(await usdc.balanceOf(issuer.address)).to.equal(usdBefore.sub(1));

    await expect(fundraiser.connect(issuer).payFee(1)).to.be.revertedWith(
      'Fundraiser: Fee already paid.'
    );
  });

  it('Can finish (stake and mint) if hardCap reached', async () => {
    await contributeApproved(0, hardCap);
    await payFee();
    const amountQualified = await fundraiser.amountQualified();
    const balanceBefore = await contracts.usdc.balanceOf(issuer.address);
    await setTokenAllowance();
    await expect(fundraiser.connect(issuer).concludeFundraise(true)).to.emit(
      fundraiser,
      'FundraiserFinished'
    );
    expect(await fundraiser.contributionsLocked()).to.equal(true);
    expect(await fundraiser.isFinished()).to.equal(true);
    expect(await contracts.usdc.balanceOf(issuer.address)).to.equal(
      balanceBefore.add(amountQualified)
    ); // auto withdraw
  });

  it('Can finish (stake and mint) if softCap reached and endDate passed @nodeploy', async () => {
    await createFundraiser({
      endDate: moment().add(1, 'days').unix(),
    });

    await contributeApproved(0, softCap);
    await payFee();
    const snapshotId = await takeSnapshot();
    await setTokenAllowance();
    await advanceTimeAndBlock(2 * 24 * 3600);
    await expect(fundraiser.connect(issuer).concludeFundraise(true)).to.emit(
      fundraiser,
      'FundraiserFinished'
    );
    expect(await fundraiser.contributionsLocked()).to.equal(true);
    expect(await fundraiser.isFinished()).to.equal(true);
    await revertToSnapshot(snapshotId);
  });

  it('Cannot cancel if finished', async () => {
    await runAndFinishFundraiser();
    await expect(fundraiser.connect(issuer).cancel()).to.be.revertedWith(
      'Fundraiser: Cannot cancel when finished.'
    );
  });

  it('Cannot finish if already finished', async () => {
    await runAndFinishFundraiser();
    await expect(fundraiser.connect(issuer).concludeFundraise(true)).to.be.revertedWith(
      'Already finished'
    );
  });

  it('Cannot finish if softCap not reached', async () => {
    await contributeApproved(0, softCap.sub(1));
    await payFee();
    await expect(fundraiser.connect(issuer).concludeFundraise(true)).to.be.revertedWith(
      'SoftCap not reached'
    );
  });

  it('Cannot finish if fee is not paid', async () => {
    if ((await fundraiser.fee()).eq(0)) return;

    await contributeApproved(0, softCap);
    await fundraiser.connect(issuer).payFee(fee.sub(1));
    await expect(fundraiser.connect(issuer).concludeFundraise(true)).to.be.revertedWith(
      'Fundraiser: Fee must be fully paid.'
    );
  });

  it('Cannot finish after expiration date has passed @nodeploy', async () => {
    await createFundraiser({
      startDate: moment().subtract(1, 'days').unix(),
      endDate: moment().add(1, 'days').unix(),
    });

    await payFee();
    await contributeApproved(0, softCap);
    const snapshotId = await takeSnapshot();
    await advanceTimeAndBlock(2 * 24 * 3600 + expirationTime);
    await expect(fundraiser.connect(issuer).concludeFundraise(true)).to.be.revertedWith(
      'Expiration time passed'
    );
    await revertToSnapshot(snapshotId);
  });

  it('Cannot finish if neither hardcap nor end date has been reached', async () => {
    await contributeApproved(0, softCap);
    await payFee();
    await expect(fundraiser.connect(issuer).concludeFundraise(true)).to.be.revertedWith(
      'EndDate or hardCap not reached'
    );
  });

  it('Allow to claim tokens when conditions are met', async () => {
    await runAndFinishFundraiser();
    const tokensBefore = await contracts.src20.balanceOf(addr[0]);
    expect(tokensBefore).to.equal(0);
    const expectedAmount = await fundraiser.supply();
    await expect(fundraiser.connect(accounts[0]).claimTokens())
      .to.emit(fundraiser, 'TokensClaimed')
      .withArgs(addr[0], expectedAmount);
    await expect(await contracts.src20.balanceOf(addr[0])).to.equal(expectedAmount);
  });

  it('Does not allow to claim tokens if not finished', async () => {
    await contributeApproved(0, hardCap);
    await expect(fundraiser.connect(accounts[0]).claimTokens()).to.be.revertedWith(
      'Fundraise has not finished'
    );
  });

  it('Does not allow to claim tokens if balance is zero', async () => {
    await runAndFinishFundraiser();
    await expect(fundraiser.connect(accounts[1]).claimTokens()).to.be.revertedWith(
      'There are no tokens to claim'
    );
  });

  it('Computes token price if supply is specified', async () => {
    const supply = parseUnits('1000', 18);
    await createFundraiser({ supply, tokenPrice: 0 });
    await runAndFinishFundraiser([hardCap]);

    expect(await fundraiser.supply()).to.equal(supply);
    // hardcap === 10k => price = 10 with 18 decimals
    expect(await fundraiser.tokenPrice()).to.equal(
      BigNumber.from(10).mul(BigNumber.from(10).pow(18))
    );
  });

  it('Computes supply if token price is specified', async () => {
    const tokenPrice = parseUsd(20);
    await createFundraiser({ supply: 0, tokenPrice });
    await runAndFinishFundraiser([hardCap]);

    // hardcap === 10k => supply = 500 with 18 decimals
    expect(await fundraiser.supply()).to.equal(BigNumber.from(500).mul(BigNumber.from(10).pow(18)));
    expect(await fundraiser.tokenPrice()).to.equal(tokenPrice);
  });
});
