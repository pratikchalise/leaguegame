/* =============================================
   MATCH SIMULATION ENGINE  
   Full 2D pitch with coin-shaped players, ball,
   live timer, speed controls, modes, lineups
   ============================================= */

// ---- CONSTANTS ----
const SIM_PITCH_W = 800;
const SIM_PITCH_H = 500;
const SIM_PLAYER_R = 14;
const SIM_BALL_R = 6;
const SIM_MATCH_DURATION = 90; // minutes
const SIM_FPS = 60;

// Formation templates  (x: 0-1 from left goal, y: 0-1 from top)
const FORMATIONS = {
    home: {
        GK:  [{ x: 0.06, y: 0.5 }],
        DEF: [{ x: 0.18, y: 0.18 }, { x: 0.18, y: 0.40 }, { x: 0.18, y: 0.60 }, { x: 0.18, y: 0.82 }],
        MID: [{ x: 0.35, y: 0.25 }, { x: 0.35, y: 0.50 }, { x: 0.35, y: 0.75 }],
        FWD: [{ x: 0.45, y: 0.25 }, { x: 0.45, y: 0.50 }, { x: 0.45, y: 0.75 }]
    },
    away: {
        GK:  [{ x: 0.94, y: 0.5 }],
        DEF: [{ x: 0.82, y: 0.18 }, { x: 0.82, y: 0.40 }, { x: 0.82, y: 0.60 }, { x: 0.82, y: 0.82 }],
        MID: [{ x: 0.65, y: 0.25 }, { x: 0.65, y: 0.50 }, { x: 0.65, y: 0.75 }],
        FWD: [{ x: 0.55, y: 0.25 }, { x: 0.55, y: 0.50 }, { x: 0.55, y: 0.75 }]
    }
};

// Mode settings: affects goal frequency, event probability
const SIM_MODES = {
    defensive: {
        label: '🛡️ Defensive',
        goalChance: 0.0005,
        eventChance: 0.002,
        cardChance: 0.001,
        ballSpeed: 2.5,
        playerSpeed: 1.0,
        possession: 0.5,
        maxGoals: 2,
        minGoals: 0
    },
    mid: {
        label: '⚔️ Balanced',
        goalChance: 0.0018,
        eventChance: 0.004,
        cardChance: 0.0015,
        ballSpeed: 3.5,
        playerSpeed: 1.4,
        possession: 0.5,
        maxGoals: 8,
        minGoals: 3
    },
    chaos: {
        label: '🔥 Chaos',
        goalChance: 0.0035,
        eventChance: 0.007,
        cardChance: 0.002,
        ballSpeed: 4.5,
        playerSpeed: 1.8,
        possession: 0.5,
        maxGoals: 15,
        minGoals: 9
    }
};

// ---- SIM STATE ----
let simState = null;

function createSimState(homeTeam, awayTeam, mode, onFinish) {
    // Pick starting 11 from each team (by position priority)
    const pickStarting11 = (team) => {
        const byPos = { GK: [], DEF: [], MID: [], FWD: [] };
        team.players.forEach(p => {
            if (p.suspended) return; // Skip suspended players (red card ban)
            if (byPos[p.position]) byPos[p.position].push(p);
        });
        // Sort each position by rating descending
        Object.values(byPos).forEach(arr => arr.sort((a, b) => b.rating - a.rating));

        const starting = [];
        // 1 GK
        starting.push(...byPos.GK.slice(0, 1));
        // 4 DEF
        starting.push(...byPos.DEF.slice(0, 4));
        // 3 MID
        starting.push(...byPos.MID.slice(0, 3));
        // 3 FWD
        starting.push(...byPos.FWD.slice(0, 3));

        // If we don't have enough in a position, fill from others
        if (starting.length < 11) {
            const remaining = team.players.filter(p => !starting.includes(p) && !p.suspended);
            remaining.sort((a, b) => b.rating - a.rating);
            while (starting.length < 11 && remaining.length > 0) {
                starting.push(remaining.shift());
            }
        }
        return starting.slice(0, 11);
    };

    const homeStarting = pickStarting11(homeTeam);
    const awayStarting = pickStarting11(awayTeam);

    // Record suspended players before clearing (for display)
    const homeSuspended = homeTeam.players.filter(p => p.suspended).map(p => p.name);
    const awaySuspended = awayTeam.players.filter(p => p.suspended).map(p => p.name);

    // Clear suspensions - players have now served their 1-match ban
    homeTeam.players.forEach(p => { if (p.suspended) p.suspended = false; });
    awayTeam.players.forEach(p => { if (p.suspended) p.suspended = false; });

    const modeConfig = SIM_MODES[mode] || SIM_MODES.mid;

    // Calculate team ratings
    const getTeamRating = (players) => {
        if (!players || players.length === 0) return 70;
        return players.reduce((s, p) => s + (p.rating || 70), 0) / players.length;
    };

    const homeRating = getTeamRating(homeStarting);
    const awayRating = getTeamRating(awayStarting);
    const managerInfluence = typeof getManagerMatchInfluence === 'function'
        ? getManagerMatchInfluence(homeTeam, awayTeam)
        : { home: 0, away: 0, notes: [] };
    const adjustedHomeRating = homeRating + (managerInfluence.home || 0);
    const adjustedAwayRating = awayRating + (managerInfluence.away || 0);
    const ratingDiff = adjustedHomeRating - adjustedAwayRating;

    // Build player entities with positions
    const buildEntities = (players, side) => {
        const formation = FORMATIONS[side];
        const slots = { GK: 0, DEF: 0, MID: 0, FWD: 0 };
        
        return players.map(p => {
            const pos = p.position || 'MID';
            const slotIdx = slots[pos] || 0;
            slots[pos] = slotIdx + 1;

            const formationSlots = formation[pos] || formation.MID;
            const slot = formationSlots[slotIdx % formationSlots.length];

            const baseX = slot.x * SIM_PITCH_W;
            const baseY = slot.y * SIM_PITCH_H;

            return {
                player: p,
                side: side,
                baseX: baseX,
                baseY: baseY,
                x: baseX,
                y: baseY,
                vx: 0,
                vy: 0,
                targetX: baseX,
                targetY: baseY,
                hasBall: false,
                color: getPlayerColor(p),
                glowColor: getPlayerGlow(p),
                label: getPlayerInitials(p.name),
                radius: SIM_PLAYER_R
            };
        });
    };

    const homeEntities = buildEntities(homeStarting, 'home');
    const awayEntities = buildEntities(awayStarting, 'away');

    return {
        homeTeam,
        awayTeam,
        homeStarting,
        awayStarting,
        homeEntities,
        awayEntities,
        homeRating: adjustedHomeRating,
        awayRating: adjustedAwayRating,
        ratingDiff,
        managerInfluence,
        mode,
        modeConfig,
        ball: {
            x: SIM_PITCH_W / 2,
            y: SIM_PITCH_H / 2,
            vx: 0,
            vy: 0,
            carrier: null, // entity reference
            targetX: SIM_PITCH_W / 2,
            targetY: SIM_PITCH_H / 2
        },
        homeScore: 0,
        awayScore: 0,
        matchMinute: 0,
        totalTicks: 0,
        ticksPerMinute: 40, // at 1x speed
        speed: 1,
        paused: false,
        finished: false,
        events: [],
        goalScorers: { home: [], away: [] },
        assisters: { home: [], away: [] },
        cards: { home: [], away: [] },
        possession: { home: 0, away: 0 },
        matchYellowCards: {},
        goalAnimation: null,
        skipAnimation: false,
        suspendedPlayers: { home: homeSuspended, away: awaySuspended },
        onFinish: onFinish,
        animFrameId: null,
        lastTimestamp: 0,
        tickAccumulator: 0,
        halfTimeDone: false
    };
}

// ---- COLOR HELPERS ----
function getPlayerColor(p) {
    if (p.type === 'Icon' && p.rating >= 95) return '#E0FFFF';
    if (p.type === 'Icon') return '#F6E3BA';
    if (p.rating >= 99) return '#ff4d4d';
    if (p.rating >= 97) return '#00ffea';
    if (p.rating >= 95) return '#ff00ea';
    if (p.rating >= 90) return '#FFD700';
    if (p.rating >= 85) return '#87CEEB';
    return '#ffffff';
}

function getPlayerGlow(p) {
    if (p.type === 'Icon' && p.rating >= 95) return 'rgba(224,255,255,0.6)';
    if (p.type === 'Icon') return 'rgba(246,227,186,0.4)';
    if (p.rating >= 99) return 'rgba(255,0,0,0.5)';
    if (p.rating >= 97) return 'rgba(0,255,234,0.4)';
    if (p.rating >= 95) return 'rgba(255,0,234,0.4)';
    if (p.rating >= 90) return 'rgba(255,215,0,0.3)';
    return null;
}

function getPlayerInitials(name) {
    const parts = name.split(' ');
    if (parts.length >= 2) return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
    return name.substring(0, 2).toUpperCase();
}

function getPlayerVipClass(p) {
    if (p.type === 'Icon' && p.rating >= 95) return 'icon-vip';
    if (p.type === 'Icon') return 'icon';
    if (p.rating >= 99) return 'vip-99';
    if (p.rating >= 97) return 'vip-97';
    if (p.rating >= 95) return 'vip-95';
    return '';
}

// ---- LINEUP HTML ----
function buildLineupHTML(players, teamName, teamColor, side) {
    const sorted = [...players].sort((a, b) => {
        const order = { GK: 0, DEF: 1, MID: 2, FWD: 3 };
        return (order[a.position] || 2) - (order[b.position] || 2);
    });

    let html = `<div class="sim-lineup-team">
        <div class="sim-lineup-title" style="color:${teamColor}">${teamName}</div>`;
    
    sorted.forEach(p => {
        const vipClass = getPlayerVipClass(p);
        const posClass = p.position ? p.position.toLowerCase() : 'mid';
        html += `<div class="sim-lineup-player ${vipClass}">
            <span class="sim-lineup-pos ${posClass}">${p.position}</span>
            <span class="sim-lineup-name">${p.name}</span>
            <span class="sim-lineup-rating">${p.rating}</span>
        </div>`;
    });

    html += `</div>`;
    return html;
}

// ---- MAIN POPUP ----
function openMatchSimulation(homeTeam, awayTeam, options = {}) {
    const {
        mode = 'mid',
        isKnockout = false,
        onResult = null
    } = options;

    // Close any existing popup
    closeMatchSimulation();

    if (typeof ensureLeagueRosterViability === 'function') ensureLeagueRosterViability();
    if (typeof ensureTeamHasMinimumRoster === 'function') {
        ensureTeamHasMinimumRoster(homeTeam);
        ensureTeamHasMinimumRoster(awayTeam);
    }

    const overlay = document.createElement('div');
    overlay.className = 'sim-overlay';
    overlay.id = 'simOverlay';

    const onFinish = (finalState) => {
        if (onResult) {
            onResult({
                homeScore: finalState.homeScore,
                awayScore: finalState.awayScore,
                goalScorers: finalState.goalScorers,
                assisters: finalState.assisters,
                cards: finalState.cards,
                events: finalState.events
            });
        }
    };

    simState = createSimState(homeTeam, awayTeam, mode, onFinish);

    overlay.innerHTML = `
        <div class="sim-container" id="simContainer">
            <!-- Scoreboard -->
            <div class="sim-header">
                <div class="sim-team-name home" style="color:${homeTeam.color}">${homeTeam.name}</div>
                <div class="sim-score-box">
                    <span class="sim-score" id="simHomeScore">0</span>
                    <span class="sim-score-divider">-</span>
                    <span class="sim-score" id="simAwayScore">0</span>
                </div>
                <div class="sim-team-name away" style="color:${awayTeam.color}">${awayTeam.name}</div>
                <div class="sim-timer" id="simTimer">0'</div>
            </div>

            <!-- Controls -->
            <div class="sim-controls">
                <button class="sim-speed-btn ${simState.speed === 1 ? 'active' : ''}" onclick="setSimSpeed(1)">1x</button>
                <button class="sim-speed-btn ${simState.speed === 2 ? 'active' : ''}" onclick="setSimSpeed(2)">2x</button>
                <button class="sim-speed-btn" onclick="setSimSpeed(4)">4x</button>
                <button class="sim-speed-btn" onclick="setSimSpeed(8)">8x</button>
                <button class="sim-speed-btn" onclick="setSimSpeed(16)">16x</button>
                <span style="color:#555; margin:0 4px;">|</span>
                <button class="sim-mode-btn ${simState.mode === 'defensive' ? 'active' : ''}" onclick="setSimMode('defensive')">🛡️ DEF</button>
                <button class="sim-mode-btn ${simState.mode === 'mid' ? 'active' : ''}" onclick="setSimMode('mid')">⚔️ BAL</button>
                <button class="sim-mode-btn ${simState.mode === 'chaos' ? 'active' : ''}" onclick="setSimMode('chaos')">🔥 CHAOS</button>
                <span style="color:#555; margin:0 4px;">|</span>
                <button class="sim-pause-btn" id="simPauseBtn" onclick="toggleSimPause()">⏸ Pause</button>
                <button class="sim-finish-btn" onclick="instantFinishSim()">⚡ Finish</button>
            </div>

            <!-- Pitch -->
            <div class="sim-pitch-wrapper">
                <canvas id="simCanvas" width="${SIM_PITCH_W}" height="${SIM_PITCH_H}"></canvas>
            </div>

            <!-- Events -->
            <div class="sim-events" id="simEvents"></div>

            <!-- Lineups -->
            <div class="sim-lineups">
                ${buildLineupHTML(simState.homeStarting, homeTeam.name, homeTeam.color, 'home')}
                ${buildLineupHTML(simState.awayStarting, awayTeam.name, awayTeam.color, 'away')}
            </div>
        </div>
    `;

    document.body.appendChild(overlay);

    // Log suspended players
    if (simState.suspendedPlayers && simState.suspendedPlayers.home.length > 0) {
        addSimEvent('card', `🚫 SUSPENDED: ${simState.suspendedPlayers.home.join(', ')} (${homeTeam.name}) - Red card ban from previous match`, 'home');
    }
    if (simState.suspendedPlayers && simState.suspendedPlayers.away.length > 0) {
        addSimEvent('card', `🚫 SUSPENDED: ${simState.suspendedPlayers.away.join(', ')} (${awayTeam.name}) - Red card ban from previous match`, 'away');
    }
    if (simState.managerInfluence && Array.isArray(simState.managerInfluence.notes)) {
        simState.managerInfluence.notes.forEach(note => addSimEvent('event', `🧠 ${note}`, 'neutral'));
    }

    // Start the simulation loop
    requestAnimationFrame(simLoop);
}

function closeMatchSimulation() {
    if (simState && simState.animFrameId) {
        cancelAnimationFrame(simState.animFrameId);
    }
    const overlay = document.getElementById('simOverlay');
    if (overlay) overlay.remove();
    simState = null;
}

// ---- CONTROLS ----
function setSimSpeed(speed) {
    if (!simState) return;
    simState.speed = speed;
    document.querySelectorAll('.sim-speed-btn').forEach(btn => {
        btn.classList.toggle('active', btn.textContent === speed + 'x');
    });
}

function setSimMode(mode) {
    if (!simState || simState.finished) return;
    simState.mode = mode;
    simState.modeConfig = SIM_MODES[mode] || SIM_MODES.mid;
    document.querySelectorAll('.sim-mode-btn').forEach(btn => btn.classList.remove('active'));
    const activeBtn = document.querySelector(`.sim-mode-btn[onclick*="${mode}"]`);
    if (activeBtn) activeBtn.classList.add('active');
}

function toggleSimPause() {
    if (!simState || simState.finished) return;
    simState.paused = !simState.paused;
    const btn = document.getElementById('simPauseBtn');
    if (btn) {
        btn.textContent = simState.paused ? '▶ Resume' : '⏸ Pause';
        btn.classList.toggle('paused', simState.paused);
    }
    if (!simState.paused) {
        simState.lastTimestamp = performance.now();
        requestAnimationFrame(simLoop);
    }
}

function instantFinishSim() {
    if (!simState || simState.finished) return;
    
    // Skip animations during instant finish
    simState.skipAnimation = true;
    simState.goalAnimation = null;
    
    // Simulate remaining time instantly
    while (simState.matchMinute < SIM_MATCH_DURATION) {
        simTick();
    }
    
    // Ensure minimum goals are met
    const cfg = simState.modeConfig;
    const minGoals = cfg.minGoals !== undefined ? cfg.minGoals : 0;
    const maxGoals = cfg.maxGoals !== undefined ? cfg.maxGoals : 20;
    let totalGoals = simState.homeScore + simState.awayScore;
    
    while (totalGoals < minGoals && totalGoals < maxGoals) {
        const homeStrength = (0.5 + (simState.ratingDiff / 100)) * (simState.homeEntities.length / 11);
        const awayStrength = (0.5 - (simState.ratingDiff / 100)) * (simState.awayEntities.length / 11);
        const totalStrength = homeStrength + awayStrength;
        const homeChance = totalStrength > 0 ? homeStrength / totalStrength : 0.5;
        const scoringSide = Math.random() < homeChance ? 'home' : 'away';
        const scoringTeam = scoringSide === 'home' ? simState.homeEntities : simState.awayEntities;
        const team = scoringSide === 'home' ? simState.homeTeam : simState.awayTeam;
        
        const goalWeights = { GK: 0.001, DEF: 0.15, MID: 1.0, FWD: 3.0 };
        const scorer = getWeightedSimPlayer(scoringTeam, goalWeights);
        const assistWeights = { GK: 0.01, DEF: 0.4, MID: 2.0, FWD: 1.5 };
        const assister = getWeightedSimPlayer(scoringTeam.filter(e => e !== scorer), assistWeights);
        
        if (scorer) {
            const minute = randomInt(1, 90);
            if (scoringSide === 'home') {
                simState.homeScore++;
                simState.goalScorers.home.push({ player: scorer.player, minute: minute });
            } else {
                simState.awayScore++;
                simState.goalScorers.away.push({ player: scorer.player, minute: minute });
            }
            scorer.player.goals++;
            if (assister && assister !== scorer) {
                assister.player.assists++;
                if (scoringSide === 'home') simState.assisters.home.push({ player: assister.player, minute: minute });
                else simState.assisters.away.push({ player: assister.player, minute: minute });
            }
            const assistText = (assister && assister !== scorer) ? ` (assist: ${assister.player.name})` : '';
            addSimEvent('goal', `⚽ ${minute}' GOAL! ${scorer.player.name} scores for ${team.name}!${assistText}`, scoringSide);
        }
        totalGoals = simState.homeScore + simState.awayScore;
    }
    
    simState.finished = true;
    showSimResult();
}

// ---- SIMULATION LOOP ----
function simLoop(timestamp) {
    if (!simState || simState.finished || simState.paused) return;

    if (simState.lastTimestamp === 0) simState.lastTimestamp = timestamp;
    const delta = (timestamp - simState.lastTimestamp) / 1000; // seconds
    simState.lastTimestamp = timestamp;

    // Accumulate ticks based on speed
    const tickInterval = 1 / (simState.ticksPerMinute * simState.speed); // seconds per tick at 1 minute = ticksPerMinute ticks
    simState.tickAccumulator += delta;

    // Process ticks
    const maxTicksPerFrame = Math.min(Math.floor(simState.tickAccumulator / tickInterval), 50);
    for (let i = 0; i < maxTicksPerFrame; i++) {
        simTick();
        simState.tickAccumulator -= tickInterval;
        if (simState.finished) break;
    }
    if (simState.tickAccumulator > tickInterval * 5) simState.tickAccumulator = 0;

    // Render
    renderSimPitch();
    updateSimUI();

    if (!simState.finished) {
        simState.animFrameId = requestAnimationFrame(simLoop);
    }
}

// ---- GAME TICK ----
function simTick() {
    if (!simState || simState.finished) return;

    // Pause gameplay during goal animation (skip during instant finish)
    if (simState.goalAnimation && !simState.skipAnimation) return;
    if (simState.goalAnimation && simState.skipAnimation) simState.goalAnimation = null;

    simState.totalTicks++;
    simState.matchMinute = Math.min(SIM_MATCH_DURATION, simState.totalTicks / simState.ticksPerMinute);

    if (simState.matchMinute >= SIM_MATCH_DURATION) {
        simState.matchMinute = SIM_MATCH_DURATION;
        simState.finished = true;
        showSimResult();
        return;
    }

    // Half-time event
    if (!simState.halfTimeDone && simState.matchMinute >= 45) {
        simState.halfTimeDone = true;
        addSimEvent('halftime', `── HALF TIME ──  ${simState.homeScore} - ${simState.awayScore}`, null);
    }

    const cfg = simState.modeConfig;
    const allPlayers = [...simState.homeEntities, ...simState.awayEntities];

    // --- Move players toward targets with some drift ---
    allPlayers.forEach(ent => {
        // Wander: occasionally pick new target near base
        if (Math.random() < 0.03) {
            const driftRange = ent.player.position === 'GK' ? 30 : (ent.player.position === 'DEF' ? 60 : 100);
            ent.targetX = ent.baseX + (Math.random() - 0.5) * driftRange * 2;
            ent.targetY = ent.baseY + (Math.random() - 0.5) * driftRange * 2;
            // Clamp
            ent.targetX = Math.max(SIM_PLAYER_R, Math.min(SIM_PITCH_W - SIM_PLAYER_R, ent.targetX));
            ent.targetY = Math.max(SIM_PLAYER_R, Math.min(SIM_PITCH_H - SIM_PLAYER_R, ent.targetY));
        }

        // If chasing ball
        if (simState.ball.carrier === null && Math.random() < 0.15) {
            // Some players chase the ball
            const dist = Math.hypot(ent.x - simState.ball.x, ent.y - simState.ball.y);
            if (dist < 200) {
                ent.targetX = simState.ball.x + (Math.random() - 0.5) * 30;
                ent.targetY = simState.ball.y + (Math.random() - 0.5) * 30;
            }
        }

        // Move toward target
        const dx = ent.targetX - ent.x;
        const dy = ent.targetY - ent.y;
        const dist = Math.hypot(dx, dy);
        if (dist > 2) {
            const speed = cfg.playerSpeed * (0.8 + (ent.player.rating / 100) * 0.4);
            ent.x += (dx / dist) * speed;
            ent.y += (dy / dist) * speed;
        }
    });

    // --- Ball logic ---
    const ball = simState.ball;
    if (ball.carrier) {
        // Ball follows carrier
        ball.x = ball.carrier.x;
        ball.y = ball.carrier.y;

        // Track possession
        if (ball.carrier.side === 'home') simState.possession.home++;
        else simState.possession.away++;

        // Chance to pass or lose ball
        if (Math.random() < 0.06) {
            // Pass to a teammate
            const teammates = (ball.carrier.side === 'home' ? simState.homeEntities : simState.awayEntities)
                .filter(e => e !== ball.carrier);
            if (teammates.length > 0) {
                const target = teammates[Math.floor(Math.random() * teammates.length)];
                ball.carrier = null;
                ball.targetX = target.x + (Math.random() - 0.5) * 20;
                ball.targetY = target.y + (Math.random() - 0.5) * 20;
                ball.vx = (ball.targetX - ball.x) * 0.12;
                ball.vy = (ball.targetY - ball.y) * 0.12;
            }
        } else if (Math.random() < 0.02) {
            // Lose ball
            ball.carrier = null;
            ball.vx = (Math.random() - 0.5) * cfg.ballSpeed * 2;
            ball.vy = (Math.random() - 0.5) * cfg.ballSpeed * 2;
        }
    } else {
        // Ball is free - move toward target
        ball.x += ball.vx;
        ball.y += ball.vy;
        ball.vx *= 0.96;
        ball.vy *= 0.96;

        // Bounce off walls
        if (ball.x < SIM_BALL_R) { ball.x = SIM_BALL_R; ball.vx = Math.abs(ball.vx); }
        if (ball.x > SIM_PITCH_W - SIM_BALL_R) { ball.x = SIM_PITCH_W - SIM_BALL_R; ball.vx = -Math.abs(ball.vx); }
        if (ball.y < SIM_BALL_R) { ball.y = SIM_BALL_R; ball.vy = Math.abs(ball.vy); }
        if (ball.y > SIM_PITCH_H - SIM_BALL_R) { ball.y = SIM_PITCH_H - SIM_BALL_R; ball.vy = -Math.abs(ball.vy); }

        // Check if any player picks up ball
        allPlayers.forEach(ent => {
            const d = Math.hypot(ent.x - ball.x, ent.y - ball.y);
            if (d < SIM_PLAYER_R + SIM_BALL_R + 5) {
                ball.carrier = ent;
                ball.vx = 0;
                ball.vy = 0;
            }
        });
    }

    // --- Goal events ---
    const totalGoals = simState.homeScore + simState.awayScore;
    const maxGoals = cfg.maxGoals !== undefined ? cfg.maxGoals : 20;
    const minGoals = cfg.minGoals !== undefined ? cfg.minGoals : 0;
    let adjustedGoalChance = cfg.goalChance;
    
    // Cap goals at max
    if (totalGoals >= maxGoals) {
        adjustedGoalChance = 0;
    } else if (maxGoals - totalGoals <= 2) {
        adjustedGoalChance *= 0.3; // Reduce chance near cap
    }
    
    // Boost chance if under minimum and time is running out
    if (totalGoals < minGoals && simState.matchMinute > 70) {
        const urgency = (simState.matchMinute - 70) / 20; // 0 to 1
        adjustedGoalChance = Math.max(adjustedGoalChance, 0.02 + urgency * 0.03);
    }

    if (adjustedGoalChance > 0 && Math.random() < adjustedGoalChance) {
        // Determine which team scores based on ratings, possession, and player count
        const homePlayerCount = simState.homeEntities.length;
        const awayPlayerCount = simState.awayEntities.length;
        const homeStrength = (0.5 + (simState.ratingDiff / 100)) * (homePlayerCount / 11);
        const awayStrength = (0.5 - (simState.ratingDiff / 100)) * (awayPlayerCount / 11);
        const totalStrength = homeStrength + awayStrength;
        const homeChance = totalStrength > 0 ? homeStrength / totalStrength : 0.5;
        const scoringSide = Math.random() < homeChance ? 'home' : 'away';
        const scoringTeam = scoringSide === 'home' ? simState.homeEntities : simState.awayEntities;
        const team = scoringSide === 'home' ? simState.homeTeam : simState.awayTeam;

        // Weighted random scorer (FWD/MID more likely)
        const goalWeights = { GK: 0.001, DEF: 0.15, MID: 1.0, FWD: 3.0 };
        const scorer = getWeightedSimPlayer(scoringTeam, goalWeights);
        
        // Weighted random assister
        const assistWeights = { GK: 0.01, DEF: 0.4, MID: 2.0, FWD: 1.5 };
        const assister = getWeightedSimPlayer(scoringTeam.filter(e => e !== scorer), assistWeights);

        if (scorer) {
            if (scoringSide === 'home') {
                simState.homeScore++;
                simState.goalScorers.home.push({ player: scorer.player, minute: Math.floor(simState.matchMinute) });
            } else {
                simState.awayScore++;
                simState.goalScorers.away.push({ player: scorer.player, minute: Math.floor(simState.matchMinute) });
            }

            // Update actual player stats
            scorer.player.goals++;
            if (assister && assister !== scorer) {
                assister.player.assists++;
                if (scoringSide === 'home') simState.assisters.home.push({ player: assister.player, minute: Math.floor(simState.matchMinute) });
                else simState.assisters.away.push({ player: assister.player, minute: Math.floor(simState.matchMinute) });
            }

            const assistText = (assister && assister !== scorer) ? ` (assist: ${assister.player.name})` : '';
            addSimEvent('goal', `⚽ ${Math.floor(simState.matchMinute)}' GOAL! ${scorer.player.name} scores for ${team.name}!${assistText}`, scoringSide);

            // Goal animation: ball starts at scorer, flies to net
            const netX = scoringSide === 'home' ? SIM_PITCH_W - 6 : 6;
            const netY = SIM_PITCH_H / 2 + (Math.random() - 0.5) * 40;
            const animFrames = Math.max(3, Math.floor(35 / simState.speed));
            simState.goalAnimation = {
                fromX: scorer.x,
                fromY: scorer.y,
                toX: netX,
                toY: netY,
                frame: 0,
                totalFrames: animFrames,
                side: scoringSide
            };

            // Set ball at scorer position (visual overridden by animation)
            ball.carrier = null;
            ball.x = scorer.x;
            ball.y = scorer.y;
            ball.vx = 0;
            ball.vy = 0;

            // Reset positions after goal
            resetPlayerPositions();
        }
    }

    // --- Card events ---
    if (Math.random() < cfg.cardChance) {
        const side = Math.random() < 0.5 ? 'home' : 'away';
        const teamEntities = side === 'home' ? simState.homeEntities : simState.awayEntities;
        const team = side === 'home' ? simState.homeTeam : simState.awayTeam;
        
        // Don't give cards if team already at minimum players (7)
        if (teamEntities.length > 7) {
            // Position-weighted card selection: GK rarely, DEF/MID most likely
            const cardWeights = { GK: 0.02, DEF: 3.0, MID: 2.5, FWD: 1.5 };
            const cardPlayer = getWeightedSimPlayer(teamEntities, cardWeights);
            
            if (cardPlayer) {
                const isRed = Math.random() < 0.08;
                const playerName = cardPlayer.player.name;
                const cardKey = side + '_' + playerName;
                
                // Initialize match yellow card tracking
                if (!simState.matchYellowCards[cardKey]) {
                    simState.matchYellowCards[cardKey] = 0;
                }
                
                if (isRed) {
                    // Direct red card
                    cardPlayer.player.redCards++;
                    simState.cards[side].push({ player: cardPlayer.player, type: 'red', minute: Math.floor(simState.matchMinute) });
                    addSimEvent('card', `🟥 ${Math.floor(simState.matchMinute)}' RED CARD! ${cardPlayer.player.name} (${team.name}) - Sent off!`, side);
                    
                    // Remove player from pitch
                    removePlayerFromPitch(cardPlayer, side);
                } else {
                    // Yellow card
                    cardPlayer.player.yellowCards++;
                    simState.matchYellowCards[cardKey]++;
                    simState.cards[side].push({ player: cardPlayer.player, type: 'yellow', minute: Math.floor(simState.matchMinute) });
                    
                    // Check for second yellow = red card
                    if (simState.matchYellowCards[cardKey] >= 2) {
                        addSimEvent('card', `🟨🟨 ${Math.floor(simState.matchMinute)}' SECOND YELLOW! ${cardPlayer.player.name} (${team.name})`, side);
                        cardPlayer.player.redCards++;
                        simState.cards[side].push({ player: cardPlayer.player, type: 'red', minute: Math.floor(simState.matchMinute) });
                        addSimEvent('card', `🟥 ${Math.floor(simState.matchMinute)}' RED CARD! ${cardPlayer.player.name} (${team.name}) - Two yellows = sent off!`, side);
                        
                        // Remove player from pitch
                        removePlayerFromPitch(cardPlayer, side);
                    } else {
                        addSimEvent('card', `🟨 ${Math.floor(simState.matchMinute)}' Yellow card: ${cardPlayer.player.name} (${team.name})`, side);
                    }
                }
            }
        }
    }

    // --- Passing stats (accumulated throughout) ---
    if (simState.totalTicks % 20 === 0) {
        allPlayers.forEach(ent => {
            const p = ent.player;
            let attempts;
            if (p.position === "GK") attempts = randomInt(0, 1);
            else if (p.position === "DEF") attempts = randomInt(0, 2);
            else if (p.position === "MID") attempts = randomInt(1, 3);
            else attempts = randomInt(0, 2);
            
            p.passesAttempted += attempts;
            const passRating = p.passingRating || p.rating;
            const accuracy = 70 + ((passRating - 60) / (99 - 60)) * 25;
            p.passesCompleted += Math.round(attempts * (accuracy / 100));
        });
    }
}

function getWeightedSimPlayer(entities, posWeights) {
    if (!entities || entities.length === 0) return null;
    const weights = entities.map(e => {
        const pw = posWeights[e.player.position] || 1.0;
        return Math.pow(e.player.rating || 70, 3) * pw;
    });
    const total = weights.reduce((a, b) => a + b, 0);
    let r = Math.random() * total;
    for (let i = 0; i < entities.length; i++) {
        r -= weights[i];
        if (r <= 0) return entities[i];
    }
    return entities[entities.length - 1];
}

function resetPlayerPositions() {
    if (!simState) return;
    const allEntities = [...simState.homeEntities, ...simState.awayEntities];
    allEntities.forEach(ent => {
        ent.targetX = ent.baseX;
        ent.targetY = ent.baseY;
    });
    simState.ball.x = SIM_PITCH_W / 2;
    simState.ball.y = SIM_PITCH_H / 2;
    simState.ball.carrier = null;
    simState.ball.vx = 0;
    simState.ball.vy = 0;
}

function removePlayerFromPitch(entity, side) {
    if (!simState) return;
    const entityArray = side === 'home' ? simState.homeEntities : simState.awayEntities;
    const idx = entityArray.indexOf(entity);
    if (idx !== -1) {
        // Release ball if this player had it
        if (simState.ball.carrier === entity) {
            simState.ball.carrier = null;
            simState.ball.vx = (Math.random() - 0.5) * 3;
            simState.ball.vy = (Math.random() - 0.5) * 3;
        }
        // Remove from entities array - player leaves the pitch
        entityArray.splice(idx, 1);
    }
}

function addSimEvent(type, text, side) {
    if (!simState) return;
    simState.events.push({ type, text, side, minute: Math.floor(simState.matchMinute) });
    const evDiv = document.getElementById('simEvents');
    if (evDiv) {
        const item = document.createElement('div');
        item.className = `sim-event-item ${type}`;
        item.textContent = text;
        evDiv.insertBefore(item, evDiv.firstChild);
        // Keep only last 50
        while (evDiv.children.length > 50) evDiv.removeChild(evDiv.lastChild);
    }
}

// ---- UI UPDATES ----
function updateSimUI() {
    if (!simState) return;
    const hs = document.getElementById('simHomeScore');
    const as = document.getElementById('simAwayScore');
    const timer = document.getElementById('simTimer');
    if (hs) hs.textContent = simState.homeScore;
    if (as) as.textContent = simState.awayScore;
    if (timer) timer.textContent = Math.floor(simState.matchMinute) + "'";
}

// ---- PITCH RENDERING ----
function renderSimPitch() {
    if (!simState) return;
    const canvas = document.getElementById('simCanvas');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const W = canvas.width;
    const H = canvas.height;

    // --- Draw pitch ---
    // Grass
    const grassGrad = ctx.createLinearGradient(0, 0, 0, H);
    grassGrad.addColorStop(0, '#1a6b1a');
    grassGrad.addColorStop(0.5, '#228B22');
    grassGrad.addColorStop(1, '#1a6b1a');
    ctx.fillStyle = grassGrad;
    ctx.fillRect(0, 0, W, H);

    // Grass stripes
    ctx.fillStyle = 'rgba(255,255,255,0.03)';
    for (let i = 0; i < W; i += 80) {
        if ((i / 80) % 2 === 0) ctx.fillRect(i, 0, 80, H);
    }

    ctx.strokeStyle = 'rgba(255,255,255,0.6)';
    ctx.lineWidth = 2;

    // Boundary
    ctx.strokeRect(5, 5, W - 10, H - 10);

    // Center line
    ctx.beginPath();
    ctx.moveTo(W / 2, 5);
    ctx.lineTo(W / 2, H - 5);
    ctx.stroke();

    // Center circle
    ctx.beginPath();
    ctx.arc(W / 2, H / 2, 60, 0, Math.PI * 2);
    ctx.stroke();

    // Center dot
    ctx.fillStyle = 'rgba(255,255,255,0.8)';
    ctx.beginPath();
    ctx.arc(W / 2, H / 2, 4, 0, Math.PI * 2);
    ctx.fill();

    // Penalty areas
    const penW = 120;
    const penH = 260;
    const penY = (H - penH) / 2;
    ctx.strokeRect(5, penY, penW, penH);
    ctx.strokeRect(W - 5 - penW, penY, penW, penH);

    // Goal areas
    const goalW = 45;
    const goalH = 140;
    const goalY = (H - goalH) / 2;
    ctx.strokeRect(5, goalY, goalW, goalH);
    ctx.strokeRect(W - 5 - goalW, goalY, goalW, goalH);

    // Goals (nets)
    ctx.fillStyle = 'rgba(255,255,255,0.15)';
    const netW = 12;
    const netH = 80;
    const netY = (H - netH) / 2;
    ctx.fillRect(0, netY, netW, netH);
    ctx.fillRect(W - netW, netY, netW, netH);

    // Penalty spots
    ctx.fillStyle = 'rgba(255,255,255,0.6)';
    ctx.beginPath(); ctx.arc(90, H / 2, 3, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.arc(W - 90, H / 2, 3, 0, Math.PI * 2); ctx.fill();

    // Penalty arcs
    ctx.beginPath();
    ctx.arc(90, H / 2, 60, -0.7, 0.7);
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(W - 90, H / 2, 60, Math.PI - 0.7, Math.PI + 0.7);
    ctx.stroke();

    // Corner arcs
    ctx.beginPath(); ctx.arc(5, 5, 15, 0, Math.PI / 2); ctx.stroke();
    ctx.beginPath(); ctx.arc(W - 5, 5, 15, Math.PI / 2, Math.PI); ctx.stroke();
    ctx.beginPath(); ctx.arc(5, H - 5, 15, -Math.PI / 2, 0); ctx.stroke();
    ctx.beginPath(); ctx.arc(W - 5, H - 5, 15, Math.PI, Math.PI * 1.5); ctx.stroke();

    // --- Draw players ---
    const homeColor = simState.homeTeam.color || '#3498db';
    const awayColor = simState.awayTeam.color || '#e74c3c';

    // Home players
    simState.homeEntities.forEach(ent => {
        drawPlayerCoin(ctx, ent, homeColor);
    });

    // Away players
    simState.awayEntities.forEach(ent => {
        drawPlayerCoin(ctx, ent, awayColor);
    });

    // --- Draw ball / Goal animation ---
    if (simState.goalAnimation) {
        const anim = simState.goalAnimation;
        anim.frame++;
        const t = Math.min(anim.frame / anim.totalFrames, 1);
        const easeT = t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
        
        const bx = anim.fromX + (anim.toX - anim.fromX) * easeT;
        const by = anim.fromY + (anim.toY - anim.fromY) * easeT;
        
        // Draw trail effect
        ctx.save();
        for (let i = 1; i <= 6; i++) {
            const tt = Math.max(0, t - i * 0.05);
            const et = tt < 0.5 ? 2 * tt * tt : 1 - Math.pow(-2 * tt + 2, 2) / 2;
            const tx = anim.fromX + (anim.toX - anim.fromX) * et;
            const ty = anim.fromY + (anim.toY - anim.fromY) * et;
            ctx.beginPath();
            ctx.arc(tx, ty, SIM_BALL_R * (1 - i * 0.12), 0, Math.PI * 2);
            ctx.fillStyle = `rgba(255,255,255,${0.35 - i * 0.05})`;
            ctx.fill();
        }
        ctx.restore();
        
        // Draw ball at current animated position
        ctx.save();
        ctx.shadowColor = 'rgba(255,215,0,0.9)';
        ctx.shadowBlur = 15;
        const ballGrad = ctx.createRadialGradient(bx - 2, by - 2, 1, bx, by, SIM_BALL_R);
        ballGrad.addColorStop(0, '#ffffff');
        ballGrad.addColorStop(1, '#cccccc');
        ctx.beginPath();
        ctx.arc(bx, by, SIM_BALL_R, 0, Math.PI * 2);
        ctx.fillStyle = ballGrad;
        ctx.fill();
        ctx.restore();
        
        // Draw "GOAL!" text with glow
        if (t > 0.3) {
            ctx.save();
            const textAlpha = Math.min(1, (t - 0.3) * 3);
            ctx.globalAlpha = textAlpha;
            ctx.fillStyle = '#FFD700';
            ctx.font = 'bold 40px Orbitron, sans-serif';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.shadowColor = 'rgba(255,215,0,0.8)';
            ctx.shadowBlur = 25;
            ctx.fillText('⚽ GOAL!', SIM_PITCH_W / 2, SIM_PITCH_H / 2 - 40);
            ctx.restore();
        }
        
        // Net flash effect when ball reaches net
        if (t > 0.85) {
            ctx.save();
            const flashAlpha = (1 - t) * 6;
            ctx.fillStyle = `rgba(255,255,255,${Math.min(0.4, flashAlpha)})`;
            if (anim.side === 'home') {
                ctx.fillRect(SIM_PITCH_W - 12, (SIM_PITCH_H - 80) / 2, 12, 80);
            } else {
                ctx.fillRect(0, (SIM_PITCH_H - 80) / 2, 12, 80);
            }
            ctx.restore();
        }
        
        if (anim.frame >= anim.totalFrames) {
            simState.goalAnimation = null;
        }
    } else {
        drawBall(ctx, simState.ball);
    }

    // --- Possession bar ---
    const totalPoss = simState.possession.home + simState.possession.away;
    if (totalPoss > 0) {
        const homePct = Math.round((simState.possession.home / totalPoss) * 100);
        const awayPct = 100 - homePct;
        const barY = H - 18;
        const barH = 10;
        const barW = W - 10;
        
        ctx.fillStyle = 'rgba(0,0,0,0.5)';
        ctx.fillRect(5, barY, barW, barH);
        
        ctx.fillStyle = homeColor;
        ctx.fillRect(5, barY, barW * (homePct / 100), barH);
        
        ctx.fillStyle = awayColor;
        ctx.fillRect(5 + barW * (homePct / 100), barY, barW * (awayPct / 100), barH);

        ctx.fillStyle = 'white';
        ctx.font = 'bold 8px Orbitron, sans-serif';
        ctx.textAlign = 'left';
        ctx.fillText(`${homePct}%`, 10, barY + 8);
        ctx.textAlign = 'right';
        ctx.fillText(`${awayPct}%`, W - 10, barY + 8);
        ctx.textAlign = 'center';
        ctx.fillText('POSSESSION', W / 2, barY + 8);
    }
}

function drawPlayerCoin(ctx, entity, teamColor) {
    const { x, y, player, glowColor, label, radius } = entity;

    ctx.save();

    // Glow for special players
    if (glowColor) {
        ctx.shadowColor = glowColor;
        ctx.shadowBlur = 15;
    }

    // Outer ring (team color)
    ctx.beginPath();
    ctx.arc(x, y, radius + 2, 0, Math.PI * 2);
    ctx.fillStyle = teamColor;
    ctx.fill();

    // Inner coin
    const innerGrad = ctx.createRadialGradient(x - 3, y - 3, 1, x, y, radius);
    innerGrad.addColorStop(0, '#555');
    innerGrad.addColorStop(0.5, '#333');
    innerGrad.addColorStop(1, '#1a1a1a');
    ctx.beginPath();
    ctx.arc(x, y, radius, 0, Math.PI * 2);
    ctx.fillStyle = innerGrad;
    ctx.fill();

    ctx.shadowBlur = 0;

    // Player initials
    ctx.fillStyle = entity.color;
    ctx.font = `bold ${radius * 0.75}px Orbitron, sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(label, x, y);

    // Position indicator (tiny dot at bottom)
    const posColors = { GK: '#fbc531', DEF: '#4cd137', MID: '#00d2d3', FWD: '#e84118' };
    ctx.beginPath();
    ctx.arc(x, y + radius - 2, 3, 0, Math.PI * 2);
    ctx.fillStyle = posColors[player.position] || '#fff';
    ctx.fill();

    // Ball indicator
    if (entity === simState.ball.carrier) {
        ctx.strokeStyle = '#FFD700';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(x, y, radius + 5, 0, Math.PI * 2);
        ctx.stroke();
    }

    // Yellow card indicator
    if (simState.matchYellowCards) {
        const cardKey = entity.side + '_' + player.name;
        const yellows = simState.matchYellowCards[cardKey] || 0;
        if (yellows > 0) {
            ctx.fillStyle = '#FFD700';
            ctx.fillRect(x + radius - 2, y - radius - 4, 5, 7);
            ctx.strokeStyle = '#000';
            ctx.lineWidth = 0.5;
            ctx.strokeRect(x + radius - 2, y - radius - 4, 5, 7);
        }
    }

    ctx.restore();
}

function drawBall(ctx, ball) {
    if (ball.carrier) return; // Ball is with a player, don't draw separately

    ctx.save();
    ctx.shadowColor = 'rgba(255,255,255,0.8)';
    ctx.shadowBlur = 8;

    // Ball
    const grad = ctx.createRadialGradient(ball.x - 2, ball.y - 2, 1, ball.x, ball.y, SIM_BALL_R);
    grad.addColorStop(0, '#ffffff');
    grad.addColorStop(1, '#cccccc');
    ctx.beginPath();
    ctx.arc(ball.x, ball.y, SIM_BALL_R, 0, Math.PI * 2);
    ctx.fillStyle = grad;
    ctx.fill();

    // Black pentagon pattern hint
    ctx.strokeStyle = 'rgba(0,0,0,0.3)';
    ctx.lineWidth = 0.5;
    ctx.beginPath();
    ctx.arc(ball.x, ball.y, SIM_BALL_R * 0.5, 0, Math.PI * 2);
    ctx.stroke();

    ctx.restore();
}

// ---- SHOW RESULT ----
function showSimResult() {
    if (!simState) return;
    
    updateSimUI();
    
    const container = document.getElementById('simContainer');
    if (!container) return;

    // Build scorers text
    let scorersHTML = '';
    if (simState.goalScorers.home.length > 0) {
        scorersHTML += `<div style="margin-bottom:8px;"><strong style="color:${simState.homeTeam.color}">${simState.homeTeam.name}:</strong> `;
        scorersHTML += simState.goalScorers.home.map(g => `${g.player.name} ${g.minute}'`).join(', ');
        scorersHTML += '</div>';
    }
    if (simState.goalScorers.away.length > 0) {
        scorersHTML += `<div><strong style="color:${simState.awayTeam.color}">${simState.awayTeam.name}:</strong> `;
        scorersHTML += simState.goalScorers.away.map(g => `${g.player.name} ${g.minute}'`).join(', ');
        scorersHTML += '</div>';
    }

    // Cards
    let cardsHTML = '';
    const allCards = [...simState.cards.home.map(c => ({ ...c, team: simState.homeTeam.name })),
                      ...simState.cards.away.map(c => ({ ...c, team: simState.awayTeam.name }))];
    if (allCards.length > 0) {
        cardsHTML = `<div style="margin-top:10px; font-size:0.85rem; color:#aaa;">`;
        allCards.forEach(c => {
            const icon = c.type === 'red' ? '🟥' : '🟨';
            cardsHTML += `<div>${icon} ${c.player.name} (${c.team}) ${c.minute}'</div>`;
        });
        cardsHTML += `</div>`;
    }

    // Possession
    const totalPoss = simState.possession.home + simState.possession.away;
    const homePct = totalPoss > 0 ? Math.round((simState.possession.home / totalPoss) * 100) : 50;
    const awayPct = 100 - homePct;

    const resultOverlay = document.createElement('div');
    resultOverlay.className = 'sim-result-overlay';
    resultOverlay.innerHTML = `
        <div class="sim-result-card">
            <div class="sim-result-title">FULL TIME</div>
            <div style="font-size:1.1rem; color:#aaa; margin-bottom:5px;">
                <span style="color:${simState.homeTeam.color}">${simState.homeTeam.name}</span> vs 
                <span style="color:${simState.awayTeam.color}">${simState.awayTeam.name}</span>
            </div>
            <div class="sim-result-score">${simState.homeScore} - ${simState.awayScore}</div>
            <div class="sim-result-scorers">${scorersHTML || '<em>No goals scored</em>'}</div>
            ${cardsHTML}
            <div style="margin-top:12px; font-size:0.85rem; color:#888;">
                Possession: <span style="color:${simState.homeTeam.color}">${homePct}%</span> - <span style="color:${simState.awayTeam.color}">${awayPct}%</span>
            </div>
            <button class="sim-result-btn" onclick="confirmSimResult()">✅ Confirm & Save Result</button>
        </div>
    `;
    container.style.position = 'relative';
    container.appendChild(resultOverlay);
}

// ---- CONFIRM & SAVE ----
function confirmSimResult() {
    if (!simState) return;

    // Mark red-carded players as suspended for next match
    simState.cards.home.forEach(c => {
        if (c.type === 'red') {
            const player = simState.homeTeam.players.find(p => p.name === c.player.name);
            if (player) player.suspended = true;
        }
    });
    simState.cards.away.forEach(c => {
        if (c.type === 'red') {
            const player = simState.awayTeam.players.find(p => p.name === c.player.name);
            if (player) player.suspended = true;
        }
    });

    const result = {
        homeScore: simState.homeScore,
        awayScore: simState.awayScore,
        goalScorers: simState.goalScorers,
        assisters: simState.assisters,
        cards: simState.cards,
        events: simState.events
    };

    if (simState.onFinish) {
        simState.onFinish(simState);
    }

    closeMatchSimulation();
}

// ---- INTEGRATION: Launch sim for league match ----
function simulateNextMatchVisual() {
    // Find the next unplayed match dynamically
    currentMatchIndex = fixtures.findIndex(f => !f.played);
    if (currentMatchIndex === -1) return;
    const match = fixtures[currentMatchIndex];

    openMatchSimulation(match.home, match.away, {
        mode: 'mid',
        isKnockout: false,
        onResult: (result) => {
            match.homeScore = result.homeScore;
            match.awayScore = result.awayScore;
            match.played = true;

            // Stats are already updated on player objects during simulation (goals, assists, cards, passes)
            // We just need to update team stats
            updateTeamStats(match);
            
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
            if (typeof onManagerPostMatchUpdate === 'function') onManagerPostMatchUpdate(match);
            if (typeof processTransferMarketAfterMatch === 'function') processTransferMarketAfterMatch();
            if (typeof managerWeeklyTick === 'function') managerWeeklyTick();
            if (typeof evaluateBoardObjectives === 'function') evaluateBoardObjectives();
            checkSeasonEnd();
        }
    });
}

// ---- INTEGRATION: Launch sim for knockout match ----
function simulateKnockoutMatchVisual() {
    if (!knockoutMatches || knockoutStage >= knockoutMatches.length) return;
    const m = knockoutMatches[knockoutStage];

    openMatchSimulation(m.home, m.away, {
        mode: 'mid',
        isKnockout: true,
        onResult: (result) => {
            if (result.homeScore === result.awayScore) {
                // Draw in knockout — launch penalty shootout popup
                openPenaltyShootout(m.home, m.away, result.homeScore, result.awayScore, (penResult) => {
                    saveKnockoutResultVisual(m, result.homeScore, result.awayScore, penResult);
                    if (typeof onManagerPostMatchUpdate === 'function') onManagerPostMatchUpdate({ home: m.home, away: m.away, homeScore: result.homeScore, awayScore: result.awayScore });
                    if (typeof processTransferMarketAfterMatch === 'function') processTransferMarketAfterMatch();
                    renderNextKnockoutMatch();
                });
            } else {
                saveKnockoutResultVisual(m, result.homeScore, result.awayScore, null);
                if (typeof onManagerPostMatchUpdate === 'function') onManagerPostMatchUpdate({ home: m.home, away: m.away, homeScore: result.homeScore, awayScore: result.awayScore });
                if (typeof processTransferMarketAfterMatch === 'function') processTransferMarketAfterMatch();
                renderNextKnockoutMatch();
            }
        }
    });
}

// Knockout result save that skips distributePlayerStats (already done during visual sim)
function saveKnockoutResultVisual(m, homeScore, awayScore, penaltyResult) {
    let penaltyNote = '';
    let displayHome = homeScore;
    let displayAway = awayScore;
    if (penaltyResult) {
        penaltyNote = ` (Penalties: ${penaltyResult.homePenScore}-${penaltyResult.awayPenScore})`;
    }

    let winner;
    if (homeScore !== awayScore) {
        winner = homeScore > awayScore ? m.home : m.away;
    } else if (penaltyResult) {
        winner = penaltyResult.homePenScore > penaltyResult.awayPenScore ? m.home : m.away;
    } else {
        winner = Math.random() < 0.5 ? m.home : m.away;
    }

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

    // NOTE: No distributePlayerStats call — visual sim already tracked stats

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

// ============================================
// PENALTY SHOOTOUT POPUP
// ============================================
function openPenaltyShootout(homeTeam, awayTeam, matchHomeScore, matchAwayScore, onComplete) {
    // Pick 5+ penalty takers per team (prefer FWD/MID, higher rating)
    const pickTakers = (team) => {
        const sorted = [...team.players].sort((a, b) => {
            const posWeight = { FWD: 4, MID: 3, DEF: 2, GK: 1 };
            return (posWeight[b.position] || 2) - (posWeight[a.position] || 2) || b.rating - a.rating;
        });
        return sorted.slice(0, Math.max(5, sorted.length));
    };

    const homeTakers = pickTakers(homeTeam);
    const awayTakers = pickTakers(awayTeam);

    // Shootout state
    const penState = {
        homeTeam,
        awayTeam,
        homeTakers,
        awayTakers,
        kicks: [],          // { round, side, player, scored, decided? }
        homeGoals: 0,
        awayGoals: 0,
        currentRound: 1,
        currentSide: 'home', // home kicks first in each round
        finished: false,
        winner: null,
        onComplete,
        matchHomeScore,
        matchAwayScore,
        animating: false,
        autoPlayTimer: null
    };

    // Create overlay
    const overlay = document.createElement('div');
    overlay.className = 'penalty-overlay';
    overlay.id = 'penaltyOverlay';
    overlay.innerHTML = `<div class="penalty-container" id="penaltyContainer"></div>`;
    document.body.appendChild(overlay);

    // Store state globally for rendering
    window._penState = penState;

    renderPenaltyShootout();

    // Start auto-play after a short delay
    setTimeout(() => {
        autoPlayNextKick();
    }, 800);
}

function renderPenaltyShootout() {
    const ps = window._penState;
    if (!ps) return;
    const container = document.getElementById('penaltyContainer');
    if (!container) return;

    // Build kick rows (up to 5 base rounds + sudden death)
    const maxRounds = Math.max(5, ps.currentRound);
    let kicksHTML = '';
    for (let r = 1; r <= maxRounds; r++) {
        const homeKick = ps.kicks.find(k => k.round === r && k.side === 'home');
        const awayKick = ps.kicks.find(k => k.round === r && k.side === 'away');
        const isCurrent = r === ps.currentRound && !ps.finished;

        const homeClass = homeKick ? (homeKick.scored ? 'scored' : 'missed') : (isCurrent && ps.currentSide === 'home' ? 'current' : 'waiting');
        const awayClass = awayKick ? (awayKick.scored ? 'scored' : 'missed') : (isCurrent && ps.currentSide === 'away' ? 'current' : 'waiting');

        const homeIcon = homeKick ? (homeKick.scored ? '✅' : '❌') : (isCurrent && ps.currentSide === 'home' ? '⚽' : '•');
        const awayIcon = awayKick ? (awayKick.scored ? '✅' : '❌') : (isCurrent && ps.currentSide === 'away' ? '⚽' : '•');

        const homeName = homeKick ? homeKick.player.name : (isCurrent && ps.currentSide === 'home' ? getNextTaker(ps, 'home').name : '');
        const awayName = awayKick ? awayKick.player.name : (isCurrent && ps.currentSide === 'away' ? getNextTaker(ps, 'away').name : '');

        const roundLabel = r <= 5 ? r : `SD${r - 5}`;

        kicksHTML += `<div class="penalty-kick-row">
            <div class="penalty-kick-cell home ${homeClass}">
                <span class="penalty-kick-name">${homeName}</span>
                <span class="penalty-kick-icon">${homeIcon}</span>
            </div>
            <div class="penalty-kick-num">${roundLabel}</div>
            <div class="penalty-kick-cell away ${awayClass}">
                <span class="penalty-kick-icon">${awayIcon}</span>
                <span class="penalty-kick-name">${awayName}</span>
            </div>
        </div>`;
    }

    let statusText = '';
    if (ps.finished) {
        const winnerName = ps.winner === 'home' ? ps.homeTeam.name : ps.awayTeam.name;
        statusText = `<div class="penalty-status winner">🏆 ${winnerName} wins the shootout!</div>`;
    } else {
        const currentTeam = ps.currentSide === 'home' ? ps.homeTeam.name : ps.awayTeam.name;
        const currentPlayer = getNextTaker(ps, ps.currentSide);
        statusText = `<div class="penalty-status">${currentPlayer.name} (${currentTeam}) steps up...</div>`;
    }

    container.innerHTML = `
        <div class="penalty-title">⚽ PENALTY SHOOTOUT</div>
        <div class="penalty-subtitle">${ps.matchHomeScore} - ${ps.matchAwayScore} after 90 minutes</div>

        <div class="penalty-teams">
            <div class="penalty-team-name" style="color:${ps.homeTeam.color}">${ps.homeTeam.name}</div>
            <div class="penalty-vs">vs</div>
            <div class="penalty-team-name" style="color:${ps.awayTeam.color}">${ps.awayTeam.name}</div>
        </div>

        <div class="penalty-score-display">
            <div class="penalty-score-num" style="color:${ps.homeTeam.color}">${ps.homeGoals}</div>
            <div class="penalty-score-sep">-</div>
            <div class="penalty-score-num" style="color:${ps.awayTeam.color}">${ps.awayGoals}</div>
        </div>

        <div class="penalty-kicks-grid">${kicksHTML}</div>

        ${statusText}

        ${ps.finished ? `<button onclick="closePenaltyShootout()" style="width:100%; margin-top:15px;">✅ Continue</button>` : `
        <div style="display:flex; gap:10px; margin-top:10px;">
            <button onclick="skipPenaltyShootout()" style="flex:1; background:#1a4371; color:#ccc; border:1px solid #4a678f; font-size:0.85rem;">⚡ Skip to Result</button>
        </div>`}
    `;
}

function getNextTaker(ps, side) {
    const takers = side === 'home' ? ps.homeTakers : ps.awayTakers;
    const kicksTaken = ps.kicks.filter(k => k.side === side).length;
    return takers[kicksTaken % takers.length];
}

function autoPlayNextKick() {
    const ps = window._penState;
    if (!ps || ps.finished) return;

    const player = getNextTaker(ps, ps.currentSide);

    // Calculate score probability based on player rating
    const baseChance = 70 + ((player.rating - 60) / 40) * 15; // 70% for 60 rated, 85% for 99 rated
    const scored = Math.random() * 100 < baseChance;

    if (scored) {
        if (ps.currentSide === 'home') ps.homeGoals++;
        else ps.awayGoals++;
    }

    ps.kicks.push({
        round: ps.currentRound,
        side: ps.currentSide,
        player: player,
        scored: scored
    });

    // Advance to next kick
    if (ps.currentSide === 'home') {
        ps.currentSide = 'away';
    } else {
        // Both teams have kicked this round, check if decided
        ps.currentSide = 'home';
        
        if (ps.currentRound <= 5) {
            // Check early decision in regulation rounds
            const roundsLeft = 5 - ps.currentRound;
            // Can home team still catch up / can away team?
            if (ps.homeGoals > ps.awayGoals + roundsLeft) {
                ps.finished = true;
                ps.winner = 'home';
            } else if (ps.awayGoals > ps.homeGoals + roundsLeft) {
                ps.finished = true;
                ps.winner = 'away';
            } else if (ps.currentRound === 5 && ps.homeGoals !== ps.awayGoals) {
                // After 5 rounds with different scores
                ps.finished = true;
                ps.winner = ps.homeGoals > ps.awayGoals ? 'home' : 'away';
            }
        } else {
            // Sudden death: if scores differ after both kick, it's decided
            if (ps.homeGoals !== ps.awayGoals) {
                ps.finished = true;
                ps.winner = ps.homeGoals > ps.awayGoals ? 'home' : 'away';
            }
        }
        ps.currentRound++;
    }

    // Also check after home kick in regulation if away can't catch up
    if (!ps.finished && ps.currentSide === 'away' && ps.currentRound <= 5) {
        const awayKicksDone = ps.kicks.filter(k => k.side === 'away').length;
        const awayRoundsLeft = 5 - awayKicksDone;
        if (ps.homeGoals > ps.awayGoals + awayRoundsLeft) {
            // Home already uncatchable after their kick
            ps.finished = true;
            ps.winner = 'home';
        }
    }
    // Check if away is ahead and home can't catch up
    if (!ps.finished && ps.currentSide === 'home' && ps.currentRound <= 6) {
        const homeKicksDone = ps.kicks.filter(k => k.side === 'home').length;
        const homeRoundsLeft = 5 - homeKicksDone;
        if (homeRoundsLeft >= 0 && ps.awayGoals > ps.homeGoals + homeRoundsLeft) {
            ps.finished = true;
            ps.winner = 'away';
        }
    }

    // Safety: sudden death cap
    if (ps.currentRound > 20 && !ps.finished) {
        ps.finished = true;
        ps.winner = 'home'; // Just pick one after 20 rounds
    }

    renderPenaltyShootout();

    if (!ps.finished) {
        ps.autoPlayTimer = setTimeout(() => autoPlayNextKick(), 1200);
    }
}

function skipPenaltyShootout() {
    const ps = window._penState;
    if (!ps || ps.finished) return;

    // Clear auto-play timer
    if (ps.autoPlayTimer) clearTimeout(ps.autoPlayTimer);

    // Resolve all remaining kicks instantly
    while (!ps.finished) {
        const player = getNextTaker(ps, ps.currentSide);
        const baseChance = 70 + ((player.rating - 60) / 40) * 15;
        const scored = Math.random() * 100 < baseChance;
        if (scored) {
            if (ps.currentSide === 'home') ps.homeGoals++;
            else ps.awayGoals++;
        }
        ps.kicks.push({ round: ps.currentRound, side: ps.currentSide, player: player, scored: scored });

        if (ps.currentSide === 'home') {
            ps.currentSide = 'away';
        } else {
            ps.currentSide = 'home';
            if (ps.currentRound <= 5) {
                const roundsLeft = 5 - ps.currentRound;
                if (ps.homeGoals > ps.awayGoals + roundsLeft || ps.awayGoals > ps.homeGoals + roundsLeft) {
                    ps.finished = true;
                    ps.winner = ps.homeGoals > ps.awayGoals ? 'home' : 'away';
                } else if (ps.currentRound === 5 && ps.homeGoals !== ps.awayGoals) {
                    ps.finished = true;
                    ps.winner = ps.homeGoals > ps.awayGoals ? 'home' : 'away';
                }
            } else {
                if (ps.homeGoals !== ps.awayGoals) {
                    ps.finished = true;
                    ps.winner = ps.homeGoals > ps.awayGoals ? 'home' : 'away';
                }
            }
            ps.currentRound++;
        }
        if (ps.currentRound > 20 && !ps.finished) {
            ps.finished = true;
            ps.winner = 'home';
        }
    }

    renderPenaltyShootout();
}

function closePenaltyShootout() {
    const ps = window._penState;
    if (!ps) return;
    if (ps.autoPlayTimer) clearTimeout(ps.autoPlayTimer);

    const penResult = {
        homePenScore: ps.homeGoals,
        awayPenScore: ps.awayGoals,
        kicks: ps.kicks,
        winner: ps.winner
    };

    const overlay = document.getElementById('penaltyOverlay');
    if (overlay) overlay.remove();

    if (ps.onComplete) ps.onComplete(penResult);
    window._penState = null;
}
