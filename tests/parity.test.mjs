// Cross-language regression checks against independently generated R fixtures.
// Regenerate with Rscript tests/generate-parity.R, then run with node --test.
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import test from 'node:test';
import {
  emptyScenario, evaluateTournament, applyResult, clearResult, setGame34,
  validateScenario,
} from '../dist/js/model.js';

const readJSON = async path => JSON.parse(await readFile(new URL(path, import.meta.url), 'utf8'));
const data = await readJSON('../dist/data/tournament.json');
const reference = await readJSON('./r-parity-fixtures.json');
const candidates = values => Object.fromEntries(Object.entries(values).map(([game, slots]) => [
  game, Object.fromEntries(Object.entries(slots).map(([slot, entrants]) => [slot, [...entrants].sort()])),
]));
const plainScenario = value => ({
  schema_version: value.schema_version,
  results: Array.isArray(value.results) && value.results.length === 0 ? {} : value.results,
  game34: value.game34,
});
const replay = operations => operations.reduce((scenario, operation) => {
  switch (operation.kind) {
    case 'game34':
      return setGame34(data, scenario, operation.status, operation.opponent, operation.advance);
    case 'result':
      return applyResult(data, scenario, operation.game, operation.side,
        operation.score_a, operation.score_b);
    case 'clear':
      return clearResult(data, scenario, operation.game);
    default:
      throw new Error(`Unknown reference operation ${operation.kind}`);
  }
}, emptyScenario());

test('browser data retains every R/source schedule, ordered routing slot, and team identity', () => {
  assert.deepStrictEqual(data, reference.tournament);
  assert.equal(data.games.length, 45);
  assert.notEqual(data.teams.find(t => t.team_id === 'select_nord_9').team_id,
    data.teams.find(t => t.team_id === 'select_nord_11').team_id);
});

for (const expected of reference.cases) {
  test(`R/JavaScript parity: ${expected.name}`, () => {
    const scenario = replay(expected.operations);
    const evaluated = evaluateTournament(data, scenario);
    assert.deepStrictEqual(plainScenario(scenario), plainScenario(expected.scenario),
      'result bindings, selected winners, scores, and explicit #34 assumptions');
    assert.deepStrictEqual([...evaluated], expected.rows,
      'all 45 schedules, participant slots, winners/losers, labels, scores, and statuses');
    assert.deepStrictEqual(candidates(evaluated.candidates), candidates(expected.candidates),
      'all 45 participant and winner/loser candidate sets');

    const imported = validateScenario(data, expected.scenario);
    const restored = evaluateTournament(data, imported);
    assert.deepStrictEqual([...restored], expected.rows, 'saved R JSON restores identically');
    assert.deepStrictEqual(candidates(restored.candidates), candidates(expected.candidates));

    if (expected.name.startsWith('lions_')) {
      assert.equal(evaluated.find(g => g.game_no === 45).winner, 'lions');
    }
    if (expected.name === 'empty_source_default') {
      const conditional = evaluated.find(g => g.game_no === 34);
      assert.equal(conditional.team_a, '');
      assert.equal(conditional.winner, '');
      assert.equal(evaluated.find(g => g.game_no === 38).team_b, '');
      assert.equal(scenario.game34.status, 'unresolved');
    }
    if (expected.name === 'upstream_flip_clears_stale_results') {
      assert.equal(scenario.results['15'], undefined);
      assert.equal(scenario.results['45'], undefined);
    }
  });
}
