// AI opponents with intelligent racing behavior

class AICar {
    constructor(scene, physics, track, position, carType = 'sports', difficulty = 'medium') {
        this.scene = scene;
        this.physics = physics;
        this.track = track;
        this.position = position.clone();
        this.carType = carType;
        this.difficulty = difficulty;
        
        // AI properties
        this.skillLevel = this.getSkillLevel(difficulty);
        this.reactionTime = this.getReactionTime(difficulty);
        this.aggressiveness = this.getAggressiveness(difficulty);
        
        // Racing state
        this.currentTargetPoint = 0;
        this.targetPosition = new THREE.Vector3();
        this.racingLine = [];
        this.currentLap = 0;
        this.racePosition = 0;
        this.lapTimes = [];
        
        // Car state
        this.speed = 0;
        this.steering = 0;
        this.throttle = 0;
        this.brake = 0;
        this.steeringSmoothness = 0.1;
        this.throttleSmoothness = 0.05;
        
        // Behavior parameters
        this.idealSpeed = 0;
        this.brakingDistance = 30;
        this.corneringSpeed = 0.7;
        this.overtakingAggression = 0;
        this.defensiveDriving = false;
        
        // Sensors
        this.forwardSensor = new THREE.Raycaster();
        this.sideSensors = [];
        this.sensorRange = 20;
        this.avoidanceVector = new THREE.Vector3();
        
        // Setup AI car
        this.car = new Car(scene, physics, position);
        this.setupAIProperties();
        this.generateRacingLine();
        this.setupSensors();
    }
    
    getSkillLevel(difficulty) {
        const levels = {
            'easy': 0.6,
            'medium': 0.8,
            'hard': 0.95,
            'expert': 1.0
        };
        return levels[difficulty] || 0.8;
    }
    
    getReactionTime(difficulty) {
        const times = {
            'easy': 0.5,
            'medium': 0.3,
            'hard': 0.2,
            'expert': 0.1
        };
        return times[difficulty] || 0.3;
    }
    
    getAggressiveness(difficulty) {
        const levels = {
            'easy': 0.3,
            'medium': 0.6,
            'hard': 0.8,
            'expert': 0.9
        };
        return levels[difficulty] || 0.6;
    }
    
    setupAIProperties() {
        // Apply car type properties with AI skill adjustments
        const carProps = CarTypes.getCarType(this.carType);
        this.car.maxSpeed = carProps.maxSpeed * this.skillLevel;
        this.car.acceleration = carProps.acceleration * this.skillLevel;
        this.car.handling = carProps.handling * this.skillLevel;
        this.car.braking = carProps.braking * this.skillLevel;
        
        // Change car color to differentiate from player
        const aiColors = [0x0066cc, 0x00cc66, 0xcc6600, 0xcc0066, 0x66cc00];
        const color = aiColors[Math.floor(Math.random() * aiColors.length)];
        this.car.chassis.material.color.setHex(color);
    }
    
    generateRacingLine() {
        // Generate optimal racing line based on track geometry
        this.racingLine = [];
        
        for (let i = 0; i < this.track.trackPoints.length; i++) {
            const current = this.track.trackPoints[i];
            const next = this.track.trackPoints[(i + 1) % this.track.trackPoints.length];
            const prev = this.track.trackPoints[(i - 1 + this.track.trackPoints.length) % this.track.trackPoints.length];
            
            // Calculate racing line point
            const racingPoint = this.calculateRacingLinePoint(prev, current, next, i);
            this.racingLine.push(racingPoint);
        }
    }
    
    calculateRacingLinePoint(prev, current, next, index) {
        // Simple racing line: apex late for corners, center for straights
        const prevDir = new THREE.Vector3().subVectors(current, prev).normalize();
        const nextDir = new THREE.Vector3().subVectors(next, current).normalize();
        const turnAngle = prevDir.angleTo(nextDir);
        
        let offset = new THREE.Vector3(0, 0, 0);
        
        if (turnAngle > 0.2) {
            // Corner - aim for late apex
            const cornerDirection = new THREE.Vector3().addVectors(prevDir, nextDir).normalize();
            const perpendicular = new THREE.Vector3(-cornerDirection.z, 0, cornerDirection.x);
            offset = perpendicular.multiplyScalar(this.track.trackWidth * 0.3 * (index % 2 === 0 ? 1 : -1));
        }
        
        return {
            position: current.clone().add(offset),
            idealSpeed: this.calculateIdealSpeed(turnAngle),
            isCorner: turnAngle > 0.2,
            cornerAngle: turnAngle
        };
    }
    
    calculateIdealSpeed(turnAngle) {
        // Calculate ideal speed based on corner angle
        const baseSpeed = this.car.maxSpeed * 0.8;
        const speedReduction = Math.min(turnAngle * 100, 0.6);
        return baseSpeed * (1 - speedReduction) * this.skillLevel;
    }
    
    setupSensors() {
        // Setup collision avoidance sensors
        for (let i = 0; i < 5; i++) {
            const angle = (i - 2) * 0.3; // -60, -30, 0, 30, 60 degrees
            this.sideSensors.push({
                angle: angle,
                distance: this.sensorRange,
                hit: false,
                object: null
            });
        }
    }
    
    update(deltaTime, opponents = []) {
        // Update sensors
        this.updateSensors(opponents);
        
        // Determine current target
        this.updateTargetPoint();
        
        // Calculate desired behavior
        this.calculateDesiredBehavior();
        
        // Apply smooth controls
        this.applySmoothControls(deltaTime);
        
        // Update physics
        const aiInput = this.generateAIInput();
        this.car.update({ getMovementInput: () => aiInput }, deltaTime);
        
        // Update state
        this.updateState();
        
        // Handle racing events
        this.handleRacingEvents();
    }
    
    updateSensors(opponents) {
        const carPosition = this.car.getPosition();
        const carDirection = new THREE.Vector3(0, 0, 1).applyQuaternion(this.car.getRotation());
        
        // Reset sensors
        this.sideSensors.forEach(sensor => {
            sensor.hit = false;
            sensor.object = null;
        });
        
        // Check each opponent
        opponents.forEach(opponent => {
            if (opponent === this) return;
            
            const opponentPos = opponent.car.getPosition();
            const toOpponent = new THREE.Vector3().subVectors(opponentPos, carPosition);
            const distance = toOpponent.length();
            
            if (distance < this.sensorRange) {
                const angle = carDirection.angleTo(toOpponent.normalize());
                const sensorIndex = Math.round(angle / 0.3) + 2;
                
                if (sensorIndex >= 0 && sensorIndex < this.sideSensors.length) {
                    this.sideSensors[sensorIndex].hit = true;
                    this.sideSensors[sensorIndex].object = opponent;
                    this.sideSensors[sensorIndex].distance = distance;
                }
            }
        });
    }
    
    updateTargetPoint() {
        const carPosition = this.car.getPosition();
        let bestDistance = Infinity;
        let bestIndex = 0;
        
        // Find closest racing line point
        for (let i = 0; i < this.racingLine.length; i++) {
            const distance = carPosition.distanceTo(this.racingLine[i].position);
            if (distance < bestDistance) {
                bestDistance = distance;
                bestIndex = i;
            }
        }
        
        // Look ahead based on speed
        const speed = this.car.getSpeed();
        const lookAhead = Math.floor(speed / 20) + 3;
        this.currentTargetPoint = (bestIndex + lookAhead) % this.racingLine.length;
        this.targetPosition = this.racingLine[this.currentTargetPoint].position.clone();
    }
    
    calculateDesiredBehavior() {
        const carPosition = this.car.getPosition();
        const carDirection = new THREE.Vector3(0, 0, 1).applyQuaternion(this.car.getRotation());
        const targetDirection = new THREE.Vector3().subVectors(this.targetPosition, carPosition).normalize();
        
        // Calculate steering
        const steeringAngle = this.calculateSteeringAngle(carDirection, targetDirection);
        this.steering = MathUtils.clamp(steeringAngle * 2, -1, 1);
        
        // Calculate throttle/brake
        const targetSpeed = this.racingLine[this.currentTargetPoint].idealSpeed;
        const currentSpeed = this.car.getSpeed();
        const speedDifference = targetSpeed - currentSpeed;
        
        if (speedDifference > 10) {
            this.throttle = 1.0;
            this.brake = 0;
        } else if (speedDifference < -5) {
            this.throttle = 0;
            this.brake = Math.min(Math.abs(speedDifference) / 50, 1);
        } else {
            this.throttle = 0.7;
            this.brake = 0;
        }
        
        // Apply avoidance behavior
        this.applyAvoidanceBehavior();
        
        // Apply racing behavior
        this.applyRacingBehavior();
    }
    
    calculateSteeringAngle(carDirection, targetDirection) {
        // Calculate angle between car direction and target direction
        const cross = carDirection.cross(targetDirection);
        const angle = Math.asin(MathUtils.clamp(cross.y, -1, 1));
        return angle;
    }
    
    applyAvoidanceBehavior() {
        // Check sensors for obstacles
        let avoidanceSteering = 0;
        let avoidanceThrottle = 0;
        
        this.sideSensors.forEach((sensor, index) => {
            if (sensor.hit) {
                const avoidanceStrength = (this.sensorRange - sensor.distance) / this.sensorRange;
                const steeringDirection = (index - 2) * -0.5; // Steer away from obstacle
                
                avoidanceSteering += steeringDirection * avoidanceStrength;
                avoidanceThrottle -= avoidanceStrength * 0.5;
            }
        });
        
        // Apply avoidance to controls
        this.steering += avoidanceSteering * this.aggressiveness;
        this.throttle = Math.max(0, this.throttle + avoidanceThrottle);
    }
    
    applyRacingBehavior() {
        // Overtaking behavior
        const frontSensor = this.sideSensors[2]; // Center sensor
        if (frontSensor.hit && frontSensor.object) {
            const opponent = frontSensor.object;
            const opponentSpeed = opponent.car.getSpeed();
            const mySpeed = this.car.getSpeed();
            
            if (mySpeed > opponentSpeed * 0.9) {
                // Try to overtake
                this.overtakingAggression = Math.min(this.overtakingAggression + 0.1, 1);
                
                // Choose overtaking side based on racing line
                const leftClear = !this.sideSensors[1].hit && !this.sideSensors[0].hit;
                const rightClear = !this.sideSensors[3].hit && !this.sideSensors[4].hit;
                
                if (leftClear && Math.random() < 0.7) {
                    this.steering -= 0.3 * this.overtakingAggression;
                    this.throttle = Math.min(1, this.throttle + 0.2);
                } else if (rightClear) {
                    this.steering += 0.3 * this.overtakingAggression;
                    this.throttle = Math.min(1, this.throttle + 0.2);
                }
            } else {
                // Follow and wait for opportunity
                this.overtakingAggression = Math.max(this.overtakingAggression - 0.05, 0);
                this.throttle = Math.min(this.throttle, 0.8);
            }
        } else {
            this.overtakingAggression = Math.max(this.overtakingAggression - 0.1, 0);
        }
        
        // Defensive driving
        if (this.defensiveDriving) {
            // Block overtaking attempts
            const leftThreat = this.sideSensors[1].hit || this.sideSensors[0].hit;
            const rightThreat = this.sideSensors[3].hit || this.sideSensors[4].hit;
            
            if (leftThreat) {
                this.steering += 0.2;
            } else if (rightThreat) {
                this.steering -= 0.2;
            }
        }
    }
    
    applySmoothControls(deltaTime) {
        // Smooth steering
        const steeringDiff = this.steering - this.car.steering;
        this.car.steering += steeringDiff * this.steeringSmoothness;
        
        // Smooth throttle
        const throttleDiff = this.throttle - this.car.throttle;
        this.car.throttle += throttleDiff * this.throttleSmoothness;
        
        // Apply brake
        this.car.brake = this.brake;
    }
    
    generateAIInput() {
        return {
            forward: this.throttle > 0.1,
            backward: false,
            left: this.steering < -0.1,
            right: this.steering > 0.1,
            brake: this.brake > 0.1,
            boost: false // AI doesn't use boost for now
        };
    }
    
    updateState() {
        this.speed = this.car.getSpeed();
        this.position = this.car.getPosition();
    }
    
    handleRacingEvents() {
        // Check for lap completion
        const trackProgress = this.track.getTrackProgress(this.position);
        if (trackProgress < 0.1 && this.currentTargetPoint > this.racingLine.length * 0.8) {
            this.completeLap();
        }
    }
    
    completeLap() {
        this.currentLap++;
        const currentTime = Date.now();
        if (this.lapTimes.length > 0) {
            const lapTime = currentTime - this.lapTimes[this.lapTimes.length - 1];
            console.log(`AI ${this.difficulty} completed lap ${this.currentLap} in ${lapTime / 1000}s`);
        }
        this.lapTimes.push(currentTime);
    }
    
    getSpeed() {
        return this.car.getSpeed();
    }
    
    getPosition() {
        return this.car.getPosition();
    }
    
    getLapTime() {
        return this.lapTimes.length > 0 ? this.lapTimes[this.lapTimes.length - 1] : 0;
    }
    
    getCurrentLap() {
        return this.currentLap;
    }
    
    setRacePosition(position) {
        this.racePosition = position;
    }
    
    reset(position) {
        this.car.reset(position);
        this.currentTargetPoint = 0;
        this.currentLap = 0;
        this.lapTimes = [];
        this.overtakingAggression = 0;
        this.defensiveDriving = false;
    }
    
    destroy() {
        this.car.destroy();
    }
}

class AIRacingManager {
    constructor(scene, physics, track) {
        this.scene = scene;
        this.physics = physics;
        this.track = track;
        this.aiCars = [];
        this.difficulty = 'medium';
        this.aiCount = 3;
    }
    
    createAIOpponents(count, difficulty = 'medium') {
        this.aiCount = count;
        this.difficulty = difficulty;
        
        // Create AI cars at starting positions
        for (let i = 0; i < count; i++) {
            const startPosition = this.track.getStartPosition();
            startPosition.x += (i + 1) * 8; // Stagger starting positions
            startPosition.z += (i + 1) * 5;
            
            const carTypes = ['sports', 'muscle', 'formula', 'rally'];
            const carType = carTypes[i % carTypes.length];
            
            const aiCar = new AICar(this.scene, this.physics, this.track, startPosition, carType, difficulty);
            this.aiCars.push(aiCar);
        }
    }
    
    update(deltaTime) {
        // Update all AI cars
        this.aiCars.forEach(aiCar => {
            aiCar.update(deltaTime, this.aiCars);
        });
        
        // Update race positions
        this.updateRacePositions();
    }
    
    updateRacePositions() {
        // Sort AI cars by track progress
        const aiPositions = this.aiCars.map((aiCar, index) => ({
            aiCar: aiCar,
            progress: this.track.getTrackProgress(aiCar.getPosition()),
            index: index
        }));
        
        aiPositions.sort((a, b) => b.progress - a.progress);
        
        // Update race positions
        aiPositions.forEach((item, position) => {
            item.aiCar.setRacePosition(position + 2); // +2 because player is position 1
        });
    }
    
    getAICars() {
        return this.aiCars;
    }
    
    getLeader() {
        let leader = null;
        let bestProgress = -1;
        
        this.aiCars.forEach(aiCar => {
            const progress = this.track.getTrackProgress(aiCar.getPosition());
            if (progress > bestProgress) {
                bestProgress = progress;
                leader = aiCar;
            }
        });
        
        return leader;
    }
    
    reset() {
        this.aiCars.forEach((aiCar, index) => {
            const startPosition = this.track.getStartPosition();
            startPosition.x += (index + 1) * 8;
            startPosition.z += (index + 1) * 5;
            aiCar.reset(startPosition);
        });
    }
    
    destroy() {
        this.aiCars.forEach(aiCar => aiCar.destroy());
        this.aiCars = [];
    }
}

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        AICar,
        AIRacingManager
    };
}