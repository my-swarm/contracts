require('dotenv').config({path: '.env'});
const {
  deployBaseContracts,
  getAddresses,
  dumpContractAddresses,
  deployTokenContracts,
  deployFundraiserContracts,
} = require('./deploy-helpers');
const {
  stakeAndMint,
  distributeToken,
  transferToken,
  bulkTransfer,
  updateAllowance,
  increaseSupply,
  decreaseSupply,
  whitelist,
  greylist,
  unwhitelist,
  ungreylist,
  approveTransfer,
  denyTransfer,
  contribute,
  massContribute,
  acceptContributors,
} = require('./token-helpers');

const {exportContractAddresses} = require('./export-helpers');

const {parseUnits} = ethers.utils;

const fundraiserOptions = {};

async function main() {
  const [swarm, issuer, ...contributors] = await ethers.getSigners();
  const [baseContracts, baseContractsOptions] = await deployBaseContracts();
  const {usdc} = baseContracts;
  const [swarmAddress, issuerAddress, ...ca] = await getAddresses();

  async function deployToken(customSrc20Options = {}, customOptions = {}) {
    const options = {
      src20: customSrc20Options,
      ...customOptions,
    };
    const [tokenContracts, outputOptions] = await deployTokenContracts(baseContracts, options);
    return [{...baseContracts, ...tokenContracts}, outputOptions];
  }

  // 1. unminted token
  const [token1, token1Options] = await deployToken({
    name: 'Testing Token: Unminted',
    symbol: 'TT1',
  });

  // 2. minted token
  const [token2, token2Options] = await deployToken(
    {
      name: 'Testing Token: Minted with Whitelist',
      symbol: 'TT2',
    },
    {transferRules: true}
  );
  await stakeAndMint(token2, token2Options.src20.nav, token2Options.src20.supply.div(2));
  await updateAllowance(issuer, token2.swm, token2.src20Registry.address, -1); // unlimited allowance to simplify
  // max supply is 1 million, 500k minted so far. After we should have 500 + 200 - 100 = 600
  await increaseSupply(token2, 200000);
  await decreaseSupply(token2, 100000);

  await whitelist(token2, ca.slice(0, 5));
  await unwhitelist(token2, [ca[2], ca[4]]);
  await whitelist(token2, ca[2]);
  await distributeToken(issuer, token2.src20, ca.slice(0, 4), 1000);
  await transferToken(token2.src20, contributors[0], ca[1], 200);
  await transferToken(token2.src20, contributors[0], ca[2], 300);
  await transferToken(token2.src20, contributors[1], ca[2], 100);

  const [token3, token3Options] = await deployToken(
    {
      name: 'Testing Token: Minted with Greylist',
      symbol: 'TT3',
    },
    {transferRules: true}
  );
  await stakeAndMint(token3, token3Options.src20.nav, token3Options.src20.supply.div(2));
  await updateAllowance(issuer, token3.swm, token3.src20Registry.address, -1); // unlimited allowance to simplify

  await updateAllowance(issuer, token3.src20, issuerAddress, -1); // also allow myself to spend src for bulk
  await bulkTransfer(token3, ca.slice(0, 5), [1000, 2000, 3000, 4000, 5000]);
  await greylist(token3, ca.slice(0, 5));
  await ungreylist(token3, [ca[3], ca[4]]);
  await greylist(token3, ca[3]);
  await transferToken(token3.src20, contributors[0], ca[1], 200);
  await transferToken(token3.src20, contributors[0], ca[2], 300);
  await transferToken(token3.src20, contributors[0], ca[3], 400);
  await approveTransfer(token3, 2);
  await denyTransfer(token3, 3);

  // 3. fundraising token
  let [token4, token4Options] = await deployToken({
    name: 'Testing Token: Fundraising',
    symbol: 'TT4',
  });
  await distributeToken(swarm, usdc, ca.slice(0, 5), 1000);
  const [fundraiserContracts4, fundraiserOptions4] = await deployFundraiserContracts({
    ...baseContracts,
    ...token4,
  });
  token4 = {...token4, ...fundraiserContracts4};
  await massContribute(token4, contributors.slice(0, 5), [200, 100, 300, 500, 400]);
  await acceptContributors(token4, [ca[1], ca[3], ca[4]]);

  /*
  // 4. fundraised token
  const [token5, token5Options] = await deployToken({
    name: 'Testing Token: Fundraised',
    symbol: 'TT5',
  });
*/
  console.log('----------------------');
  console.log('Prerequisites deployed');
  console.log(`Deployer address: ${swarm.address}`);
  console.log(`Issuer address: ${issuer.address}`);
  console.log('');
  dumpContractAddresses(baseContracts);
  exportContractAddresses('token1', token1);
  exportContractAddresses('token2', token2);
  exportContractAddresses('token3', token3);
  exportContractAddresses('token4', token4);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
