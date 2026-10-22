// Pure tournament scenario engine. Routing is copied from the supplied PDF;
// no elimination, standings, overtime, or conditional-game rules are inferred.

const has = (object, key) => Object.prototype.hasOwnProperty.call(object, key);
const unique = values => [...new Set(values)];
const isRecord = value => value !== null && typeof value === "object" && !Array.isArray(value);
const whole = value => typeof value === "number" && Number.isFinite(value) && Number.isInteger(value);

export function emptyScenario() {
  return {schema_version: 1, results: {}, game34: {status: "unresolved", opponent: "", advance: ""}};
}

function scalarString(value, field, allowEmpty = true) {
  if (typeof value !== "string") throw new Error(`${field} must be one text value.`);
  if (!allowEmpty && !value.length) throw new Error(`${field} cannot be blank.`);
  return value;
}

function namedFields(value, fields, field) {
  const keys = isRecord(value) ? Object.keys(value) : [];
  if (!isRecord(value) || keys.length !== fields.length || !fields.every(key => has(value, key))) {
    throw new Error(`${field} must contain exactly: ${fields.join(", ")}.`);
  }
}

function score(value, field) {
  if (value === null) return null;
  if (!whole(value) || value < 0) throw new Error(`${field} must be blank or a finite, nonnegative whole number.`);
  return value;
}

function scores(a, b, winnerSide = null) {
  a = score(a, "Score A");
  b = score(b, "Score B");
  if ((a === null) !== (b === null)) throw new Error("Enter both scores, or leave both blank.");
  if (winnerSide !== null && a !== null && a !== b &&
      ((a > b && winnerSide !== "a") || (b > a && winnerSide !== "b"))) {
    throw new Error("The chosen winner contradicts the unequal scores.");
  }
  return [a, b];
}

function validateData(data) {
  if (!isRecord(data) || !Array.isArray(data.games) || !Array.isArray(data.teams)) {
    throw new Error("Tournament data must contain games and teams tables.");
  }
  const required = ["game_no", "official_id", "date", "time", "arena", "a_type", "a_ref", "b_type", "b_ref", "stage"];
  if (data.games.some(g => !isRecord(g) || !required.every(k => has(g, k))) ||
      data.teams.some(t => !isRecord(t) || !["team_id", "name", "label"].every(k => has(t, k)))) {
    throw new Error("Tournament data is missing required columns.");
  }
  const numbers = data.games.map(g => g.game_no);
  if (numbers.some(n => !whole(n) || n < 1) || unique(numbers).length !== numbers.length) {
    throw new Error("Game numbers must be unique positive whole numbers.");
  }
  const teamIDs = data.teams.map(t => t.team_id);
  if (teamIDs.some(id => typeof id !== "string" || !id.length) ||
      unique(teamIDs).length !== teamIDs.length ||
      data.teams.some(t => typeof t.name !== "string" || typeof t.label !== "string")) {
    throw new Error("Team IDs must be nonempty and unique, with names and labels.");
  }
  const gameIDs = numbers.map(String);
  for (const game of data.games) {
    for (const side of ["a", "b"]) {
      const type = game[`${side}_type`], ref = game[`${side}_ref`];
      if (typeof type !== "string" || typeof ref !== "string" || !["seed", "winner", "loser", "unknown"].includes(type)) {
        throw new Error("Invalid routing types or references in tournament data.");
      }
      if ((type === "seed" && !teamIDs.includes(ref)) ||
          (["winner", "loser"].includes(type) && !gameIDs.includes(ref))) {
        throw new Error("Tournament data refers to an unknown team or game.");
      }
    }
  }
}

function gameKey(data, gameNo) {
  if (whole(gameNo)) gameNo = String(gameNo);
  scalarString(gameNo, "Game number", false);
  if (!data.games.some(g => String(g.game_no) === gameNo)) throw new Error(`Unknown game number: ${gameNo}.`);
  return gameNo;
}

function parents(data) {
  return Object.fromEntries(data.games.map(g => [String(g.game_no), unique(["a", "b"]
    .filter(side => ["winner", "loser"].includes(g[`${side}_type`]))
    .map(side => g[`${side}_ref`]))]));
}

export function topologicalOrder(data) {
  validateData(data);
  const p = parents(data), done = [];
  let remaining = Object.keys(p);
  while (remaining.length) {
    const ready = remaining.filter(key => p[key].every(parent => done.includes(parent))).sort((a, b) => Number(a) - Number(b));
    if (!ready.length) throw new Error("Tournament routing contains a dependency cycle.");
    done.push(...ready);
    remaining = remaining.filter(key => !ready.includes(key));
  }
  return done;
}

export function ancestors(data, gameNo) {
  topologicalOrder(data);
  const key = gameKey(data, gameNo), p = parents(data), seen = new Set();
  const pending = [...p[key]];
  while (pending.length) {
    const next = pending.shift();
    if (!seen.has(next)) { seen.add(next); pending.push(...p[next]); }
  }
  return [...seen].map(Number).sort((a, b) => a - b);
}

export function descendants(data, gameNo) {
  topologicalOrder(data);
  const key = gameKey(data, gameNo), p = parents(data), seen = new Set(), pending = [key];
  while (pending.length) {
    const current = pending.shift();
    const children = Object.keys(p).filter(child => p[child].includes(current) && child !== key && !seen.has(child));
    children.forEach(child => seen.add(child));
    pending.push(...children);
  }
  return [...seen].map(Number).sort((a, b) => a - b);
}

function structureScenario(data, object) {
  namedFields(object, ["schema_version", "results", "game34"], "Scenario");
  if (!whole(object.schema_version) || object.schema_version !== 1) throw new Error("Unsupported scenario schema_version; expected 1.");
  const inputResults = object.results;
  // jsonlite writes R's empty list as []; accept that historical empty form.
  if (!isRecord(inputResults) && !(Array.isArray(inputResults) && inputResults.length === 0)) {
    throw new Error("Scenario results must be an object keyed by unique game numbers.");
  }
  const teamIDs = data.teams.map(t => t.team_id), gameIDs = data.games.map(g => String(g.game_no));
  const results = {};
  for (const key of Object.keys(inputResults)) {
    if (!gameIDs.includes(key)) throw new Error("Scenario contains an unknown game number.");
    const pick = inputResults[key];
    namedFields(pick, ["team_a", "team_b", "winner", "score_a", "score_b"], `Result for game ${key}`);
    for (const field of ["team_a", "team_b", "winner"]) {
      const value = scalarString(pick[field], `Game ${key} ${field}`, false);
      if (!teamIDs.includes(value)) throw new Error(`Game ${key} contains an unknown team ID.`);
    }
    if (pick.team_a === pick.team_b) throw new Error(`Game ${key} cannot contain the same team on both sides.`);
    if (![pick.team_a, pick.team_b].includes(pick.winner)) throw new Error(`Game ${key} winner is not one of its bound participants.`);
    const sc = scores(pick.score_a, pick.score_b, pick.winner === pick.team_a ? "a" : "b");
    results[key] = {team_a: pick.team_a, team_b: pick.team_b, winner: pick.winner, score_a: sc[0], score_b: sc[1]};
  }
  const cfg = object.game34;
  namedFields(cfg, ["status", "opponent", "advance"], "Game 34 configuration");
  const status = scalarString(cfg.status, "Game 34 status", false);
  const opponent = scalarString(cfg.opponent, "Game 34 opponent");
  const advance = scalarString(cfg.advance, "Game 34 advancing team");
  if (!["unresolved", "played", "not_needed"].includes(status)) throw new Error("Game 34 status must be unresolved, played, or not_needed.");
  if (opponent && !teamIDs.includes(opponent)) throw new Error("Game 34 opponent is an unknown team ID.");
  if (advance && ![...teamIDs, "@winner22"].includes(advance)) throw new Error("Game 34 advancing team is an unknown team ID.");
  if (status === "unresolved" && (opponent || advance)) throw new Error("An unresolved game 34 cannot specify an opponent or advancing team.");
  if (status === "played" && advance) throw new Error("A played game 34 uses its selected result, not an advancing-team override.");
  return {schema_version: 1, results, game34: {status, opponent, advance}};
}

function teamLabel(data, id) {
  return id ? data.teams.find(t => t.team_id === id)?.label ?? "" : "";
}

function sourceLabel(data, type, ref) {
  if (type === "seed") return teamLabel(data, ref);
  if (type === "winner") return `Winner #${ref}`;
  if (type === "loser") return `Loser #${ref}`;
  return "Opponent unspecified in PDF";
}

function metadata(target, invalidated = [], game34Reset = false) {
  Object.defineProperties(target, {
    invalidated: {value: unique(invalidated).sort((a, b) => a - b), enumerable: false, configurable: true},
    game34_reset: {value: !!game34Reset, enumerable: false, configurable: true}
  });
  return target;
}

function walkScenario(data, scenario, strictBindings = false) {
  const order = topologicalOrder(data), outcomes = {}, candidates = {}, rows = {}, invalidated = [];
  let game34Reset = false;
  const resolve = (type, ref) => {
    if (type === "seed") return {id: ref, candidates: [ref]};
    if (type === "unknown") return {id: "", candidates: []};
    return {id: outcomes[ref][type], candidates: outcomes[ref][`${type}_candidates`]};
  };
  for (const key of order) {
    const g = data.games.find(game => String(game.game_no) === key);
    let a = resolve(g.a_type, g.a_ref), b = resolve(g.b_type, g.b_ref);
    const conditional = key === "34";
    let cfg = scenario.game34, conditionalNote = "";
    if (conditional) {
      if (cfg.status === "played") {
        a = {id: cfg.opponent, candidates: cfg.opponent ? [cfg.opponent] : []};
        if (a.id && b.id && a.id === b.id) {
          if (strictBindings) throw new Error("Game 34 cannot contain the same team as opponent and winner #22.");
          scenario.game34 = emptyScenario().game34;
          cfg = scenario.game34;
          a = {id: "", candidates: []};
          game34Reset = true;
        }
      } else if (cfg.status === "not_needed") {
        a = {id: cfg.opponent, candidates: cfg.opponent ? [cfg.opponent] : []};
      }
    }
    const duplicatePair = !!(a.id && b.id && a.id === b.id && (!conditional || cfg.status === "played"));
    if (strictBindings && duplicatePair) throw new Error(`Game ${key} has the same team on both sides; correct the manual conditional entry.`);
    const knownPair = !!(a.id && b.id && a.id !== b.id);
    let pick = scenario.results[key];
    const allowedResult = !conditional || cfg.status === "played";
    const validPick = !!(pick && knownPair && allowedResult && pick.team_a === a.id && pick.team_b === b.id);
    if (pick && !validPick) {
      if (strictBindings) throw new Error(`Game ${key} result does not match its currently resolved participants or state.`);
      delete scenario.results[key];
      invalidated.push(Number(key));
      pick = null;
    }
    let winner = "", loser = "", scoreA = null, scoreB = null;
    let wc = unique([...a.candidates, ...b.candidates]), lc = [...wc];
    let status = duplicatePair ? "Invalid pairing: same team on both sides" : knownPair ? "Ready" : "Unresolved matchup";
    if (duplicatePair) { wc = []; lc = []; }
    if (validPick) {
      winner = pick.winner;
      loser = winner === a.id ? b.id : a.id;
      wc = [winner]; lc = [loser];
      scoreA = pick.score_a; scoreB = pick.score_b;
      status = "Final";
    }
    if (conditional) {
      if (cfg.status === "unresolved") {
        status = "Conditional: unresolved";
        wc = b.candidates; lc = [];
        conditionalNote = "PDF condition and side A are unspecified; confirm game 34 manually.";
      } else if (cfg.status === "not_needed") {
        winner = cfg.advance === "@winner22" ? b.id : cfg.advance;
        wc = cfg.advance === "@winner22" ? b.candidates : cfg.advance ? [cfg.advance] : [];
        loser = ""; lc = [];
        status = winner ? "Conditional: manually advanced" : cfg.advance === "@winner22" ? "Conditional: awaiting winner #22" : "Conditional: advancing team required";
        conditionalNote = "No game or loser is inferred. Advancement is an explicit manual confirmation.";
      } else {
        status = validPick ? "Conditional: final" : !cfg.opponent ? "Conditional: opponent required" : !b.id ? "Conditional: awaiting winner #22" : "Conditional: ready";
        conditionalNote = "Side A is manually specified; side B is winner #22.";
      }
    }
    outcomes[key] = {winner, loser, winner_candidates: unique(wc), loser_candidates: unique(lc)};
    candidates[key] = {a: unique(a.candidates), b: unique(b.candidates), winner: unique(wc), loser: unique(lc)};
    rows[key] = {...g, team_a: a.id, team_b: b.id,
      name_a: a.id ? teamLabel(data, a.id) : sourceLabel(data, g.a_type, g.a_ref),
      name_b: b.id ? teamLabel(data, b.id) : sourceLabel(data, g.b_type, g.b_ref),
      winner, loser, winner_name: teamLabel(data, winner), loser_name: teamLabel(data, loser), status,
      score_a: scoreA, score_b: scoreB, is_conditional: conditional, conditional_note: conditionalNote};
  }
  const games = data.games.map(g => rows[String(g.game_no)]);
  Object.defineProperty(games, "candidates", {value: candidates, enumerable: false});
  metadata(games, invalidated, game34Reset);
  metadata(scenario, invalidated, game34Reset);
  return {scenario, games};
}

export function validateScenario(data, object) {
  validateData(data);
  return walkScenario(data, structureScenario(data, object), true).scenario;
}

export function normalizeScenario(data, object) {
  validateData(data);
  return walkScenario(data, structureScenario(data, object)).scenario;
}

export function evaluateTournament(data, object = emptyScenario()) {
  validateData(data);
  return walkScenario(data, structureScenario(data, object)).games;
}

function mergeInvalidation(scenario, oldInvalidated = [], oldReset = false) {
  return metadata(scenario, [...oldInvalidated, ...scenario.invalidated], oldReset || scenario.game34_reset);
}

export function applyResult(data, object, gameNo, winnerSide, scoreA = null, scoreB = null) {
  validateData(data);
  const key = gameKey(data, gameNo);
  if (!["a", "b"].includes(winnerSide)) throw new Error("Choose a winner: side A or side B.");
  const sc = scores(scoreA, scoreB, winnerSide);
  const scenario = normalizeScenario(data, object), priorInvalidated = scenario.invalidated, priorReset = scenario.game34_reset;
  const row = evaluateTournament(data, scenario).find(g => String(g.game_no) === key);
  if (key === "34" && scenario.game34.status !== "played") throw new Error("Set conditional game 34 to played before entering a result.");
  if (!row.team_a || !row.team_b || row.team_a === row.team_b) throw new Error("Both distinct participants must be resolved before selecting a winner.");
  scenario.results[key] = {team_a: row.team_a, team_b: row.team_b,
    winner: winnerSide === "a" ? row.team_a : row.team_b, score_a: sc[0], score_b: sc[1]};
  return mergeInvalidation(normalizeScenario(data, scenario), priorInvalidated, priorReset);
}

export function clearResult(data, object, gameNo) {
  validateData(data);
  const key = gameKey(data, gameNo), scenario = normalizeScenario(data, object);
  const priorInvalidated = scenario.invalidated, priorReset = scenario.game34_reset;
  delete scenario.results[key];
  return mergeInvalidation(normalizeScenario(data, scenario), priorInvalidated, priorReset);
}

export function setGame34(data, object, status, opponent = "", advance = "") {
  const scenario = normalizeScenario(data, object), priorInvalidated = scenario.invalidated, priorReset = scenario.game34_reset;
  const candidate = structureScenario(data, {...scenario, game34: {status, opponent, advance}});
  if (status === "played" && opponent) {
    const winner22 = evaluateTournament(data, scenario).find(g => g.game_no === 22)?.winner;
    if (winner22 && opponent === winner22) throw new Error("Game 34 opponent cannot also be winner #22.");
  }
  return mergeInvalidation(normalizeScenario(data, candidate), priorInvalidated, priorReset);
}
