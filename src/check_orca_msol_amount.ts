import { PublicKey, Connection } from "@solana/web3.js";
import fetch from "node-fetch";
import { AccountFetcher } from "@orca-so/whirlpools-sdk";
import { DecimalUtil } from "@orca-so/common-sdk";
import Decimal from "decimal.js";

// use your prefer RPC server
const RPC = "https://rpc.ankr.com/solana";

const MSOL_MINT = new PublicKey("mSoLzYCxHdYgdzU16g5QSh3i5K3z3KZK7ytfqcJm7So");
const MSOL_DECIMALS = 9;
const V1_WHIRLPOOL_LIST = "https://api.mainnet.orca.so/v1/whirlpool/list";

export type WhirlpoolListEntry = {
  address: PublicKey,
  name: string,
  mintA: PublicKey,
  mintB: PublicKey,
}

export async function getWhirlpoolList(): Promise<WhirlpoolListEntry[]> {
  const response = await (await fetch(V1_WHIRLPOOL_LIST)).json();
  return response.whirlpools.map((p) => ({
    address: new PublicKey(p.address),
    name: `${p.tokenA.symbol}/${p.tokenB.symbol}(${p.tickSpacing})`,
    mintA: new PublicKey(p.tokenA.mint),
    mintB: new PublicKey(p.tokenB.mint),
  }));
}

async function main() {
  const connection = new Connection(RPC);
  const fetcher = new AccountFetcher(connection);

  // get the list of whirlpools
  const whirlpools = await getWhirlpoolList();

  // filter: mSOL is tokenA or tokenB
  const msolWhirlpools: { whirlpool: WhirlpoolListEntry, aIsMSOL: boolean, vault?: PublicKey }[] = [];
  for (const whirlpool of whirlpools) {
    const aIsMSOL = whirlpool.mintA.equals(MSOL_MINT);
    const bIsMSOL = whirlpool.mintB.equals(MSOL_MINT);
    if (!aIsMSOL && !bIsMSOL) continue;
    msolWhirlpools.push({whirlpool, aIsMSOL});
  }

  // fetch whirlpool data to resolve the address of mSOL vault
  const whirlpoolDatas = await fetcher.listPools(msolWhirlpools.map((p) => p.whirlpool.address), true);
  msolWhirlpools.forEach((p, i) => {
    p.vault = p.aIsMSOL ? whirlpoolDatas[i].tokenVaultA : whirlpoolDatas[i].tokenVaultB;
  });

  // get the amount of mSOL of the vaults
  const vaults = await fetcher.listTokenInfos(msolWhirlpools.map((p) => p.vault), true);

  // print result
  let msolTotalAmount = new Decimal(0);
  msolWhirlpools.forEach((p, i) => {
    const amountU64 = vaults[i].amount;
    const amount = DecimalUtil.fromU64(amountU64, MSOL_DECIMALS);
    msolTotalAmount = msolTotalAmount.add(amount);

    console.log(
      p.whirlpool.name.padEnd(18, " "),
      "has",
      amount.toString().padStart(16, " "),
      "mSOL",
      `vault: ${p.vault.toBase58()}`
    );
  })

  console.log("\n>> Orca has total", msolTotalAmount, "mSOL !", `@${new Date().toISOString()}`);
}

main();

/*

SAMPLE OUTPUT

$ ts-node src/check_orca_msol_amount.ts 
SOL/mSOL(1)        has   10870.01673038 mSOL vault: EWWSKcyMy2cF1RBmcQMPyN8SafyxoUFzmzWsAqReNmQc
mSOL/stSOL(1)      has   3294.706965886 mSOL vault: 9Df9uU6sX9WAQFXNAiJCC3GzYTyitFNSf6SVRr1LjC8s
mSOL/USDC(64)      has   6330.235435801 mSOL vault: 7BgpVo7LDk5MJ29K7p5xbbRASgZ1Q2PhkkHQnKUbZvfj
USDH/mSOL(64)      has   1169.798543147 mSOL vault: CEtPaTBXmn2zDEx1w2xt12ZxfcKWLBKzumeHCFNSuCmW
mSOL/JITOSOL(1)    has   3287.801213069 mSOL vault: 5GRMjT68F4QETNuVP3d3e7MkJGx6YLRSfuj6vh2xvoLW
mSOL/USDT(64)      has   1054.112983568 mSOL vault: 7DZbXiG9eeK3xUPMSDSsUHHps9uxh1X3EQ13jF9SGXb6
mSOL/whETH(64)     has   1920.080638124 mSOL vault: 3cfBqXmGKTVqZDf4vRDFM5Y1g5K5hPU4UQQ8r6XxYRHm
MNDE/mSOL(128)     has    144.279845328 mSOL vault: 4Qjvea5ZkYZoN1QLQDJ1rRxXyTj91ftkmoNDNCyTbC8t
MNDE/mSOL(64)      has      0.689916711 mSOL vault: D45cfQe4ea1VgvAHawDd2Zyegg91FY6VQ1FdnrM6rTHc
mSOL/ORCA(128)     has                0 mSOL vault: DpvP88sHHuTVyiJuA4CRrjifKHZz6fmmurYHEdiXA6n1
LAINESOL/mSOL(1)   has      0.000000001 mSOL vault: AqnEqe82R49ntFYFpSm1QdpFkGJmBxqFi4tKRqJNf2E4
SOL/mSOL(128)      has      0.000000001 mSOL vault: 9YoaZ21opFQgG51ufps9euxjXtst1cDNsYBi4u2qQYAH
mSOL/wUST(64)      has      5.606818586 mSOL vault: 2UawJUySBhKyPocu5g53oABooipfr7ESx7DTbStytjT3
mSOL/USDC(8)       has      1.034142437 mSOL vault: 9YKE7tGczTk5APgamRCJHw1SP9ySHJB7Ltu8xe4P5RF2
mSOL/JITOSOL(128)  has      0.000000001 mSOL vault: 6BWTCfgCjBpHbuDJ32yRGF7X4nS4hFb3NGEvidY4YLdB
mSOL/BONK(128)     has      0.000000001 mSOL vault: A8EZumXAbQAog7v66JaMbnpkEumk3zHP4oeJcoXAgiyX
mSOL/USH(64)       has      0.000029612 mSOL vault: ADMxMHiiPqbYxrmvfUzzMziALHszNwTXZSU3NuHBFXQF
BSOL/mSOL(1)       has      0.018495083 mSOL vault: 4eXzAtWvA3XsXJxJ1GDi3zGc2ihsUCyJGDD5fxP7vABV
mSOL/UXD(64)       has                0 mSOL vault: 8WMa12M9A41R3tpkoQsY3m15ASDKzBw2c7MQvkjJirh1
mSOL/MATICPO(64)   has      0.000000741 mSOL vault: DVYNAmqZnGYWywYWsy9Y4iFE1TqBYXZDSyqcawVPh18U
USDH/mSOL(8)       has      0.000011328 mSOL vault: GawhecLDJ4SGAmh5fHhvkLzKeHSy4x28uZfkLzaFxaDL
mSOL/ARB(64)       has      0.000520695 mSOL vault: 48PAro52wMaSCnPQ2deJfhpCuTTsXEPQ4UNWA9hgErWX
mSOL/stSOL(64)     has      0.000000001 mSOL vault: 7JdnDpy1RY2PYBybnvTLi2xhPJ6Fm1urWydnpL8aaEUE
SOL/mSOL(64)       has                0 mSOL vault: GUmeH2s5ZKUFrLxUpmurekH6UzarshxidpfGCoKaut26
mSOL/BTC(64)       has     57.864836851 mSOL vault: 3wJ4YbBbnr9CNEoQsCvT9KNW54Et9XcxW5d2Eotizc8p
mSOL/BONK(64)      has      0.000000001 mSOL vault: 2APUKT5Kmhs59Miu2pdML8Z3YNrgQDA8JgyUV6hjLvKK
mSOL/JITOSOL(64)   has      0.656660519 mSOL vault: HXpDfay1Kx2u4yAs7FnGAVyVsoWT8PZvsc4KGxF8Qh6t
mSOL/ORCA(1)       has      0.000000001 mSOL vault: Cn4onREoEBTGiLRdZWVXwWJ5pBN55YEApPUBU3QdMjDt
SOL/mSOL(8)        has      0.000023781 mSOL vault: H7Bd4E4JjjjYtgbJDcW9v6QLvdRw1pUmeU8b1NszYNJb

>> Orca has total 28136.903811654 mSOL ! @2023-01-26T16:23:14.340Z

*/