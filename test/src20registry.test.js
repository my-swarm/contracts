const { expect } = require('chai');
const {
  getAccount,
  getIssuer,
  getSwarm,
  deployContract,
  ZERO_ADDRESS,
  takeSnapshot,
  revertToSnapshot,
} = require('../scripts/deploy-helpers');

const { getRandomAddress, getRandomAddresses } = require('./test-helpers');

const MSG_ONLY_OWNER = 'Ownable: caller is not the owner';

describe('SRC20 Registry', async () => {
  let snapshotId;

  let swarm;
  let swm;
  let registry;
  let treasury;
  let rewardPool;
  let factory;
  let randomAccount;

  before(async () => {
    swarm = await getSwarm();
    treasury = await getAccount(2);
    rewardPool = await getAccount(3);
    factory = await getAccount(4);
    randomAccount = await getAccount(5);
    swm = await deployContract('MockSwm');
    registry = await deployContract('SRC20Registry', [treasury.address, rewardPool.address]);

    snapshotId = await takeSnapshot();
  });

  beforeEach(async function () {
    await revertToSnapshot(snapshotId);
    snapshotId = await takeSnapshot();
  });

  it('Can update Treasury', async () => {
    const newTreasury = getRandomAddress();
    await expect(registry.connect(swarm).updateTreasury(newTreasury))
      .to.emit(registry, 'TreasuryUpdated')
      .withArgs(newTreasury);
    expect(await registry.treasury()).to.equal(newTreasury);
  });

  // todo: cannot create with wrong constructor params

  it('Cannot update Treasury to zero address', async () => {
    await expect(registry.connect(swarm).updateTreasury(ZERO_ADDRESS)).to.be.revertedWith(
      'SRC20Registry: Treasury cannot be the zero address'
    );
  });

  it('Cannot update Treasury when not owner', async () => {
    const newTreasury = getRandomAddress();
    await expect(registry.connect(randomAccount).updateTreasury(newTreasury)).to.be.revertedWith(
      MSG_ONLY_OWNER
    );
  });

  it('Can update Reward Pool', async () => {
    const newRewardPool = getRandomAddress();
    await expect(registry.connect(swarm).updateRewardPool(newRewardPool))
      .to.emit(registry, 'RewardPoolUpdated')
      .withArgs(newRewardPool);
    expect(await registry.rewardPool()).to.equal(newRewardPool);
  });

  it('Cannot update Reward Pool to zero address', async () => {
    await expect(registry.connect(swarm).updateRewardPool(ZERO_ADDRESS)).to.be.revertedWith(
      'SRC20Registry: Reward pool cannot be the zero address'
    );
  });

  it('Cannot update Reward Pool when not owner', async () => {
    const newRewardPool = getRandomAddress();
    await expect(
      registry.connect(randomAccount).updateRewardPool(newRewardPool)
    ).to.be.revertedWith(MSG_ONLY_OWNER);
  });

  it('Can add and remove factory', async () => {
    const address = getRandomAddress();
    await expect(registry.addFactory(address)).to.emit(registry, 'FactoryAdded').withArgs(address);

    expect(await registry.authorizedFactories(address)).to.equal(true);

    await expect(registry.removeFactory(address))
      .to.emit(registry, 'FactoryRemoved')
      .withArgs(address);
    expect(await registry.authorizedFactories(address)).to.equal(false);
  });

  it('Cannot add or remove zero address factory', async () => {
    await expect(registry.addFactory(ZERO_ADDRESS)).to.be.revertedWith(
      'SRC20Registry: Factory is zero address'
    );
    await expect(registry.removeFactory(ZERO_ADDRESS)).to.be.revertedWith(
      'SRC20Registry: Factory is zero address'
    );
  });

  it('Cannot add same factory multiple times', async () => {
    const address = getRandomAddress();
    await registry.addFactory(address);
    await expect(registry.addFactory(address)).to.be.revertedWith(
      'SRC20Registry: Factory already in registry'
    );
  });

  it('Cannot remove unregistered factory', async () => {
    const address = getRandomAddress();
    await expect(registry.removeFactory(address)).to.be.revertedWith(
      'SRC20Registry: Factory not in registry'
    );
  });

  it('Only allows owner to add a factory', async () => {
    const sender = await getAccount(10);
    await expect(registry.connect(sender).addFactory(getRandomAddress())).to.be.revertedWith(
      MSG_ONLY_OWNER
    );
  });

  it('Only allows owner to remove a factory', async () => {
    const sender = await getAccount(10);
    await expect(registry.connect(sender).removeFactory(getRandomAddress())).to.be.revertedWith(
      MSG_ONLY_OWNER
    );
  });

  it('Can add and remove minters', async () => {
    const address = getRandomAddress();
    await expect(registry.addMinter(address)).to.emit(registry, 'MinterAdded').withArgs(address);

    expect(await registry.authorizedMinters(address)).to.equal(true);

    await expect(registry.removeMinter(address))
      .to.emit(registry, 'MinterRemoved')
      .withArgs(address);
    expect(await registry.authorizedMinters(address)).to.equal(false);
  });

  it('Cannot add or remove zero address minter', async () => {
    await expect(registry.addMinter(ZERO_ADDRESS)).to.be.revertedWith(
      'SRC20Registry: Minter is zero address'
    );
    await expect(registry.removeMinter(ZERO_ADDRESS)).to.be.revertedWith(
      'SRC20Registry: Minter is zero address'
    );
  });

  it('Cannot add same minter multiple times', async () => {
    const address = getRandomAddress();
    await registry.addMinter(address);
    await expect(registry.addMinter(address)).to.be.revertedWith(
      'SRC20Registry: Minter is already authorized'
    );
  });

  it('Cannot remove unregistered minter', async () => {
    const address = getRandomAddress();
    await expect(registry.removeMinter(address)).to.be.revertedWith(
      'SRC20Registry: Minter is not authorized'
    );
  });

  it('Only allows owner to add a minter', async () => {
    const sender = await getAccount(10);
    await expect(registry.connect(sender).addMinter(getRandomAddress())).to.be.revertedWith(
      MSG_ONLY_OWNER
    );
  });

  it('Only allows owner to remove a minter', async () => {
    const sender = await getAccount(10);
    await expect(registry.connect(sender).removeMinter(getRandomAddress())).to.be.revertedWith(
      MSG_ONLY_OWNER
    );
  });

  async function addTokenToRegistry() {
    const [tokenAddress, minterAddress] = getRandomAddresses(2);
    await registry.addFactory(factory.address);
    await registry.addMinter(minterAddress);

    await expect(registry.connect(factory).register(tokenAddress, minterAddress))
      .to.emit(registry, 'SRC20Registered')
      .withArgs(tokenAddress, minterAddress);

    return { tokenAddress, minterAddress };
  }

  it('Can register and unregister a token', async () => {
    const { tokenAddress, minterAddress } = await addTokenToRegistry();
    expect(await registry.contains(tokenAddress)).to.equal(true);
    expect(await registry.getMinter(tokenAddress)).to.equal(minterAddress);
    expect(await registry.getFactory(tokenAddress)).to.equal(factory.address);
    await expect(registry.connect(swarm).unregister(tokenAddress))
      .to.emit(registry, 'SRC20Unregistered')
      .withArgs(tokenAddress);

    expect(await registry.contains(tokenAddress)).to.equal(false);
  });

  it('Cannot add a token with zero address', async () => {
    const minterAddress = getRandomAddress();
    await registry.addFactory(factory.address);
    await registry.addMinter(minterAddress);
    await expect(
      registry.connect(factory).register(ZERO_ADDRESS, minterAddress)
    ).to.be.revertedWith('SRC20Registry: Token is zero address');
  });

  it('Cannot add a token when not factory', async () => {
    const unregisteredFactory = await getAccount(10);
    const [tokenAddress, minterAddress] = getRandomAddresses(2);
    await registry.addMinter(minterAddress);
    await expect(
      registry.connect(unregisteredFactory).register(tokenAddress, minterAddress)
    ).to.be.revertedWith('SRC20Registry: Caller not authorized factory');
  });

  it('Cannot add a token with unregistered minter', async () => {
    const [tokenAddress, minterAddress] = getRandomAddresses(2);
    await registry.addFactory(factory.address);
    await expect(
      registry.connect(factory).register(tokenAddress, minterAddress)
    ).to.be.revertedWith('SRC20Registry: Minter not authorized');
  });

  it('Cannot add a token if already registered', async () => {
    const { tokenAddress, minterAddress } = await addTokenToRegistry();
    await expect(
      registry.connect(factory).register(tokenAddress, minterAddress)
    ).to.be.revertedWith('SRC20Registry: Token already in registry');
  });

  it('Cannot unregister when not owner', async () => {
    const sender = await getAccount(10);
    const { tokenAddress } = await addTokenToRegistry();
    await expect(registry.connect(sender).unregister(tokenAddress)).to.be.revertedWith(
      MSG_ONLY_OWNER
    );
  });

  it('Cannot unregister an unregistered token', async () => {
    const tokenAddress = getRandomAddress();
    await expect(registry.connect(swarm).unregister(tokenAddress)).to.be.revertedWith(
      'SRC20Registry: Token not in registry'
    );
  });
});
