const { expect } = require('chai');
const { ethers } = require('hardhat');
const moment = require('moment');
const { parseUnits } = ethers.utils;
const {
  deployBaseContracts,
  deployToken,
  deployFundraiserContracts,
  getAddresses,
  getIssuer,
  getSwarm,
  advanceTimeAndBlock,
  takeSnapshot,
  revertToSnapshot,
  ZERO_ADDRESS,
} = require('../scripts/deploy-helpers');
const { distributeToken, updateAllowance } = require('../scripts/token-helpers');
const { getRandomAddress, REGEX_ADDRESS } = require('./test-helpers');

function parseUsd(x) {
  return parseUnits(x.toString(), 6);
}

describe('Fundraiser affiliate/referrer', async function () {
  let snapshotId;
  let accounts;
  let addr;
  let issuer;
  let issuerAddress;

  let contracts;
  let usdc;
  let fundraiser;
  let cRestrictions;
  let affiliateManager;
  let amount;
  let amount8;
  let affil1;
  let affil2;

  let softCap;
  let fee;

  before(async function () {
    issuer = await getIssuer();
    issuerAddress = await issuer.getAddress();
    const [baseContracts, baseContractOptions] = await deployBaseContracts();
    const [tokenContracts, tokenOptions] = await deployToken(baseContracts);
    softCap = tokenOptions.softCap;
    fee = baseContractOptions.fundraiserManager.fee;
    [contracts] = await deployFundraiserContracts(tokenContracts, { affiliateManager: true });
    fundraiser = contracts.fundraiser;
    cRestrictions = contracts.contributorRestrictions;
    affiliateManager = contracts.affiliateManager;

    // we'll need 5 accounts. 2 contributors, 2 affiliates, 1 random
    accounts = (await ethers.getSigners()).slice(10, 15);
    addr = (await getAddresses()).slice(10, 15);
    usdc = baseContracts.usdc;
    // everyone gets 100k USDC, that should suffice for all tests
    await distributeToken(
      await getSwarm(),
      contracts.usdc,
      [...addr, issuerAddress],
      parseUsd(200000)
    );

    affil1 = {
      account: accounts[2],
      address: addr[2],
      referral: 'referral1',
      percentage: parseUnits('10', 4),
    };
    affil2 = {
      account: accounts[3],
      address: addr[3],
      referral: 'referral2',
      percentage: parseUnits('20', 4),
    };

    await affiliateManager
      .connect(issuer)
      .addOrUpdate(affil1.address, affil1.referral, affil1.percentage);
    await affiliateManager
      .connect(issuer)
      .addOrUpdate(affil2.address, affil2.referral, affil2.percentage);

    amount = parseUsd(1000);
    amount8 = parseUsd(8000); // so that we total hardCap

    for (const account of accounts) {
      await updateAllowance(account, contracts.usdc, fundraiser.address);
    }
    await updateAllowance(issuer, contracts.swm, contracts.tokenMinter.address); // for paying fee
    // await updateAllowance(issuer, contracts.usdc, fundraiser.address); // for staking

    snapshotId = await takeSnapshot();
  });

  beforeEach(async function () {
    await revertToSnapshot(snapshotId);
    snapshotId = await takeSnapshot();
  });

  async function contributeApproved(accountId, amount, aff = affil) {
    await cRestrictions.connect(issuer).whitelistAccount(addr[accountId]);
    await fundraiser.connect(accounts[accountId]).contribute(amount, aff);
  }

  async function contributeAll() {
    await contributeApproved(0, amount, affil1.referral);
    await contributeApproved(1, amount, affil2.referral);
    await contributeApproved(2, amount8, affil2.referral);
  }

  async function finalizeFundraiser() {
    if ((await fundraiser.fee()).gt(0)) {
      await fundraiser.connect(issuer).payFee(fee);
    }
    await fundraiser.connect(issuer).concludeFundraise(true);
  }

  async function setTokenAllowance() {
    await updateAllowance(issuer, contracts.src20, fundraiser.address);
    await updateAllowance(issuer, contracts.src20, contracts.tokenMinter.address);
  }

  it('Adds affiliate when contributing', async () => {
    await contributeAll();

    const affilAddr1 = await fundraiser.contributorAffiliates(addr[0]);
    expect(await affiliateManager.getReferral(affilAddr1)).to.equal(affil1.referral);
  });

  it('Increases affiliate share for affiliate', async () => {
    await contributeAll();

    expect(await fundraiser.affiliateShares(affil1.address)).to.equal(
      amount.mul(affil1.percentage).div(100).div(10000)
    );
    expect(await fundraiser.affiliateShares(affil2.address)).to.equal(
      amount.add(amount8).mul(affil2.percentage).div(100).div(10000)
    );
  });

  it('Increases affiliate share for contributor', async () => {
    await contributeAll();

    expect(await fundraiser.contributorShares(addr[0])).to.equal(
      amount.mul(affil1.percentage).div(100).div(10000)
    );
    expect(await fundraiser.contributorShares(addr[1])).to.equal(
      amount.mul(affil2.percentage).div(100).div(10000)
    );
  });

  it('Removes affiliate/contributor share when contributor removed', async () => {
    await contributeApproved(0, amount, affil1.referral);
    await cRestrictions.unWhitelistAccount(addr[0]);
    expect(await fundraiser.contributorAffiliates(addr[0])).to.equal(ZERO_ADDRESS);
    expect(await fundraiser.contributorShares(addr[0])).to.equal(0);
    expect(await fundraiser.affiliateShares(affil1.address)).to.equal(0);
  });

  it('Allows to claim referrals if conditions are met', async () => {
    await contributeAll();
    await setTokenAllowance();
    await finalizeFundraiser();
    const usdBefore = await usdc.balanceOf(affil1.address);
    const expectedShare = amount.mul(affil1.percentage).div(100).div(10000);
    await expect(fundraiser.connect(affil1.account).claimReferrals())
      .to.emit(fundraiser, 'ReferralClaimed')
      .withArgs(affil1.address, expectedShare);
    expect(await fundraiser.affiliateShares(affil1.address)).to.equal(0);
    expect(await usdc.balanceOf(affil1.address)).to.equal(usdBefore.add(expectedShare));
  });

  it('Does not allow to claim referrals if not finished', async () => {
    await contributeAll();
    await expect(fundraiser.connect(affil1.account).claimReferrals()).to.be.revertedWith(
      'Fundraise is not finished'
    );
  });

  it('Does not allow to claim referrals if balance is zero', async () => {
    await contributeAll();
    await setTokenAllowance();
    await finalizeFundraiser();
    await expect(fundraiser.connect(accounts[4]).claimReferrals()).to.be.revertedWith(
      'There are no referrals to be collected'
    );
    await fundraiser.connect(affil1.account).claimReferrals();
    await expect(fundraiser.connect(affil1.account).claimReferrals()).to.be.revertedWith(
      'There are no referrals to be collected'
    );
  });
});
