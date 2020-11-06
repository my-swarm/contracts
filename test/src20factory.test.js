const {
  getIssuer,
  deployBaseContracts,
  getSrc20Options,
  createSrc20,
} = require('../scripts/deploy-helpers');

function getRandomAddress() {
  const chars = '012345679abcdef';
  let result = '0x';
  for (let i = 0; i < 40; i++) {
    result += chars[Math.floor(Math.random() * chars.length)];
  }
  return result;
}

function getRandomAddresses(count) {
  let result = [];
  for (let i = 0; i < count; i++) result.push(getRandomAddress());
  return result;
}

describe('SRC20Factory creates tokens', async () => {
  let baseContracts;
  let issuerAddress;

  before(async () => {
    baseContracts = (await deployBaseContracts())[0];
    console.log(Object.keys(baseContracts));
    issuerAddress = (await getIssuer()).getAddress();
  });

  it('tests shit', async () => {
    const { src20Factory } = baseContracts;
    const options = getSrc20Options();
    const addresses = [issuerAddress, ...getRandomAddresses(5)];
    const src20 = await createSrc20(src20Factory, options, addresses);
    console.log(src20);
  });

  // before: deploy registry, asset registry, factory

  // call factory.create
  // check that it emmited SRC20Created
  // check that it emmited
});
