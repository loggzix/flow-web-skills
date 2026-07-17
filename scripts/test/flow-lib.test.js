// Unit tests for flow-lib.js pure/testable functions.
// Run: node --test scripts/test/flow-lib.test.js
// Requires: node ≥18 (built-in test runner, zero deps).
const { describe, it } = require('node:test');
const assert = require('node:assert/strict');

// --- Helpers to import testable parts without Playwright ---
// flow-lib.js requires playwright-core at top level.
// We mock it so require() doesn't fail in test env without Chrome.

const Module = require('module');
const origResolve = Module._resolveFilename;
Module._resolveFilename = function (request, parent, ...rest) {
  if (request === 'playwright-core') return __filename; // self — mock
  return origResolve.call(this, request, parent, ...rest);
};
// Mock exports for playwright-core
module.exports.chromium = { connectOverCDP: async () => ({ contexts: () => [{ pages: () => [] }] }) };

const path = require('path');
const lib = require(path.join(__dirname, '..', 'flow-lib.js'));

// ============================================================
// assignBirths
// ============================================================
describe('assignBirths', () => {
  const scenes = [
    { id: 's1', firedAtMs: 1000 },
    { id: 's2', firedAtMs: 2000 },
    { id: 's3', firedAtMs: 3000 },
  ];
  const promptOf = s => ({
    s1: 'Robot in junkyard',
    s2: 'Robot waters plant',
    s3: 'Storm hits',
  }[s.id]);

  it('matches by exact title (normalized whitespace)', () => {
    const born = [
      { workflowId: 'wf1', title: 'Robot in junkyard', at: 1100 },
      { workflowId: 'wf2', title: '  Robot  waters   plant ', at: 2100 },
      { workflowId: 'wf3', title: 'Storm hits', at: 3100 },
    ];
    const r = lib.assignBirths(born, scenes, promptOf);
    assert.deepEqual(r.bySceneId, { s1: ['wf1'], s2: ['wf2'], s3: ['wf3'] });
    assert.equal(r.unmatched.length, 0);
  });

  it('falls back to nearest firedAtMs when title mismatch', () => {
    const born = [
      { workflowId: 'wf1', title: 'TRANSLATED ENGLISH TITLE', at: 1200 },
    ];
    const r = lib.assignBirths(born, scenes, promptOf);
    // at=1200, closest firedAtMs <= 1200+500 = s1(1000), s2(2000 > 1700) → s1
    assert.deepEqual(r.bySceneId.s1, ['wf1']);
  });

  it('multiple births per scene (x4 multiplier)', () => {
    const born = [
      { workflowId: 'wf1a', title: 'Robot in junkyard', at: 1100 },
      { workflowId: 'wf1b', title: 'Robot in junkyard', at: 1150 },
      { workflowId: 'wf1c', title: 'Robot in junkyard', at: 1200 },
      { workflowId: 'wf1d', title: 'Robot in junkyard', at: 1250 },
    ];
    const r = lib.assignBirths(born, scenes, promptOf);
    assert.equal(r.bySceneId.s1.length, 4);
  });

  it('unmatched births go to unmatched array (no scenes have firedAtMs near birth.at)', () => {
    // All scenes firedAtMs ≤ 3000 — birth at=99999 still matches s3 via fallback
    // (firedAtMs 3000 <= 99999+500). To truly be unmatched, use scenes with NO firedAtMs.
    const noFireScenes = [{ id: 'a' }, { id: 'b' }];
    const born = [{ workflowId: 'wfX', title: 'Something completely different', at: 99999 }];
    const r = lib.assignBirths(born, noFireScenes, () => 'no match');
    assert.deepEqual(r.unmatched, ['wfX']);
  });

  it('empty born = empty results, no crash', () => {
    const r = lib.assignBirths([], scenes, promptOf);
    assert.deepEqual(r.bySceneId, { s1: [], s2: [], s3: [] });
    assert.equal(r.unmatched.length, 0);
  });

  it('empty scenes = all births unmatched', () => {
    const born = [{ workflowId: 'wf1', title: 'whatever', at: 1000 }];
    const r = lib.assignBirths(born, [], () => '');
    assert.deepEqual(r.unmatched, ['wf1']);
  });

  it('title with newlines normalized same as prompt with newlines', () => {
    const s = [{ id: 'x', firedAtMs: 100 }];
    const born = [{ workflowId: 'wfN', title: 'line1\nline2\n  line3', at: 150 }];
    const r = lib.assignBirths(born, s, () => 'line1\nline2\n  line3');
    assert.deepEqual(r.bySceneId.x, ['wfN']);
  });
});

// ============================================================
// trackFires (event emitter pattern)
// ============================================================
describe('trackFires', () => {
  it('captures batchAsyncGenerateVideo requests with entity count', () => {
    const handlers = {};
    const mockCtx = { on: (event, fn) => { handlers[event] = fn; } };
    const fired = lib.trackFires(mockCtx);

    // Simulate request event
    handlers.request({
      url: () => 'https://labs.google/fx/api/v1/batchAsyncGenerateVideoSomething',
      postData: () => '{"entityId":"a","entityId":"b"}',
    });
    assert.equal(fired.length, 1);
    assert.equal(fired[0].entities, 2);
    assert.ok(fired[0].url.includes('batchAsyncGenerateVideo'));
  });

  it('ignores Status poll requests', () => {
    const handlers = {};
    const mockCtx = { on: (event, fn) => { handlers[event] = fn; } };
    const fired = lib.trackFires(mockCtx);

    handlers.request({
      url: () => 'https://labs.google/fx/api/v1/batchAsyncGenerateVideoStatus',
      postData: () => '{}',
    });
    assert.equal(fired.length, 0);
  });

  it('handles missing postData gracefully', () => {
    const handlers = {};
    const mockCtx = { on: (event, fn) => { handlers[event] = fn; } };
    const fired = lib.trackFires(mockCtx);

    handlers.request({
      url: () => 'https://example.com/v1/batchAsyncGenerateVideoFoo',
      postData: () => null,
    });
    assert.equal(fired.length, 1);
    assert.equal(fired[0].entities, 0);
  });
});

// ============================================================
// trackBirths (response handler)
// ============================================================
describe('trackBirths', () => {
  it('captures workflowId from 200 response with media array', async () => {
    const handlers = {};
    const mockCtx = { on: (event, fn) => { handlers[event] = fn; } };
    const born = lib.trackBirths(mockCtx, 'proj1');

    await handlers.response({
      url: () => 'https://example.com/v1/batchAsyncGenerateVideoFoo',
      status: () => 200,
      json: async () => ({
        media: [
          { workflowId: 'wf1', projectId: 'proj1', mediaMetadata: { mediaTitle: 'Robot' } },
          { workflowId: 'wf2', projectId: 'proj1', mediaMetadata: { mediaTitle: 'Plant' } },
        ],
      }),
    });
    assert.equal(born.length, 2);
    assert.equal(born[0].workflowId, 'wf1');
    assert.equal(born[0].title, 'Robot');
    assert.equal(born[1].workflowId, 'wf2');
  });

  it('ignores media from other projects', async () => {
    const handlers = {};
    const mockCtx = { on: (event, fn) => { handlers[event] = fn; } };
    const born = lib.trackBirths(mockCtx, 'proj1');

    await handlers.response({
      url: () => 'https://example.com/v1/batchAsyncGenerateVideoFoo',
      status: () => 200,
      json: async () => ({
        media: [{ workflowId: 'wfX', projectId: 'OTHER_PROJECT', mediaMetadata: {} }],
      }),
    });
    assert.equal(born.length, 0);
  });

  it('logs 403 without adding to born', async () => {
    const handlers = {};
    const mockCtx = { on: (event, fn) => { handlers[event] = fn; } };
    const born = lib.trackBirths(mockCtx, 'proj1');

    await handlers.response({
      url: () => 'https://example.com/v1/batchAsyncGenerateVideoFoo',
      status: () => 403,
    });
    assert.equal(born.length, 0);
    assert.ok(born.last403At > 0);
  });

  it('ignores Status poll responses', async () => {
    const handlers = {};
    const mockCtx = { on: (event, fn) => { handlers[event] = fn; } };
    const born = lib.trackBirths(mockCtx, 'proj1');

    await handlers.response({
      url: () => 'https://example.com/v1/batchAsyncGenerateVideoStatus',
      status: () => 200,
      json: async () => ({ media: [{ workflowId: 'wf1', projectId: 'proj1' }] }),
    });
    assert.equal(born.length, 0);
  });

  it('falls back to workflows array when media empty', async () => {
    const handlers = {};
    const mockCtx = { on: (event, fn) => { handlers[event] = fn; } };
    const born = lib.trackBirths(mockCtx, 'proj1');

    await handlers.response({
      url: () => 'https://example.com/v1/batchAsyncGenerateVideoFoo',
      status: () => 200,
      json: async () => ({
        media: [],
        workflows: [{ name: 'wfAlt', projectId: 'proj1', metadata: { displayName: 'Alt title' } }],
      }),
    });
    assert.equal(born.length, 1);
    assert.equal(born[0].workflowId, 'wfAlt');
    assert.equal(born[0].title, 'Alt title');
  });
});

// ============================================================
// checkConfig (needs page mock)
// ============================================================
describe('checkConfig', () => {
  function mockPage(chipText) {
    return {
      locator: () => ({
        last: () => ({
          count: async () => chipText ? 1 : 0,
          textContent: async () => chipText,
        }),
      }),
    };
  }

  it('returns ok=true when all tokens present', async () => {
    const r = await lib.checkConfig(mockPage('Video · 8scrop_9_16x2'), ['Video', 'crop_9_16', 'x2']);
    assert.equal(r.ok, true);
    assert.equal(r.barText, 'Video · 8scrop_9_16x2');
  });

  it('returns ok=false when token missing', async () => {
    const r = await lib.checkConfig(mockPage('Video · 8scrop_9_16x2'), ['crop_9_16', 'x4']);
    assert.equal(r.ok, false);
  });

  it('ignores "Video" token in expectConfig', async () => {
    const r = await lib.checkConfig(mockPage('Image · crop_1_1x2'), ['Video', 'crop_1_1', 'x2']);
    // "Video" skipped, crop_1_1 + x2 present → ok
    assert.equal(r.ok, true);
  });

  it('returns ok=true when expectConfig is null', async () => {
    const r = await lib.checkConfig(mockPage('anything'), null);
    assert.equal(r.ok, true);
  });

  it('returns NO_CHIP when no chip found', async () => {
    const r = await lib.checkConfig(mockPage(null), ['crop_9_16']);
    assert.equal(r.barText, 'NO_CHIP');
    assert.equal(r.ok, false);
  });
});

// ============================================================
// Module exports completeness
// ============================================================
describe('module exports', () => {
  it('exports all expected functions + CDP', () => {
    const fns = ['connect', 'gotoProject', 'checkConfig', 'trackFires', 'trackBirths', 'waitBirths', 'assignBirths', 'fireScene', 'pollUntil', 'clickByLocator'];
    for (const fn of fns) assert.equal(typeof lib[fn], 'function', `missing export: ${fn}`);
    assert.equal(typeof lib.CDP, 'string', 'CDP should be a string');
  });
});
