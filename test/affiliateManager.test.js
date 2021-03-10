const { expect } = require('chai');

const {
  deployContract,
  takeSnapshot,
  revertToSnapshot,
  ZERO_ADDRESS,
} = require('../scripts/deploy-helpers');

const { getRandomAddress } = require('./test-helpers');

describe('Affiliate Manager', async function () {
  let snapshotId;
  let affiliateManager;

  before(async function () {
    const fundraiserAddress = getRandomAddress();
    affiliateManager = await deployContract('AffiliateManager', [fundraiserAddress]);
    snapshotId = await takeSnapshot();
  });

  afterEach(async function () {
    await revertToSnapshot(snapshotId);
  });

  it('can setup affiliates', async () => {
    const address1 = getRandomAddress();
    const referral1 = 'asdf1234';
    const percentage1 = 100000; // 10%
    const address2 = getRandomAddress();
    const referral2 = 'xyzffff';
    const percentage2 = 200000; // 20%
    await affiliateManager.addOrUpdate(address1, referral1, percentage1);
    await affiliateManager.addOrUpdate(address2, referral2, percentage2);

    const result1 = await affiliateManager.getByReferral(referral1);
    expect(result1[0]).to.equal(address1);
    expect(result1[1]).to.equal(percentage1);
    expect(await affiliateManager.getReferral(address1)).to.equal(referral1);
    const result2 = await affiliateManager.getByReferral(referral2);
    expect(result2[0]).to.equal(address2);
    expect(result2[1]).to.equal(percentage2);
    expect(await affiliateManager.getReferral(address2)).to.equal(referral2);
  });

  it('can update affiliate setup', async () => {
    const address = getRandomAddress();
    const referral1 = 'asdf1234';
    const percentage1 = 100000; // 10%
    const referral2 = 'xyzffff';
    const percentage2 = 200000; // 20%
    await affiliateManager.addOrUpdate(address, referral1, percentage1);
    await affiliateManager.addOrUpdate(address, referral2, percentage2);

    const result1 = await affiliateManager.getByReferral(referral1);
    expect(result1[0]).to.equal(ZERO_ADDRESS);
    expect(result1[1]).to.equal(0);

    const result2 = await affiliateManager.getByReferral(referral2);
    expect(result2[0]).to.equal(address);
    expect(result2[1]).to.equal(percentage2);
  });

  it('Does require percentage to be 0 < x < 100', async () => {
    await expect(
      affiliateManager.addOrUpdate(getRandomAddress(), 'asdf', 1000000)
    ).to.be.revertedWith('AffiliateManager: Percentage has to be < 100');
    await expect(affiliateManager.addOrUpdate(getRandomAddress(), 'asdf', 0)).to.be.revertedWith(
      'AffiliateManager: Percentage has to be > 0'
    );

    await expect(affiliateManager.addOrUpdate(getRandomAddress(), 'asdf', 999999)).to.emit(
      affiliateManager,
      'AffiliateAddedOrUpdated'
    );
    await expect(affiliateManager.addOrUpdate(getRandomAddress(), 'asdf', 1)).to.emit(
      affiliateManager,
      'AffiliateAddedOrUpdated'
    );
  });

  it('Can remove affiliate', async () => {
    const address1 = getRandomAddress();
    const referral1 = 'asdf1234';
    const percentage1 = 100000; // 10%
    await affiliateManager.addOrUpdate(address1, referral1, percentage1);
    await expect(affiliateManager.remove(address1))
      .to.emit(affiliateManager, 'AffiliateRemoved')
      .withArgs(address1);

    const result1 = await affiliateManager.getByReferral(referral1);
    expect(result1[0]).to.equal(ZERO_ADDRESS);
    expect(result1[1]).to.equal(0);
  });

  it('Cannot delete nonexistent affiliate', async () => {
    await expect(affiliateManager.remove(getRandomAddress())).to.be.revertedWith(
      'Affiliate: not found'
    );
  });
});
