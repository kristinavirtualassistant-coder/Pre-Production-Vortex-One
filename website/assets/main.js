// Interactive samples on the Vortex One marketing page. All data is fictional and stays in the browser.
(function () {
  'use strict';
  var esc = function (s) {
    return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  };

  var S = {
    tab: 'dialer',
    callStep: 0, playing: false,
    equity: 62, years: 11, motive: 'none', absentee: true,
    stages: { dana: 'new', marcus: 'new', priya: 'contacted', walt: 'callback', elena: 'qualified', roy: 'contacted' },
    callers: 4, hours: 10, research: 8, followup: 6, share: 50,
    parcel: 'p1', enriched: {}
  };
  var timer = null;

  // ---------------------------------------------------------------- property and owner intelligence
  var parcelData = [
    { id: 'p1', address: '1428 Elm Ave, Phoenix AZ', sub: 'Single-family · absentee owner', type: 'Single-family', equity: '78% est.', owned: '14 years', absentee: 'Yes',
      owner: 'Dana R.', entity: 'Individual', mailing: 'PO Box 220, Scottsdale AZ', phone: '+1 (602) ***-**43', email: 'd***@example.com',
      signals: ['High equity', 'Long-term owner', 'Absentee owner'], score: 82 },
    { id: 'p2', address: '77 Cactus Ln, Mesa AZ', sub: 'Townhome · owner-occupied', type: 'Townhome', equity: '55% est.', owned: '6 years', absentee: 'No',
      owner: 'Marcus T.', entity: 'Individual', mailing: 'Same as property', phone: '+1 (480) ***-**17', email: 'm***@example.com',
      signals: ['Moderate equity'], score: 68 },
    { id: 'p3', address: '40 Canal St, Tempe AZ', sub: 'Small multifamily · entity owner', type: 'Multifamily (4 units)', equity: '41% est.', owned: '3 years', absentee: 'Yes',
      owner: 'Desert Row Holdings LLC', entity: 'LLC', mailing: '12 Example Plaza, Tempe AZ', phone: '+1 (480) ***-**05', email: 'i***@example.com',
      signals: ['Entity owner', 'Absentee owner'], score: 54 }
  ];

  function dl(rows) {
    return '<dl style="margin: 0; display: flex; flex-direction: column; gap: 8px">' + rows.map(function (r) {
      return '<div style="display: flex; justify-content: space-between; gap: 12px; font-size: 14px; line-height: 20px; border-bottom: 1px solid var(--line-100); padding-bottom: 8px"><dt style="color: var(--ink-200)">' + esc(r[0]) + '</dt><dd style="margin: 0; font-weight: 600; text-align: right">' + esc(r[1]) + '</dd></div>';
    }).join('') + '</dl>';
  }
  function meterClass(score) { return score >= 75 ? 'vx-score--hot' : (score < 40 ? 'vx-score--cold' : ''); }
  function meter(score, cls) {
    return '<div class="vx-score ' + cls + '"><span class="vx-score__num">' + score + '</span><div class="vx-score__track" role="img" aria-label="Score ' + score + ' out of 100"><div class="vx-score__fill" style="width: ' + score + '%"></div></div></div>';
  }

  function renderIntel() {
    var list = document.getElementById('intel-parcels');
    var card = document.getElementById('intel-record');
    if (!list || !card) return;
    list.innerHTML = parcelData.map(function (p) {
      var on = S.parcel === p.id;
      return '<button type="button" data-act="parcel" data-id="' + p.id + '" aria-pressed="' + on + '" style="text-align: left; min-height: 44px; padding: 14px 16px; border-radius: 16px; border: 1px solid ' + (on ? 'var(--accent)' : 'var(--line-100)') + '; background: ' + (on ? 'var(--accent-subtle)' : 'var(--bg-200)') + '; font: inherit; color: var(--ink-100); cursor: pointer; display: flex; flex-direction: column; gap: 2px">' +
        '<span style="font-size: 14px; line-height: 20px; font-weight: 600">' + esc(p.address) + '</span>' +
        '<span style="font-size: 12px; line-height: 16px; color: var(--ink-200)">' + esc(p.sub) + '</span></button>';
    }).join('');
    var cur = parcelData.filter(function (p) { return p.id === S.parcel; })[0] || parcelData[0];
    var done = !!S.enriched[cur.id];
    var hide = 'Not enriched yet';
    card.innerHTML =
      '<div style="display: flex; flex-wrap: wrap; align-items: center; justify-content: space-between; gap: 12px">' +
        '<h3 style="margin: 0; font-size: 18px; line-height: 28px; font-weight: 600">' + esc(cur.address) + '</h3>' +
        '<span class="vx-badge ' + (done ? 'vx-badge--success' : 'vx-badge--warning') + '">' + (done ? 'Enriched' : 'Enrichment pending') + '</span></div>' +
      '<div style="display: flex; flex-wrap: wrap; gap: 24px">' +
        '<div style="flex: 1 1 240px; min-width: 0"><p class="vx-eyebrow" style="padding-bottom: 8px">Property</p>' +
          dl([['Property type', cur.type], ['Equity', cur.equity], ['Ownership', cur.owned], ['Absentee', cur.absentee]]) + '</div>' +
        '<div style="flex: 1 1 240px; min-width: 0"><p class="vx-eyebrow" style="padding-bottom: 8px">Owner</p>' +
          dl([['Owner', cur.owner], ['Entity', cur.entity], ['Mailing address', cur.mailing], ['Phone', done ? cur.phone : hide], ['Email', done ? cur.email : hide]]) + '</div></div>' +
      '<div style="display: flex; flex-wrap: wrap; gap: 8px">' + cur.signals.map(function (s) { return '<span class="vx-badge vx-badge--accent">' + esc(s) + '</span>'; }).join('') + '</div>' +
      (done ? meter(cur.score, meterClass(cur.score)) : '') +
      '<div style="display: flex; flex-wrap: wrap; align-items: center; gap: 12px">' +
        '<button type="button" class="vx-btn vx-btn--primary vx-btn--cta" data-act="enrich" data-id="' + cur.id + '"' + (done ? ' disabled' : '') + ' style="min-height: 44px">' + (done ? 'Enriched and scored' : 'Enrich owner and score') + '</button>' +
        '<span style="font-size: 12px; line-height: 16px; color: var(--ink-300)">Demo data is fictional. Contact details are masked in read-only views.</span></div>';
  }

  // ---------------------------------------------------------------- demos
  var tabDefs = [
    { id: 'dialer', label: 'AI caller' },
    { id: 'score', label: 'Lead scoring' },
    { id: 'pipeline', label: 'Pipeline' },
    { id: 'roi', label: 'Time calculator' }
  ];
  var script = [
    { who: 'AI caller', ai: true, text: 'Hi, this is an AI assistant calling for [Your brokerage]. Am I speaking with Dana R.?' },
    { who: 'Owner', ai: false, text: "Yes. What's this about?" },
    { who: 'AI caller', ai: true, text: "I'm an AI, and I'm checking whether you'd be open to hearing about selling 1428 Elm Ave. There's no obligation." },
    { who: 'Owner', ai: false, text: 'Maybe. Call me back Thursday after 4.' },
    { who: 'AI caller', ai: true, text: 'Thursday after 4 pm, noted. A person from our team will follow up. You can ask to be removed from our list at any time.' }
  ];

  function renderTabs() {
    var el = document.getElementById('demo-tabs');
    if (!el) return;
    el.innerHTML = tabDefs.map(function (t) {
      var on = S.tab === t.id;
      return '<button type="button" data-act="tab" data-id="' + t.id + '" aria-pressed="' + on + '" style="min-height: 44px; padding: 0 20px; border-radius: 9999px; border: 1px solid ' + (on ? 'var(--accent)' : 'var(--line-200)') + '; background: ' + (on ? 'var(--accent)' : 'var(--bg-200)') + '; color: ' + (on ? '#ffffff' : 'var(--ink-100)') + '; font: inherit; font-size: 14px; font-weight: 600; cursor: pointer">' + esc(t.label) + '</button>';
    }).join('');
  }

  function dialerPanel() {
    var done = S.callStep >= script.length && !S.playing;
    var status = S.playing ? 'On call' : (done ? 'Call ended' : 'Ready');
    var badge = S.playing ? 'vx-badge--accent' : (done ? 'vx-badge--success' : '');
    var label = S.playing ? 'Call in progress' : (done ? 'Replay sample call' : 'Play sample call');
    var lines = script.slice(0, S.callStep).map(function (l) {
      return '<div style="display: flex; flex-direction: column; gap: 4px; align-items: ' + (l.ai ? 'flex-start' : 'flex-end') + '">' +
        '<span style="font-size: 11px; line-height: 16px; font-weight: 700; letter-spacing: 0.15em; text-transform: uppercase; color: var(--ink-300)">' + esc(l.who) + '</span>' +
        '<div style="max-width: 82%; padding: 10px 14px; border-radius: 12px; font-size: 14px; line-height: 20px; background: ' + (l.ai ? 'var(--accent-subtle)' : 'var(--bg-200)') + '; color: var(--ink-100); border: 1px solid var(--line-100)">' + esc(l.text) + '</div></div>';
    }).join('');
    return '<div style="display: flex; flex-wrap: wrap; gap: 20px; align-items: stretch">' +
      '<div class="vx-card vx-card--elevated" style="flex: 1 1 520px; min-width: 0; padding: 24px; display: flex; flex-direction: column; gap: 16px">' +
        '<div style="display: flex; flex-wrap: wrap; align-items: center; justify-content: space-between; gap: 12px">' +
          '<div style="display: flex; flex-direction: column; gap: 4px"><p class="vx-eyebrow">AI caller · sample data</p>' +
          '<h3 style="margin: 0; font-size: 18px; line-height: 28px; font-weight: 600">Dana R. · 1428 Elm Ave, Phoenix AZ</h3></div>' +
          '<span class="vx-badge ' + badge + '">' + status + '</span></div>' +
        '<div aria-live="polite" style="background: var(--bg-300); border: 1px solid var(--line-100); border-radius: 12px; padding: 16px; min-height: 280px; display: flex; flex-direction: column; gap: 12px">' +
          (S.callStep === 0 ? '<p style="margin: auto; text-align: center; font-size: 14px; line-height: 20px; color: var(--ink-300); max-width: 320px">Press play to hear how a sample call runs. The AI says it is an AI in its first sentence.</p>' : '') +
          lines + '</div>' +
        '<div style="display: flex; flex-wrap: wrap; gap: 12px"><button type="button" class="vx-btn vx-btn--primary vx-btn--cta" data-act="play"' + (S.playing ? ' disabled' : '') + ' style="min-height: 44px">' + label + '</button></div>' +
      '</div>' +
      '<div style="flex: 1 1 300px; min-width: 0; display: flex; flex-direction: column; gap: 20px">' +
        '<div class="vx-card" style="display: flex; flex-direction: column; gap: 12px"><p class="vx-eyebrow">Call outcome</p>' +
          (done
            ? '<div style="display: flex; flex-direction: column; gap: 12px"><div style="display: flex; flex-wrap: wrap; gap: 8px"><span class="vx-badge vx-badge--warning">Callback due</span><span class="vx-badge vx-badge--accent">AI-assigned</span></div>' +
              '<p style="margin: 0; font-size: 14px; line-height: 20px"><strong>Thursday after 4 pm.</strong> Owner is open to hearing an offer.</p>' +
              '<p style="margin: 0; font-size: 12px; line-height: 16px; color: var(--ink-300)">AI-generated summary. A person takes the follow-up.</p></div>'
            : '<p style="margin: 0; font-size: 14px; line-height: 20px; color: var(--ink-300)">Outcome, tags and the follow-up task appear here when the call ends.</p>') +
        '</div>' +
        '<div class="vx-card" style="display: flex; flex-direction: column; gap: 12px"><p class="vx-eyebrow">Guardrails on every call</p>' +
          '<ul style="margin: 0; padding-left: 20px; font-size: 14px; line-height: 20px; color: var(--ink-200); display: flex; flex-direction: column; gap: 8px">' +
          '<li>Identifies itself as an AI, never pretends to be human</li><li>No legal, financial, tax or property-management advice</li><li>No negotiating, no guaranteed outcomes</li><li>Do-not-call requests honored immediately</li></ul></div>' +
      '</div></div>';
  }

  function scoreState() {
    var motivePts = { none: 0, probate: 20, taxlien: 25, prefc: 30 };
    var motiveLabel = { none: '', probate: 'Probate filing', taxlien: 'Tax lien', prefc: 'Pre-foreclosure notice' };
    var total = Math.min(100, Math.round(S.equity * 0.35) + Math.round(Math.min(S.years, 20) / 20 * 20) + (S.absentee ? 15 : 0) + motivePts[S.motive]);
    var reasons = [];
    if (S.equity >= 50) reasons.push('High equity');
    if (S.years >= 10) reasons.push('Long ownership');
    if (S.absentee) reasons.push('Absentee owner');
    if (S.motive !== 'none') reasons.push(motiveLabel[S.motive]);
    var hot = total >= 75, cold = total < 40;
    return { total: total, band: hot ? 'Hot' : (cold ? 'Cold' : 'Warm'), badge: hot ? 'vx-badge--success' : (cold ? '' : 'vx-badge--accent'),
      meter: hot ? 'vx-score--hot' : (cold ? 'vx-score--cold' : ''), reasons: reasons.length ? reasons.join(' · ') : 'No strong signals yet' };
  }

  function scorePanel() {
    var opt = function (v, l) { return '<option value="' + v + '"' + (S.motive === v ? ' selected' : '') + '>' + l + '</option>'; };
    return '<div style="display: flex; flex-wrap: wrap; gap: 20px; align-items: stretch">' +
      '<div class="vx-card" style="flex: 1 1 420px; min-width: 0; padding: 24px; display: flex; flex-direction: column; gap: 20px">' +
        '<div style="display: flex; flex-direction: column; gap: 4px"><p class="vx-eyebrow">AI lead scoring · tune a sample lead</p>' +
        '<h3 style="margin: 0; font-size: 18px; line-height: 28px; font-weight: 600">What do we know about the owner?</h3></div>' +
        '<div><label class="vx-label" for="eq">Estimated equity: <span data-out="equity">' + S.equity + '</span>%</label><input id="eq" type="range" min="0" max="100" step="1" value="' + S.equity + '" data-in="equity"></div>' +
        '<div><label class="vx-label" for="yrs">Years owned: <span data-out="years">' + S.years + '</span></label><input id="yrs" type="range" min="0" max="40" step="1" value="' + S.years + '" data-in="years"></div>' +
        '<div><label class="vx-label" for="mot">Situation signal</label><select id="mot" class="vx-input" data-in="motive">' +
          opt('none', 'None found') + opt('probate', 'Probate filing') + opt('taxlien', 'Tax lien') + opt('prefc', 'Pre-foreclosure notice') + '</select></div>' +
        '<label for="abs" style="display: flex; align-items: center; gap: 12px; min-height: 44px; font-size: 14px; font-weight: 500; cursor: pointer">' +
          '<input id="abs" type="checkbox"' + (S.absentee ? ' checked' : '') + ' data-in="absentee" style="width: 20px; height: 20px; accent-color: var(--accent)"> Absentee owner (mailing address differs)</label>' +
      '</div>' +
      '<div style="flex: 1 1 340px; min-width: 0; display: flex; flex-direction: column; gap: 20px">' +
        '<div class="vx-card vx-card--elevated" id="score-out" style="display: flex; flex-direction: column; gap: 16px; padding: 24px"></div>' +
        '<div class="vx-card" style="display: flex; flex-direction: column; gap: 8px"><p class="vx-eyebrow">Transparent by design</p>' +
        '<p style="margin: 0; font-size: 14px; line-height: 20px; color: var(--ink-200)">Callers see the score and the reasons behind it, so they can rank the queue and challenge the model. This sample uses simple illustrative weights, not the production scoring model.</p></div>' +
      '</div></div>';
  }
  function renderScoreOut() {
    var el = document.getElementById('score-out');
    if (!el) return;
    var s = scoreState();
    el.innerHTML = '<div style="display: flex; flex-wrap: wrap; align-items: center; justify-content: space-between; gap: 8px"><p class="vx-eyebrow">Qualification score</p><span class="vx-badge ' + s.badge + '">' + s.band + '</span></div>' +
      meter(s.total, s.meter) + '<p style="margin: 0; font-size: 12px; line-height: 16px; color: var(--ink-200)">' + esc(s.reasons) + '</p>';
  }

  var order = ['new', 'contacted', 'callback', 'qualified'];
  var stageLabels = { new: 'New', contacted: 'Contacted', callback: 'Callback', qualified: 'Qualified' };
  var leads = [
    { id: 'dana', name: 'Dana R.', address: '1428 Elm Ave, Phoenix AZ', score: 82 },
    { id: 'marcus', name: 'Marcus T.', address: '77 Cactus Ln, Mesa AZ', score: 68 },
    { id: 'priya', name: 'Priya N.', address: '310 Palm Ct, Tempe AZ', score: 54 },
    { id: 'walt', name: 'Walt K.', address: '9 Saguaro Rd, Gilbert AZ', score: 41 },
    { id: 'elena', name: 'Elena V.', address: '22 Mesa Dr, Chandler AZ', score: 91 },
    { id: 'roy', name: 'Roy P.', address: '5 Desert Way, Peoria AZ', score: 33, dnc: true }
  ];
  function pipelinePanel() {
    var cols = order.map(function (stage, si) {
      var cards = leads.filter(function (l) { return S.stages[l.id] === stage; }).map(function (l) {
        var isLast = si === order.length - 1, locked = !!l.dnc, badge, cls;
        if (locked) { badge = 'Do not call'; cls = 'vx-badge--danger'; }
        else if (isLast) { badge = 'Qualified'; cls = 'vx-badge--success'; }
        else if (l.score >= 75) { badge = 'Hot'; cls = 'vx-badge--success'; }
        else if (l.score >= 40) { badge = 'Warm'; cls = 'vx-badge--accent'; }
        else { badge = 'Cold'; cls = ''; }
        return '<div class="vx-card" style="padding: 16px; display: flex; flex-direction: column; gap: 12px">' +
          '<div style="display: flex; flex-direction: column; gap: 2px"><span style="font-size: 14px; line-height: 20px; font-weight: 600">' + esc(l.name) + '</span><span style="font-size: 12px; line-height: 16px; color: var(--ink-300)">' + esc(l.address) + '</span></div>' +
          '<div style="display: flex; flex-wrap: wrap; align-items: center; gap: 8px"><span class="vx-badge ' + cls + '">' + badge + '</span><span style="font-size: 12px; line-height: 16px; font-weight: 600; color: var(--ink-200)">Score ' + l.score + '</span></div>' +
          (!locked && !isLast ? '<button type="button" class="vx-btn vx-btn--secondary" data-act="move" data-id="' + l.id + '" data-to="' + order[si + 1] + '" style="min-height: 44px; justify-content: center">Move to ' + stageLabels[order[si + 1]] + '</button>' : '') +
          '</div>';
      });
      return '<div style="flex: 1 1 240px; min-width: 0; background: var(--bg-400); border-radius: 16px; padding: 12px; display: flex; flex-direction: column; gap: 12px">' +
        '<div style="display: flex; align-items: center; justify-content: space-between; padding: 4px 4px 0"><h3 style="margin: 0; font-size: 12px; line-height: 16px; font-weight: 700; letter-spacing: 0.05em; text-transform: uppercase; color: var(--ink-200)">' + stageLabels[stage] + '</h3>' +
        '<span style="font-size: 12px; line-height: 16px; font-weight: 600; color: var(--ink-200)">' + cards.length + '</span></div>' + cards.join('') + '</div>';
    });
    return '<div style="display: flex; flex-direction: column; gap: 16px"><p style="margin: 0; font-size: 14px; line-height: 20px; color: var(--ink-200)">Move leads through the stages. The do-not-call lead stays locked everywhere it appears.</p>' +
      '<div style="display: flex; flex-wrap: wrap; gap: 16px; align-items: flex-start">' + cols.join('') + '</div></div>';
  }

  var roiFields = [
    ['callers', 'cal', 'Team members: ', '', 1, 20, 1],
    ['hours', 'hrs', 'Manual calling, hours each per week: ', '', 0, 30, 1],
    ['research', 'rsh', 'Property and owner research, hours each per week: ', '', 0, 30, 1],
    ['followup', 'fol', 'Manual follow-up, hours each per week: ', '', 0, 30, 1],
    ['share', 'shr', 'Share of that work done inside Vortex One instead: ', '%', 0, 100, 5]
  ];
  function roiPanel() {
    return '<div style="display: flex; flex-wrap: wrap; gap: 20px; align-items: stretch">' +
      '<div class="vx-card" style="flex: 1 1 420px; min-width: 0; padding: 24px; display: flex; flex-direction: column; gap: 20px">' +
        '<div style="display: flex; flex-direction: column; gap: 4px"><p class="vx-eyebrow">Time calculator · your assumptions</p>' +
        '<h3 style="margin: 0; font-size: 18px; line-height: 28px; font-weight: 600">Where does your team\'s week go today?</h3></div>' +
        roiFields.map(function (f) {
          return '<div><label class="vx-label" for="' + f[1] + '">' + f[2] + '<span data-out="' + f[0] + '">' + S[f[0]] + '</span>' + f[3] + '</label>' +
            '<input id="' + f[1] + '" type="range" min="' + f[4] + '" max="' + f[5] + '" step="' + f[6] + '" value="' + S[f[0]] + '" data-in="' + f[0] + '"></div>';
        }).join('') +
      '</div>' +
      '<div class="vx-card vx-card--elevated" id="roi-out" style="flex: 1 1 340px; min-width: 0; padding: 24px; display: flex; flex-direction: column; justify-content: center; gap: 12px"></div></div>';
  }
  function renderRoiOut() {
    var el = document.getElementById('roi-out');
    if (!el) return;
    var total = S.hours + S.research + S.followup;
    var back = Math.round(S.callers * total * S.share / 100);
    el.innerHTML = '<p class="vx-eyebrow">Estimated time saved per week</p>' +
      '<p style="margin: 0; font-size: 56px; line-height: 1.05; font-weight: 900; letter-spacing: -0.025em; color: var(--accent-text); font-variant-numeric: tabular-nums">' + back + ' hrs</p>' +
      '<p style="margin: 0; font-size: 14px; line-height: 20px; color: var(--ink-200)">' + S.callers + ' people × ' + total + ' manual hours × ' + S.share + '% done in Vortex One. That is time, not revenue.</p>' +
      '<p style="margin: 0; font-size: 12px; line-height: 16px; color: var(--ink-300)">Arithmetic on the numbers you set. Not a benchmark, a forecast or a promise of results.</p>';
  }

  function renderDemo() {
    renderTabs();
    var el = document.getElementById('demo-panel');
    if (!el) return;
    if (S.tab === 'dialer') el.innerHTML = dialerPanel();
    else if (S.tab === 'score') { el.innerHTML = scorePanel(); renderScoreOut(); }
    else if (S.tab === 'pipeline') el.innerHTML = pipelinePanel();
    else { el.innerHTML = roiPanel(); renderRoiOut(); }
  }

  function playCall() {
    if (timer) clearInterval(timer);
    S.callStep = 1; S.playing = true; renderDemo();
    timer = setInterval(function () {
      var n = S.callStep + 1;
      if (n >= script.length) { clearInterval(timer); timer = null; S.callStep = script.length; S.playing = false; }
      else S.callStep = n;
      if (S.tab === 'dialer') renderDemo();
    }, 1600);
  }

  // ---------------------------------------------------------------- events
  document.addEventListener('click', function (e) {
    var t = e.target.closest ? e.target.closest('[data-act]') : null;
    if (!t || t.disabled) return;
    var act = t.getAttribute('data-act'), id = t.getAttribute('data-id');
    if (act === 'parcel') { S.parcel = id; renderIntel(); }
    else if (act === 'enrich') { S.enriched[id] = true; renderIntel(); }
    else if (act === 'tab') { S.tab = id; renderDemo(); }
    else if (act === 'play') playCall();
    else if (act === 'move') { S.stages[id] = t.getAttribute('data-to'); renderDemo(); }
  });
  function onInput(e) {
    var t = e.target, key = t && t.getAttribute ? t.getAttribute('data-in') : null;
    if (!key) return;
    if (key === 'absentee') S.absentee = !!t.checked;
    else if (key === 'motive') S.motive = t.value;
    else S[key] = Number(t.value);
    var out = document.querySelector('[data-out="' + key + '"]');
    if (out) out.textContent = String(S[key]);
    if (S.tab === 'score') renderScoreOut(); else if (S.tab === 'roi') renderRoiOut();
  }
  document.addEventListener('input', onInput);
  document.addEventListener('change', onInput);

  renderIntel();
  renderDemo();
})();
