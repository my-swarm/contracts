const { expect } = require('chai');
const { ethers } = require('hardhat');
const {
  getIssuer,
  getSwarm,
  deployContract,
  deployBaseContracts,
  deployToken,
} = require('../scripts/deploy-helpers');

const { getRandomAddress } = require('./test-helpers');

function getAssetOptions() {
  const src20Address = getRandomAddress();
  const kyaHash = ethers.utils.formatBytes32String('aaaa1234bbbb1234');
  const kyaUri = 'http://kya-updated.com';
  const nav = 3456;
  return { src20Address, kyaHash, kyaUri, nav };
}

describe('AssetRegistry does Asset registering', async () => {
  let swarmAddress;
  let assetRegistry;

  beforeEach(async () => {
    swarmAddress = await (await getSwarm()).getAddress(); // also the factory
    assetRegistry = await deployContract('AssetRegistry', [swarmAddress]);
  });

  it('Can add an asset', async () => {
    const { src20Address, kyaHash, kyaUri, nav } = getAssetOptions();
    await expect(assetRegistry.addAsset(src20Address, kyaHash, kyaUri, nav))
      .to.emit(assetRegistry, 'AssetAdded')
      .withArgs(src20Address, kyaHash, kyaUri, nav);

    expect(await assetRegistry.getNav(src20Address)).to.equal(nav);
    expect(await assetRegistry.getkyaUri(src20Address)).to.equal(kyaUri);
    expect(await assetRegistry.getKyaHash(src20Address)).to.equal(kyaHash);
  });

  it('Cannot add an the same asset again', async () => {
    const { src20Address, kyaHash, kyaUri, nav } = getAssetOptions();
    await assetRegistry.addAsset(src20Address, kyaHash, kyaUri, nav);
    await expect(assetRegistry.addAsset(src20Address, kyaHash, kyaUri, nav)).to.be.revertedWith(
      'Asset already added, try update functions'
    );
  });
});

describe('AssetRegistry can change asset properties', async () => {
  let src20;
  let assetRegistry;

  beforeEach(async () => {
    const [baseContracts] = await deployBaseContracts();
    assetRegistry = baseContracts.assetRegistry;
    const result = await deployToken(baseContracts);
    src20 = result[0].src20;
  });

  it('Can update asset', async () => {
    const issuer = await getIssuer();
    const { kyaHash, kyaUri, nav } = getAssetOptions();

    // issuer created the contract, so he's delegate
    await expect(assetRegistry.connect(issuer).updateNav(src20.address, nav))
      .to.emit(assetRegistry, 'NavUpdated')
      .withArgs(src20.address, nav);
    expect(await assetRegistry.getNav(src20.address)).to.equal(nav);

    await expect(assetRegistry.connect(issuer).updateKya(src20.address, kyaHash, kyaUri))
      .to.emit(assetRegistry, 'KyaUpdated')
      .withArgs(src20.address, kyaHash, kyaUri);
    expect(await assetRegistry.getKyaHash(src20.address)).to.equal(kyaHash);
    expect(await assetRegistry.getkyaUri(src20.address)).to.equal(kyaUri);
  });

  it('Cannot update asset when not delegate', async () => {
    const { kyaHash, kyaUri, nav } = getAssetOptions();
    // by default, I'm not delegate (I'm account 0, delegate is account 1 - issuer)
    await expect(assetRegistry.updateNav(src20.address, nav)).to.be.revertedWith(
      'Caller not delegate'
    );
    await expect(assetRegistry.updateKya(src20.address, kyaHash, kyaUri)).to.be.revertedWith(
      'Caller not delegate'
    );
  });
});
