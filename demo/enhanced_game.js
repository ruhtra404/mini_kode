class EnhancedRaceCarGame {
    constructor() {
        this.scene = null;
        this.camera = null;
        this.renderer = null;
        this.car = null;
        this.track = null;
        this.keys = {};
        this.gameState = 'menu'; // menu, racing, paused
        this.cameraMode = 0; // 0: behind, 1: cockpit, 2: overhead, 3: cinematic
        
        // Enhanced physics
        this.carSpeed = 0;
        this.carMaxSpeed = 280;
        this.carAcceleration = 0.8;
        this.carFriction = 0.92;
        this.carTurnSpeed = 0.04;
        this.carDirection = 0;
        this.carDrift = 0;
        this.carVelocity = new THREE.Vector3();
        this.carAngularVelocity = 0;
        
        // Boost system
        this.boost = 100;
        this.boostMax = 100;
        this.boostRegenRate = 0.5;
        this.boostPower = 1.5;
        
        // Game logic
        this.currentLap = 1;
        this.totalLaps = 3;
        this.lapStartTime = 0;
        this.currentLapTime = 0;
        this.bestLapTime = localStorage.getItem('bestLapTime') || null;
        this.totalRaces = parseInt(localStorage.getItem('totalRaces') || '0');
        this.checkpoints = [];
        this.currentCheckpoint = 0;
        this.lapTimes = [];
        
        // AI opponents
        this.aiCars = [];
        this.aiCount = 3;
        
        // Particles
        this.particleSystems = [];
        this.exhaustParticles = [];
        this.dustParticles = [];
        
        // Audio
        this.audioContext = null;
        this.engineSound = null;
        this.tireSound = null;
        this.boostSound = null;
        
        // Weather
        this.weather = 'clear'; // clear, rain, fog
        this.rainParticles = null;
        
        this.init();
    }
    
    init() {
        this.setupScene();
        this.createEnhancedTrack();
        this.createEnhancedCar();
        this.createAIOpponents();
        this.setupCameras();
        this.setupControls();
        this.setupLighting();
        this.setupAudio();
        this.createParticleSystems();
        this.setupWeather();
        this.setupMinimap();
        
        // Update menu stats
        this.updateMenuStats();
        
        // Show menu
        document.getElementById('loading').style.display = 'none';
        document.getElementById('menu').style.display = 'block';
    }
    
    setupScene() {
        this.scene = new THREE.Scene();
        this.scene.background = new THREE.Color(0x87CEEB);
        this.scene.fog = new THREE.Fog(0x87CEEB, 100, 500);
        
        this.renderer = new THREE.WebGLRenderer({ antialias: true });
        this.renderer.setSize(window.innerWidth, window.innerHeight);
        this.renderer.shadowMap.enabled = true;
        this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
        this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
        this.renderer.toneMappingExposure = 1.2;
        
        document.getElementById('gameContainer').appendChild(this.renderer.domElement);
        
        window.addEventListener('resize', () => this.onWindowResize());
    }
    
    createEnhancedTrack() {
        const trackGroup = new THREE.Group();
        
        // Create elevated track with curves
        const trackPoints = [];
        const radius = 100;
        const elevation = 10;
        
        for (let i = 0; i <= 64; i++) {
            const angle = (i / 64) * Math.PI * 2;
            const x = Math.cos(angle) * radius;
            const z = Math.sin(angle) * radius;
            const y = Math.sin(angle * 4) * elevation;
            trackPoints.push(new THREE.Vector3(x, y, z));
        }
        
        // Track surface with elevation
        const trackCurve = new THREE.CatmullRomCurve3(trackPoints, true);
        const trackGeometry = new THREE.TubeGeometry(trackCurve, 128, 20, 8, true);
        const trackMaterial = new THREE.MeshLambertMaterial({ 
            color: 0x2c3e50,
            transparent: true,
            opacity: 0.9
        });
        const trackMesh = new THREE.Mesh(trackGeometry, trackMaterial);
        trackMesh.receiveShadow = true;
        trackGroup.add(trackMesh);
        
        // Track borders with height variation
        const borderGeometry = new THREE.TubeGeometry(trackCurve, 128, 22, 8, true);
        const borderMaterial = new THREE.MeshLambertMaterial({ color: 0xe74c3c });
        const borderMesh = new THREE.Mesh(borderGeometry, borderMaterial);
        borderMesh.scale.set(1, 0.1, 1);
        borderMesh.position.y = 0.5;
        trackGroup.add(borderMesh);
        
        // Start/finish line with grandstands
        const startLineGeometry = new THREE.PlaneGeometry(40, 4);
        const startLineMaterial = new THREE.MeshLambertMaterial({ 
            color: 0xFFFFFF,
            transparent: true,
            opacity: 0.8
        });
        const startLine = new THREE.Mesh(startLineGeometry, startLineMaterial);
        startLine.rotation.x = -Math.PI / 2;
        startLine.position.set(100, 1, 0);
        trackGroup.add(startLine);
        
        // Grandstands
        const grandstandGeometry = new THREE.BoxGeometry(60, 15, 8);
        const grandstandMaterial = new THREE.MeshLambertMaterial({ color: 0x34495e });
        const grandstand = new THREE.Mesh(grandstandGeometry, grandstandMaterial);
        grandstand.position.set(100, 7.5, -30);
        grandstand.castShadow = true;
        trackGroup.add(grandstand);
        
        // Checkpoints
        this.checkpoints = [];
        for (let i = 0; i < 8; i++) {
            const angle = (i / 8) * Math.PI * 2;
            const x = Math.cos(angle) * 100;
            const z = Math.sin(angle) * 100;
            this.checkpoints.push({
                x: x,
                z: z,
                radius: 25,
                passed: false
            });
        }
        
        // Environment
        this.createEnvironment();
        
        this.track = trackGroup;
        this.scene.add(trackGroup);
    }
    
    createEnvironment() {
        // Trees
        for (let i = 0; i < 50; i++) {
            const treeGroup = new THREE.Group();
            
            // Trunk
            const trunkGeometry = new THREE.CylinderGeometry(1, 2, 8);
            const trunkMaterial = new THREE.MeshLambertMaterial({ color: 0x8B4513 });
            const trunk = new THREE.Mesh(trunkGeometry, trunkMaterial);
            trunk.position.y = 4;
            trunk.castShadow = true;
            treeGroup.add(trunk);
            
            // Leaves
            const leavesGeometry = new THREE.SphereGeometry(6);
            const leavesMaterial = new THREE.MeshLambertMaterial({ color: 0x228B22 });
            const leaves = new THREE.Mesh(leavesGeometry, leavesMaterial);
            leaves.position.y = 10;
            leaves.castShadow = true;
            treeGroup.add(leaves);
            
            // Random position
            const angle = Math.random() * Math.PI * 2;
            const radius = 150 + Math.random() * 100;
            treeGroup.position.x = Math.cos(angle) * radius;
            treeGroup.position.z = Math.sin(angle) * radius;
            treeGroup.position.y = Math.sin(angle * 4) * 5;
            
            this.scene.add(treeGroup);
        }
        
        // Clouds
        for (let i = 0; i < 20; i++) {
            const cloudGeometry = new THREE.SphereGeometry(10 + Math.random() * 5);
            const cloudMaterial = new THREE.MeshLambertMaterial({ 
                color: 0xFFFFFF,
                transparent: true,
                opacity: 0.7
            });
            const cloud = new THREE.Mesh(cloudGeometry, cloudMaterial);
            cloud.position.set(
                (Math.random() - 0.5) * 500,
                100 + Math.random() * 50,
                (Math.random() - 0.5) * 500
            );
            this.scene.add(cloud);
        }
    }
    
    createEnhancedCar() {
        const carGroup = new THREE.Group();
        
        // Car body with more detail
        const bodyGeometry = new THREE.BoxGeometry(4, 1.2, 8);
        const bodyMaterial = new THREE.MeshLambertMaterial({ 
            color: 0xFF4444,
            shininess: 100
        });
        const carBody = new THREE.Mesh(bodyGeometry, bodyMaterial);
        carBody.position.y = 1;
        carBody.castShadow = true;
        carGroup.add(carBody);
        
        // Car hood
        const hoodGeometry = new THREE.BoxGeometry(3.5, 0.3, 3);
        const hoodMaterial = new THREE.MeshLambertMaterial({ color: 0xCC3333 });
        const carHood = new THREE.Mesh(hoodGeometry, hoodMaterial);
        carHood.position.set(0, 1.8, 2.5);
        carHood.castShadow = true;
        carGroup.add(carHood);
        
        // Windshield
        const windshieldGeometry = new THREE.PlaneGeometry(3, 2);
        const windshieldMaterial = new THREE.MeshLambertMaterial({ 
            color: 0x87CEEB,
            transparent: true,
            opacity: 0.3
        });
        const windshield = new THREE.Mesh(windshieldGeometry, windshieldMaterial);
        windshield.position.set(0, 2, 1);
        windshield.rotation.x = -0.3;
        carGroup.add(windshield);
        
        // Spoiler
        const spoilerGeometry = new THREE.BoxGeometry(4, 0.5, 1);
        const spoilerMaterial = new THREE.MeshLambertMaterial({ color: 0x333333 });
        const spoiler = new THREE.Mesh(spoilerGeometry, spoilerMaterial);
        spoiler.position.set(0, 2, -4);
        spoiler.castShadow = true;
        carGroup.add(spoiler);
        
        // Enhanced wheels with rims
        const wheelGeometry = new THREE.CylinderGeometry(0.8, 0.8, 0.6, 12);
        const wheelMaterial = new THREE.MeshLambertMaterial({ color: 0x111111 });
        const rimGeometry = new THREE.CylinderGeometry(0.5, 0.5, 0.7, 8);
        const rimMaterial = new THREE.MeshLambertMaterial({ color: 0xCCCCCC });
        
        const wheelPositions = [
            { x: -1.8, y: 0.8, z: 2.8 },   // Front left
            { x: 1.8, y: 0.8, z: 2.8 },    // Front right
            { x: -1.8, y: 0.8, z: -2.8 },  // Rear left
            { x: 1.8, y: 0.8, z: -2.8 }    // Rear right
        ];
        
        this.wheels = [];
        wheelPositions.forEach((pos, index) => {
            const wheelGroup = new THREE.Group();
            
            // Tire
            const wheel = new THREE.Mesh(wheelGeometry, wheelMaterial);
            wheel.rotation.z = Math.PI / 2;
            wheel.castShadow = true;
            wheelGroup.add(wheel);
            
            // Rim
            const rim = new THREE.Mesh(rimGeometry, rimMaterial);
            rim.rotation.z = Math.PI / 2;
            rim.castShadow = true;
            wheelGroup.add(rim);
            
            wheelGroup.position.set(pos.x, pos.y, pos.z);
            carGroup.add(wheelGroup);
            this.wheels.push(wheelGroup);
        });
        
        // Headlights
        const headlightGeometry = new THREE.SphereGeometry(0.3);
        const headlightMaterial = new THREE.MeshLambertMaterial({ 
            color: 0xFFFFFF,
            emissive: 0x444444
        });
        
        const leftHeadlight = new THREE.Mesh(headlightGeometry, headlightMaterial);
        leftHeadlight.position.set(-1, 1.2, 4.2);
        carGroup.add(leftHeadlight);
        
        const rightHeadlight = new THREE.Mesh(headlightGeometry, headlightMaterial);
        rightHeadlight.position.set(1, 1.2, 4.2);
        carGroup.add(rightHeadlight);
        
        // Position car at start
        carGroup.position.set(90, 5, 0);
        carGroup.rotation.y = Math.PI / 2;
        
        this.car = carGroup;
        this.scene.add(carGroup);
    }
    
    createAIOpponents() {
        const aiColors = [0x0066FF, 0x00FF66, 0xFF6600];
        
        for (let i = 0; i < this.aiCount; i++) {
            const aiCar = this.createAICar(aiColors[i]);
            
            // Position AI cars at start
            const startAngle = (i + 1) * (Math.PI * 2 / (this.aiCount + 1));
            aiCar.position.set(
                90 + Math.cos(startAngle) * 10,
                5,
                Math.sin(startAngle) * 10
            );
            aiCar.rotation.y = Math.PI / 2;
            
            this.aiCars.push({
                mesh: aiCar,
                speed: 0,
                direction: Math.PI / 2,
                targetSpeed: 150 + Math.random() * 50,
                skill: 0.8 + Math.random() * 0.2,
                currentCheckpoint: 0,
                lap: 1
            });
            
            this.scene.add(aiCar);
        }
    }
    
    createAICar(color) {
        const carGroup = new THREE.Group();
        
        const bodyGeometry = new THREE.BoxGeometry(4, 1.2, 8);
        const bodyMaterial = new THREE.MeshLambertMaterial({ color: color });
        const carBody = new THREE.Mesh(bodyGeometry, bodyMaterial);
        carBody.position.y = 1;
        carBody.castShadow = true;
        carGroup.add(carBody);
        
        // Simplified wheels
        const wheelGeometry = new THREE.CylinderGeometry(0.8, 0.8, 0.6, 8);
        const wheelMaterial = new THREE.MeshLambertMaterial({ color: 0x111111 });
        
        const wheelPositions = [
            { x: -1.8, y: 0.8, z: 2.8 },
            { x: 1.8, y: 0.8, z: 2.8 },
            { x: -1.8, y: 0.8, z: -2.8 },
            { x: 1.8, y: 0.8, z: -2.8 }
        ];
        
        wheelPositions.forEach(pos => {
            const wheel = new THREE.Mesh(wheelGeometry, wheelMaterial);
            wheel.position.set(pos.x, pos.y, pos.z);
            wheel.rotation.z = Math.PI / 2;
            wheel.castShadow = true;
            carGroup.add(wheel);
        });
        
        return carGroup;
    }
    
    setupCameras() {
        this.camera = new THREE.PerspectiveCamera(
            75,
            window.innerWidth / window.innerHeight,
            0.1,
            1000
        );
        
        this.cameraPositions = [
            { offset: new THREE.Vector3(0, 5, 12), lookAt: new THREE.Vector3(0, 0, 0) }, // Behind
            { offset: new THREE.Vector3(0, 1, 0), lookAt: new THREE.Vector3(0, 0, 10) },  // Cockpit
            { offset: new THREE.Vector3(0, 30, 0), lookAt: new THREE.Vector3(0, 0, 0) },  // Overhead
            { offset: new THREE.Vector3(15, 8, 15), lookAt: new THREE.Vector3(0, 0, 0) }  // Cinematic
        ];
    }
    
    setupControls() {
        document.addEventListener('keydown', (event) => {
            this.keys[event.code] = true;
            
            if (event.code === 'KeyC') {
                this.cameraMode = (this.cameraMode + 1) % this.cameraPositions.length;
            }
            
            if (event.code === 'Escape') {
                this.togglePause();
            }
        });
        
        document.addEventListener('keyup', (event) => {
            this.keys[event.code] = false;
        });
    }
    
    setupLighting() {
        // Ambient light
        const ambientLight = new THREE.AmbientLight(0x404040, 0.4);
        this.scene.add(ambientLight);
        
        // Main directional light (sun)
        const directionalLight = new THREE.DirectionalLight(0xFFFFFF, 0.8);
        directionalLight.position.set(50, 100, 50);
        directionalLight.castShadow = true;
        directionalLight.shadow.mapSize.width = 2048;
        directionalLight.shadow.mapSize.height = 2048;
        directionalLight.shadow.camera.near = 0.5;
        directionalLight.shadow.camera.far = 500;
        directionalLight.shadow.camera.left = -200;
        directionalLight.shadow.camera.right = 200;
        directionalLight.shadow.camera.top = 200;
        directionalLight.shadow.camera.bottom = -200;
        this.scene.add(directionalLight);
        
        // Car headlights
        this.headlightLeft = new THREE.SpotLight(0xFFFFFF, 1, 50, Math.PI / 6);
        this.headlightLeft.position.set(-1, 1.2, 4.2);
        this.headlightLeft.target.position.set(-1, 0, 10);
        this.car.add(this.headlightLeft);
        this.car.add(this.headlightLeft.target);
        
        this.headlightRight = new THREE.SpotLight(0xFFFFFF, 1, 50, Math.PI / 6);
        this.headlightRight.position.set(1, 1.2, 4.2);
        this.headlightRight.target.position.set(1, 0, 10);
        this.car.add(this.headlightRight);
        this.car.add(this.headlightRight.target);
    }
    
    setupAudio() {
        try {
            this.audioContext = new (window.AudioContext || window.webkitAudioContext)();
            this.createEngineSound();
        } catch (e) {
            console.log('Audio not supported');
        }
    }
    
    createEngineSound() {
        if (!this.audioContext) return;
        
        // Create engine sound using Web Audio API
        const oscillator = this.audioContext.createOscillator();
        const gainNode = this.audioContext.createGain();
        
        oscillator.connect(gainNode);
        gainNode.connect(this.audioContext.destination);
        
        oscillator.type = 'sawtooth';
        oscillator.frequency.setValueAtTime(100, this.audioContext.currentTime);
        gainNode.gain.setValueAtTime(0.1, this.audioContext.currentTime);
        
        this.engineSound = { oscillator, gainNode };
    }
    
    createParticleSystems() {
        // Exhaust particles
        this.exhaustParticleSystem = this.createParticleSystem(0x666666, 50);
        this.car.add(this.exhaustParticleSystem);
        this.exhaustParticleSystem.position.set(0, 0.5, -4);
        
        // Dust particles for drifting
        this.dustParticleSystem = this.createParticleSystem(0xD2B48C, 100);
        this.scene.add(this.dustParticleSystem);
    }
    
    createParticleSystem(color, maxParticles) {
        const geometry = new THREE.BufferGeometry();
        const positions = new Float32Array(maxParticles * 3);
        const velocities = new Float32Array(maxParticles * 3);
        
        for (let i = 0; i < maxParticles; i++) {
            positions[i * 3] = 0;
            positions[i * 3 + 1] = 0;
            positions[i * 3 + 2] = 0;
            
            velocities[i * 3] = (Math.random() - 0.5) * 0.1;
            velocities[i * 3 + 1] = Math.random() * 0.1;
            velocities[i * 3 + 2] = (Math.random() - 0.5) * 0.1;
        }
        
        geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
        geometry.setAttribute('velocity', new THREE.BufferAttribute(velocities, 3));
        
        const material = new THREE.PointsMaterial({
            color: color,
            size: 0.5,
            transparent: true,
            opacity: 0.6
        });
        
        return new THREE.Points(geometry, material);
    }
    
    setupWeather() {
        // Rain particles
        if (this.weather === 'rain') {
            this.createRain();
        }
    }
    
    createRain() {
        const rainGeometry = new THREE.BufferGeometry();
        const rainCount = 1000;
        const positions = new Float32Array(rainCount * 3);
        
        for (let i = 0; i < rainCount; i++) {
            positions[i * 3] = (Math.random() - 0.5) * 400;
            positions[i * 3 + 1] = Math.random() * 200;
            positions[i * 3 + 2] = (Math.random() - 0.5) * 400;
        }
        
        rainGeometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
        
        const rainMaterial = new THREE.PointsMaterial({
            color: 0x87CEEB,
            size: 0.1,
            transparent: true,
            opacity: 0.6
        });
        
        this.rainParticles = new THREE.Points(rainGeometry, rainMaterial);
        this.scene.add(this.rainParticles);
    }
    
    setupMinimap() {
        this.minimapCanvas = document.getElementById('minimap');
        this.minimapCtx = this.minimapCanvas.getContext('2d');
        this.minimapCanvas.width = 150;
        this.minimapCanvas.height = 150;
    }
    
    updateCar() {
        if (!this.car || this.gameState !== 'racing') return;
        
        // Handle input
        let accelerating = false;
        let braking = false;
        let turning = 0;
        let boosting = false;
        
        if (this.keys['KeyW'] || this.keys['ArrowUp']) accelerating = true;
        if (this.keys['KeyS'] || this.keys['ArrowDown']) braking = true;
        if (this.keys['KeyA'] || this.keys['ArrowLeft']) turning = -1;
        if (this.keys['KeyD'] || this.keys['ArrowRight']) turning = 1;
        if (this.keys['Space']) boosting = true;
        
        // Enhanced physics
        const speedMultiplier = boosting && this.boost > 0 ? this.boostPower : 1;
        
        if (accelerating) {
            this.carSpeed = Math.min(this.carSpeed + this.carAcceleration * speedMultiplier, this.carMaxSpeed * speedMultiplier);
            if (boosting && this.boost > 0) {
                this.boost -= 2;
                this.createBoostEffect();
            }
        } else if (braking) {
            this.carSpeed = Math.max(this.carSpeed - this.carAcceleration * 2, -this.carMaxSpeed * 0.5);
        } else {
            this.carSpeed *= this.carFriction;
        }
        
        // Regenerate boost
        if (!boosting && this.boost < this.boostMax) {
            this.boost += this.boostRegenRate;
        }
        
        // Enhanced turning with drift
        if (Math.abs(this.carSpeed) > 10) {
            const speedFactor = this.carSpeed / this.carMaxSpeed;
            const turnAmount = turning * this.carTurnSpeed * speedFactor;
            
            // Drift mechanics
            if (Math.abs(turning) > 0.5 && this.carSpeed > 150) {
                this.carDrift += (turning * 0.1 - this.carDrift) * 0.1;
                this.createDriftEffect();
            } else {
                this.carDrift *= 0.95;
            }
            
            this.carDirection += turnAmount + this.carDrift;
        }
        
        // Update position
        const moveDistance = this.carSpeed * 0.01;
        this.car.position.x += Math.sin(this.carDirection) * moveDistance;
        this.car.position.z += Math.cos(this.carDirection) * moveDistance;
        this.car.rotation.y = -this.carDirection;
        
        // Update wheel rotation
        this.wheels.forEach(wheel => {
            wheel.rotation.x += this.carSpeed * 0.01;
        });
        
        // Track elevation
        const trackHeight = Math.sin(this.carDirection * 4) * 10;
        this.car.position.y = 5 + trackHeight;
        
        // Boundary check
        const distanceFromCenter = Math.sqrt(
            this.car.position.x * this.car.position.x + 
            this.car.position.z * this.car.position.z
        );
        
        if (distanceFromCenter < 80 || distanceFromCenter > 120) {
            this.carSpeed *= 0.3;
        }
        
        // Check checkpoints
        this.checkCheckpoint();
        
        // Update camera
        this.updateCamera();
        
        // Update particles
        this.updateParticles();
        
        // Update audio
        this.updateAudio();
    }
    
    updateAIOpponents() {
        this.aiCars.forEach((aiCar, index) => {
            // Simple AI logic
            const targetCheckpoint = this.checkpoints[aiCar.currentCheckpoint];
            const dx = targetCheckpoint.x - aiCar.mesh.position.x;
            const dz = targetCheckpoint.z - aiCar.mesh.position.z;
            const distance = Math.sqrt(dx * dx + dz * dz);
            
            if (distance < targetCheckpoint.radius) {
                aiCar.currentCheckpoint = (aiCar.currentCheckpoint + 1) % this.checkpoints.length;
                if (aiCar.currentCheckpoint === 0) {
                    aiCar.lap++;
                }
            }
            
            // Move towards checkpoint
            aiCar.direction = Math.atan2(dx, dz);
            aiCar.speed = Math.min(aiCar.speed + 0.5, aiCar.targetSpeed);
            
            aiCar.mesh.position.x += Math.sin(aiCar.direction) * aiCar.speed * 0.01;
            aiCar.mesh.position.z += Math.cos(aiCar.direction) * aiCar.speed * 0.01;
            aiCar.mesh.rotation.y = -aiCar.direction;
            
            // Track elevation for AI
            const aiTrackHeight = Math.sin(aiCar.direction * 4) * 10;
            aiCar.mesh.position.y = 5 + aiTrackHeight;
        });
    }
    
    checkCheckpoint() {
        const currentCheckpoint = this.checkpoints[this.currentCheckpoint];
        const dx = currentCheckpoint.x - this.car.position.x;
        const dz = currentCheckpoint.z - this.car.position.z;
        const distance = Math.sqrt(dx * dx + dz * dz);
        
        if (distance < currentCheckpoint.radius) {
            currentCheckpoint.passed = true;
            this.currentCheckpoint = (this.currentCheckpoint + 1) % this.checkpoints.length;
            
            // Completed lap
            if (this.currentCheckpoint === 0) {
                this.completeLap();
            }
        }
    }
    
    completeLap() {
        this.currentLap++;
        this.currentLapTime = Date.now() - this.lapStartTime;
        this.lapTimes.push(this.currentLapTime);
        
        // Update best lap time
        if (!this.bestLapTime || this.currentLapTime < this.bestLapTime) {
            this.bestLapTime = this.currentLapTime;
            localStorage.setItem('bestLapTime', this.bestLapTime);
        }
        
        // Reset for next lap
        this.lapStartTime = Date.now();
        
        // Check if race is complete
        if (this.currentLap > this.totalLaps) {
            this.endRace();
        }
    }
    
    createBoostEffect() {
        // Create boost flame particles
        if (this.exhaustParticleSystem) {
            const positions = this.exhaustParticleSystem.geometry.attributes.position.array;
            for (let i = 0; i < 10; i++) {
                positions[i * 3] = (Math.random() - 0.5) * 2;
                positions[i * 3 + 1] = Math.random() * 2;
                positions[i * 3 + 2] = -Math.random() * 5;
            }
            this.exhaustParticleSystem.geometry.attributes.position.needsUpdate = true;
        }
    }
    
    createDriftEffect() {
        // Create dust particles when drifting
        if (this.dustParticleSystem) {
            const positions = this.dustParticleSystem.geometry.attributes.position.array;
            for (let i = 0; i < 20; i++) {
                positions[i * 3] = this.car.position.x + (Math.random() - 0.5) * 10;
                positions[i * 3 + 1] = this.car.position.y + Math.random() * 2;
                positions[i * 3 + 2] = this.car.position.z + (Math.random() - 0.5) * 10;
            }
            this.dustParticleSystem.geometry.attributes.position.needsUpdate = true;
        }
    }
    
    updateParticles() {
        // Update rain
        if (this.rainParticles) {
            const positions = this.rainParticles.geometry.attributes.position.array;
            for (let i = 0; i < positions.length; i += 3) {
                positions[i + 1] -= 2; // Fall down
                if (positions[i + 1] < 0) {
                    positions[i + 1] = 200; // Reset to top
                }
            }
            this.rainParticles.geometry.attributes.position.needsUpdate = true;
        }
    }
    
    updateCamera() {
        if (!this.car) return;
        
        const cameraConfig = this.cameraPositions[this.cameraMode];
        
        if (this.cameraMode === 0) { // Behind car
            const offset = new THREE.Vector3(
                Math.sin(this.carDirection) * -15,
                8,
                Math.cos(this.carDirection) * -15
            );
            this.camera.position.copy(this.car.position).add(offset);
            this.camera.lookAt(this.car.position);
        } else if (this.cameraMode === 1) { // Cockpit
            this.camera.position.copy(this.car.position);
            this.camera.position.y += 2;
            this.camera.rotation.y = -this.carDirection;
        } else if (this.cameraMode === 2) { // Overhead
            this.camera.position.set(this.car.position.x, 50, this.car.position.z);
            this.camera.lookAt(this.car.position);
        } else { // Cinematic
            const time = Date.now() * 0.001;
            const offset = new THREE.Vector3(
                Math.sin(time * 0.5) * 20,
                15,
                Math.cos(time * 0.3) * 20
            );
            this.camera.position.copy(this.car.position).add(offset);
            this.camera.lookAt(this.car.position);
        }
    }
    
    updateAudio() {
        if (this.engineSound && this.audioContext) {
            const frequency = 100 + (this.carSpeed / this.carMaxSpeed) * 200;
            this.engineSound.oscillator.frequency.setValueAtTime(frequency, this.audioContext.currentTime);
        }
    }
    
    updateUI() {
        if (this.gameState !== 'racing') return;
        
        // Speed
        const speedKmh = Math.abs(Math.round(this.carSpeed));
        document.getElementById('speed').textContent = speedKmh;
        document.getElementById('speedFill').style.width = `${(speedKmh / this.carMaxSpeed) * 100}%`;
        
        // Boost
        if (this.boost < this.boostMax) {
            document.getElementById('boostBar').style.display = 'block';
            document.getElementById('boostFill').style.width = `${(this.boost / this.boostMax) * 100}%`;
        } else {
            document.getElementById('boostBar').style.display = 'none';
        }
        
        // Lap info
        document.getElementById('currentLap').textContent = this.currentLap;
        document.getElementById('totalLaps').textContent = this.totalLaps;
        
        // Lap time
        this.currentLapTime = Date.now() - this.lapStartTime;
        const minutes = Math.floor(this.currentLapTime / 60000);
        const seconds = Math.floor((this.currentLapTime % 60000) / 1000);
        const milliseconds = Math.floor((this.currentLapTime % 1000) / 10);
        document.getElementById('lapTime').textContent = 
            `${minutes}:${seconds.toString().padStart(2, '0')}.${milliseconds.toString().padStart(2, '0')}`;
        
        // Best lap
        if (this.bestLapTime) {
            const bestMinutes = Math.floor(this.bestLapTime / 60000);
            const bestSeconds = Math.floor((this.bestLapTime % 60000) / 1000);
            document.getElementById('bestLapTime').textContent = 
                `${bestMinutes}:${bestSeconds.toString().padStart(2, '0')}`;
        }
        
        // Position
        let position = 1;
        this.aiCars.forEach(aiCar => {
            if (aiCar.lap > this.currentLap || 
                (aiCar.lap === this.currentLap && aiCar.currentCheckpoint > this.currentCheckpoint)) {
                position++;
            }
        });
        document.getElementById('position').textContent = position;
        
        // Update minimap
        this.updateMinimap();
    }
    
    updateMinimap() {
        const ctx = this.minimapCtx;
        const size = 150;
        const scale = 0.6;
        
        // Clear
        ctx.fillStyle = 'rgba(0, 0, 0, 0.8)';
        ctx.fillRect(0, 0, size, size);
        
        // Draw track
        ctx.strokeStyle = '#666';
        ctx.lineWidth = 2;
        ctx.beginPath();
        for (let i = 0; i <= 64; i++) {
            const angle = (i / 64) * Math.PI * 2;
            const x = size/2 + Math.cos(angle) * 50 * scale;
            const y = size/2 + Math.sin(angle) * 50 * scale;
            if (i === 0) ctx.moveTo(x, y);
            else ctx.lineTo(x, y);
        }
        ctx.stroke();
        
        // Draw player car
        ctx.fillStyle = '#FF0000';
        ctx.beginPath();
        const playerX = size/2 + (this.car.position.x * scale);
        const playerY = size/2 + (this.car.position.z * scale);
        ctx.arc(playerX, playerY, 3, 0, Math.PI * 2);
        ctx.fill();
        
        // Draw AI cars
        ctx.fillStyle = '#00FF00';
        this.aiCars.forEach(aiCar => {
            ctx.beginPath();
            const aiX = size/2 + (aiCar.mesh.position.x * scale);
            const aiY = size/2 + (aiCar.mesh.position.z * scale);
            ctx.arc(aiX, aiY, 2, 0, Math.PI * 2);
            ctx.fill();
        });
    }
    
    onWindowResize() {
        this.camera.aspect = window.innerWidth / window.innerHeight;
        this.camera.updateProjectionMatrix();
        this.renderer.setSize(window.innerWidth, window.innerHeight);
    }
    
    startRace() {
        this.gameState = 'racing';
        this.currentLap = 1;
        this.currentCheckpoint = 0;
        this.lapStartTime = Date.now();
        this.totalRaces++;
        localStorage.setItem('totalRaces', this.totalRaces);
        
        document.getElementById('menu').style.display = 'none';
        
        if (this.audioContext) {
            this.audioContext.resume();
            if (this.engineSound) {
                this.engineSound.oscillator.start();
            }
        }
        
        this.animate();
    }
    
    endRace() {
        this.gameState = 'finished';
        
        // Show results
        const resultsDiv = document.createElement('div');
        resultsDiv.style.cssText = `
            position: absolute;
            top: 50%;
            left: 50%;
            transform: translate(-50%, -50%);
            background: rgba(0, 0, 0, 0.9);
            color: white;
            padding: 30px;
            border-radius: 15px;
            text-align: center;
            z-index: 400;
        `;
        
        resultsDiv.innerHTML = `
            <h2>🏁 RACE COMPLETE! 🏁</h2>
            <div>Final Position: ${document.getElementById('position').textContent}</div>
            <div>Best Lap: ${document.getElementById('bestLapTime').textContent}</div>
            <button class="menu-button" onclick="location.reload()">🏠 MAIN MENU</button>
        `;
        
        document.body.appendChild(resultsDiv);
    }
    
    togglePause() {
        if (this.gameState === 'racing') {
            this.gameState = 'paused';
            document.getElementById('menu').style.display = 'block';
        } else if (this.gameState === 'paused') {
            this.gameState = 'racing';
            document.getElementById('menu').style.display = 'none';
        }
    }
    
    updateMenuStats() {
        if (this.bestLapTime) {
            const minutes = Math.floor(this.bestLapTime / 60000);
            const seconds = Math.floor((this.bestLapTime % 60000) / 1000);
            document.getElementById('bestLap').textContent = 
                `${minutes}:${seconds.toString().padStart(2, '0')}`;
        }
        document.getElementById('totalRaces').textContent = this.totalRaces;
    }
    
    animate() {
        if (this.gameState === 'racing') {
            requestAnimationFrame(() => this.animate());
        }
        
        this.updateCar();
        this.updateAIOpponents();
        this.updateUI();
        this.renderer.render(this.scene, this.camera);
    }
}

// Global game instance
let game;

// Start the game
window.addEventListener('load', () => {
    game = new EnhancedRaceCarGame();
});