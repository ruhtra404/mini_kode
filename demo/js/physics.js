// Physics engine for the racing game

class PhysicsWorld {
    constructor() {
        this.world = new CANNON.World();
        this.world.gravity.set(0, -9.82, 0);
        this.world.broadphase = new CANNON.NaiveBroadphase();
        this.world.solver.iterations = 10;
        
        // Ground material
        this.groundMaterial = new CANNON.Material('ground');
        this.carMaterial = new CANNON.Material('car');
        
        // Contact materials
        this.setupContactMaterials();
        
        this.bodies = new Map();
        this.meshes = new Map();
    }
    
    setupContactMaterials() {
        // Car-ground contact
        const carGroundContact = new CANNON.ContactMaterial(
            this.carMaterial,
            this.groundMaterial,
            {
                friction: 0.4,
                restitution: 0.3,
                contactEquationStiffness: 1e8,
                contactEquationRelaxation: 3
            }
        );
        
        this.world.addContactMaterial(carGroundContact);
    }
    
    addBody(id, body, mesh = null) {
        this.world.add(body);
        this.bodies.set(id, body);
        if (mesh) {
            this.meshes.set(id, mesh);
        }
    }
    
    removeBody(id) {
        const body = this.bodies.get(id);
        if (body) {
            this.world.remove(body);
            this.bodies.delete(id);
            this.meshes.delete(id);
        }
    }
    
    update(deltaTime) {
        this.world.step(deltaTime);
        
        // Sync physics bodies with Three.js meshes
        this.meshes.forEach((mesh, id) => {
            const body = this.bodies.get(id);
            if (body && mesh) {
                mesh.position.copy(body.position);
                mesh.quaternion.copy(body.quaternion);
            }
        });
    }
    
    raycast(from, to, options = {}) {
        const result = new CANNON.RaycastResult();
        this.world.raycastClosest(from, to, options, result);
        return result;
    }
}

class CarPhysics {
    constructor(world, position = new CANNON.Vec3(0, 2, 0)) {
        this.world = world;
        this.chassisBody = null;
        this.wheels = [];
        this.constraints = [];
        
        this.mass = 1500;
        this.wheelMass = 50;
        this.maxSteerValue = 0.5;
        this.maxForce = 1500;
        this.maxSpeed = 50;
        this.brakeForce = 1000;
        
        this.currentSpeed = 0;
        this.engineForce = 0;
        this.steeringValue = 0;
        this.brakeForce = 0;
        
        this.setupChassis(position);
        this.setupWheels();
    }
    
    setupChassis(position) {
        // Create chassis shape
        const chassisShape = new CANNON.Box(new CANNON.Vec3(2, 0.5, 4));
        this.chassisBody = new CANNON.Body({ mass: this.mass, material: this.world.carMaterial });
        this.chassisBody.addShape(chassisShape);
        this.chassisBody.position.copy(position);
        
        // Add some angular damping to prevent flipping
        this.chassisBody.angularDamping = 0.4;
        this.chassisBody.linearDamping = 0.1;
        
        this.world.addBody('chassis', this.chassisBody);
    }
    
    setupWheels() {
        const wheelPositions = [
            new CANNON.Vec3(-1.5, -0.5, 2.5),  // Front left
            new CANNON.Vec3(1.5, -0.5, 2.5),   // Front right
            new CANNON.Vec3(-1.5, -0.5, -2.5), // Rear left
            new CANNON.Vec3(1.5, -0.5, -2.5)   // Rear right
        ];
        
        wheelPositions.forEach((position, index) => {
            const wheelShape = new CANNON.Sphere(0.5);
            const wheelBody = new CANNON.Body({ mass: this.wheelMass });
            wheelBody.addShape(wheelShape);
            wheelBody.position.copy(this.chassisBody.position.vadd(position));
            
            // Create constraint to attach wheel to chassis
            const constraint = new CANNON.PointToPointConstraint(
                this.chassisBody,
                position,
                wheelBody,
                new CANNON.Vec3(0, 0, 0)
            );
            
            this.world.world.addConstraint(constraint);
            this.wheels.push({
                body: wheelBody,
                position: position,
                isFront: index < 2,
                constraint: constraint
            });
        });
    }
    
    update(input, deltaTime) {
        // Calculate current speed
        this.currentSpeed = this.chassisBody.velocity.length();
        
        // Handle steering
        if (input.left) {
            this.steeringValue = Math.min(this.steeringValue + 0.02, this.maxSteerValue);
        } else if (input.right) {
            this.steeringValue = Math.max(this.steeringValue - 0.02, -this.maxSteerValue);
        } else {
            this.steeringValue *= 0.9; // Return to center
        }
        
        // Handle acceleration/braking
        if (input.forward) {
            this.engineForce = this.maxForce;
            this.brakeForce = 0;
        } else if (input.backward) {
            this.engineForce = -this.maxForce * 0.5;
            this.brakeForce = 0;
        } else {
            this.engineForce = 0;
            this.brakeForce = input.brake ? this.brakeForce : 0;
        }
        
        // Apply forces
        this.applyEngineForce();
        this.applySteering();
        this.applyBraking();
        
        // Apply downforce based on speed
        this.applyDownforce();
    }
    
    applyEngineForce() {
        const forwardVector = new CANNON.Vec3(0, 0, 1);
        this.chassisBody.quaternion.vmult(forwardVector, forwardVector);
        
        // Apply force to rear wheels
        const rearWheelForce = this.engineForce / 2;
        this.wheels.forEach((wheel, index) => {
            if (index >= 2) { // Rear wheels
                const force = forwardVector.scale(rearWheelForce);
                wheel.body.applyForce(force, wheel.body.position);
            }
        });
    }
    
    applySteering() {
        // Apply steering to front wheels
        this.wheels.forEach((wheel, index) => {
            if (index < 2) { // Front wheels
                const steerAngle = this.steeringValue;
                // Create a rotation quaternion for steering
                const steerQuat = new CANNON.Quaternion();
                steerQuat.setFromAxisAngle(new CANNON.Vec3(0, 1, 0), steerAngle);
                
                // Apply the steering rotation
                wheel.body.quaternion = this.chassisBody.quaternion.mult(steerQuat);
            }
        });
    }
    
    applyBraking() {
        if (this.brakeForce > 0) {
            // Apply braking to all wheels
            this.wheels.forEach(wheel => {
                const velocity = wheel.body.velocity;
                const brakeVector = velocity.scale(-this.brakeForce * 0.1);
                wheel.body.applyForce(brakeVector, wheel.body.position);
            });
        }
    }
    
    applyDownforce() {
        // Apply downforce proportional to speed squared
        const downforce = this.currentSpeed * this.currentSpeed * 0.5;
        const downforceVector = new CANNON.Vec3(0, -downforce, 0);
        this.chassisBody.applyForce(downforceVector, this.chassisBody.position);
    }
    
    getSpeed() {
        return this.currentSpeed;
    }
    
    getSpeedKMH() {
        return this.currentSpeed * 3.6;
    }
    
    getPosition() {
        return this.chassisBody.position;
    }
    
    getRotation() {
        return this.chassisBody.quaternion;
    }
    
    reset(position = new CANNON.Vec3(0, 2, 0)) {
        this.chassisBody.position.copy(position);
        this.chassisBody.velocity.set(0, 0, 0);
        this.chassisBody.angularVelocity.set(0, 0, 0);
        this.chassisBody.quaternion.set(0, 0, 0, 1);
        
        this.wheels.forEach((wheel, index) => {
            const wheelPos = position.vadd(wheel.position);
            wheel.body.position.copy(wheelPos);
            wheel.body.velocity.set(0, 0, 0);
            wheel.body.angularVelocity.set(0, 0, 0);
            wheel.body.quaternion.set(0, 0, 0, 1);
        });
        
        this.engineForce = 0;
        this.steeringValue = 0;
        this.brakeForce = 0;
    }
}

class TrackPhysics {
    constructor(world) {
        this.world = world;
        this.trackBodies = [];
        this.barrierBodies = [];
    }
    
    createTrackSegment(points, width = 10, height = 0.5) {
        const segments = [];
        
        for (let i = 0; i < points.length - 1; i++) {
            const start = points[i];
            const end = points[i + 1];
            const segment = this.createSegment(start, end, width, height);
            segments.push(segment);
        }
        
        return segments;
    }
    
    createSegment(start, end, width, height) {
        const direction = end.clone().sub(start);
        const length = direction.length();
        const center = start.clone().add(end).multiply(0.5);
        
        // Create track surface
        const trackShape = new CANNON.Box(new CANNON.Vec3(width / 2, height / 2, length / 2));
        const trackBody = new CANNON.Body({ mass: 0, material: this.world.groundMaterial });
        trackBody.addShape(trackShape);
        trackBody.position.copy(center);
        
        // Align with direction
        const angle = Math.atan2(direction.x, direction.z);
        trackBody.quaternion.setFromAxisAngle(new CANNON.Vec3(0, 1, 0), angle);
        
        this.world.addBody(`track_${Math.random()}`, trackBody);
        this.trackBodies.push(trackBody);
        
        // Create barriers
        this.createBarriers(start, end, width, height);
        
        return trackBody;
    }
    
    createBarriers(start, end, width, height) {
        const direction = end.clone().sub(start);
        const length = direction.length();
        const center = start.clone().add(end).multiply(0.5);
        const angle = Math.atan2(direction.x, direction.z);
        
        // Left barrier
        const leftBarrierPos = center.clone();
        leftBarrierPos.x += Math.sin(angle) * (width / 2 + 1);
        leftBarrierPos.z += Math.cos(angle) * (width / 2 + 1);
        
        const leftBarrierShape = new CANNON.Box(new CANNON.Vec3(0.5, 2, length / 2));
        const leftBarrierBody = new CANNON.Body({ mass: 0 });
        leftBarrierBody.addShape(leftBarrierShape);
        leftBarrierBody.position.copy(leftBarrierPos);
        leftBarrierBody.quaternion.setFromAxisAngle(new CANNON.Vec3(0, 1, 0), angle);
        
        // Right barrier
        const rightBarrierPos = center.clone();
        rightBarrierPos.x -= Math.sin(angle) * (width / 2 + 1);
        rightBarrierPos.z -= Math.cos(angle) * (width / 2 + 1);
        
        const rightBarrierShape = new CANNON.Box(new CANNON.Vec3(0.5, 2, length / 2));
        const rightBarrierBody = new CANNON.Body({ mass: 0 });
        rightBarrierBody.addShape(rightBarrierShape);
        rightBarrierBody.position.copy(rightBarrierPos);
        rightBarrierBody.quaternion.setFromAxisAngle(new CANNON.Vec3(0, 1, 0), angle);
        
        this.world.addBody(`barrier_left_${Math.random()}`, leftBarrierBody);
        this.world.addBody(`barrier_right_${Math.random()}`, rightBarrierBody);
        this.barrierBodies.push(leftBarrierBody, rightBarrierBody);
    }
    
    clear() {
        this.trackBodies.forEach(body => {
            this.world.removeBody(`track_${Math.random()}`);
        });
        this.barrierBodies.forEach(body => {
            this.world.removeBody(`barrier_${Math.random()}`);
        });
        
        this.trackBodies = [];
        this.barrierBodies = [];
    }
}

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        PhysicsWorld,
        CarPhysics,
        TrackPhysics
    };
}