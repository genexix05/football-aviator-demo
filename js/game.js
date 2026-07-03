/**
 * TuZoca Penalty Shootout
 * Front-end game shell prepared for external aggregator control.
 */

class GameAudio {
    constructor() {
        this.context = null;
        this.masterGain = null;
        this.musicGain = null;
        this.effectsGain = null;
        this.musicTimer = null;
        this.musicStep = 0;
        this.enabled = true;
        this.musicNotes = [196, 246.94, 293.66, 246.94, 220, 261.63, 329.63, 261.63];
    }

    toggle() {
        this.enabled = !this.enabled;

        if (this.enabled) {
            this.prime();
            this.startMusic();
            return this.enabled;
        }

        this.stopMusic();
        if (this.masterGain) {
            this.masterGain.gain.setTargetAtTime(0, this.context.currentTime, 0.05);
        }
        return this.enabled;
    }

    prime() {
        if (!this.enabled) return;

        this.ensureContext();
        if (!this.context) return;

        if (this.context.state === 'suspended') {
            this.context.resume();
        }

        this.masterGain.gain.setTargetAtTime(0.42, this.context.currentTime, 0.08);
        this.startMusic();
    }

    ensureContext() {
        if (this.context) return;

        const AudioContext = globalThis.AudioContext || globalThis.webkitAudioContext;
        if (!AudioContext) {
            this.enabled = false;
            return;
        }

        this.context = new AudioContext();
        this.masterGain = this.context.createGain();
        this.musicGain = this.context.createGain();
        this.effectsGain = this.context.createGain();

        this.masterGain.gain.value = 0;
        this.musicGain.gain.value = 0.05;
        this.effectsGain.gain.value = 0.34;

        this.musicGain.connect(this.masterGain);
        this.effectsGain.connect(this.masterGain);
        this.masterGain.connect(this.context.destination);
    }

    startMusic() {
        if (!this.enabled || !this.context || this.musicTimer) return;

        this.playMusicStep();
        this.musicTimer = globalThis.setInterval(() => this.playMusicStep(), 420);
    }

    stopMusic() {
        if (!this.musicTimer) return;

        globalThis.clearInterval(this.musicTimer);
        this.musicTimer = null;
    }

    playMusicStep() {
        if (!this.enabled || !this.context) return;

        const now = this.context.currentTime;
        const note = this.musicNotes[this.musicStep % this.musicNotes.length];
        const bass = note / 2;
        this.playTone(note, now, 0.16, 'triangle', 0.08, this.musicGain);

        if (this.musicStep % 2 === 0) {
            this.playTone(bass, now, 0.22, 'sine', 0.06, this.musicGain);
        }

        this.musicStep += 1;
    }

    playGoal() {
        if (!this.enabled || !this.context) return;

        const now = this.context.currentTime;
        [523.25, 659.25, 783.99, 1046.5].forEach((frequency, index) => {
            this.playTone(frequency, now + (index * 0.08), 0.24, 'triangle', 0.22, this.effectsGain);
        });
        this.playNoise(now + 0.08, 0.42, 0.12, 900);
    }

    playSave() {
        if (!this.enabled || !this.context) return;

        const now = this.context.currentTime;
        this.playTone(150, now, 0.18, 'sawtooth', 0.18, this.effectsGain);
        this.playTone(92, now + 0.08, 0.28, 'sine', 0.24, this.effectsGain);
        this.playNoise(now, 0.24, 0.1, 180);
    }

    playTone(frequency, startTime, duration, type, volume, destination) {
        const oscillator = this.context.createOscillator();
        const gain = this.context.createGain();

        oscillator.type = type;
        oscillator.frequency.setValueAtTime(frequency, startTime);
        gain.gain.setValueAtTime(0.0001, startTime);
        gain.gain.exponentialRampToValueAtTime(volume, startTime + 0.025);
        gain.gain.exponentialRampToValueAtTime(0.0001, startTime + duration);

        oscillator.connect(gain);
        gain.connect(destination);
        oscillator.start(startTime);
        oscillator.stop(startTime + duration + 0.04);
    }

    playNoise(startTime, duration, volume, frequency) {
        const sampleRate = this.context.sampleRate;
        const buffer = this.context.createBuffer(1, sampleRate * duration, sampleRate);
        const data = buffer.getChannelData(0);

        for (let index = 0; index < data.length; index += 1) {
            data[index] = (Math.random() * 2) - 1;
        }

        const source = this.context.createBufferSource();
        const filter = this.context.createBiquadFilter();
        const gain = this.context.createGain();

        filter.type = 'bandpass';
        filter.frequency.value = frequency;
        filter.Q.value = 1.8;
        gain.gain.setValueAtTime(volume, startTime);
        gain.gain.exponentialRampToValueAtTime(0.0001, startTime + duration);

        source.buffer = buffer;
        source.connect(filter);
        filter.connect(gain);
        gain.connect(this.effectsGain);
        source.start(startTime);
        source.stop(startTime + duration);
    }
}

class PenaltyShootoutGame {
    constructor() {
        this.audio = new GameAudio();
        this.currency = '$';
        this.balance = 1000;
        this.currentBet = 0;
        this.roundId = null;
        this.goals = 0;
        this.isRoundActive = false;
        this.awaitingResolution = false;
        this.externalWallet = false;
        this.autoResolveDemo = true;
        this.history = [];
        this.keeperResetTimer = null;
        this.multipliers = [1.5, 2, 3, 6, 12];
        this.zoneCoordinates = {
            'top-left': { left: '24%', top: '28%' },
            'top-center': { left: '50%', top: '28%' },
            'top-right': { left: '76%', top: '28%' },
            'bottom-left': { left: '24%', top: '55%' },
            'bottom-center': { left: '50%', top: '55%' },
            'bottom-right': { left: '76%', top: '55%' }
        };

        this.elements = {
            balance: document.getElementById('balance'),
            betAmount: document.getElementById('betAmount'),
            halfBet: document.getElementById('halfBet'),
            doubleBet: document.getElementById('doubleBet'),
            startRound: document.getElementById('startRound'),
            randomShot: document.getElementById('randomShot'),
            collectWinnings: document.getElementById('collectWinnings'),
            actionHint: document.getElementById('actionHint'),
            roundStatus: document.getElementById('roundStatus'),
            currentMultiplier: document.getElementById('currentMultiplier'),
            shotCounter: document.getElementById('shotCounter'),
            currentBetDisplay: document.getElementById('currentBetDisplay'),
            potentialWinDisplay: document.getElementById('potentialWinDisplay'),
            historyList: document.getElementById('historyList'),
            historyChips: document.getElementById('historyChips'),
            historyStrip: document.querySelector('.history-strip'),
            collectAmount: document.getElementById('collectAmount'),
            shotCallout: document.getElementById('shotCallout'),
            confettiLayer: document.getElementById('confettiLayer'),
            modalContent: document.querySelector('.modal-content'),
            resultBanner: document.getElementById('resultBanner'),
            audioToggle: document.getElementById('audioToggle'),
            stadium: document.querySelector('.stadium'),
            goalWrap: document.querySelector('.goal-wrap'),
            ball: document.getElementById('ball'),
            keeper: document.getElementById('keeper'),
            roundModal: document.getElementById('roundModal'),
            modalTitle: document.getElementById('modalTitle'),
            modalAmount: document.getElementById('modalAmount'),
            modalDetail: document.getElementById('modalDetail'),
            closeModal: document.getElementById('closeModal'),
            goalZones: [...document.querySelectorAll('.goal-zone')],
            multiplierTrack: document.querySelector('.multiplier-track'),
            multiplierSteps: [...document.querySelectorAll('.multiplier-track li')]
        };

        this.bindEvents();
        this.updateUI();
        this.updateAudioToggle();
        this.setZonesEnabled(false);
        this.elements.randomShot.disabled = false;
    }

    bindEvents() {
        this.elements.startRound.addEventListener('click', () => this.startRound());
        this.elements.randomShot.addEventListener('click', () => this.randomShot());
        this.elements.collectWinnings.addEventListener('click', () => this.requestCollect());
        this.elements.closeModal.addEventListener('click', () => this.closeModal());
        this.elements.audioToggle.addEventListener('click', () => this.toggleAudio());
        this.elements.halfBet.addEventListener('click', () => this.adjustBet(0.5));
        this.elements.doubleBet.addEventListener('click', () => this.adjustBet(2));
        this.elements.betAmount.addEventListener('input', () => this.updatePayoutPreview());

        document.querySelectorAll('.quick-bet').forEach((button) => {
            button.addEventListener('click', () => {
                this.elements.betAmount.value = button.dataset.amount;
                this.updatePayoutPreview();
            });
        });

        this.elements.goalZones.forEach((zone) => {
            zone.addEventListener('click', () => this.selectZone(zone.dataset.zone));
        });
    }

    configure(config = {}) {
        if (typeof config.balance === 'number') {
            this.balance = config.balance;
        }

        if (typeof config.currency === 'string') {
            this.currency = config.currency;
        }

        if (typeof config.externalWallet === 'boolean') {
            this.externalWallet = config.externalWallet;
        }

        if (typeof config.autoResolveDemo === 'boolean') {
            this.autoResolveDemo = config.autoResolveDemo;
        }

        this.updateUI();
        this.emit('configured', {
            balance: this.balance,
            currency: this.currency,
            externalWallet: this.externalWallet,
            autoResolveDemo: this.autoResolveDemo
        });
    }

    startRound() {
        if (this.isRoundActive) return;

        this.audio.prime();
        const betAmount = Number.parseFloat(this.elements.betAmount.value);
        if (!Number.isFinite(betAmount) || betAmount <= 0) {
            this.setBanner('Apuesta invalida');
            return;
        }

        if (!this.externalWallet && betAmount > this.balance) {
            this.setBanner('Saldo insuficiente');
            return;
        }

        this.currentBet = betAmount;
        this.roundId = `round-${Date.now()}`;
        this.goals = 0;
        this.isRoundActive = true;
        this.awaitingResolution = false;

        if (!this.externalWallet) {
            this.balance -= betAmount;
        }

        this.resetField();
        this.elements.betAmount.disabled = true;
        this.elements.startRound.disabled = true;
        this.elements.startRound.textContent = 'Activo';
        this.elements.collectWinnings.disabled = true;
        this.elements.randomShot.disabled = false;
        this.setZonesEnabled(true);
        this.setBanner('Elige zona');
        this.emit('round-started', this.getRoundState());
        this.updateUI();
    }

    randomShot() {
        this.audio.prime();

        if (!this.isRoundActive) {
            this.startRound();
        }

        if (!this.isRoundActive || this.awaitingResolution) return;

        const zones = Object.keys(this.zoneCoordinates);
        const zone = zones[Math.floor(Math.random() * zones.length)];
        this.selectZone(zone);
    }

    selectZone(zone) {
        if (!this.isRoundActive || this.awaitingResolution || !this.zoneCoordinates[zone]) return;

        this.audio.prime();
        this.awaitingResolution = true;
        this.setZonesEnabled(false);
        this.elements.randomShot.disabled = true;
        this.clearZoneStates();
        this.resetKeeper();
        this.markZone(zone, 'selected');
        this.animateShot(zone);
        this.setBanner('Tirando...');

        const payload = {
            ...this.getRoundState(),
            requestedZone: zone,
            nextMultiplier: this.getNextMultiplier()
        };

        this.emit('shot-requested', payload);

        if (this.autoResolveDemo) {
            globalThis.setTimeout(() => {
                this.resolveShot({
                    scored: true,
                    zone,
                    goalkeeperZone: this.getDemoKeeperZone(zone),
                    transactionId: `demo-${Date.now()}`
                });
            }, 760);
        }
    }

    resolveShot(result = {}) {
        if (!this.isRoundActive || !this.awaitingResolution) return;

        const scored = Boolean(result.scored);
        const zone = result.zone || result.requestedZone || this.getSelectedZone();
        const goalkeeperZone = result.goalkeeperZone || zone;

        this.awaitingResolution = false;
        this.moveKeeper(goalkeeperZone);
        this.clearZoneStates();
        this.markZone(zone, scored ? 'scored' : 'missed');
        this.finishShotAnimation(zone, scored);

        if (!scored) {
            this.audio.playSave();
            this.showCallout('¡Atajado!', 'saved');
            this.shakeStadium();
            this.finishRound({
                status: 'loss',
                payout: 0,
                detail: 'El portero detuvo el penalti.',
                transactionId: result.transactionId
            });
            return;
        }

        this.goals += 1;
        this.audio.playGoal();
        this.showCallout(this.goals === this.multipliers.length ? '¡Maximo!' : '¡Gol!', 'goal');
        this.launchConfetti(this.goals === this.multipliers.length ? 90 : 34);
        this.history.unshift({ status: 'win', multiplier: this.getCurrentMultiplier(), goals: this.goals });
        this.history = this.history.slice(0, 12);

        if (this.goals === this.multipliers.length) {
            this.setBanner('x12 listo');
            this.setZonesEnabled(false);
            this.elements.randomShot.disabled = true;
        } else {
            this.setBanner(`Gol ${this.goals}`);
            this.setZonesEnabled(true);
            this.elements.randomShot.disabled = false;
        }

        this.elements.collectWinnings.disabled = false;
        this.emit('shot-resolved', {
            ...this.getRoundState(),
            scored: true,
            zone,
            goalkeeperZone,
            transactionId: result.transactionId
        });
        this.updateUI();
    }

    requestCollect() {
        if (!this.isRoundActive || this.goals === 0 || this.awaitingResolution) return;

        const payout = this.getPayoutPreview();
        this.emit('collect-requested', {
            ...this.getRoundState(),
            previewPayout: payout
        });

        this.finishRound({
            status: 'cashout',
            payout,
            detail: `Cobro solicitado con ${this.goals} gol(es).`
        });
    }

    settleRound(settlement = {}) {
        if (typeof settlement.balance === 'number') {
            this.balance = settlement.balance;
            this.updateUI();
        }

        this.emit('round-settled', {
            ...this.getRoundState(),
            settlement
        });
    }

    finishRound(result) {
        const payout = Number(result.payout) || 0;
        const status = result.status || 'cashout';

        if (!this.externalWallet && payout > 0) {
            this.balance += payout;
        }

        if (status === 'loss') {
            this.history.unshift({ status: 'loss', multiplier: 0, goals: this.goals });
            this.history = this.history.slice(0, 12);
        }

        this.isRoundActive = false;
        this.awaitingResolution = false;
        this.elements.betAmount.disabled = false;
        this.elements.startRound.disabled = false;
        this.elements.startRound.textContent = 'Jugar';
        this.elements.collectWinnings.disabled = true;
        this.elements.randomShot.disabled = false;
        this.setZonesEnabled(false);
        this.showResultModal(status, payout, result.detail);
        this.emit('round-finished', {
            ...this.getRoundState(),
            status,
            payout,
            transactionId: result.transactionId
        });
        this.currentBet = 0;
        this.goals = 0;
        this.roundId = null;
        this.updateUI();
    }

    getRoundState() {
        return {
            roundId: this.roundId,
            stake: this.currentBet,
            goals: this.goals,
            multiplier: this.getCurrentMultiplier(),
            maxGoals: this.multipliers.length,
            multipliers: [...this.multipliers]
        };
    }

    getCurrentMultiplier() {
        if (this.goals <= 0) return 0;
        return this.multipliers[this.goals - 1];
    }

    getNextMultiplier() {
        return this.multipliers[this.goals] || this.getCurrentMultiplier();
    }

    getPayoutPreview() {
        return this.currentBet * this.getCurrentMultiplier();
    }

    getSelectedZone() {
        const selected = this.elements.goalZones.find((zone) => zone.classList.contains('selected'));
        return selected ? selected.dataset.zone : 'bottom-center';
    }

    getDemoKeeperZone(zone) {
        const demoMap = {
            'top-left': 'bottom-right',
            'top-center': 'bottom-left',
            'top-right': 'bottom-left',
            'bottom-left': 'top-right',
            'bottom-center': 'top-right',
            'bottom-right': 'top-center'
        };
        return demoMap[zone] || 'top-left';
    }

    emit(name, detail) {
        globalThis.dispatchEvent(new CustomEvent(`penalty:${name}`, { detail }));
    }

    updateUI() {
        if (typeof this.lastBalance === 'number' && this.balance > this.lastBalance) {
            this.elements.balance.classList.remove('bump');
            this.forceReflow(this.elements.balance);
            this.elements.balance.classList.add('bump');
        }
        this.lastBalance = this.balance;

        this.elements.balance.textContent = this.formatMoney(this.balance);
        this.elements.collectAmount.textContent = this.formatMoney(this.getPayoutPreview());
        this.elements.roundStatus.textContent = this.getStatusLabel();
        this.elements.currentMultiplier.textContent = `x${this.getCurrentMultiplier().toFixed(2)}`;
        this.elements.shotCounter.textContent = `${this.goals}/${this.multipliers.length}`;
        this.elements.currentBetDisplay.textContent = this.formatMoney(this.currentBet);
        this.updatePayoutPreview();
        this.updateMultiplierTrack();
        this.renderHistory();
    }

    toggleAudio() {
        this.audio.toggle();
        this.updateAudioToggle();

        if (this.audio.enabled) {
            this.setBanner('Sonido ON');
        } else {
            this.setBanner('Sonido OFF');
        }
    }

    updateAudioToggle() {
        this.elements.audioToggle.textContent = this.audio.enabled ? 'Sonido ON' : 'Sonido OFF';
        this.elements.audioToggle.setAttribute('aria-pressed', String(this.audio.enabled));
    }

    getStatusLabel() {
        if (this.awaitingResolution) return 'Tirando';
        if (this.isRoundActive && this.goals > 0) return `Gol ${this.goals}`;
        if (this.isRoundActive) return 'Elige zona';
        return 'Listo';
    }

    updatePayoutPreview() {
        const baseBet = this.currentBet || Number.parseFloat(this.elements.betAmount.value) || 0;
        const multiplier = this.isRoundActive ? this.getCurrentMultiplier() : this.multipliers[0];
        const preview = baseBet * multiplier;
        this.elements.potentialWinDisplay.textContent = this.formatMoney(preview);
    }

    updateMultiplierTrack() {
        const progress = this.goals <= 1 ? this.goals * 12.5 : 12.5 + ((this.goals - 1) / (this.multipliers.length - 1)) * 75;
        this.elements.multiplierTrack.style.setProperty('--progress', `${Math.min(progress, 87.5)}%`);

        this.elements.multiplierSteps.forEach((step, index) => {
            const stepNumber = index + 1;
            step.classList.toggle('completed', stepNumber <= this.goals);
            step.classList.toggle('current', this.isRoundActive && stepNumber === this.goals + 1);
        });
    }

    renderHistory() {
        this.elements.historyList.innerHTML = '';
        this.elements.historyChips.innerHTML = '';
        this.elements.historyStrip.style.visibility = this.history.length ? 'visible' : 'hidden';

        if (this.history.length === 0) {
            return;
        }

        this.history.forEach((item) => {
            const element = document.createElement('span');
            element.className = `history-item ${item.status}`;
            element.textContent = item.status === 'loss' ? 'Atajada' : `${item.goals}G x${item.multiplier}`;
            this.elements.historyList.appendChild(element);

            const chip = document.createElement('span');
            chip.className = `history-chip ${item.status}`;
            chip.textContent = item.status === 'loss' ? 'X' : `x${item.multiplier}`;
            this.elements.historyChips.appendChild(chip);
        });
    }

    showCallout(text, kind) {
        const callout = this.elements.shotCallout;
        callout.classList.remove('show', 'goal', 'saved');
        callout.querySelector('span').textContent = text;
        callout.classList.add(kind);
        this.forceReflow(callout);
        callout.classList.add('show');
    }

    shakeStadium() {
        this.elements.stadium.classList.remove('shake');
        this.forceReflow(this.elements.stadium);
        this.elements.stadium.classList.add('shake');
    }

    launchConfetti(count = 34) {
        const colors = ['#f7d957', '#d9b432', '#22c55e', '#59c9ff', '#ffffff', '#ef4444'];
        const layer = this.elements.confettiLayer;

        for (let index = 0; index < count; index += 1) {
            const piece = document.createElement('span');
            piece.className = 'confetti-piece';
            piece.style.left = `${Math.random() * 100}%`;
            piece.style.background = colors[Math.floor(Math.random() * colors.length)];
            piece.style.setProperty('--fall-time', `${1.8 + (Math.random() * 1.6)}s`);
            piece.style.setProperty('--fall-delay', `${Math.random() * 0.35}s`);
            piece.style.setProperty('--drift', `${(Math.random() - 0.5) * 180}px`);
            piece.style.setProperty('--spin', `${360 + (Math.random() * 540)}deg`);
            layer.appendChild(piece);
            globalThis.setTimeout(() => piece.remove(), 4200);
        }
    }

    setZonesEnabled(enabled) {
        this.elements.goalZones.forEach((zone) => {
            zone.disabled = !enabled;
        });
    }

    clearZoneStates() {
        this.elements.goalZones.forEach((zone) => {
            zone.classList.remove('selected', 'scored', 'missed');
        });
    }

    markZone(zoneName, className) {
        const zone = this.elements.goalZones.find((item) => item.dataset.zone === zoneName);
        if (zone) {
            zone.classList.add(className);
        }
    }

    animateShot(zoneName) {
        const target = this.getZoneCenter(zoneName);

        this.elements.ball.classList.remove('kicked', 'in-net', 'saved', 'hidden');
        this.elements.goalWrap.classList.remove('net-ripple');
        this.elements.ball.style.transition = 'none';
        this.elements.ball.style.left = '50%';
        this.elements.ball.style.top = '';
        this.elements.ball.style.bottom = '';
        this.forceReflow(this.elements.ball);

        const ballRect = this.elements.ball.getBoundingClientRect();
        const stadiumRect = this.elements.stadium.getBoundingClientRect();
        const startLeft = ballRect.left - stadiumRect.left + (ballRect.width / 2);
        const startTop = ballRect.top - stadiumRect.top + (ballRect.height / 2);

        this.elements.ball.style.left = `${startLeft}px`;
        this.elements.ball.style.top = `${startTop}px`;
        this.elements.ball.style.bottom = 'auto';
        this.elements.ball.classList.add('kicked');

        this.forceReflow(this.elements.ball);
        this.elements.ball.style.transition = '';

        globalThis.requestAnimationFrame(() => {
            this.elements.ball.style.left = `${target.left}px`;
            this.elements.ball.style.top = `${target.top}px`;
        });
    }

    finishShotAnimation(zoneName, scored) {
        if (scored) {
            this.triggerNetRipple(zoneName);
            this.elements.ball.classList.add('in-net');
            globalThis.setTimeout(() => {
                if (this.elements.ball.classList.contains('in-net')) {
                    this.elements.ball.classList.add('hidden');
                }
            }, 1200);
            return;
        }

        this.elements.ball.classList.add('saved');
    }

    triggerNetRipple(zoneName) {
        const target = this.getZoneCenter(zoneName);
        const goalRect = this.elements.goalWrap.getBoundingClientRect();
        const stadiumRect = this.elements.stadium.getBoundingClientRect();
        const hitLeft = ((target.left + stadiumRect.left - goalRect.left) / goalRect.width) * 100;
        const hitTop = ((target.top + stadiumRect.top - goalRect.top) / goalRect.height) * 100;

        this.elements.goalWrap.style.setProperty('--net-hit-left', `${hitLeft}%`);
        this.elements.goalWrap.style.setProperty('--net-hit-top', `${hitTop}%`);
        this.elements.goalWrap.classList.remove('net-ripple');
        this.forceReflow(this.elements.goalWrap);
        this.elements.goalWrap.classList.add('net-ripple');
    }

    forceReflow(element) {
        return element.offsetWidth;
    }

    getZoneCenter(zoneName) {
        const zone = this.elements.goalZones.find((item) => item.dataset.zone === zoneName);
        if (!zone) {
            const stadiumRect = this.elements.stadium.getBoundingClientRect();
            return { left: stadiumRect.width / 2, top: stadiumRect.height * 0.55 };
        }

        const zoneRect = zone.getBoundingClientRect();
        const stadiumRect = this.elements.stadium.getBoundingClientRect();
        const verticalBias = zoneName.includes('top') ? 0.48 : 0.52;

        return {
            left: zoneRect.left - stadiumRect.left + (zoneRect.width / 2),
            top: zoneRect.top - stadiumRect.top + (zoneRect.height * verticalBias)
        };
    }

    moveKeeper(zoneName) {
        const coordinates = this.zoneCoordinates[zoneName] || this.zoneCoordinates['bottom-center'];
        const horizontalOffset = Number.parseInt(coordinates.left, 10) - 50;
        const goalRect = this.elements.goalWrap.getBoundingClientRect();
        const maxHorizontalTravel = Math.min(180, goalRect.width * 0.27);
        const horizontalTravel = (horizontalOffset / 26) * maxHorizontalTravel;
        const verticalOffset = Number.parseInt(coordinates.top, 10) < 40
            ? -Math.min(46, goalRect.height * 0.16)
            : Math.min(22, goalRect.height * 0.09);
        const direction = this.getKeeperDirection(zoneName);
        let lean = 0;
        if (direction === 'left') {
            lean = -8;
        } else if (direction === 'right') {
            lean = 8;
        }
        const stretch = direction === 'center' ? 'scaleX(1.08) scaleY(.94)' : 'scaleX(1.08) scaleY(.96)';

        this.clearKeeperResetTimer();
        this.elements.keeper.classList.toggle('dive-left', direction === 'left');
        this.elements.keeper.classList.toggle('dive-right', direction === 'right');
        this.elements.keeper.classList.toggle('dive-center', direction === 'center');
        this.elements.keeper.style.transform = `translateX(calc(-50% + ${horizontalTravel}px)) translateY(${verticalOffset}px) rotate(${lean}deg) ${stretch}`;
        this.scheduleKeeperReset();
    }

    getKeeperDirection(zoneName) {
        if (zoneName.includes('left')) return 'left';
        if (zoneName.includes('right')) return 'right';
        return 'center';
    }

    scheduleKeeperReset() {
        this.keeperResetTimer = globalThis.setTimeout(() => {
            if (this.isRoundActive && !this.awaitingResolution) {
                this.resetKeeper(false);
            }
            this.keeperResetTimer = null;
        }, 1600);
    }

    clearKeeperResetTimer() {
        if (this.keeperResetTimer) {
            globalThis.clearTimeout(this.keeperResetTimer);
            this.keeperResetTimer = null;
        }
    }

    resetKeeper(clearTimer = true) {
        if (clearTimer) {
            this.clearKeeperResetTimer();
        }
        this.elements.keeper.classList.remove('dive-left', 'dive-right', 'dive-center');
        this.elements.keeper.style.transform = 'translateX(-50%)';
    }

    resetField() {
        this.clearZoneStates();
        this.resetKeeper();
        this.elements.goalWrap.classList.remove('net-ripple');
        this.elements.ball.classList.remove('kicked', 'in-net', 'saved', 'hidden');
        this.elements.ball.style.transition = '';
        this.elements.ball.style.left = '50%';
        this.elements.ball.style.top = '';
        this.elements.ball.style.bottom = '';
    }

    adjustBet(factor) {
        if (this.isRoundActive) return;

        const current = Number.parseFloat(this.elements.betAmount.value) || 1;
        const next = Math.max(1, Math.round(current * factor));
        this.elements.betAmount.value = this.externalWallet ? next : Math.min(this.balance, next);
        this.updatePayoutPreview();
    }

    setBanner(message) {
        this.elements.resultBanner.textContent = message;
        this.elements.actionHint.textContent = message;
    }

    showResultModal(status, payout, detail) {
        const won = status !== 'loss';
        this.elements.modalTitle.textContent = won ? '¡Ganaste!' : 'Penalti atajado';
        this.elements.modalAmount.textContent = won ? this.formatMoney(payout) : `-${this.formatMoney(this.currentBet)}`;
        this.elements.modalAmount.classList.toggle('loss', !won);
        this.elements.modalContent.classList.toggle('loss', !won);

        if (won) {
            this.launchConfetti(70);
        }
        this.elements.modalDetail.textContent = detail || (won ? 'Liquidacion enviada.' : 'Sin premio.');
        this.elements.roundModal.classList.add('active');
        this.elements.roundModal.setAttribute('aria-hidden', 'false');
        this.setBanner('Nueva ronda');
    }

    closeModal() {
        this.elements.roundModal.classList.remove('active');
        this.elements.roundModal.setAttribute('aria-hidden', 'true');
        this.resetField();
    }

    formatMoney(amount) {
        return `${this.currency}${Number(amount).toLocaleString('en-US', {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2
        })}`;
    }
}

document.addEventListener('DOMContentLoaded', () => {
    globalThis.PenaltyShootoutGame = new PenaltyShootoutGame();
});
