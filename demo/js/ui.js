// UI management for racing game

class UIManager {
    constructor(game) {
        this.game = game;
        this.elements = {};
        this.minimap = null;
        this.raceTimer = null;
        this.lapTimer = null;
        this.bestLapTime = null;
        this.currentLapTime = 0;
        this.isRaceActive = false;
        
        this.setupUIElements();
        this.setupEventListeners();
    }
    
    setupUIElements() {
        // Get UI elements
        this.elements = {
            speedometer: document.getElementById('speed'),
            speedUnit: document.getElementById('speedUnit'),
            position: document.getElementById('positionText'),
            currentLap: document.getElementById('currentLap'),
            bestLap: document.getElementById('bestLap'),
            minimapCanvas: document.getElementById('minimapCanvas'),
            menu: document.getElementById('menu'),
            loading: document.getElementById('loading'),
            loadingProgress: document.getElementById('loadingProgress'),
            controls: document.getElementById('controls')
        };
        
        // Setup minimap
        this.setupMinimap();
        
        // Hide loading screen initially
        this.hideLoading();
    }
    
    setupMinimap() {
        if (!this.elements.minimapCanvas) return;
        
        this.minimap = {
            canvas: this.elements.minimapCanvas,
            ctx: this.elements.minimapCanvas.getContext('2d'),
            scale: 0.5,
            carDotSize: 4,
            trackColor: '#333333',
            carColor: '#00ff00',
            aiColor: '#ff0000'
        };
    }
    
    setupEventListeners() {
        // Menu buttons
        const startButton = document.getElementById('startRace');
        const trackButton = document.getElementById('selectTrack');
        const settingsButton = document.getElementById('settings');
        
        if (startButton) {
            startButton.addEventListener('click', () => {
                this.hideMenu();
                this.game.startRace();
            });
        }
        
        if (trackButton) {
            trackButton.addEventListener('click', () => {
                this.showTrackSelection();
            });
        }
        
        if (settingsButton) {
            settingsButton.addEventListener('click', () => {
                this.showSettings();
            });
        }
        
        // Keyboard shortcuts
        document.addEventListener('keydown', (e) => {
            switch (e.code) {
                case 'Escape':
                    this.toggleMenu();
                    break;
                case 'KeyH':
                    this.toggleControls();
                    break;
                case 'KeyM':
                    this.game.soundManager.toggleSound();
                    break;
            }
        });
    }
    
    update(deltaTime) {
        if (!this.game.isRunning) return;
        
        // Update speed display
        this.updateSpeedDisplay();
        
        // Update position display
        this.updatePositionDisplay();
        
        // Update lap times
        this.updateLapTimes();
        
        // Update minimap
        this.updateMinimap();
    }
    
    updateSpeedDisplay() {
        if (!this.elements.speedometer) return;
        
        const playerCar = this.game.playerCar;
        if (!playerCar) return;
        
        const speed = Math.round(playerCar.getSpeed());
        this.elements.speedometer.textContent = speed;
    }
    
    updatePositionDisplay() {
        if (!this.elements.position) return;
        
        const playerPosition = this.game.getPlayerPosition();
        const totalCars = this.game.getTotalCars();
        
        this.elements.position.textContent = `Position: ${playerPosition}/${totalCars}`;
    }
    
    updateLapTimes() {
        if (!this.elements.currentLap || !this.elements.bestLap) return;
        
        if (this.isRaceActive) {
            this.currentLapTime += 1/60; // Assuming 60 FPS
            
            const currentTime = this.formatTime(this.currentLapTime);
            this.elements.currentLap.textContent = `Lap ${this.game.currentLap}: ${currentTime}`;
            
            if (this.bestLapTime) {
                const bestTime = this.formatTime(this.bestLapTime);
                this.elements.bestLap.textContent = `Best: ${bestTime}`;
            }
        }
    }
    
    updateMinimap() {
        if (!this.minimap || !this.game.track) return;
        
        const ctx = this.minimap.ctx;
        const canvas = this.minimap.canvas;
        
        // Clear canvas
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        
        // Draw track
        this.drawMinimapTrack(ctx);
        
        // Draw cars
        this.drawMinimapCars(ctx);
    }
    
    drawMinimapTrack(ctx) {
        if (!this.game.track.trackPoints || this.game.track.trackPoints.length === 0) return;
        
        ctx.strokeStyle = this.minimap.trackColor;
        ctx.lineWidth = 3;
        ctx.beginPath();
        
        const points = this.game.track.trackPoints;
        const scale = this.minimap.scale;
        const centerX = ctx.canvas.width / 2;
        const centerY = ctx.canvas.height / 2;
        
        // Find track bounds
        let minX = Infinity, maxX = -Infinity, minZ = Infinity, maxZ = -Infinity;
        points.forEach(point => {
            minX = Math.min(minX, point.x);
            maxX = Math.max(maxX, point.x);
            minZ = Math.min(minZ, point.z);
            maxZ = Math.max(maxZ, point.z);
        });
        
        const trackWidth = maxX - minX;
        const trackHeight = maxZ - minZ;
        const scaleFactor = Math.min(ctx.canvas.width / trackWidth, ctx.canvas.height / trackHeight) * scale;
        
        // Draw track outline
        points.forEach((point, index) => {
            const x = centerX + (point.x - (minX + maxX) / 2) * scaleFactor;
            const y = centerY + (point.z - (minZ + maxZ) / 2) * scaleFactor;
            
            if (index === 0) {
                ctx.moveTo(x, y);
            } else {
                ctx.lineTo(x, y);
            }
        });
        
        ctx.stroke();
        
        // Draw start/finish line
        if (points.length > 0) {
            const startPoint = points[0];
            const x = centerX + (startPoint.x - (minX + maxX) / 2) * scaleFactor;
            const y = centerY + (startPoint.z - (minZ + maxZ) / 2) * scaleFactor;
            
            ctx.fillStyle = '#ffffff';
            ctx.fillRect(x - 3, y - 3, 6, 6);
        }
    }
    
    drawMinimapCars(ctx) {
        if (!this.game.playerCar) return;
        
        const scale = this.minimap.scale;
        const centerX = ctx.canvas.width / 2;
        const centerY = ctx.canvas.height / 2;
        
        // Find track bounds
        const points = this.game.track.trackPoints;
        let minX = Infinity, maxX = -Infinity, minZ = Infinity, maxZ = -Infinity;
        points.forEach(point => {
            minX = Math.min(minX, point.x);
            maxX = Math.max(maxX, point.x);
            minZ = Math.min(minZ, point.z);
            maxZ = Math.max(maxZ, point.z);
        });
        
        const trackWidth = maxX - minX;
        const trackHeight = maxZ - minZ;
        const scaleFactor = Math.min(ctx.canvas.width / trackWidth, ctx.canvas.height / trackHeight) * scale;
        
        // Draw player car
        const playerPos = this.game.playerCar.getPosition();
        const playerX = centerX + (playerPos.x - (minX + maxX) / 2) * scaleFactor;
        const playerY = centerY + (playerPos.z - (minZ + maxZ) / 2) * scaleFactor;
        
        ctx.fillStyle = this.minimap.carColor;
        ctx.beginPath();
        ctx.arc(playerX, playerY, this.minimap.carDotSize, 0, 2 * Math.PI);
        ctx.fill();
        
        // Draw AI cars
        if (this.game.aiManager) {
            this.game.aiManager.getAICars().forEach(aiCar => {
                const aiPos = aiCar.getPosition();
                const aiX = centerX + (aiPos.x - (minX + maxX) / 2) * scaleFactor;
                const aiY = centerY + (aiPos.z - (minZ + maxZ) / 2) * scaleFactor;
                
                ctx.fillStyle = this.minimap.aiColor;
                ctx.beginPath();
                ctx.arc(aiX, aiY, this.minimap.carDotSize * 0.8, 0, 2 * Math.PI);
                ctx.fill();
            });
        }
    }
    
    formatTime(seconds) {
        const minutes = Math.floor(seconds / 60);
        const remainingSeconds = Math.floor(seconds % 60);
        const milliseconds = Math.floor((seconds % 1) * 100);
        
        return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}.${milliseconds.toString().padStart(2, '0')}`;
    }
    
    startRace() {
        this.isRaceActive = true;
        this.currentLapTime = 0;
        this.showUI();
    }
    
    endRace() {
        this.isRaceActive = false;
        this.showRaceResults();
    }
    
    completeLap(lapTime) {
        if (!this.bestLapTime || lapTime < this.bestLapTime) {
            this.bestLapTime = lapTime;
        }
        this.currentLapTime = 0;
    }
    
    showMenu() {
        if (this.elements.menu) {
            this.elements.menu.classList.add('active');
        }
    }
    
    hideMenu() {
        if (this.elements.menu) {
            this.elements.menu.classList.remove('active');
        }
    }
    
    toggleMenu() {
        if (this.elements.menu.classList.contains('active')) {
            this.hideMenu();
        } else {
            this.showMenu();
        }
    }
    
    showLoading(progress = 0) {
        if (this.elements.loading) {
            this.elements.loading.classList.add('active');
            this.updateLoadingProgress(progress);
        }
    }
    
    hideLoading() {
        if (this.elements.loading) {
            this.elements.loading.classList.remove('active');
        }
    }
    
    updateLoadingProgress(progress) {
        if (this.elements.loadingProgress) {
            this.elements.loadingProgress.style.width = `${progress * 100}%`;
        }
    }
    
    showUI() {
        // Show all UI elements
        Object.values(this.elements).forEach(element => {
            if (element && element.style) {
                element.style.display = 'block';
            }
        });
    }
    
    hideUI() {
        // Hide all UI elements
        Object.values(this.elements).forEach(element => {
            if (element && element.style) {
                element.style.display = 'none';
            }
        });
    }
    
    toggleControls() {
        if (this.elements.controls) {
            const isVisible = this.elements.controls.style.display !== 'none';
            this.elements.controls.style.display = isVisible ? 'none' : 'flex';
        }
    }
    
    showTrackSelection() {
        // This would show a track selection menu
        console.log('Track selection not implemented yet');
    }
    
    showSettings() {
        // This would show a settings menu
        console.log('Settings not implemented yet');
    }
    
    showRaceResults() {
        // This would show race results
        console.log('Race finished!');
    }
    
    displayMessage(message, duration = 3000) {
        // Create a temporary message display
        const messageDiv = document.createElement('div');
        messageDiv.className = 'game-message';
        messageDiv.textContent = message;
        messageDiv.style.cssText = `
            position: fixed;
            top: 50%;
            left: 50%;
            transform: translate(-50%, -50%);
            background: rgba(0, 0, 0, 0.8);
            color: white;
            padding: 20px;
            border-radius: 10px;
            font-size: 24px;
            z-index: 1000;
            text-align: center;
        `;
        
        document.body.appendChild(messageDiv);
        
        setTimeout(() => {
            if (messageDiv.parentNode) {
                messageDiv.parentNode.removeChild(messageDiv);
            }
        }, duration);
    }
    
    setVolume(type, volume) {
        switch (type) {
            case 'master':
                this.game.soundManager.setMasterVolume(volume);
                break;
            case 'sfx':
                this.game.soundManager.setSFXVolume(volume);
                break;
            case 'music':
                this.game.soundManager.setMusicVolume(volume);
                break;
        }
    }
}

// HUD elements for racing
class RacingHUD {
    constructor(uiManager) {
        this.uiManager = uiManager;
        this.elements = {};
        this.createHUDElements();
    }
    
    createHUDElements() {
        // Create additional HUD elements
        this.createGearIndicator();
        this.createRPMGauge();
        this.createPositionIndicator();
        this.createLapCounter();
    }
    
    createGearIndicator() {
        const gearDiv = document.createElement('div');
        gearDiv.id = 'gearIndicator';
        gearDiv.className = 'hud-element';
        gearDiv.style.cssText = `
            position: absolute;
            bottom: 120px;
            right: 30px;
            background: rgba(0, 0, 0, 0.7);
            padding: 10px;
            border-radius: 5px;
            border: 2px solid #00ffff;
            font-size: 24px;
            font-weight: bold;
            color: #00ffff;
            text-align: center;
            min-width: 40px;
        `;
        
        document.getElementById('ui').appendChild(gearDiv);
        this.elements.gear = gearDiv;
    }
    
    createRPMGauge() {
        const rpmDiv = document.createElement('div');
        rpmDiv.id = 'rpmGauge';
        rpmDiv.className = 'hud-element';
        rpmDiv.style.cssText = `
            position: absolute;
            bottom: 200px;
            right: 30px;
            background: rgba(0, 0, 0, 0.7);
            padding: 10px;
            border-radius: 5px;
            border: 2px solid #ff6600;
            font-size: 18px;
            font-weight: bold;
            color: #ff6600;
            text-align: center;
            min-width: 80px;
        `;
        
        document.getElementById('ui').appendChild(rpmDiv);
        this.elements.rpm = rpmDiv;
    }
    
    createPositionIndicator() {
        const positionDiv = document.createElement('div');
        positionDiv.id = 'positionIndicator';
        positionDiv.className = 'hud-element';
        positionDiv.style.cssText = `
            position: absolute;
            top: 100px;
            right: 30px;
            background: rgba(0, 0, 0, 0.7);
            padding: 10px;
            border-radius: 5px;
            border: 2px solid #ffff00;
            font-size: 16px;
            font-weight: bold;
            color: #ffff00;
            text-align: center;
        `;
        
        document.getElementById('ui').appendChild(positionDiv);
        this.elements.positionIndicator = positionDiv;
    }
    
    createLapCounter() {
        const lapDiv = document.createElement('div');
        lapDiv.id = 'lapCounter';
        lapDiv.className = 'hud-element';
        lapDiv.style.cssText = `
            position: absolute;
            top: 150px;
            left: 30px;
            background: rgba(0, 0, 0, 0.7);
            padding: 10px;
            border-radius: 5px;
            border: 2px solid #00ff00;
            font-size: 18px;
            font-weight: bold;
            color: #00ff00;
            text-align: center;
        `;
        
        document.getElementById('ui').appendChild(lapDiv);
        this.elements.lapCounter = lapDiv;
    }
    
    update() {
        const playerCar = this.uiManager.game.playerCar;
        if (!playerCar) return;
        
        // Update gear indicator
        if (this.elements.gear) {
            this.elements.gear.textContent = playerCar.getGear();
        }
        
        // Update RPM gauge
        if (this.elements.rpm) {
            const rpm = Math.round(playerCar.getRPM());
            this.elements.rpm.textContent = `${rpm} RPM`;
        }
        
        // Update position indicator
        if (this.elements.positionIndicator) {
            const position = this.uiManager.game.getPlayerPosition();
            const total = this.uiManager.game.getTotalCars();
            this.elements.positionIndicator.textContent = `P${position}/${total}`;
        }
        
        // Update lap counter
        if (this.elements.lapCounter) {
            const currentLap = this.uiManager.game.currentLap;
            const totalLaps = this.uiManager.game.totalLaps;
            this.elements.lapCounter.textContent = `Lap ${currentLap}/${totalLaps}`;
        }
    }
}

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        UIManager,
        RacingHUD
    };
}