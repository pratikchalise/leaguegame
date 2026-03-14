const app = document.getElementById("app");

// --- SETUP UI ---
function renderSetup() {
  if (typeof ensureManagerState === "function") ensureManagerState();

  app.innerHTML = `
    <div class="setup-card">
      <h2>🏆 Create Your League</h2>
      <p class="setup-subtitle">Set up your tournament and compete for glory</p>
      <label>Number of Teams (max ${maxTeams})</label>
      <input type="number" id="teamCount" min="2" max="${maxTeams}" value="8" oninput="renderTeamNameInputs()">
      <div id="teamNamesContainer"></div>
      <div id="homeManagerSelectWrap" class="home-manager-select-wrap"></div>
      <button onclick="startLeague()">🚀 Generate Teams & Start</button>
      <div style="display:flex; gap:12px; margin-top:16px; justify-content:center; flex-wrap:wrap;">
        <button class="btn-secondary" onclick="importRosterData()" style="flex:1; min-width:140px;">📥 Import Roster</button>
        <button class="btn-secondary" onclick="importTournament()" style="flex:1; min-width:140px;">📂 Load Tournament</button>
      </div>
    </div>
  `;
  renderTeamNameInputs();
}

function renderTeamNameInputs() {
  const count = parseInt(document.getElementById("teamCount").value);
  const container = document.getElementById("teamNamesContainer");
  if (isNaN(count) || count < 2 || count > maxTeams) {
    container.innerHTML = `<p style="color:red;">Please choose between 2 and ${maxTeams} teams.</p>`;
    return;
  }

  let html = `<h3 style="margin-bottom:12px;">Enter Team Names</h3><div class="team-name-grid">`;
  for (let i = 0; i < count; i++) {
    html += `
      <div>
        <label>Team ${i + 1}</label>
        <input type="text" id="teamNameInput${i}" value="Team ${i + 1}">
      </div>
    `;
  }
  html += `</div>`;
  container.innerHTML = html;

  if (typeof renderHomeManagerSelect === "function") renderHomeManagerSelect();
}

function startLeague() {
  const count = parseInt(document.getElementById("teamCount").value);
  if (isNaN(count) || count < 2 || count > maxTeams) {
    alert(`Please enter between 2 and ${maxTeams}`);
    return;
  }

  // Collect custom names
  let customNames = [];
  for (let i = 0; i < count; i++) {
    const val = document.getElementById(`teamNameInput${i}`).value.trim();
    customNames.push(val || `Team ${i + 1}`);
  }

  generateTeams(count, customNames);
  if (typeof applyManagerSetupSelectionAfterTeamCreation === "function") {
    applyManagerSetupSelectionAfterTeamCreation();
  }
  generateFixtures();
  renderLeagueUI();
}

// --- LEAGUE UI ---
function renderLeagueUI() {
  app.innerHTML = `
    <div class="dashboard-header">
      <h2>⚽ League Dashboard</h2>
      <div class="match-counter">Match ${fixtures.filter(f => f.played).length} / ${fixtures.length}</div>
    </div>

    ${typeof renderManagerQuickBadge === 'function' ? renderManagerQuickBadge() : ''}

    <div class="action-grid">
      <div class="action-card" onclick="simulateNextMatch()">
        <div class="action-icon">⚡</div>
        <div class="action-label">Sim Next</div>
      </div>
      <div class="action-card primary" onclick="simulateNextMatchVisual()">
        <div class="action-icon">▶️</div>
        <div class="action-label">Watch Match</div>
      </div>
      <div class="action-card" onclick="simulateAllMatches()">
        <div class="action-icon">⏩</div>
        <div class="action-label">Sim All</div>
      </div>
      <div class="action-card" onclick="startKnockouts()">
        <div class="action-icon">🏆</div>
        <div class="action-label">Knockouts</div>
      </div>
      <div class="action-card" onclick="showLeagueStats()">
        <div class="action-icon">📊</div>
        <div class="action-label">Stats</div>
      </div>
      <div class="action-card" onclick="openManagerHub()">
        <div class="action-icon">🧠</div>
        <div class="action-label">Manager Hub</div>
      </div>
      <div class="action-card" onclick="openGlobalTransferMarket()">
        <div class="action-icon">💱</div>
        <div class="action-label">Transfer Market</div>
      </div>
      <div class="action-card" onclick="renderPlayerListUI()">
        <div class="action-icon">👥</div>
        <div class="action-label">Players</div>
      </div>
      <div class="action-card success" onclick="openAddTeamPopup()">
        <div class="action-icon">➕</div>
        <div class="action-label">Add Team</div>
      </div>
      <div class="action-card" onclick="regenerateAllPlayers()">
        <div class="action-icon">🎲</div>
        <div class="action-label">Regen All</div>
      </div>
      <div class="action-card" onclick="viewMatchHistory()">
        <div class="action-icon">📜</div>
        <div class="action-label">History</div>
      </div>
      <div class="action-card" onclick="viewTrophyRoom()">
        <div class="action-icon">🏅</div>
        <div class="action-label">Trophies</div>
      </div>
      <div class="action-card" onclick="openSaveLoadPopup()">
        <div class="action-icon">💾</div>
        <div class="action-label">Save/Load</div>
      </div>
      <div class="action-card danger" onclick="restartLeague()">
        <div class="action-icon">🔄</div>
        <div class="action-label">Restart</div>
      </div>
    </div>

    <div class="content-grid">
      <div id="currentMatch"></div>
      <div class="team-mgmt">
        <div class="section-title">⚙️ Team Management</div>
        <div class="form-row">
          <div style="flex:1;">
            <label>Select Team</label>
            <select id="teamSelect">
              ${teams.map((t) => `<option value="${t.id}">${t.name}</option>`).join("")}
            </select>
          </div>
          <button class="btn-secondary" onclick="generateRandomPlayersForSelectedTeam()">🎲 Regen</button>
        </div>
        <div class="form-row">
          <div style="flex:1;">
            <label>Add Player</label>
            <input type="text" id="newPlayerName" placeholder="Player Name">
          </div>
          <button class="btn-secondary" onclick="addPlayerToSelectedTeam()">➕ Add</button>
        </div>
      </div>
    </div>

    <div id="leagueTable"></div>
  `;

  renderCurrentMatch();
  renderLeagueTable();
}

function renderCurrentMatch() {
  const c = document.getElementById("currentMatch");
  // Always find the next unplayed match dynamically
  currentMatchIndex = fixtures.findIndex(f => !f.played);
  if (currentMatchIndex === -1) {
    currentMatchIndex = fixtures.length;
    c.innerHTML = `<div class="match-card"><h3>✅ All matches completed!</h3><p class="text-muted" style="margin-top:8px;">Start the knockout stage to crown a champion.</p></div>`;
    return;
  }
  const m = fixtures[currentMatchIndex];
  c.innerHTML = `
    <div class="match-card">
      <h3>Next Match</h3>
      <div class="match-vs">
        <strong>${m.home.name}</strong>
        <span class="vs-text">vs</span>
        <strong>${m.away.name}</strong>
      </div>
      <div class="match-inputs">
        <div class="input-group">
          <label>${m.home.name}</label>
          <input id="homeScoreInput" type="number" min="0" placeholder="Auto">
        </div>
        <div class="input-group">
          <label>${m.away.name}</label>
          <input id="awayScoreInput" type="number" min="0" placeholder="Auto">
        </div>
      </div>
      <div class="match-actions">
        <button onclick="saveMatchResult()">💾 Save</button>
        <button class="btn-success" onclick="simulateNextMatchVisual()">▶ Watch</button>
      </div>
    </div>
  `;
}

function renderLeagueTable() {
  const c = document.getElementById("leagueTable");
  const sorted = [...teams].sort(
    (a, b) =>
      b.stats.points - a.stats.points ||
      b.stats.goalsFor - b.stats.goalsAgainst - (a.stats.goalsFor - a.stats.goalsAgainst) ||
      b.stats.goalsFor - a.stats.goalsFor
  );
  
  let html = `<h2>League Table</h2><table>
    <thead><tr>
      <th>#</th><th>Team</th><th>OVR</th><th>P</th><th>W</th><th>D</th><th>L</th>
      <th>GF</th><th>GA</th><th>GD</th><th>Points</th>
    </tr></thead><tbody>`;
    
  sorted.forEach((t, i) => {
    const gd = t.stats.goalsFor - t.stats.goalsAgainst;
    const avgRating = t.players.length > 0
        ? (t.players.reduce((sum, p) => sum + (p.rating || 70), 0) / t.players.length).toFixed(0)
        : "-";

    html += `<tr class="team-row" style="border-left: 4px solid ${t.color};" onclick="showTeamStats(${t.id})">
      <td>${i + 1}</td><td><span style="color:${t.color}; font-weight:700;">●</span> ${t.name}</td><td>${avgRating}</td>
      <td>${t.stats.played}</td><td>${t.stats.wins}</td><td>${t.stats.draws}</td><td>${t.stats.losses}</td>
      <td>${t.stats.goalsFor}</td><td>${t.stats.goalsAgainst}</td><td>${gd}</td><td>${t.stats.points}</td>
    </tr>`;
  });
  html += `</tbody></table>`;
  c.innerHTML = html;
}

// Helper to update match counter without full re-render
function updateMatchCounter() {
  const counter = document.querySelector('.match-counter');
  if (counter) {
    const played = fixtures.filter(f => f.played).length;
    counter.textContent = `Match ${played} / ${fixtures.length}`;
  }
}

// --- ACTIONS ---
function simulateNextMatch() {
  // Find the next unplayed match dynamically
  currentMatchIndex = fixtures.findIndex(f => !f.played);
  if (currentMatchIndex === -1) return;
  const match = fixtures[currentMatchIndex];
  
  const result = calculateMatchScore(match.home, match.away);
  match.homeScore = result.homeScore;
  match.awayScore = result.awayScore;
  
  match.played = true;
  updateTeamStats(match);
  distributePlayerStats(match, match.homeScore, match.awayScore);
  matchHistory.push({
    homeTeam: match.home.name,
    awayTeam: match.away.name,
    homeScore: match.homeScore,
    awayScore: match.awayScore,
  });
  localStorage.setItem("matchHistory", JSON.stringify(matchHistory));
  renderCurrentMatch();
  renderLeagueTable();
  updateMatchCounter();
  if (typeof onManagerPostMatchUpdate === "function") onManagerPostMatchUpdate(match);
  if (typeof processTransferMarketAfterMatch === "function") processTransferMarketAfterMatch();
  if (typeof managerWeeklyTick === "function") managerWeeklyTick();
  if (typeof evaluateBoardObjectives === "function") evaluateBoardObjectives();
  checkSeasonEnd();
}

function simulateAllMatches() {
  while (fixtures.some(f => !f.played)) simulateNextMatch();
}

function saveMatchResult() {
  // Find the current unplayed match
  currentMatchIndex = fixtures.findIndex(f => !f.played);
  if (currentMatchIndex === -1) return alert("No matches left to play!");

  const hVal = document.getElementById("homeScoreInput").value;
  const aVal = document.getElementById("awayScoreInput").value;
  const homeScore = hVal === "" ? randomInt(0, 15) : parseInt(hVal);
  const awayScore = aVal === "" ? randomInt(0, 15) : parseInt(aVal);
  if (isNaN(homeScore) || isNaN(awayScore)) return alert("Invalid score!");
  if (homeScore < 0 || awayScore < 0) return alert("Scores must be non-negative!");
  
  const m = fixtures[currentMatchIndex];
  m.homeScore = homeScore;
  m.awayScore = awayScore;
  m.played = true;
  matchHistory.push({
    homeTeam: m.home.name,
    awayTeam: m.away.name,
    homeScore,
    awayScore,
  });
  localStorage.setItem("matchHistory", JSON.stringify(matchHistory));

  updateTeamStats(m);
  distributePlayerStats(m, homeScore, awayScore);

  renderCurrentMatch();
  renderLeagueTable();
  updateMatchCounter();
  if (typeof onManagerPostMatchUpdate === "function") onManagerPostMatchUpdate(m);
  if (typeof processTransferMarketAfterMatch === "function") processTransferMarketAfterMatch();
  if (typeof managerWeeklyTick === "function") managerWeeklyTick();
  if (typeof evaluateBoardObjectives === "function") evaluateBoardObjectives();
  checkSeasonEnd();
}

function regenerateAllPlayers() {
  const customNames = teams.map((t) => t.name);
  generateTeams(teams.length, customNames);
  generateFixtures();
  renderLeagueUI();
}

function restartLeague() {
  if (confirm("Are you sure you want to restart the tournament? All data will be lost!")) {
    teams = [];
    freeAgents = [];
    fixtures = [];
    currentMatchIndex = 0;
    knockoutMatches = [];
    knockoutResults = [];
    knockoutHistory = [];
    knockoutStage = 0;
    seasonEnded = false;
    currentSeason = 1;
    renderSetup();
  }
}

function generateRandomPlayersForSelectedTeam() {
  const teamId = parseInt(document.getElementById("teamSelect").value);
  const team = teams.find((t) => t.id === teamId);
  if (!team) return alert("Team not found!");
  
  // Use the logic from gameLogic.js but we need to expose it or replicate it.
  // Since we are in global scope, we can call generateRandomPlayersForTeam(index)
  // But we need the index in the teams array, not just ID.
  const index = teams.findIndex(t => t.id === teamId);
  generateRandomPlayersForTeam(index);
  
  alert(`Generated 17 random players for ${team.name}!`);
  renderLeagueTable(); // Update OVR
}

function addPlayerToSelectedTeam() {
  const teamId = parseInt(document.getElementById("teamSelect").value);
  const team = teams.find((t) => t.id === teamId);
  if (!team) return alert("Team not found!");

  const name = document.getElementById("newPlayerName").value.trim();
  if (!name) return alert("Enter player name!");

  const playerData = getPlayerData(name);
  team.players.push(createPlayerObject(playerData.name, playerData.rating, playerData.position));

  document.getElementById("newPlayerName").value = "";
  alert(`Added ${name} to ${team.name}!`);
  renderLeagueTable(); // Update OVR
}

// --- POPUPS & STATS ---
function closePopup() {
  document.querySelectorAll(".popup-overlay").forEach((d) => d.remove());
  document.getElementById("popup").style.display = "none";
}

function showPopup(content) {
  // Remove existing overlays
  document.querySelectorAll(".popup-overlay").forEach((d) => d.remove());
  
  const overlay = document.createElement("div");
  overlay.className = "popup-overlay";
  const box = document.createElement("div");
  box.className = "popup-content";
  box.innerHTML = content;
  overlay.appendChild(box);
  overlay.addEventListener("click", (e) => {
    if (e.target === overlay) closePopup();
  });
  document.body.appendChild(overlay);
}

function closePopup() {
  document.querySelectorAll(".popup-overlay").forEach((d) => d.remove());
}

function showTeamStats(id) {
  const t = teams.find((x) => x.id === id);
  if (!t) return;

  const avgRating = t.players.length > 0
    ? (t.players.reduce((sum, p) => sum + (p.rating || 70), 0) / t.players.length).toFixed(1)
    : "N/A";

  let html = `<h2>${t.name} Team Stats</h2>`;
  html += `<div style="text-align:center; margin-bottom:20px; background: rgba(0,0,0,0.2); padding: 15px; border-radius: 10px;">
    <div style="font-size: 1.4em; margin-bottom: 10px; color: gold;">Overall Rating: <strong>${avgRating}</strong></div>
    <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 10px;">
        <div>Played: <strong>${t.stats.played}</strong></div>
        <div>Wins: <strong>${t.stats.wins}</strong></div>
        <div>Draws: <strong>${t.stats.draws}</strong></div>
        <div>Losses: <strong>${t.stats.losses}</strong></div>
        <div>GF: <strong>${t.stats.goalsFor}</strong></div>
        <div>GA: <strong>${t.stats.goalsAgainst}</strong></div>
        <div>Points: <strong>${t.stats.points}</strong></div>
    </div>
  </div>`;

  html += `<h3>Players & Stats</h3><div class="player-list" style="display: grid; grid-template-columns: repeat(auto-fill, minmax(200px, 1fr)); gap: 10px;">`;
  t.players.forEach((p) => {
    let nameColor = `hsl(${randomInt(0, 360)}, 80%, 60%)`;
    let cardBg = 'rgba(255,255,255,0.05)';
    let border = 'none';
    
    // Position badge color
    let posColor = '';
    if (p.position === 'GK') posColor = '#fbc531';
    else if (p.position === 'DEF') posColor = '#4cd137';
    else if (p.position === 'MID') posColor = '#00d2d3';
    else posColor = '#e84118'; // FWD
    
    // VIP Colors for 95+
    if (p.rating >= 99) {
        nameColor = '#ff0000'; // Red for 99
        cardBg = 'linear-gradient(135deg, rgba(255,0,0,0.2), rgba(0,0,0,0.5))';
        border = '1px solid #ff0000';
    } else if (p.rating >= 97) {
        nameColor = '#00ffea'; // Cyan for 97-98
        cardBg = 'linear-gradient(135deg, rgba(0,255,234,0.15), rgba(0,0,0,0.5))';
        border = '1px solid #00ffea';
    } else if (p.rating >= 95) {
        nameColor = '#ff00ea'; // Magenta for 95-96
        cardBg = 'linear-gradient(135deg, rgba(255,0,234,0.15), rgba(0,0,0,0.5))';
        border = '1px solid #ff00ea';
    }

    html += `<div style="background: ${cardBg}; border: ${border}; padding: 10px; border-radius: 5px; cursor: pointer; transition: transform 0.2s;" 
             onclick="closePopup(); renderPlayerListUI();"
             onmouseover="this.style.transform='scale(1.05)'" 
             onmouseout="this.style.transform='scale(1)'">
      <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:5px;">
        <span style="color:${nameColor}; font-weight:bold; font-size: 1.1em; text-shadow: 0 0 5px rgba(0,0,0,0.5);">${p.name}</span>
        <span style="background:${posColor}; color:#000; padding:2px 6px; border-radius:3px; font-size:0.7em; font-weight:bold;">${p.position}</span>
      </div>
      <div style="font-size:0.9em; color:#aaa; margin-bottom: 5px;">Rating: <span style="color: ${p.rating >= 95 ? nameColor : 'gold'}; font-weight:bold;">${p.rating}</span></div>
      <div style="font-size: 0.85em; line-height: 1.4;">
        ⚽ ${p.goals} | 🅰️ ${p.assists}
      </div>
    </div>`;
  });
  html += `</div><button onclick="closePopup()" style="margin-top: 20px; width: 100%;">Close</button>`;
  showPopup(html);
}

function showLeagueStats() {
  if (fixtures.every((f) => !f.played)) {
    showPopup("<h2>League Awards</h2><p style='text-align:center;'>No matches have been played yet!</p><button onclick='closePopup()'>Close</button>");
    return;
  }

  let awards = `<h2>🏆 League Awards</h2>`;
  awards += `
    <div class="tab-buttons" style="display:flex; flex-wrap:wrap; gap:5px; justify-content:center; margin-bottom:15px;">
      <button class="active" onclick="showStatsTab('scorers')">Top Scorers</button>
      <button onclick="showStatsTab('assisters')">Top Assisters</button>
      <button onclick="showStatsTab('yellow')">Yellow Cards</button>
      <button onclick="showStatsTab('red')">Red Cards</button>
      <button onclick="showStatsTab('penalties')">Penalties</button>
      <button onclick="showStatsTab('freekicks')">Freekicks</button>
      <button onclick="showStatsTab('passing')">Passing Accuracy</button>
    </div>
    <div class="tab-content" id="statsTabContent"></div>
    <button onclick="closePopup()" style="margin-top:15px; width:100%;">Close</button>
  `;

  showPopup(awards);
  generateStatsPopup();
}

function generateStatsPopup() {
  showStatsTab("scorers");
}

function showStatsTab(tab) {
  let players = teams.flatMap((t) => t.players);
  let sorted;
  let title;
  let valueFormatter = (p) => "";

  switch (tab) {
    case "scorers":
      sorted = players.sort((a, b) => b.goals - a.goals);
      title = "Top 20 Scorers";
      valueFormatter = (p) => `${p.goals} Goals`;
      break;
    case "assisters":
      sorted = players.sort((a, b) => b.assists - a.assists);
      title = "Top 20 Assisters";
      valueFormatter = (p) => `${p.assists} Assists`;
      break;
    case "yellow":
      sorted = players.sort((a, b) => b.yellowCards - a.yellowCards);
      title = "Most Yellow Cards";
      valueFormatter = (p) => `${p.yellowCards}`;
      break;
    case "red":
      sorted = players.sort((a, b) => b.redCards - a.redCards);
      title = "Most Red Cards";
      valueFormatter = (p) => `${p.redCards}`;
      break;
    case "penalties":
      sorted = players.sort((a, b) => b.penalties - a.penalties);
      title = "Top Penalty Scorers";
      valueFormatter = (p) => `${p.penalties}`;
      break;
    case "freekicks":
      sorted = players.sort((a, b) => b.freekicks - a.freekicks);
      title = "Top Freekick Scorers";
      valueFormatter = (p) => `${p.freekicks}`;
      break;
    case "passing":
      // Filter players with at least 10 attempts to avoid 1/1 = 100%
      sorted = players.filter(p => p.passesAttempted > 10).sort((a, b) => {
          const accA = (a.passesCompleted / a.passesAttempted) || 0;
          const accB = (b.passesCompleted / b.passesAttempted) || 0;
          return accB - accA;
      });
      title = "Best Passing Accuracy (Min 10 attempts)";
      valueFormatter = (p) => {
          const acc = ((p.passesCompleted / p.passesAttempted) * 100).toFixed(1);
          return `${acc}% (${p.passesCompleted}/${p.passesAttempted})`;
      };
      break;
  }

  let html = `<h3>${title}</h3>`;
  html += `<table class="player-stats-table" style="width:100%; border-collapse:collapse;">
    <tr style="background:rgba(255,255,255,0.1);"><th style="padding:8px;">#</th><th style="padding:8px;">Name</th><th style="padding:8px;">Stat</th></tr>`;
  
  sorted.slice(0, 20).forEach((p, i) => {
    if (tab !== 'passing' && valueFormatter(p).startsWith('0')) return; // Skip 0 stats for non-passing
    
    const color = `hsl(${randomInt(0, 360)}, 80%, 60%)`;
    let nameStyle = `color:${color}; font-weight:bold; padding:8px;`;
    
    // Apply special styles for Icons and VIPs in stats view
    if (p.type === "Icon") {
        if (p.rating >= 95) {
             // VIP Icon (Diamond/Platinum)
             nameStyle = 'color: #E0FFFF; text-shadow: 0 0 8px rgba(224, 255, 255, 0.8); font-family: "Orbitron", sans-serif; font-weight:bold; padding:8px;';
        } else {
             // Normal Icon (Gold)
             nameStyle = 'color: #F6E3BA; text-shadow: 0 0 5px rgba(246, 227, 186, 0.6); font-family: "Orbitron", sans-serif; font-weight:bold; padding:8px;';
        }
    } else if (p.rating >= 99) {
        nameStyle = 'color: #ff4d4d; text-shadow: 0 0 5px rgba(255,0,0,0.4); font-weight:bold; padding:8px;';
    } else if (p.rating >= 97) {
        nameStyle = 'color: #00ffea; text-shadow: 0 0 5px rgba(0,255,234,0.4); font-weight:bold; padding:8px;';
    } else if (p.rating >= 95) {
        nameStyle = 'color: #ff00ea; text-shadow: 0 0 5px rgba(255,0,234,0.4); font-weight:bold; padding:8px;';
    }

    html += `<tr style="border-bottom:1px solid rgba(255,255,255,0.05);">
        <td style="padding:8px;">${i + 1}</td>
        <td style="${nameStyle}">${p.name}</td>
        <td style="padding:8px;">${valueFormatter(p)}</td>
    </tr>`;
  });
  html += `</table>`;

  const content = document.getElementById("statsTabContent");
  if(content) content.innerHTML = html;

  document.querySelectorAll(".tab-buttons button").forEach((btn) => btn.classList.remove("active"));
  const activeBtn = document.querySelector(`.tab-buttons button[onclick*="${tab}"]`);
  if(activeBtn) activeBtn.classList.add("active");
}

function viewMatchHistory() {
  if (matchHistory.length === 0) {
    showPopup("<h2>Match History</h2><p>No matches yet.</p><button onclick='closePopup()'>Close</button>");
    return;
  }

  let html = "<h2>Match History</h2>";
  matchHistory.forEach((m, i) => {
    html += `<p>${i + 1}. ${m.homeTeam} ${m.homeScore} - ${m.awayScore} ${m.awayTeam}</p>`;
  });
  html += `<button onclick='clearMatchHistory()'>Clear History</button><button onclick='closePopup()'>Close</button>`;
  showPopup(html);
}

function clearMatchHistory() {
  if (confirm("Clear all match history?")) {
    matchHistory = [];
    localStorage.removeItem("matchHistory");
    viewMatchHistory();
  }
}

// --- KNOCKOUT UI ---
function startKnockouts() {
  const sortedTeams = getSortedTeams();
  const knockoutSize = getKnockoutTeamCount(sortedTeams.length);

  if (sortedTeams.length < knockoutSize) {
    alert(`Not enough teams to run a ${knockoutSize}-team knockout!`);
    return;
  }

  const selectedTeams = sortedTeams.slice(0, knockoutSize);
  shuffleArray(selectedTeams);

  knockoutResults = [];
  knockoutMatches = [];
  if(typeof knockoutHistory !== 'undefined') knockoutHistory = [];
  knockoutStage = 0;

  for (let i = 0; i < selectedTeams.length; i += 2) {
    knockoutMatches.push({
      name: `Round of ${selectedTeams.length}`,
      home: selectedTeams[i],
      away: selectedTeams[i + 1],
    });
  }

  renderNextKnockoutMatch();
}

function renderNextKnockoutMatch() {
  if (knockoutStage < knockoutMatches.length) {
    const m = knockoutMatches[knockoutStage];
    app.innerHTML = `
      <div class="knockout-header">
        <h2>🥊 ${m.name}</h2>
      </div>

      ${typeof renderManagerQuickBadge === 'function' ? renderManagerQuickBadge() : ''}

      <div class="action-grid">
        <div class="action-card" onclick="playKnockoutMatch()">
          <div class="action-icon">💾</div>
          <div class="action-label">Save Result</div>
        </div>
        <div class="action-card" onclick="simulateCurrentKnockoutMatch()">
          <div class="action-icon">⚡</div>
          <div class="action-label">Simulate</div>
        </div>
        <div class="action-card primary" onclick="simulateKnockoutMatchVisual()">
          <div class="action-icon">▶️</div>
          <div class="action-label">Watch Match</div>
        </div>
        <div class="action-card" onclick="simulateAllKnockoutMatches()">
          <div class="action-icon">⏩</div>
          <div class="action-label">Sim All</div>
        </div>
        <div class="action-card" onclick="renderPlayerListUI()">
          <div class="action-icon">👥</div>
          <div class="action-label">Players</div>
        </div>
        <div class="action-card" onclick="showLeagueStats()">
          <div class="action-icon">📊</div>
          <div class="action-label">Stats</div>
        </div>
        <div class="action-card" onclick="openManagerHub()">
          <div class="action-icon">🧠</div>
          <div class="action-label">Manager Hub</div>
        </div>
        <div class="action-card" onclick="openGlobalTransferMarket()">
          <div class="action-icon">💱</div>
          <div class="action-label">Transfer Market</div>
        </div>
        <div class="action-card" onclick="viewAwards()">
          <div class="action-icon">📋</div>
          <div class="action-label">Team Stats</div>
        </div>
        <div class="action-card" onclick="openSaveLoadPopup()">
          <div class="action-icon">💾</div>
          <div class="action-label">Save/Load</div>
        </div>
        <div class="action-card danger" onclick="restartLeague()">
          <div class="action-icon">🔄</div>
          <div class="action-label">Restart</div>
        </div>
      </div>

      <div class="match-card" style="margin-bottom:20px;">
        <div class="match-vs">
          <strong>${m.home.name}</strong>
          <span class="vs-text">vs</span>
          <strong>${m.away.name}</strong>
        </div>
        <div class="match-inputs">
          <div class="input-group">
            <label>${m.home.name}</label>
            <input id="homeScoreInput" type="number" min="0" placeholder="Score">
          </div>
          <div class="input-group">
            <label>${m.away.name}</label>
            <input id="awayScoreInput" type="number" min="0" placeholder="Score">
          </div>
        </div>
      </div>

      <div id="knockoutBracket"></div>
    `;
  } else {
    if (knockoutResults.length === 1) {
      const champion = knockoutResults[0].winner.name;
      
      if (seasonHistory.length > 0) {
          seasonHistory[seasonHistory.length - 1].knockoutChampion = champion;
          localStorage.setItem("seasonHistory", JSON.stringify(seasonHistory));
      }
      
      app.innerHTML = `
        <div class="champion-card">
          <h2>🏆 Champion: ${champion}!</h2>
          <p>Congratulations to ${champion} for winning the tournament!</p>
          <div class="champion-actions">
            <button onclick="startNextSeason()">➡️ Next Season</button>
            <button onclick="restartLeague()">🔄 Restart</button>
            <button class="btn-secondary" onclick="renderPlayerListUI()">👥 Players</button>
            <button class="btn-secondary" onclick="showLeagueStats()">📊 Stats</button>
            <button class="btn-secondary" onclick="viewAwards()">📋 Teams</button>
            <button class="btn-secondary" onclick="viewTrophyRoom()">🏅 Trophies</button>
            <button class="btn-secondary" onclick="exportRosterData()">📤 Export Roster</button>
            <button class="btn-secondary" onclick="exportTournament()">💾 Save Tournament</button>
          </div>
        </div>
        <div id="knockoutBracket"></div>
      `;
      
      setTimeout(() => {
          alert(`🏆 Tournament Over! Champion: ${champion}`);
      }, 300);
    } else {
      // Advance to next round
      const nextRoundTeams = knockoutResults.map((r) => r.winner);
      
      if(typeof knockoutHistory !== 'undefined') knockoutHistory.push(...knockoutResults);

      knockoutMatches = [];
      knockoutResults = [];
      knockoutStage = 0;

      for (let i = 0; i < nextRoundTeams.length; i += 2) {
        knockoutMatches.push({
          name: `Round of ${nextRoundTeams.length}`,
          home: nextRoundTeams[i],
          away: nextRoundTeams[i + 1],
        });
      }
      renderNextKnockoutMatch();
    }
  }
  renderKnockoutBracket();
}

function playKnockoutMatch() {
  if (knockoutStage >= knockoutMatches.length) return;
  const m = knockoutMatches[knockoutStage];
  const homeScore = parseInt(document.getElementById("homeScoreInput").value) || randomInt(0, 5);
  const awayScore = parseInt(document.getElementById("awayScoreInput").value) || randomInt(0, 5);
  if (homeScore === awayScore) {
    // Draw — launch penalty shootout
    openPenaltyShootout(m.home, m.away, homeScore, awayScore, (penResult) => {
      saveKnockoutResult(m, homeScore, awayScore, penResult);
      if (typeof onManagerPostMatchUpdate === "function") onManagerPostMatchUpdate({ home: m.home, away: m.away, homeScore, awayScore });
      if (typeof processTransferMarketAfterMatch === "function") processTransferMarketAfterMatch();
      renderNextKnockoutMatch();
    });
  } else {
    saveKnockoutResult(m, homeScore, awayScore, null);
    if (typeof onManagerPostMatchUpdate === "function") onManagerPostMatchUpdate({ home: m.home, away: m.away, homeScore, awayScore });
    if (typeof processTransferMarketAfterMatch === "function") processTransferMarketAfterMatch();
    renderNextKnockoutMatch();
  }
}

function simulateCurrentKnockoutMatch() {
  if (knockoutStage >= knockoutMatches.length) return;
  const m = knockoutMatches[knockoutStage];
  const result = calculateMatchScore(m.home, m.away);
  if (result.homeScore === result.awayScore) {
    // Draw — launch penalty shootout
    openPenaltyShootout(m.home, m.away, result.homeScore, result.awayScore, (penResult) => {
      saveKnockoutResult(m, result.homeScore, result.awayScore, penResult);
      if (typeof onManagerPostMatchUpdate === "function") onManagerPostMatchUpdate({ home: m.home, away: m.away, homeScore: result.homeScore, awayScore: result.awayScore });
      if (typeof processTransferMarketAfterMatch === "function") processTransferMarketAfterMatch();
      renderNextKnockoutMatch();
    });
  } else {
    saveKnockoutResult(m, result.homeScore, result.awayScore, null);
    if (typeof onManagerPostMatchUpdate === "function") onManagerPostMatchUpdate({ home: m.home, away: m.away, homeScore: result.homeScore, awayScore: result.awayScore });
    if (typeof processTransferMarketAfterMatch === "function") processTransferMarketAfterMatch();
    renderNextKnockoutMatch();
  }
}

function simulateAllKnockoutMatches() {
  while (knockoutStage < knockoutMatches.length || knockoutResults.length > 1) {
    if (knockoutStage < knockoutMatches.length) {
      const m = knockoutMatches[knockoutStage];
      const result = calculateMatchScore(m.home, m.away);
      let penResult = null;
      if (result.homeScore === result.awayScore) {
        penResult = autoResolvePenaltyShootout(m.home, m.away);
      }
      saveKnockoutResult(m, result.homeScore, result.awayScore, penResult);
      if (typeof onManagerPostMatchUpdate === "function") onManagerPostMatchUpdate({ home: m.home, away: m.away, homeScore: result.homeScore, awayScore: result.awayScore });
      if (typeof processTransferMarketAfterMatch === "function") processTransferMarketAfterMatch();
    } else if (knockoutResults.length > 1) {
      // Advance round logic inside loop
      const nextRoundTeams = knockoutResults.map((r) => r.winner);
      
      if(typeof knockoutHistory !== 'undefined') knockoutHistory.push(...knockoutResults);

      knockoutMatches = [];
      knockoutResults = [];
      knockoutStage = 0;
      for (let i = 0; i < nextRoundTeams.length; i += 2) {
        knockoutMatches.push({
          name: `Round of ${nextRoundTeams.length}`,
          home: nextRoundTeams[i],
          away: nextRoundTeams[i + 1],
        });
      }
    }
  }
  renderNextKnockoutMatch();
}

function renderKnockoutBracket() {
  const bracketDiv = document.getElementById("knockoutBracket");
  if (!bracketDiv) return;

  const roundsMap = new Map();
  
  // Helper to add match to map
  const addMatch = (roundName, home, away, status, winner, homeScore, awayScore) => {
      if(!roundsMap.has(roundName)) roundsMap.set(roundName, []);
      roundsMap.get(roundName).push({
          home, away, status, winner, homeScore, awayScore
      });
  };

  // Process history
  if(typeof knockoutHistory !== 'undefined') {
      knockoutHistory.forEach(res => {
          addMatch(res.match.name, res.match.home, res.match.away, 'played', res.winner, res.homeScore, res.awayScore);
      });
  }
  
  // Process current results
  const playedMatches = new Set();
  knockoutResults.forEach(res => {
      addMatch(res.match.name, res.match.home, res.match.away, 'played', res.winner, res.homeScore, res.awayScore);
      playedMatches.add(res.match);
  });
  
  // Process pending
  knockoutMatches.forEach(m => {
      if(!playedMatches.has(m)) {
          addMatch(m.name, m.home, m.away, 'pending', null, '-', '-');
      }
  });
  
  const sortedRounds = Array.from(roundsMap.keys()).sort((a, b) => {
      const numA = parseInt(a.match(/\d+/)[0]);
      const numB = parseInt(b.match(/\d+/)[0]);
      return numB - numA;
  });
  
  let html = `
    <style>
        .bracket-container {
            display: flex;
            flex-direction: row;
            overflow: auto;
            padding: 20px;
            gap: 40px;
            justify-content: flex-start;
            align-items: flex-start;
            min-height: 600px;
        }
        .bracket-round {
            display: flex;
            flex-direction: column;
            justify-content: center;
            gap: 20px;
            min-width: 200px;
            flex-shrink: 0;
        }
        .bracket-match-card {
            background: rgba(0, 43, 92, 0.8);
            border: 1px solid #4a678f;
            border-radius: 8px;
            padding: 10px;
            position: relative;
            box-shadow: 0 4px 6px rgba(0,0,0,0.3);
        }
        .team-entry {
            display: flex;
            justify-content: space-between;
            padding: 5px;
            border-radius: 4px;
        }
        .team-winner {
            color: #FFD700;
            font-weight: bold;
            text-shadow: 0 0 5px rgba(255, 215, 0, 0.5);
        }
        .team-loser {
            color: #888;
            opacity: 0.5;
        }
        .team-pending {
            color: #fff;
        }
    </style>
    <h3>Tournament Bracket</h3>
    <div class="bracket-container">
  `;
  
  sortedRounds.forEach(roundName => {
      const matches = roundsMap.get(roundName);
      html += `<div class="bracket-round">
        <h4 style="text-align:center; margin-bottom:10px; color:#aaa; font-size: 0.9em;">${roundName}</h4>`;
      
      matches.forEach(m => {
          const homeClass = m.status === 'played' ? (m.winner === m.home ? 'team-winner' : 'team-loser') : 'team-pending';
          const awayClass = m.status === 'played' ? (m.winner === m.away ? 'team-winner' : 'team-loser') : 'team-pending';
          
          html += `
            <div class="bracket-match-card">
                <div class="team-entry ${homeClass}">
                    <span>${m.home.name}</span>
                    <span>${m.homeScore}</span>
                </div>
                <div class="team-entry ${awayClass}">
                    <span>${m.away.name}</span>
                    <span>${m.awayScore}</span>
                </div>
            </div>
          `;
      });
      
      html += `</div>`;
  });
  
  html += `</div>`;
  bracketDiv.innerHTML = html;
}

function viewAwards() {
  let html = `
    <h2>Team Stats (including Knockouts)</h2>
    <table border="1" cellpadding="5">
      <tr>
        <th>Team</th>
        <th>Played</th>
        <th>Wins</th>
        <th>Goals For</th>
        <th>Goals Against</th>
        <th>Points (League Only)</th>
      </tr>
  `;

  teams.forEach((team) => {
    html += `
      <tr>
        <td>${team.name}</td>
        <td>${team.stats.played}</td>
        <td>${team.stats.wins}</td>
        <td>${team.stats.goalsFor}</td>
        <td>${team.stats.goalsAgainst}</td>
        <td>${team.stats.points}</td>
      </tr>
    `;
  });

  html += `</table>
    <button onclick="renderNextKnockoutMatch()">Back to Knockouts</button>
    <button onclick="restartLeague()">Restart Tournament</button>
  `;

  app.innerHTML = html;
}

// --- PLAYER DATABASE UI ---
// --- SMART NAVIGATION ---
function goBack() {
    // If knockouts are in progress, return to knockout view
    if (knockoutMatches && knockoutMatches.length > 0) {
        if (knockoutResults.length === 1 && knockoutStage >= knockoutMatches.length) {
            // Final result already determined — show champion screen
            renderNextKnockoutMatch();
        } else if (knockoutStage < knockoutMatches.length) {
            // Still playing knockout matches
            renderNextKnockoutMatch();
        } else {
            // Between rounds or other edge case
            renderNextKnockoutMatch();
        }
    } else {
        renderLeagueUI();
    }
}

function renderPlayerListUI() {
  if (teams.length === 0) {
    app.innerHTML = `
      <h2>Player Database</h2>
      <p>Please start the league to view team rosters.</p>
      <button onclick="renderSetup()">Back to Setup</button>
    `;
    return;
  }

  app.innerHTML = `
    <div class="dashboard-header">
      <h2>👥 Player Database</h2>
      <button class="btn-secondary" onclick="goBack()" style="font-size:0.8rem; padding:8px 14px;">← Back</button>
    </div>
    <div id="rosterContainer" class="roster-grid"></div>
  `;
  
  const container = document.getElementById("rosterContainer");
  let html = "";
  
  teams.forEach(t => {
      html += `<div class="team-card" style="border-top-color: ${t.color};">
        <h3 style="color: ${t.color}; margin: 0; font-size: 1.4rem; border-bottom: 1px solid rgba(255,255,255,0.1); padding-bottom: 10px;">${t.name}</h3>
        <table class="roster-table">
            <thead>
                <tr>
                    <th class="name-col">Player</th>
                    <th title="Position">Pos</th>
                    <th title="Overall Rating">OVR</th>
                    <th title="Goals">G</th>
                    <th title="Assists">A</th>
                    <th title="Passing Accuracy">Pass%</th>
                    <th title="Penalties">Pen</th>
                    <th title="Freekicks">FK</th>
                    <th title="Yellow Cards">YC</th>
                    <th title="Red Cards">RC</th>
                </tr>
            </thead>
            <tbody>
                ${t.players.map(p => {
                    const passAcc = p.passesAttempted > 0 ? Math.round((p.passesCompleted / p.passesAttempted) * 100) : 0;
                    
                    let rowStyle = '';
                    let nameStyle = '';
                    let ratingStyle = 'color: var(--primary-color); font-weight: bold;';
                    
                    // Position colors
                    let posColor = '';
                    if (p.position === 'GK') posColor = '#fbc531';
                    else if (p.position === 'DEF') posColor = '#4cd137';
                    else if (p.position === 'MID') posColor = '#00d2d3';
                    else posColor = '#e84118'; // FWD

                    if (p.type === "Icon") {
                        if (p.rating >= 95) {
                            // VIP Icon (Diamond/Platinum)
                            rowStyle = 'background: linear-gradient(90deg, rgba(224, 255, 255, 0.2), transparent); border-left: 3px solid #E0FFFF;';
                            nameStyle = 'color: #E0FFFF; text-shadow: 0 0 10px rgba(224, 255, 255, 0.8); font-family: "Orbitron", sans-serif; letter-spacing: 1px;';
                            ratingStyle = 'color: #E0FFFF; font-weight: 800; text-shadow: 0 0 8px rgba(224, 255, 255, 0.6);';
                        } else {
                            // Normal Icon (Gold)
                            rowStyle = 'background: linear-gradient(90deg, rgba(246, 227, 186, 0.15), transparent); border-left: 3px solid #F6E3BA;';
                            nameStyle = 'color: #F6E3BA; text-shadow: 0 0 8px rgba(246, 227, 186, 0.6); font-family: "Orbitron", sans-serif; letter-spacing: 1px;';
                            ratingStyle = 'color: #F6E3BA; font-weight: 800; text-shadow: 0 0 5px rgba(246, 227, 186, 0.5);';
                        }
                    } else if (p.rating >= 99) {
                        rowStyle = 'background: linear-gradient(90deg, rgba(255,0,0,0.1), transparent);';
                        nameStyle = 'color: #ff4d4d; text-shadow: 0 0 8px rgba(255,0,0,0.4);';
                        ratingStyle = 'color: #ff4d4d; font-weight: 800;';
                    } else if (p.rating >= 97) {
                        rowStyle = 'background: linear-gradient(90deg, rgba(0,255,234,0.1), transparent);';
                        nameStyle = 'color: #00ffea; text-shadow: 0 0 8px rgba(0,255,234,0.4);';
                        ratingStyle = 'color: #00ffea; font-weight: 800;';
                    } else if (p.rating >= 95) {
                        rowStyle = 'background: linear-gradient(90deg, rgba(255,0,234,0.1), transparent);';
                        nameStyle = 'color: #ff00ea; text-shadow: 0 0 8px rgba(255,0,234,0.4);';
                        ratingStyle = 'color: #ff00ea; font-weight: 800;';
                    }

                    return `
                    <tr style="${rowStyle}">
                        <td class="name-col" style="${nameStyle}">${p.name}</td>
                        <td class="stat-val" style="color: ${posColor}; font-weight: bold;">${p.position}</td>
                        <td class="rating-val" style="${ratingStyle}">${p.rating}</td>
                        <td class="stat-val">${p.goals}</td>
                        <td class="stat-val">${p.assists}</td>
                        <td class="stat-val" style="color: ${passAcc > 85 ? '#4cd137' : passAcc > 70 ? '#fbc531' : '#e84118'}">${passAcc}%</td>
                        <td class="stat-val">${p.penalties}</td>
                        <td class="stat-val">${p.freekicks}</td>
                        <td class="stat-val" style="${p.yellowCards > 0 ? 'color:#fbc531' : ''}">${p.yellowCards}</td>
                        <td class="stat-val" style="${p.redCards > 0 ? 'color:#e84118; font-weight:bold;' : ''}">${p.redCards}</td>
                    </tr>
                `}).join('')}
            </tbody>
        </table>
      </div>`;
  });
  container.innerHTML = html;
}

function addPlayerToDBFromUI() {
    const name = document.getElementById("dbNewName").value.trim();
    const rating = parseInt(document.getElementById("dbNewRating").value);
    
    if(!name || isNaN(rating)) {
        alert("Please enter valid name and rating.");
        return;
    }
    
    addNewPlayerToDB(name, rating);
    alert(`Added ${name} to database!`);
    renderPlayerListUI();
}

function deletePlayerFromDB(name) {
    if(confirm(`Delete ${name} from database?`)) {
        const idx = playerDatabase.findIndex(p => p.name === name);
        if(idx !== -1) {
            playerDatabase.splice(idx, 1);
            renderPlayerListUI();
        }
    }
}

function resetPlayerDatabase() {
    if(confirm("Reset database to original defaults? This cannot be undone.")) {
        // Reload page or re-initialize playerDatabase if we had a backup. 
        // Since we don't have a backup in memory, reloading is safest to get original state if it was hardcoded.
        // But wait, player.js initializes it. If we modified it in memory, we can't easily reset without reloading.
        location.reload();
    }
}

function checkSeasonEnd() {
    const allPlayed = fixtures.length > 0 && fixtures.every(f => f.played);
    if (allPlayed && !seasonEnded) {
        seasonEnded = true;
        
        // Season finished - record stats silently (no alert yet, wait for knockouts)
        const sortedTeams = [...teams].sort(
            (a, b) =>
            b.stats.points - a.stats.points ||
            b.stats.goalsFor - b.stats.goalsAgainst - (a.stats.goalsFor - a.stats.goalsAgainst) ||
            b.stats.goalsFor - a.stats.goalsFor
        );
        
        // Find top scorer
        let topScorer = { name: "N/A", goals: 0 };
        teams.forEach(t => {
            t.players.forEach(p => {
                if (p.goals > topScorer.goals) {
                    topScorer = { name: p.name, goals: p.goals };
                }
            });
        });
        
        const seasonRecord = {
            champion: sortedTeams[0].name,
            runnerUp: sortedTeams[1] ? sortedTeams[1].name : "N/A",
            thirdPlace: sortedTeams[2] ? sortedTeams[2].name : "N/A",
            topScorer: topScorer.name,
            topScorerGoals: topScorer.goals
        };

        seasonHistory.push(seasonRecord);
        localStorage.setItem("seasonHistory", JSON.stringify(seasonHistory));
        
        updateGlobalRecords(seasonHistory.length - 1);
    }
}

function startNextSeason() {
  if (!teams || teams.length < 2) return alert('Need at least 2 teams to continue.');

  teams.forEach(team => {
    // Preserve squad, manager, finances. Reset only season stats.
    team.stats = { played: 0, wins: 0, draws: 0, losses: 0, goalsFor: 0, goalsAgainst: 0, points: 0 };
    if (typeof team.morale !== 'number') team.morale = 58;
    if (typeof ensureTeamFinanceProfile === 'function') ensureTeamFinanceProfile(team);

    team.players.forEach(p => {
      p.goals = 0;
      p.assists = 0;
      p.yellowCards = 0;
      p.redCards = 0;
      p.penalties = 0;
      p.freekicks = 0;
      p.passesAttempted = 0;
      p.passesCompleted = 0;
      p.contractYears = Math.max(1, (p.contractYears || 2) - 1);
      p.form = typeof p.form === 'number' ? Math.max(35, p.form - randomInt(2, 8)) : randomInt(45, 58);
      if (typeof ensurePlayerEconomicFields === 'function') ensurePlayerEconomicFields(p, team);
    });
  });

  fixtures = [];
  currentMatchIndex = 0;
  knockoutMatches = [];
  knockoutResults = [];
  knockoutHistory = [];
  knockoutStage = 0;
  seasonEnded = false;
  currentSeason = (typeof currentSeason === 'number' ? currentSeason : 1) + 1;

  if (typeof rebuildFreeAgentPoolFromLeague === 'function') rebuildFreeAgentPoolFromLeague();
  if (typeof ensureLeagueRosterViability === 'function') ensureLeagueRosterViability();
  generateFixtures();
  renderLeagueUI();
  alert(`✅ Season ${currentSeason} started. Teams, budgets and players were carried over.`);
}

// ---- ADD TEAM MID-TOURNAMENT ----
function openAddTeamPopup() {
    let html = `
    <style>
        .add-team-container { max-width: 700px; margin: 0 auto; }
        .add-team-section { background: rgba(0,0,0,0.3); border-radius: 12px; padding: 20px; margin-bottom: 15px; border: 1px solid rgba(255,215,0,0.15); }
        .add-team-section h3 { color: #FFD700; margin-top: 0; font-size: 1.1rem; }
        .option-cards { display: grid; grid-template-columns: 1fr 1fr; gap: 15px; margin-top: 15px; }
        .option-card { background: rgba(0,43,92,0.6); border: 2px solid #4a678f; border-radius: 12px; padding: 20px; text-align: center; cursor: pointer; transition: all 0.3s ease; }
        .option-card:hover { border-color: #FFD700; transform: translateY(-3px); box-shadow: 0 6px 20px rgba(255,215,0,0.2); }
        .option-card .option-icon { font-size: 2.5rem; margin-bottom: 10px; }
        .option-card .option-title { font-family: 'Orbitron', sans-serif; font-size: 1rem; color: #FFD700; margin-bottom: 8px; }
        .option-card .option-desc { font-size: 0.8rem; color: #aaa; }
        .custom-player-form { background: rgba(0,0,0,0.2); border-radius: 8px; padding: 15px; margin-bottom: 10px; border: 1px solid rgba(255,255,255,0.1); }
        .form-row { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; margin-bottom: 10px; }
        .form-row.three-col { grid-template-columns: 1fr 1fr 1fr; }
        .form-group { display: flex; flex-direction: column; gap: 4px; }
        .form-group label { font-size: 0.75rem; color: #aaa; text-transform: uppercase; letter-spacing: 0.5px; }
        .form-group input, .form-group select { padding: 8px 12px; border-radius: 6px; border: 1px solid #4a678f; background: #00234a; color: #f0f4f8; font-size: 0.9rem; }
        .form-group input:focus, .form-group select:focus { border-color: #FFD700; outline: none; box-shadow: 0 0 6px rgba(255,215,0,0.3); }
        .player-list-preview { max-height: 300px; overflow-y: auto; margin-top: 10px; }
        .player-preview-item { display: flex; align-items: center; justify-content: space-between; padding: 8px 12px; background: rgba(0,0,0,0.2); border-radius: 6px; margin-bottom: 4px; font-size: 0.85rem; }
        .player-preview-item .pos-badge { padding: 2px 8px; border-radius: 4px; font-size: 0.7rem; font-weight: 700; color: #000; }
        .pos-gk { background: #fbc531; } .pos-def { background: #4cd137; } .pos-mid { background: #00d2d3; } .pos-fwd { background: #e84118; }
        .rating-display { display: flex; align-items: center; gap: 8px; }
        .rating-display .rating-value { font-family: 'Orbitron', sans-serif; font-size: 1.1rem; color: #FFD700; font-weight: 700; min-width: 30px; text-align: center; }
        .style-tag { font-size: 0.65rem; padding: 2px 6px; border-radius: 3px; background: rgba(255,255,255,0.1); color: #ccc; }
        .remove-btn { background: #d62828; color: white; border: none; padding: 4px 10px; border-radius: 4px; cursor: pointer; font-size: 0.75rem; }
        .remove-btn:hover { background: #e63946; }
    </style>
    <div class="add-team-container">
        <h2 style="text-align:center; color:#FFD700;">➕ Add New Team</h2>
        
        <div class="add-team-section">
            <h3>Team Name</h3>
            <input type="text" id="newTeamNameInput" placeholder="Enter team name..." style="width:100%; box-sizing:border-box;">
        </div>

        <div class="add-team-section">
            <h3>How do you want to build the squad?</h3>
            <div class="option-cards">
                <div class="option-card" onclick="addTeamWithRandomPlayers()">
                    <div class="option-icon">🎲</div>
                    <div class="option-title">Random Squad</div>
                    <div class="option-desc">Auto-generate 17 players from the database with balanced positions</div>
                </div>
                <div class="option-card" onclick="showCustomPlayerBuilder()">
                    <div class="option-icon">🛠️</div>
                    <div class="option-title">Build Custom Squad</div>
                    <div class="option-desc">Create each player yourself — set name, position, rating & play style</div>
                </div>
            </div>
        </div>

        <div id="customBuilderArea" style="display:none;"></div>

        <button onclick="closePopup()" style="width:100%; margin-top:10px;">Cancel</button>
    </div>
    `;
    showPopup(html);
}

// Temp storage for custom players being built
let customBuildPlayers = [];

function addTeamWithRandomPlayers() {
    const nameInput = document.getElementById('newTeamNameInput');
    const teamName = nameInput ? nameInput.value.trim() : '';
    if (!teamName) return alert('Please enter a team name!');
    if (teams.some(t => t.name.toLowerCase() === teamName.toLowerCase())) return alert('A team with this name already exists!');

    // Create the team
    const newId = teams.length > 0 ? Math.max(...teams.map(t => t.id)) + 1 : 0;
    const usedColors = new Set(teams.map(t => t.color));
    let color;
    do { color = `hsl(${randomInt(0, 360)}, 60%, 45%)`; } while (usedColors.has(color));

    const newTeam = {
        id: newId,
        name: teamName,
        color: color,
        players: [],
        stats: { played: 0, wins: 0, draws: 0, losses: 0, goalsFor: 0, goalsAgainst: 0, points: 0 }
    };
    teams.push(newTeam);

    if (typeof initializeMoneySystemForTeams === 'function') initializeMoneySystemForTeams([newTeam]);
    if (typeof assignRandomManagersToTeams === 'function') assignRandomManagersToTeams(teams);
    if (typeof enforceLeagueWideUniquePlayers === 'function') enforceLeagueWideUniquePlayers();
    if (typeof refreshTransferMarketListings === 'function') refreshTransferMarketListings();

    // Generate random players
    const index = teams.findIndex(t => t.id === newId);
    generateRandomPlayersForTeam(index);

    // Add fixtures for the new team against all existing teams
    const catchUp = addFixturesForNewTeam(newTeam);

    closePopup();
    renderLeagueUI();
    const catchUpMsg = catchUp > 0 ? `\n⚡ ${catchUp} catch-up matches were auto-simulated to keep the tournament balanced.` : '';
    alert(`✅ ${teamName} has been added with 17 random players!${catchUpMsg}`);
}

function showCustomPlayerBuilder() {
    const nameInput = document.getElementById('newTeamNameInput');
    const teamName = nameInput ? nameInput.value.trim() : '';
    if (!teamName) return alert('Please enter a team name first!');

    customBuildPlayers = [];
    const area = document.getElementById('customBuilderArea');
    area.style.display = 'block';
    renderCustomBuilder();
}

function renderCustomBuilder() {
    const area = document.getElementById('customBuilderArea');
    if (!area) return;

    const posCount = { GK: 0, DEF: 0, MID: 0, FWD: 0 };
    customBuildPlayers.forEach(p => { if (posCount[p.position] !== undefined) posCount[p.position]++; });

    let html = `
    <div class="add-team-section">
        <h3>🛠️ Custom Player Builder</h3>
        <p style="font-size:0.8rem; color:#aaa;">Add at least 11 players (recommended 17). Current: <strong style="color:#FFD700;">${customBuildPlayers.length}</strong> players
        — GK: ${posCount.GK} | DEF: ${posCount.DEF} | MID: ${posCount.MID} | FWD: ${posCount.FWD}</p>
        
        <div class="custom-player-form">
            <div class="form-row">
                <div class="form-group">
                    <label>Player Name</label>
                    <input type="text" id="cpName" placeholder="e.g. Ronaldo">
                </div>
                <div class="form-group">
                    <label>Position</label>
                    <select id="cpPosition">
                        <option value="GK">🧤 GK — Goalkeeper</option>
                        <option value="DEF">🛡️ DEF — Defender</option>
                        <option value="MID" selected>⚙️ MID — Midfielder</option>
                        <option value="FWD">⚔️ FWD — Forward</option>
                    </select>
                </div>
            </div>
            <div class="form-row three-col">
                <div class="form-group">
                    <label>Overall Rating</label>
                    <div class="rating-display">
                        <input type="range" id="cpRating" min="40" max="99" value="75" oninput="document.getElementById('cpRatingVal').textContent=this.value" style="flex:1;">
                        <span id="cpRatingVal" class="rating-value">75</span>
                    </div>
                </div>
                <div class="form-group">
                    <label>Play Style</label>
                    <select id="cpStyle">
                        <option value="balanced">⚖️ Balanced</option>
                        <option value="offensive">⚔️ Offensive</option>
                        <option value="defensive">🛡️ Defensive</option>
                        <option value="playmaker">🎯 Playmaker</option>
                        <option value="speedster">💨 Speedster</option>
                        <option value="physical">💪 Physical</option>
                        <option value="technical">🎩 Technical</option>
                    </select>
                </div>
                <div class="form-group" style="justify-content:flex-end;">
                    <button onclick="addCustomPlayer()" style="padding:8px 16px; font-size:0.85rem; margin:0;">+ Add Player</button>
                </div>
            </div>
        </div>

        <div class="player-list-preview" id="customPlayerList">
            ${customBuildPlayers.length === 0 ? '<p style="text-align:center; color:#555; font-size:0.85rem;">No players added yet</p>' : ''}
            ${customBuildPlayers.map((p, i) => {
                const posClass = 'pos-' + p.position.toLowerCase();
                const styleLabel = getStyleEmoji(p.style);
                return `<div class="player-preview-item">
                    <span><strong>${p.name}</strong></span>
                    <span class="pos-badge ${posClass}">${p.position}</span>
                    <span style="color:#FFD700; font-weight:700;">${p.rating}</span>
                    <span class="style-tag">${styleLabel}</span>
                    <button class="remove-btn" onclick="removeCustomPlayer(${i})">✕</button>
                </div>`;
            }).join('')}
        </div>

        <div style="margin-top:15px; display:flex; gap:10px;">
            <button onclick="confirmCustomTeam()" style="flex:1; background:#2d6a4f; color:white;" ${customBuildPlayers.length < 11 ? 'disabled' : ''}>✅ Create Team (${customBuildPlayers.length} players)</button>
            <button onclick="addBulkRandomToCustom()" style="flex:1; background:#1a4371; color:#ccc; border:1px solid #4a678f;">🎲 Fill Remaining with Random</button>
        </div>
    </div>
    `;
    area.innerHTML = html;
}

function getStyleEmoji(style) {
    const map = {
        balanced: '⚖️ Balanced',
        offensive: '⚔️ Offensive',
        defensive: '🛡️ Defensive',
        playmaker: '🎯 Playmaker',
        speedster: '💨 Speedster',
        physical: '💪 Physical',
        technical: '🎩 Technical'
    };
    return map[style] || style;
}

function addCustomPlayer() {
    const name = document.getElementById('cpName').value.trim();
    const position = document.getElementById('cpPosition').value;
    const rating = parseInt(document.getElementById('cpRating').value);
    const style = document.getElementById('cpStyle').value;

    if (!name) return alert('Please enter a player name!');
    if (customBuildPlayers.some(p => p.name.toLowerCase() === name.toLowerCase())) return alert('Player with this name already added!');
    if (isNaN(rating) || rating < 40 || rating > 99) return alert('Rating must be between 40 and 99!');

    customBuildPlayers.push({ name, position, rating, style });

    // Clear name input for next player
    document.getElementById('cpName').value = '';
    renderCustomBuilder();
    // Re-focus name input
    setTimeout(() => { const inp = document.getElementById('cpName'); if (inp) inp.focus(); }, 50);
}

function removeCustomPlayer(index) {
    customBuildPlayers.splice(index, 1);
    renderCustomBuilder();
}

function addBulkRandomToCustom() {
    const needed = Math.max(0, 17 - customBuildPlayers.length);
    if (needed === 0) return alert('You already have 17 players!');

    // Figure out what positions are needed
    const posCount = { GK: 0, DEF: 0, MID: 0, FWD: 0 };
    customBuildPlayers.forEach(p => { if (posCount[p.position] !== undefined) posCount[p.position]++; });

    const posNeeds = [];
    // Need at least 2 GK, 4 DEF, 3 MID, 3 FWD
    while (posCount.GK < 2) { posNeeds.push('GK'); posCount.GK++; }
    while (posCount.DEF < 4) { posNeeds.push('DEF'); posCount.DEF++; }
    while (posCount.MID < 3) { posNeeds.push('MID'); posCount.MID++; }
    while (posCount.FWD < 3) { posNeeds.push('FWD'); posCount.FWD++; }

    // Fill rest randomly
    while (posNeeds.length < needed) {
        posNeeds.push(['DEF', 'MID', 'FWD'][randomInt(0, 2)]);
    }

    // Only take what we need
    const toAdd = posNeeds.slice(0, needed);
    const usedNames = new Set(customBuildPlayers.map(p => p.name.toLowerCase()));

    toAdd.forEach(pos => {
        const pool = playerDatabase.filter(p => p.position === pos && !usedNames.has(p.name.toLowerCase()));
        if (pool.length > 0) {
            const pick = pool[randomInt(0, pool.length - 1)];
            customBuildPlayers.push({ name: pick.name, position: pick.position, rating: pick.rating, style: 'balanced' });
            usedNames.add(pick.name.toLowerCase());
        } else {
            const genName = `${pos} Player ${randomInt(100, 999)}`;
            customBuildPlayers.push({ name: genName, position: pos, rating: randomInt(60, 82), style: 'balanced' });
            usedNames.add(genName.toLowerCase());
        }
    });

    renderCustomBuilder();
}

function confirmCustomTeam() {
    if (customBuildPlayers.length < 11) return alert('You need at least 11 players!');
    const nameInput = document.getElementById('newTeamNameInput');
    const teamName = nameInput ? nameInput.value.trim() : '';
    if (!teamName) return alert('Team name is missing! Please re-open the dialog.');
    if (teams.some(t => t.name.toLowerCase() === teamName.toLowerCase())) return alert('A team with this name already exists!');

    const newId = teams.length > 0 ? Math.max(...teams.map(t => t.id)) + 1 : 0;
    const usedColors = new Set(teams.map(t => t.color));
    let color;
    do { color = `hsl(${randomInt(0, 360)}, 60%, 45%)`; } while (usedColors.has(color));

    const newTeam = {
        id: newId,
        name: teamName,
        color: color,
        players: customBuildPlayers.map(p => {
            const playerObj = createPlayerObject(p.name, p.rating, p.position);
            playerObj.playStyle = p.style;
            // Adjust sub-ratings based on play style
            applyPlayStyle(playerObj, p.style);
            return playerObj;
        }),
        stats: { played: 0, wins: 0, draws: 0, losses: 0, goalsFor: 0, goalsAgainst: 0, points: 0 }
    };
    teams.push(newTeam);

    if (typeof initializeMoneySystemForTeams === 'function') initializeMoneySystemForTeams([newTeam]);
    if (typeof assignRandomManagersToTeams === 'function') assignRandomManagersToTeams(teams);
    if (typeof enforceLeagueWideUniquePlayers === 'function') enforceLeagueWideUniquePlayers();
    if (typeof refreshTransferMarketListings === 'function') refreshTransferMarketListings();

    // Add fixtures for the new team
    const catchUp = addFixturesForNewTeam(newTeam);

    customBuildPlayers = [];
    closePopup();
    renderLeagueUI();
    const catchUpMsg = catchUp > 0 ? `\n⚡ ${catchUp} catch-up matches were auto-simulated to keep the tournament balanced.` : '';
    alert(`✅ ${teamName} has been created with ${newTeam.players.length} custom players!${catchUpMsg}`);
}

function applyPlayStyle(playerObj, style) {
    switch (style) {
        case 'offensive':
            playerObj.freekickRating = Math.min(99, playerObj.freekickRating + 8);
            break;
        case 'defensive':
            playerObj.passingRating = Math.min(99, playerObj.passingRating + 5);
            break;
        case 'playmaker':
            playerObj.passingRating = Math.min(99, playerObj.passingRating + 10);
            break;
        case 'speedster':
            // Speed affects gameplay position drift
            break;
        case 'physical':
            // Physical players are tougher
            break;
        case 'technical':
            playerObj.freekickRating = Math.min(99, playerObj.freekickRating + 12);
            playerObj.passingRating = Math.min(99, playerObj.passingRating + 5);
            break;
        case 'balanced':
        default:
            break;
    }
}

function addFixturesForNewTeam(newTeam) {
    const existingTeams = teams.filter(t => t.id !== newTeam.id);

    // Count LEAGUE fixtures played per team (not knockout or other stats)
    // This avoids inflated counts from knockout matches
    const leagueMatchesPerTeam = {};
    existingTeams.forEach(t => { leagueMatchesPerTeam[t.id] = 0; });
    fixtures.forEach(f => {
        if (!f.played) return;
        if (leagueMatchesPerTeam[f.home.id] !== undefined) leagueMatchesPerTeam[f.home.id]++;
        if (leagueMatchesPerTeam[f.away.id] !== undefined) leagueMatchesPerTeam[f.away.id]++;
    });

    // Use the average league fixtures played by existing teams as the catch-up target
    const counts = Object.values(leagueMatchesPerTeam);
    const avgLeaguePlayed = counts.length > 0
        ? Math.round(counts.reduce((a, b) => a + b, 0) / counts.length)
        : 0;

    // Create all new fixtures (home & away vs every existing team)
    const newFixtures = [];
    existingTeams.forEach(t => {
        newFixtures.push({
            home: newTeam, away: t,
            homeScore: null, awayScore: null, played: false
        });
        newFixtures.push({
            home: t, away: newTeam,
            homeScore: null, awayScore: null, played: false
        });
    });

    // Auto-simulate catch-up matches so the new team is on par with others
    let catchUpCount = 0;
    if (avgLeaguePlayed > 0) {
        shuffleArray(newFixtures);
        catchUpCount = Math.min(avgLeaguePlayed, newFixtures.length);

        for (let i = 0; i < catchUpCount; i++) {
            const match = newFixtures[i];
            const result = calculateMatchScore(match.home, match.away);
            match.homeScore = result.homeScore;
            match.awayScore = result.awayScore;
            match.played = true;
            updateTeamStats(match);
            distributePlayerStats(match, match.homeScore, match.awayScore);

            matchHistory.push({
                homeTeam: match.home.name,
                awayTeam: match.away.name,
                homeScore: match.homeScore,
                awayScore: match.awayScore,
            });
        }
        localStorage.setItem("matchHistory", JSON.stringify(matchHistory));
    }

    // Add all new fixtures to the main list
    fixtures.push(...newFixtures);

    // Reset seasonEnded since we now have new matches to play
    seasonEnded = false;

    // Update currentMatchIndex to point to first unplayed
    currentMatchIndex = fixtures.findIndex(f => !f.played);
    if (currentMatchIndex === -1) currentMatchIndex = fixtures.length;

    return catchUpCount;
}

function viewTrophyRoom() {
    // Safety check for globalRecords
    if (typeof globalRecords === 'undefined') {
        alert("Error: Global records not initialized. Please restart the game.");
        return;
    }

    let html = `<h2 style="text-align:center; font-size:2.5rem; margin-bottom:20px; color:gold; text-shadow:0 0 10px rgba(255,215,0,0.5);">🏆 Trophy Room & Hall of Fame</h2>`;
    
    html += `<div style="display:grid; grid-template-columns: 1fr 2fr; gap:30px; align-items:start;">`;
    
    // --- LEFT COLUMN: Season History ---
    html += `<div style="background:rgba(0,0,0,0.3); padding:20px; border-radius:15px; border:1px solid #444; max-height:600px; overflow-y:auto;">
        <h3 style="border-bottom:2px solid gold; padding-bottom:10px; margin-top:0;">📜 Season History</h3>`;
    
    if (!seasonHistory || seasonHistory.length === 0) {
        html += `<p style="text-align:center; color:#aaa; font-style:italic;">No seasons completed yet.</p>`;
    } else {
        html += `<div style="display:flex; flex-direction:column; gap:15px;">`;
        seasonHistory.forEach((s, i) => {
            html += `
            <div style="background:linear-gradient(135deg, #222, #333); padding:15px; border-radius:10px; border-left:5px solid gold; box-shadow:0 4px 8px rgba(0,0,0,0.3);">
                <div style="font-size:1.2rem; font-weight:bold; color:gold; margin-bottom:5px;">Season ${i + 1}</div>
                <div style="font-size:1.1rem;">🏆 <span style="color:white;">${s.champion}</span></div>
                <div style="font-size:0.9rem; color:#ccc; margin-top:5px;">🥈 ${s.runnerUp}</div>
                <div style="font-size:0.9rem; color:#ccc;">🥉 ${s.thirdPlace}</div>
                <div style="margin-top:8px; padding-top:8px; border-top:1px solid #555; font-size:0.85rem; color:#aaa;">
                    ⚽ Top Scorer: <span style="color:white;">${s.topScorer}</span> (${s.topScorerGoals})
                </div>
            </div>`;
        });
        html += `</div>`;
    }
    html += `</div>`;

    // --- RIGHT COLUMN: Global Records ---
    html += `<div style="display:flex; flex-direction:column; gap:20px;">
        <h3 style="border-bottom:2px solid gold; padding-bottom:10px; margin-top:0;">🌟 All-Time Records (Top 10)</h3>
        
        <div style="display:grid; grid-template-columns: 1fr 1fr; gap:20px;">
            
            <!-- Most Goals -->
            <div style="background:rgba(0,0,0,0.3); padding:15px; border-radius:10px; border:1px solid #444;">
                <h4 style="color:#ff6b6b; margin-top:0;">⚽ Most Goals (Season)</h4>
                <table style="width:100%; font-size:0.85rem; border-collapse:collapse;">
                    <tr style="background:rgba(255,255,255,0.1);"><th style="padding:5px;">Player</th><th>Team</th><th>G</th><th>S</th></tr>
                    ${(globalRecords.topScorers || []).map((p, idx) => `
                        <tr style="border-bottom:1px solid #333; background:${idx===0?'rgba(255,215,0,0.1)':''};">
                            <td style="padding:5px;">${p.name}</td><td>${p.team}</td><td style="font-weight:bold; color:#ff6b6b;">${p.goals}</td><td>${p.season}</td>
                        </tr>
                    `).join('')}
                </table>
            </div>

            <!-- Most Assists -->
            <div style="background:rgba(0,0,0,0.3); padding:15px; border-radius:10px; border:1px solid #444;">
                <h4 style="color:#4ecdc4; margin-top:0;">👟 Most Assists (Season)</h4>
                <table style="width:100%; font-size:0.85rem; border-collapse:collapse;">
                    <tr style="background:rgba(255,255,255,0.1);"><th style="padding:5px;">Player</th><th>Team</th><th>A</th><th>S</th></tr>
                    ${(globalRecords.topAssisters || []).map((p, idx) => `
                        <tr style="border-bottom:1px solid #333; background:${idx===0?'rgba(255,215,0,0.1)':''};">
                            <td style="padding:5px;">${p.name}</td><td>${p.team}</td><td style="font-weight:bold; color:#4ecdc4;">${p.assists}</td><td>${p.season}</td>
                        </tr>
                    `).join('')}
                </table>
            </div>

            <!-- Most Points -->
            <div style="background:rgba(0,0,0,0.3); padding:15px; border-radius:10px; border:1px solid #444;">
                <h4 style="color:#ffe66d; margin-top:0;">🛡️ Most Points (Team)</h4>
                <table style="width:100%; font-size:0.85rem; border-collapse:collapse;">
                    <tr style="background:rgba(255,255,255,0.1);"><th style="padding:5px;">Team</th><th>Pts</th><th>S</th></tr>
                    ${(globalRecords.topTeamPoints || []).map((t, idx) => `
                        <tr style="border-bottom:1px solid #333; background:${idx===0?'rgba(255,215,0,0.1)':''};">
                            <td style="padding:5px;">${t.team}</td><td style="font-weight:bold; color:#ffe66d;">${t.points}</td><td>${t.season}</td>
                        </tr>
                    `).join('')}
                </table>
            </div>
            
            <!-- Most Team Goals -->
            <div style="background:rgba(0,0,0,0.3); padding:15px; border-radius:10px; border:1px solid #444;">
                <h4 style="color:#ff9f43; margin-top:0;">🔥 Most Goals (Team)</h4>
                <table style="width:100%; font-size:0.85rem; border-collapse:collapse;">
                    <tr style="background:rgba(255,255,255,0.1);"><th style="padding:5px;">Team</th><th>GF</th><th>S</th></tr>
                    ${(globalRecords.topTeamGoals || []).map((t, idx) => `
                        <tr style="border-bottom:1px solid #333; background:${idx===0?'rgba(255,215,0,0.1)':''};">
                            <td style="padding:5px;">${t.team}</td><td style="font-weight:bold; color:#ff9f43;">${t.goals}</td><td>${t.season}</td>
                        </tr>
                    `).join('')}
                </table>
            </div>

        </div>
    </div>`;
    
    html += `</div>`; // End Grid
    html += `<button onclick="closePopup()" style="margin-top:20px; width:100%; padding:15px; font-size:1.2rem;">Close Trophy Room</button>`;
    
    showPopup(html);
}

// ============================================
// THEME SYSTEM
// ============================================
function openThemePicker() {
    const themes = [
        // Original themes
        { id: 'midnight', name: 'Midnight Blue', icon: '🌙', colors: ['#0a1628', '#001a33', '#FFD700'], desc: 'Deep navy with gold accents' },
        { id: 'obsidian', name: 'Obsidian', icon: '🖤', colors: ['#0d0d0d', '#222', '#00d4ff'], desc: 'Pure dark with cyan glow' },
        { id: 'emerald', name: 'Emerald Field', icon: '🌿', colors: ['#061a0e', '#0f3c1e', '#50fa7b'], desc: 'Lush green football pitch' },
        { id: 'crimson', name: 'Crimson Night', icon: '🔥', colors: ['#1a0a0e', '#3c0f19', '#ff5555'], desc: 'Dark red intensity' },
        { id: 'arctic', name: 'Arctic Light', icon: '❄️', colors: ['#f0f4f8', '#ffffff', '#2563eb'], desc: 'Clean light mode' },
        { id: 'neon', name: 'Neon Pulse', icon: '💜', colors: ['#0a0015', '#1e003c', '#ff00ff'], desc: 'Vibrant synthwave' },
        // Hackatime-inspired themes
        { id: 'gruvbox', name: 'Gruvbox Dark', icon: '🟤', colors: ['#1d2021', '#3c3836', '#d8a657'], desc: 'Retro warm tones' },
        { id: 'catppuccin', name: 'Catppuccin', icon: '🍵', colors: ['#11111b', '#313244', '#cba6f7'], desc: 'Warm purple-tinted dark' },
        { id: 'nord', name: 'Nord', icon: '🧊', colors: ['#2e3440', '#434c5e', '#88c0d0'], desc: 'Arctic blue-gray frost' },
        { id: 'rosepine', name: 'Rosé Pine', icon: '🌹', colors: ['#191724', '#26233a', '#eb6f92'], desc: 'Romantic dark palette' },
        { id: 'dracula', name: 'Dracula', icon: '🧛', colors: ['#282a36', '#44475a', '#bd93f9'], desc: 'Classic purple vampire' },
        { id: 'tokyo', name: 'Tokyo Night', icon: '🗼', colors: ['#1a1b26', '#24283b', '#7aa2f7'], desc: 'Neon-lit Japanese night' },
        { id: 'github', name: 'GitHub Dark', icon: '🐙', colors: ['#0d1117', '#21262d', '#58a6ff'], desc: 'GitHub\'s iconic dark' },
        { id: 'solarized', name: 'Solarized', icon: '☀️', colors: ['#002b36', '#073642', '#268bd2'], desc: 'Precision color science' },
        // Special layout themes
        { id: 'og', name: 'OG Classic', icon: '🏟️', colors: ['#1a1a2e', '#16213e', '#e94560'], desc: 'The original BIG layout' }
    ];

    const current = document.body.getAttribute('data-theme') || 'midnight';

    let html = `<h2 style="text-align:center;">🎨 Choose Your Theme</h2>
    <p style="text-align:center; color:var(--text-muted); font-size:0.88rem; margin-bottom:20px;">15 themes inspired by <strong style="color:var(--accent);">Hackatime</strong> & popular code editors</p>
    <div class="theme-grid">`;

    themes.forEach(t => {
        const isActive = t.id === current;
        html += `<div class="theme-card ${isActive ? 'active' : ''}" onclick="setTheme('${t.id}')">
            <div class="theme-preview" style="background: linear-gradient(135deg, ${t.colors[0]}, ${t.colors[1]}); border: 2px solid ${t.colors[2]};">
                <span class="theme-swatch" style="background: ${t.colors[2]}; box-shadow: 0 0 12px ${t.colors[2]};"></span>
            </div>
            <div class="theme-name">${t.icon} ${t.name}</div>
            <div style="font-size:0.65rem; color:var(--text-muted); margin-top:2px;">${t.desc}</div>
            ${isActive ? '<div class="theme-active-badge">✓ Active</div>' : ''}
        </div>`;
    });

    html += `</div>
    <button onclick="closePopup()" style="width:100%; margin-top:20px;">Close</button>`;

    showPopup(html);
}

function setTheme(name) {
    document.body.setAttribute('data-theme', name);
    localStorage.setItem('ls-theme', name);
    // Re-render theme picker if it's open
    const overlay = document.querySelector('.popup-overlay');
    if (overlay) {
        const content = overlay.querySelector('.popup-content');
        if (content && content.innerHTML.includes('theme-grid')) {
            openThemePicker();
        }
    }
}

/* ============================================
   SAVE / LOAD / EXPORT / IMPORT SYSTEM
   ============================================ */

// --- HELPER: Download a JSON file ---
function downloadJSON(data, filename) {
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
}

// --- HELPER: Read a JSON file from user ---
function readJSONFile(callback) {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json';
    input.onchange = (e) => {
        const file = e.target.files[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = (ev) => {
            try {
                const data = JSON.parse(ev.target.result);
                callback(data, null);
            } catch (err) {
                callback(null, 'Invalid JSON file. Please select a valid League Simulator file.');
            }
        };
        reader.onerror = () => callback(null, 'Failed to read the file.');
        reader.readAsText(file);
    };
    input.click();
}

// --- HELPER: Serialize fixture (replace team object refs with team IDs) ---
function serializeFixture(f) {
    return {
        homeId: f.home ? f.home.id : null,
        awayId: f.away ? f.away.id : null,
        homeScore: f.homeScore,
        awayScore: f.awayScore,
        played: f.played
    };
}

// --- HELPER: Deserialize fixture (rebuild team object refs from IDs) ---
function deserializeFixture(f, teamMap) {
    return {
        home: teamMap[f.homeId] || null,
        away: teamMap[f.awayId] || null,
        homeScore: f.homeScore,
        awayScore: f.awayScore,
        played: f.played
    };
}

// --- HELPER: Serialize knockout match ---
function serializeKnockoutMatch(m) {
    return {
        name: m.name,
        homeId: m.home ? m.home.id : null,
        awayId: m.away ? m.away.id : null
    };
}

// --- HELPER: Serialize knockout result ---
function serializeKnockoutResult(r) {
    return {
        stage: r.stage,
        match: serializeKnockoutMatch(r.match),
        homeScore: r.homeScore,
        awayScore: r.awayScore,
        winnerId: r.winner ? r.winner.id : null,
        penaltyNote: r.penaltyNote || '',
        penaltyResult: r.penaltyResult || null
    };
}

// ============================================
// 1. EXPORT FULL TOURNAMENT STATE
// ============================================
function exportTournament() {
    if (teams.length === 0) {
        alert('No tournament data to export!');
        return;
    }

    const saveData = {
        _type: 'league-simulator-tournament',
      _version: 3,
        _exportDate: new Date().toISOString(),
      currentSeason: typeof currentSeason === 'number' ? currentSeason : 1,
        teams: teams.map(t => ({
            id: t.id,
            name: t.name,
            color: t.color,
        manager: t.manager || null,
        morale: t.morale,
        finance: t.finance || null,
        form: t.form || null,
            players: t.players.map(p => ({
                name: p.name,
                rating: p.rating,
                position: p.position,
          age: p.age,
          contractYears: p.contractYears,
          form: p.form,
          relationWithManager: p.relationWithManager,
          transferDemand: p.transferDemand,
          marketValue: p.marketValue,
          wageDemand: p.wageDemand,
                type: p.type || 'Normal',
                freekickRating: p.freekickRating,
                passingRating: p.passingRating,
                playStyle: p.playStyle || 'balanced',
                goals: p.goals,
                assists: p.assists,
                yellowCards: p.yellowCards,
                redCards: p.redCards,
                penalties: p.penalties,
                freekicks: p.freekicks,
                passesAttempted: p.passesAttempted,
                passesCompleted: p.passesCompleted
            })),
            stats: { ...t.stats }
        })),
          freeAgents: (typeof freeAgents !== 'undefined' && Array.isArray(freeAgents))
            ? freeAgents.map(p => ({ ...p }))
            : [],
          managerState: (typeof managerState !== 'undefined') ? JSON.parse(JSON.stringify(managerState)) : null,
        fixtures: fixtures.map(serializeFixture),
        matchHistory: matchHistory.slice(),
        knockoutMatches: knockoutMatches.map(serializeKnockoutMatch),
        knockoutResults: knockoutResults.map(serializeKnockoutResult),
        knockoutHistory: (knockoutHistory || []).map(serializeKnockoutResult),
        knockoutStage: knockoutStage,
        seasonEnded: seasonEnded,
        seasonHistory: seasonHistory.slice(),
        globalRecords: JSON.parse(JSON.stringify(globalRecords))
    };

    const datePart = new Date().toISOString().slice(0, 10);
    downloadJSON(saveData, `league-tournament-${datePart}.json`);
    alert('✅ Tournament saved! You can load this file later to resume.');
}

// ============================================
// 2. IMPORT FULL TOURNAMENT STATE
// ============================================
function importTournament() {
    readJSONFile((data, err) => {
        if (err) return alert(err);
        if (!data || data._type !== 'league-simulator-tournament') {
            return alert('❌ This is not a valid tournament save file.\nPlease select a file exported from League Simulator.');
        }

        // Restore teams
        teams = (data.teams || []).map(t => ({
            id: t.id,
            name: t.name,
            color: t.color,
          manager: t.manager || null,
          morale: typeof t.morale === 'number' ? t.morale : 58,
          finance: t.finance || null,
          form: t.form || null,
            players: (t.players || []).map(p => ({
                name: p.name,
                rating: p.rating,
                position: p.position,
                type: p.type || 'Normal',
            age: p.age || randomInt(18, 34),
            contractYears: p.contractYears || randomInt(1, 5),
            form: typeof p.form === 'number' ? p.form : randomInt(45, 60),
            relationWithManager: typeof p.relationWithManager === 'number' ? p.relationWithManager : randomInt(45, 72),
            transferDemand: typeof p.transferDemand === 'number' ? p.transferDemand : randomInt(20, 65),
            marketValue: p.marketValue || 0,
            wageDemand: p.wageDemand || 0,
                freekickRating: p.freekickRating || p.rating,
                passingRating: p.passingRating || p.rating,
                playStyle: p.playStyle || 'balanced',
                goals: p.goals || 0,
                assists: p.assists || 0,
                yellowCards: p.yellowCards || 0,
                redCards: p.redCards || 0,
                penalties: p.penalties || 0,
                freekicks: p.freekicks || 0,
                passesAttempted: p.passesAttempted || 0,
                passesCompleted: p.passesCompleted || 0
            })),
            stats: t.stats || { played: 0, wins: 0, draws: 0, losses: 0, goalsFor: 0, goalsAgainst: 0, points: 0 }
        }));

            currentSeason = data.currentSeason || 1;
            freeAgents = Array.isArray(data.freeAgents) ? data.freeAgents.map(p => ({ ...p })) : [];
            if (data.managerState && typeof data.managerState === 'object' && typeof managerState !== 'undefined') {
              managerState = {
                ...managerState,
                ...data.managerState,
                profile: { ...managerState.profile, ...(data.managerState.profile || {}) },
                board: { ...managerState.board, ...(data.managerState.board || {}) },
                finance: { ...managerState.finance, ...(data.managerState.finance || {}) },
                squad: { ...managerState.squad, ...(data.managerState.squad || {}) },
                tactics: { ...managerState.tactics, ...(data.managerState.tactics || {}) },
                facilities: { ...managerState.facilities, ...(data.managerState.facilities || {}) },
                transfer: { ...managerState.transfer, ...(data.managerState.transfer || {}) },
                history: { ...managerState.history, ...(data.managerState.history || {}) }
              };
            }

        // Build team lookup map by ID
        const teamMap = {};
        teams.forEach(t => { teamMap[t.id] = t; });

        // Restore fixtures
        fixtures = (data.fixtures || []).map(f => deserializeFixture(f, teamMap));

        // Restore match history
        matchHistory = data.matchHistory || [];
        localStorage.setItem("matchHistory", JSON.stringify(matchHistory));

        // Restore knockout state
        knockoutMatches = (data.knockoutMatches || []).map(m => ({
            name: m.name,
            home: teamMap[m.homeId] || null,
            away: teamMap[m.awayId] || null
        }));

        knockoutResults = (data.knockoutResults || []).map(r => ({
            stage: r.stage,
            match: {
                name: r.match.name,
                home: teamMap[r.match.homeId] || null,
                away: teamMap[r.match.awayId] || null
            },
            homeScore: r.homeScore,
            awayScore: r.awayScore,
            winner: teamMap[r.winnerId] || null,
            penaltyNote: r.penaltyNote || '',
            penaltyResult: r.penaltyResult || null
        }));

        knockoutHistory = (data.knockoutHistory || []).map(r => ({
            stage: r.stage,
            match: {
                name: r.match.name,
                home: teamMap[r.match.homeId] || null,
                away: teamMap[r.match.awayId] || null
            },
            homeScore: r.homeScore,
            awayScore: r.awayScore,
            winner: teamMap[r.winnerId] || null,
            penaltyNote: r.penaltyNote || '',
            penaltyResult: r.penaltyResult || null
        }));

        knockoutStage = data.knockoutStage || 0;
        seasonEnded = data.seasonEnded || false;
        seasonHistory = data.seasonHistory || [];
        localStorage.setItem("seasonHistory", JSON.stringify(seasonHistory));

        globalRecords = data.globalRecords || { topScorers: [], topAssisters: [], topTeamPoints: [], topTeamGoals: [] };
        localStorage.setItem("globalRecords", JSON.stringify(globalRecords));

        // Find where we are and render accordingly
        currentMatchIndex = fixtures.findIndex(f => !f.played);
        if (currentMatchIndex === -1) currentMatchIndex = fixtures.length;

        if (typeof initializeMoneySystemForTeams === 'function') initializeMoneySystemForTeams(teams);
        if (typeof initializeTransferSystem === 'function') initializeTransferSystem(teams);
        if (typeof enforceLeagueWideUniquePlayers === 'function') enforceLeagueWideUniquePlayers();
        if (typeof rebuildFreeAgentPoolFromLeague === 'function' && (!Array.isArray(freeAgents) || freeAgents.length === 0)) rebuildFreeAgentPoolFromLeague();

        // Decide which screen to show
        if (knockoutMatches.length > 0) {
            renderNextKnockoutMatch();
        } else {
            renderLeagueUI();
        }

        alert('✅ Tournament loaded successfully!');
    });
}

// ============================================
// 3. EXPORT ROSTER ONLY (players + teams, NO stats)
// ============================================
function exportRosterData() {
    if (teams.length === 0) {
        alert('No team data to export!');
        return;
    }

    const rosterData = {
        _type: 'league-simulator-roster',
        _version: 1,
        _exportDate: new Date().toISOString(),
        teams: teams.map(t => ({
            name: t.name,
            color: t.color,
            players: t.players.map(p => ({
                name: p.name,
                rating: p.rating,
                position: p.position,
                type: p.type || 'Normal',
                freekickRating: p.freekickRating,
                passingRating: p.passingRating,
                playStyle: p.playStyle || 'balanced'
            }))
        }))
    };

    const datePart = new Date().toISOString().slice(0, 10);
    downloadJSON(rosterData, `league-roster-${datePart}.json`);
    alert('✅ Roster exported! This file contains only teams and players — no stats or results.\nUse "Import Roster" on the start screen to recreate this exact setup.');
}

// ============================================
// 4. IMPORT ROSTER DATA (on setup screen)
// ============================================
function importRosterData() {
    readJSONFile((data, err) => {
        if (err) return alert(err);
        if (!data || data._type !== 'league-simulator-roster') {
            return alert('❌ This is not a valid roster file.\nPlease select a roster file exported from League Simulator.\n\n(Looking for a tournament save? Use "Load Tournament" instead.)');
        }

        if (!data.teams || data.teams.length < 2) {
            return alert('❌ Roster file must contain at least 2 teams.');
        }

        if (data.teams.length > maxTeams) {
            return alert(`❌ Roster file contains ${data.teams.length} teams, but the maximum is ${maxTeams}.`);
        }

        // Rebuild teams from roster data
        teams = data.teams.map((t, i) => ({
            id: i,
            name: t.name,
            color: t.color || `hsl(${randomInt(0, 360)}, 60%, 45%)`,
          manager: null,
          morale: randomInt(50, 65),
          finance: null,
          form: null,
            players: (t.players || []).map(p => ({
                name: p.name,
                rating: p.rating,
                position: p.position,
                type: p.type || 'Normal',
            age: p.age || randomInt(18, 34),
            contractYears: p.contractYears || randomInt(1, 5),
            form: typeof p.form === 'number' ? p.form : randomInt(45, 60),
            relationWithManager: typeof p.relationWithManager === 'number' ? p.relationWithManager : randomInt(45, 72),
            transferDemand: typeof p.transferDemand === 'number' ? p.transferDemand : randomInt(20, 65),
            marketValue: p.marketValue || 0,
            wageDemand: p.wageDemand || 0,
                freekickRating: p.freekickRating || p.rating,
                passingRating: p.passingRating || p.rating,
                playStyle: p.playStyle || 'balanced',
                goals: 0,
                assists: 0,
                yellowCards: 0,
                redCards: 0,
                penalties: 0,
                freekicks: 0,
                passesAttempted: 0,
                passesCompleted: 0
            })),
            stats: { played: 0, wins: 0, draws: 0, losses: 0, goalsFor: 0, goalsAgainst: 0, points: 0 }
        }));

          currentSeason = 1;
          freeAgents = [];

        // Reset all game state
        fixtures = [];
        currentMatchIndex = 0;
        matchHistory = [];
        knockoutMatches = [];
        knockoutResults = [];
        knockoutHistory = [];
        knockoutStage = 0;
        seasonEnded = false;

        // Generate fresh fixtures
        generateFixtures();
        if (typeof initializeMoneySystemForTeams === 'function') initializeMoneySystemForTeams(teams);
        if (typeof initializeTransferSystem === 'function') initializeTransferSystem(teams);
        if (typeof enforceLeagueWideUniquePlayers === 'function') enforceLeagueWideUniquePlayers();
        if (typeof rebuildFreeAgentPoolFromLeague === 'function') rebuildFreeAgentPoolFromLeague();

        renderLeagueUI();
        alert(`✅ Roster imported! ${teams.length} teams with ${teams.reduce((s, t) => s + t.players.length, 0)} total players loaded.\nFixtures have been generated — start playing!`);
    });
}

// ============================================
// 5. OPEN SAVE/LOAD POPUP
// ============================================
function openSaveLoadPopup() {
    const hasTournament = teams.length > 0;

    let html = `
    <h2 style="text-align:center;">💾 Save & Load</h2>
    <p style="text-align:center; color:var(--text-muted); font-size:0.85rem; margin-bottom:20px;">
        Export your tournament to a file or load a previous one
    </p>

    <div style="display:grid; grid-template-columns: 1fr 1fr; gap:16px; margin-bottom:20px;">
        <div style="background:var(--glass); border:1px solid var(--glass-border); border-radius:var(--radius-md); padding:20px; text-align:center;">
            <div style="font-size:2rem; margin-bottom:8px;">📥</div>
            <h3 style="font-size:0.95rem; margin-bottom:8px;">Save Tournament</h3>
            <p style="font-size:0.75rem; color:var(--text-muted); margin-bottom:12px;">
                Full save — teams, players, stats, fixtures, results, knockouts. Resume anytime.
            </p>
            <button onclick="exportTournament(); closePopup();" ${!hasTournament ? 'disabled style="opacity:0.5;"' : ''}>
                💾 Download Save
            </button>
        </div>
        <div style="background:var(--glass); border:1px solid var(--glass-border); border-radius:var(--radius-md); padding:20px; text-align:center;">
            <div style="font-size:2rem; margin-bottom:8px;">📤</div>
            <h3 style="font-size:0.95rem; margin-bottom:8px;">Load Tournament</h3>
            <p style="font-size:0.75rem; color:var(--text-muted); margin-bottom:12px;">
                Open a previously saved tournament file and pick up where you left off.
            </p>
            <button onclick="closePopup(); importTournament();">
                📂 Open File
            </button>
        </div>
    </div>

    <div style="border-top:1px solid var(--border-light); padding-top:16px; margin-bottom:16px;">
        <h3 style="font-size:0.95rem; text-align:center; margin-bottom:12px;">📋 Roster Only (No Stats)</h3>
        <div style="display:grid; grid-template-columns: 1fr 1fr; gap:16px;">
            <div style="background:var(--glass); border:1px solid var(--glass-border); border-radius:var(--radius-md); padding:16px; text-align:center;">
                <p style="font-size:0.75rem; color:var(--text-muted); margin-bottom:10px;">
                    Export just teams & players — no stats, no results. Share your roster!
                </p>
                <button class="btn-secondary" onclick="exportRosterData(); closePopup();" ${!hasTournament ? 'disabled style="opacity:0.5;"' : ''}>
                    📤 Export Roster
                </button>
            </div>
            <div style="background:var(--glass); border:1px solid var(--glass-border); border-radius:var(--radius-md); padding:16px; text-align:center;">
                <p style="font-size:0.75rem; color:var(--text-muted); margin-bottom:10px;">
                    Import a roster file to start a fresh league with those exact teams & players.
                </p>
                <button class="btn-secondary" onclick="closePopup(); importRosterData();">
                    📥 Import Roster
                </button>
            </div>
        </div>
    </div>

    <button onclick="closePopup()" style="width:100%; margin-top:12px;">Close</button>`;

    showPopup(html);
}
