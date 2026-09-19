import { describe, expect, it } from 'vitest';
import { formatPace, paceBand, parsePace } from './types';

describe('parsePace', () => {
  it('convierte min:seg a segundos por km', () => {
    expect(parsePace('5:00')).toBe(300);
    expect(parsePace('4:35')).toBe(275);
    expect(parsePace(' 3:59 ')).toBe(239);
  });

  it('rechaza formatos inválidos', () => {
    expect(parsePace('5')).toBeNull();
    expect(parsePace('5:60')).toBeNull();
    expect(parsePace('abc')).toBeNull();
  });
});

describe('formatPace', () => {
  it('formatea con dos dígitos de segundos', () => {
    expect(formatPace(300)).toBe('5:00');
    expect(formatPace(275)).toBe('4:35');
    expect(formatPace(65)).toBe('1:05');
  });
});

describe('paceBand', () => {
  it('asigna la banda correcta en los límites', () => {
    expect(paceBand(239)).toBe('<4:00');
    expect(paceBand(240)).toBe('4:00-4:45');
    expect(paceBand(284)).toBe('4:00-4:45');
    expect(paceBand(285)).toBe('4:45-5:30');
    expect(paceBand(329)).toBe('4:45-5:30');
    expect(paceBand(330)).toBe('5:30-6:15');
    expect(paceBand(374)).toBe('5:30-6:15');
    expect(paceBand(375)).toBe('>6:15');
  });
});
