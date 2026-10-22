import {emptyScenario, evaluateTournament, validateScenario, applyResult, clearResult, setGame34, ancestors, descendants} from './model.js';
import {bracketSvg} from './bracket.js';
import {downloadBracket} from './export.js';

const $ = id => document.getElementById(id);
const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const option = (value, label, selected='') => `<option value="${esc(value)}"${String(value) === String(selected) ? ' selected' : ''}>${esc(label)}</option>`;
const edit = n => `<button type="button" class="edit-game" data-game="${n}" aria-label="Edit game ${n}">#${n}</button>`;
const STORAGE_KEY = 'lions-tr-2026-scenario-v1';
let data, scenario, evaluated;
let selected = 6, view = 'lions', day = 'all', teamFilter = 'all', scope = 'lions', zoom = 85;
let toastTimer;

function notify(message, error=false) {
  $('toast').textContent = message; $('toast').className = error ? 'error' : ''; $('toast').hidden = false;
  clearTimeout(toastTimer); toastTimer = setTimeout(() => {$('toast').hidden = true;}, error ? 9000 : 5000);
}
function teamLabel(id) {return data.teams.find(t => t.team_id === id)?.label || id;}
function sourceLabel(type, ref) {
  return type === 'seed' ? teamLabel(ref) : type === 'unknown' ? 'Unspecified opponent (PDF blank)' : `${type === 'winner' ? 'Winner' : 'Loser'} #${ref}`;
}
function dateLabel(date) {return ({'2026-11-12':'Thu 12 Nov','2026-11-13':'Fri 13 Nov','2026-11-14':'Sat 14 Nov','2026-11-15':'Sun 15 Nov'})[date] + ' 2026';}
function row(n) {return evaluated.find(g => g.game_no === Number(n));}
function flags(g) {
  const c = evaluated.candidates?.[String(g.game_no)] || {};
  return {known:g.team_a === 'lions' || g.team_b === 'lions', possible:[...(c.a || []),...(c.b || []),...(c.winner || [])].includes('lions')};
}
function targets(n, outcome) {
  return data.games.filter(g => (g.a_type === outcome && String(g.a_ref) === String(n)) || (g.b_type === outcome && String(g.b_ref) === String(n))).map(g => g.game_no);
}
function route(n, outcome) {
  const ids = targets(n,outcome);
  return ids.length ? ids.map(edit).join(' ') : Number(n) === 45 && outcome === 'winner' ? 'Tournament winner' : 'No onward route printed';
}
function saveLocal() {
  try {localStorage.setItem(STORAGE_KEY,JSON.stringify(scenario));}
  catch { /* Keep editing available when browser storage is unavailable. */ }
}
function commit(next, message) {
  const invalidated = next.invalidated || [];
  const conditionalReset = next.game34_reset;
  scenario = next; evaluated = evaluateTournament(data,scenario); saveLocal(); render();
  notify(`${message}${invalidated.length ? ` Cleared ${invalidated.length} affected result(s).` : ''}${conditionalReset ? ' #34 reset to unresolved because its two teams became identical.' : ''}`);
}
function resultTable(games, withRoutes=true) {
  if (!games.length) return '<div class="empty">No games match these filters.</div>';
  return `<div class="table-scroll"><table class="match-table"><thead><tr>${['Game','Schedule / arena','Side A','Side B','Result / status',...(withRoutes ? ['Onward routes'] : [])].map(s=>`<th scope="col">${s}</th>`).join('')}</tr></thead><tbody>${games.map(g=>{
    const f=flags(g); const aSource=sourceLabel(g.a_type,g.a_ref), bSource=sourceLabel(g.b_type,g.b_ref);
    const participant=(side,source)=>`<span class="${g[`team_${side}`] === 'lions' ? 'team-lions' : ''}">${esc(g[`name_${side}`])}</span>${source !== g[`name_${side}`] ? `<small>${esc(source)}</small>` : ''}`;
    const result = g.winner ? `Winner: ${g.winner_name}` : g.status;
    return `<tr class="${f.known ? 'lions-confirmed' : f.possible ? 'lions-possible' : ''}"><td>${edit(g.game_no)}<small>ID ${esc(g.official_id)}</small></td><td><strong>${dateLabel(g.date)} ${esc(g.time)}</strong><small>${esc(g.arena)}</small></td><td>${participant('a',aSource)}</td><td>${participant('b',bSource)}</td><td>${g.score_a !== null && g.score_b !== null ? `<strong class="score">${g.score_a} – ${g.score_b}</strong>` : ''}<span>${esc(result)}</span>${g.game_no === 34 ? `<small>Conditional / manual scenario</small>` : ''}</td>${withRoutes ? `<td><div>Win → ${route(g.game_no,'winner')}</div><div>Lose → ${route(g.game_no,'loser')}</div></td>` : ''}</tr>`;
  }).join('')}</tbody></table></div>`;
}
function renderEditor() {
  $('selected-game').innerHTML = data.games.map(g=>option(g.game_no,`#${g.game_no} · ${dateLabel(g.date)} ${g.time}`,selected)).join('');
  const g=row(selected); const saved=scenario.results[String(selected)];
  $('selected-summary').innerHTML = `<strong>Game #${g.game_no} · ${esc(g.official_id)}</strong><p>${dateLabel(g.date)} · ${esc(g.time)}</p><p>${esc(g.arena)}</p><small>${esc(sourceLabel(g.a_type,g.a_ref))} vs ${esc(sourceLabel(g.b_type,g.b_ref))}</small>`;
  const playable = (selected !== 34 || scenario.game34.status === 'played') && g.team_a && g.team_b && g.team_a !== g.team_b;
  if (!playable) {
    $('result-editor').innerHTML = `<p class="notice">${selected === 34 && scenario.game34.status !== 'played' ? 'Use the manual #34 controls below to specify whether it is played or explicitly choose who advances when it is not played.' : g.team_a && g.team_a === g.team_b ? 'The same team occupies both slots. Review the manual #34 assumption.' : 'Resolve the feeder games to identify both teams before entering this result.'}</p>`;
  } else {
    const side=saved ? (saved.winner === g.team_a ? 'a' : 'b') : '';
    $('result-editor').innerHTML = `<form id="result-form"><label for="winner-side">Match winner</label><select id="winner-side" required>${option('','Choose a winner…',side)}${option('a',`A · ${g.name_a}`,side)}${option('b',`B · ${g.name_b}`,side)}</select><div class="score-row"><div><label for="score-a">Score A (optional)</label><input id="score-a" inputmode="numeric" autocomplete="off" value="${saved?.score_a ?? ''}"></div><div><label for="score-b">Score B (optional)</label><input id="score-b" inputmode="numeric" autocomplete="off" value="${saved?.score_b ?? ''}"></div></div><div class="action-row"><button type="submit" class="button primary">Apply result</button><button type="button" class="button" id="clear-result">Clear result</button></div></form>`;
  }
  const cfg=scenario.game34;
  const choices=(value)=>option('','Unspecified',value)+data.teams.map(t=>option(t.team_id,t.label,value)).join('');
  $('conditional-editor').innerHTML = `<form id="conditional-form"><label for="status34">Scenario assumption for #34</label><select id="status34">${option('unresolved','Unresolved (source default)',cfg.status)}${option('played','Played (manual opponent)',cfg.status)}${option('not_needed','Not played (manual advancement)',cfg.status)}</select><label for="opponent34">If played: first-line opponent</label><select id="opponent34">${choices(cfg.opponent)}</select><label for="advance34">If not played: explicit entrant into #38</label><select id="advance34">${option('','Unspecified — keep #38 unresolved',cfg.advance)}${option('@winner22','Manually advance Winner #22',cfg.advance)}${data.teams.map(t=>option(t.team_id,t.label,cfg.advance)).join('')}</select><button type="submit" class="button">Apply #34 settings</button></form>`;
}
function metric(label,value) {return `<div class="metric"><span>${label}</span><strong>${esc(value)}</strong></div>`;}
function renderMetrics() {
  const final=row(45);
  $('metrics').innerHTML = metric('RESULTS SET',`${Object.keys(scenario.results).length} / 45`)+metric('KNOWN LIONS MATCHUPS',evaluated.filter(g=>flags(g).known).length)+metric(final.winner ? 'SCENARIO CHAMPION' : 'CONDITIONAL #34',final.winner ? final.winner_name : ({unresolved:'Awaiting clarification',played:'Manual opponent',not_needed:'Manual advancement'})[scenario.game34.status]);
}
function lionsView() {
  const games=evaluated.filter(g=>{const f=flags(g); return f.known || f.possible;});
  const pending=games.filter(g=>flags(g).known && !g.winner).sort(chronological);
  let summary;
  if (pending.length) {
    const g=pending[0]; const opponent=g.team_a === 'lions' ? g.name_b : g.name_a;
    summary=`<div class="next-game"><div><p class="eyebrow">NEXT UNRESOLVED LIONS MATCHUP</p><h3>#${g.game_no} · Lions vs ${esc(opponent)}</h3><p>${dateLabel(g.date)} · ${g.time} · ${g.arena}</p></div>${edit(g.game_no)}</div>`;
  } else {
    summary=`<div class="next-game"><p>${row(45).winner === 'lions' ? 'Lions win this scenario.' : games.some(g=>flags(g).possible && !g.winner) ? 'The next Lions matchup depends on feeder results or conditional #34. Select a highlighted game below.' : 'No unresolved onward Lions matchup is available under the printed routes and your current results.'}</p></div>`;
  }
  return `<h2>The Lions’ route</h2>${summary}${resultTable(games)}<details><summary>Read the four printed Lions branches</summary><ul><li>Win #6 → #15; lose #15 → #25 → #35 → #39 → #43 → #45.</li><li>Win #6 → #15; win #15 → #26 → #36 → #40 → #44 → #45.</li><li>Lose #6 → #22; lose #22 → #33 → #41 → #43 → #45.</li><li>Lose #6 → #22; win #22 → conditional #34 → #38 → #42 → #44 → #45.</li></ul><p>After the stated win/lose branches, every arrow follows the winner. No extra elimination or bypass rule is assumed.</p></details>`;
}
function chronological(a,b) {return `${a.date} ${a.time}`.localeCompare(`${b.date} ${b.time}`) || a.game_no-b.game_no;}
function scheduleRows() {return evaluated.filter(g=> (day === 'all' || g.date === day) && (teamFilter === 'all' || (teamFilter === 'confirmed' ? flags(g).known : flags(g).known || flags(g).possible))).sort(chronological);}
function scheduleView() {
  return `<h2>Complete tournament schedule</h2><div class="filters"><div><label for="day-filter">Day</label><select id="day-filter">${option('all','All days',day)}${['2026-11-12','2026-11-13','2026-11-14','2026-11-15'].map(d=>option(d,dateLabel(d),day)).join('')}</select></div><div><label for="team-filter">Lions filter</label><select id="team-filter">${option('all','All games',teamFilter)}${option('confirmed','Known Lions matchups',teamFilter)}${option('possible','Known + possible Lions games',teamFilter)}</select></div></div><p class="muted">Chronological order. Times and arenas are as printed. The source specifies no time zone or match duration. Click a game number to edit.</p><div id="schedule-table">${resultTable(scheduleRows())}</div>`;
}
function bracketKeep() {return scope === 'lions' ? [6,...descendants(data,6)] : scope === 'selected' ? [...new Set([selected,...ancestors(data,selected),...descendants(data,selected)])] : data.games.map(g=>g.game_no);}
function currentSvg() {return bracketSvg(data,evaluated,bracketKeep());}
function bracketView() {
  return `<h2>Winner & loser dependencies</h2><div class="filters"><div><label for="bracket-scope">Show</label><select id="bracket-scope">${option('lions','Lions corridor (all printed branches)',scope)}${option('all','Entire tournament',scope)}${option('selected','Selected game + dependencies',scope)}</select></div><div><label for="bracket-zoom">Bracket scale <output id="zoom-value">${zoom}%</output></label><input type="range" id="bracket-zoom" min="50" max="120" step="5" value="${zoom}"></div></div><div class="bracket-export-actions"><strong>Save visual bracket</strong><button type="button" class="button" id="save-jpeg" data-bracket-export>Save JPEG</button><button type="button" class="button" id="save-pdf" data-bracket-export>Save PDF</button></div><div class="legend"><span>━ Winner route</span><span>┄ Loser route</span><span class="gold">Black: known / possible Lions route</span></div><p class="muted">Scroll to explore. Click a card to edit. Hidden feeders retain their printed labels.</p><div class="bracket-scroll"><div class="bracket-canvas" id="bracket-canvas" style="zoom:${zoom/100}">${currentSvg()}</div></div>`;
}
function renderView() {
  document.querySelectorAll('[data-tab]').forEach(b=>{if(b.dataset.tab===view)b.setAttribute('aria-current','page');else b.removeAttribute('aria-current');});
  $('view-body').innerHTML = ({lions:lionsView,schedule:scheduleView,bracket:bracketView})[view]();
}
function render() {renderEditor();renderMetrics();renderView();}
function readScore(value) {const s=value.trim();if(!s)return null;if(!/^\d+$/.test(s))throw new Error('Scores must be non-negative whole numbers, or both blank.');const n=Number(s);if(!Number.isSafeInteger(n))throw new Error('Score is too large.');return n;}
document.addEventListener('submit',e=>{
  if(e.target.id !== 'result-form' && e.target.id !== 'conditional-form')return;e.preventDefault();
  try {
    if(e.target.id === 'result-form')commit(applyResult(data,scenario,selected,$('winner-side').value,readScore($('score-a').value),readScore($('score-b').value)),`Result saved for #${selected}.`);
    else {const status=$('status34').value;commit(setGame34(data,scenario,status,status==='played'?$('opponent34').value:'',status==='not_needed'?$('advance34').value:''),'Manual #34 settings applied.');}
  } catch(err){notify(err.message,true);}
});
document.addEventListener('click',async e=>{
  const game=e.target.closest('[data-game]');
  if(game){const n=Number(game.dataset.game);if(data.games.some(g=>g.game_no===n)){selected=n;renderEditor();if(scope==='selected')renderView();if(innerWidth<760)$('selected-game').scrollIntoView({behavior:'smooth',block:'center'});}return;}
  const tab=e.target.closest('[data-tab]');if(tab){view=tab.dataset.tab;renderView();return;}
  const id=e.target.closest('button')?.id;
  try {
    if(id==='clear-result')commit(clearResult(data,scenario,selected),'Result cleared.');
    if(id==='save-jpeg' || id==='save-pdf') {
      const buttons=[...document.querySelectorAll('[data-bracket-export]')];
      const svg=currentSvg(), format=id==='save-jpeg' ? 'jpeg' : 'pdf';
      buttons.forEach(button=>{button.disabled=true;});
      try {await downloadBracket(svg,format);notify(`Bracket saved as ${format.toUpperCase()}.`);}
      finally {buttons.forEach(button=>{button.disabled=false;});}
    }
  }catch(err){notify(err.message,true);}
});
document.addEventListener('keydown',e=>{if((e.key==='Enter'||e.key===' ')&&e.target.matches('svg [data-game]')){e.preventDefault();e.target.dispatchEvent(new MouseEvent('click',{bubbles:true}));}});
document.addEventListener('change',e=>{
  const id=e.target.id;
  if(id==='selected-game'){selected=Number(e.target.value);renderEditor();if(scope==='selected')renderView();}
  if(id==='day-filter'){day=e.target.value;$('schedule-table').innerHTML=resultTable(scheduleRows());}
  if(id==='team-filter'){teamFilter=e.target.value;$('schedule-table').innerHTML=resultTable(scheduleRows());}
  if(id==='bracket-scope'){scope=e.target.value;renderView();}

});
document.addEventListener('input',e=>{if(e.target.id==='bracket-zoom'){zoom=Number(e.target.value);$('zoom-value').textContent=`${zoom}%`;$('bracket-canvas').style.zoom=zoom/100;}});
async function boot() {
  const response=await fetch('./data/tournament.json');if(!response.ok)throw new Error('The tournament schedule could not be loaded.');data=await response.json();scenario=emptyScenario();
  try{const saved=localStorage.getItem(STORAGE_KEY);if(saved)scenario=validateScenario(data,JSON.parse(saved));}catch{notify('The saved browser scenario could not be restored. The original empty scenario is shown.',true);}
  evaluated=evaluateTournament(data,scenario);render();$('boot-message').hidden=true;$('workspace').hidden=false;saveLocal();
}
boot().catch(err=>{$('boot-message').textContent=`The planner could not start: ${err.message} Please refresh the page.`;$('boot-message').className='notice';});
