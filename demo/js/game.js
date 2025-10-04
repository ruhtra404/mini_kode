class Game {
    constructor() {
        this.canvas = document.getElementById('gameCanvas');
        this.renderer = new Renderer(this.canvas);
        this.car = new Car();
        this.track = new Track();
        
        this.input = {
            forward: false,
            backward: false,
            left: false,
            right: false,
            handbrake: false,
            reset: false
        };
        
        this.gameState = 'racing'; // racing, paused, finished
        this.lapTime = 0;
        this.bestLap = null;
        this.currentLapStart = 0;
        this.raceStartTime = 0;
        
        this.lastTime = 0;
        this.deltaTime = 0;
        this.fps = 0;
        this.frameCount = 0;
        this.fpsUpdateTime = 0;
        
        this.setupEventListeners();
        this.resize();
        this.start();
    }
    
    setupEventListeners() {
        // Keyboard controls
        document.addEventListener('keydown', (e) => {
            switch(e.code) {
                case 'KeyW':
                case 'ArrowUp':
                    this.input.forward = true;
                    e.preventDefault();
                    break;
                case 'KeyS':
                case 'ArrowDown':
                    this.input.backward = true;
                    e.preventDefault();
                    break;
                case 'KeyA':
                case 'ArrowLeft':
                    this.input.left = true;
                    e.preventDefault();
                    break;
                case 'KeyD':
                case 'ArrowRight':
                    this.input.right = true;
                    e.preventDefault();
                    break;
                case 'Space':
                    this.input.handbrake = true;
                    e.preventDefault();
                    break;
                case 'KeyR':
                    this.input.reset = true;
                    e.preventDefault();
                    break;
                case 'KeyP':
                    this.togglePause();
                    e.preventDefault();
                    break;
                case 'KeyF':
                    this.renderer.toggleDebug();
                    e.preventDefault();
                    break;
                case 'KeyT':
                    this.renderer.toggleWireframe();
                    e.preventDefault();
                    break;
            }
        });
        
        document.addEventListener('keyup', (e) => {
            switch(e.code) {
                case 'KeyW':
                case 'ArrowUp':
                    this.input.forward = false;
                    break;
                case 'KeyS':
                case 'ArrowDown':
                    this.input.backward = false;
                    break;
                case 'KeyA':
                case 'ArrowLeft':
                    this.input.left = false;
                    break;
                case 'KeyD':
                case 'ArrowRight':
                    this.input.right = false;
                    break;
                case 'Space':
                    this.input.handbrake = false;
                    break;
                case 'KeyR':
                    this.input.reset = false;
                    break;
            }
        });
        
        // Window resize
        window.addEventListener('resize', () => this.resize());
        
        // Prevent context menu on canvas
        this.canvas.addEventListener('contextmenu', (e) => e.preventDefault());
    }
    
    resize() {
        const width = window.innerWidth;
        const height = window.innerHeight;
        
        this.canvas.width = width;
        this.canvas.height = height;
        this.renderer.setSize(width, height);
    }
    
    start() {
        this.raceStartTime = performance.now();
        this.currentLapStart = this.raceStartTime;
        this.gameState = 'racing';
        this.lastTime = performance.now();
        
        this.gameLoop();
    }
    
    gameLoop(currentTime = performance.now()) {
        this.deltaTime = (currentTime - this.lastTime) / 1000;
        this.lastTime = currentTime;
        
        // Update FPS
        this.frameCount++;
        if (currentTime - this.fpsUpdateTime > 1000) {
            this.fps = this.frameCount;
            this.frameCount = 0;
            this.fpsUpdateTime = currentTime;
        }
        
        if (this.gameState === 'racing') {
            this.update(this.deltaTime);
        }
        
        this.render();
        
        requestAnimationFrame((time) => this.gameLoop(time));
    }
    
    update(deltaTime) {
        // Update car
        this.car.update(deltaTime, this.input);
        
        // Handle track collisions
        if (this.track.checkCollision(this.car.position)) {
            // Simple collision response - reduce speed
            this.car.speed *= 0.5;
        }
        
        // Update lap timing
        this.updateLapTiming();
        
        // Update checkpoints
        this.track.updateCheckpoints(this.car.position);
        
        // Check for lap completion
        if (this.track.checkLapComplete(this.car.position)) {
            this.completeLap();
        }
    }
    
    updateLapTiming() {
        const currentTime = performance.now();
        this.lapTime = (currentTime - this.currentLapStart) / 1000;
        
        // Update UI
        const minutes = Math.floor(this.lapTime / 60);
        const seconds = Math.floor(this.lapTime % 60);
        const milliseconds = Math.floor((this.lapTime % 1) * 100);
        
        const lapTimeElement = document.getElementById('lapTime');
        if (lapTimeElement) {
            lapTimeElement.textContent = `${minutes}:${seconds.toString().padStart(2, '0')}.${milliseconds.toString().padStart(2, '0')}`;
        }
        
        // Update best lap
        if (this.bestLap !== null) {
            const bestMinutes = Math.floor(this.bestLap / 60);
            const bestSeconds = Math.floor(this.bestLap % 60);
            const bestMilliseconds = Math.floor((this.bestLap % 1) * 100);
            
            const bestLapElement = document.getElementById('bestLap');
            if (bestLapElement) {
                bestLapElement.textContent = `${bestMinutes}:${bestSeconds.toString().padStart(2, '0')}.${bestMilliseconds.toString().padStart(2, '0')}`;
            }
        }
    }
    
    completeLap() {
        const lapTime = this.lapTime;
        
        if (this.bestLap === null || lapTime < this.bestLap) {
            this.bestLap = lapTime;
        }
        
        this.currentLapStart = performance.now();
        
        // Reset checkpoints for next lap
        this.track.resetCheckpoints();
        
        console.log(`Lap completed: ${lapTime.toFixed(2)}s`);
    }
    
    render() {
        this.renderer.render(this.car, this.track);
    }
    
    togglePause() {
        if (this.gameState === 'racing') {
            this.gameState = 'paused';
        } else if (this.gameState === 'paused') {
            this.gameState = 'racing';
        }
    }
    
    reset() {
        this.car.reset();
        this.track.resetCheckpoints();
        this.lapTime = 0;
        this.currentLapStart = performance.now();
        this.gameState = 'racing';
    }
    
    getGameInfo() {
        return {
            speed: this.car.getSpeedKMH(),
            lapTime: this.lapTime,
            bestLap: this.bestLap,
            fps: this.fps,
            onTrack: this.track.isOnTrack(this.car.position),
            gameState: this.gameState
        };
    }
}

// Initialize game when page loads
window.addEventListener('load', () => {
    const game = new Game();
    
    // Make game accessible for debugging
    window.game = game;
    
    console.log('3D Racing Game loaded!');
    console.log('Controls:');
    console.log('- WASD or Arrow Keys: Drive');
    console.log('- Space: Handbrake');
    console.log('- R: Reset car');
    console.log('- P: Pause/Resume');
    console.log('- F: Toggle debug info');
    console.log('- T: Toggle wireframe mode');
});