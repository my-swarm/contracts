const { expect } = require('chai');
const { getIssuer, deployContract } = require('../scripts/deploy-helpers');

const FEATURE_TRANSFER = 1;
const FEATURE_PAUSABLE = 2;
const FEATURE_ACCOUNT_BURN = 4;
const FEATURE_ACCOUNT_FREEZE = 8;
const FEATURE_TRANSFER_RULES = 16;
const FEATURE_VALUES = [
  FEATURE_TRANSFER,
  FEATURE_PAUSABLE,
  FEATURE_ACCOUNT_BURN,
  FEATURE_ACCOUNT_FREEZE,
  FEATURE_TRANSFER_RULES,
];

describe('Token features', async () => {
  let issuer;
  let account1;

  before(async () => {
    issuer = await getIssuer();
    account1 = (await ethers.getSigners())[10];
  });

  async function deploy(featuresMap) {
    return await deployContract('Features', [issuer.address, featuresMap]);
  }

  it('Can deploy with features set properly', async () => {
    for (let i = 0; i < 4; i++) {
      const featuresMap = FEATURE_VALUES[i];
      const features = await deploy(featuresMap);
      for (let j = 0; j < 4; j++) {
        expect(await features.owner()).to.equal(issuer.address);
        expect(await features.features()).to.equal(featuresMap);
        expect(await features.isEnabled(FEATURE_VALUES[j])).to.equal(i === j);
      }
    }
  });

  it('Can pause and unpause token', async () => {
    const features = await deploy(FEATURE_PAUSABLE);
    await expect(features.connect(issuer).pause())
      .to.emit(features, 'Paused')
      .withArgs(issuer.address);
    await expect(features.connect(issuer).unpause())
      .to.emit(features, 'Unpaused')
      .withArgs(issuer.address);
  });

  it('Cannot pause if not owner', async () => {
    const features = await deploy(FEATURE_PAUSABLE);
    await expect(features.connect(account1).pause()).to.be.revertedWith(
      'Ownable: caller is not the owner'
    );
  });

  it('Cannot pause if already paused', async () => {
    const features = await deploy(FEATURE_PAUSABLE);
    await features.connect(issuer).pause();
    await expect(features.connect(issuer).pause()).to.be.revertedWith('Pausable: paused');
  });

  it('Cannot pause if not enabled', async () => {
    const features = await deploy(0);
    await expect(features.connect(issuer).pause()).to.be.revertedWith(
      'Features: Token feature is not enabled'
    );
  });

  it('Cannot unpause if not owner', async () => {
    const features = await deploy(FEATURE_PAUSABLE);
    await features.connect(issuer).pause();
    await expect(features.connect(account1).unpause()).to.be.revertedWith(
      'Ownable: caller is not the owner'
    );
  });

  it('Cannot unpause if not paused', async () => {
    const features = await deploy(FEATURE_PAUSABLE);
    await expect(features.connect(issuer).unpause()).to.be.revertedWith('Pausable: not paused');
  });

  it('Cannot unpause if not enabled', async () => {
    const features = await deploy(0);
    await expect(features.connect(issuer).unpause()).to.be.revertedWith(
      'Features: Token feature is not enabled'
    );
  });

  it('Can freeze and unfreeze an account', async () => {
    const features = await deploy(FEATURE_ACCOUNT_FREEZE);
    await expect(features.connect(issuer).freezeAccount(account1.address))
      .to.emit(features, 'AccountFrozen')
      .withArgs(account1.address);
    await expect(features.connect(issuer).unfreezeAccount(account1.address))
      .to.emit(features, 'AccountUnfrozen')
      .withArgs(account1.address);
  });

  it('Cannot freeze account if not owner', async () => {
    const features = await deploy(FEATURE_ACCOUNT_FREEZE);
    await expect(features.connect(account1).freezeAccount(account1.address)).to.be.revertedWith(
      'Ownable: caller is not the owner'
    );
  });

  it('Can freeze account even if already frozen', async () => {
    const features = await deploy(FEATURE_ACCOUNT_FREEZE);
    await features.connect(issuer).freezeAccount(account1.address);
    await expect(features.connect(issuer).freezeAccount(account1.address)).to.emit(
      features,
      'AccountFrozen'
    );
  });

  it('Can unfreeze account even if not frozen', async () => {
    const features = await deploy(FEATURE_ACCOUNT_FREEZE);
    await expect(features.connect(issuer).unfreezeAccount(account1.address)).to.emit(
      features,
      'AccountUnfrozen'
    );
  });

  it('Cannot freeze account if not enabled', async () => {
    const features = await deploy(0);
    await expect(features.connect(account1).freezeAccount(account1.address)).to.be.revertedWith(
      'Features: Token feature is not enabled'
    );
  });
});
