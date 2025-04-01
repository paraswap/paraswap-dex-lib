export class ProtocolFeeLibrary {
  static readonly MAX_PROTOCOL_FEE: number = 1000;
  static readonly FEE_0_THRESHOLD: number = 1001;
  static readonly FEE_1_THRESHOLD: number = 1001 << 12;
  static readonly PIPS_DENOMINATOR: number = 1_000_000;

  static getZeroForOneFee(protocolFee: number): number {
    return protocolFee & 0xfff;
  }

  static getOneForZeroFee(protocolFee: number): number {
    return protocolFee >> 12;
  }

  static isValidProtocolFee(protocolFee: number): boolean {
    let isZeroForOneFeeOk =
      (protocolFee & 0xfff) < ProtocolFeeLibrary.FEE_0_THRESHOLD;
    let isOneForZeroFeeOk =
      (protocolFee & 0xfff000) < ProtocolFeeLibrary.FEE_1_THRESHOLD;
    return isZeroForOneFeeOk && isOneForZeroFeeOk;
  }

  static calculateSwapFee(protocolFee: number, lpFee: number): number {
    protocolFee &= 0xfff;
    lpFee &= 0xffffff;
    let numerator = protocolFee * lpFee;
    return (
      protocolFee +
      lpFee -
      Math.floor(numerator / ProtocolFeeLibrary.PIPS_DENOMINATOR)
    );
  }
}
