const { expect } = require('chai');
const { ethers } = require('@nomiclabs/buidler');
const { parseUnits } = ethers.utils;
const {
  deploySRC20Mock,
  deployFundraiser,
  deployBaseContracts,
  deployTokenContracts,
  deployFundraiserManager,
  deployFundraiserContracts,
  getAddresses,
  getIssuer,
  getSwarm,
  ZERO_ADDRESS,
} = require('../scripts/deploy-helpers');
const { distributeToken } = require('../scripts/token-helpers');
const { REGEX_ADDR, deploySrc20Mock } = require('./test-helpers');

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
  let accounts;
  let addr;
  let issuer;
  let issuerAddress;
  let softCap;
  let hardCap;

  let contracts;
  // let fundraiserManager;
  let fundraiser;
  let cRestrictions;
  let amount;
  let amount2;
  let amount3;
  let amount4;
  let amount9;
  let affil = 'affil1';
  let affil2 = 'affil2';
  let affil3 = 'affil3';

  let prevState;

  before(async function () {
    swarm = await getSwarm();
    issuer = await getIssuer();
    issuerAddress = await issuer.getAddress();
    const [baseContracts] = await deployBaseContracts();
    contracts = (await deployTokenContracts(baseContracts))[0];
    // fundraiserManager = contracts.fundraiserManager;
    accounts = (await ethers.getSigners()).slice(10, 15);
    addr = (await getAddresses()).slice(10, 15);
    // everyone gets 100k USDC, that should suffice for all tests
    await distributeToken(swarm, contracts.usdc, addr, parseUsd(100000));

    amount = parseUsd(1000);
    amount2 = parseUsd(2000);
    amount3 = parseUsd(3000);
    amount4 = parseUsd(4000);
    amount9 = parseUsd(9000);
  });

  async function deployFundraiser(customOptions = {}) {
    // default options: softCap: 5000, hardCap: 10000, supply: 100K, startDate: now, endDate: 1 month
    const [fc, options] = await deployFundraiserContracts(contracts, customOptions);
    fundraiser = fc.fundraiser;
    cRestrictions = fc.contributorRestrictions;
    softCap = options.softCap;
    hardCap = options.hardCap;

    // just allow all spending, we are not here to test erc20 allowance
    for (const account of accounts) {
      await contracts.usdc.connect(account).approve(fundraiser.address, parseUsd(100000));
    }
  }

  beforeEach(async function () {
    if (!this.currentTest.title.match(/@nodeploy/)) {
      await deployFundraiser({});
    }
  });

  async function whitelistContributor(address) {
    await expect(cRestrictions.connect(issuer).whitelistAccount(address))
      .to.emit(cRestrictions, 'AccountWhitelisted')
      .withArgs(address, issuerAddress);
  }

  it('💪 Can whitelist contributors', async function () {
    await whitelistContributor(addr[0]);
    expect(await cRestrictions.isWhitelisted(addr[0])).to.equal(true);
  });

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

  it('❤ Automatically accepts contributions from whitelisted contributors', async function () {
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

  it('🙏 Accepts unqualified contributions as pending', async function () {
    await storeState();
    await expect(fundraiser.connect(accounts[0]).contribute(amount, affil)).to.emit(
      fundraiser,
      'ContributionPending'
    );
    await compareState({
      amountPending: prevState.amountPending.add(amount),
    });
  });

  it('😋 Cannot contribute zero', async function () {
    await expect(fundraiser.connect(accounts[0]).contribute(0, affil)).to.be.revertedWith(
      'Fundraiser: cannot contribute 0'
    );
  });

  it('😎 Does not accept qualified investments above hardCap and refunds what is over hardCap', async function () {
    await storeState();
    await cRestrictions.bulkWhitelistAccount(addr);
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

  it('😎 Works exactly the same if pending contributors are accepted after the fact', async function () {
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

    await expect(cRestrictions.whitelistAccount(addr[0])).to.emit(fundraiser, 'ContributionAdded');
    await expect(cRestrictions.whitelistAccount(addr[1]))
      .to.emit(fundraiser, 'ContributionAdded')
      .withArgs(addr[1], parseUsd(1000))
      .and.to.emit(fundraiser, 'ContributionRefunded');
    await expect(cRestrictions.whitelistAccount(addr[2])).to.be.revertedWith(
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

  it('Adds to list of contributors when both whitelisted and donated');

  it('Allows contributor to make multiple contributions', async function () {
    await storeState();
    await fundraiser.connect(accounts[0]).contribute(amount, affil);
    await fundraiser.connect(accounts[0]).contribute(amount2, affil);
    await compareState({
      amountPending: amount.add(amount2),
    });

    await expect(await fundraiser.pendingContributions(addr[0])).to.equal(amount.add(amount2));
  });

  it('Does not allow to contribute more than maxAmount (as pending or qualified) @nodeploy', async function () {
    // todo: deploy with custom options and contribute
    expect(1).to.equal(1);
  });

  it('Does not allow to contribute less than minAmount');
  it('Does not allow more contributors than maxCount');
  it('Does not allow to contribute if not setup'); // need to deploy manually
  it('Does not allow to contribute if finished');
  it('Does not allow to contribute if before startDate');
  it('Does not allow to contribute if after endDate');

  it('Adds affilate claim');
  it('Allows to pay fee and returns what is over required fee');
  it('Can stake and mint if all conditions are met');
  it('Cannot finish if already finished');
  it('Cannot finish if softCap not reached');
  it('Cannot finish if fee is not paid');
  it('Cannot finish expiration after end date has passed');
  it('Cannot finish if neither hardcap nor end date has been reached');

  it('Allow to claim tokens when conditions are met'); // emit TokensClaimed
  it('Does not allow to claim tokens if not finished');
  it('Does not allow to claim tokens if balance is zero');

  it('Allows to claim referrals if conditions are met'); // emit ReferralCollected
  it('Does not allow to claim referrals if not finished');
  it('Does not allow to claim referrals if balance is zero');

  // it('Can be ended when softcap was reached');
});
