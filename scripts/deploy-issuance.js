const moment = require('moment');
require('dotenv').config({ path: '.env' });
const {
  deployContract,
  deployBaseContracts,
  getAddresses,
  dumpContractAddresses,
  deployTokenContracts,
  deployFundraiserContracts,
  advanceTimeAndBlock,
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
  removeContributors,
  refund,
} = require('./token-helpers');

const { exportBaseContractAddresses, exportTokenContractAddresses } = require('./export-helpers');

const { parseUnits } = ethers.utils;

const fundraiserOptions = {};

async function main() {
  const [swarm, issuer, ...contributors] = await ethers.getSigners();
  const [baseContracts, baseContractsOptions] = await deployBaseContracts();
  const { usdc } = baseContracts;
  const [swarmAddress, issuerAddress, ...ca] = await getAddresses();

  async function deployToken(customSrc20Options = {}, customOptions = {}) {
    const options = {
      src20: customSrc20Options,
      ...customOptions,
    };
    const [tokenContracts, outputOptions] = await deployTokenContracts(baseContracts, options);
    return [{ ...baseContracts, ...tokenContracts }, outputOptions];
  }

  // 1. unminted token
  const [token1, token1Options] = await deployToken({
    name: 'Testing Token: Unminted',
    symbol: 'TT1',
  });

  // 2. whitelist token
  const [token2, token2Options] = await deployToken(
    {
      name: 'Testing Token: Minted with Whitelist',
      symbol: 'TT2',
    },
    { transferRules: true }
  );
  await stakeAndMint(token2, token2Options.src20.nav, token2Options.src20.maxSupply.div(2));
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

  // 3. graylist token
  const [token3, token3Options] = await deployToken(
    {
      name: 'Testing Token: Minted with Greylist',
      symbol: 'TT3',
    },
    { transferRules: true, features: 5 }
  );
  await stakeAndMint(token3, token3Options.src20.nav, token3Options.src20.maxSupply.div(2));
  await updateAllowance(issuer, token3.swm, token3.src20Registry.address, -1); // unlimited allowance to simplify

  await updateAllowance(issuer, token3.src20, issuerAddress, -1); // also allow myself to spend src for bulk
  await bulkTransfer(token3, ca.slice(0, 8), [5000, 2000, 3000, 4000, 5000, 1000, 1000, 1000]);
  await greylist(token3, ca.slice(0, 8));
  await ungreylist(token3, [ca[3], ca[4]]);
  await greylist(token3, ca[3]);
  await transferToken(token3.src20, contributors[0], ca[1], 200);
  await transferToken(token3.src20, contributors[0], ca[2], 300);
  await transferToken(token3.src20, contributors[0], ca[3], 400);
  await transferToken(token3.src20, contributors[0], ca[5], 500);
  await transferToken(token3.src20, contributors[0], ca[6], 500);
  await transferToken(token3.src20, contributors[0], ca[6], 100);
  await transferToken(token3.src20, contributors[0], ca[7], 500);
  await approveTransfer(token3, 2);
  await denyTransfer(token3, 3);

  // 4. fundraising token
  let [token4, token4Options] = await deployToken({
    name: 'Testing Token: Fundraising',
    symbol: 'TT4',
  });
  await distributeToken(swarm, usdc, ca, 1000);
  const [fundraiserContracts4, fundraiserOptions4] = await deployFundraiserContracts(
    {
      ...baseContracts,
      ...token4,
    },
    { affiliateManager: true, endDate: moment().add(10, 'month').unix() }
  );
  token4 = { ...token4, ...fundraiserContracts4 };
  // day 1
  await contribute(token4, contributors[0], 200);
  await contribute(token4, contributors[1], 100);
  // day 2
  advanceTimeAndBlock(24 * 3600);
  await contribute(token4, contributors[2], 300);
  await contribute(token4, contributors[3], 500);
  await acceptContributors(token4, [ca[0], ca[1], ca[2]]);
  // day 3
  advanceTimeAndBlock(24 * 3600);
  await contribute(token4, contributors[4], 400);
  await contribute(token4, contributors[5], 500);
  await acceptContributors(token4, [ca[3], ca[5]]);
  await removeContributors(token4, [ca[4]]);
  // day 4
  advanceTimeAndBlock(24 * 3600);
  await contribute(token4, contributors[6], 500);
  await contribute(token4, contributors[7], 500);
  await removeContributors(token4, [ca[5]]);
  // day 5
  advanceTimeAndBlock(24 * 3600);
  await contribute(token4, contributors[8], 500);
  await contribute(token4, contributors[9], 500);
  await acceptContributors(token4, [ca[4], ca[7]]);
  // day 6
  advanceTimeAndBlock(24 * 3600);
  await removeContributors(token4, [ca[6]]);
  await refund(token4, contributors[3]);

  await acceptContributors(token4, ca.slice(10, 20));

  // day 8
  advanceTimeAndBlock(2 * 24 * 3600);
  await contribute(token4, contributors[10], 700);
  await contribute(token4, contributors[11], 400);
  // day 9
  advanceTimeAndBlock(24 * 3600);
  await contribute(token4, contributors[12], 800);
  // day 11
  advanceTimeAndBlock(2 * 24 * 3600);
  await contribute(token4, contributors[13], 700);
  // day 14
  advanceTimeAndBlock(3 * 24 * 3600);
  await contribute(token4, contributors[14], 400);
  await contribute(token4, contributors[15], 700);
  // day 15
  advanceTimeAndBlock(24 * 3600);
  await contribute(token4, contributors[16], 1000);
  // day 18
  advanceTimeAndBlock(3 * 24 * 3600);
  await contribute(token4, contributors[17], 300);
  // contributors[17] is the last one

  // expected result:
  // 0, 1, 2, 7: qualified
  // 4, 5, 6: removed
  // 3: refunded
  // 8, 9: pending
  // total qualified: 200 + 100 + 300 + 500 = 1100
  // total pending: 500 + 500 = 1000
  // total refunded: 400 + 500 + 500 + 500 = 1900

  // 5. fundraised token
  let [token5] = await deployToken({
    name: 'Testing Token: Fundraised',
    symbol: 'TT5',
  });
  await distributeToken(swarm, usdc, ca, 1000);
  const [fundraiserContracts5] = await deployFundraiserContracts({
    ...baseContracts,
    ...token5,
  });
  token5 = { ...token5, ...fundraiserContracts5 };
  await massContribute(
    token5,
    contributors,
    contributors.map((x) => 500)
  );
  await acceptContributors(token5, ca);
  await advanceTimeAndBlock(40 * 24 * 3600); // make sure we are after end date

  console.log('----------------------');
  console.log('Prerequisites deployed');
  console.log(`Deployer address: ${swarm.address}`);
  console.log(`Issuer address: ${issuer.address}`);
  console.log('');
  dumpContractAddresses(baseContracts);
  exportBaseContractAddresses(baseContracts);
  exportTokenContractAddresses('token1', token1);
  exportTokenContractAddresses('token2', token2);
  exportTokenContractAddresses('token3', token3);
  exportTokenContractAddresses('token4', token4);
  exportTokenContractAddresses('token5', token5);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
