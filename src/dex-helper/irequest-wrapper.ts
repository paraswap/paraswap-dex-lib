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
}
