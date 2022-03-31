import { NerveEventPool } from "./nerve-pool";
import { ThreePool } from "./pools/Three-pool";

export abstract class NerveEventMetapool extends NerveEventPool {
  basePool: ThreePool;

  constructor(
    public dexKey: string,
    protected web3Provider: Web3,
    protected network: number,
    public poolConfig: NervePoolConfig,
    BasePool: new (
      name: string,
      web3Provider: any,
      network: number,
    ) => ThreePool,
    protected trackCoins: boolean = true,
  ) {
    super(dexKey, web3Provider, network, poolConfig, trackCoins);
    this.basePool = new BasePool(
      this.poolConfig.name,
      this.web3Provider,
      this.network,
    );
  }
}
