import { NumberAsString } from '@paraswap/core';
import { assert } from 'console';
import { _require } from '../../../utils';
import { LinkedlistData } from '../types';

export class LinkedList {
  static remove(
    data: Record<NumberAsString, LinkedlistData>,
    removedValue: bigint,
  ): bigint {
    _require(Number(removedValue) in data, 'non exist value');
    let node = data[Number(removedValue)];

    if (node.previous == removedValue) return removedValue;
    let ret = node.previous;
    if (node.next == removedValue) return ret;
    data[Number(node.previous)].next = node.next;
    data[Number(node.next)].previous = node.previous;
    delete data[Number(removedValue)];
    return ret;
  }

  static insert(
    data: Record<NumberAsString, LinkedlistData>,
    newValue: bigint,
    lowerValue: bigint,
    nextValue: bigint,
  ): void {
    data[Number(newValue)] = {
      previous: lowerValue,
      next: nextValue,
    };

    if (!data[Number(nextValue)]) {
      data[Number(nextValue)] = {
        next: 0n,
        previous: 0n,
      };
    }

    if (!data[Number(lowerValue)]) {
      data[Number(lowerValue)] = {
        next: 0n,
        previous: 0n,
      };
    }

    data[Number(nextValue)].previous = newValue;
    data[Number(lowerValue)].next = newValue;
  }
}
