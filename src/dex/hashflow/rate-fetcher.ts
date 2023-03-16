import { IDexHelper } from '../../dex-helper';
import Fetcher from '../../lib/fetcher/fetcher';
import { validateAndCast } from '../../lib/validators';

import { Logger } from '../../types';
import { HashflowRateFetcherConfig, HashflowRatesResponse } from './types';
import { pricesResponse } from './validators';

export class RateFetcher {
  private rateFetcher: Fetcher<HashflowRatesResponse>;

  constructor(
    private dexHelper: IDexHelper,
    private dexKey: string,
    private logger: Logger,
    config: HashflowRateFetcherConfig,
  ) {
    this.rateFetcher = new Fetcher<HashflowRatesResponse>(
      dexHelper.httpRequest,
      {
        info: {
          requestOptions: config.rateConfig.reqParams,
          caster: (data: unknown) => {
            return validateAndCast<HashflowRatesResponse>(data, pricesResponse);
          },
        },
        handler: this.handleRatesResponse.bind(this),
      },
      config.rateConfig.intervalMs,
      logger,
    );
  }

  start() {
    this.rateFetcher.startPolling();
  }

  stop() {
    this.rateFetcher.stopPolling();
  }

  private handleRatesResponse(resp: HashflowRatesResponse) {}

  checkHealth(): boolean {
    return this.rateFetcher.lastFetchSucceeded;
  }
}
