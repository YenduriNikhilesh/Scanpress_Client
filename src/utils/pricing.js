export function calcPrice(options, pricing) {
  const { size, mode, sides, copies } = options;
  const isBW     = mode === 'Black & White';
  const isDouble = sides === '2-Sided';
  const isLegal  = size === 'Legal' || size === 'Letter';

  let base;
  if (isLegal)     base = isDouble ? pricing.legD : pricing.legS;
  else if (!isBW)  base = isDouble ? pricing.colD : pricing.colS;
  else             base = isDouble ? pricing.bwD  : pricing.bwS;

  const total = base * copies;
  return {
    total,
    display: '₹' + total.toFixed(total % 1 === 0 ? 0 : 1),
    summary: `${copies} Copy · ${size} · ${isBW ? 'B&W' : 'Colour'} · ${sides}`,
  };
}
