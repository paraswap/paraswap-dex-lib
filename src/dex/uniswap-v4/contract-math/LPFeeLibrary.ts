import { _require } from '../../../utils';

export class LPFeeLibrary {
  static readonly DYNAMIC_FEE_FLAG: number = 0x800000;
  static readonly OVERRIDE_FEE_FLAG: number = 0x400000;
  static readonly REMOVE_OVERRIDE_MASK: number = 0xbfffff;
  static readonly MAX_LP_FEE: number = 1000000;

  static isDynamicFee(fee: number): boolean {
    return fee === this.DYNAMIC_FEE_FLAG;
  }

  static isValid(fee: number): boolean {
    return fee <= this.MAX_LP_FEE;
  }

  static validate(fee: number): void {
    _require(this.isValid(fee), `LPFeeTooLarge: ${fee}`, { fee });
  }

  static getInitialLPFee(fee: number): number {
    return this.isDynamicFee(fee) ? 0 : (this.validate(fee), fee);
  }

  static isOverride(fee: number): boolean {
    return (fee & this.OVERRIDE_FEE_FLAG) !== 0;
  }

  static removeOverrideFlag(fee: number): number {
    return fee & this.REMOVE_OVERRIDE_MASK;
  }

  static removeOverrideFlagAndValidate(fee: number): number {
    const newFee = this.removeOverrideFlag(fee);
    this.validate(newFee);
    return newFee;
  }
}
