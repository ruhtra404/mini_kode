// Sound effects and background music management

class SoundManager {
    constructor() {
        this.audioContext = null;
        this.sounds = new Map();
        this.music = null;
        this.masterVolume = 0.7;
        this.sfxVolume = 0.8;
        this.musicVolume = 0.5;
        this.enabled = true;
        
        this.initializeAudio();
    }
    
    async initializeAudio() {
        try {
            this.audioContext = new (window.AudioContext || window.webkitAudioContext)();
            
            // Resume audio context on user interaction
            document.addEventListener('click', () => {
                if (this.audioContext.state === 'suspended') {
                    this.audioContext.resume();
                }
            }, { once: true });
            
            console.log('Audio context initialized');
        } catch (error) {
            console.warn('Web Audio API not supported:', error);
            this.fallbackToHTMLAudio();
        }
    }
    
    fallbackToHTMLAudio() {
        // Fallback to HTML5 Audio for older browsers
        this.useHTMLAudio = true;
        console.log('Using HTML5 Audio fallback');
    }
    
    async loadSound(name, url) {
        try {
            if (this.useHTMLAudio) {
                return this.loadHTMLAudio(name, url);
            } else {
                return this.loadWebAudio(name, url);
            }
        } catch (error) {
            console.error(`Failed to load sound ${name}:`, error);
            return null;
        }
    }
    
    async loadWebAudio(name, url) {
        const response = await fetch(url);
        const arrayBuffer = await response.arrayBuffer();
        const audioBuffer = await this.audioContext.decodeAudioData(arrayBuffer);
        
        this.sounds.set(name, {
            buffer: audioBuffer,
            type: 'webaudio'
        });
        
        return audioBuffer;
    }
    
    async loadHTMLAudio(name, url) {
        const audio = new Audio(url);
        audio.preload = 'auto';
        
        return new Promise((resolve, reject) => {
            audio.addEventListener('canplaythrough', () => {
                this.sounds.set(name, {
                    audio: audio,
                    type: 'htmlaudio'
                });
                resolve(audio);
            });
            
            audio.addEventListener('error', reject);
        });
    }
    
    playSound(name, volume = 1.0, pitch = 1.0, loop = false) {
        if (!this.enabled || !this.sounds.has(name)) return null;
        
        const sound = this.sounds.get(name);
        const finalVolume = volume * this.sfxVolume * this.masterVolume;
        
        if (sound.type === 'webaudio') {
            return this.playWebAudio(sound.buffer, finalVolume, pitch, loop);
        } else {
            return this.playHTMLAudio(sound.audio, finalVolume, pitch, loop);
        }
    }
    
    playWebAudio(buffer, volume, pitch, loop) {
        if (!this.audioContext) return null;
        
        const source = this.audioContext.createBufferSource();
        const gainNode = this.audioContext.createGain();
        
        source.buffer = buffer;
        source.playbackRate.value = pitch;
        source.loop = loop;
        
        gainNode.gain.value = volume;
        
        source.connect(gainNode);
        gainNode.connect(this.audioContext.destination);
        
        source.start();
        
        return {
            stop: () => source.stop(),
            setVolume: (vol) => gainNode.gain.value = vol * this.sfxVolume * this.masterVolume,
            setPitch: (pit) => source.playbackRate.value = pit
        };
    }
    
    playHTMLAudio(audio, volume, pitch, loop) {
        const clonedAudio = audio.cloneNode();
        clonedAudio.volume = volume;
        clonedAudio.playbackRate = pitch;
        clonedAudio.loop = loop;
        clonedAudio.play();
        
        return {
            stop: () => clonedAudio.pause(),
            setVolume: (vol) => clonedAudio.volume = vol * this.sfxVolume * this.masterVolume,
            setPitch: (pit) => clonedAudio.playbackRate = pit
        };
    }
    
    playMusic(name, volume = 1.0, loop = true) {
        if (!this.enabled) return;
        
        // Stop current music
        this.stopMusic();
        
        // Play new music
        this.music = this.playSound(name, volume, 1.0, loop);
    }
    
    stopMusic() {
        if (this.music) {
            this.music.stop();
            this.music = null;
        }
    }
    
    setMasterVolume(volume) {
        this.masterVolume = MathUtils.clamp(volume, 0, 1);
    }
    
    setSFXVolume(volume) {
        this.sfxVolume = MathUtils.clamp(volume, 0, 1);
    }
    
    setMusicVolume(volume) {
        this.musicVolume = MathUtils.clamp(volume, 0, 1);
        if (this.music) {
            this.music.setVolume(this.musicVolume);
        }
    }
    
    toggleSound() {
        this.enabled = !this.enabled;
        if (!this.enabled) {
            this.stopMusic();
        }
    }
    
    // Generate procedural sounds
    generateEngineSound(rpm, load = 0.5) {
        if (!this.audioContext || !this.enabled) return;
        
        // Create engine sound using oscillators
        const oscillator1 = this.audioContext.createOscillator();
        const oscillator2 = this.audioContext.createOscillator();
        const gainNode = this.audioContext.createGain();
        const filter = this.audioContext.createBiquadFilter();
        
        // Calculate frequencies based on RPM
        const baseFreq = MathUtils.map(rpm, 0, 8000, 50, 400);
        const harmonicFreq = baseFreq * 2;
        
        oscillator1.frequency.value = baseFreq;
        oscillator2.frequency.value = harmonicFreq;
        
        // Set waveform types
        oscillator1.type = 'sawtooth';
        oscillator2.type = 'square';
        
        // Set filter
        filter.type = 'lowpass';
        filter.frequency.value = MathUtils.map(rpm, 0, 8000, 200, 2000);
        filter.Q.value = 1;
        
        // Set volume based on load
        const volume = MathUtils.map(load, 0, 1, 0.1, 0.3) * this.sfxVolume * this.masterVolume;
        gainNode.gain.value = volume;
        
        // Connect nodes
        oscillator1.connect(filter);
        oscillator2.connect(filter);
        filter.connect(gainNode);
        gainNode.connect(this.audioContext.destination);
        
        // Start and schedule stop
        oscillator1.start();
        oscillator2.start();
        
        // Stop after a short duration
        const duration = 0.1;
        oscillator1.stop(this.audioContext.currentTime + duration);
        oscillator2.stop(this.audioContext.currentTime + duration);
        
        return {
            oscillators: [oscillator1, oscillator2],
            gain: gainNode,
            filter: filter
        };
    }
    
    generateTireScreech(speed, intensity = 1.0) {
        if (!this.audioContext || !this.enabled) return;
        
        const oscillator = this.audioContext.createOscillator();
        const gainNode = this.audioContext.createGain();
        const filter = this.audioContext.createBiquadFilter();
        
        // Create screeching sound
        const freq = MathUtils.map(speed, 0, 200, 800, 2000);
        oscillator.frequency.value = freq;
        oscillator.type = 'sawtooth';
        
        // Set filter for screeching effect
        filter.type = 'bandpass';
        filter.frequency.value = freq;
        filter.Q.value = 10;
        
        // Set volume
        const volume = intensity * 0.2 * this.sfxVolume * this.masterVolume;
        gainNode.gain.value = volume;
        gainNode.gain.exponentialRampToValueAtTime(0.01, this.audioContext.currentTime + 0.5);
        
        // Connect nodes
        oscillator.connect(filter);
        filter.connect(gainNode);
        gainNode.connect(this.audioContext.destination);
        
        // Start and stop
        oscillator.start();
        oscillator.stop(this.audioContext.currentTime + 0.5);
        
        return { oscillator, gain: gainNode, filter };
    }
    
    generateCollisionSound(intensity = 1.0) {
        if (!this.audioContext || !this.enabled) return;
        
        // Create collision sound using noise
        const bufferSize = this.audioContext.sampleRate * 0.2;
        const buffer = this.audioContext.createBuffer(1, bufferSize, this.audioContext.sampleRate);
        const data = buffer.getChannelData(0);
        
        // Generate white noise
        for (let i = 0; i < bufferSize; i++) {
            data[i] = (Math.random() - 0.5) * intensity;
        }
        
        const source = this.audioContext.createBufferSource();
        const gainNode = this.audioContext.createGain();
        const filter = this.audioContext.createBiquadFilter();
        
        source.buffer = buffer;
        
        // Set filter for impact sound
        filter.type = 'lowpass';
        filter.frequency.value = 500;
        
        // Set volume envelope
        const volume = intensity * 0.3 * this.sfxVolume * this.masterVolume;
        gainNode.gain.value = volume;
        gainNode.gain.exponentialRampToValueAtTime(0.01, this.audioContext.currentTime + 0.2);
        
        // Connect nodes
        source.connect(filter);
        filter.connect(gainNode);
        gainNode.connect(this.audioContext.destination);
        
        // Start and stop
        source.start();
        source.stop(this.audioContext.currentTime + 0.2);
        
        return { source, gain: gainNode, filter };
    }
    
    generateBoostSound() {
        if (!this.audioContext || !this.enabled) return;
        
        const oscillator = this.audioContext.createOscillator();
        const gainNode = this.audioContext.createGain();
        const filter = this.audioContext.createBiquadFilter();
        
        // Create rising pitch for boost
        oscillator.frequency.setValueAtTime(200, this.audioContext.currentTime);
        oscillator.frequency.exponentialRampToValueAtTime(800, this.audioContext.currentTime + 0.3);
        oscillator.type = 'sawtooth';
        
        // Set filter
        filter.type = 'lowpass';
        filter.frequency.value = 1000;
        
        // Set volume
        gainNode.gain.value = 0.2 * this.sfxVolume * this.masterVolume;
        
        // Connect nodes
        oscillator.connect(filter);
        filter.connect(gainNode);
        gainNode.connect(this.audioContext.destination);
        
        // Start and stop
        oscillator.start();
        oscillator.stop(this.audioContext.currentTime + 0.3);
        
        return { oscillator, gain: gainNode, filter };
    }
}

// Car-specific sound effects
class CarSoundEffects {
    constructor(soundManager, car) {
        this.soundManager = soundManager;
        this.car = car;
        
        this.engineSound = null;
        this.tireSound = null;
        this.lastEngineSound = 0;
        this.lastTireSound = 0;
        
        this.engineSoundInterval = 0.05;
        this.tireSoundInterval = 0.1;
    }
    
    update(deltaTime) {
        if (!this.soundManager.enabled) return;
        
        const currentTime = Date.now() / 1000;
        const rpm = this.car.getRPM();
        const speed = this.car.getSpeed();
        const throttle = this.car.throttle;
        const steering = Math.abs(this.car.steering);
        
        // Update engine sound
        if (currentTime - this.lastEngineSound > this.engineSoundInterval) {
            this.updateEngineSound(rpm, throttle);
            this.lastEngineSound = currentTime;
        }
        
        // Update tire screech sound
        if (currentTime - this.lastTireSound > this.tireSoundInterval) {
            this.updateTireSound(speed, steering);
            this.lastTireSound = currentTime;
        }
    }
    
    updateEngineSound(rpm, throttle) {
        const load = throttle;
        this.soundManager.generateEngineSound(rpm, load);
    }
    
    updateTireSound(speed, steering) {
        if (steering > 0.7 && speed > 30) {
            const intensity = Math.min(steering * speed / 100, 1);
            this.soundManager.generateTireScreech(speed, intensity);
        }
    }
    
    playCollisionSound(intensity = 1.0) {
        this.soundManager.generateCollisionSound(intensity);
    }
    
    playBoostSound() {
        this.soundManager.generateBoostSound();
    }
    
    playBrakeSound() {
        if (this.car.brake > 0.5) {
            this.soundManager.generateTireScreech(this.car.getSpeed(), 0.5);
        }
    }
}

// Racing game sound effects
class RacingGameSounds {
    constructor(soundManager) {
        this.soundManager = soundManager;
        this.loaded = false;
        this.sounds = {
            engine: null,
            collision: null,
            boost: null,
            countdown: null,
            finish: null,
            lap: null,
            menu: null
        };
    }
    
    async loadSounds() {
        try {
            // Load sound effects (these would be actual audio files)
            // For now, we'll use procedural generation
            this.loaded = true;
            console.log('Racing game sounds loaded');
        } catch (error) {
            console.error('Failed to load racing sounds:', error);
        }
    }
    
    playCountdownSound(count) {
        if (!this.loaded) return;
        
        // Create countdown beep
        const frequency = count === 0 ? 800 : 400;
        this.soundManager.playTone(frequency, 0.2, 0.5);
    }
    
    playFinishSound() {
        if (!this.loaded) return;
        
        // Create victory sound
        this.soundManager.playMelody([523, 659, 784, 1047], [0.2, 0.2, 0.2, 0.4], 0.6);
    }
    
    playLapSound() {
        if (!this.loaded) return;
        
        // Create lap completion sound
        this.soundManager.playTone(600, 0.1, 0.3);
        setTimeout(() => this.soundManager.playTone(800, 0.1, 0.3), 100);
    }
}

// Extend SoundManager with additional methods
SoundManager.prototype.playTone = function(frequency, duration, volume = 1.0) {
    if (!this.audioContext || !this.enabled) return;
    
    const oscillator = this.audioContext.createOscillator();
    const gainNode = this.audioContext.createGain();
    
    oscillator.frequency.value = frequency;
    oscillator.type = 'sine';
    
    gainNode.gain.value = volume * this.sfxVolume * this.masterVolume;
    gainNode.gain.exponentialRampToValueAtTime(0.01, this.audioContext.currentTime + duration);
    
    oscillator.connect(gainNode);
    gainNode.connect(this.audioContext.destination);
    
    oscillator.start();
    oscillator.stop(this.audioContext.currentTime + duration);
    
    return { oscillator, gain: gainNode };
};

SoundManager.prototype.playMelody = function(frequencies, durations, volume = 1.0) {
    if (!this.audioContext || !this.enabled) return;
    
    let currentTime = this.audioContext.currentTime;
    
    frequencies.forEach((freq, index) => {
        const oscillator = this.audioContext.createOscillator();
        const gainNode = this.audioContext.createGain();
        
        oscillator.frequency.value = freq;
        oscillator.type = 'sine';
        
        gainNode.gain.value = 0;
        gainNode.gain.setValueAtTime(volume * this.sfxVolume * this.masterVolume, currentTime);
        gainNode.gain.exponentialRampToValueAtTime(0.01, currentTime + durations[index]);
        
        oscillator.connect(gainNode);
        gainNode.connect(this.audioContext.destination);
        
        oscillator.start(currentTime);
        oscillator.stop(currentTime + durations[index]);
        
        currentTime += durations[index];
    });
};

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        SoundManager,
        CarSoundEffects,
        RacingGameSounds
    };
}