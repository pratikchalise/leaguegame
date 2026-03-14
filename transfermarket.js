// =============================================
// TRANSFER MARKET + RANDOM MANAGERS
// =============================================

const transferMarketState = {
  listings: [],
  managerOfferCooldown: 0,
  aiCycleCount: 0,
  matchesSinceOffer: 0,
  managerNamePool: [
    "Carlo Verano", "Adrian Holt", "Mika Rosen", "Julian Duarte", "Sergio Vega", "Olivier Blanc", "Luca Bianchi", "Rene Falk", "Thomas Keane", "Iker Solano",
    "Victor Salas", "Hugo Lambert", "Paulo Esteban", "Enzo Marino", "Damian Creed", "Marcel Quinn", "Niko Sato", "Bruno Ramires", "Danilo Costa", "Noah Clarke",
    "Liam Sterling", "Mateo Rios", "Elias Novak", "Arman Petrov", "Samir Aziz", "Kenji Mori", "Tobias Meyer", "Rafael Cortez", "Diego Navarro", "Emil Varga",
    "Aiden Brooks", "Felix Hart", "Sebastian Ruhl", "Yuki Tanaka", "Andres Mendez", "Nils Andersen", "Jasper Cole", "Ruben Ibarra", "Kaito Sora", "Giorgio Leone",
    "Ivan Markov", "Rene Alvarez", "Santiago Paredes", "Oliver Grant", "Lucas Mertens", "Matias Romero", "Maxime Leduc", "Pavel Ivanov", "Soren Lind", "Damir Kovac"
  ]
};

const REAL_WORLD_MANAGERS = [
  { name: "Pep Guardiola", ovr: 98, style: "possession", reputation: 98, adaptability: 97, loyalty: 83 },
  { name: "Carlo Ancelotti", ovr: 96, style: "balanced", reputation: 97, adaptability: 94, loyalty: 88 },
  { name: "Jurgen Klopp", ovr: 96, style: "attacking", reputation: 96, adaptability: 92, loyalty: 85 },
  { name: "Mikel Arteta", ovr: 91, style: "possession", reputation: 90, adaptability: 91, loyalty: 87 },
  { name: "Diego Simeone", ovr: 93, style: "defensive", reputation: 94, adaptability: 89, loyalty: 92 },
  { name: "Xabi Alonso", ovr: 90, style: "balanced", reputation: 89, adaptability: 92, loyalty: 84 },
  { name: "Luis Enrique", ovr: 92, style: "possession", reputation: 93, adaptability: 90, loyalty: 82 },
  { name: "Simone Inzaghi", ovr: 90, style: "counter", reputation: 90, adaptability: 88, loyalty: 81 },
  { name: "Unai Emery", ovr: 89, style: "counter", reputation: 89, adaptability: 90, loyalty: 84 },
  { name: "Thomas Tuchel", ovr: 91, style: "balanced", reputation: 91, adaptability: 90, loyalty: 78 },
  { name: "Antonio Conte", ovr: 90, style: "defensive", reputation: 91, adaptability: 86, loyalty: 76 },
  { name: "Zinedine Zidane", ovr: 92, style: "balanced", reputation: 94, adaptability: 88, loyalty: 80 },
  { name: "Jose Mourinho", ovr: 90, style: "defensive", reputation: 94, adaptability: 85, loyalty: 79 },
  { name: "Erik ten Hag", ovr: 86, style: "possession", reputation: 84, adaptability: 86, loyalty: 81 },
  { name: "Roberto De Zerbi", ovr: 87, style: "attacking", reputation: 86, adaptability: 89, loyalty: 80 },
  { name: "Luciano Spalletti", ovr: 88, style: "balanced", reputation: 88, adaptability: 87, loyalty: 82 }
];

const SQUAD_MINIMUMS = {
  total: 17,
  GK: 2,
  DEF: 4,
  MID: 3,
  FWD: 3
};

function clampTransferValue(v, min, max) {
  return Math.max(min, Math.min(max, v));
}

function getUsedManagerNames() {
  const used = new Set();
  if (!Array.isArray(teams)) return used;
  teams.forEach(t => {
    if (t.manager && t.manager.name) used.add(t.manager.name);
  });
  return used;
}

function createUniqueManagerName(used) {
  const pool = transferMarketState.managerNamePool.filter(n => !used.has(n));
  if (pool.length > 0) return pool[randomInt(0, pool.length - 1)];

  let fallback;
  do {
    fallback = `Manager ${randomInt(1000, 9999)}`;
  } while (used.has(fallback));
  return fallback;
}

function assignRandomManagersToTeams(teamList) {
  if (!Array.isArray(teamList)) return;
  const used = new Set();
  const realPool = [...REAL_WORLD_MANAGERS].sort(() => Math.random() - 0.5);

  teamList.forEach(team => {
    if (!team.manager || !team.manager.name || used.has(team.manager.name)) {
      let managerObj = null;
      while (realPool.length > 0 && !managerObj) {
        const pick = realPool.pop();
        if (!used.has(pick.name)) managerObj = { ...pick };
      }

      if (!managerObj) {
        const name = createUniqueManagerName(used);
        managerObj = {
          name,
          ovr: randomInt(72, 90),
          style: ["balanced", "attacking", "defensive", "possession", "counter"][randomInt(0, 4)],
          reputation: randomInt(45, 88),
          adaptability: randomInt(45, 88),
          loyalty: randomInt(35, 90)
        };
      }

      if (!managerObj.ovr) {
        managerObj.ovr = clampTransferValue(Math.round((managerObj.reputation + managerObj.adaptability) / 2), 70, 99);
      }
      team.manager = managerObj;
    }
    used.add(team.manager.name);
  });
}

function getTeamPositionCount(team, position) {
  if (!team || !Array.isArray(team.players)) return 0;
  return team.players.filter(p => p.position === position).length;
}

function canTeamSellPlayer(team, player) {
  if (!team || !player || !Array.isArray(team.players)) return false;
  if (team.players.length <= SQUAD_MINIMUMS.total) return false;

  const pos = player.position || "MID";
  const posCount = getTeamPositionCount(team, pos);
  const minPos = SQUAD_MINIMUMS[pos] || 2;
  if (posCount <= minPos) return false;

  return true;
}

function getUsedNamesAcrossLeagueAndFreeAgents() {
  const used = new Set();
  if (Array.isArray(teams)) {
    teams.forEach(t => {
      if (!Array.isArray(t.players)) return;
      t.players.forEach(p => used.add(p.name));
    });
  }
  if (typeof freeAgents !== "undefined" && Array.isArray(freeAgents)) {
    freeAgents.forEach(p => used.add(p.name));
  }
  return used;
}

function rebuildFreeAgentPoolFromLeague() {
  if (typeof freeAgents === "undefined") return;
  const usedByTeams = new Set();
  teams.forEach(t => t.players.forEach(p => usedByTeams.add(p.name)));

  const basePool = playerDatabase.filter(p => !usedByTeams.has(p.name));
  freeAgents = basePool.map(p => {
    const obj = createPlayerObject(p.name, p.rating, p.position);
    if (typeof ensurePlayerEconomicFields === "function") ensurePlayerEconomicFields(obj, null);
    return obj;
  });
}

function signFreeAgentToTeam(team, preferredPosition = null) {
  if (typeof freeAgents === "undefined" || !Array.isArray(freeAgents) || freeAgents.length === 0) return null;
  if (!team || !team.finance) return null;

  let idx = -1;
  if (preferredPosition) idx = freeAgents.findIndex(p => p.position === preferredPosition);
  if (idx === -1) idx = 0;
  const p = freeAgents[idx];
  if (!p) return null;

  const value = p.marketValue || (typeof calculatePlayerMarketValue === "function" ? calculatePlayerMarketValue(p, team) : 2000000);
  const signingCost = Math.round(value * 0.08);
  if ((team.finance.balance || 0) < signingCost) return null;

  freeAgents.splice(idx, 1);
  team.players.push(p);
  team.finance.balance = Math.max(0, (team.finance.balance || 0) - signingCost);
  if (typeof ensurePlayerEconomicFields === "function") ensurePlayerEconomicFields(p, team);
  return p;
}

function ensureTeamHasMinimumRoster(team) {
  if (!team || !team.finance) return;
  if (!Array.isArray(team.players)) team.players = [];

  // Fill by position minima first
  ["GK", "DEF", "MID", "FWD"].forEach(pos => {
    while (getTeamPositionCount(team, pos) < (SQUAD_MINIMUMS[pos] || 1)) {
      const signed = signFreeAgentToTeam(team, pos);
      if (!signed) break;
    }
  });

  // Fill to minimum total squad
  while (team.players.length < SQUAD_MINIMUMS.total) {
    const signed = signFreeAgentToTeam(team, null);
    if (!signed) break;
  }
}

function ensureLeagueRosterViability() {
  if (!Array.isArray(teams)) return;
  teams.forEach(t => ensureTeamHasMinimumRoster(t));
}

function buildTransferListing(player, fromTeam) {
  const marketValue = player.marketValue || (typeof calculatePlayerMarketValue === "function" ? calculatePlayerMarketValue(player, fromTeam) : 5000000);
  const demandFactor = 0.9 + ((player.transferDemand || 40) / 100) * 0.35;
  const contractFactor = player.contractYears <= 1 ? 0.83 : player.contractYears >= 4 ? 1.08 : 1.0;
  const relationFactor = player.relationWithManager < 45 ? 0.92 : player.relationWithManager > 75 ? 1.05 : 1;

  const askPrice = Math.round(marketValue * demandFactor * contractFactor * relationFactor);
  const priority = clampTransferValue(((player.transferDemand || 40) / 100) + ((60 - (player.relationWithManager || 55)) / 120), 0.1, 0.99);

  return {
    id: `tm-${fromTeam.id}-${player.name}-${Date.now()}-${randomInt(1, 9999)}`,
    playerName: player.name,
    position: player.position,
    rating: player.rating,
    age: player.age,
    fromTeamId: fromTeam.id,
    fromTeamName: fromTeam.name,
    askPrice,
    marketValue,
    priority,
    relationWithManager: player.relationWithManager || 55,
    transferDemand: player.transferDemand || 40,
    createdAt: Date.now()
  };
}

function refreshTransferMarketListings() {
  transferMarketState.listings = [];
  if (!Array.isArray(teams)) return;

  teams.forEach(team => {
    if (!Array.isArray(team.players) || team.players.length < 8) return;

    const candidates = [...team.players]
      .sort((a, b) => {
        const scoreA = (a.transferDemand || 40) + (60 - (a.relationWithManager || 55)) * 0.7;
        const scoreB = (b.transferDemand || 40) + (60 - (b.relationWithManager || 55)) * 0.7;
        return scoreB - scoreA;
      })
      .slice(0, 6);

    const slots = randomInt(1, 3);
    for (let i = 0; i < Math.min(slots, candidates.length); i++) {
      transferMarketState.listings.push(buildTransferListing(candidates[i], team));
    }
  });

  transferMarketState.listings.sort((a, b) => b.priority - a.priority);
}

function findTeamById(id) {
  return teams.find(t => t.id === id) || null;
}

function transferPlayerBetweenTeams(playerName, fromTeam, toTeam, fee, options = {}) {
  const { silent = false } = options;
  if (!fromTeam || !toTeam || fromTeam.id === toTeam.id) return false;
  if (!fromTeam.finance || !toTeam.finance) return false;

  const playerIdx = fromTeam.players.findIndex(p => p.name === playerName);
  if (playerIdx === -1) return false;

  const player = fromTeam.players[playerIdx];
  if (toTeam.players.some(p => p.name === playerName)) return false;
  if (!canTeamSellPlayer(fromTeam, player)) return false;

  const safeFee = Math.max(0, Math.round(fee || player.marketValue || 0));
  if (toTeam.finance.transferBudget < safeFee || toTeam.finance.balance < safeFee) return false;

  // Execute
  fromTeam.players.splice(playerIdx, 1);
  toTeam.players.push(player);

  toTeam.finance.transferBudget = Math.max(0, toTeam.finance.transferBudget - safeFee);
  toTeam.finance.balance = Math.max(0, toTeam.finance.balance - safeFee);

  fromTeam.finance.transferBudget += Math.round(safeFee * 0.9);
  fromTeam.finance.balance += safeFee;

  player.relationWithManager = clampTransferValue((player.relationWithManager || 55) - 2 + randomInt(-1, 2), 1, 99);
  player.transferDemand = clampTransferValue((player.transferDemand || 40) - 8 + randomInt(-2, 2), 1, 99);
  player.marketValue = typeof calculatePlayerMarketValue === "function" ? calculatePlayerMarketValue(player, toTeam) : player.marketValue;
  if (typeof enforceLeagueWideUniquePlayers === "function") {
    enforceLeagueWideUniquePlayers();
  }

  if (!silent) {
    if (typeof pushManagerInbox === "function") {
      pushManagerInbox(`📝 Transfer completed: ${player.name} moved ${fromTeam.name} → ${toTeam.name} for $${safeFee.toLocaleString()}`, "info");
    }
  }
  return true;
}

function getPotentialBuyersForListing(listing) {
  if (!listing) return [];

  return teams
    .filter(t => t.id !== listing.fromTeamId)
    .filter(t => !t.players.some(p => p.name === listing.playerName))
    .filter(t => t.finance && t.finance.transferBudget >= listing.askPrice * 0.75)
    .sort((a, b) => (b.finance.transferBudget || 0) - (a.finance.transferBudget || 0));
}

function processFrequentAITransfers() {
  if (!Array.isArray(teams) || teams.length < 2) return;
  if (transferMarketState.listings.length === 0) refreshTransferMarketListings();

  const candidateDeals = typeof runAccurateTransferCalculations === "function"
    ? runAccurateTransferCalculations(3)
    : [];

  let dealCount = 0;
  const targetDeals = Math.max(1, randomInt(1, 3) + (Math.random() < 0.55 ? 1 : 0)); // frequent

  for (const d of candidateDeals) {
    if (dealCount >= targetDeals) break;
    const fromTeam = findTeamById(d.fromTeamId);
    const toTeam = findTeamById(d.toTeamId);
    if (!fromTeam || !toTeam) continue;

    const player = fromTeam.players.find(p => p.name === d.playerName);
    if (!player) continue;

    const value = player.marketValue || (typeof calculatePlayerMarketValue === "function" ? calculatePlayerMarketValue(player, fromTeam) : 3000000);
    const fee = Math.round(value * (0.9 + Math.random() * 0.2));

    if (transferPlayerBetweenTeams(player.name, fromTeam, toTeam, fee, { silent: true })) {
      dealCount++;
      matchHistory.push({
        homeTeam: "Transfer Market",
        awayTeam: "",
        homeScore: 0,
        awayScore: 0,
        note: `🧾 ${player.name}: ${fromTeam.name} → ${toTeam.name} ($${fee.toLocaleString()})`
      });
    }
  }

  // Fallback market sweep so AI transfers still happen even when probability engine returns sparse deals
  if (dealCount < targetDeals) {
    const shuffledListings = [...transferMarketState.listings].sort(() => Math.random() - 0.5);
    for (const listing of shuffledListings) {
      if (dealCount >= targetDeals) break;
      const fromTeam = findTeamById(listing.fromTeamId);
      if (!fromTeam) continue;

      const buyers = getPotentialBuyersForListing(listing).slice(0, 6);
      if (buyers.length === 0) continue;

      // Weighted pick by transfer budget
      const total = buyers.reduce((s, b) => s + (b.finance?.transferBudget || 0), 0);
      let r = Math.random() * Math.max(1, total);
      let chosen = buyers[0];
      for (const b of buyers) {
        r -= (b.finance?.transferBudget || 0);
        if (r <= 0) {
          chosen = b;
          break;
        }
      }

      const premium = 0.9 + Math.random() * 0.25;
      const fee = Math.round(listing.askPrice * premium);
      if (transferPlayerBetweenTeams(listing.playerName, fromTeam, chosen, fee, { silent: true })) {
        dealCount++;
        matchHistory.push({
          homeTeam: "Transfer Market",
          awayTeam: "",
          homeScore: 0,
          awayScore: 0,
          note: `🧾 ${listing.playerName}: ${fromTeam.name} → ${chosen.name} ($${fee.toLocaleString()})`
        });
      }
    }
  }

  if (dealCount > 0 && typeof localStorage !== "undefined") {
    localStorage.setItem("matchHistory", JSON.stringify(matchHistory));
  }

  ensureLeagueRosterViability();
  refreshTransferMarketListings();
}

function maybeCreateManagerOfferForUser() {
  if (transferMarketState.managerOfferCooldown > 0) {
    transferMarketState.managerOfferCooldown--;
    return;
  }

  if (typeof managerState === "undefined" || managerState.selectedTeamId === null || managerState.selectedTeamId === undefined) return;
  const currentTeam = findTeamById(managerState.selectedTeamId);
  if (!currentTeam) return;

  const trust = managerState.board?.trust ?? 50;
  const reputation = managerState.profile?.reputation ?? 50;
  const morale = currentTeam.morale ?? 55;
  const points = currentTeam.stats?.points ?? 0;

  transferMarketState.matchesSinceOffer = (transferMarketState.matchesSinceOffer || 0) + 1;

  const offerChance = clampTransferValue((trust + reputation + morale + points) / 320, 0.16, 0.82);
  const guaranteeOffer = transferMarketState.matchesSinceOffer >= 6;
  if (!guaranteeOffer && Math.random() > offerChance) return;

  const offerTeams = teams
    .filter(t => t.id !== currentTeam.id)
    .filter(t => (t.finance?.transferBudget || 0) > (currentTeam.finance?.transferBudget || 0) * 0.8)
    .sort((a, b) => (b.finance?.transferBudget || 0) - (a.finance?.transferBudget || 0));

  if (offerTeams.length === 0) return;
  const target = offerTeams[randomInt(0, Math.min(4, offerTeams.length - 1))];

  const salary = Math.round(900000 + (reputation * 12000) + randomInt(150000, 550000));
  const signingBonus = Math.round(1200000 + trust * 25000 + randomInt(0, 1500000));

  if (typeof pushManagerInbox === "function") {
    pushManagerInbox(`📨 Manager Offer: ${target.name} wants you. Salary: $${salary.toLocaleString()}/wk, Bonus: $${signingBonus.toLocaleString()}.`, "info");
  }

  transferMarketState.managerOfferCooldown = randomInt(3, 7);
  transferMarketState.matchesSinceOffer = 0;
}

function processTransferMarketAfterMatch() {
  transferMarketState.aiCycleCount++;
  if (transferMarketState.aiCycleCount % 1 === 0) processFrequentAITransfers();
  maybeCreateManagerOfferForUser();
}

function buyTransferMarketPlayer(listingId) {
  const listing = transferMarketState.listings.find(x => x.id === listingId);
  if (!listing) return alert("Listing not found.");

  if (typeof managerState === "undefined" || managerState.selectedTeamId === null || managerState.selectedTeamId === undefined) {
    return alert("Select your manager team first.");
  }

  const toTeam = findTeamById(managerState.selectedTeamId);
  const fromTeam = findTeamById(listing.fromTeamId);
  if (!toTeam || !fromTeam) return alert("Team data not found.");

  if (toTeam.id === fromTeam.id) return alert("You already own this player.");

  const ok = transferPlayerBetweenTeams(listing.playerName, fromTeam, toTeam, listing.askPrice, { silent: false });
  if (!ok) return alert("Transfer failed (budget/rules). Try another player.");

  transferMarketState.listings = transferMarketState.listings.filter(x => x.id !== listingId);
  if (typeof renderManagerHubInPlace === "function") renderManagerHubInPlace();
  openGlobalTransferMarket();
}


function openGlobalTransferMarket() {
  refreshTransferMarketListings();

  const selectedId = (typeof managerState !== "undefined") ? managerState.selectedTeamId : null;
  const myTeam = selectedId !== null && selectedId !== undefined ? findTeamById(selectedId) : null;

  const topRows = transferMarketState.listings.slice(0, 35).map(l => {
    const canBuy = myTeam && myTeam.id !== l.fromTeamId && (myTeam.finance?.transferBudget || 0) >= l.askPrice;
    return `<tr>
      <td>${l.playerName}</td>
      <td>${l.position}</td>
      <td>${l.rating}</td>
      <td>${l.age || '-'}</td>
      <td>${l.fromTeamName}</td>
      <td>$${Math.round(l.marketValue).toLocaleString()}</td>
      <td>$${Math.round(l.askPrice).toLocaleString()}</td>
      <td>${l.transferDemand}</td>
      <td>${l.relationWithManager}</td>
      <td>${canBuy ? `<button onclick="buyTransferMarketPlayer('${l.id}')">Buy</button>` : '<span style="color:#888;">Locked</span>'}</td>
    </tr>`;
  }).join("");


  
  const teamFinanceRows = teams
    .slice()
    .sort((a, b) => (b.finance?.transferBudget || 0) - (a.finance?.transferBudget || 0))
    .map((t, i) => `<tr>
      <td>${i + 1}</td>
      <td>${t.name}</td>
      <td>${t.manager?.name || '-'}</td>
      <td>$${Math.round(t.finance?.balance || 0).toLocaleString()}</td>
      <td>$${Math.round(t.finance?.transferBudget || 0).toLocaleString()}</td>
      <td>${t.morale || 55}</td>
    </tr>`).join("");


  const header = myTeam
    ? `<p><strong>Your Club:</strong> ${myTeam.name} · Balance $${Math.round(myTeam.finance?.balance || 0).toLocaleString()} · Transfer Budget $${Math.round(myTeam.finance?.transferBudget || 0).toLocaleString()}</p>`
    : `<p style="color:#c55;">Select your manager team to start buying players.</p>`;

  const html = `
    <h2>💱 Transfer Market</h2>
    ${header}
    <div style="display:flex; gap:8px; margin-bottom:10px; flex-wrap:wrap;">
      <button onclick="processFrequentAITransfers(); openGlobalTransferMarket();">⚡ Sim AI Transfers</button>
      <button class="btn-secondary" onclick="refreshTransferMarketListings(); openGlobalTransferMarket();">🔄 Refresh Market</button>
    </div>

    <h3 style="margin-bottom:8px;">Available Players</h3>
    <div style="max-height:300px; overflow:auto; border:1px solid var(--border-light); border-radius:10px;">
      <table style="margin:0; width:100%;">
        <thead><tr><th>Name</th><th>Pos</th><th>OVR</th><th>Age</th><th>From</th><th>Value</th><th>Ask</th><th>Demand</th><th>Relation</th><th>Action</th></tr></thead>
        <tbody>${topRows || '<tr><td colspan="10">No listings.</td></tr>'}</tbody>
      </table>
    </div>

    <h3 style="margin:12px 0 8px;">Club Money + Managers</h3>
    <div style="max-height:260px; overflow:auto; border:1px solid var(--border-light); border-radius:10px;">
      <table style="margin:0; width:100%;">
        <thead><tr><th>#</th><th>Team</th><th>Manager</th><th>Balance</th><th>Transfer Budget</th><th>Morale</th></tr></thead>
        <tbody>${teamFinanceRows}</tbody>
      </table>
    </div>

    <button style="width:100%; margin-top:12px;" onclick="closePopup()">Close</button>
  `;

  showPopup(html);
}

function initializeTransferSystem(teamList) {
  if (!Array.isArray(teamList)) return;

  if (typeof initializeMoneySystemForTeams === "function") {
    initializeMoneySystemForTeams(teamList);
  }

  assignRandomManagersToTeams(teamList);

  if (typeof enforceLeagueWideUniquePlayers === "function") {
    enforceLeagueWideUniquePlayers();
  }

  if (typeof freeAgents !== "undefined") {
    rebuildFreeAgentPoolFromLeague();
  }

  ensureLeagueRosterViability();

  refreshTransferMarketListings();
}

window.initializeTransferSystem = initializeTransferSystem;
window.assignRandomManagersToTeams = assignRandomManagersToTeams;
window.refreshTransferMarketListings = refreshTransferMarketListings;
window.openGlobalTransferMarket = openGlobalTransferMarket;
window.buyTransferMarketPlayer = buyTransferMarketPlayer;
window.processTransferMarketAfterMatch = processTransferMarketAfterMatch;
window.processFrequentAITransfers = processFrequentAITransfers;
window.transferPlayerBetweenTeams = transferPlayerBetweenTeams;
window.rebuildFreeAgentPoolFromLeague = rebuildFreeAgentPoolFromLeague;
window.ensureLeagueRosterViability = ensureLeagueRosterViability;
window.ensureTeamHasMinimumRoster = ensureTeamHasMinimumRoster;
