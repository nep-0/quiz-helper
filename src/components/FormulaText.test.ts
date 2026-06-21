import { describe, expect, it } from 'vitest';
import { splitFormulaText } from './FormulaText';

describe('splitFormulaText', () => {
  it('splits inline dollar-delimited formulas', () => {
    expect(splitFormulaText('Solve $x^2=4$ now')).toEqual([
      { value: 'Solve ', formula: false, displayMode: false },
      { value: 'x^2=4', formula: true, displayMode: false },
      { value: ' now', formula: false, displayMode: false }
    ]);
  });

  it('splits double-dollar formulas as display mode', () => {
    expect(splitFormulaText('Use $$E=mc^2$$ here')).toEqual([
      { value: 'Use ', formula: false, displayMode: false },
      { value: 'E=mc^2', formula: true, displayMode: true },
      { value: ' here', formula: false, displayMode: false }
    ]);
  });

  it('keeps escaped dollars as plain text', () => {
    expect(splitFormulaText('Cost is \\$5')).toEqual([
      { value: 'Cost is $5', formula: false, displayMode: false }
    ]);
  });

  it('keeps unmatched dollars as plain text', () => {
    expect(splitFormulaText('This has $no end')).toEqual([
      { value: 'This has $no end', formula: false, displayMode: false }
    ]);
  });
});
