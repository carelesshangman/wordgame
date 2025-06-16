const urlParams = new URLSearchParams(window.location.search);
const lobbyId = urlParams.get('lobbyId');
const playerId = parseInt(urlParams.get('playerId'), 10);

const guessInput = document.getElementById('guessInput');
const guessCheck = document.getElementById('guessCheck');
const guessSuggestion = document.getElementById('guessSuggestion');
const yourGuesses = document.getElementById('yourGuesses');
const opponentGuesses = document.getElementById('opponentGuesses');
const turnBanner = document.getElementById('yourTurnBanner');
const opponentStatus = document.getElementById('opponentStatus');
const messageEl = document.getElementById('gameMessage');

function showMessage(msg) {
    if (messageEl) {
        messageEl.textContent = msg;
    }
}

let wordSet = new Set();
let isMyTurn = false;
let hasGuessed = false;

// Load words
fetch('words_alpha.txt')
    .then(res => res.text())
    .then(text => {
        wordSet = new Set(text.split('\n').map(w => w.trim().toLowerCase()));
    });

guessInput.addEventListener('input', () => {
    const word = guessInput.value.trim().toLowerCase();
    const valid = wordSet.has(word) && word.length > 1;
    guessCheck.classList.toggle('visible', valid);

    if (word.length > 1) {
        const close = findClosest(word);
        if (close) {
            guessSuggestion.innerText = `Did you mean: ${close}?`;
            guessSuggestion.onclick = () => {
                guessInput.value = close;
                guessInput.dispatchEvent(new Event('input'));
            };
        }
    } else {
        guessSuggestion.innerText = '';
    }
});

guessInput.addEventListener('keydown', e => {
    if (e.key === 'Enter') {
        const word = guessInput.value.trim().toLowerCase();
        if (!isMyTurn || hasGuessed || !wordSet.has(word) || word.length <= 1) return;

        submitGuess(word);
    }
});

function findClosest(input) {
    let minDist = Infinity;
    let best = '';
    for (let word of wordSet) {
        const dist = levenshtein(input, word);
        if (dist < minDist) {
            best = word;
            minDist = dist;
            if (dist === 0) break;
        }
    }
    return best;
}

function submitGuess(word) {
    hasGuessed = true;
    fetch('http://localhost:3000/guess', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ lobbyId, playerId, word })
    }).then(res => res.json())
        .then(data => {
            guessInput.value = '';
            guessCheck.classList.remove('visible');
            guessSuggestion.innerText = '';
        });
}

function updateUI(state) {
    isMyTurn = state.turn === playerId;
    turnBanner.style.display = isMyTurn && !hasGuessed ? 'block' : 'none';
    guessInput.disabled = !isMyTurn || hasGuessed;

    renderList(yourGuesses, state.yourGuesses || []);
    renderList(opponentGuesses, state.opponentGuesses || []);
    opponentStatus.innerText = state.opponentGuesses?.slice(-1)?.[0] || 'Waiting...';

    if (state.winner != null) {
        const youWon = state.winner === playerId;
        showMessage(youWon ? '🏆 You win!' : '😢 You lose...');
        guessInput.disabled = true;
        clearInterval(pollInterval);
    }
}

function renderList(el, items) {
    el.innerHTML = '';
    for (const word of items) {
        const li = document.createElement('li');
        li.textContent = word;
        el.appendChild(li);
    }
}

function pollState() {
    fetch(`http://localhost:3000/guess-state?lobbyId=${lobbyId}&playerId=${playerId}`)
        .then(res => res.json())
        .then(updateUI);
}

const pollInterval = setInterval(pollState, 1000);

// Levenshtein distance
function levenshtein(a, b) {
    const matrix = Array.from({ length: a.length + 1 }, () => []);
    for (let i = 0; i <= a.length; i++) matrix[i][0] = i;
    for (let j = 0; j <= b.length; j++) matrix[0][j] = j;

    for (let i = 1; i <= a.length; i++) {
        for (let j = 1; j <= b.length; j++) {
            matrix[i][j] = a[i - 1] === b[j - 1]
                ? matrix[i - 1][j - 1]
                : 1 + Math.min(matrix[i - 1][j], matrix[i][j - 1], matrix[i - 1][j - 1]);
        }
    }

    return matrix[a.length][b.length];
}
