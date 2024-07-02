// Function to compute cost based on zero and non-zero byte counts in data as priced by L2 (OP)
function computeCost(data: string): number {
  let countZero = 0;
  for (let i = data.startsWith('0x') ? 2 : 0; i < data.length; i += 2) {
    if (data.substring(i, i + 2) == '00') countZero++;
  }
  const cost = countZero * 4 + (data.length / 2 - countZero) * 16;
  return cost;
}

export default computeCost;
