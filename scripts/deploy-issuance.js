require('dotenv').config({path: '.env'});
const {
  deployBaseContracts,
  getAccounts,
  dumpContractAddresses,
  deployTokenContracts,
  getBaseContractsOptions,
  getTokenContractsOptions,
  getFundraiserOptions,
} = require('./deploy-helpers');
const {stakeAndMint, distributeErc20, contribute, massContribute} = require('./token-helpers');

const {parseUnits} = ethers.utils;

const fundraiserOptions = {};

async function main() {
  const {accounts, addresses} = await getAccounts();

  const [swarmAddress, issuerAddress, ...contributors] = addresses;
  const baseContracts = await deployBaseContracts(await getBaseContractsOptions());
  const {usdc} = baseContracts;

  async function deployToken(customSrc20Options = {}) {
    const globalOptions = await getTokenContractsOptions();
    const options = {
      ...globalOptions,
      src20: {...globalOptions.src20, ...customSrc20Options},
    };
    const tokenContracts = await deployTokenContracts(baseContracts, options);
    return [{...baseContracts, ...tokenContracts}, options];
  }

  // 1. unminted token
  const [token1, token1Options] = await deployToken({
    name: 'Testing Token: Unminted',
    symbol: 'TT1',
  });
  console.log({token1});

  // 2. minted token
  const [token2, token2Options] = await deployToken({
    name: 'Testing Token: Minted',
    symbol: 'TT2',
  });
  await stakeAndMint(token2, token2Options.src20.nav, token2Options.src20.supply);

  // 3. fundraising token
  let [token3, token3Options] = await deployToken({
    name: 'Testing Token: Fundraising',
    symbol: 'TT3',
  });
  await distributeErc20(usdc, contributors, parseUnits(100, await usdc.decimals()));
  const fundraiserContracts3 = await deployFundraiserContracts(
    baseContracts,
    token2.src20,
    getFundraiserOptions()
  );
  token3 = {...token3, ...fundraiserContracts3};
  await massContribute(token3.fundraiser, contributors[0], [20, 10, 30, 50, 40]);
  await acceptContributors([contributors[1], contributors[3], contributors[4]]);

  // 4. fundraised token
  const token4 = await deployTokenContracts(baseContracts, {
    name: 'Testing Token: Fundraised',
    symbol: 'TT4',
  });

  console.log('----------------------');
  console.log('Prerequisites deployed');
  console.log(`Deployer address: ${swarmAddress}`);
  console.log(`Issuer address: ${issuerAddress}`);
  console.log('');
  dumpContractAddresses(baseContracts);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
