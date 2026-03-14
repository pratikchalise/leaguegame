// =============================================
// MANAGER MODE CORE SYSTEM
// =============================================

const MANAGER_STORAGE_KEY = "ls-manager-state-v2";

let managerState = {
  selectedTeamId: null,
  managerName: "You",
  profile: {
    style: "balanced",
    reputation: 50,
    pressure: 20,
    confidence: 60,
    adaptability: 55,
    mediaHandling: 50,
  },
  board: {
    trust: 55,
    fanSupport: 50,
    objectivesCompleted: 0,
    objectivesFailed: 0,
  },
  finance: {
    balance: 120000000,
    wageBudgetWeekly: 1800000,
    transferBudget: 85000000,
    sponsorMorale: 55,
    lastWeekIncome: 0,
    lastWeekExpense: 0,
    lastFinanceUpdatePlayed: -1,
  },
  squad: {
    morale: 60,
    cohesion: 55,
    stamina: 70,
    fitnessFocus: "balanced",
    captain: null,
    viceCaptain: null,
  },
  tactics: {
    mentality: "balanced",
    pressIntensity: 55,
    defensiveLine: 52,
    tempo: 58,
    width: 50,
    creativeFreedom: 55,
    setPieceFocus: "mixed",
  },
  facilities: {
    trainingGround: 1,
    youthAcademy: 1,
    medicalCenter: 1,
    analysisLab: 1,
    scoutingDept: 1,
  },
  transfer: {
    shortlist: [],
    soldPlayers: [],
    boughtPlayers: [],
    scoutingKnowledge: {},
  },
  history: {
    matchPlansUsed: 0,
    trainingSessions: 0,
    transferActions: 0,
    meetingsHeld: 0,
  },
  inbox: [],
  boardObjectives: [],
  createdAt: Date.now(),
  updatedAt: Date.now(),
};

const MANAGER_MATCH_PLANS = {
  conservative: {
    label: "🛡️ Conservative",
    moraleDelta: 2,
    staminaDelta: 4,
    risk: -4,
    matchBoost: 2,
    fitnessCost: -1,
  },
  balanced: {
    label: "⚖️ Balanced",
    moraleDelta: 1,
    staminaDelta: 1,
    risk: 0,
    matchBoost: 3,
    fitnessCost: -2,
  },
  attacking: {
    label: "⚔️ Attacking",
    moraleDelta: 3,
    staminaDelta: -2,
    risk: 4,
    matchBoost: 5,
    fitnessCost: -4,
  },
  allout: {
    label: "🔥 All Out",
    moraleDelta: 4,
    staminaDelta: -6,
    risk: 8,
    matchBoost: 7,
    fitnessCost: -6,
  },
};

const MANAGER_WEEKLY_EVENTS = [
  { id: "media-positive", title: "📺 Positive Media Cycle", trust: 3, fan: 4, finance: 1200000 },
  { id: "media-pressure", title: "🗞️ Tough Press Questions", trust: -2, fan: -1, finance: -350000 },
  { id: "sponsor-bonus", title: "🤝 Sponsor Milestone", trust: 1, fan: 2, finance: 2500000 },
  { id: "minor-injury-wave", title: "🩹 Minor Injury Week", trust: -1, fan: -1, finance: -700000 },
  { id: "academy-rising", title: "🌱 Academy Buzz", trust: 2, fan: 3, finance: 350000 },
  { id: "fan-backlash", title: "😤 Fan Backlash", trust: -4, fan: -5, finance: -950000 },
  { id: "cup-hype", title: "🏆 Matchday Hype", trust: 2, fan: 5, finance: 900000 },
  { id: "board-doubt", title: "📉 Board Doubt", trust: -5, fan: -2, finance: -1000000 },
];

function clampManagerValue(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function saveManagerState() {
  managerState.updatedAt = Date.now();
  localStorage.setItem(MANAGER_STORAGE_KEY, JSON.stringify(managerState));
}

function loadManagerState() {
  try {
    const raw = localStorage.getItem(MANAGER_STORAGE_KEY);
    if (!raw) return;
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object") return;
    managerState = {
      ...managerState,
      ...parsed,
      profile: { ...managerState.profile, ...(parsed.profile || {}) },
      board: { ...managerState.board, ...(parsed.board || {}) },
      finance: { ...managerState.finance, ...(parsed.finance || {}) },
      squad: { ...managerState.squad, ...(parsed.squad || {}) },
      tactics: { ...managerState.tactics, ...(parsed.tactics || {}) },
      facilities: { ...managerState.facilities, ...(parsed.facilities || {}) },
      transfer: { ...managerState.transfer, ...(parsed.transfer || {}) },
      history: { ...managerState.history, ...(parsed.history || {}) },
      inbox: Array.isArray(parsed.inbox) ? parsed.inbox : [],
      boardObjectives: Array.isArray(parsed.boardObjectives) ? parsed.boardObjectives : [],
    };
  } catch (e) {
    console.warn("Manager state load failed:", e);
  }
}

function ensureManagerState() {
  loadManagerState();
  if (!Array.isArray(managerState.inbox)) managerState.inbox = [];
  if (!Array.isArray(managerState.boardObjectives)) managerState.boardObjectives = [];
  if (!managerState.createdAt) managerState.createdAt = Date.now();
  saveManagerState();
}

function getManagerSelectedTeam() {
  if (!Array.isArray(teams) || teams.length === 0) return null;
  return teams.find((t) => t.id === managerState.selectedTeamId) || null;
}

function setManagerSelectedTeam(teamId, options = {}) {
  const { silent = false, reason = "selection" } = options;
  if (!Array.isArray(teams) || teams.length === 0) return false;
  const team = teams.find((t) => t.id === teamId);
  if (!team) return false;

  managerState.selectedTeamId = teamId;
  managerState.board.trust = clampManagerValue(managerState.board.trust + 1, 0, 100);
  managerState.profile.confidence = clampManagerValue(managerState.profile.confidence + 1, 0, 100);

  pushManagerInbox(`✅ You are now managing ${team.name}. (${reason})`, "info");
  syncManagerSelectionsUI();
  saveManagerState();

  if (!silent) {
    alert(`Manager team set to ${team.name}`);
  }
  return true;
}

function pushManagerInbox(text, kind = "info") {
  managerState.inbox.unshift({
    id: "msg-" + Date.now() + "-" + Math.floor(Math.random() * 10000),
    text,
    kind,
    timestamp: Date.now(),
  });
  managerState.inbox = managerState.inbox.slice(0, 80);
}

function buildHomeManagerSelectMarkup() {
  const countInput = document.getElementById("teamCount");
  const count = countInput ? parseInt(countInput.value) : 0;
  const safeCount = isNaN(count) ? 0 : count;

  let options = `<option value="">No team selected</option>`;
  for (let i = 0; i < safeCount; i++) {
    const teamInput = document.getElementById(`teamNameInput${i}`);
    const label = teamInput && teamInput.value.trim() ? teamInput.value.trim() : `Team ${i + 1}`;
    options += `<option value="${i}">${label}</option>`;
  }

  return `
    <label>Manager Team (optional)</label>
    <select id="homeManagerSelect" onchange="onHomeManagerSelectChange()">${options}</select>
    <small style="display:block; margin-top:6px; color:var(--text-muted);">Pick a team now and carry your manager profile into the league.</small>
  `;
}

function renderHomeManagerSelect() {
  const wrap = document.getElementById("homeManagerSelectWrap");
  if (!wrap) return;
  wrap.innerHTML = buildHomeManagerSelectMarkup();
}

function onHomeManagerSelectChange() {
  const select = document.getElementById("homeManagerSelect");
  if (!select) return;
  const idx = select.value === "" ? null : parseInt(select.value);
  if (idx === null || isNaN(idx)) return;

  // Store pending choice by index; actual team id is known after generation
  managerState.pendingTeamIndex = idx;
  saveManagerState();
}

function applyManagerSetupSelectionAfterTeamCreation() {
  if (!Array.isArray(teams) || teams.length === 0) return;

  const select = document.getElementById("homeManagerSelect");
  const selectedIndex = select && select.value !== "" ? parseInt(select.value) : managerState.pendingTeamIndex;

  if (selectedIndex === null || selectedIndex === undefined || isNaN(selectedIndex)) {
    saveManagerState();
    return;
  }

  const selectedTeam = teams[selectedIndex];
  if (!selectedTeam) return;

  managerState.pendingTeamIndex = null;
  setManagerSelectedTeam(selectedTeam.id, { silent: true, reason: "home-page preselect" });
}

function renderSimulationTeamSelect(homeTeam, awayTeam) {
  // Requested UX: manager team selection should happen before/while tournament, not during a match.
  return ``;
}

function onSimulationManagerSelectChange() {
  const select = document.getElementById("simManagerTeamSelect");
  if (!select) return;
  const id = parseInt(select.value);
  if (isNaN(id)) return;
  if (!setManagerSelectedTeam(id, { silent: true, reason: "in-simulation" })) return;

  if (typeof addSimEvent === "function" && typeof simState !== "undefined" && simState) {
    const t = teams.find((x) => x.id === id);
    if (t) addSimEvent("event", `🧠 Tactical command switched to ${t.name}`, id === simState.homeTeam.id ? "home" : "away");
  }
}

function syncManagerSelectionsUI() {
  const selected = managerState.selectedTeamId;

  const simSelect = document.getElementById("simManagerTeamSelect");
  if (simSelect) {
    for (const opt of simSelect.options) {
      opt.selected = parseInt(opt.value) === selected;
    }
  }

  const hubSelect = document.getElementById("managerTeamSelectHub");
  if (hubSelect) {
    for (const opt of hubSelect.options) {
      opt.selected = parseInt(opt.value) === selected;
    }
  }

  const tournamentSelect = document.getElementById("tournamentManagerTeamSelect");
  if (tournamentSelect) {
    for (const opt of tournamentSelect.options) {
      opt.selected = parseInt(opt.value) === selected;
    }
  }
}

function onTournamentManagerTeamChange() {
  const select = document.getElementById("tournamentManagerTeamSelect");
  if (!select) return;
  const id = parseInt(select.value);
  if (isNaN(id)) return;
  setManagerSelectedTeam(id, { silent: true, reason: "tournament ui" });
  if (typeof renderLeagueUI === "function") renderLeagueUI();
}

function renderTournamentManagerControl() {
  const options = (Array.isArray(teams) ? teams : []).map(
    (t) => `<option value="${t.id}" ${t.id === managerState.selectedTeamId ? "selected" : ""}>${t.name}</option>`
  ).join("");

  return `
    <div class="manager-tournament-select-wrap">
      <label>Managed Team</label>
      <select id="tournamentManagerTeamSelect" onchange="onTournamentManagerTeamChange()">${options}</select>
    </div>
  `;
}

function getManagerMatchInfluence(homeTeam, awayTeam) {
  const selected = managerState.selectedTeamId;
  const noBoost = { home: 0, away: 0, notes: [] };
  if (selected === null || selected === undefined) return noBoost;

  const selectedIsHome = selected === homeTeam.id;
  const selectedIsAway = selected === awayTeam.id;
  if (!selectedIsHome && !selectedIsAway) return noBoost;

  const trustFactor = (managerState.board.trust - 50) / 14;
  const confidenceFactor = (managerState.profile.confidence - 50) / 15;
  const cohesionFactor = (managerState.squad.cohesion - 50) / 12;
  const tacticFactor = (managerState.tactics.mentality === "attacking" ? 1.6 : managerState.tactics.mentality === "defensive" ? 1.2 : 1.4);
  const facilityFactor = (managerState.facilities.analysisLab + managerState.facilities.trainingGround) * 0.25;

  const totalBoost = clampManagerValue(Math.round(trustFactor + confidenceFactor + cohesionFactor + tacticFactor + facilityFactor), -6, 12);

  const notes = [
    `Manager boost applied (${totalBoost >= 0 ? "+" : ""}${totalBoost} rating edge from tactics + morale)`
  ];

  if (selectedIsHome) return { home: totalBoost, away: 0, notes };
  return { home: 0, away: totalBoost, notes };
}

function managerWeeklyTick() {
  // Trigger occasional manager events after simulated results
  if (Math.random() > 0.32) return;

  const event = MANAGER_WEEKLY_EVENTS[randomInt(0, MANAGER_WEEKLY_EVENTS.length - 1)];
  if (!event) return;

  managerState.board.trust = clampManagerValue(managerState.board.trust + event.trust, 0, 100);
  managerState.board.fanSupport = clampManagerValue(managerState.board.fanSupport + event.fan, 0, 100);
  managerState.finance.balance = Math.max(0, managerState.finance.balance + event.finance);

  pushManagerInbox(`${event.title}: Trust ${event.trust >= 0 ? "+" : ""}${event.trust}, Fans ${event.fan >= 0 ? "+" : ""}${event.fan}, Finance ${event.finance >= 0 ? "+$" : "-$"}${Math.abs(event.finance).toLocaleString()}`, event.trust >= 0 ? "success" : "warning");
  saveManagerState();
}

function onManagerPostMatchUpdate(match) {
  const team = getManagerSelectedTeam();
  if (!team || !match) return;

  const isHome = match.home && match.home.id === team.id;
  const isAway = match.away && match.away.id === team.id;
  if (!isHome && !isAway) return;

  const gf = isHome ? (match.homeScore ?? 0) : (match.awayScore ?? 0);
  const ga = isHome ? (match.awayScore ?? 0) : (match.homeScore ?? 0);

  if (team.finance) {
    syncManagerFinanceWithTeam(team);
  }

  if (gf > ga) {
    managerState.board.trust = clampManagerValue(managerState.board.trust + 2, 0, 100);
    managerState.squad.morale = clampManagerValue(managerState.squad.morale + 2, 0, 100);
    pushManagerInbox(`✅ Result boost: ${team.name} won ${gf}-${ga}. Trust and morale improved.`, "success");
  } else if (gf < ga) {
    managerState.board.trust = clampManagerValue(managerState.board.trust - 2, 0, 100);
    managerState.squad.morale = clampManagerValue(managerState.squad.morale - 2, 0, 100);
    pushManagerInbox(`⚠️ Result hit: ${team.name} lost ${gf}-${ga}. Trust and morale dropped.`, "warning");
  } else {
    managerState.board.trust = clampManagerValue(managerState.board.trust - 1, 0, 100);
    pushManagerInbox(`🤝 Draw: ${team.name} drew ${gf}-${ga}. Board expects more.`, "info");
  }

  saveManagerState();
}

function getManagedTeamAverageRating(team) {
  if (!team || !Array.isArray(team.players) || team.players.length === 0) return 0;
  return team.players.reduce((s, p) => s + (p.rating || 70), 0) / team.players.length;
}

function syncManagerFinanceWithTeam(team) {
  if (!team || !team.finance) return;
  managerState.finance.balance = team.finance.balance;
  managerState.finance.transferBudget = team.finance.transferBudget;
  managerState.finance.wageBudgetWeekly = team.finance.wageBudgetWeekly;
}

function syncTeamFinanceWithManager(team) {
  if (!team) return;
  if (!team.finance) team.finance = {};
  team.finance.balance = Math.max(0, Math.round(managerState.finance.balance || 0));
  team.finance.transferBudget = Math.max(0, Math.round(managerState.finance.transferBudget || 0));
  team.finance.wageBudgetWeekly = Math.max(0, Math.round(managerState.finance.wageBudgetWeekly || 0));
}

function runManagerTrainingSession(intensity = "medium") {
  const team = getManagerSelectedTeam();
  if (!team) return alert("Select a manager team first.");
  if (team.finance) syncManagerFinanceWithTeam(team);

  let budgetCost = 120000;
  let moraleGain = 2;
  let staminaCost = 2;
  let ratingGainChance = 0.06;

  if (intensity === "light") {
    budgetCost = 70000;
    moraleGain = 1;
    staminaCost = 1;
    ratingGainChance = 0.03;
  } else if (intensity === "hard") {
    budgetCost = 230000;
    moraleGain = 4;
    staminaCost = 5;
    ratingGainChance = 0.1;
  }

  if (managerState.finance.balance < budgetCost) {
    return alert("Not enough budget for this training session.");
  }

  managerState.finance.balance -= budgetCost;
  managerState.squad.morale = clampManagerValue(managerState.squad.morale + moraleGain, 0, 100);
  managerState.squad.stamina = clampManagerValue(managerState.squad.stamina - staminaCost, 0, 100);

  let improved = 0;
  team.players.forEach((p) => {
    if (Math.random() < ratingGainChance) {
      p.rating = clampManagerValue((p.rating || 70) + 1, 40, 99);
      improved++;
    }
  });

  managerState.history.trainingSessions++;
  pushManagerInbox(`🏋️ ${intensity.toUpperCase()} training done. ${improved} player(s) improved.`, "success");
  syncTeamFinanceWithManager(team);
  saveManagerState();

  if (typeof renderLeagueTable === "function") renderLeagueTable();
  if (typeof renderManagerHubInPlace === "function") renderManagerHubInPlace();
}

function applyMatchPlan(planKey) {
  const plan = MANAGER_MATCH_PLANS[planKey];
  if (!plan) return;

  managerState.squad.morale = clampManagerValue(managerState.squad.morale + plan.moraleDelta, 0, 100);
  managerState.squad.stamina = clampManagerValue(managerState.squad.stamina + plan.staminaDelta, 0, 100);
  managerState.profile.confidence = clampManagerValue(managerState.profile.confidence + Math.round(plan.risk / 2), 0, 100);
  managerState.tactics.tempo = clampManagerValue(managerState.tactics.tempo + Math.round(plan.matchBoost / 2), 0, 100);
  managerState.tactics.pressIntensity = clampManagerValue(managerState.tactics.pressIntensity + Math.round(plan.risk / 2), 0, 100);

  managerState.history.matchPlansUsed++;
  pushManagerInbox(`${plan.label} plan activated for upcoming fixtures.`, "info");
  saveManagerState();

  if (typeof renderManagerHubInPlace === "function") renderManagerHubInPlace();
}

function upgradeManagerFacility(facilityKey) {
  const level = managerState.facilities[facilityKey];
  if (level === undefined) return;

  const team = getManagerSelectedTeam();
  if (team && team.finance) syncManagerFinanceWithTeam(team);

  const nextLevel = level + 1;
  const cost = 2500000 * nextLevel;
  if (managerState.finance.balance < cost) {
    return alert(`Not enough funds. Need $${cost.toLocaleString()}.`);
  }

  managerState.finance.balance -= cost;
  managerState.facilities[facilityKey] = nextLevel;

  if (facilityKey === "trainingGround") managerState.squad.cohesion = clampManagerValue(managerState.squad.cohesion + 3, 0, 100);
  if (facilityKey === "medicalCenter") managerState.squad.stamina = clampManagerValue(managerState.squad.stamina + 5, 0, 100);
  if (facilityKey === "analysisLab") managerState.profile.adaptability = clampManagerValue(managerState.profile.adaptability + 4, 0, 100);
  if (facilityKey === "youthAcademy") managerState.board.fanSupport = clampManagerValue(managerState.board.fanSupport + 2, 0, 100);
  if (facilityKey === "scoutingDept") managerState.profile.reputation = clampManagerValue(managerState.profile.reputation + 3, 0, 100);

  pushManagerInbox(`🏗️ Upgraded ${facilityKey} to level ${nextLevel} (-$${cost.toLocaleString()})`, "success");
  if (team) syncTeamFinanceWithManager(team);
  saveManagerState();

  if (typeof renderManagerHubInPlace === "function") renderManagerHubInPlace();
}

function generateTransferTargets() {
  const selectedTeam = getManagerSelectedTeam();
  if (!selectedTeam) return [];

  const positionsNeed = { GK: 0, DEF: 0, MID: 0, FWD: 0 };
  selectedTeam.players.forEach((p) => {
    if (positionsNeed[p.position] !== undefined) positionsNeed[p.position]++;
  });

  const targetPriority = [];
  if (positionsNeed.GK < 2) targetPriority.push("GK");
  if (positionsNeed.DEF < 4) targetPriority.push("DEF");
  if (positionsNeed.MID < 3) targetPriority.push("MID");
  if (positionsNeed.FWD < 3) targetPriority.push("FWD");
  if (targetPriority.length === 0) targetPriority.push("DEF", "MID", "FWD");

  const used = new Set();
  teams.forEach(t => t.players.forEach(p => used.add(p.name)));
  const targets = [];

  targetPriority.forEach((pos) => {
    const pool = playerDatabase
      .filter((p) => p.position === pos && !used.has(p.name))
      .sort((a, b) => b.rating - a.rating);

    pool.slice(0, 5).forEach((p, i) => {
      const basePrice = (p.rating * p.rating * 12000) + randomInt(500000, 5000000);
      targets.push({
        name: p.name,
        position: p.position,
        rating: p.rating,
        price: Math.round(typeof calculatePlayerMarketValue === 'function'
          ? calculatePlayerMarketValue({ ...p, age: randomInt(18, 33), form: randomInt(45, 70), relationWithManager: randomInt(45, 70), transferDemand: randomInt(20, 70) }, selectedTeam)
          : basePrice),
        contractYears: randomInt(2, 5),
        wageDemand: Math.round(basePrice / 420),
        scoutingScore: clampManagerValue(50 + (p.rating - 70) + randomInt(-8, 8), 20, 99),
      });
    });
  });

  return targets.sort((a, b) => b.scoutingScore - a.scoutingScore).slice(0, 14);
}

function refreshTransferShortlist() {
  managerState.transfer.shortlist = generateTransferTargets();
  pushManagerInbox("🔎 Scouting update: new transfer shortlist ready.", "info");
  saveManagerState();
  if (typeof renderManagerHubInPlace === "function") renderManagerHubInPlace();
}

function buyShortlistPlayer(index) {
  const team = getManagerSelectedTeam();
  if (!team) return alert("Select a manager team first.");
  if (team.finance) syncManagerFinanceWithTeam(team);

  const target = managerState.transfer.shortlist[index];
  if (!target) return;

  const alreadyExists = teams.some(t => t.players.some(p => p.name === target.name));
  if (alreadyExists) {
    managerState.transfer.shortlist.splice(index, 1);
    saveManagerState();
    return alert("This player is already registered in the league. Refreshed shortlist.");
  }

  if (managerState.finance.transferBudget < target.price) {
    return alert("Transfer budget too low for this deal.");
  }

  if (managerState.finance.balance < target.price) {
    return alert("Club balance too low for this deal.");
  }

  const created = createPlayerObject(target.name, target.rating, target.position);
  team.players.push(created);

  managerState.finance.transferBudget -= target.price;
  managerState.finance.balance -= target.price;
  managerState.transfer.boughtPlayers.push({ ...target, date: Date.now(), team: team.name });
  managerState.transfer.shortlist.splice(index, 1);
  managerState.history.transferActions++;

  managerState.board.fanSupport = clampManagerValue(managerState.board.fanSupport + 2, 0, 100);
  managerState.profile.reputation = clampManagerValue(managerState.profile.reputation + 1, 0, 100);

  pushManagerInbox(`✅ Signed ${target.name} (${target.position}, ${target.rating}) for $${target.price.toLocaleString()}`, "success");
  if (typeof ensurePlayerEconomicFields === 'function') ensurePlayerEconomicFields(created, team);
  syncTeamFinanceWithManager(team);
  saveManagerState();

  if (typeof renderLeagueTable === "function") renderLeagueTable();
  if (typeof renderManagerHubInPlace === "function") renderManagerHubInPlace();
}

function sellManagedPlayer(playerName) {
  const team = getManagerSelectedTeam();
  if (!team) return alert("Select a manager team first.");
  if (team.finance) syncManagerFinanceWithTeam(team);

  const idx = team.players.findIndex((p) => p.name === playerName);
  if (idx === -1) return;

  const player = team.players[idx];
  const basePrice = (player.rating * player.rating * 9000) + randomInt(250000, 2500000);

  team.players.splice(idx, 1);
  managerState.finance.transferBudget += Math.round(basePrice * 0.8);
  managerState.finance.balance += basePrice;
  managerState.transfer.soldPlayers.push({
    name: player.name,
    position: player.position,
    rating: player.rating,
    received: basePrice,
    date: Date.now(),
  });
  managerState.history.transferActions++;

  managerState.board.fanSupport = clampManagerValue(managerState.board.fanSupport - 1, 0, 100);

  pushManagerInbox(`💸 Sold ${player.name} for $${basePrice.toLocaleString()}`, "warning");
  syncTeamFinanceWithManager(team);
  saveManagerState();

  if (typeof renderLeagueTable === "function") renderLeagueTable();
  if (typeof renderManagerHubInPlace === "function") renderManagerHubInPlace();
}

function setManagerTacticalPreset(preset) {
  const presets = {
    compact: { mentality: "defensive", pressIntensity: 42, defensiveLine: 38, tempo: 44, width: 46, creativeFreedom: 45 },
    balanced: { mentality: "balanced", pressIntensity: 55, defensiveLine: 52, tempo: 58, width: 50, creativeFreedom: 55 },
    vertical: { mentality: "attacking", pressIntensity: 64, defensiveLine: 58, tempo: 70, width: 54, creativeFreedom: 60 },
    possession: { mentality: "balanced", pressIntensity: 60, defensiveLine: 56, tempo: 52, width: 62, creativeFreedom: 72 },
    chaos: { mentality: "attacking", pressIntensity: 80, defensiveLine: 70, tempo: 82, width: 68, creativeFreedom: 78 },
  };

  const cfg = presets[preset];
  if (!cfg) return;

  managerState.tactics = { ...managerState.tactics, ...cfg };
  managerState.squad.cohesion = clampManagerValue(managerState.squad.cohesion + 1, 0, 100);
  pushManagerInbox(`🧭 Tactical preset switched to ${preset}.`, "info");
  saveManagerState();

  if (typeof renderManagerHubInPlace === "function") renderManagerHubInPlace();
}

function generateBoardObjectives() {
  if (!Array.isArray(teams) || teams.length < 2) return;

  const base = [
    { id: "obj-points", title: "Reach at least 18 league points", target: 18, metric: "points" },
    { id: "obj-goals", title: "Score at least 25 goals", target: 25, metric: "goalsFor" },
    { id: "obj-def", title: "Keep goals against under 28", target: 28, metric: "goalsAgainstMax" },
    { id: "obj-wins", title: "Win at least 7 matches", target: 7, metric: "wins" },
    { id: "obj-fans", title: "Raise fan support to 65+", target: 65, metric: "fanSupport" },
  ];

  managerState.boardObjectives = base.map((x, idx) => ({
    ...x,
    progress: 0,
    completed: false,
    failed: false,
    reward: 1400000 + idx * 450000,
  }));

  saveManagerState();
}

function evaluateBoardObjectives() {
  const team = getManagerSelectedTeam();
  if (!team || !Array.isArray(managerState.boardObjectives)) return;

  managerState.boardObjectives.forEach((obj) => {
    if (obj.completed || obj.failed) return;

    let passed = false;
    let progress = 0;

    if (obj.metric === "points") {
      progress = team.stats.points;
      passed = progress >= obj.target;
    } else if (obj.metric === "goalsFor") {
      progress = team.stats.goalsFor;
      passed = progress >= obj.target;
    } else if (obj.metric === "goalsAgainstMax") {
      progress = team.stats.goalsAgainst;
      passed = progress <= obj.target;
    } else if (obj.metric === "wins") {
      progress = team.stats.wins;
      passed = progress >= obj.target;
    } else if (obj.metric === "fanSupport") {
      progress = managerState.board.fanSupport;
      passed = progress >= obj.target;
    }

    obj.progress = progress;
    if (passed) {
      obj.completed = true;
      managerState.board.objectivesCompleted++;
      managerState.finance.balance += obj.reward;
      managerState.board.trust = clampManagerValue(managerState.board.trust + 4, 0, 100);
      pushManagerInbox(`🏅 Objective complete: ${obj.title} (+$${obj.reward.toLocaleString()})`, "success");
    }
  });

  saveManagerState();
}

function openManagerHub() {
  const currentTeam = getManagerSelectedTeam();
  if (currentTeam && currentTeam.finance) syncManagerFinanceWithTeam(currentTeam);

  if (!managerState.boardObjectives || managerState.boardObjectives.length === 0) {
    generateBoardObjectives();
  }

  const teamOptions = (Array.isArray(teams) ? teams : []).map(
    (t) => `<option value="${t.id}" ${t.id === managerState.selectedTeamId ? "selected" : ""}>${t.name}</option>`
  ).join("");

  const average = currentTeam ? getManagedTeamAverageRating(currentTeam).toFixed(1) : "-";
  const recentInbox = managerState.inbox.slice(0, 12);

  let html = `
    <div class="manager-hub-hero">
      <div>
        <h2>🧠 Manager Hub</h2>
        <p>Control transfers, budgets, squad morale, tactical identity and board goals.</p>
      </div>
      <div class="manager-hub-hero-kpis">
        <span>Trust <strong>${managerState.board.trust}</strong></span>
        <span>Fans <strong>${managerState.board.fanSupport}</strong></span>
        <span>Reputation <strong>${managerState.profile.reputation}</strong></span>
      </div>
    </div>
    <div id="managerHubRoot">
      ${buildManagerHubMarkup(currentTeam, teamOptions, average, recentInbox)}
    </div>
    <button onclick="closePopup()" style="margin-top:16px; width:100%;">Close</button>
  `;

  showPopup(html);
}

function buildManagerHubMarkup(currentTeam, teamOptions, average, recentInbox) {
  const facilityRows = Object.keys(managerState.facilities).map((key) => {
    const level = managerState.facilities[key];
    const cost = 2500000 * (level + 1);
    return `<div class="manager-row">
      <div><strong>${key}</strong> — Level ${level}</div>
      <button class="btn-secondary" onclick="upgradeManagerFacility('${key}')">Upgrade ($${cost.toLocaleString()})</button>
    </div>`;
  }).join("");

  const objectivesRows = managerState.boardObjectives.map((o) => {
    const status = o.completed ? "✅ Completed" : o.failed ? "❌ Failed" : "⏳ Active";
    return `<div class="manager-row">
      <div>
        <strong>${o.title}</strong><br>
        <small>Progress: ${o.progress}/${o.target} · Reward: $${o.reward.toLocaleString()}</small>
      </div>
      <div>${status}</div>
    </div>`;
  }).join("");

  const shortlistRows = (managerState.transfer.shortlist || []).slice(0, 8).map((p, i) => {
    return `<div class="manager-row">
      <div>
        <strong>${p.name}</strong> (${p.position}) · ${p.rating}<br>
        <small>Scout ${p.scoutingScore} · Wage ${p.wageDemand.toLocaleString()}/wk</small>
      </div>
      <button onclick="buyShortlistPlayer(${i})">Buy $${p.price.toLocaleString()}</button>
    </div>`;
  }).join("");

  const playerSellRows = currentTeam
    ? currentTeam.players.map((p) => `<div class="manager-row">
        <div>${p.name} (${p.position}) · ${p.rating}</div>
        <button class="btn-danger" onclick="sellManagedPlayer('${p.name.replace(/'/g, "\\'")}')">Sell</button>
      </div>`).join("")
    : `<p style="color:var(--text-muted)">Select a managed team to access squad controls.</p>`;

  const inboxRows = recentInbox.length === 0
    ? `<p style="color:var(--text-muted)">No manager messages yet.</p>`
    : recentInbox.map((m) => `<div class="manager-msg ${m.kind || "info"}">${m.text}</div>`).join("");

  return `
    <div class="manager-grid">
      <section class="manager-card">
        <h3>Club Control</h3>
        <label>Managed Team</label>
        <select id="managerTeamSelectHub" onchange="onManagerHubTeamChange()">${teamOptions}</select>
        <div class="manager-kpis">
          <div><span>Team</span><strong>${currentTeam ? currentTeam.name : "None"}</strong></div>
          <div><span>Avg OVR</span><strong>${average}</strong></div>
          <div><span>Trust</span><strong>${managerState.board.trust}</strong></div>
          <div><span>Fan Support</span><strong>${managerState.board.fanSupport}</strong></div>
          <div><span>Squad Morale</span><strong>${managerState.squad.morale}</strong></div>
          <div><span>Cohesion</span><strong>${managerState.squad.cohesion}</strong></div>
        </div>
      </section>

      <section class="manager-card">
        <h3>Finance Room</h3>
        <div class="manager-kpis">
          <div><span>Balance</span><strong>$${Math.round(managerState.finance.balance).toLocaleString()}</strong></div>
          <div><span>Transfer Budget</span><strong>$${Math.round(managerState.finance.transferBudget).toLocaleString()}</strong></div>
          <div><span>Wage Budget / week</span><strong>$${Math.round(managerState.finance.wageBudgetWeekly).toLocaleString()}</strong></div>
          <div><span>Sponsor Morale</span><strong>${managerState.finance.sponsorMorale}</strong></div>
        </div>
        <button onclick="managerRefreshIncomeReport()">📈 Weekly Finance Update</button>
      </section>

      <section class="manager-card">
        <h3>Training & Plans</h3>
        <div class="manager-actions-row">
          <button onclick="runManagerTrainingSession('light')">Light Session</button>
          <button onclick="runManagerTrainingSession('medium')">Medium Session</button>
          <button onclick="runManagerTrainingSession('hard')">Hard Session</button>
        </div>
        <div class="manager-actions-row">
          <button class="btn-secondary" onclick="applyMatchPlan('conservative')">Conservative</button>
          <button class="btn-secondary" onclick="applyMatchPlan('balanced')">Balanced</button>
          <button class="btn-secondary" onclick="applyMatchPlan('attacking')">Attacking</button>
          <button class="btn-danger" onclick="applyMatchPlan('allout')">All Out</button>
        </div>
        <div class="manager-actions-row">
          <button onclick="setManagerTacticalPreset('compact')">Preset: Compact</button>
          <button onclick="setManagerTacticalPreset('balanced')">Preset: Balanced</button>
          <button onclick="setManagerTacticalPreset('vertical')">Preset: Vertical</button>
          <button onclick="setManagerTacticalPreset('possession')">Preset: Possession</button>
          <button onclick="setManagerTacticalPreset('chaos')">Preset: Chaos</button>
        </div>
      </section>

      <section class="manager-card">
        <h3>Facilities</h3>
        ${facilityRows}
      </section>

      <section class="manager-card">
        <h3>Board Objectives</h3>
        ${objectivesRows || "<p>No objectives loaded.</p>"}
        <div class="manager-actions-row">
          <button onclick="evaluateBoardObjectives(); renderManagerHubInPlace();">Evaluate</button>
          <button class="btn-secondary" onclick="generateBoardObjectives(); renderManagerHubInPlace();">Reset Objectives</button>
        </div>
      </section>

      <section class="manager-card">
        <h3>Transfer Desk</h3>
        <div class="manager-actions-row">
          <button onclick="refreshTransferShortlist()">🔎 Refresh Shortlist</button>
          <button class="btn-secondary" onclick="openGlobalTransferMarket()">💱 Open Transfer Market</button>
        </div>
        ${shortlistRows || '<p style="color:var(--text-muted)">No targets. Click refresh.</p>'}
      </section>

      <section class="manager-card">
        <h3>Squad Sales</h3>
        <div class="manager-squad-scroll">${playerSellRows}</div>
      </section>

      <section class="manager-card">
        <h3>Manager Inbox</h3>
        ${inboxRows}
      </section>
    </div>
  `;
}

function renderManagerHubInPlace() {
  const root = document.getElementById("managerHubRoot");
  if (!root) return;

  const currentTeam = getManagerSelectedTeam();
  const teamOptions = (Array.isArray(teams) ? teams : []).map(
    (t) => `<option value="${t.id}" ${t.id === managerState.selectedTeamId ? "selected" : ""}>${t.name}</option>`
  ).join("");
  const average = currentTeam ? getManagedTeamAverageRating(currentTeam).toFixed(1) : "-";
  const recentInbox = managerState.inbox.slice(0, 12);

  root.innerHTML = buildManagerHubMarkup(currentTeam, teamOptions, average, recentInbox);
  syncManagerSelectionsUI();
}

function onManagerHubTeamChange() {
  const select = document.getElementById("managerTeamSelectHub");
  if (!select) return;
  const id = parseInt(select.value);
  if (isNaN(id)) return;

  setManagerSelectedTeam(id, { silent: true, reason: "manager hub" });
  renderManagerHubInPlace();
}

function managerRefreshIncomeReport() {
  const team = getManagerSelectedTeam();
  if (!team) return alert("Select a managed team first.");
  if (team.finance) syncManagerFinanceWithTeam(team);

  const played = team.stats?.played || 0;
  const lastUpdate = managerState.finance.lastFinanceUpdatePlayed ?? -1;
  const minGap = 5;
  if (played - lastUpdate < minGap) {
    return alert(`Finance update is locked. Play ${minGap - (played - lastUpdate)} more match(es).`);
  }

  const fansFactor = managerState.board.fanSupport / 100;
  const trustFactor = managerState.board.trust / 100;
  const performanceFactor = clampManagerValue((team.stats.points + team.stats.wins * 2 + 8) / 40, 0.5, 2.2);

  const matchIncome = Math.round(90000 + fansFactor * 120000 + performanceFactor * 40000);
  const sponsorIncome = Math.round(60000 + trustFactor * 70000 + managerState.facilities.analysisLab * 15000);
  const wageExpense = Math.round(managerState.finance.wageBudgetWeekly * 0.48);
  const operations = Math.round(140000 + managerState.facilities.trainingGround * 22000 + managerState.facilities.medicalCenter * 18000);

  const totalIncome = matchIncome + sponsorIncome;
  const totalExpense = wageExpense + operations;
  const net = totalIncome - totalExpense;

  managerState.finance.lastWeekIncome = totalIncome;
  managerState.finance.lastWeekExpense = totalExpense;
  managerState.finance.balance = Math.max(0, managerState.finance.balance + net);
  managerState.finance.lastFinanceUpdatePlayed = played;

  pushManagerInbox(`📊 Weekly report: Income $${totalIncome.toLocaleString()} | Expense $${totalExpense.toLocaleString()} | Net ${net >= 0 ? "+" : "-"}$${Math.abs(net).toLocaleString()}`, net >= 0 ? "success" : "warning");
  syncTeamFinanceWithManager(team);
  saveManagerState();
  renderManagerHubInPlace();
}

// Optional UI helper used by dashboard renders
function renderManagerQuickBadge() {
  const team = getManagerSelectedTeam();
  const info = team
    ? `<div class="manager-quick-main"><span>🧠 ${team.name}</span><small>Trust ${managerState.board.trust} · Morale ${managerState.squad.morale} · Fans ${managerState.board.fanSupport}</small></div>`
    : `<div class="manager-quick-main"><span>🧠 No managed team selected</span><small>Pick your team to unlock full manager flow</small></div>`;

  return `
    <div class="manager-quick-badge">
      ${info}
      <div class="manager-quick-actions">
        ${renderTournamentManagerControl()}
        <button onclick="openManagerHub()">Open Manager Hub</button>
      </div>
    </div>
  `;
}

// Keep manager hooks global
window.ensureManagerState = ensureManagerState;
window.renderHomeManagerSelect = renderHomeManagerSelect;
window.onHomeManagerSelectChange = onHomeManagerSelectChange;
window.applyManagerSetupSelectionAfterTeamCreation = applyManagerSetupSelectionAfterTeamCreation;
window.renderSimulationTeamSelect = renderSimulationTeamSelect;
window.onSimulationManagerSelectChange = onSimulationManagerSelectChange;
window.onTournamentManagerTeamChange = onTournamentManagerTeamChange;
window.getManagerMatchInfluence = getManagerMatchInfluence;
window.openManagerHub = openManagerHub;
window.runManagerTrainingSession = runManagerTrainingSession;
window.applyMatchPlan = applyMatchPlan;
window.upgradeManagerFacility = upgradeManagerFacility;
window.refreshTransferShortlist = refreshTransferShortlist;
window.buyShortlistPlayer = buyShortlistPlayer;
window.sellManagedPlayer = sellManagedPlayer;
window.setManagerTacticalPreset = setManagerTacticalPreset;
window.generateBoardObjectives = generateBoardObjectives;
window.evaluateBoardObjectives = evaluateBoardObjectives;
window.renderManagerHubInPlace = renderManagerHubInPlace;
window.onManagerHubTeamChange = onManagerHubTeamChange;
window.managerRefreshIncomeReport = managerRefreshIncomeReport;
window.renderManagerQuickBadge = renderManagerQuickBadge;
window.syncManagerSelectionsUI = syncManagerSelectionsUI;
window.managerWeeklyTick = managerWeeklyTick;
window.onManagerPostMatchUpdate = onManagerPostMatchUpdate;

ensureManagerState();
