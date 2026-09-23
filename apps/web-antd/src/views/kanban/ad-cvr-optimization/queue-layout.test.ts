import { describe, expect, it } from 'vitest';

import { calculateQueueDock } from './queue-layout';

const desktop = {
  gridHeight: 4200,
  gridTop: 400,
  headerBottom: 0,
  panelHeight: 876,
  viewportHeight: 900,
  viewportWidth: 1440,
};

describe('task queue scroll layout', () => {
  it('keeps the initial queue aligned with the work area', () => {
    expect(calculateQueueDock(desktop)).toEqual({
      '--queue-height': '876px',
      '--queue-offset': '0px',
    });
  });
  it('keeps the queue visible while reading long tables', () => {
    expect(calculateQueueDock({ ...desktop, gridTop: -700 })).toHaveProperty(
      '--queue-offset',
      '712px',
    );
  });
  it('stays below a pinned application header', () => {
    expect(
      calculateQueueDock({ ...desktop, gridTop: -700, headerBottom: 88 }),
    ).toEqual({ '--queue-height': '788px', '--queue-offset': '800px' });
  });
  it('never translates beyond the end of the work area', () => {
    expect(calculateQueueDock({ ...desktop, gridTop: -4000 })).toHaveProperty(
      '--queue-offset',
      '3324px',
    );
  });
  it('does not jump when the workspace is shorter than the queue', () => {
    expect(
      calculateQueueDock({ ...desktop, gridHeight: 300, gridTop: -50 }),
    ).toHaveProperty('--queue-offset', '0px');
  });
  it.each([
    { viewportWidth: 900 },
    { viewportWidth: 390 },
    { viewportHeight: 450 },
  ])(
    'uses normal document flow on narrow or short viewports: %o',
    (viewport) => {
      expect(calculateQueueDock({ ...desktop, ...viewport })).toEqual({});
    },
  );
});
