import dotenv from 'dotenv';
dotenv.config();

import { MaverickPoolMath } from './maverick-pool-math';

jest.setTimeout(50 * 1000);

dotenv.config();
// Token A is a 18 decimal token
// Token B is a 6 decimal token
describe('Inch Test', () => {
  it.only('swap tokenA for B with out exact out', async () => {
    try {
      const pool = new MaverickPoolMath(
        'Maverick',
        BigInt((0.3 / 100) * 1e18),
        BigInt(953),
        BigInt(0),
      );

      const [, output] = pool.swap(
        {
          activeTick: 1n,
          binCounter: 16n,
          bins: {
            '1': {
              reserveA: 497483862887020288n,
              reserveB: 0n,
              kind: 2n,
              lowerTick: -8n,
              mergeId: 0n,
            },
            '2': {
              reserveA: 497483862887020288n,
              reserveB: 601955474093294592000000000000n,
              kind: 2n,
              lowerTick: 1n,
              mergeId: 0n,
            },
            '3': {
              reserveA: 0n,
              reserveB: 601955474093294592000000000000n,
              kind: 2n,
              lowerTick: 4n,
              mergeId: 0n,
            },
            '4': {
              reserveA: 204096294304391520n,
              reserveB: 0n,
              kind: 0n,
              lowerTick: -7n,
              mergeId: 0n,
            },
            '5': {
              reserveA: 988635599394593504n,
              reserveB: 1196249075267458226326064162896n,
              kind: 0n,
              lowerTick: 1n,
              mergeId: 0n,
            },
            '6': {
              reserveA: 0n,
              reserveB: 246956516108313792000000000000n,
              kind: 0n,
              lowerTick: 6n,
              mergeId: 0n,
            },
            '7': {
              reserveA: 784539305090201984n,
              reserveB: 0n,
              kind: 0n,
              lowerTick: -1n,
              mergeId: 0n,
            },
            '8': {
              reserveA: 0n,
              reserveB: 949292559159144576000000000000n,
              kind: 0n,
              lowerTick: 7n,
              mergeId: 0n,
            },
            '9': {
              reserveA: 242248889019272896n,
              reserveB: 0n,
              kind: 1n,
              lowerTick: -9n,
              mergeId: 0n,
            },
            '10': {
              reserveA: 340606509825846240n,
              reserveB: 412133876889273980196333938548n,
              kind: 1n,
              lowerTick: 1n,
              mergeId: 0n,
            },
            '11': {
              reserveA: 0n,
              reserveB: 293121155713320256000000000000n,
              kind: 1n,
              lowerTick: 9n,
              mergeId: 0n,
            },
            '12': {
              reserveA: 401225937191387328n,
              reserveB: 0n,
              kind: 3n,
              lowerTick: -3n,
              mergeId: 0n,
            },
            '13': {
              reserveA: 401225937191387316n,
              reserveB: 485483384001578688000000000000n,
              kind: 3n,
              lowerTick: 1n,
              mergeId: 0n,
            },
            '14': {
              reserveA: 0n,
              reserveB: 485483384001578688000000000000n,
              kind: 3n,
              lowerTick: 4n,
              mergeId: 0n,
            },
            '15': {
              reserveA: 98357620806573344n,
              reserveB: 0n,
              kind: 1n,
              lowerTick: -8n,
              mergeId: 0n,
            },
            '16': {
              reserveA: 0n,
              reserveB: 119012721175953760000000000000n,
              kind: 1n,
              lowerTick: 7n,
              mergeId: 0n,
            },
          },
          binPositions: {
            '1': { '0': 5n, '1': 10n, '2': 2n, '3': 13n },
            '4': { '2': 3n, '3': 14n },
            '6': { '0': 6n },
            '7': { '0': 8n, '1': 16n },
            '9': { '1': 11n },
            '-8': { '1': 15n, '2': 1n },
            '-7': { '0': 4n },
            '-1': { '0': 7n },
            '-9': { '1': 9n },
            '-3': { '3': 12n },
          },
          binMap: {
            '0': 138261823728n,
            '-1': 7463162598112715418867754100145796611164620634624434827815830738677402697728n,
          },
        },
        1850163333337788672n,
        true,
        false,
      );

      expect(output).toBe(1676945827577881677n);

      expect(output / BigInt(1e12)).toBe(1676945n);
    } catch (e) {
      console.log(e);
    }
  });

  it.only('swap tokenB for A with out exact out', async () => {
    try {
      const pool = new MaverickPoolMath(
        'Maverick',
        BigInt((0.3 / 100) * 1e18),
        BigInt(953),
        BigInt(15),
      );

      const [, output] = pool.swap(
        {
          activeTick: 1n,
          binCounter: 18n,
          bins: {
            '1': {
              reserveA: 36455272596522751n,
              reserveB: 0n,
              kind: 2n,
              lowerTick: -8n,
              mergeId: 0n,
            },
            '2': {
              reserveA: 1597760289074763328n,
              reserveB: 200494651188877308086402554219n,
              kind: 2n,
              lowerTick: 1n,
              mergeId: 0n,
            },
            '3': {
              reserveA: 0n,
              reserveB: 601955474093294592000000000000n,
              kind: 2n,
              lowerTick: 4n,
              mergeId: 0n,
            },
            '4': {
              reserveA: 152321218072163223n,
              reserveB: 0n,
              kind: 0n,
              lowerTick: -7n,
              mergeId: 0n,
            },
            '5': {
              reserveA: 8441278100329328224n,
              reserveB: 1059252204405390821020543785987n,
              kind: 0n,
              lowerTick: 1n,
              mergeId: 0n,
            },
            '6': {
              reserveA: 0n,
              reserveB: 92625772049616308793229705215n,
              kind: 0n,
              lowerTick: 6n,
              mergeId: 0n,
            },
            '7': {
              reserveA: 784539305090201984n,
              reserveB: 0n,
              kind: 0n,
              lowerTick: -1n,
              mergeId: 0n,
            },
            '8': {
              reserveA: 0n,
              reserveB: 949292559159144576000000000000n,
              kind: 0n,
              lowerTick: 7n,
              mergeId: 0n,
            },
            '9': {
              reserveA: 226486283758623329n,
              reserveB: 0n,
              kind: 1n,
              lowerTick: -9n,
              mergeId: 0n,
            },
            '10': {
              reserveA: 2022767072556136430n,
              reserveB: 253826547963173300232508721246n,
              kind: 1n,
              lowerTick: 1n,
              mergeId: 0n,
            },
            '11': {
              reserveA: 0n,
              reserveB: 293121155713320256000000000000n,
              kind: 1n,
              lowerTick: 9n,
              mergeId: 0n,
            },
            '12': {
              reserveA: 401225937191387328n,
              reserveB: 0n,
              kind: 3n,
              lowerTick: -3n,
              mergeId: 0n,
            },
            '13': {
              reserveA: 6922143575397388934n,
              reserveB: 868623892531657677331389843032n,
              kind: 3n,
              lowerTick: 1n,
              mergeId: 0n,
            },
            '14': {
              reserveA: 0n,
              reserveB: 485483384001578688000000000000n,
              kind: 3n,
              lowerTick: 4n,
              mergeId: 0n,
            },
            '15': {
              reserveA: 98357620806573344n,
              reserveB: 0n,
              kind: 1n,
              lowerTick: -8n,
              mergeId: 0n,
            },
            '16': {
              reserveA: 0n,
              reserveB: 119012721175953760000000000000n,
              kind: 1n,
              lowerTick: 7n,
              mergeId: 0n,
            },
            '17': {
              reserveA: 579597339107942400n,
              reserveB: 0n,
              kind: 3n,
              lowerTick: -7n,
              mergeId: 0n,
            },
            '18': {
              reserveA: 0n,
              reserveB: 701312780320610432000000000000n,
              kind: 3n,
              lowerTick: 5n,
              mergeId: 0n,
            },
          },
          binPositions: {
            '1': { '0': 5n, '1': 10n, '2': 2n, '3': 13n },
            '4': { '2': 3n, '3': 14n },
            '5': { '3': 18n },
            '6': { '0': 6n },
            '7': { '0': 8n, '1': 16n },
            '9': { '1': 11n },
            '-8': { '1': 15n, '2': 1n },
            '-7': { '0': 4n, '3': 17n },
            '-1': { '0': 7n },
            '-9': { '1': 9n },
            '-3': { '3': 12n },
          },
          binMap: {
            '0': 138270212336n,
            '-1': 7463166048985888814149647817523727749677346860178920913009108319939514597376n,
          },
        },
        4221332000000000000n,
        false,
        false,
      );

      expect(output).toBe(4629465618898435945n);
    } catch (e) {
      console.log(e);
    }
  });

  it.only('swap tokenA for B with exact out', async () => {
    try {
      const pool = new MaverickPoolMath(
        'Maverick',
        BigInt((0.3 / 100) * 1e18),
        BigInt(953),
        BigInt(15),
      );

      const [, output] = pool.swap(
        {
          activeTick: 1n,
          binCounter: 18n,
          bins: {
            '1': {
              reserveA: 497483862887020288n,
              reserveB: 0n,
              kind: 2n,
              lowerTick: -8n,
              mergeId: 0n,
            },
            '2': {
              reserveA: 910610554804923375n,
              reserveB: 601955474092920143393334041358n,
              kind: 2n,
              lowerTick: 1n,
              mergeId: 0n,
            },
            '3': {
              reserveA: 0n,
              reserveB: 601955474093294592000000000000n,
              kind: 2n,
              lowerTick: 4n,
              mergeId: 0n,
            },
            '4': {
              reserveA: 152321218072163223n,
              reserveB: 0n,
              kind: 0n,
              lowerTick: -7n,
              mergeId: 0n,
            },
            '5': {
              reserveA: 1602388015477499999n,
              reserveB: 1059252204411585496265377284265n,
              kind: 0n,
              lowerTick: 1n,
              mergeId: 0n,
            },
            '6': {
              reserveA: 0n,
              reserveB: 92625772049616308793229705215n,
              kind: 0n,
              lowerTick: 6n,
              mergeId: 0n,
            },
            '7': {
              reserveA: 784539305090201984n,
              reserveB: 0n,
              kind: 0n,
              lowerTick: -1n,
              mergeId: 0n,
            },
            '8': {
              reserveA: 0n,
              reserveB: 949292559159144576000000000000n,
              kind: 0n,
              lowerTick: 7n,
              mergeId: 0n,
            },
            '9': {
              reserveA: 242248889019272896n,
              reserveB: 0n,
              kind: 1n,
              lowerTick: -9n,
              mergeId: 0n,
            },
            '10': {
              reserveA: 623457173229195660n,
              reserveB: 412133876889017610809223571481n,
              kind: 1n,
              lowerTick: 1n,
              mergeId: 0n,
            },
            '11': {
              reserveA: 0n,
              reserveB: 293121155713320256000000000000n,
              kind: 1n,
              lowerTick: 9n,
              mergeId: 0n,
            },
            '12': {
              reserveA: 401225937191387328n,
              reserveB: 0n,
              kind: 3n,
              lowerTick: -3n,
              mergeId: 0n,
            },
            '13': {
              reserveA: 1314014273051684726n,
              reserveB: 868623892536737527910655145200n,
              kind: 3n,
              lowerTick: 1n,
              mergeId: 0n,
            },
            '14': {
              reserveA: 0n,
              reserveB: 485483384001578688000000000000n,
              kind: 3n,
              lowerTick: 4n,
              mergeId: 0n,
            },
            '15': {
              reserveA: 98357620806573344n,
              reserveB: 0n,
              kind: 1n,
              lowerTick: -8n,
              mergeId: 0n,
            },
            '16': {
              reserveA: 0n,
              reserveB: 119012721175953760000000000000n,
              kind: 1n,
              lowerTick: 7n,
              mergeId: 0n,
            },
            '17': {
              reserveA: 579597339107942400n,
              reserveB: 0n,
              kind: 3n,
              lowerTick: -7n,
              mergeId: 0n,
            },
            '18': {
              reserveA: 0n,
              reserveB: 701312780320610432000000000000n,
              kind: 3n,
              lowerTick: 5n,
              mergeId: 0n,
            },
          },
          binPositions: {
            '1': { '0': 5n, '1': 10n, '2': 2n, '3': 13n },
            '4': { '2': 3n, '3': 14n },
            '5': { '3': 18n },
            '6': { '0': 6n },
            '7': { '0': 8n, '1': 16n },
            '9': { '1': 11n },
            '-8': { '1': 15n, '2': 1n },
            '-7': { '0': 4n, '3': 17n },
            '-1': { '0': 7n },
            '-9': { '1': 9n },
            '-3': { '3': 12n },
          },
          binMap: {
            '0': 138270212336n,
            '-1': 7463166048985888814149647817523727749677346860178920913009108319939514597376n,
          },
        },
        2963297000000000000n,
        true,
        true,
      );

      expect(output).toBe(2963297000000000000n);
    } catch (e) {
      console.log(e);
    }
  });

  it.only('swap tokenB for A with exact out', async () => {
    try {
      const pool = new MaverickPoolMath(
        'Maverick',
        BigInt((0.3 / 100) * 1e18),
        BigInt(953),
        BigInt(15),
      );

      const [, output] = pool.swap(
        {
          activeTick: 1n,
          binCounter: 18n,
          bins: {
            '1': {
              reserveA: 497483862887020288n,
              reserveB: 0n,
              kind: 2n,
              lowerTick: -8n,
              mergeId: 0n,
            },
            '2': {
              reserveA: 4403952783147742494n,
              reserveB: 601955474089753857710031091993n,
              kind: 2n,
              lowerTick: 1n,
              mergeId: 0n,
            },
            '3': {
              reserveA: 0n,
              reserveB: 601955474093294592000000000000n,
              kind: 2n,
              lowerTick: 4n,
              mergeId: 0n,
            },
            '4': {
              reserveA: 152321218072163223n,
              reserveB: 0n,
              kind: 0n,
              lowerTick: -7n,
              mergeId: 0n,
            },
            '5': {
              reserveA: 7749571013874843735n,
              reserveB: 1059252204406013829864487021180n,
              kind: 0n,
              lowerTick: 1n,
              mergeId: 0n,
            },
            '6': {
              reserveA: 0n,
              reserveB: 92625772049616308793229705215n,
              kind: 0n,
              lowerTick: 6n,
              mergeId: 0n,
            },
            '7': {
              reserveA: 784539305090201984n,
              reserveB: 0n,
              kind: 0n,
              lowerTick: -1n,
              mergeId: 0n,
            },
            '8': {
              reserveA: 0n,
              reserveB: 949292559159144576000000000000n,
              kind: 0n,
              lowerTick: 7n,
              mergeId: 0n,
            },
            '9': {
              reserveA: 226486283758623329n,
              reserveB: 0n,
              kind: 1n,
              lowerTick: -9n,
              mergeId: 0n,
            },
            '10': {
              reserveA: 1857014647188313871n,
              reserveB: 253826547963322590631481653458n,
              kind: 1n,
              lowerTick: 1n,
              mergeId: 0n,
            },
            '11': {
              reserveA: 0n,
              reserveB: 293121155713320256000000000000n,
              kind: 1n,
              lowerTick: 9n,
              mergeId: 0n,
            },
            '12': {
              reserveA: 401225937191387328n,
              reserveB: 0n,
              kind: 3n,
              lowerTick: -3n,
              mergeId: 0n,
            },
            '13': {
              reserveA: 6354919547513394305n,
              reserveB: 868623892532168566395256743684n,
              kind: 3n,
              lowerTick: 1n,
              mergeId: 0n,
            },
            '14': {
              reserveA: 0n,
              reserveB: 485483384001578688000000000000n,
              kind: 3n,
              lowerTick: 4n,
              mergeId: 0n,
            },
            '15': {
              reserveA: 98357620806573344n,
              reserveB: 0n,
              kind: 1n,
              lowerTick: -8n,
              mergeId: 0n,
            },
            '16': {
              reserveA: 0n,
              reserveB: 119012721175953760000000000000n,
              kind: 1n,
              lowerTick: 7n,
              mergeId: 0n,
            },
            '17': {
              reserveA: 579597339107942400n,
              reserveB: 0n,
              kind: 3n,
              lowerTick: -7n,
              mergeId: 0n,
            },
            '18': {
              reserveA: 0n,
              reserveB: 701312780320610432000000000000n,
              kind: 3n,
              lowerTick: 5n,
              mergeId: 0n,
            },
          },
          binPositions: {
            '1': { '0': 5n, '1': 10n, '2': 2n, '3': 13n },
            '4': { '2': 3n, '3': 14n },
            '5': { '3': 18n },
            '6': { '0': 6n },
            '7': { '0': 8n, '1': 16n },
            '9': { '1': 11n },
            '-8': { '1': 15n, '2': 1n },
            '-7': { '0': 4n, '3': 17n },
            '-1': { '0': 7n },
            '-9': { '1': 9n },
            '-3': { '3': 12n },
          },
          binMap: {
            '0': 138270212336n,
            '-1': 7463166048985888814149647817523727749677346860178920913009108319939514597376n,
          },
        },
        1894736241169897472n,
        false,
        true,
      );

      expect(output).toBe(1894736241169897472n);

      expect(output / BigInt(1e12)).toBe(1894736n);
    } catch (e) {
      console.log(e);
    }
  });
});
