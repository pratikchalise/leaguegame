// Helper to get player data
function getPlayerData(name) {
  const player = playerDatabase.find(p => p.name === name);
  if (player) return player;
  
  // Default for unknown players
  const randomPositions = ["GK", "DEF", "MID", "FWD"];
  return {
    name: name,
    rating: Math.floor(Math.random() * (85 - 60 + 1)) + 60,
    position: randomPositions[Math.floor(Math.random() * randomPositions.length)]
  };
}

// Helper to get rating
function getPlayerRating(name) {
  const player = playerDatabase.find(p => p.name === name);
  if (player) return player.rating;
  return Math.floor(Math.random() * (85 - 60 + 1)) + 60;
}

// Helper to get a random player from the database
function getRandomPlayerFromDB() {
  return playerDatabase[Math.floor(Math.random() * playerDatabase.length)];
}

// Helper to create a new player object with all stats
function createPlayerObject(name, rating, position) {
    let type = "Normal";
    // If no position provided, try to get from database
    const dbPlayer = playerDatabase.find(p => p.name === name);
    if (dbPlayer) {
        if (!position) position = dbPlayer.position;
        if (dbPlayer.type) type = dbPlayer.type;
    } else {
        if (!position) {
            // Random position for unknown players
            const randomPositions = ["GK", "DEF", "MID", "FWD"];
            position = randomPositions[Math.floor(Math.random() * randomPositions.length)];
        }
    }

    // Generate specific ratings based on overall rating and position
    const freekickRating = Math.min(99, Math.max(40, rating + Math.floor(Math.random() * 20) - 10));
    const passingRating = Math.min(99, Math.max(40, rating + Math.floor(Math.random() * 10) - 5));

    return {
        name: name,
        rating: rating,
        position: position || "MID",
        type: type,
        age: Math.floor(Math.random() * (34 - 18 + 1)) + 18,
        contractYears: Math.floor(Math.random() * (5 - 1 + 1)) + 1,
        form: Math.floor(Math.random() * (62 - 45 + 1)) + 45,
        relationWithManager: Math.floor(Math.random() * (72 - 48 + 1)) + 48,
        transferDemand: Math.floor(Math.random() * (60 - 25 + 1)) + 25,
        marketValue: 0,
        wageDemand: 0,
        freekickRating: freekickRating,
        passingRating: passingRating,
        goals: 0,
        assists: 0,
        yellowCards: 0,
        redCards: 0,
        penalties: 0,
        freekicks: 0,
        passesAttempted: 0,
        passesCompleted: 0
    };
}

// Function to add a new player to the database
function addNewPlayerToDB(name, rating) {
    if(playerDatabase.some(p => p.name === name)) {
        return false; // Player already exists
    }
    playerDatabase.push({ name, rating, position: "MID" });
    return true;
}

// Function to update player rating in DB
function updatePlayerRatingInDB(name, newRating) {
    const player = playerDatabase.find(p => p.name === name);
    if(player) {
        player.rating = newRating;
        return true;
    }
    return false;
}