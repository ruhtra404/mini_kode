// Particle effects for exhaust, dust, and collisions

class ParticleSystem {
    constructor(scene) {
        this.scene = scene;
        this.particleGroups = new Map();
        this.activeEffects = new Map();
        this.maxParticles = 1000;
        this.particlePool = [];
        
        // Create particle pool
        this.createParticlePool();
    }
    
    createParticlePool() {
        for (let i = 0; i < this.maxParticles; i++) {
            const particle = new Particle();
            this.particlePool.push(particle);
        }
    }
    
    getParticle() {
        if (this.particlePool.length > 0) {
            return this.particlePool.pop();
        }
        return new Particle();
    }
    
    returnParticle(particle) {
        if (this.particlePool.length < this.maxParticles) {
            this.particlePool.push(particle);
        }
    }
    
    createExhaustEffect(position, velocity, intensity = 1) {
        const effect = new ExhaustEffect(this, position, velocity, intensity);
        this.activeEffects.set(`exhaust_${Date.now()}_${Math.random()}`, effect);
        return effect;
    }
    
    createDustEffect(position, velocity, intensity = 1) {
        const effect = new DustEffect(this, position, velocity, intensity);
        this.activeEffects.set(`dust_${Date.now()}_${Math.random()}`, effect);
        return effect;
    }
    
    createCollisionEffect(position, intensity = 1) {
        const effect = new CollisionEffect(this, position, intensity);
        this.activeEffects.set(`collision_${Date.now()}_${Math.random()}`, effect);
        return effect;
    }
    
    createSparksEffect(position, velocity, intensity = 1) {
        const effect = new SparksEffect(this, position, velocity, intensity);
        this.activeEffects.set(`sparks_${Date.now()}_${Math.random()}`, effect);
        return effect;
    }
    
    createBoostEffect(position, velocity, intensity = 1) {
        const effect = new BoostEffect(this, position, velocity, intensity);
        this.activeEffects.set(`boost_${Date.now()}_${Math.random()}`, effect);
        return effect;
    }
    
    update(deltaTime) {
        // Update all active effects
        this.activeEffects.forEach((effect, key) => {
            effect.update(deltaTime);
            
            if (effect.isFinished()) {
                effect.cleanup();
                this.activeEffects.delete(key);
            }
        });
    }
    
    cleanup() {
        this.activeEffects.forEach(effect => effect.cleanup());
        this.activeEffects.clear();
    }
}

class Particle {
    constructor() {
        this.position = new THREE.Vector3();
        this.velocity = new THREE.Vector3();
        this.acceleration = new THREE.Vector3();
        this.life = 1.0;
        this.maxLife = 1.0;
        this.size = 1.0;
        this.color = new THREE.Color(1, 1, 1);
        this.alpha = 1.0;
        this.rotation = 0;
        this.rotationSpeed = 0;
        this.gravity = -9.8;
        this.drag = 0.98;
        this.active = false;
        
        // Visual representation
        this.mesh = null;
    }
    
    reset() {
        this.position.set(0, 0, 0);
        this.velocity.set(0, 0, 0);
        this.acceleration.set(0, 0, 0);
        this.life = 1.0;
        this.size = 1.0;
        this.color.set(1, 1, 1);
        this.alpha = 1.0;
        this.rotation = 0;
        this.rotationSpeed = 0;
        this.gravity = -9.8;
        this.drag = 0.98;
        this.active = false;
        
        if (this.mesh) {
            this.mesh.visible = false;
        }
    }
    
    update(deltaTime) {
        if (!this.active) return;
        
        // Update physics
        this.velocity.add(this.acceleration.clone().multiplyScalar(deltaTime));
        this.velocity.multiplyScalar(this.drag);
        this.position.add(this.velocity.clone().multiplyScalar(deltaTime));
        
        // Apply gravity
        this.velocity.y += this.gravity * deltaTime;
        
        // Update life
        this.life -= deltaTime / this.maxLife;
        this.alpha = Math.max(0, this.life);
        
        // Update rotation
        this.rotation += this.rotationSpeed * deltaTime;
        
        // Update visual
        if (this.mesh) {
            this.mesh.position.copy(this.position);
            this.mesh.rotation.z = this.rotation;
            this.mesh.material.opacity = this.alpha;
            this.mesh.scale.setScalar(this.size);
        }
        
        // Deactivate if life is over
        if (this.life <= 0) {
            this.active = false;
        }
    }
    
    isActive() {
        return this.active;
    }
    
    activate(position, velocity, color, size = 1.0, life = 1.0) {
        this.position.copy(position);
        this.velocity.copy(velocity);
        this.acceleration.set(0, 0, 0);
        this.color.copy(color);
        this.size = size;
        this.life = life;
        this.maxLife = life;
        this.alpha = 1.0;
        this.active = true;
        
        if (this.mesh) {
            this.mesh.visible = true;
            this.mesh.material.color.copy(color);
        }
    }
}

class ParticleEffect {
    constructor(particleSystem, position, intensity = 1) {
        this.particleSystem = particleSystem;
        this.position = position.clone();
        this.intensity = intensity;
        this.particles = [];
        this.emissionRate = 50;
        this.emissionTimer = 0;
        this.duration = 2.0;
        this.age = 0;
        this.finished = false;
    }
    
    update(deltaTime) {
        this.age += deltaTime;
        this.emissionTimer += deltaTime;
        
        // Emit particles
        while (this.emissionTimer >= 1 / this.emissionRate && !this.finished) {
            this.emitParticle();
            this.emissionTimer -= 1 / this.emissionRate;
        }
        
        // Update existing particles
        this.particles.forEach((particle, index) => {
            particle.update(deltaTime);
            
            if (!particle.isActive()) {
                this.particles.splice(index, 1);
                this.particleSystem.returnParticle(particle);
            }
        });
        
        // Check if effect should finish
        if (this.age >= this.duration && this.particles.length === 0) {
            this.finished = true;
        }
    }
    
    emitParticle() {
        const particle = this.particleSystem.getParticle();
        const velocity = this.getParticleVelocity();
        const color = this.getParticleColor();
        const size = this.getParticleSize();
        const life = this.getParticleLife();
        
        particle.activate(this.position, velocity, color, size, life);
        this.particles.push(particle);
    }
    
    getParticleVelocity() {
        return new THREE.Vector3(
            (Math.random() - 0.5) * 2,
            Math.random() * 2,
            (Math.random() - 0.5) * 2
        ).multiplyScalar(this.intensity);
    }
    
    getParticleColor() {
        return new THREE.Color(1, 1, 1);
    }
    
    getParticleSize() {
        return 0.1;
    }
    
    getParticleLife() {
        return 1.0;
    }
    
    isFinished() {
        return this.finished;
    }
    
    cleanup() {
        this.particles.forEach(particle => {
            this.particleSystem.returnParticle(particle);
        });
        this.particles = [];
    }
}

class ExhaustEffect extends ParticleEffect {
    constructor(particleSystem, position, velocity, intensity) {
        super(particleSystem, position, intensity);
        this.emissionRate = 100 * intensity;
        this.duration = 0.5;
        this.velocity = velocity.clone();
    }
    
    getParticleVelocity() {
        return new THREE.Vector3(
            (Math.random() - 0.5) * 0.5,
            Math.random() * 0.5,
            (Math.random() - 0.5) * 0.5
        ).add(this.velocity.clone().multiplyScalar(-0.2));
    }
    
    getParticleColor() {
        const gray = MathUtils.randomRange(0.2, 0.8);
        return new THREE.Color(gray, gray, gray);
    }
    
    getParticleSize() {
        return MathUtils.randomRange(0.05, 0.15);
    }
    
    getParticleLife() {
        return MathUtils.randomRange(0.5, 1.5);
    }
}

class DustEffect extends ParticleEffect {
    constructor(particleSystem, position, velocity, intensity) {
        super(particleSystem, position, intensity);
        this.emissionRate = 80 * intensity;
        this.duration = 1.0;
        this.velocity = velocity.clone();
    }
    
    getParticleVelocity() {
        return new THREE.Vector3(
            (Math.random() - 0.5) * 3,
            Math.random() * 1,
            (Math.random() - 0.5) * 3
        ).add(this.velocity.clone().multiplyScalar(0.1));
    }
    
    getParticleColor() {
        const brown = MathUtils.randomRange(0.4, 0.7);
        return new THREE.Color(brown, brown * 0.8, brown * 0.6);
    }
    
    getParticleSize() {
        return MathUtils.randomRange(0.1, 0.3);
    }
    
    getParticleLife() {
        return MathUtils.randomRange(1.0, 2.0);
    }
}

class CollisionEffect extends ParticleEffect {
    constructor(particleSystem, position, intensity) {
        super(particleSystem, position, intensity);
        this.emissionRate = 200 * intensity;
        this.duration = 0.2;
        this.explosive = true;
    }
    
    getParticleVelocity() {
        const speed = MathUtils.randomRange(2, 8) * this.intensity;
        const direction = new THREE.Vector3(
            (Math.random() - 0.5) * 2,
            Math.random(),
            (Math.random() - 0.5) * 2
        ).normalize();
        
        return direction.multiplyScalar(speed);
    }
    
    getParticleColor() {
        const colors = [
            new THREE.Color(1, 0.5, 0), // Orange
            new THREE.Color(1, 1, 0),   // Yellow
            new THREE.Color(1, 0, 0),   // Red
            new THREE.Color(0.5, 0.5, 0.5) // Gray
        ];
        return colors[Math.floor(Math.random() * colors.length)];
    }
    
    getParticleSize() {
        return MathUtils.randomRange(0.05, 0.2) * this.intensity;
    }
    
    getParticleLife() {
        return MathUtils.randomRange(0.3, 1.0);
    }
}

class SparksEffect extends ParticleEffect {
    constructor(particleSystem, position, velocity, intensity) {
        super(particleSystem, position, intensity);
        this.emissionRate = 150 * intensity;
        this.duration = 0.3;
        this.velocity = velocity.clone();
    }
    
    getParticleVelocity() {
        const speed = MathUtils.randomRange(1, 5) * this.intensity;
        const direction = new THREE.Vector3(
            (Math.random() - 0.5) * 2,
            Math.random() * 0.5,
            (Math.random() - 0.5) * 2
        ).normalize();
        
        return direction.multiplyScalar(speed).add(this.velocity.clone().multiplyScalar(0.2));
    }
    
    getParticleColor() {
        return new THREE.Color(1, 0.8, 0.2); // Yellow-orange sparks
    }
    
    getParticleSize() {
        return MathUtils.randomRange(0.02, 0.08);
    }
    
    getParticleLife() {
        return MathUtils.randomRange(0.2, 0.6);
    }
}

class BoostEffect extends ParticleEffect {
    constructor(particleSystem, position, velocity, intensity) {
        super(particleSystem, position, intensity);
        this.emissionRate = 300 * intensity;
        this.duration = 0.8;
        this.velocity = velocity.clone();
    }
    
    getParticleVelocity() {
        return new THREE.Vector3(
            (Math.random() - 0.5) * 1,
            Math.random() * 0.5,
            (Math.random() - 0.5) * 1
        ).add(this.velocity.clone().multiplyScalar(-0.3));
    }
    
    getParticleColor() {
        const colors = [
            new THREE.Color(0, 0.5, 1),  // Blue
            new THREE.Color(0, 1, 1),    // Cyan
            new THREE.Color(0.5, 1, 1),  // Light blue
            new THREE.Color(1, 1, 1)     // White
        ];
        return colors[Math.floor(Math.random() * colors.length)];
    }
    
    getParticleSize() {
        return MathUtils.randomRange(0.03, 0.12);
    }
    
    getParticleLife() {
        return MathUtils.randomRange(0.4, 1.2);
    }
}

// Particle system integration for cars
class CarParticleEffects {
    constructor(particleSystem, car) {
        this.particleSystem = particleSystem;
        this.car = car;
        this.exhaustEffects = [];
        this.dustEffects = [];
        this.collisionEffects = [];
        
        this.exhaustTimer = 0;
        this.dustTimer = 0;
        this.lastCollisionTime = 0;
        
        this.setupExhaustPoints();
    }
    
    setupExhaustPoints() {
        this.exhaustPoints = [
            new THREE.Vector3(-1.5, -0.3, -4.2),
            new THREE.Vector3(1.5, -0.3, -4.2)
        ];
    }
    
    update(deltaTime) {
        const carPosition = this.car.getPosition();
        const carVelocity = this.car.physicsBody ? this.car.physicsBody.getVelocity() : new THREE.Vector3();
        const speed = this.car.getSpeed();
        const throttle = this.car.throttle;
        
        // Update exhaust effects
        this.updateExhaustEffects(carPosition, carVelocity, throttle, deltaTime);
        
        // Update dust effects
        this.updateDustEffects(carPosition, carVelocity, speed, deltaTime);
        
        // Check for collisions
        this.checkCollisions(carPosition, deltaTime);
    }
    
    updateExhaustEffects(carPosition, carVelocity, throttle, deltaTime) {
        this.exhaustTimer += deltaTime;
        
        if (throttle > 0.1 && this.exhaustTimer >= 0.02) {
            this.exhaustPoints.forEach(point => {
                const worldPos = point.clone().applyQuaternion(this.car.getRotation()).add(carPosition);
                const effect = this.particleSystem.createExhaustEffect(worldPos, carVelocity, throttle);
                this.exhaustEffects.push(effect);
            });
            
            this.exhaustTimer = 0;
        }
        
        // Clean up old effects
        this.exhaustEffects = this.exhaustEffects.filter(effect => !effect.isFinished());
    }
    
    updateDustEffects(carPosition, carVelocity, speed, deltaTime) {
        if (speed > 20) {
            this.dustTimer += deltaTime;
            
            if (this.dustTimer >= 0.1) {
                // Create dust from wheels
                const wheelPositions = [
                    new THREE.Vector3(-1.5, -0.8, 2.5),
                    new THREE.Vector3(1.5, -0.8, 2.5),
                    new THREE.Vector3(-1.5, -0.8, -2.5),
                    new THREE.Vector3(1.5, -0.8, -2.5)
                ];
                
                wheelPositions.forEach(pos => {
                    const worldPos = pos.clone().applyQuaternion(this.car.getRotation()).add(carPosition);
                    const effect = this.particleSystem.createDustEffect(worldPos, carVelocity, speed / 100);
                    this.dustEffects.push(effect);
                });
                
                this.dustTimer = 0;
            }
        }
        
        // Clean up old effects
        this.dustEffects = this.dustEffects.filter(effect => !effect.isFinished());
    }
    
    checkCollisions(carPosition, deltaTime) {
        // This would be called from collision detection system
        // For now, just a placeholder
    }
    
    createCollisionEffect(position, intensity = 1) {
        const effect = this.particleSystem.createCollisionEffect(position, intensity);
        this.collisionEffects.push(effect);
        return effect;
    }
    
    createSparksEffect(position, velocity, intensity = 1) {
        const effect = this.particleSystem.createSparksEffect(position, velocity, intensity);
        this.collisionEffects.push(effect);
        return effect;
    }
    
    createBoostEffect(position, velocity, intensity = 1) {
        const effect = this.particleSystem.createBoostEffect(position, velocity, intensity);
        this.collisionEffects.push(effect);
        return effect;
    }
    
    cleanup() {
        this.exhaustEffects.forEach(effect => effect.cleanup());
        this.dustEffects.forEach(effect => effect.cleanup());
        this.collisionEffects.forEach(effect => effect.cleanup());
        
        this.exhaustEffects = [];
        this.dustEffects = [];
        this.collisionEffects = [];
    }
}

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        ParticleSystem,
        Particle,
        ParticleEffect,
        CarParticleEffects
    };
}