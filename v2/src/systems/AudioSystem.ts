

class AudioSystemClass {
    private ctx: AudioContext | null = null;
    private masterGain: GainNode | null = null;
    private enabled: boolean = true;

    constructor() {
        // Initialize on first user interaction usually, but we can try here
        // Browsers block AudioContext until user gesture.
        // We'll init lazily.
    }

    private init() {
        if (this.ctx) return;
        const AudioContext = window.AudioContext || (window as any).webkitAudioContext;
        this.ctx = new AudioContext();
        this.masterGain = this.ctx!.createGain();
        this.masterGain.gain.value = 0.3; // Master Volume
        this.masterGain.connect(this.ctx!.destination);
    }

    resume() {
        if (!this.ctx) this.init();
        if (this.ctx && this.ctx.state === 'suspended') {
            this.ctx.resume();
        }
    }

    play(soundName: 'pop' | 'place' | 'chop' | 'fry' | 'ding' | 'error' | 'music_start') {
        if (!this.enabled) return;
        this.resume();
        if (!this.ctx || !this.masterGain) return;

        const t = this.ctx.currentTime;
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();

        osc.connect(gain);
        gain.connect(this.masterGain);

        switch (soundName) {
            case 'pop': // Pickup / Select
                osc.type = 'sine';
                osc.frequency.setValueAtTime(600, t);
                osc.frequency.exponentialRampToValueAtTime(1200, t + 0.1);
                gain.gain.setValueAtTime(1, t);
                gain.gain.exponentialRampToValueAtTime(0.01, t + 0.1);
                osc.start(t);
                osc.stop(t + 0.1);
                break;

            case 'place': // Drop / Place
                osc.type = 'triangle';
                osc.frequency.setValueAtTime(300, t);
                osc.frequency.linearRampToValueAtTime(100, t + 0.1);
                gain.gain.setValueAtTime(0.8, t);
                gain.gain.linearRampToValueAtTime(0.01, t + 0.1);
                osc.start(t);
                osc.stop(t + 0.1);
                break;

            case 'chop': // Cutting
                // Noise burst
                const bufferSize = this.ctx.sampleRate * 0.1; // 0.1 sec
                const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
                const data = buffer.getChannelData(0);
                for (let i = 0; i < bufferSize; i++) {
                    data[i] = Math.random() * 2 - 1;
                }
                const noise = this.ctx.createBufferSource();
                noise.buffer = buffer;
                const noiseGain = this.ctx.createGain();
                noiseGain.gain.setValueAtTime(0.5, t);
                noiseGain.gain.exponentialRampToValueAtTime(0.01, t + 0.1);
                noise.connect(noiseGain);
                noiseGain.connect(this.masterGain);
                noise.start(t);
                break;

            case 'fry': // Sizzle start
                osc.type = 'sawtooth';
                osc.frequency.setValueAtTime(100, t);
                gain.gain.setValueAtTime(0.1, t);
                gain.gain.linearRampToValueAtTime(0, t + 0.5);
                osc.start(t);
                osc.stop(t + 0.5);
                break;

            case 'ding': // Success / Order Complete
                osc.type = 'triangle';
                osc.frequency.setValueAtTime(523.25, t); // C5
                osc.frequency.setValueAtTime(1046.50, t + 0.1); // C6
                gain.gain.setValueAtTime(0.5, t);
                gain.gain.exponentialRampToValueAtTime(0.01, t + 1);
                osc.start(t);
                osc.stop(t + 1);
                break;

            case 'error': // Bad action / Buzz
                osc.type = 'sawtooth';
                osc.frequency.setValueAtTime(150, t);
                osc.frequency.linearRampToValueAtTime(100, t + 0.3);
                gain.gain.setValueAtTime(0.5, t);
                gain.gain.linearRampToValueAtTime(0.01, t + 0.3);
                osc.start(t);
                osc.stop(t + 0.3);
                break;

            case 'music_start': // Simple jingle
                this.playNote(659.25, t, 0.1); // E5
                this.playNote(659.25, t + 0.15, 0.1);
                this.playNote(1046.5, t + 0.3, 0.4); // C6
                break;
        }
    }

    private playNote(freq: number, time: number, duration: number) {
        if (!this.ctx || !this.masterGain) return;
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.connect(gain);
        gain.connect(this.masterGain);
        osc.type = 'square';
        osc.frequency.setValueAtTime(freq, time);
        gain.gain.setValueAtTime(0.1, time);
        gain.gain.exponentialRampToValueAtTime(0.01, time + duration);
        osc.start(time);
        osc.stop(time + duration);
    }
}

export const AudioSystem = new AudioSystemClass();
