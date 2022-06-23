// Rename util from here https://stackoverflow.com/questions/52702461/rename-key-of-typescript-object-type
export type Rename<T, K extends keyof T, N extends string> = Pick<
  T,
  Exclude<keyof T, K>
> &
  { [P in N]: T[K] };
