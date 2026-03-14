// =============================================
// MONEY + MARKET VALUE SYSTEM
// =============================================

const POSITION_MARKET_MULTIPLIER = {
	GK: 0.95,
	DEF: 1.02,
	MID: 1.08,
	FWD: 1.15
};

const TEAM_FINANCE_BASE = {
	minBalance: 25000000,
	maxBalance: 280000000,
	baseWageBudget: 900000,
	baseTransferBudget: 14000000
};

function clampMoneyValue(v, min, max) {
	return Math.max(min, Math.min(max, v));
}

function getPositionMarketMultiplier(position) {
	return POSITION_MARKET_MULTIPLIER[position] || 1.0;
}

function getTeamAverageRating(team) {
	if (!team || !Array.isArray(team.players) || team.players.length === 0) return 70;
	return team.players.reduce((s, p) => s + (p.rating || 70), 0) / team.players.length;
}

function computeTeamPowerIndex(team) {
	const avg = getTeamAverageRating(team);
	const points = team?.stats?.points || 0;
	const gd = (team?.stats?.goalsFor || 0) - (team?.stats?.goalsAgainst || 0);
	return avg * 0.7 + points * 0.8 + gd * 0.4;
}

function estimatePlayerDemand(player, team) {
	const rating = player.rating || 70;
	const form = player.form ?? 50;
	const relation = player.relationWithManager ?? 55;
	const age = player.age || randomInt(18, 33);
	const teamPower = computeTeamPowerIndex(team);

	// Demand rises with form + rating, drops with high relation and age
	const demand =
		(rating - 60) * 0.9 +
		(form - 50) * 0.6 +
		(60 - relation) * 0.35 +
		(24 - Math.min(age, 24)) * 0.4 +
		Math.max(0, (teamPower - 70) * 0.2) +
		randomInt(-4, 4);

	return clampMoneyValue(Math.round(25 + demand), 5, 99);
}

function calculatePlayerMarketValue(player, team) {
	const rating = player.rating || 70;
	const posMult = getPositionMarketMultiplier(player.position);
	const age = player.age || 25;
	const form = player.form ?? 50;
	const demand = player.transferDemand ?? estimatePlayerDemand(player, team);
	const relation = player.relationWithManager ?? 55;

	const agePeak = 26;
	const agePenalty = Math.max(0, Math.abs(age - agePeak) - 2) * 0.035;
	const ageFactor = clampMoneyValue(1.05 - agePenalty, 0.72, 1.12);
	const formFactor = 0.88 + (form / 100) * 0.35;
	const demandFactor = 0.85 + (demand / 100) * 0.6;
	const relationFactor = relation < 45 ? 0.92 : relation > 75 ? 1.05 : 1.0;

	// Strong nonlinear OVR curve with superstar escalation
	let base = Math.pow(rating, 2.32) * 1450;
	if (rating >= 90) base *= 1.9;
	if (rating >= 93) base *= 1.45;
	if (rating >= 96) base *= 1.35;

	const legendBoostNames = ["lionel messi", "cristiano ronaldo"];
	const isLegendBoost = legendBoostNames.includes((player.name || "").toLowerCase());
	if (isLegendBoost) base *= 1.75;

	let value = base * posMult * ageFactor * formFactor * demandFactor * relationFactor;

	// Ensure high-rated players are expensive enough
	if (rating >= 90) {
		const floor = Math.round(100000000 * posMult * (0.94 + form / 240) * (0.94 + demand / 230));
		value = Math.max(value, floor);
	}
	if (rating >= 95) {
		const floor = Math.round(180000000 * posMult * (0.94 + form / 220));
		value = Math.max(value, floor);
	}
	if (isLegendBoost) {
		value = Math.max(value, 220000000);
	}

	return Math.max(450000, Math.round(value));
}

function ensurePlayerEconomicFields(player, team) {
	if (!player) return;
	if (typeof player.age !== "number") player.age = randomInt(18, 34);
	if (typeof player.contractYears !== "number") player.contractYears = randomInt(1, 5);
	if (typeof player.form !== "number") player.form = randomInt(45, 60);
	if (typeof player.relationWithManager !== "number") player.relationWithManager = randomInt(45, 72);
	if (typeof player.transferDemand !== "number") player.transferDemand = estimatePlayerDemand(player, team);

	const value = calculatePlayerMarketValue(player, team);
	player.marketValue = value;
	player.wageDemand = Math.round((value / 1200) + ((player.rating || 70) * 120));
}

function ensureTeamFinanceProfile(team) {
	if (!team) return;

	if (!team.finance) {
		const teamPower = computeTeamPowerIndex(team);
		const strengthFactor = clampMoneyValue(teamPower / 95, 0.72, 1.8);
		const baseBalance = Math.round(TEAM_FINANCE_BASE.minBalance + (TEAM_FINANCE_BASE.maxBalance - TEAM_FINANCE_BASE.minBalance) * Math.random() * 0.55 * strengthFactor);
		const avgRating = getTeamAverageRating(team);

		team.finance = {
			balance: baseBalance,
			transferBudget: Math.round(TEAM_FINANCE_BASE.baseTransferBudget * strengthFactor + avgRating * 180000),
			wageBudgetWeekly: Math.round(TEAM_FINANCE_BASE.baseWageBudget * strengthFactor + avgRating * 14000),
			sponsorIncomeWeekly: Math.round(90000 + avgRating * 2200 + randomInt(0, 85000)),
			expensesWeekly: Math.round(150000 + avgRating * 4200 + randomInt(0, 120000)),
			moraleBudgetFactor: 1.0
		};
	}

	if (!team.form) {
		team.form = {
			pointsLast5: 0,
			streak: 0,
			trend: 0,
			matchesTracked: 0
		};
	}

	if (typeof team.morale !== "number") team.morale = randomInt(50, 65);
}

function initializeMoneySystemForTeams(teamList) {
	if (!Array.isArray(teamList)) return;

	teamList.forEach(team => {
		ensureTeamFinanceProfile(team);
		if (Array.isArray(team.players)) {
			team.players.forEach(p => ensurePlayerEconomicFields(p, team));
		}
	});
}

function getTeamFormScore(team) {
	if (!team || !team.form) return 50;
	const tracked = team.form.matchesTracked || 0;
	const sampleAdj = tracked < 5 ? tracked / 5 : 1;
	const pointsFactor = clampMoneyValue((team.form.pointsLast5 || 0) / 15, 0, 1);
	const streakAdj = clampMoneyValue((team.form.streak || 0) / 8, -1, 1);
	return Math.round(clampMoneyValue((42 + pointsFactor * 45 + streakAdj * 13) * sampleAdj + 40 * (1 - sampleAdj), 1, 99));
}

function applyTeamFormEffects(team) {
	if (!team) return;
	ensureTeamFinanceProfile(team);

	const formScore = getTeamFormScore(team);
	const moraleShift = Math.round((formScore - 50) / 7);
	team.morale = clampMoneyValue((team.morale || 55) + moraleShift, 1, 99);

	const moraleFactor = 0.85 + (team.morale / 100) * 0.35;
	team.finance.moraleBudgetFactor = moraleFactor;

	if (Array.isArray(team.players)) {
		team.players.forEach(p => {
			p.form = clampMoneyValue((p.form ?? 50) + Math.round((formScore - 50) / 10) + randomInt(-2, 2), 1, 99);
			p.relationWithManager = clampMoneyValue((p.relationWithManager ?? 55) + Math.round((team.morale - 55) / 16) + randomInt(-1, 1), 1, 99);
			p.transferDemand = estimatePlayerDemand(p, team);
			p.marketValue = calculatePlayerMarketValue(p, team);
			p.wageDemand = Math.round((p.marketValue / 1200) + ((p.rating || 70) * 120));
		});
	}
}

function updateTeamFormAfterMatch(team, goalsFor, goalsAgainst) {
	ensureTeamFinanceProfile(team);

	let pts = 0;
	if (goalsFor > goalsAgainst) pts = 3;
	else if (goalsFor === goalsAgainst) pts = 1;

	team.form.pointsLast5 = clampMoneyValue((team.form.pointsLast5 || 0) + pts, 0, 25);
	team.form.matchesTracked = clampMoneyValue((team.form.matchesTracked || 0) + 1, 0, 2000);

	if (goalsFor > goalsAgainst) {
		team.form.streak = (team.form.streak || 0) >= 0 ? (team.form.streak || 0) + 1 : 1;
	} else if (goalsFor < goalsAgainst) {
		team.form.streak = (team.form.streak || 0) <= 0 ? (team.form.streak || 0) - 1 : -1;
	} else {
		team.form.streak = 0;
	}

	team.form.trend = clampMoneyValue((team.form.trend || 0) + (goalsFor - goalsAgainst), -25, 25);
}

function updateTeamEconomyAfterMatch(match) {
	if (!match || !match.home || !match.away) return;

	const h = match.home;
	const a = match.away;
	const hs = match.homeScore ?? 0;
	const as = match.awayScore ?? 0;

	ensureTeamFinanceProfile(h);
	ensureTeamFinanceProfile(a);

	updateTeamFormAfterMatch(h, hs, as);
	updateTeamFormAfterMatch(a, as, hs);

	const homeForm = getTeamFormScore(h);
	const awayForm = getTeamFormScore(a);

	const homeGate = Math.round(90000 + (h.morale || 55) * 1600 + homeForm * 900);
	const awayGate = Math.round(70000 + (a.morale || 55) * 1200 + awayForm * 700);

	const homePerformanceBonus = hs > as ? 140000 : hs === as ? 40000 : -90000;
	const awayPerformanceBonus = as > hs ? 140000 : hs === as ? 40000 : -90000;

	h.finance.balance = Math.max(0, h.finance.balance + homeGate + homePerformanceBonus + h.finance.sponsorIncomeWeekly - h.finance.expensesWeekly);
	a.finance.balance = Math.max(0, a.finance.balance + awayGate + awayPerformanceBonus + a.finance.sponsorIncomeWeekly - a.finance.expensesWeekly);

	// Transfer budgets react to form and current cash
	h.finance.transferBudget = Math.round(clampMoneyValue(h.finance.transferBudget * 0.96 + h.finance.balance * 0.04, 1000000, 900000000));
	a.finance.transferBudget = Math.round(clampMoneyValue(a.finance.transferBudget * 0.96 + a.finance.balance * 0.04, 1000000, 900000000));

	applyTeamFormEffects(h);
	applyTeamFormEffects(a);
}

window.getPositionMarketMultiplier = getPositionMarketMultiplier;
window.calculatePlayerMarketValue = calculatePlayerMarketValue;
window.estimatePlayerDemand = estimatePlayerDemand;
window.ensurePlayerEconomicFields = ensurePlayerEconomicFields;
window.ensureTeamFinanceProfile = ensureTeamFinanceProfile;
window.initializeMoneySystemForTeams = initializeMoneySystemForTeams;
window.getTeamFormScore = getTeamFormScore;
window.applyTeamFormEffects = applyTeamFormEffects;
window.updateTeamEconomyAfterMatch = updateTeamEconomyAfterMatch;

