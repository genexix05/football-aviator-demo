/**
 * TuZoca Penalty Shootout
 * Front-end game shell prepared for external aggregator control.
 */

class PenaltyShootoutGame {
    constructor() {
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
            collectWinnings: document.getElementById('collectWinnings'),
            actionHint: document.getElementById('actionHint'),
            roundStatus: document.getElementById('roundStatus'),
            currentMultiplier: document.getElementById('currentMultiplier'),
            shotCounter: document.getElementById('shotCounter'),
            currentBetDisplay: document.getElementById('currentBetDisplay'),
            potentialWinDisplay: document.getElementById('potentialWinDisplay'),
            historyList: document.getElementById('historyList'),
            resultBanner: document.getElementById('resultBanner'),
            ball: document.getElementById('ball'),
            keeper: document.getElementById('keeper'),
            roundModal: document.getElementById('roundModal'),
            modalTitle: document.getElementById('modalTitle'),
            modalAmount: document.getElementById('modalAmount'),
            modalDetail: document.getElementById('modalDetail'),
            closeModal: document.getElementById('closeModal'),
            goalZones: [...document.querySelectorAll('.goal-zone')],
            multiplierSteps: [...document.querySelectorAll('.multiplier-track li')]
        };

        this.bindEvents();
        this.updateUI();
        this.setZonesEnabled(false);
    }

    bindEvents() {
        this.elements.startRound.addEventListener('click', () => this.startRound());
        this.elements.collectWinnings.addEventListener('click', () => this.requestCollect());
        this.elements.closeModal.addEventListener('click', () => this.closeModal());
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

        const betAmount = Number.parseFloat(this.elements.betAmount.value);
        if (!Number.isFinite(betAmount) || betAmount <= 0) {
            this.setBanner('Introduce una apuesta valida.');
            return;
        }

        if (!this.externalWallet && betAmount > this.balance) {
            this.setBanner('Saldo demo insuficiente.');
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
        this.elements.collectWinnings.disabled = true;
        this.setZonesEnabled(true);
        this.setBanner('Selecciona una de las 6 zonas para lanzar.');
        this.emit('round-started', this.getRoundState());
        this.updateUI();
    }

    selectZone(zone) {
        if (!this.isRoundActive || this.awaitingResolution || !this.zoneCoordinates[zone]) return;

        this.awaitingResolution = true;
        this.setZonesEnabled(false);
        this.clearZoneStates();
        this.markZone(zone, 'selected');
        this.animateShot(zone);
        this.setBanner('Disparo enviado. Esperando resolucion del agregador...');

        const payload = {
            ...this.getRoundState(),
            requestedZone: zone,
            nextMultiplier: this.getNextMultiplier()
        };

        this.emit('shot-requested', payload);

        if (this.autoResolveDemo) {
            window.setTimeout(() => {
                this.resolveShot({
                    scored: true,
                    zone,
                    goalkeeperZone: this.getDemoKeeperZone(zone),
                    transactionId: `demo-${Date.now()}`
                });
            }, 650);
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

        if (!scored) {
            this.finishRound({
                status: 'loss',
                payout: 0,
                detail: 'El portero detuvo el penalti.',
                transactionId: result.transactionId
            });
            return;
        }

        this.goals += 1;
        this.history.unshift({ status: 'win', multiplier: this.getCurrentMultiplier(), goals: this.goals });
        this.history = this.history.slice(0, 12);

        if (this.goals === this.multipliers.length) {
            this.setBanner('Gol y multiplicador maximo x12 desbloqueado. Cobra el premio.');
            this.setZonesEnabled(false);
        } else {
            this.setBanner(`Gol ${this.goals}. Puedes cobrar o volver a tirar.`);
            this.setZonesEnabled(true);
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
        this.elements.collectWinnings.disabled = true;
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
            'top-right': 'bottom-center',
            'bottom-left': 'top-right',
            'bottom-center': 'top-left',
            'bottom-right': 'top-center'
        };
        return demoMap[zone] || 'top-left';
    }

    emit(name, detail) {
        window.dispatchEvent(new CustomEvent(`penalty:${name}`, { detail }));
    }

    updateUI() {
        this.elements.balance.textContent = this.formatMoney(this.balance);
        this.elements.roundStatus.textContent = this.getStatusLabel();
        this.elements.currentMultiplier.textContent = `x${this.getCurrentMultiplier().toFixed(2)}`;
        this.elements.shotCounter.textContent = `${this.goals}/${this.multipliers.length}`;
        this.elements.currentBetDisplay.textContent = this.formatMoney(this.currentBet);
        this.updatePayoutPreview();
        this.updateMultiplierTrack();
        this.renderHistory();
    }

    getStatusLabel() {
        if (this.awaitingResolution) return 'Resolviendo disparo';
        if (this.isRoundActive && this.goals > 0) return 'Gol confirmado';
        if (this.isRoundActive) return 'Porteria activa';
        return 'Prepara tu apuesta';
    }

    updatePayoutPreview() {
        const baseBet = this.currentBet || Number.parseFloat(this.elements.betAmount.value) || 0;
        const multiplier = this.isRoundActive ? this.getCurrentMultiplier() : this.multipliers[0];
        const preview = baseBet * multiplier;
        this.elements.potentialWinDisplay.textContent = this.formatMoney(preview);
    }

    updateMultiplierTrack() {
        this.elements.multiplierSteps.forEach((step, index) => {
            const stepNumber = index + 1;
            step.classList.toggle('completed', stepNumber <= this.goals);
            step.classList.toggle('current', this.isRoundActive && stepNumber === this.goals + 1);
        });
    }

    renderHistory() {
        this.elements.historyList.innerHTML = '';

        if (this.history.length === 0) {
            this.elements.historyList.textContent = 'Sin rondas todavia.';
            return;
        }

        this.history.forEach((item) => {
            const element = document.createElement('span');
            element.className = `history-item ${item.status}`;
            element.textContent = item.status === 'loss' ? 'Atajada' : `${item.goals}G x${item.multiplier}`;
            this.elements.historyList.appendChild(element);
        });
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
        const coordinates = this.zoneCoordinates[zoneName];
        this.elements.ball.classList.add('kicked');
        this.elements.ball.style.left = coordinates.left;
        this.elements.ball.style.top = coordinates.top;
        this.elements.ball.style.bottom = 'auto';
    }

    moveKeeper(zoneName) {
        const coordinates = this.zoneCoordinates[zoneName] || this.zoneCoordinates['bottom-center'];
        const horizontalOffset = Number.parseInt(coordinates.left, 10) - 50;
        const verticalOffset = Number.parseInt(coordinates.top, 10) < 40 ? -28 : 18;
        this.elements.keeper.style.transform = `translateX(calc(-50% + ${horizontalOffset * 4}px)) translateY(${verticalOffset}px)`;
    }

    resetField() {
        this.clearZoneStates();
        this.elements.keeper.style.transform = 'translateX(-50%)';
        this.elements.ball.classList.remove('kicked');
        this.elements.ball.style.left = '50%';
        this.elements.ball.style.top = '';
        this.elements.ball.style.bottom = '42px';
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
        this.elements.modalTitle.textContent = won ? 'Cobro registrado' : 'Penalti atajado';
        this.elements.modalAmount.textContent = won ? this.formatMoney(payout) : `-${this.formatMoney(this.currentBet)}`;
        this.elements.modalAmount.classList.toggle('loss', !won);
        this.elements.modalDetail.textContent = detail || (won ? 'Liquidacion enviada al agregador.' : 'Ronda finalizada sin premio.');
        this.elements.roundModal.classList.add('active');
        this.elements.roundModal.setAttribute('aria-hidden', 'false');
        this.setBanner('Prepara una nueva apuesta.');
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
    window.PenaltyShootoutGame = new PenaltyShootoutGame();
});
