const { expect } = require('chai');
const {
  getAccount,
  getIssuer,
  getSwarm,
  deployContract,
  ZERO_ADDRESS,
} = require('../scripts/deploy-helpers');

const { getRandomAddress, getRandomAddresses } = require('./test-helpers');

const MSG_ONLY_OWNER = 'Ownable: caller is not the owner';

describe('SRC20Registry does the registering', async () => {
  let issuerAddress;
  let swarmAddress;
  let swm;
  let src20Registry;
  const swmSupply = 1000;

  beforeEach(async () => {
    issuerAddress = await (await getIssuer()).getAddress();
    swarmAddress = await (await getSwarm()).getAddress();
    swm = await deployContract('SwarmTokenMock', [swarmAddress, swmSupply]);
    src20Registry = await deployContract('SRC20Registry', [swm.address]);
  });

  // todo: cannot create with wrong constructors

  it('Cannot add or remove zero address factory', async () => {
    await expect(src20Registry.addFactory(ZERO_ADDRESS)).to.be.revertedWith(
      'account is zero address'
    );
    await expect(src20Registry.removeFactory(ZERO_ADDRESS)).to.be.revertedWith(
      'account is zero address'
    );
  });

  it('Does not contain a random token', async () => {
    const address = getRandomAddress();
    expect(await src20Registry.contains(address)).to.equal(false);
  });

  it('Can add and remove factory', async () => {
    const address = getRandomAddress();
    await expect(src20Registry.addFactory(address))
      .to.emit(src20Registry, 'FactoryAdded')
      .withArgs(address);

    expect(await src20Registry.hasFactory(address)).to.equal(true);

    await expect(src20Registry.removeFactory(address))
      .to.emit(src20Registry, 'FactoryRemoved')
      .withArgs(address);
    expect(await src20Registry.hasFactory(address)).to.equal(false);
  });

  it('Only allows owner to add a factory', async () => {
    const [sender] = await getAccount(10);
    await expect(src20Registry.connect(sender).addFactory(getRandomAddress())).to.be.revertedWith(
      MSG_ONLY_OWNER
    );
  });

  it('Only allows owner to remove a factory', async () => {
    const [sender] = await getAccount(10);
    await expect(
      src20Registry.connect(sender).removeFactory(getRandomAddress())
    ).to.be.revertedWith(MSG_ONLY_OWNER);
  });

  it('Can add and remove minters', async () => {
    const address = getRandomAddress();
    await expect(src20Registry.addMinter(address))
      .to.emit(src20Registry, 'MinterAdded')
      .withArgs(address);

    expect(await src20Registry.hasMinter(address)).to.equal(true);

    await expect(src20Registry.removeMinter(address))
      .to.emit(src20Registry, 'MinterRemoved')
      .withArgs(address);
    expect(await src20Registry.hasMinter(address)).to.equal(false);
  });

  it('Only allows owner to add a minters', async () => {
    const [sender] = await getAccount(10);
    await expect(src20Registry.connect(sender).addMinter(getRandomAddress())).to.be.revertedWith(
      MSG_ONLY_OWNER
    );
  });

  it('Only allows owner to remove a minters', async () => {
    const [sender] = await getAccount(10);
    await expect(src20Registry.connect(sender).removeMinter(getRandomAddress())).to.be.revertedWith(
      MSG_ONLY_OWNER
    );
  });

  it('Cannot add a token with wrong parameters', async () => {
    const params = getRandomAddresses(4);
    let p;

    p = [...params];
    p[0] = ZERO_ADDRESS;
    await expect(src20Registry.put(...p)).to.be.revertedWith('token is zero address');

    p = [...params];
    p[1] = ZERO_ADDRESS;
    await expect(src20Registry.put(...p)).to.be.revertedWith('roles is zero address');

    p = [...params];
    p[2] = ZERO_ADDRESS;
    await expect(src20Registry.put(...p)).to.be.revertedWith('tokenOwner is zero address');
  });

  it('Cannot add a token without registered factory', async () => {
    const params = getRandomAddresses(4);
    await expect(src20Registry.put(...params)).to.be.revertedWith('factory not registered');
  });

  it('Cannot add a token without authorized minters', async () => {
    // sender pretends he's the factory
    const [sender, senderAddress] = await getAccount();
    const params = getRandomAddresses(4);
    await src20Registry.addFactory(senderAddress);
    await expect(src20Registry.put(...params)).to.be.revertedWith('minter not authorized');
  });

  async function addTokenToRegistry() {
    const [sender, senderAddress] = await getAccount();
    const minterAddress = getRandomAddress();
    const params = [...getRandomAddresses(3), minterAddress];
    const [tokenAddress] = params;
    await src20Registry.addFactory(senderAddress);
    await src20Registry.addMinter(minterAddress);

    await expect(src20Registry.put(...params))
      .to.emit(src20Registry, 'SRC20Registered')
      .withArgs(tokenAddress, params[2]);

    return { tokenAddress, minterAddress };
  }

  it('Can put and remove a token', async () => {
    const { tokenAddress, minterAddress } = await addTokenToRegistry();
    expect(await src20Registry.contains(tokenAddress)).to.equal(true);
    expect(await src20Registry.getMinter(tokenAddress)).to.equal(minterAddress);
    await expect(src20Registry.remove(tokenAddress))
      .to.emit(src20Registry, 'SRC20Removed')
      .withArgs(tokenAddress);

    expect(await src20Registry.contains(tokenAddress)).to.equal(false);
  });

  it('Only allows owner to remove token', async () => {
    const [sender, senderAddress] = await getAccount(10);
    const { tokenAddress } = await addTokenToRegistry();
    await expect(src20Registry.connect(sender).remove(tokenAddress)).to.be.revertedWith(
      MSG_ONLY_OWNER
    );
  });

  // manager stuff
});
