// Google Apps Script API URL
const APPS_SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbz8r1Beo5cAJzDxiKyylWh2ab9oT9c3YPIWBANg2jjiw2TGF9QIKl9HSnt64vCdvMJJ/exec';

async function postToGAS(action, payload) {
  const res = await fetch(APPS_SCRIPT_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action, payload })
  });
  return await res.json();
}

// 게임 상태 관리
class GameState {
    constructor() {
        this.currentUser = null;
        this.score = 0;
        this.timeLeft = 30;
        this.gameActive = false;
        this.goldenPotsHit = 0;
        this.gameInterval = null;
        this.timerInterval = null;
        this.requestCheckInterval = null;
    }
}

const gameState = new GameState();

// DOM 요소들
const elements = {
    loginScreen: document.getElementById('loginScreen'),
    gameScreen: document.getElementById('gameScreen'),
    username: document.getElementById('username'),
    password: document.getElementById('password'),
    loginBtn: document.getElementById('loginBtn'),
    loginCoins: document.getElementById('loginCoins'),
    gameCoins: document.getElementById('gameCoins'),
    requestCoinBtn: document.getElementById('requestCoinBtn'),
    score: document.getElementById('score'),
    timer: document.getElementById('timer'),
    backToLoginBtn: document.getElementById('backToLoginBtn'),
    rankingList: document.getElementById('rankingList'),
    coinRequestPopup: document.getElementById('coinRequestPopup'),
    coinRequestAcceptPopup: document.getElementById('coinRequestAcceptPopup'),
    gameOverPopup: document.getElementById('gameOverPopup'),
    particleContainer: document.getElementById('particleContainer')
};

// API 함수들 (모두 POST/JSON)
async function getUser(username) {
    const res = await postToGAS('getUser', { username });
    return res.user;
}

async function createUser(username, password) {
    return await postToGAS('createUser', { username, password });
}

async function updateUser(user) {
    return await postToGAS('updateUser', {
        username: user.username,
        coins: user.coins,
        totalScore: user.totalScore,
        goldenPotsHit: user.goldenPotsHit,
        gamesPlayed: user.gamesPlayed
    });
}

async function getAllUsers() {
    const res = await postToGAS('getAllUsers', {});
    return res.users;
}

async function saveGame(username, score, goldenPotsHit) {
    return await postToGAS('saveGame', { username, score, goldenPotsHit });
}

async function getRanking() {
    const res = await postToGAS('getRanking', {});
    return res.users;
}

async function saveCoinRequest(fromUser, toUser, message) {
    return await postToGAS('saveCoinRequest', { fromUser, toUser, message });
}

async function getCoinRequests(toUser) {
    const res = await postToGAS('getCoinRequests', { toUser });
    return res.requests;
}

async function updateCoinRequest(row, status) {
    return await postToGAS('updateCoinRequest', { row, status });
}

// 랭킹 시스템
class RankingSystem {
    static async getRankings() {
        return await getRanking();
    }
    static async updateRankings() {
        const rankings = await this.getRankings();
        const rankingList = document.getElementById('rankingList');
        rankingList.innerHTML = '';
        rankings.slice(0, 10).forEach((user, index) => {
            const rank = index + 1;
            const medal = rank <= 3 ? ['🥇', '🥈', '🥉'][rank - 1] : rank;
            const isTop3 = rank <= 3;
            const rankingItem = document.createElement('div');
            rankingItem.className = `ranking-item ${isTop3 ? 'top3' : ''}`;
            rankingItem.innerHTML = `
                <div class="rank ${isTop3 ? 'medal' : ''}">${medal}</div>
                <div class="username">${user.username}</div>
                <div class="score-info">
                    <div>${user.totalScore}점</div>
                    <div>황금: ${user.goldenPotsHit}개</div>
                    <div>게임: ${user.gamesPlayed}회</div>
                </div>
            `;
            rankingList.appendChild(rankingItem);
        });
    }
}

// 게임 로직
class GameLogic {
    static potDurations = [0.5, 1, 1.5, 2];
    static goldenPotChance = 0.1; // 10%
    static getRandomDuration() {
        return this.potDurations[Math.floor(Math.random() * this.potDurations.length)];
    }
    static isGoldenPot() {
        return Math.random() < this.goldenPotChance;
    }
    static getRandomBurnerIndex() {
        return Math.floor(Math.random() * 9);
    }
    static showPot(index, isGolden = false) {
        const burner = document.querySelector(`[data-index="${index}"]`);
        const normalPot = burner.querySelector('.normal-pot');
        const goldenPot = burner.querySelector('.golden-pot');
        if (isGolden) {
            goldenPot.style.display = 'block';
            normalPot.style.display = 'none';
        } else {
            normalPot.style.display = 'block';
            goldenPot.style.display = 'none';
        }
        return burner;
    }
    static hidePot(index) {
        const burner = document.querySelector(`[data-index="${index}"]`);
        const normalPot = burner.querySelector('.normal-pot');
        const goldenPot = burner.querySelector('.golden-pot');
        normalPot.style.display = 'none';
        goldenPot.style.display = 'none';
    }
    static createParticles(x, y) {
        for (let i = 0; i < 15; i++) {
            const particle = document.createElement('div');
            particle.className = 'particle';
            particle.style.left = x + 'px';
            particle.style.top = y + 'px';
            particle.style.setProperty('--x', (Math.random() * 100 - 50) + 'px');
            elements.particleContainer.appendChild(particle);
            setTimeout(() => {
                particle.remove();
            }, 1000);
        }
    }
    static async startGame() {
        if (gameState.currentUser.coins <= 0) {
            alert('코인이 부족합니다!');
            return;
        }
        // 코인 차감
        gameState.currentUser.coins--;
        await updateUser(gameState.currentUser);
        updateCoinDisplay();
        gameState.score = 0;
        gameState.timeLeft = 30;
        gameState.gameActive = true;
        gameState.goldenPotsHit = 0;
        updateScoreDisplay();
        updateTimerDisplay();
        for (let i = 0; i < 9; i++) {
            this.hidePot(i);
        }
        this.spawnNextPot();
        this.startTimer();
        await RankingSystem.updateRankings();
    }
    static spawnNextPot() {
        if (!gameState.gameActive) return;
        const index = this.getRandomBurnerIndex();
        const isGolden = this.isGoldenPot();
        const duration = isGolden ? 0.5 : this.getRandomDuration();
        const burner = this.showPot(index, isGolden);
        const clickHandler = async (e) => {
            e.stopPropagation();
            this.hidePot(index);
            burner.removeEventListener('click', clickHandler);
            if (isGolden) {
                gameState.score += 5;
                gameState.timeLeft += 5;
                gameState.goldenPotsHit++;
                gameState.currentUser.coins++;
                await updateUser(gameState.currentUser);
                updateCoinDisplay();
                const rect = burner.getBoundingClientRect();
                this.createParticles(rect.left + rect.width / 2, rect.top + rect.height / 2);
            } else {
                gameState.score += 1;
            }
            updateScoreDisplay();
            updateTimerDisplay();
            setTimeout(() => {
                this.spawnNextPot();
            }, 500);
        };
        burner.addEventListener('click', clickHandler);
        setTimeout(() => {
            this.hidePot(index);
            burner.removeEventListener('click', clickHandler);
            if (gameState.gameActive) {
                this.spawnNextPot();
            }
        }, duration * 1000);
    }
    static startTimer() {
        gameState.timerInterval = setInterval(() => {
            gameState.timeLeft -= 0.01;
            updateTimerDisplay();
            if (gameState.timeLeft <= 0) {
                this.endGame();
            }
        }, 10);
    }
    static async endGame() {
        gameState.gameActive = false;
        clearInterval(gameState.timerInterval);
        await saveGame(
            gameState.currentUser.username,
            gameState.score,
            gameState.goldenPotsHit
        );
        gameState.currentUser.totalScore = Number(gameState.currentUser.totalScore) + gameState.score;
        gameState.currentUser.goldenPotsHit = Number(gameState.currentUser.goldenPotsHit) + gameState.goldenPotsHit;
        gameState.currentUser.gamesPlayed = Number(gameState.currentUser.gamesPlayed) + 1;
        await updateUser(gameState.currentUser);
        document.getElementById('finalScore').textContent = gameState.score;
        document.getElementById('goldenPots').textContent = gameState.goldenPotsHit;
        document.getElementById('gameOverPopup').style.display = 'flex';
        await RankingSystem.updateRankings();
    }
}

// 코인 요청 시스템
class CoinRequestSystem {
    static async showRequestPopup() {
        document.getElementById('coinRequestPopup').style.display = 'flex';
    }
    static async sendRequest() {
        const targetUser = document.getElementById('requestTargetUser').value.trim();
        const message = document.getElementById('requestMessage').value.trim();
        if (!targetUser || !message) {
            alert('모든 필드를 입력해주세요.');
            return;
        }
        // 대상 사용자가 존재하는지 확인
        const targetUserData = await getUser(targetUser);
        if (!targetUserData) {
            alert('존재하지 않는 사용자입니다.');
            return;
        }
        await saveCoinRequest(gameState.currentUser.username, targetUser, message);
        document.getElementById('coinRequestPopup').style.display = 'none';
        document.getElementById('requestTargetUser').value = '';
        document.getElementById('requestMessage').value = '';
        alert('코인 요청이 전송되었습니다!');
    }
    static async checkForRequests() {
        if (!gameState.currentUser) return;
        const requests = await getCoinRequests(gameState.currentUser.username);
        requests.forEach(request => {
            this.showAcceptPopup(request);
        });
    }
    static showAcceptPopup(request) {
        const requestInfo = document.getElementById('requestInfo');
        requestInfo.innerHTML = `
            <p><strong>${request.fromUser}</strong>님이 코인을 요청했습니다.</p>
            <p>메시지: ${request.message}</p>
        `;
        const acceptBtn = document.getElementById('acceptRequestBtn');
        const rejectBtn = document.getElementById('rejectRequestBtn');
        acceptBtn.onclick = async () => {
            await this.acceptRequest(request);
            document.getElementById('coinRequestAcceptPopup').style.display = 'none';
        };
        rejectBtn.onclick = async () => {
            await this.rejectRequest(request);
            document.getElementById('coinRequestAcceptPopup').style.display = 'none';
        };
        document.getElementById('coinRequestAcceptPopup').style.display = 'flex';
    }
    static async acceptRequest(request) {
        await updateCoinRequest(request.row, 'accepted');
        // 양쪽 사용자에게 코인 지급
        const fromUserData = await getUser(request.fromUser);
        const toUserData = await getUser(request.toUser);
        if (fromUserData) {
            fromUserData.coins = Number(fromUserData.coins) + 5;
            await updateUser(fromUserData);
        }
        if (toUserData) {
            toUserData.coins = Number(toUserData.coins) + 5;
            await updateUser(toUserData);
            if (toUserData.username === gameState.currentUser.username) {
                gameState.currentUser.coins = toUserData.coins;
                updateCoinDisplay();
            }
        }
        alert('코인 요청이 수락되었습니다! 양쪽 모두 5코인이 지급되었습니다.');
    }
    static async rejectRequest(request) {
        await updateCoinRequest(request.row, 'rejected');
        alert('코인 요청이 거부되었습니다.');
    }
    static startRequestChecking() {
        gameState.requestCheckInterval = setInterval(() => {
            this.checkForRequests();
        }, 5000);
    }
}

// UI 업데이트 함수들
function updateScoreDisplay() {
    elements.score.textContent = gameState.score;
}
function updateTimerDisplay() {
    elements.timer.textContent = gameState.timeLeft.toFixed(2);
}
function updateCoinDisplay() {
    if (gameState.currentUser) {
        elements.loginCoins.textContent = gameState.currentUser.coins;
        elements.gameCoins.textContent = gameState.currentUser.coins;
    } else {
        elements.loginCoins.textContent = 0;
        elements.gameCoins.textContent = 0;
    }
}
function showScreen(screenId) {
    document.querySelectorAll('.screen').forEach(screen => {
        screen.classList.remove('active');
    });
    document.getElementById(screenId).classList.add('active');
}

// 이벤트 리스너들
document.addEventListener('DOMContentLoaded', async () => {
    console.log('뚝배기 팡팡! 스트레스 팡팡! 게임이 로드되었습니다!');
    // 로그인 버튼
    elements.loginBtn.addEventListener('click', async () => {
        const username = elements.username.value.trim();
        const password = elements.password.value.trim();
        if (!username || !password) {
            alert('사용자 이름과 비밀번호를 입력해주세요.');
            return;
        }
        let user = await getUser(username);
        if (!user) {
            await createUser(username, password);
            user = await getUser(username);
        } else {
            if (!user.password || user.password !== password) {
                alert('비밀번호가 일치하지 않습니다.');
                return;
            }
        }
        gameState.currentUser = user;
        updateCoinDisplay();
        showScreen('gameScreen');
        await RankingSystem.updateRankings();
        CoinRequestSystem.startRequestChecking();
        CoinRequestSystem.checkForRequests();
    });
    // 코인 요청 버튼
    elements.requestCoinBtn.addEventListener('click', () => {
        if (!gameState.currentUser) {
            alert('먼저 로그인해주세요.');
            return;
        }
        CoinRequestSystem.showRequestPopup();
    });
    // 코인 요청 보내기
    document.getElementById('sendRequestBtn').addEventListener('click', CoinRequestSystem.sendRequest);
    document.getElementById('cancelRequestBtn').addEventListener('click', () => {
        document.getElementById('coinRequestPopup').style.display = 'none';
    });
    // 메인으로 돌아가기
    elements.backToLoginBtn.addEventListener('click', () => {
        if (gameState.gameActive) {
            if (confirm('게임을 종료하시겠습니까?')) {
                GameLogic.endGame();
            } else {
                return;
            }
        }
        showScreen('loginScreen');
    });
    // 게임 오버 팝업 버튼들
    document.getElementById('playAgainBtn').addEventListener('click', () => {
        document.getElementById('gameOverPopup').style.display = 'none';
        GameLogic.startGame();
    });
    document.getElementById('backToMainBtn').addEventListener('click', () => {
        document.getElementById('gameOverPopup').style.display = 'none';
        showScreen('loginScreen');
    });
    // Enter 키로 로그인
    elements.username.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
            elements.loginBtn.click();
        }
    });
    elements.password.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
            elements.loginBtn.click();
        }
    });
});
// 게임 시작 버튼 (게임 화면에서)
document.addEventListener('click', async (e) => {
    if (e.target.id === 'startGameBtn' && !gameState.gameActive) {
        await GameLogic.startGame();
    }
});
