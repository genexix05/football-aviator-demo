/**
 * FOOTBALL STRIKE - Crash Game
 * Professional JavaScript Game Logic
 */

class FootballAviator {
    constructor() {
        // Game State
        this.balance = 1000;
        this.currentBet = 0;
        this.multiplier = 1.0;
        this.isPlaying = false;
        this.hasCashedOut = false;
        this.gameRunning = false;
        this.crashPoint = 0;
        
        // Game Config
        this.minMultiplier = 1.0;
        this.maxMultiplier = 100.0;
        this.baseGrowthRate = 0.03;
        this.growthAcceleration = 0.002;
        
        // History
        this.history = [];
        this.maxHistory = 20;
        
        // Animation
        this.animationFrame = null;
        this.lastTime = 0;
        
        // DOM Elements
        this.elements = {
            balance: document.getElementById('balance'),
            betAmount: document.getElementById('betAmount'),
            multiplier: document.getElementById('multiplier'),
            multiplierOverlay: document.getElementById('multiplierOverlay'),
            crashIndicator: document.getElementById('crashIndicator'),
            placeBetBtn: document.getElementById('placeBet'),
            cashOutBtn: document.getElementById('cashOut'),
            currentBetDisplay: document.getElementById('currentBetDisplay'),
            potentialWinDisplay: document.getElementById('potentialWinDisplay'),
            historyList: document.getElementById('historyList'),
            gameOverModal: document.getElementById('gameOverModal'),
            modalTitle: document.getElementById('modalTitle'),
            modalAmount: document.getElementById('modalAmount'),
            modalMultiplier: document.getElementById('modalMultiplier'),
            closeModal: document.getElementById('closeModal'),
            halfBet: document.getElementById('halfBet'),
            doubleBet: document.getElementById('doubleBet')
        };
        
        this.init();
    }
    
    init() {
        this.bindEvents();
        this.updateBalance();
        this.loadHistory();
        this.showInstructions();
        this.initCanvas();
    }
    
    bindEvents() {
        // Bet controls
        this.elements.placeBetBtn.addEventListener('click', () => this.placeBet());
        this.elements.cashOutBtn.addEventListener('click', () => this.cashOut());
        
        // Bet amount controls
        this.elements.halfBet.addEventListener('click', () => this.halfBet());
        this.elements.doubleBet.addEventListener('click', () => this.doubleBet());
        
        // Quick bets
        document.querySelectorAll('.quick-bet').forEach(btn => {
            btn.addEventListener('click', (e) => {
                this.elements.betAmount.value = e.target.dataset.amount;
            });
        });
        
        // Modal
        this.elements.closeModal.addEventListener('click', () => this.closeModal());
        
        // Keyboard shortcuts
        document.addEventListener('keydown', (e) => {
            if (e.code === 'Space' && this.isPlaying && !this.hasCashedOut) {
                e.preventDefault();
                this.cashOut();
            }
            if (e.code === 'Enter' && !this.isPlaying) {
                this.placeBet();
            }
        });
        
        // Bet amount input
        this.elements.betAmount.addEventListener('input', () => this.updatePotentialWin());
    }
    
    initCanvas() {
        this.canvas = document.getElementById('gameCanvas');
        this.ctx = this.canvas.getContext('2d');
        this.resizeCanvas();
        
        window.addEventListener('resize', () => this.resizeCanvas());
        
        // Initial render
        this.renderBackground();
    }
    
    resizeCanvas() {
        const container = this.canvas.parentElement;
        this.canvas.width = container.clientWidth;
        this.canvas.height = container.clientHeight;
        this.renderBackground();
    }
    
    renderBackground() {
        const ctx = this.ctx;
        const w = this.canvas.width;
        const h = this.canvas.height;
        
        // Stadium gradient background
        const gradient = ctx.createLinearGradient(0, 0, 0, h);
        gradient.addColorStop(0, '#0d1a0f');
        gradient.addColorStop(1, '#061007');
        ctx.fillStyle = gradient;
        ctx.fillRect(0, 0, w, h);
        
        // Draw stadium lights (simple circles with glow)
        const lights = [
            { x: w * 0.1, y: h * 0.15 },
            { x: w * 0.9, y: h * 0.15 },
            { x: w * 0.1, y: h * 0.85 },
            { x: w * 0.9, y: h * 0.85 }
        ];
        
        lights.forEach(light => {
            // Glow
            const glowGradient = ctx.createRadialGradient(light.x, light.y, 0, light.x, light.y, 100);
            glowGradient.addColorStop(0, 'rgba(255, 255, 200, 0.3)');
            glowGradient.addColorStop(1, 'rgba(255, 255, 200, 0)');
            ctx.fillStyle = glowGradient;
            ctx.beginPath();
            ctx.arc(light.x, light.y, 100, 0, Math.PI * 2);
            ctx.fill();
            
            // Light point
            ctx.fillStyle = '#fff';
            ctx.beginPath();
            ctx.arc(light.x, light.y, 5, 0, Math.PI * 2);
            ctx.fill();
        });
        
        // Draw pitch lines
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.1)';
        ctx.lineWidth = 2;
        
        // Center circle
        ctx.beginPath();
        ctx.arc(w / 2, h / 2, 80, 0, Math.PI * 2);
        ctx.stroke();
        
        // Center line
        ctx.beginPath();
        ctx.moveTo(w / 2, 0);
        ctx.lineTo(w / 2, h);
        ctx.stroke();
        
        // Draw football in center
        this.drawFootball(w / 2, h / 2, this.gameRunning ? this.multiplier : 1);
    }
    
    drawFootball(x, y, scale) {
        const ctx = this.ctx;
        const baseSize = 30;
        const size = baseSize * (1 + (scale - 1) * 0.1);
        
        // Glow effect
        const glowSize = size * (2 + scale * 0.5);
        const glow = ctx.createRadialGradient(x, y, 0, x, y, glowSize);
        glow.addColorStop(0, 'rgba(255, 215, 0, 0.8)');
        glow.addColorStop(0.3, 'rgba(255, 150, 0, 0.4)');
        glow.addColorStop(1, 'rgba(255, 100, 0, 0)');
        
        ctx.fillStyle = glow;
        ctx.beginPath();
        ctx.arc(x, y, glowSize, 0, Math.PI * 2);
        ctx.fill();
        
        // Ball shadow
        ctx.fillStyle = 'rgba(0, 0, 0, 0.3)';
        ctx.beginPath();
        ctx.ellipse(x, y + size * 0.8, size * 0.8, size * 0.2, 0, 0, Math.PI * 2);
        ctx.fill();
        
        // Ball
        ctx.fillStyle = '#ffffff';
        ctx.beginPath();
        ctx.arc(x, y, size, 0, Math.PI * 2);
        ctx.fill();
        
        // Ball pattern (classic football)
        ctx.fillStyle = '#1a1a1a';
        
        // Pentagon pattern
        for (let i = 0; i < 5; i++) {
            const angle = (i * 72 - 90) * Math.PI / 180;
            const px = x + Math.cos(angle) * size * 0.5;
            const py = y + Math.sin(angle) * size * 0.5;
            
            ctx.beginPath();
            ctx.arc(px, py, size * 0.25, 0, Math.PI * 2);
            ctx.fill();
        }
        
        // Center pentagon
        ctx.beginPath();
        ctx.arc(x, y, size * 0.3, 0, Math.PI * 2);
        ctx.fill();
    }
    
    placeBet() {
        const betAmount = parseFloat(this.elements.betAmount.value);
        
        if (isNaN(betAmount) || betAmount <= 0) {
            this.showError('Introduce una apuesta válida');
            return;
        }
        
        if (betAmount > this.balance) {
            this.showError('Saldo insuficiente');
            return;
        }
        
        this.currentBet = betAmount;
        this.balance -= betAmount;
        this.isPlaying = true;
        this.hasCashedOut = false;
        this.multiplier = 1.0;
        
        this.updateBalance();
        this.updateUI();
        this.startGame();
    }
    
    startGame() {
        this.gameRunning = true;
        
        // Calculate crash point (weighted random)
        // More likely to crash at lower multipliers
        this.crashPoint = this.calculateCrashPoint();
        
        this.elements.placeBetBtn.disabled = true;
        this.elements.cashOutBtn.disabled = false;
        this.elements.betAmount.disabled = true;
        
        this.lastTime = performance.now();
        this.gameLoop();
    }
    
    calculateCrashPoint() {
        // Custom crash algorithm - weighted towards lower values
        const rand = Math.random();
        
        // Probability decreases as multiplier increases
        if (rand < 0.3) return 1.0 + Math.random() * 0.5;      // 1.0-1.5x (30%)
        if (rand < 0.5) return 1.5 + Math.random() * 0.5;      // 1.5-2.0x (20%)
        if (rand < 0.65) return 2.0 + Math.random() * 1.0;     // 2.0-3.0x (15%)
        if (rand < 0.78) return 3.0 + Math.random() * 2.0;    // 3.0-5.0x (13%)
        if (rand < 0.88) return 5.0 + Math.random() * 5.0;     // 5.0-10.0x (10%)
        if (rand < 0.95) return 10.0 + Math.random() * 15.0;   // 10.0-25.0x (7%)
        return 25.0 + Math.random() * 75.0;                     // 25.0-100.0x (5%)
    }
    
    gameLoop() {
        if (!this.gameRunning) return;
        
        const currentTime = performance.now();
        const deltaTime = (currentTime - this.lastTime) / 1000;
        this.lastTime = currentTime;
        
        // Update multiplier with exponential growth
        const growthRate = this.baseGrowthRate + (this.multiplier * this.growthAcceleration);
        this.multiplier += growthRate * deltaTime * this.multiplier;
        
        // Update UI
        this.updateMultiplierDisplay();
        this.updatePotentialWin();
        this.renderBackground();
        
        // Check for crash
        if (this.multiplier >= this.crashPoint) {
            this.crash();
            return;
        }
        
        this.animationFrame = requestAnimationFrame(() => this.gameLoop());
    }
    
    cashOut() {
        if (!this.isPlaying || this.hasCashedOut || !this.gameRunning) return;
        
        this.hasCashedOut = true;
        const winAmount = this.currentBet * this.multiplier;
        this.balance += winAmount;
        
        this.elements.cashOutBtn.disabled = true;
        this.updateBalance();
        
        // Show win modal after short delay
        setTimeout(() => {
            this.showWinModal(winAmount, this.multiplier);
        }, 500);
    }
    
    crash() {
        this.gameRunning = false;
        
        // Show crash indicator
        this.elements.crashIndicator.classList.add('active');
        
        // Update history
        if (!this.hasCashedOut) {
            this.addToHistory(this.multiplier);
        }
        
        setTimeout(() => {
            this.elements.crashIndicator.classList.remove('active');
            
            if (!this.hasCashedOut) {
                this.showLoseModal();
            }
            
            this.resetGame();
        }, 1500);
    }
    
    resetGame() {
        this.isPlaying = false;
        this.currentBet = 0;
        this.multiplier = 1.0;
        this.hasCashedOut = false;
        this.gameRunning = false;
        
        this.elements.placeBetBtn.disabled = false;
        this.elements.cashOutBtn.disabled = true;
        this.elements.betAmount.disabled = false;
        
        this.updateUI();
        this.renderBackground();
    }
    
    updateMultiplierDisplay() {
        const displayMultiplier = this.multiplier.toFixed(2);
        this.elements.multiplier.textContent = displayMultiplier;
        
        // Visual danger indication
        if (this.multiplier > this.crashPoint * 0.8) {
            this.elements.multiplier.classList.add('danger');
        } else {
            this.elements.multiplier.classList.remove('danger');
        }
    }
    
    updateBalance() {
        this.elements.balance.textContent = `$${this.balance.toFixed(2)}`;
    }
    
    updateUI() {
        this.elements.currentBetDisplay.textContent = `$${this.currentBet.toFixed(2)}`;
        this.updatePotentialWin();
    }
    
    updatePotentialWin() {
        const bet = parseFloat(this.elements.betAmount.value) || 0;
        const potential = bet * this.multiplier;
        this.elements.potentialWinDisplay.textContent = `$${potential.toFixed(2)}`;
    }
    
    addToHistory(multiplier) {
        this.history.unshift(multiplier);
        if (this.history.length > this.maxHistory) {
            this.history.pop();
        }
        this.saveHistory();
        this.renderHistory();
    }
    
    loadHistory() {
        const saved = localStorage.getItem('footballAviatorHistory');
        if (saved) {
            try {
                this.history = JSON.parse(saved);
                this.renderHistory();
            } catch (e) {
                this.history = [];
            }
        }
    }
    
    saveHistory() {
        localStorage.setItem('footballAviatorHistory', JSON.stringify(this.history));
    }
    
    renderHistory() {
        this.elements.historyList.innerHTML = '';
        
        this.history.forEach(m => {
            const item = document.createElement('div');
            item.className = `history-item ${this.getHistoryColorClass(m)}`;
            item.textContent = m.toFixed(2) + 'x';
            this.elements.historyList.appendChild(item);
        });
    }
    
    getHistoryColorClass(multiplier) {
        if (multiplier < 2) return 'low';
        if (multiplier < 5) return 'medium';
        return 'high';
    }
    
    showWinModal(amount, multiplier) {
        this.elements.modalTitle.textContent = '¡GANASTE!';
        this.elements.modalTitle.className = 'modal-title win';
        this.elements.modalAmount.textContent = `+$${amount.toFixed(2)}`;
        this.elements.modalAmount.className = 'modal-amount';
        this.elements.modalMultiplier.textContent = `x${multiplier.toFixed(2)}`;
        this.elements.gameOverModal.classList.add('active');
    }
    
    showLoseModal() {
        this.elements.modalTitle.textContent = '¡PERDISTE!';
        this.elements.modalTitle.className = 'modal-title lose';
        this.elements.modalAmount.textContent = `-$${this.currentBet.toFixed(2)}`;
        this.elements.modalAmount.className = 'modal-amount lose';
        this.elements.modalMultiplier.textContent = `Crash en x${this.multiplier.toFixed(2)}`;
        this.elements.gameOverModal.classList.add('active');
    }
    
    closeModal() {
        this.elements.gameOverModal.classList.remove('active');
    }
    
    showError(message) {
        // Simple alert for now - can be enhanced
        console.error(message);
        // Could add toast notification here
    }
    
    showInstructions() {
        const hasPlayed = localStorage.getItem('footballAviatorPlayed');
        if (!hasPlayed) {
            document.getElementById('instructionsModal').classList.add('active');
            document.getElementById('closeInstructions').addEventListener('click', () => {
                document.getElementById('instructionsModal').classList.remove('active');
                localStorage.setItem('footballAviatorPlayed', 'true');
            });
        }
    }
    
    halfBet() {
        const current = parseFloat(this.elements.betAmount.value) || 0;
        this.elements.betAmount.value = Math.max(1, current / 2);
        this.updatePotentialWin();
    }
    
    doubleBet() {
        const current = parseFloat(this.elements.betAmount.value) || 0;
        this.elements.betAmount.value = Math.min(this.balance, current * 2);
        this.updatePotentialWin();
    }
}

// Initialize game when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    window.game = new FootballAviator();
});
