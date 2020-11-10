const { expect } = require('chai');
const {
  getAccount,
  getIssuer,
  getSwarm,
  deployContract,
  ZERO_ADDRESS,
} = require('../scripts/deploy-helpers');

const { REGEX_ADDR, getRandomAddress, getRandomAddresses } = require('./test-helpers');

const MSG_ONLY_OWNER = 'Ownable: caller is not the owner';
const FEATURE_TRANSFER = 1;
const FEATURE_PAUSABLE = 2;
const FEATURE_ACCOUNT_BURN = 4;
const FEATURE_ACCOUNT_FREEZE = 8;
const FEATURE_VALUES = [
  FEATURE_TRANSFER,
  FEATURE_PAUSABLE,
  FEATURE_ACCOUNT_BURN,
  FEATURE_ACCOUNT_FREEZE,
];

describe('Token features', async () => {
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

  it('Creates all right', async () => {
    const [owner, ownerAddress] = await getAccount();
    const featuresMap = 5;
    const features = await deployContract('Features', [ownerAddress, featuresMap]);
    expect(await features.owner()).to.equal(ownerAddress);
    expect(await features.features()).to.equal(featuresMap);
  });

  function getFeaturesMap(transfer, pausable, accountBurn, accountFreeze) {
    return (
      (transfer ? FEATURE_TRANSFER : 0) +
      (pausable ? FEATURE_PAUSABLE : 0) +
      (accountBurn ? FEATURE_ACCOUNT_BURN : 0) +
      (accountFreeze ? FEATURE_ACCOUNT_FREEZE : 0)
    );
  }

  async function deploy(featuresMap) {
    const [owner, ownerAddress] = await getAccount();
    return await deployContract('Features', [ownerAddress, featuresMap]);
  }

  it('Contructor sets features properly', async () => {
    for (let i = 0; i < 4; i++) {
      const featuresMap = FEATURE_VALUES[i];
      const features = await deploy(featuresMap);
      for (let j = 0; j < 4; j++) {
        expect(await features.isEnabled(FEATURE_VALUES[j])).to.equal(i === j);
      }
    }
  });

  it('Allows freezing and unfreezing accounts and does not allow transfer if accounts frozen', async () => {
    const addresses = getRandomAddresses(2);
    const features = await deploy(FEATURE_ACCOUNT_FREEZE);
    expect(await features.isAccountFrozen(addresses[0])).to.equal(false);
    expect(await features.checkTransfer(addresses[0], addresses[1])).to.equal(true);
    await features.freezeAccount(addresses[0]);
    expect(await features.isAccountFrozen(addresses[0])).to.equal(true);
    expect(await features.checkTransfer(addresses[0], addresses[1])).to.equal(false);
    await features.unfreezeAccount(addresses[0]);
    expect(await features.isAccountFrozen(addresses[0])).to.equal(false);
    await features.freezeAccount(addresses[1]);
    expect(await features.checkTransfer(addresses[0], addresses[1])).to.equal(false);
    await features.unfreezeAccount(addresses[1]);
    expect(await features.checkTransfer(addresses[0], addresses[1])).to.equal(true);
  });

  it('Allows pausing contract and does not allow transfers if paused', async () => {
    const addresses = getRandomAddresses(2);
    const features = await deploy(FEATURE_PAUSABLE);
    expect(await features.checkTransfer(addresses[0], addresses[1])).to.equal(true);
    await features.pauseToken();
    expect(await features.paused()).to.equal(true);
    expect(await features.checkTransfer(addresses[0], addresses[1])).to.equal(false);
    await features.unpauseToken();
    expect(await features.paused()).to.equal(false);
    expect(await features.checkTransfer(addresses[0], addresses[1])).to.equal(true);
  });
});
