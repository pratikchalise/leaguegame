// =============================================
// PLAYER TRANSFERING ENGINE (probabilities + uniqueness)
// =============================================

const TRANSFERING_CONFIG = {
  baseChancePerCycle: 0.1,
  highDemandBoost: 0.24,
  lowRelationBoost: 0.3,
  marketBudgetStrictness: 0.85,
  maxAgePrime: 28
};

function getAllLeaguePlayerNames() {
  if (!Array.isArray(teams)) return new Set();
  const names = new Set();
  teams.forEach(t => {
    if (!Array.isArray(t.players)) return;
    t.players.forEach(p => names.add(p.name));
  });
  return names;
}

function pickUniqueReplacementPlayer(position, usedNames) {
  const pool = playerDatabase
    .filter(p => p.position === position && !usedNames.has(p.name))
    .sort((a, b) => b.rating - a.rating);

  if (pool.length > 0) {
    return {
      name: pool[0].name,
      rating: pool[0].rating,
      position: pool[0].position
    };
  }

  // Synthetic fallback: always unique
  let generatedName;
  do {
    generatedName = `${position} Youth ${randomInt(1000, 9999)}`;
  } while (usedNames.has(generatedName));

  return {
    name: generatedName,
    rating: randomInt(58, 84),
    position: position
  };
}

function enforceLeagueWideUniquePlayers() {
  if (!Array.isArray(teams)) return;

  const used = new Set();

  teams.forEach(team => {
    if (!Array.isArray(team.players)) team.players = [];

    for (let i = 0; i < team.players.length; i++) {
      const p = team.players[i];
      if (!p || !p.name) continue;

      if (!used.has(p.name)) {
        used.add(p.name);
        continue;
      }

      const replacement = pickUniqueReplacementPlayer(p.position || "MID", used);
      const newP = createPlayerObject(replacement.name, replacement.rating, replacement.position);
      if (typeof ensurePlayerEconomicFields === "function") ensurePlayerEconomicFields(newP, team);
      team.players[i] = newP;
      used.add(newP.name);
    }
  });
}

function calculateTransferProbability(player, fromTeam, toTeam, context = {}) {
  if (!player || !fromTeam || !toTeam || fromTeam.id === toTeam.id) return 0;
  if (!fromTeam.finance || !toTeam.finance) return 0;

  const marketValue = player.marketValue || (typeof calculatePlayerMarketValue === "function" ? calculatePlayerMarketValue(player, fromTeam) : 5000000);
  const demand = player.transferDemand ?? 40;
  const relation = player.relationWithManager ?? 55;
  const age = player.age || 25;
  const form = player.form ?? 50;

  const buyerBudget = toTeam.finance.transferBudget || 0;
  const affordability = clampMoneyValue(buyerBudget / Math.max(1, marketValue), 0, 2.5);
  const affordScore = affordability < TRANSFERING_CONFIG.marketBudgetStrictness ? -0.35 : (affordability - 0.8) * 0.32;

  const relationScore = (55 - relation) / 100; // bad relation increases move chance
  const demandScore = demand / 160;
  const formScore = (form - 50) / 240; // hot form modestly increases move chance

  const agePeak = TRANSFERING_CONFIG.maxAgePrime;
  const ageScore = age <= agePeak ? 0.08 : clampMoneyValue((34 - age) / 120, -0.12, 0.05);

  const needScore = typeof getTransferNeedScoreForTeam === "function"
    ? getTransferNeedScoreForTeam(toTeam, player.position || "MID")
    : 0.05;

  const rivalryPenalty = context.sameTier ? -0.06 : 0;

  let probability =
    TRANSFERING_CONFIG.baseChancePerCycle +
    affordScore +
    relationScore * TRANSFERING_CONFIG.lowRelationBoost +
    demandScore * TRANSFERING_CONFIG.highDemandBoost +
    formScore +
    ageScore +
    needScore +
    rivalryPenalty;

  probability = clampMoneyValue(probability, 0.005, 0.85);
  return probability;
}

function getPositionCount(team, position) {
  if (!team || !Array.isArray(team.players)) return 0;
  return team.players.filter(p => p.position === position).length;
}

function getTransferNeedScoreForTeam(team, position) {
  const minima = { GK: 2, DEF: 5, MID: 5, FWD: 5 };
  const have = getPositionCount(team, position);
  const need = Math.max(0, (minima[position] || 4) - have);
  return clampMoneyValue(need * 0.09, 0, 0.36);
}

function runAccurateTransferCalculations(cycles = 1) {
  const deals = [];
  if (!Array.isArray(teams) || teams.length < 2) return deals;

  for (let c = 0; c < cycles; c++) {
    for (let i = 0; i < teams.length; i++) {
      const from = teams[i];
      if (!Array.isArray(from.players) || from.players.length === 0) continue;
      if (!from.finance) continue;

      const candidates = [...from.players]
        .sort((a, b) => (b.transferDemand || 0) - (a.transferDemand || 0))
        .slice(0, 7);

      for (const player of candidates) {
        const buyers = teams.filter(t => t.id !== from.id && t.finance && t.players && !t.players.some(x => x.name === player.name));
        if (buyers.length === 0) continue;

        let bestBuyer = null;
        let bestProb = 0;

        for (const to of buyers) {
          const prob = calculateTransferProbability(player, from, to, {
            sameTier: Math.abs((from.stats?.points || 0) - (to.stats?.points || 0)) <= 2
          });
          if (prob > bestProb) {
            bestProb = prob;
            bestBuyer = to;
          }
        }

        if (!bestBuyer) continue;

        // roll
        if (Math.random() < bestProb) {
          deals.push({
            fromTeamId: from.id,
            toTeamId: bestBuyer.id,
            playerName: player.name,
            probability: bestProb
          });
        }
      }
    }
  }

  return deals;
}

window.enforceLeagueWideUniquePlayers = enforceLeagueWideUniquePlayers;
window.calculateTransferProbability = calculateTransferProbability;
window.runAccurateTransferCalculations = runAccurateTransferCalculations;
window.getTransferNeedScoreForTeam = getTransferNeedScoreForTeam;
