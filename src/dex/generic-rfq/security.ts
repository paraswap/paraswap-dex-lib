import {
  RequestConfig,
  RequestHeaders,
} from '../../dex-helper/irequest-wrapper';
import { createHmac } from 'crypto';
import { RFQSecret } from './types';

function authByParams(
  url: string,
  method: string,
  body: any,
  secret: RFQSecret,
): RequestHeaders {
  const headers: RequestHeaders = {};
  const timestamp = Date.now().toString();

  const _url = new URL(url);

  const payload = `${timestamp}${method.toUpperCase()}${_url.pathname}${
    _url.search
  }${method === 'POST' ? JSON.stringify(body) : ''}`;
  const signature = createHmac('sha256', secret.accessKey);
  signature.update(payload);

  headers['X-ACCESS-TIMESTAMP'] = timestamp;
  headers['X-ACCESS-SIGN'] = signature.digest('hex');

  return headers;
}

export const authHttp =
  (secret: RFQSecret) =>
  (options: RequestConfig): RequestConfig => {
    let { data: body, method, url } = options;
    if (!options.headers) {
      options.headers = {};
    }
    method = method || 'GET';
    if (!url) {
      throw new Error('missing url');
    }

    const headers = authByParams(url, body, method, secret);
    for (const [header, value] of Object.entries(headers)) {
      options.headers[header] = value;
    }

    options.headers['X-AUTH-DOMAIN'] = secret.domain;
    options.headers['X-AUTH-ACCESS-KEY'] = secret.accessKey;
    return options;
  };
