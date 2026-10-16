import assert from 'node:assert/strict';
import test from 'node:test';
import { buildApiHeaders } from '../src/utils/apiHeaders.ts';

test('all supported provider credentials are sent in their own headers', () => {
  const values: Record<string, string> = {
    byok_glm_key: ' glm-key ', byok_minimax_key: ' minimax-key ',
    byok_siliconflow_key: ' silicon-key ', byok_deepseek_key: ' deepseek-key ',
    byok_kimi_key: ' kimi-key ', byok_ima_client_id: ' client-id ', byok_ima_key: ' ima-key ',
  };
  const result = buildApiHeaders({ getItem: key => values[key] ?? null });
  assert.equal(result['X-Glm-Key'], 'glm-key');
  assert.equal(result['X-Minimax-Key'], 'minimax-key');
  assert.equal(result['X-Siliconflow-Key'], 'silicon-key');
  assert.equal(result['X-Deepseek-Key'], 'deepseek-key');
  assert.equal(result['X-Kimi-Key'], 'kimi-key');
  assert.equal(result['X-Ima-Client-Id'], 'client-id');
  assert.equal(result['X-Ima-Key'], 'ima-key');
});

test('empty or whitespace-only credentials are not sent', () => {
  assert.deepEqual(buildApiHeaders({ getItem: () => '  ' }), { 'Content-Type': 'application/json' });
});
