let wordList = [];
let wordSet = new Set();
let chain = [];
let forcedPrefix = '';

const urlParams = new URLSearchParams(window.location.search);
const lobbyId = urlParams.get('lobbyId');
const playerId = parseInt(urlParams.get('playerId'), 10);

// 🔐 Validate query params
if (!lobbyId || isNaN(playerId)) {
    alert('Missing lobby info. Redirecting to lobby...');
    window.location.href = 'lobby.html';
}

const inputEl = document.getElementById('wordInput');
const checkIcon = document.getElementById('checkIcon');
const suggestionContainer = document.getElementById('suggestionContainer');
const wordChainEl = document.getElementById('wordChain');
const chainCounter = document.getElementById('chainCounter');

// 🔃 Load word list
fetch('words_alpha.txt')
    .then(res => res.text())
    .then(text => {
        wordList = text.split('\n').map(w => w.trim().toLowerCase()).filter(Boolean);
        wordSet = new Set(wordList);
    });

// ✏️ Handle input typing
inputEl.addEventListener('input', () => {
    enforcePrefix();

    const rawInput = inputEl.value.toLowerCase().trim();
    const userPart = forcedPrefix ? rawInput.slice(1) : rawInput;
    const fullInput = forcedPrefix + userPart;

    if (wordSet.has(fullInput) && followsChain(fullInput) && fullInput.length > 1) {
        checkIcon.classList.add('visible');
    } else {
        checkIcon.classList.remove('visible');
    }

    if (userPart && wordList.length) {
        const closest = findClosestWord(userPart);
        showSuggestion(forcedPrefix + closest);
    } else {
        suggestionContainer.innerHTML = '';
    }
});

// ⌨️ Handle keypress (Enter)
inputEl.addEventListener('keydown', e => {
    if (forcedPrefix && inputEl.selectionStart === 0 && ['Backspace', 'Delete'].includes(e.key)) {
        e.preventDefault();
    }

    if (e.key === 'Enter') {
        const value = inputEl.value.toLowerCase().trim();
        const isValid = value.length > 1 && checkIcon.classList.contains('visible');

        if (!isValid || chain.length >= 5) {
            e.preventDefault();
            return;
        }

        addToChain(value);
        inputEl.value = '';
        checkIcon.classList.remove('visible');
        suggestionContainer.innerHTML = '';
        updateForcedPrefix(value[value.length - 1]);
    }
});

// 🔒 Force first letter
function enforcePrefix() {
    if (!forcedPrefix) return;
    const val = inputEl.value;
    if (!val.startsWith(forcedPrefix)) {
        const suffix = val.slice(forcedPrefix.length);
        inputEl.value = forcedPrefix + suffix;
        inputEl.setSelectionRange(inputEl.value.length, inputEl.value.length);
    }
}

// 🔁 Chain rule validation
function followsChain(word) {
    if (chain.length === 0) return true;
    const lastWord = chain[chain.length - 1];
    return word[0] === lastWord[lastWord.length - 1];
}

// ➕ Add to chain and update UI
function addToChain(word) {
    if (chain.length >= 5) return;

    chain.push(word);

    const li = document.createElement('li');
    li.textContent = word;
    wordChainEl.appendChild(li);
    updateChainCounter();

    if (chain.length === 5) {
        inputEl.disabled = true;
        inputEl.placeholder = 'Chain complete';
        submitWordsToLobby();
    }
}

// 🔢 Update counter text
function updateChainCounter() {
    chainCounter.textContent = `${chain.length} / 5`;
    chainCounter.classList.toggle('full', chain.length === 5);
}

// 🧠 Suggest closest word
function showSuggestion(word) {
    suggestionContainer.innerHTML = '';
    if (!word) return;

    const btn = document.createElement('div');
    btn.className = 'suggestion';
    btn.innerText = `Did you mean: ${word}?`;
    btn.onclick = () => {
        inputEl.value = word;
        inputEl.dispatchEvent(new Event('input'));
    };

    suggestionContainer.appendChild(btn);
}

// 🔎 Closest match via Levenshtein
function findClosestWord(input) {
    let best = '';
    let minDist = Infinity;
    for (const word of wordList) {
        const dist = levenshtein(input, word);
        if (dist < minDist) {
            best = word;
            minDist = dist;
            if (dist === 0) break;
        }
    }
    return best;
}

// 📬 Submit chain to server
async function submitWordsToLobby() {
    try {
        const res = await fetch('http://localhost:3000/submit-words', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                lobbyId,
                playerId,
                words: chain
            })
        });

        const data = await res.json();
        if (data.status === 'ok') {
            alert('✅ Your words were submitted. Waiting for opponent...');
            setInterval(async () => {
                try {
                    const res = await fetch(`http://localhost:3000/guess-state?lobbyId=${lobbyId}&playerId=${playerId}`);
                    const data = await res.json();

                    if (data.playersReady >= 2) {
                        window.location.href = `game.html?lobbyId=${lobbyId}&playerId=${playerId}`;
                    }
                } catch (err) {
                    console.error('Polling error:', err);
                }
            }, 1000);
        } else {
            alert('❌ Submission error: ' + (data.error || 'Unknown issue'));
        }
    } catch (err) {
        console.error(err);
        alert('❌ Network error during word submission');
    }
}

// 🔡 Enforce prefix for future input
function updateForcedPrefix(letter) {
    forcedPrefix = letter;
    inputEl.value = letter;
    inputEl.setSelectionRange(inputEl.value.length, inputEl.value.length);
}

// 🔣 Levenshtein distance
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
