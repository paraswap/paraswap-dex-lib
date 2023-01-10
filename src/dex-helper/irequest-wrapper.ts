export type Method =
  | 'get'
  | 'GET'
  | 'delete'
  | 'DELETE'
  | 'head'
  | 'HEAD'
  | 'options'
  | 'OPTIONS'
  | 'post'
  | 'POST'
  | 'put'
  | 'PUT'
  | 'patch'
  | 'PATCH'
  | 'purge'
  | 'PURGE'
  | 'link'
  | 'LINK'
  | 'unlink'
  | 'UNLINK';

export type RequestHeaders = Record<string, string | number | boolean>;

export interface RequestConfig<D = any> {
  url?: string;
  method?: Method;
  headers?: RequestHeaders;
  params?: any;
  paramsSerializer?: (params: any) => string;
  data?: D;
  timeout?: number;
}

export interface Response<T = any> {
  data: T;
  status: number;
  statusText: string;
  headers: Record<string, string>;
  request?: any;
}

export interface IRequestWrapper {
  get<T>(
    url: string,
    timeout?: number,
    headers?: { [key: string]: string | number },
  ): Promise<T>;

  post<T = any>(
    url: string,
    data?: any,
    timeout?: number,
    headers?: { [key: string]: string | number },
  ): Promise<T>;

  request<T = any, R = Response<T>>(config: RequestConfig): Promise<R>;
}
