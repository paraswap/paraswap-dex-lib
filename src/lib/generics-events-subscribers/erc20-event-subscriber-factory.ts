import { IDexHelper } from '../../dex-helper';
import { Address } from '../../types';
import { ERC20EventSubscriber } from './erc20-event-subscriber';

const subscriberMap: Record<Address, ERC20EventSubscriber> = {};

export const getERC20Subscriber = (dexHelper: IDexHelper, token: string) => {
  token = token.toLowerCase();
  const identifier = `${dexHelper.config.data.network}-${token}`;
  if (identifier in subscriberMap) {
    return subscriberMap[identifier];
  }

  const sub = new ERC20EventSubscriber(dexHelper, token);
  subscriberMap[identifier] = sub;

  return sub;
};
