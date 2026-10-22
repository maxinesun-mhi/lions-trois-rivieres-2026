/**
 * Render the verified tournament DAG as a standalone, downloadable SVG.
 * The caller delegates click and Enter/Space handling on .bracket-node[data-game].
 * All dynamic text is escaped. This renderer never changes data or evaluated.
 */
export function bracketSvg(data, evaluated, keep = null) {
  if (!Array.isArray(evaluated)) throw new TypeError('evaluated must be an array of games.');

  const esc = (value) => String(value ?? '')
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, '')
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  const field = (row, name, fallback = '') => {
    const value = row?.[name];
    return value == null || String(value) === '' ? fallback : String(value);
  };
  const ids = (values) => [...new Set((Array.isArray(values) ? values : [values])
    .filter(value => value != null && String(value) !== '').map(String))];
  const clip = (text, size) => [...text].slice(0, size).join('');
  const wrap = (value, width = 26, maxLines = 2) => {
    const words = String(value || 'To be determined').trim().replace(/\s+/g, ' ').split(' ');
    const lines = [];
    let current = '';
    for (let word of words) {
      if ([...word].length > width) word = `${clip(word, width - 1)}…`;
      const next = current ? `${current} ${word}` : word;
      if ([...next].length > width && current) {
        lines.push(current);
        current = word;
      } else current = next;
    }
    lines.push(current);
    if (lines.length > maxLines) {
      return [...lines.slice(0, maxLines - 1), `${clip(lines[maxLines - 1], width - 1)}…`];
    }
    return lines;
  };
  const dateLabel = (value) => {
    const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(value));
    if (!match) return String(value ?? '');
    const month = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'][Number(match[2]) - 1];
    return month ? `${Number(match[3])} ${month}` : String(value);
  };

  const rows = new Map(evaluated.map(row => [Number(row.game_no), row]));
  const candidates = evaluated.candidates || {};
  const cache = new Map();
  const entrantSets = (gameNo, visited = new Set()) => {
    const n = Number(gameNo);
    if (cache.has(n)) return cache.get(n);
    if (visited.has(n) || !rows.has(n)) return { a: [], b: [] };
    const supplied = candidates[n];
    if (supplied && Array.isArray(supplied.a) && Array.isArray(supplied.b)) {
      const sets = { a: ids(supplied.a), b: ids(supplied.b) };
      cache.set(n, sets);
      return sets;
    }
    // Fallback permits a plain evaluated array without the optional metadata.
    const nextVisited = new Set(visited).add(n);
    const row = rows.get(n);
    const resolve = (side) => {
      const team = field(row, `team_${side}`);
      if (team) return [team];
      const type = field(row, `${side}_type`);
      const ref = field(row, `${side}_ref`);
      if (type === 'seed') return ids(ref);
      if (!['winner', 'loser'].includes(type)) return [];
      const source = rows.get(Number(ref));
      if (!source) return [];
      const outcome = field(source, type);
      if (outcome) return [outcome];
      if (field(source, 'winner')) return [];
      const sets = entrantSets(Number(ref), nextVisited);
      return ids([...sets.a, ...sets.b]);
    };
    const sets = { a: resolve('a'), b: resolve('b') };
    cache.set(n, sets);
    return sets;
  };
  const edgeHasLions = (sourceNo, outcome) => {
    const row = rows.get(Number(sourceNo));
    if (!row) return false;
    const result = field(row, outcome);
    if (result) return result === 'lions';
    if (field(row, 'winner')) return false;
    const supplied = candidates[sourceNo];
    if (supplied && Object.hasOwn(supplied, outcome)) return ids(supplied[outcome]).includes('lions');
    const sets = entrantSets(sourceNo);
    return [...sets.a, ...sets.b].includes('lions');
  };

  const range = (a, b) => Array.from({ length: b - a + 1 }, (_, i) => a + i);
  const definitions = [
    [range(1, 11), 'Opening · #1–11'],
    [range(12, 22), 'Crossovers · #12–22'],
    [range(23, 34), 'Qualification · #23–34'],
    [range(35, 38), 'Playoffs · #35–38'],
    [range(39, 42), 'Playoffs · #39–42'],
    [range(43, 44), 'Semi-finals · #43–44'],
    [[45], 'Final · #45']
  ];
  const keepSet = keep == null ? null : new Set([...keep].map(Number));
  const visible = new Set(evaluated.map(row => Number(row.game_no))
    .filter(n => keepSet == null || keepSet.has(n)));
  const groups = definitions.map(([games, title]) => ({ games: games.filter(n => visible.has(n)), title }))
    .filter(group => group.games.length);
  if (!groups.length) {
    return '<svg xmlns="http://www.w3.org/2000/svg" role="img" aria-labelledby="bracket-title" width="600" height="100" viewBox="0 0 600 100"><title id="bracket-title">Tournament bracket</title><text x="20" y="50" font-family="system-ui,sans-serif" fill="#111111">No games in this view.</text></svg>';
  }

  const cardW = 244, cardH = 152, gapX = 112, pitchY = 180, marginX = 26, top = 86;
  const maxRows = Math.max(...groups.map(group => group.games.length));
  const width = marginX * 2 + groups.length * cardW + (groups.length - 1) * gapX;
  const height = top + (maxRows - 1) * pitchY + cardH + 28;
  const positions = new Map();
  groups.forEach((group, column) => {
    const offset = (maxRows - group.games.length) * pitchY / 2;
    group.games.forEach((n, index) => positions.set(n, {
      x: marginX + column * (cardW + gapX), y: top + offset + index * pitchY
    }));
  });
  const out = [
    `<svg xmlns="http://www.w3.org/2000/svg" class="tournament-bracket" role="group" aria-labelledby="bracket-title bracket-desc" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">`,
    '<title id="bracket-title">Challenge M13 AAA Élite Trois-Rivières tournament bracket, 12–15 November 2026</title>',
    '<desc id="bracket-desc">Games proceed from left to right. Solid arrows carry winners and dashed arrows carry losers. Thick black arrows show available Lions Lac St-Louis routes under the current results. A solid black card border means the Lions are a confirmed entrant; a dashed black border means they are a possible entrant. Game 34 is conditional in the source. Select a game card to edit its result, using Enter or Space when focused. The complete schedule, scores, and team names are included in each card title.</desc>',
    '<defs><marker id="arrow-normal" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="5" markerHeight="5" orient="auto-start-reverse"><path d="M 0 0 L 10 5 L 0 10 z" fill="#aaaaaa"/></marker><marker id="arrow-lions" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="5" markerHeight="5" orient="auto-start-reverse"><path d="M 0 0 L 10 5 L 0 10 z" fill="#000000"/></marker></defs>',
    '<style>.tournament-bracket{font-family:system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif}.bracket-node{cursor:pointer;outline:none}.bracket-node:hover .node-card,.bracket-node:focus .node-card{stroke:#000000;stroke-width:3.5}.bracket-node text{pointer-events:none}.bracket-node.is-selected .node-card{stroke:#000000;stroke-width:4}.bracket-edge{fill:none;pointer-events:none}.bracket-edge-label{font-size:9px;paint-order:stroke;stroke:#f5f5f5;stroke-width:3px;stroke-linejoin:round}</style>',
    `<rect width="${width}" height="${height}" fill="#f5f5f5"/>`,
    '<text x="26" y="23" fill="#444444" font-size="11">Solid arrows: winner · Dashed arrows: loser · Black: Lions route · Select a game to edit</text>'
  ];
  groups.forEach((group, column) => {
    out.push(`<text x="${marginX + column * (cardW + gapX)}" y="57" fill="#111111" font-size="14" font-weight="700">${esc(group.title)}</text>`);
  });

  const edges = { normal: [], lions: [] };
  for (const n of visible) {
    const target = positions.get(n), row = rows.get(n);
    if (!target || !row) continue;
    for (const side of ['a', 'b']) {
      const type = field(row, `${side}_type`), sourceNo = Number(field(row, `${side}_ref`));
      if (!['winner', 'loser'].includes(type) || !visible.has(sourceNo)) continue;
      const source = positions.get(sourceNo);
      if (!source) continue;
      const isLions = edgeHasLions(sourceNo, type);
      const x1 = source.x + cardW, y1 = source.y + cardH / 2 + (type === 'loser' ? 12 : -12);
      const x2 = target.x - 3, y2 = target.y + (side === 'a' ? 69 : 109);
      const bend = Math.max(36, (x2 - x1) * 0.48);
      const color = isLions ? '#000000' : '#aaaaaa';
      const label = `${type === 'winner' ? 'W' : 'L'}#${sourceNo}`;
      const description = `${type === 'winner' ? 'Winner' : 'Loser'} of game #${sourceNo} to game #${n}, side ${side.toUpperCase()}${isLions ? '; available Lions route' : ''}`;
      const markup = `<g class="bracket-connection${isLions ? ' lions-route' : ''}" data-from="${sourceNo}" data-to="${n}" data-outcome="${type}"><title>${esc(description)}</title>` +
        `<path class="bracket-edge" d="M ${x1} ${y1} C ${x1 + bend} ${y1}, ${x2 - bend} ${y2}, ${x2} ${y2}" stroke="${color}" stroke-width="${isLions ? 2.8 : 1.2}" ${type === 'loser' ? 'stroke-dasharray="6 5"' : ''} marker-end="url(#arrow-${isLions ? 'lions' : 'normal'})"/>` +
        `<text class="bracket-edge-label" x="${x2 - 5}" y="${y2 - 6}" text-anchor="end" fill="${color}">${esc(label)}</text></g>`;
      edges[isLions ? 'lions' : 'normal'].push(markup);
    }
  }
  out.push(...edges.normal, ...edges.lions);

  for (const [n, position] of positions) {
    const row = rows.get(n), sets = entrantSets(n);
    const confirmed = [field(row, 'team_a'), field(row, 'team_b')].includes('lions');
    const possible = !confirmed && [...sets.a, ...sets.b].includes('lions');
    const conditional = n === 34;
    const border = confirmed || possible ? '#000000' : conditional ? '#666666' : '#cccccc';
    const fill = confirmed ? '#eeeeee' : conditional ? '#f7f7f7' : '#ffffff';
    const dash = possible ? 'stroke-dasharray="7 4"' : conditional ? 'stroke-dasharray="3 4"' : '';
    const nameA = field(row, 'name_a', 'Unspecified in source'), nameB = field(row, 'name_b', 'To be determined');
    const schedule = `${dateLabel(field(row, 'date'))} · ${field(row, 'time')}`;
    const venue = field(row, 'arena'), rawState = field(row, 'status', 'Unresolved');
    const state = conditional && !rawState.toLowerCase().startsWith('conditional') ? `Conditional · ${rawState}` : rawState;
    const scoreA = field(row, 'score_a'), scoreB = field(row, 'score_b');
    const scoreDescription = scoreA !== '' && scoreB !== '' ? ` Score ${scoreA}–${scoreB}.` : '';
    const fullTitle = `Game #${n} (${field(row, 'official_id')}) — ${field(row, 'date')} ${field(row, 'time')} · ${venue}. ${nameA} vs ${nameB}.${scoreDescription} ${state}${confirmed ? '. Lions confirmed in this game.' : possible ? '. Lions can reach this game.' : ''}`;
    const classes = ['bracket-node', confirmed ? 'lions-confirmed' : possible ? 'lions-possible' : '', conditional ? 'conditional-game' : ''].filter(Boolean).join(' ');
    const { x, y } = position;
    out.push(`<g class="${classes}" data-game="${n}" role="button" tabindex="0" aria-label="${esc(fullTitle)}"><title>${esc(fullTitle)}</title>`,
      `<rect class="node-card" x="${x}" y="${y}" width="${cardW}" height="${cardH}" rx="10" fill="${fill}" stroke="${border}" stroke-width="${confirmed || possible ? 2.5 : 1.3}" ${dash}/>`,
      `<text x="${x + 12}" y="${y + 19}" fill="#111111" font-size="12" font-weight="750">#${n} <tspan fill="#666666" font-size="9" font-weight="400">· ${esc(field(row, 'official_id'))}</tspan></text>`,
      `<text x="${x + 12}" y="${y + 35}" fill="#444444" font-size="10">${esc(schedule)}</text>`,
      `<text x="${x + 12}" y="${y + 48}" fill="#666666" font-size="9">${esc(venue)}</text>`,
      `<line x1="${x + 12}" x2="${x + cardW - 12}" y1="${y + 89}" y2="${y + 89}" stroke="#e5e5e5"/>`);
    if (conditional) out.push(`<text x="${x + cardW - 12}" y="${y + 19}" text-anchor="end" fill="#555555" font-size="9" font-weight="700">COND.</text>`);
    else if (confirmed || possible) out.push(`<text x="${x + cardW - 12}" y="${y + 19}" text-anchor="end" fill="#000000" font-size="9" font-weight="700">${confirmed ? 'LIONS' : 'LIONS?'}</text>`);
    for (const side of ['a', 'b']) {
      const label = side === 'a' ? nameA : nameB, lines = wrap(label);
      const lineY = y + (side === 'a' ? 68 : 108), isLions = field(row, `team_${side}`) === 'lions';
      out.push(`<text x="${x + 12}" y="${lineY}" fill="${isLions ? '#000000' : '#111111'}" font-size="10.5" font-weight="${isLions ? 750 : 550}">`);
      lines.forEach((line, index) => out.push(`<tspan x="${x + 12}" dy="${index === 0 ? 0 : 12}">${esc(line)}</tspan>`));
      out.push('</text>');
      const score = field(row, `score_${side}`);
      if (score !== '') out.push(`<text x="${x + cardW - 12}" y="${lineY + 3}" text-anchor="end" fill="#000000" font-size="15" font-weight="750">${esc(score)}</text>`);
    }
    out.push(`<text x="${x + 12}" y="${y + 140}" fill="${conditional ? '#555555' : '#666666'}" font-size="9">${esc(wrap(state, 36, 1)[0])}</text></g>`);
  }
  return [...out, '</svg>'].join('\n');
}
