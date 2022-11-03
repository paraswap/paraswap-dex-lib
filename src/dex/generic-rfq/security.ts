import {
  RequestConfig,
  RequestHeaders,
} from '../../dex-helper/irequest-wrapper';
import { createHmac } from 'crypto';
import { RFQSecret } from './types';

function authByParams(
  body: any,
  method: string,
  path: string,
  secret: RFQSecret,
): RequestHeaders {
  const headers: RequestHeaders = {};
  const timestamp = Date.now().toString();
  const encodedURL = new URLSearchParams(
    Object.keys(body || {})
      .sort()
      .map(key => [key, body[key]]) as [string, any][],
  ).toString();
  const payload = timestamp + method.toUpperCase() + path + encodedURL;
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
    const pathName = new URL(url as string).pathname;
    const path = '/' + pathName.split('/').slice(-2).join('/');

    const headers = authByParams(body, method, path, secret);
    for (const [header, value] of Object.entries(headers)) {
      options.headers[header] = value;
    }

    options.headers['X-AUTH-DOMAIN'] = secret.domain;
    options.headers['X-AUTH-ACCESS-KEY'] = secret.accessKey;
    return options;
  };
