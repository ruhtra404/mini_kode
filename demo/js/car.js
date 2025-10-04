class Car {
    constructor() {
        this.position = new Vector3(0, 0.5, 0);
        this.velocity = new Vector3(0, 0, 0);
        this.acceleration = new Vector3(0, 0, 0);
        
        this.forward = new Vector3(0, 0, 1);
        this.right = new Vector3(1, 0, 0);
        this.up = new Vector3(0, 1, 0);
        
        this.speed = 0;
        this.maxSpeed = 200;
        this.accelerationForce = 100;
        this.brakeForce = 150;
        this.friction = 0.95;
        this.turnSpeed = 0.03;
        
        this.steering = 0;
        this.throttle = 0;
        this.brake = 0;
        
        this.width = 2;
        this.height = 1;
        this.length = 4;
        
        this.wheelBase = 2.5;
        this.trackWidth = 1.8;
        
        this.onGround = true;
        this.mass = 1000;
        
        this.wheelRotation = 0;
        this.bodyRoll = 0;
        this.bodyPitch = 0;
        
        this.color = '#' + Math.floor(Math.random()*16777215).toString(16).padStart(6, '0');
    }
    
    update(deltaTime, input) {
        this.handleInput(input);
        this.updatePhysics(deltaTime);
        this.updateVisuals(deltaTime);
    }
    
    handleInput(input) {
        this.throttle = 0;
        this.brake = 0;
        this.steering = 0;
        
        if (input.forward) this.throttle = 1;
        if (input.backward) this.brake = 1;
        if (input.left) this.steering = -1;
        if (input.right) this.steering = 1;
        if (input.handbrake) this.brake = 1.5;
        
        if (input.reset) {
            this.reset();
        }
    }
    
    updatePhysics(deltaTime) {
        const dt = deltaTime;
        
        if (this.speed > 0.1) {
            const turnAmount = this.steering * this.turnSpeed * (this.speed / this.maxSpeed);
            this.forward = this.forward.rotateY(turnAmount);
            this.right = this.forward.cross(this.up);
        }
        
        const engineForce = this.throttle * this.accelerationForce;
        const brakeForce = this.brake * this.brakeForce;
        
        const dragForce = this.speed * this.speed * 0.001;
        const rollingResistance = this.speed * 0.5;
        
        const totalForce = engineForce - brakeForce - dragForce - rollingResistance;
        
        this.speed += totalForce * dt;
        this.speed = Math.max(0, Math.min(this.speed, this.maxSpeed));
        
        if (this.speed < 0.1 && this.brake > 0) {
            this.speed = Math.max(this.speed - this.brakeForce * dt * 0.5, -this.maxSpeed * 0.3);
        }
        
        this.velocity = this.forward.multiply(this.speed);
        
        this.position = this.position.add(this.velocity.multiply(dt));
        
        this.wheelRotation += this.speed * dt * 0.1;
        
        this.bodyRoll = this.steering * Math.min(this.speed / this.maxSpeed, 1) * 0.2;
        this.bodyPitch = (this.throttle - this.brake * 0.5) * Math.min(this.speed / this.maxSpeed, 1) * 0.1;
    }
    
    updateVisuals(deltaTime) {
        // Update visual effects based on physics
    }
    
    reset() {
        this.position = new Vector3(0, 0.5, 0);
        this.velocity = new Vector3(0, 0, 0);
        this.speed = 0;
        this.forward = new Vector3(0, 0, 1);
        this.right = new Vector3(1, 0, 0);
        this.steering = 0;
        this.throttle = 0;
        this.brake = 0;
        this.wheelRotation = 0;
        this.bodyRoll = 0;
        this.bodyPitch = 0;
    }
    
    getCorners() {
        const halfWidth = this.width / 2;
        const halfLength = this.length / 2;
        
        const corners = [
            new Vector3(-halfWidth, 0, -halfLength), // Front-left
            new Vector3(halfWidth, 0, -halfLength),  // Front-right
            new Vector3(halfWidth, 0, halfLength),   // Rear-right
            new Vector3(-halfWidth, 0, halfLength)   // Rear-left
        ];
        
        return corners.map(corner => {
            const rotated = new Vector3(
                corner.x * this.right.x + corner.z * this.forward.x,
                corner.y + this.bodyPitch * corner.z - this.bodyRoll * corner.x,
                corner.x * this.right.z + corner.z * this.forward.z
            );
            return rotated.add(this.position);
        });
    }
    
    getSpeedKMH() {
        return this.speed * 3.6;
    }
}