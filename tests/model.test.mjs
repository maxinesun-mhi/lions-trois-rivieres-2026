// Run with: node tests/model.test.mjs
// Pure engine checks, including all behavioral cases in the original R tests.
import assert from "node:assert/strict";
import {readFile} from "node:fs/promises";
import {emptyScenario, evaluateTournament, ancestors, descendants, applyResult,
  clearResult, setGame34, normalizeScenario, validateScenario, topologicalOrder} from "../dist/js/model.js";

const data = JSON.parse(await readFile(new URL("../dist/data/tournament.json", import.meta.url), "utf8"));
let n = 0;
const check = (value, message) => { assert.ok(value, message); n++; };
const equal = (a, b, message) => { assert.deepEqual(a, b, message); n++; };
const fails = (run, message) => { assert.throws(run, message); n++; };
const clone = value => JSON.parse(JSON.stringify(value));
const game = (s, id) => evaluateTournament(data, s).find(g => g.game_no === id);
const cand = (s, id) => evaluateTournament(data, s).candidates[String(id)];
const sorted = values => [...values].sort();

equal(data.games.map(g => g.game_no), Array.from({length: 45}, (_, i) => i + 1), "Games 1–45 are preserved.");
check(data.teams.filter(t => t.name === "SÉLECT DU NORD").length === 2 && new Set(data.teams.map(t => t.team_id)).size === data.teams.length,
  "Duplicate printed teams retain separate source-slot identities.");
let s = emptyScenario();
check(game(s, 6).team_a === "lions" && game(s, 6).team_b === "forestiers", "Lions opening game is #6.");
check(game(s, 15).team_b === "" && game(s, 22).team_a === "", "Unplayed results do not infer participants.");
equal(sorted(cand(s, 15).b), sorted(["lions", "forestiers"]), "Both unplayed entrants remain candidates.");
equal(ancestors(data, 15), [4, 6], "Both #15 feeder games are returned.");
check([15, 22, 25, 26, 33, 34, 38, 45].every(id => descendants(data, 6).includes(id)), "All Lions branches are in the dependency graph.");
check(!descendants(data, 6).includes(6) && !ancestors(data, 15).includes(15), "Dependency queries exclude their selected game.");

const initial = JSON.stringify(s);
const original = s;
s = applyResult(data, s, 6, "a", 4, 1);
equal(JSON.stringify(original), initial, "Applying a result does not mutate the original scenario.");
check(game(s, 6).winner === "lions" && game(s, 6).loser === "forestiers", "Winner and loser are both exposed.");
check(game(s, 15).team_b === "lions" && game(s, 22).team_a === "forestiers", "Winner/loser #6 crossover works.");
equal(cand(s, 15).b, ["lions"], "Winner candidates narrow after a result.");
equal(cand(s, 22).a, ["forestiers"], "Loser candidates narrow after a result.");
check(!cand(s, 22).a.includes("lions"), "The chosen winner cannot remain the loser candidate.");
s = applyResult(data, s, 4, "a");
s = applyResult(data, s, 15, "b");
s = applyResult(data, s, 3, "a");
s = applyResult(data, s, 5, "a");
s = applyResult(data, s, 14, "b");
check(game(s, 25).team_a === "montreal" && game(s, 25).team_b === "pionniers", "#25 takes L15 and W14.");
check(game(s, 26).team_a === "college_francais" && game(s, 26).team_b === "lions", "#26 takes L14 and W15.");
s = applyResult(data, s, 25, "a");
s = applyResult(data, s, 26, "b");
check(game(s, 35).team_a === "montreal" && game(s, 36).team_b === "lions", "#25 and #26 feed separate playoff branches.");

const changed = applyResult(data, s, 4, "b");
check(["15", "25", "26"].every(id => !(id in changed.results)), "An upstream edit clears stale participant-bound picks.");
check([15, 25, 26].every(id => changed.invalidated.includes(id)), "The engine reports cleared descendants.");
check("14" in changed.results, "Independent results survive.");
const back = applyResult(data, changed, 4, "a");
check(game(back, 15).team_a === "montreal" && game(back, 15).winner === "", "Returning to a previous matchup does not resurrect its result.");
check(!("26" in back.results), "Descendants stay cleared.");
const cleared = clearResult(data, s, 6);
check(["6", "15", "25", "26"].every(id => !(id in cleared.results)), "Clearing an opening result clears its dependent picks.");
check(!Object.keys(changed).includes("invalidated") && !Object.keys(changed).includes("game34_reset"), "Metadata stays out of saved scenario schema.");

let t = applyResult(data, emptyScenario(), 6, "b");
equal(game(t, 22).team_a, "lions", "Lions reach #22 after losing #6.");
t = applyResult(data, t, 22, "b");
check(game(t, 33).team_a === "lions" && game(t, 34).team_b === "estacades", "Loser/winner #22 reach #33/#34.");
check(!cand(t, 34).b.includes("lions") && cand(t, 33).a.includes("lions"), "Candidate routes respect #22's result.");
t = applyResult(data, t, 9, "a");
equal(game(t, 33).team_b, "canam", "Winner #9 feeds #33.");
t = applyResult(data, t, 22, "a");
check(game(t, 34).team_b === "lions" && game(t, 34).winner === "" && game(t, 38).team_b === "", "Unresolved #34 grants no automatic bye.");
equal(cand(t, 34).a, [], "The unknown #34 opponent is not fabricated.");
equal(cand(t, 34).b, ["lions"], "Winner #22 remains the printed conditional entrant.");
check(cand(t, 38).b.includes("lions"), "Lions remain a possible #38 entrant through conditional #34.");
fails(() => applyResult(data, t, 34, "b"), "Unresolved #34 cannot accept a result.");

let pending = setGame34(data, t, "played");
check(game(pending, 34).winner === "" && game(pending, 34).status.includes("opponent required"), "Played mode waits for the manual opponent.");
pending = setGame34(data, t, "not_needed");
check(game(pending, 34).winner === "" && game(pending, 38).team_b === "", "Skipped mode waits for explicit advancement.");
let played = setGame34(data, t, "played", "rocket");
check(game(played, 34).team_a === "rocket" && game(played, 34).team_b === "lions", "Manual opponent occupies A, W22 occupies B.");
played = applyResult(data, played, 34, "b", 2, 2);
check(game(played, 34).winner === "lions" && game(played, 34).loser === "rocket" && game(played, 38).team_b === "lions", "A tied score uses its explicit winner.");
const advanced = setGame34(data, played, "not_needed", "", "@winner22");
check(!("34" in advanced.results) && game(advanced, 34).winner === "lions" && game(advanced, 34).loser === "", "Manual advancement clears the played pick and infers no loser.");
equal(game(advanced, 38).team_b, "lions", "Explicit W22 advancement feeds #38.");
const fixed = setGame34(data, t, "not_needed", "", "rocket");
check(game(fixed, 34).winner === "rocket" && game(fixed, 38).team_b === "rocket", "A manually named advancing entrant is respected.");
const unresolved = setGame34(data, played, "unresolved");
check(game(unresolved, 34).winner === "" && !("34" in unresolved.results), "Resetting conditional state removes its result.");
const await22 = setGame34(data, emptyScenario(), "not_needed", "", "@winner22");
equal(game(await22, 34).winner, "", "Future W22 advancement waits for #22.");
fails(() => setGame34(data, t, "played", "lions"), "#34 cannot have the same entrant twice.");

let duplicate = setGame34(data, t, "played", "estacades");
duplicate = applyResult(data, duplicate, 34, "b");
duplicate = applyResult(data, duplicate, 22, "b");
check(duplicate.game34.status === "unresolved" && !("34" in duplicate.results) && duplicate.game34_reset,
  "A later upstream edit automatically resets a duplicate conditional matchup.");

let full = emptyScenario();
for (const key of topologicalOrder(data)) {
  if (key === "34") full = setGame34(data, full, "played", "rocket");
  full = applyResult(data, full, key, "a");
}
check(evaluateTournament(data, full).every(g => g.winner), "All 45 games resolve with explicit results and #34 choice.");
check(game(full, 45).winner.length > 0, "The champion propagates.");
equal(Object.keys(validateScenario(data, full).results).length, 45, "Complete strict import succeeds.");
const selfMatch = setGame34(data, full, "not_needed", "", game(full, 32).winner);
check(game(selfMatch, 38).status.includes("Invalid pairing") && game(selfMatch, 38).winner === "", "Manual advancement cannot create a played self-matchup.");
fails(() => validateScenario(data, selfMatch), "Strict import rejects a self-matchup.");
fails(() => applyResult(data, selfMatch, 38, "a"), "A self-matchup cannot accept a result.");

fails(() => applyResult(data, emptyScenario(), 15, "a"), "Unresolved entrants reject a pick.");
fails(() => applyResult(data, emptyScenario(), 6, "a", 1, 4), "Contradictory scores fail.");
fails(() => applyResult(data, emptyScenario(), 6, "a", 1, null), "A single score fails.");
fails(() => applyResult(data, emptyScenario(), 6, "a", -1, 1), "Negative scores fail.");
fails(() => applyResult(data, emptyScenario(), 6, "a", 1.5, 1), "Fractional scores fail.");
fails(() => applyResult(data, emptyScenario(), 6, "a", Infinity, 1), "Infinite scores fail.");
fails(() => applyResult(data, emptyScenario(), 6, "a", NaN, 1), "NaN scores fail.");
fails(() => applyResult(data, emptyScenario(), 6, "a", "2", "1"), "Text score types fail.");
fails(() => applyResult(data, emptyScenario(), 99, "a"), "Unknown games fail.");
fails(() => applyResult(data, emptyScenario(), 6, "sideways"), "Unknown winner sides fail.");
fails(() => setGame34(data, t, "played", "imaginary"), "Unknown manual entrants fail.");
let bad = emptyScenario(); bad.schema_version = 2;
fails(() => validateScenario(data, bad), "Unsupported schema version fails.");
bad = emptyScenario(); bad.results = {x: {}};
fails(() => validateScenario(data, bad), "Unknown result keys fail.");
bad = clone(full); bad.results["6"].team_a = "rocket";
fails(() => validateScenario(data, bad), "Malformed participant binding fails.");
bad = clone(full); bad.results["6"].winner = "rocket";
fails(() => validateScenario(data, bad), "Winner outside the pairing fails.");
bad = clone(full); bad.results["6"].score_a = 1; bad.results["6"].score_b = 5;
fails(() => validateScenario(data, bad), "Contradictory imported scores fail.");
bad = emptyScenario(); bad.game34.advance = "@automatic";
fails(() => validateScenario(data, bad), "Invented advancement rules fail.");
bad = clone(t); bad.game34 = {status: "played", opponent: "lions", advance: ""};
fails(() => validateScenario(data, bad), "Imported duplicate conditional entrants fail.");
bad = clone(full); bad.results["6"].extra = true;
fails(() => validateScenario(data, bad), "Extra result fields fail.");
bad = emptyScenario(); bad.results = [{game: 6}];
fails(() => validateScenario(data, bad), "Nonempty arrays cannot masquerade as result maps.");
bad = emptyScenario(); bad.extra = true;
fails(() => validateScenario(data, bad), "Extra root fields fail.");
bad = emptyScenario(); delete bad.game34.advance;
fails(() => validateScenario(data, bad), "Missing fields fail.");
bad = clone(full); delete bad.results["6"].score_a;
fails(() => validateScenario(data, bad), "Missing imported scores fail.");
const roundtrip = validateScenario(data, clone(full));
equal(game(roundtrip, 45).winner, game(full, 45).winner, "JSON roundtrip preserves the champion.");
equal(game(roundtrip, 6).score_a, null, "JSON null remains a blank score.");
const rEmpty = emptyScenario(); rEmpty.results = [];
equal(validateScenario(data, rEmpty), emptyScenario(), "Existing R empty [] results import successfully.");
equal(Object.keys(JSON.parse(JSON.stringify(changed))).sort(), ["game34", "results", "schema_version"], "Metadata is excluded from exported JSON.");
const normalized = normalizeScenario(data, {...clone(changed), results: {...clone(changed.results), "15": clone(s.results["15"])}});
check(!("15" in normalized.results) && normalized.invalidated.includes(15), "Normalize clears a stale result while strict import rejects it.");
bad = {...clone(changed), results: {...clone(changed.results), "15": clone(s.results["15"])}};
fails(() => validateScenario(data, bad), "Strict validation rejects stale participant-bound results.");

const brokenRef = clone(data); brokenRef.games[0].a_type = "winner"; brokenRef.games[0].a_ref = "99";
fails(() => evaluateTournament(brokenRef), "Unknown routing references fail.");
const cycle = clone(data); cycle.games[0].a_type = "winner"; cycle.games[0].a_ref = "45";
fails(() => evaluateTournament(cycle), "Routing cycles fail.");
const duplicateGames = clone(data); duplicateGames.games[1].game_no = 1;
fails(() => evaluateTournament(duplicateGames), "Duplicate game IDs fail.");
const duplicateTeams = clone(data); duplicateTeams.teams[1].team_id = duplicateTeams.teams[0].team_id;
fails(() => evaluateTournament(duplicateTeams), "Duplicate team IDs fail.");
const unrecognizedRoute = clone(data); unrecognizedRoute.games[0].a_type = "standing";
fails(() => evaluateTournament(unrecognizedRoute), "Invented routing types fail.");

console.log(`PASS: ${n} browser tournament-model checks.`);
