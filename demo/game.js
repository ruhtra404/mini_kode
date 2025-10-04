class RaceCarGame {
    constructor() {
        this.scene = null;
        this.camera = null;
        this.renderer = null;
        this.car = null;
        this.track = null;
        this.keys = {};
        this.gameStarted = false;
        this.lapStartTime = 0;
        this.currentLapTime = 0;
        
        // Car physics
        this.carSpeed = 0;
        this.carMaxSpeed = 200;
        this.carAcceleration = 0.5;
        this.carFriction = 0.95;
        this.carTurnSpeed = 0.03;
        this.carDirection = 0;
        
        this.init();
    }
    
    init() {
        this.setupScene();
        this.createTrack();
        this.createCar();
        this.setupCamera();
        this.setupControls();
        this.setupLighting();
        this.animate();
        
        // Hide loading screen
        document.getElementById('loading').style.display = 'none';
        this.gameStarted = true;
        this.lapStartTime = Date.now();
    }
    
    setupScene() {
        this.scene = new THREE.Scene();
        this.scene.background = new THREE.Color(0x87CEEB); // Sky blue
        
        this.renderer = new THREE.WebGLRenderer({ antialias: true });
        this.renderer.setSize(window.innerWidth, window.innerHeight);
        this.renderer.shadowMap.enabled = true;
        this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
        
        document.getElementById('gameContainer').appendChild(this.renderer.domElement);
        
        window.addEventListener('resize', () => {
            this.camera.aspect = window.innerWidth / window.innerHeight;
            this.camera.updateProjectionMatrix();
            this.renderer.setSize(window.innerWidth, window.innerHeight);
        });
    }
    
    createTrack() {
        // Create a simple oval track
        const trackGroup = new THREE.Group();
        
        // Track surface
        const trackGeometry = new THREE.RingGeometry(80, 120, 0, Math.PI * 2);
        const trackMaterial = new THREE.MeshLambertMaterial({ color: 0x333333 });
        const trackMesh = new THREE.Mesh(trackGeometry, trackMaterial);
        trackMesh.rotation.x = -Math.PI / 2;
        trackMesh.receiveShadow = true;
        trackGroup.add(trackMesh);
        
        // Track borders
        const innerBorderGeometry = new THREE.TorusGeometry(80, 2, 8, 32);
        const borderMaterial = new THREE.MeshLambertMaterial({ color: 0xFFFFFF });
        const innerBorder = new THREE.Mesh(innerBorderGeometry, borderMaterial);
        innerBorder.rotation.x = -Math.PI / 2;
        innerBorder.position.y = 1;
        trackGroup.add(innerBorder);
        
        const outerBorderGeometry = new THREE.TorusGeometry(120, 2, 8, 32);
        const outerBorder = new THREE.Mesh(outerBorderGeometry, borderMaterial);
        outerBorder.rotation.x = -Math.PI / 2;
        outerBorder.position.y = 1;
        trackGroup.add(outerBorder);
        
        // Start/finish line
        const startLineGeometry = new THREE.PlaneGeometry(40, 4);
        const startLineMaterial = new THREE.MeshLambertMaterial({ color: 0xFFFFFF });
        const startLine = new THREE.Mesh(startLineGeometry, startLineMaterial);
        startLine.rotation.x = -Math.PI / 2;
        startLine.position.set(100, 0.1, 0);
        trackGroup.add(startLine);
        
        // Checkpoints
        this.checkpoints = [
            { x: 100, z: 0, radius: 30 },
            { x: 0, z: 100, radius: 30 },
            { x: -100, z: 0, radius: 30 },
            { x: 0, z: -100, radius: 30 }
        ];
        
        this.track = trackGroup;
        this.scene.add(trackGroup);
    }
    
    createCar() {
        const carGroup = new THREE.Group();
        
        // Car body
        const bodyGeometry = new THREE.BoxGeometry(4, 1.5, 8);
        const bodyMaterial = new THREE.MeshLambertMaterial({ color: 0xFF0000 });
        const carBody = new THREE.Mesh(bodyGeometry, bodyMaterial);
        carBody.position.y = 1;
        carBody.castShadow = true;
        carGroup.add(carBody);
        
        // Car roof
        const roofGeometry = new THREE.BoxGeometry(3, 1, 4);
        const roofMaterial = new THREE.MeshLambertMaterial({ color: 0xCC0000 });
        const carRoof = new THREE.Mesh(roofGeometry, roofMaterial);
        carRoof.position.set(0, 2, -1);
        carRoof.castShadow = true;
        carGroup.add(carRoof);
        
        // Wheels
        const wheelGeometry = new THREE.CylinderGeometry(0.8, 0.8, 0.5, 8);
        const wheelMaterial = new THREE.MeshLambertMaterial({ color: 0x222222 });
        
        const wheelPositions = [
            { x: -1.5, y: 0.8, z: 2.5 },   // Front left
            { x: 1.5, y: 0.8, z: 2.5 },    // Front right
            { x: -1.5, y: 0.8, z: -2.5 },  // Rear left
            { x: 1.5, y: 0.8, z: -2.5 }    // Rear right
        ];
        
        wheelPositions.forEach(pos => {
            const wheel = new THREE.Mesh(wheelGeometry, wheelMaterial);
            wheel.position.set(pos.x, pos.y, pos.z);
            wheel.rotation.z = Math.PI / 2;
            wheel.castShadow = true;
            carGroup.add(wheel);
        });
        
        // Position car at start
        carGroup.position.set(90, 0, 0);
        carGroup.rotation.y = Math.PI / 2;
        
        this.car = carGroup;
        this.scene.add(carGroup);
    }
    
    setupCamera() {
        this.camera = new THREE.PerspectiveCamera(
            75,
            window.innerWidth / window.innerHeight,
            0.1,
            1000
        );
        
        // Position camera behind the car
        this.camera.position.set(0, 15, 20);
        this.camera.lookAt(this.car.position);
    }
    
    setupControls() {
        document.addEventListener('keydown', (event) => {
            this.keys[event.code] = true;
        });
        
        document.addEventListener('keyup', (event) => {
            this.keys[event.code] = false;
        });
    }
    
    setupLighting() {
        // Ambient light
        const ambientLight = new THREE.AmbientLight(0x404040, 0.6);
        this.scene.add(ambientLight);
        
        // Directional light (sun)
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
    }
    
    updateCar() {
        if (!this.car) return;
        
        // Handle input
        let accelerating = false;
        let braking = false;
        let turning = 0;
        
        if (this.keys['KeyW'] || this.keys['ArrowUp']) {
            accelerating = true;
        }
        if (this.keys['KeyS'] || this.keys['ArrowDown']) {
            braking = true;
        }
        if (this.keys['KeyA'] || this.keys['ArrowLeft']) {
            turning = -1;
        }
        if (this.keys['KeyD'] || this.keys['ArrowRight']) {
            turning = 1;
        }
        
        // Update car physics
        if (accelerating) {
            this.carSpeed = Math.min(this.carSpeed + this.carAcceleration, this.carMaxSpeed);
        } else if (braking) {
            this.carSpeed = Math.max(this.carSpeed - this.carAcceleration * 2, -this.carMaxSpeed / 2);
        } else {
            this.carSpeed *= this.carFriction;
        }
        
        // Only allow turning if car is moving
        if (Math.abs(this.carSpeed) > 5) {
            this.carDirection += turning * this.carTurnSpeed * (this.carSpeed / this.carMaxSpeed);
        }
        
        // Update car position
        const moveDistance = this.carSpeed * 0.01;
        this.car.position.x += Math.sin(this.carDirection) * moveDistance;
        this.car.position.z += Math.cos(this.carDirection) * moveDistance;
        this.car.rotation.y = -this.carDirection;
        
        // Keep car on track (simple boundary check)
        const distanceFromCenter = Math.sqrt(
            this.car.position.x * this.car.position.x + 
            this.car.position.z * this.car.position.z
        );
        
        if (distanceFromCenter < 80 || distanceFromCenter > 120) {
            // Slow down car if off track
            this.carSpeed *= 0.5;
        }
        
        // Update camera to follow car
        const cameraOffset = new THREE.Vector3(
            Math.sin(this.carDirection) * -20,
            15,
            Math.cos(this.carDirection) * -20
        );
        
        this.camera.position.copy(this.car.position).add(cameraOffset);
        this.camera.lookAt(this.car.position);
    }
    
    updateUI() {
        // Update speed display
        const speedKmh = Math.abs(Math.round(this.carSpeed));
        document.getElementById('speed').textContent = speedKmh;
        
        // Update lap time
        if (this.gameStarted) {
            this.currentLapTime = Date.now() - this.lapStartTime;
            const minutes = Math.floor(this.currentLapTime / 60000);
            const seconds = Math.floor((this.currentLapTime % 60000) / 1000);
            document.getElementById('lapTime').textContent = 
                `${minutes}:${seconds.toString().padStart(2, '0')}`;
        }
    }
    
    animate() {
        requestAnimationFrame(() => this.animate());
        
        this.updateCar();
        this.updateUI();
        this.renderer.render(this.scene, this.camera);
    }
}

// Start the game when page loads
window.addEventListener('load', () => {
    new RaceCarGame();
});