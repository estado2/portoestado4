// JSONP 방식으로 Google Apps Script 호출
let currentUser = null;
let gameState = {
    isPlaying: false,
    score: 0,
    timeLeft: 30,
    goldenPunches: 0,
    currentPunch: null,
    gameTimer: null,
    punchTimer: null,
    nextPunchTimer: null
};

// Google Sheets API 설정 (JSONP 방식)
const GOOGLE_SHEETS_URL = 'https://script.google.com/macros/s/AKfycbwwl3404VfS919Niv1x-zdZZbcUyOq9zxQdFwksNC6Zv9QuHCZG54OX5neB2j-49HWgLw/exec';

// JSONP 콜백 함수
window.handleGoogleAppsScriptResponse = function(response) {
    console.log('Google Apps Script Response:', response);
    // 응답 처리 로직은 각 함수에서 구현
};

// JSONP 방식으로 Google Apps Script 호출
function callGoogleAppsScript(action, data, callback) {
    const script = document.createElement('script');
    const callbackName = 'callback_' + Date.now();
    
    // 전역 콜백 함수 생성
    window[callbackName] = function(response) {
        callback(response);
        delete window[callbackName];
        document.head.removeChild(script);
    };
    
    // URL 생성
    const params = new URLSearchParams({
        action: action,
        data: JSON.stringify(data),
        callback: callbackName
    });
    
    script.src = `${GOOGLE_SHEETS_URL}?${params.toString()}`;
    document.head.appendChild(script);
    
    // 타임아웃 설정
    setTimeout(() => {
        if (window[callbackName]) {
            callback({ success: false, message: 'Request timeout' });
            delete window[callbackName];
            if (document.head.contains(script)) {
                document.head.removeChild(script);
            }
        }
    }, 10000);
}

// DOM 요소들
const screens = {
    login: document.getElementById('loginScreen'),
    mainMenu: document.getElementById('mainMenu'),
    game: document.getElementById('gameScreen'),
    gameOver: document.getElementById('gameOverScreen')
};

const elements = {
    username: document.getElementById('username'),
    password: document.getElementById('password'),
    loginBtn: document.getElementById('loginBtn'),
    userDisplayName: document.getElementById('userDisplayName'),
    coinCount: document.getElementById('coinCount'),
    playGameBtn: document.getElementById('playGameBtn'),
    requestCoinBtn: document.getElementById('requestCoinBtn'),
    logoutBtn: document.getElementById('logoutBtn'),
    currentScore: document.getElementById('currentScore'),
    timeLeft: document.getElementById('timeLeft'),
    gameCoinCount: document.getElementById('gameCoinCount'),
    pauseBtn: document.getElementById('pauseBtn'),
    backToMenuBtn: document.getElementById('backToMenuBtn'),
    finalScore: document.getElementById('finalScore'),
    goldenPunches: document.getElementById('goldenPunches'),
    playAgainBtn: document.getElementById('playAgainBtn'),
    backToMenuFromGameOverBtn: document.getElementById('backToMenuFromGameOverBtn'),
    rankingList: document.getElementById('rankingList')
};

// 이벤트 리스너 등록
document.addEventListener('DOMContentLoaded', function() {
    setupEventListeners();
    loadRankings();
});

function setupEventListeners() {
    // 로그인
    elements.loginBtn.addEventListener('click', handleLogin);
    elements.username.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') handleLogin();
    });
    elements.password.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') handleLogin();
    });

    // 메인 메뉴
    elements.playGameBtn.addEventListener('click', startGame);
    elements.requestCoinBtn.addEventListener('click', showCoinRequestModal);
    elements.logoutBtn.addEventListener('click', logout);

    // 게임 화면
    elements.pauseBtn.addEventListener('click', pauseGame);
    elements.backToMenuBtn.addEventListener('click', backToMenu);

    // 게임 종료 화면
    elements.playAgainBtn.addEventListener('click', startGame);
    elements.backToMenuFromGameOverBtn.addEventListener('click', backToMenu);

    // 뚝배기 클릭 이벤트
    const burners = document.querySelectorAll('.burner');
    burners.forEach((burner, index) => {
        burner.addEventListener('click', () => hitPunch(index));
    });
}

// 화면 전환 함수
function showScreen(screenName) {
    Object.values(screens).forEach(screen => {
        screen.classList.remove('active');
    });
    screens[screenName].classList.add('active');
}

// 로그인 처리 (JSONP 방식)
function handleLogin() {
    const username = elements.username.value.trim();
    const password = elements.password.value.trim();

    if (!username || !password) {
        alert('이름과 비밀번호를 입력해주세요.');
        return;
    }

    if (password.length !== 4 || !/^\d{4}$/.test(password)) {
        alert('비밀번호는 4자리 숫자여야 합니다.');
        return;
    }

    callGoogleAppsScript('login', { username, password }, function(response) {
        if (response.success) {
            currentUser = {
                username: username,
                coins: response.coins || 5,
                totalScore: response.totalScore || 0,
                totalGames: response.totalGames || 0,
                goldenPunches: response.goldenPunches || 0
            };
            
            updateUserDisplay();
            showScreen('mainMenu');
        } else {
            alert(response.message || '로그인에 실패했습니다.');
        }
    });
}

// 사용자 정보 업데이트
function updateUserDisplay() {
    if (!currentUser) return;
    
    elements.userDisplayName.textContent = currentUser.username;
    elements.coinCount.textContent = currentUser.coins;
    elements.gameCoinCount.textContent = currentUser.coins;
}

// 게임 시작
function startGame() {
    if (!currentUser) {
        alert('로그인이 필요합니다.');
        return;
    }

    if (currentUser.coins <= 0) {
        alert('코인이 부족합니다. 코인을 요청해주세요.');
        return;
    }

    // 코인 차감
    currentUser.coins--;
    updateUserDisplay();

    // 게임 상태 초기화
    gameState.isPlaying = true;
    gameState.score = 0;
    gameState.timeLeft = 30;
    gameState.goldenPunches = 0;
    gameState.currentPunch = null;

    // UI 업데이트
    elements.currentScore.textContent = '0';
    elements.timeLeft.textContent = '30.00';
    
    // 모든 뚝배기 숨기기
    hideAllPunches();

    showScreen('game');

    // 게임 타이머 시작
    startGameTimer();
    
    // 첫 번째 뚝배기 생성
    setTimeout(() => {
        spawnPunch();
    }, 1000);
}

// 게임 타이머
function startGameTimer() {
    gameState.gameTimer = setInterval(() => {
        gameState.timeLeft -= 0.01;
        elements.timeLeft.textContent = gameState.timeLeft.toFixed(2);
        
        if (gameState.timeLeft <= 0) {
            endGame();
        }
    }, 10);
}

// 뚝배기 생성
function spawnPunch() {
    if (!gameState.isPlaying) return;

    // 이전 뚝배기 숨기기
    hideAllPunches();

    // 랜덤 위치 선택
    const randomIndex = Math.floor(Math.random() * 9);
    
    // 황금뚝배기 확률 (10%)
    const isGolden = Math.random() < 0.1;
    
    // 지속 시간 설정
    let duration;
    if (isGolden) {
        duration = 0.5; // 황금뚝배기는 0.5초 고정
    } else {
        const durations = [0.5, 1, 1.5, 2];
        duration = durations[Math.floor(Math.random() * durations.length)];
    }

    // 뚝배기 표시
    const punch = document.querySelector(`[data-index="${randomIndex}"] .punch`);
    punch.classList.add('show');
    
    if (isGolden) {
        punch.classList.add('golden');
    }

    gameState.currentPunch = {
        index: randomIndex,
        isGolden: isGolden,
        duration: duration
    };

    console.log(`뚝배기 생성: 위치 ${randomIndex}, 황금: ${isGolden}, 지속시간: ${duration}초`);

    // 뚝배기 자동 숨김 타이머
    gameState.punchTimer = setTimeout(() => {
        if (gameState.currentPunch && gameState.currentPunch.index === randomIndex) {
            hidePunch(randomIndex);
            gameState.currentPunch = null;
            
            // 다음 뚝배기 생성
            if (gameState.isPlaying) {
                gameState.nextPunchTimer = setTimeout(() => {
                    spawnPunch();
                }, 500);
            }
        }
    }, duration * 1000);
}

// 뚝배기 숨기기
function hidePunch(index) {
    const punch = document.querySelector(`[data-index="${index}"] .punch`);
    punch.classList.remove('show', 'golden');
}

// 모든 뚝배기 숨기기
function hideAllPunches() {
    const punches = document.querySelectorAll('.punch');
    punches.forEach(punch => {
        punch.classList.remove('show', 'golden');
    });
}

// 뚝배기 클릭 처리
function hitPunch(index) {
    if (!gameState.isPlaying || !gameState.currentPunch || gameState.currentPunch.index !== index) {
        return;
    }

    const punch = document.querySelector(`[data-index="${index}"] .punch`);
    const isGolden = gameState.currentPunch.isGolden;

    // 애니메이션 효과
    punch.classList.add('hit');
    
    if (isGolden) {
        createGoldenParticles(index);
    }

    // 점수 추가
    if (isGolden) {
        gameState.score += 5;
        gameState.goldenPunches++;
        gameState.timeLeft += 5; // 5초 추가
        currentUser.coins++; // 코인 1개 추가
        updateUserDisplay();
    } else {
        gameState.score += 1;
    }

    elements.currentScore.textContent = gameState.score;

    // 뚝배기 숨기기
    setTimeout(() => {
        hidePunch(index);
        punch.classList.remove('hit');
    }, 500);

    // 타이머 정리
    if (gameState.punchTimer) {
        clearTimeout(gameState.punchTimer);
    }
    if (gameState.nextPunchTimer) {
        clearTimeout(gameState.nextPunchTimer);
    }

    gameState.currentPunch = null;

    // 다음 뚝배기 생성
    setTimeout(() => {
        if (gameState.isPlaying) {
            spawnPunch();
        }
    }, 500);
}

// 황금 파티클 효과
function createGoldenParticles(index) {
    const burner = document.querySelector(`[data-index="${index}"]`);
    const particlesContainer = document.createElement('div');
    particlesContainer.className = 'golden-particles';
    burner.appendChild(particlesContainer);

    // 파티클 생성
    for (let i = 0; i < 12; i++) {
        const particle = document.createElement('div');
        particle.className = 'particle';
        
        const angle = (i / 12) * 2 * Math.PI;
        const distance = 50 + Math.random() * 30;
        const tx = Math.cos(angle) * distance;
        const ty = Math.sin(angle) * distance;
        
        particle.style.setProperty('--tx', `${tx}px`);
        particle.style.setProperty('--ty', `${ty}px`);
        
        particlesContainer.appendChild(particle);
    }

    // 파티클 제거
    setTimeout(() => {
        particlesContainer.remove();
    }, 1000);
}

// 게임 종료
function endGame() {
    gameState.isPlaying = false;
    
    // 타이머 정리
    if (gameState.gameTimer) clearInterval(gameState.gameTimer);
    if (gameState.punchTimer) clearTimeout(gameState.punchTimer);
    if (gameState.nextPunchTimer) clearTimeout(gameState.nextPunchTimer);

    // 모든 뚝배기 숨기기
    hideAllPunches();

    // 게임 결과 저장
    saveGameResult();

    // 게임 종료 화면 표시
    elements.finalScore.textContent = gameState.score;
    elements.goldenPunches.textContent = gameState.goldenPunches;
    
    showScreen('gameOver');
}

// 게임 결과 저장 (JSONP 방식)
function saveGameResult() {
    if (!currentUser) return;

    callGoogleAppsScript('saveGameResult', {
        username: currentUser.username,
        score: gameState.score,
        goldenPunches: gameState.goldenPunches,
        timeLeft: gameState.timeLeft
    }, function(response) {
        if (response.success) {
            // 사용자 정보 업데이트
            currentUser.totalScore = response.totalScore;
            currentUser.totalGames = response.totalGames;
            currentUser.goldenPunches = response.goldenPunches;
            currentUser.coins = response.coins;
            updateUserDisplay();
            
            // 랭킹 업데이트
            loadRankings();
        }
    });
}

// 게임 일시정지
function pauseGame() {
    if (!gameState.isPlaying) return;
    
    gameState.isPlaying = false;
    
    if (gameState.gameTimer) clearInterval(gameState.gameTimer);
    if (gameState.punchTimer) clearTimeout(gameState.punchTimer);
    if (gameState.nextPunchTimer) clearTimeout(gameState.nextPunchTimer);
    
    alert('게임이 일시정지되었습니다. 다시 시작하려면 화면을 터치하세요.');
    
    // 화면 터치로 재시작
    const gameScreen = document.getElementById('gameScreen');
    const resumeHandler = () => {
        gameState.isPlaying = true;
        startGameTimer();
        spawnPunch();
        gameScreen.removeEventListener('click', resumeHandler);
    };
    gameScreen.addEventListener('click', resumeHandler);
}

// 메뉴로 돌아가기
function backToMenu() {
    if (gameState.isPlaying) {
        if (confirm('게임을 종료하시겠습니까?')) {
            gameState.isPlaying = false;
            if (gameState.gameTimer) clearInterval(gameState.gameTimer);
            if (gameState.punchTimer) clearTimeout(gameState.punchTimer);
            if (gameState.nextPunchTimer) clearTimeout(gameState.nextPunchTimer);
            hideAllPunches();
        } else {
            return;
        }
    }
    
    showScreen('mainMenu');
}

// 로그아웃
function logout() {
    currentUser = null;
    elements.username.value = '';
    elements.password.value = '';
    showScreen('login');
}

// 코인 요청 모달 표시
function showCoinRequestModal() {
    alert('JSONP 버전에서는 코인 요청 기능을 사용할 수 없습니다.');
}

// 랭킹 로드 (JSONP 방식)
function loadRankings() {
    callGoogleAppsScript('getRankings', {}, function(response) {
        if (response.success && response.rankings) {
            displayRankings(response.rankings);
        }
    });
}

// 랭킹 표시
function displayRankings(rankings) {
    elements.rankingList.innerHTML = '';
    
    rankings.forEach((user, index) => {
        const rankingItem = document.createElement('div');
        rankingItem.className = 'ranking-item';
        
        let medalHtml = '';
        if (index === 0) medalHtml = '<div class="ranking-medal medal-gold">🥇</div>';
        else if (index === 1) medalHtml = '<div class="ranking-medal medal-silver">🥈</div>';
        else if (index === 2) medalHtml = '<div class="ranking-medal medal-bronze">🥉</div>';
        else medalHtml = `<div class="ranking-number">${index + 1}</div>`;
        
        rankingItem.innerHTML = `
            ${medalHtml}
            <div class="ranking-name">${user.username}</div>
            <div class="ranking-score">${user.totalScore}점</div>
            <div class="ranking-golden">황금: ${user.goldenPunches}개</div>
            <div class="ranking-games">게임: ${user.totalGames}회</div>
        `;
        
        elements.rankingList.appendChild(rankingItem);
    });
}

// 디버깅 모드 토글
function toggleDebugMode() {
    const gameBoard = document.querySelector('.game-board');
    gameBoard.classList.toggle('debug');
    console.log('디버그 모드:', gameBoard.classList.contains('debug'));
}

// 전역 함수로 노출
window.toggleDebugMode = toggleDebugMode; 