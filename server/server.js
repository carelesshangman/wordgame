const Fastify = require('fastify');
const fs = require('fs');
const path = require('path');
const cors = require('@fastify/cors');

const fastify = Fastify({ logger: true });
fastify.register(cors, { origin: true });

const words = new Set(
    fs.readFileSync(path.join(__dirname, 'words_alpha.txt'), 'utf-8')
        .split('\n')
        .map(w => w.trim().toLowerCase())
        .filter(Boolean)
);

const lobbies = {}; // { lobbyId: { players: [{ name, words }], state, turn, lastCorrectLetter } }

// 🔧 Create a new lobby
fastify.post('/create-lobby', async (req, reply) => {
    const lobbyId = Math.random().toString(36).substr(2, 6);
    lobbies[lobbyId] = {
        players: [],
        state: 'waiting',
        turn: 0,
        lastCorrectLetter: null
    };
    reply.send({ lobbyId });
});

// 👤 Join a lobby
fastify.post('/join-lobby', async (req, reply) => {
    const { lobbyId, playerName } = req.body;
    const lobby = lobbies[lobbyId];

    if (!lobby || lobby.players.length >= 2) {
        return reply.code(400).send({ error: 'Invalid or full lobby' });
    }

    const playerId = lobby.players.length;
    lobby.players.push({ name: playerName, words: [], guesses: [] });

    if (lobby.players.length === 2) {
        lobby.state = 'ready';
    }

    reply.send({ playerId });
});

// 🧠 Submit 5 secret words
fastify.post('/submit-words', async (req, reply) => {
    const { lobbyId, playerId, words: wordList } = req.body;
    const lobby = lobbies[lobbyId];
    const player = lobby?.players?.[playerId];

    if (!player || !Array.isArray(wordList) || wordList.length !== 5) {
        return reply.code(400).send({ error: 'Invalid word list' });
    }

    const lowerWords = wordList.map(w => w.toLowerCase());
    const valid = lowerWords.every(w => words.has(w));

    if (!valid) {
        return reply.code(400).send({ error: 'One or more invalid words' });
    }

    player.words = lowerWords;
    reply.send({ status: 'ok' });
});

// 🔁 Poll lobby state (used after joining)
fastify.get('/guess-state', async (req, reply) => {
    const { lobbyId, playerId } = req.query;
    const lobby = lobbies[lobbyId];

    if (!lobby) return reply.code(400).send({ error: 'Invalid lobby' });

    reply.send({
        turn: lobby.turn,
        lastCorrectLetter: lobby.lastCorrectLetter || '-',
        playersReady: lobby.players.length // change from: playersReady: lobby.players.filter(p => p.words.length === 5).length
    });

});

fastify.post('/guess', async (req, reply) => {
    const { lobbyId, playerId, guess } = req.body;
    const lobby = lobbies[lobbyId];

    if (!lobby || !lobby.players[playerId] || typeof guess !== 'string') {
        return reply.code(400).send({ error: 'Invalid request' });
    }

    if (lobby.state !== 'ready') {
        return reply.code(400).send({ error: 'Game not started yet' });
    }

    const player = lobby.players[playerId];
    const opponentId = 1 - playerId;
    const opponent = lobby.players[opponentId];

    if (lobby.turn !== playerId) {
        return reply.code(400).send({ error: 'Not your turn' });
    }

    const cleanGuess = guess.toLowerCase().trim();

    // Add the guess to player's history
    player.guesses = player.guesses || [];
    if (player.guesses.includes(cleanGuess)) {
        return reply.code(400).send({ error: 'You already guessed that' });
    }
    player.guesses.push(cleanGuess);

    let correct = false;

    if (opponent.words.includes(cleanGuess)) {
        // Remove the found word
        opponent.words = opponent.words.filter(w => w !== cleanGuess);
        correct = true;

        // Check win condition
        if (opponent.words.length === 0) {
            lobby.winner = playerId;
            lobby.state = 'ended';
        }
    }

    // Update turn regardless
    lobby.turn = opponentId;
    lobby.lastCorrectLetter = cleanGuess.at(-1) ?? null;

    reply.send({
        correct,
        nextTurn: lobby.turn,
        gameOver: lobby.state === 'ended',
        winner: lobby.winner ?? null
    });
});


fastify.listen({ port: 3000 }, () => {
    console.log('✅ Fastify server listening on http://localhost:3000');
});
