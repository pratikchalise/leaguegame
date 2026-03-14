// Global Game State
let teams = [];
let fixtures = [];
let currentMatchIndex = 0;
let matchHistory = [];
let knockoutMatches = [];
let knockoutResults = [];
let knockoutHistory = [];
let knockoutStage = 0;
let seasonEnded = false;
let currentSeason = 1;
let freeAgents = [];
let seasonHistory = [];
let globalRecords = {
    topScorers: [], // { name, team, goals, season }
    topAssisters: [], // { name, team, assists, season }
    topTeamPoints: [], // { team, points, season }
    topTeamGoals: [] // { team, goals, season }
};

const maxTeams = 64;

// Load history
const storedHistory = localStorage.getItem("matchHistory");
if (storedHistory) matchHistory = JSON.parse(storedHistory);

const storedSeasonHistory = localStorage.getItem("seasonHistory");
if (storedSeasonHistory) seasonHistory = JSON.parse(storedSeasonHistory);

const storedGlobalRecords = localStorage.getItem("globalRecords");
if (storedGlobalRecords) globalRecords = JSON.parse(storedGlobalRecords);

// --- UTILS ---
function randomInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function shuffleArray(array) {
  for (let i = array.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [array[i], array[j]] = [array[j], array[i]];
  }
}

// --- TEAM GENERATION ---
function generateTeams(count, customNames = []) {
  teams = [];
  const usedColors = new Set();
  const usedLeaguePlayerNames = new Set();
  
  function getColor() {
    let color;
    do {
      color = `hsl(${randomInt(0, 360)}, 60%, 45%)`;
    } while (usedColors.has(color));
    usedColors.add(color);
    return color;
  }

  // Separate players by position and rating (Unique vs Common)
  const uniquePool = {
      GK: playerDatabase.filter(p => p.position === "GK" && p.rating >= 95),
      DEF: playerDatabase.filter(p => p.position === "DEF" && p.rating >= 95),
      MID: playerDatabase.filter(p => p.position === "MID" && p.rating >= 95),
      FWD: playerDatabase.filter(p => p.position === "FWD" && p.rating >= 95)
  };
  
  const commonPool = {
      GK: playerDatabase.filter(p => p.position === "GK" && p.rating < 95),
      DEF: playerDatabase.filter(p => p.position === "DEF" && p.rating < 95),
      MID: playerDatabase.filter(p => p.position === "MID" && p.rating < 95),
      FWD: playerDatabase.filter(p => p.position === "FWD" && p.rating < 95)
  };

  // Shuffle unique pools
  Object.values(uniquePool).forEach(shuffleArray);
  
  for (let i = 0; i < count; i++) {
    let teamPlayers = [];
    const teamPlayerNames = new Set();

    // Helper to add player (league-wide unique names)
    const addPlayer = (pos) => {
        let pData = null;
        let useUnique = false;
        const uPool = uniquePool[pos];

        // Determine if we should use a unique player
        if (uPool.length > 0) {
            // Estimate remaining slots for this position across all remaining teams
            let slotsPerTeam = 1;
            if (pos === 'GK') slotsPerTeam = 2;
            if (pos === 'DEF') slotsPerTeam = 5; // 4 + 1 flex approx
            if (pos === 'MID') slotsPerTeam = 4; // 3 + 1 flex approx
            if (pos === 'FWD') slotsPerTeam = 4; // 3 + 1 flex approx
            
            const remainingTeams = count - i;
            const remainingSlots = remainingTeams * slotsPerTeam;
            
            // Probability to pick unique = (Available Unique) / (Remaining Slots)
            // We multiply by 1.5 to be slightly aggressive in using them up, ensuring they don't get left over
            const prob = (uPool.length / remainingSlots) * 1.5;
            
            if (Math.random() < prob) {
                useUnique = true;
            }
        }

        if (useUnique) {
            // pick unique player not yet used league-wide
            while (uPool.length > 0 && !pData) {
              const candidate = uPool.pop();
              if (!usedLeaguePlayerNames.has(candidate.name) && !teamPlayerNames.has(candidate.name)) {
                pData = candidate;
              }
            }
        } else {
            // Use common pool but still avoid duplicates across the league
            const cPool = commonPool[pos];
            if (cPool.length > 0) {
                let attempts = 0;
                do {
                    pData = cPool[Math.floor(Math.random() * cPool.length)];
                    attempts++;
                } while ((teamPlayerNames.has(pData.name) || usedLeaguePlayerNames.has(pData.name)) && attempts < 40);
                if (pData && (teamPlayerNames.has(pData.name) || usedLeaguePlayerNames.has(pData.name))) {
                  pData = null;
                }
            }
        }

        // Fallback if no player found
        if (!pData) {
            let synthetic;
            do {
              synthetic = `${pos} Youth ${randomInt(1000,9999)}`;
            } while (teamPlayerNames.has(synthetic) || usedLeaguePlayerNames.has(synthetic));
            pData = { name: synthetic, rating: randomInt(60,85), position: pos };
        }

        teamPlayerNames.add(pData.name);
        usedLeaguePlayerNames.add(pData.name);
        teamPlayers.push(createPlayerObject(pData.name, pData.rating, pData.position));
    };
    
    // Add 2 GK
    for(let j=0; j<2; j++) addPlayer("GK");
    
    // Add 4 DEF minimum
    for(let j=0; j<4; j++) addPlayer("DEF");
    
    // Add 3 MID minimum
    for(let j=0; j<3; j++) addPlayer("MID");
    
    // Add 3 FWD minimum
    for(let j=0; j<3; j++) addPlayer("FWD");
    
    // Add remaining 5 players randomly from available positions
    for(let j=0; j<5; j++) {
        const randomPos = ["DEF", "MID", "FWD"][randomInt(0, 2)];
        addPlayer(randomPos);
    }

    teams.push({
      id: i,
      name: customNames[i] || `Team ${i + 1}`,
      color: getColor(),
      manager: null,
      morale: randomInt(50, 65),
      players: teamPlayers,
      stats: {
        played: 0,
        wins: 0,
        draws: 0,
        losses: 0,
        goalsFor: 0,
        goalsAgainst: 0,
        points: 0,
      },
    });
  }

  if (typeof initializeMoneySystemForTeams === 'function') initializeMoneySystemForTeams(teams);
  if (typeof initializeTransferSystem === 'function') initializeTransferSystem(teams);
  if (typeof enforceLeagueWideUniquePlayers === 'function') enforceLeagueWideUniquePlayers();
  if (typeof rebuildFreeAgentPoolFromLeague === 'function') rebuildFreeAgentPoolFromLeague();
}

function generateRandomPlayersForTeam(index) {
  if (!teams[index]) return;
  teams[index].players = [];
  const usedAcrossLeague = new Set();
  teams.forEach((t, idx) => {
    if (idx === index) return;
    t.players.forEach(p => usedAcrossLeague.add(p.name));
  });
  
  let gkPlayers = playerDatabase.filter(p => p.position === "GK");
  let defPlayers = playerDatabase.filter(p => p.position === "DEF");
  let midPlayers = playerDatabase.filter(p => p.position === "MID");
  let fwdPlayers = playerDatabase.filter(p => p.position === "FWD");
  
  shuffleArray(gkPlayers);
  shuffleArray(defPlayers);
  shuffleArray(midPlayers);
  shuffleArray(fwdPlayers);
  
  // Add 2 GK
  for(let j=0; j<2; j++) {
      if(gkPlayers.length > 0) {
          let pData = gkPlayers.pop();
          while (pData && usedAcrossLeague.has(pData.name) && gkPlayers.length > 0) pData = gkPlayers.pop();
          if (!pData || usedAcrossLeague.has(pData.name)) {
            pData = { name: `GK Youth ${randomInt(1000,9999)}`, rating: randomInt(60,84), position: 'GK' };
          }
          teams[index].players.push(createPlayerObject(pData.name, pData.rating, pData.position));
          usedAcrossLeague.add(pData.name);
      }
  }
  
  // Add 4 DEF
  for(let j=0; j<4; j++) {
      if(defPlayers.length > 0) {
          let pData = defPlayers.pop();
          while (pData && usedAcrossLeague.has(pData.name) && defPlayers.length > 0) pData = defPlayers.pop();
          if (!pData || usedAcrossLeague.has(pData.name)) {
            pData = { name: `DEF Youth ${randomInt(1000,9999)}`, rating: randomInt(60,84), position: 'DEF' };
          }
          teams[index].players.push(createPlayerObject(pData.name, pData.rating, pData.position));
          usedAcrossLeague.add(pData.name);
      }
  }
  
  // Add 3 MID
  for(let j=0; j<3; j++) {
      if(midPlayers.length > 0) {
          let pData = midPlayers.pop();
          while (pData && usedAcrossLeague.has(pData.name) && midPlayers.length > 0) pData = midPlayers.pop();
          if (!pData || usedAcrossLeague.has(pData.name)) {
            pData = { name: `MID Youth ${randomInt(1000,9999)}`, rating: randomInt(60,84), position: 'MID' };
          }
          teams[index].players.push(createPlayerObject(pData.name, pData.rating, pData.position));
          usedAcrossLeague.add(pData.name);
      }
  }
  
  // Add 3 FWD
  for(let j=0; j<3; j++) {
      if(fwdPlayers.length > 0) {
          let pData = fwdPlayers.pop();
          while (pData && usedAcrossLeague.has(pData.name) && fwdPlayers.length > 0) pData = fwdPlayers.pop();
          if (!pData || usedAcrossLeague.has(pData.name)) {
            pData = { name: `FWD Youth ${randomInt(1000,9999)}`, rating: randomInt(60,84), position: 'FWD' };
          }
          teams[index].players.push(createPlayerObject(pData.name, pData.rating, pData.position));
          usedAcrossLeague.add(pData.name);
      }
  }
  
  // Add remaining 5 random
  for(let j=0; j<5; j++) {
      const allRemaining = [...defPlayers, ...midPlayers, ...fwdPlayers];
      if(allRemaining.length > 0) {
          shuffleArray(allRemaining);
          let pData = allRemaining[0];
          if (usedAcrossLeague.has(pData.name)) {
            pData = allRemaining.find(x => !usedAcrossLeague.has(x.name)) || null;
          }
          if (!pData) {
            const randomPos = ["DEF", "MID", "FWD"][randomInt(0, 2)];
            pData = { name: `${randomPos} Youth ${randomInt(1000,9999)}`, rating: randomInt(60,84), position: randomPos };
          }
          teams[index].players.push(createPlayerObject(pData.name, pData.rating, pData.position));
          usedAcrossLeague.add(pData.name);
          
          if(pData.position === "DEF") defPlayers = defPlayers.filter(p => p.name !== pData.name);
          else if(pData.position === "MID") midPlayers = midPlayers.filter(p => p.name !== pData.name);
          else fwdPlayers = fwdPlayers.filter(p => p.name !== pData.name);
      }
  }

  if (typeof ensureTeamFinanceProfile === 'function') ensureTeamFinanceProfile(teams[index]);
  if (typeof initializeMoneySystemForTeams === 'function') initializeMoneySystemForTeams([teams[index]]);
  if (typeof enforceLeagueWideUniquePlayers === 'function') enforceLeagueWideUniquePlayers();
  if (typeof rebuildFreeAgentPoolFromLeague === 'function') rebuildFreeAgentPoolFromLeague();
}

// --- FIXTURES ---
function generateFixtures() {
  fixtures = [];
  for (let i = 0; i < teams.length; i++) {
    for (let j = 0; j < teams.length; j++) {
      if (i !== j)
        fixtures.push({
          home: teams[i],
          away: teams[j],
          homeScore: null,
          awayScore: null,
          played: false,
        });
    }
  }
  shuffleArray(fixtures);
  currentMatchIndex = 0;
}

// --- MATCH LOGIC ---
function calculateMatchScore(home, away) {
  const getTeamRating = (team) => {
    if (!team.players || team.players.length === 0) return 70;
    return (
      team.players.reduce((sum, p) => sum + (p.rating || 70), 0) /
      team.players.length
    );
  };

  const homeRating = getTeamRating(home);
  const awayRating = getTeamRating(away);

  // Base randomness
  let homeScore = randomInt(0, 4);
  let awayScore = randomInt(0, 4);

  // Rating influence
  const diff = homeRating - awayRating;
  
  if (diff > 0) {
    // Home is stronger
    if (randomInt(0, 100) < diff) homeScore += randomInt(1, 3);
  } else {
    // Away is stronger
    if (randomInt(0, 100) < Math.abs(diff)) awayScore += randomInt(1, 3);
  }

  // Home advantage
  if (randomInt(0, 4) === 0) homeScore++;

  return { homeScore, awayScore };
}

function getWeightedRandomPlayer(players, positionWeights = {}) {
  if (!players || players.length === 0) return null;
  
  // Default position weights (1.0 = normal)
  const defaultWeights = {
    "GK": positionWeights.GK || 0.01,
    "DEF": positionWeights.DEF || 0.3,
    "MID": positionWeights.MID || 1.0,
    "FWD": positionWeights.FWD || 2.5
  };
  
  // Weight = rating^4 * position multiplier
  const weights = players.map((p) => {
    const posWeight = defaultWeights[p.position] || 1.0;
    return Math.pow(p.rating || 70, 4) * posWeight;
  });
  
  const totalWeight = weights.reduce((a, b) => a + b, 0);
  let r = Math.random() * totalWeight;

  for (let i = 0; i < players.length; i++) {
    r -= weights[i];
    if (r <= 0) return players[i];
  }
  return players[players.length - 1];
}

function distributePlayerStats(match, homeScore, awayScore) {
  // Goals & Assists with position-based weights
  const goalWeights = { GK: 0.001, DEF: 0.2, MID: 1.2, FWD: 3.0 };
  const assistWeights = { GK: 0.01, DEF: 0.5, MID: 2.0, FWD: 1.5 };
  
  for (let i = 0; i < homeScore; i++) {
    let scorer = getWeightedRandomPlayer(match.home.players, goalWeights);
    if (scorer) scorer.goals++;
    let assister = getWeightedRandomPlayer(match.home.players, assistWeights);
    if (assister && assister !== scorer) assister.assists++;
  }
  for (let i = 0; i < awayScore; i++) {
    let scorer = getWeightedRandomPlayer(match.away.players, goalWeights);
    if (scorer) scorer.goals++;
    let assister = getWeightedRandomPlayer(match.away.players, assistWeights);
    if (assister && assister !== scorer) assister.assists++;
  }

  // Cards, Penalties, Freekicks, Passing - Position-based
  [match.home.players, match.away.players].forEach(teamPlayers => {
      teamPlayers.forEach(p => {
          // Cards (DEF and MID most likely, GK very rare)
          let cardChance;
          if (p.position === "GK") cardChance = 200;       // Very rare
          else if (p.position === "DEF") cardChance = 12;   // Most likely
          else if (p.position === "MID") cardChance = 15;
          else cardChance = 20;                              // FWD
          if (randomInt(1, cardChance) === 1) p.yellowCards++;
          let redChance = p.position === "GK" ? 500 : 60;
          if (randomInt(1, redChance) === 1) p.redCards++;

          // Penalties (FWD and MID more likely)
          let penaltyChance = p.position === "FWD" ? 80 : p.position === "MID" ? 120 : 200;
          if (randomInt(1, penaltyChance) === 1) {
              if(randomInt(0, 100) < p.rating) p.penalties++;
          }

          // Freekicks (Very rare, position matters)
          let fkChance = p.position === "FWD" ? 250 : p.position === "MID" ? 200 : 500;
          if (randomInt(1, fkChance) === 1) {
              const fkRating = p.freekickRating || (p.rating - 10);
              if(randomInt(0, 100) < (fkRating - 30)) p.freekicks++;
          }

          // Passing Stats (position-based attempts)
          let attempts;
          if (p.position === "GK") attempts = randomInt(15, 30);
          else if (p.position === "DEF") attempts = randomInt(30, 60);
          else if (p.position === "MID") attempts = randomInt(50, 80);
          else attempts = randomInt(20, 40); // FWD
          
          p.passesAttempted += attempts;
          
          const passRating = p.passingRating || p.rating;
          const accuracy = 70 + ((passRating - 60) / (99 - 60)) * 25;
          const completed = Math.round(attempts * (accuracy / 100));
          p.passesCompleted += completed;
      });
  });
}

function updateTeamStats(m) {
  const h = m.home,
    a = m.away;
  h.stats.played++;
  a.stats.played++;
  h.stats.goalsFor += m.homeScore;
  h.stats.goalsAgainst += m.awayScore;
  a.stats.goalsFor += m.awayScore;
  a.stats.goalsAgainst += m.homeScore;
  if (m.homeScore > m.awayScore) {
    h.stats.wins++;
    a.stats.losses++;
    h.stats.points += 3;
  } else if (m.homeScore < m.awayScore) {
    a.stats.wins++;
    h.stats.losses++;
    a.stats.points += 3;
  } else {
    h.stats.draws++;
    a.stats.draws++;
    h.stats.points += 1;
    a.stats.points += 1;
  }

  if (typeof updateTeamEconomyAfterMatch === 'function') {
    updateTeamEconomyAfterMatch(m);
  }
}

// --- KNOCKOUT LOGIC ---
function getKnockoutTeamCount(total) {
    if (total < 4) return 4;
    const powers = [64, 32, 16, 8, 4];
    for (let p of powers) {
      if (total >= p) return p;
    }
    return 4;
}

function getSortedTeams() {
    return [...teams].sort(
      (a, b) =>
        b.stats.points - a.stats.points ||
        b.stats.goalsFor -
          b.stats.goalsAgainst -
          (a.stats.goalsFor - a.stats.goalsAgainst) ||
        b.stats.goalsFor - a.stats.goalsFor
    );
}

function saveKnockoutResult(m, homeScore, awayScore, penaltyResult) {
    // penaltyResult: { homePenScore, awayPenScore } or null
    let penaltyNote = '';
    let displayHome = homeScore;
    let displayAway = awayScore;
    if (penaltyResult) {
        penaltyNote = ` (Penalties: ${penaltyResult.homePenScore}-${penaltyResult.awayPenScore})`;
    }
    // Determine winner: if draw, use penalty result
    let winner;
    if (homeScore !== awayScore) {
        winner = homeScore > awayScore ? m.home : m.away;
    } else if (penaltyResult) {
        winner = penaltyResult.homePenScore > penaltyResult.awayPenScore ? m.home : m.away;
    } else {
        // Fallback (should not happen)
        winner = Math.random() < 0.5 ? m.home : m.away;
    }

    // Increment stats (use original scores for stats)
    m.home.stats.played++;
    m.away.stats.played++;
    m.home.stats.goalsFor += homeScore;
    m.home.stats.goalsAgainst += awayScore;
    m.away.stats.goalsFor += awayScore;
    m.away.stats.goalsAgainst += homeScore;

    if (winner === m.home) {
        m.home.stats.wins++;
        m.away.stats.losses++;
    } else {
        m.away.stats.wins++;
        m.home.stats.losses++;
    }

    distributePlayerStats(m, homeScore, awayScore);

    knockoutResults.push({
        stage: knockoutStage,
        match: m,
        homeScore: displayHome,
        awayScore: displayAway,
        winner,
        penaltyNote,
        penaltyResult: penaltyResult || null
    });

    knockoutStage++;
}

// Auto-resolve penalty shootout (for instant sims)
function autoResolvePenaltyShootout(homeTeam, awayTeam) {
    const getTeamRating = (team) => {
        if (!team.players || team.players.length === 0) return 70;
        return team.players.reduce((s, p) => s + (p.rating || 70), 0) / team.players.length;
    };
    const homeRating = getTeamRating(homeTeam);
    const awayRating = getTeamRating(awayTeam);

    // Pick 5 penalty takers per team (prefer FWD/MID)
    const pickTakers = (team) => {
        const sorted = [...team.players].sort((a, b) => {
            const posWeight = { FWD: 4, MID: 3, DEF: 2, GK: 1 };
            return (posWeight[b.position] || 2) - (posWeight[a.position] || 2) || b.rating - a.rating;
        });
        return sorted.slice(0, 5);
    };

    const homeTakers = pickTakers(homeTeam);
    const awayTakers = pickTakers(awayTeam);

    const kicks = [];
    let homeGoals = 0, awayGoals = 0;

    // First 5 rounds
    for (let i = 0; i < 5; i++) {
        // Home kick
        const hPlayer = homeTakers[i] || homeTakers[homeTakers.length - 1];
        const hBase = 70 + ((hPlayer.rating - 60) / 40) * 15;
        const hScored = Math.random() * 100 < hBase;
        if (hScored) homeGoals++;
        kicks.push({ round: i + 1, side: 'home', player: hPlayer, scored: hScored });

        // Away kick
        const aPlayer = awayTakers[i] || awayTakers[awayTakers.length - 1];
        const aBase = 70 + ((aPlayer.rating - 60) / 40) * 15;
        const aScored = Math.random() * 100 < aBase;
        if (aScored) awayGoals++;
        kicks.push({ round: i + 1, side: 'away', player: aPlayer, scored: aScored });

        // Check if shootout is decided early
        const roundsLeft = 4 - i;
        if (homeGoals > awayGoals + roundsLeft) break; // Home can't be caught
        if (awayGoals > homeGoals + roundsLeft) break; // Away can't be caught
    }

    // Sudden death if still tied
    let sdRound = 6;
    while (homeGoals === awayGoals) {
        const hIdx = (sdRound - 1) % homeTakers.length;
        const aIdx = (sdRound - 1) % awayTakers.length;
        const hPlayer = homeTakers[hIdx];
        const aPlayer = awayTakers[aIdx];
        const hBase = 70 + ((hPlayer.rating - 60) / 40) * 15;
        const aBase = 70 + ((aPlayer.rating - 60) / 40) * 15;
        const hScored = Math.random() * 100 < hBase;
        const aScored = Math.random() * 100 < aBase;
        if (hScored) homeGoals++;
        if (aScored) awayGoals++;
        kicks.push({ round: sdRound, side: 'home', player: hPlayer, scored: hScored });
        kicks.push({ round: sdRound, side: 'away', player: aPlayer, scored: aScored });
        sdRound++;
        if (sdRound > 20) { homeGoals++; break; } // Safety cap
    }

    return {
        homePenScore: homeGoals,
        awayPenScore: awayGoals,
        kicks: kicks,
        winner: homeGoals > awayGoals ? 'home' : 'away'
    };
}

function updateGlobalRecords(seasonIndex) {
    // 1. Top Scorers & Assisters
    let allPlayers = [];
    teams.forEach(t => {
        t.players.forEach(p => {
            allPlayers.push({ ...p, teamName: t.name, season: seasonIndex + 1 });
        });
    });

    // Sort by goals
    allPlayers.sort((a, b) => b.goals - a.goals);
    // Take top 10 candidates from this season
    const seasonTopScorers = allPlayers.slice(0, 10).map(p => ({
        name: p.name,
        team: p.teamName,
        goals: p.goals,
        season: p.season
    }));

    // Merge with global and keep top 10
    globalRecords.topScorers = [...globalRecords.topScorers, ...seasonTopScorers]
        .sort((a, b) => b.goals - a.goals)
        .slice(0, 10);

    // Sort by assists
    allPlayers.sort((a, b) => b.assists - a.assists);
    const seasonTopAssisters = allPlayers.slice(0, 10).map(p => ({
        name: p.name,
        team: p.teamName,
        assists: p.assists,
        season: p.season
    }));

    globalRecords.topAssisters = [...globalRecords.topAssisters, ...seasonTopAssisters]
        .sort((a, b) => b.assists - a.assists)
        .slice(0, 10);

    // 2. Team Records
    const seasonTeams = teams.map(t => ({
        team: t.name,
        points: t.stats.points,
        goals: t.stats.goalsFor,
        season: seasonIndex + 1
    }));

    // Top Points
    globalRecords.topTeamPoints = [...globalRecords.topTeamPoints, ...seasonTeams]
        .sort((a, b) => b.points - a.points)
        .slice(0, 10);

    // Top Goals
    globalRecords.topTeamGoals = [...globalRecords.topTeamGoals, ...seasonTeams]
        .sort((a, b) => b.goals - a.goals)
        .slice(0, 10);

    localStorage.setItem("globalRecords", JSON.stringify(globalRecords));
}

