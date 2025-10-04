// Utility functions for the racing game

class Vector3 {
    constructor(x = 0, y = 0, z = 0) {
        this.x = x;
        this.y = y;
        this.z = z;
    }
    
    clone() {
        return new Vector3(this.x, this.y, this.z);
    }
    
    add(v) {
        return new Vector3(this.x + v.x, this.y + v.y, this.z + v.z);
    }
    
    subtract(v) {
        return new Vector3(this.x - v.x, this.y - v.y, this.z - v.z);
    }
    
    multiply(scalar) {
        return new Vector3(this.x * scalar, this.y * scalar, this.z * scalar);
    }
    
    length() {
        return Math.sqrt(this.x * this.x + this.y * this.y + this.z * this.z);
    }
    
    normalize() {
        const len = this.length();
        if (len === 0) return new Vector3();
        return new Vector3(this.x / len, this.y / len, this.z / len);
    }
    
    dot(v) {
        return this.x * v.x + this.y * v.y + this.z * v.z;
    }
    
    cross(v) {
        return new Vector3(
            this.y * v.z - this.z * v.y,
            this.z * v.x - this.x * v.z,
            this.x * v.y - this.y * v.x
        );
    }
}

class MathUtils {
    static lerp(a, b, t) {
        return a + (b - a) * t;
    }
    
    static clamp(value, min, max) {
        return Math.max(min, Math.min(max, value));
    }
    
    static randomRange(min, max) {
        return Math.random() * (max - min) + min;
    }
    
    static degToRad(degrees) {
        return degrees * (Math.PI / 180);
    }
    
    static radToDeg(radians) {
        return radians * (180 / Math.PI);
    }
    
    static smoothstep(min, max, value) {
        const t = MathUtils.clamp((value - min) / (max - min), 0, 1);
        return t * t * (3 - 2 * t);
    }
}

class Color {
    constructor(r = 1, g = 1, b = 1) {
        this.r = r;
        this.g = g;
        this.b = b;
    }
    
    toHex() {
        const r = Math.floor(this.r * 255);
        const g = Math.floor(this.g * 255);
        const b = Math.floor(this.b * 255);
        return `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`;
    }
    
    toString() {
        return `rgb(${Math.floor(this.r * 255)}, ${Math.floor(this.g * 255)}, ${Math.floor(this.b * 255)})`;
    }
}

// Input handling
class InputManager {
    constructor() {
        this.keys = {};
        this.mouse = { x: 0, y: 0, buttons: {} };
        this.gamepad = null;
        
        this.setupEventListeners();
    }
    
    setupEventListeners() {
        document.addEventListener('keydown', (e) => {
            this.keys[e.code] = true;
        });
        
        document.addEventListener('keyup', (e) => {
            this.keys[e.code] = false;
        });
        
        document.addEventListener('mousemove', (e) => {
            this.mouse.x = e.clientX;
            this.mouse.y = e.clientY;
        });
        
        document.addEventListener('mousedown', (e) => {
            this.mouse.buttons[e.button] = true;
        });
        
        document.addEventListener('mouseup', (e) => {
            this.mouse.buttons[e.button] = false;
        });
        
        window.addEventListener('gamepadconnected', (e) => {
            this.gamepad = e.gamepad;
        });
        
        window.addEventListener('gamepaddisconnected', (e) => {
            if (this.gamepad && this.gamepad.index === e.gamepad.index) {
                this.gamepad = null;
            }
        });
    }
    
    isKeyPressed(key) {
        return !!this.keys[key];
    }
    
    getMovementInput() {
        return {
            forward: this.isKeyPressed('KeyW') || this.isKeyPressed('ArrowUp'),
            backward: this.isKeyPressed('KeyS') || this.isKeyPressed('ArrowDown'),
            left: this.isKeyPressed('KeyA') || this.isKeyPressed('ArrowLeft'),
            right: this.isKeyPressed('KeyD') || this.isKeyPressed('ArrowRight'),
            brake: this.isKeyPressed('Space'),
            boost: this.isKeyPressed('ShiftLeft') || this.isKeyPressed('ShiftRight')
        };
    }
    
    updateGamepad() {
        if (this.gamepad) {
            const gamepads = navigator.getGamepads();
            this.gamepad = gamepads[this.gamepad.index];
        }
    }
}

// Performance monitoring
class PerformanceMonitor {
    constructor() {
        this.fps = 0;
        this.frameTime = 0;
        this.lastTime = performance.now();
        this.frameCount = 0;
        this.fpsUpdateTime = 0;
    }
    
    update() {
        const currentTime = performance.now();
        this.frameTime = currentTime - this.lastTime;
        this.lastTime = currentTime;
        
        this.frameCount++;
        this.fpsUpdateTime += this.frameTime;
        
        if (this.fpsUpdateTime >= 1000) {
            this.fps = Math.round(this.frameCount * 1000 / this.fpsUpdateTime);
            this.frameCount = 0;
            this.fpsUpdateTime = 0;
        }
    }
}

// Resource loading
class ResourceManager {
    constructor() {
        this.textures = new Map();
        this.models = new Map();
        this.sounds = new Map();
        this.loadingProgress = 0;
        this.totalResources = 0;
        this.loadedResources = 0;
    }
    
    async loadTexture(name, url) {
        return new Promise((resolve, reject) => {
            const texture = new THREE.TextureLoader().load(
                url,
                () => {
                    this.textures.set(name, texture);
                    this.onResourceLoaded();
                    resolve(texture);
                },
                undefined,
                reject
            );
        });
    }
    
    async loadModel(name, url) {
        return new Promise((resolve, reject) => {
            const loader = new THREE.GLTFLoader();
            loader.load(
                url,
                (gltf) => {
                    this.models.set(name, gltf);
                    this.onResourceLoaded();
                    resolve(gltf);
                },
                undefined,
                reject
            );
        });
    }
    
    async loadSound(name, url) {
        return new Promise((resolve, reject) => {
            const audio = new Audio(url);
            audio.addEventListener('canplaythrough', () => {
                this.sounds.set(name, audio);
                this.onResourceLoaded();
                resolve(audio);
            });
            audio.addEventListener('error', reject);
        });
    }
    
    onResourceLoaded() {
        this.loadedResources++;
        this.loadingProgress = this.loadedResources / this.totalResources;
    }
    
    getTexture(name) {
        return this.textures.get(name);
    }
    
    getModel(name) {
        return this.models.get(name);
    }
    
    getSound(name) {
        return this.sounds.get(name);
    }
}

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        Vector3,
        MathUtils,
        Color,
        InputManager,
        PerformanceMonitor,
        ResourceManager
    };
}