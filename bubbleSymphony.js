// script.js

// Set up canvas
const canvas = document.getElementById('canvas');
const ctx = canvas.getContext('2d');
canvas.width = window.innerWidth;
canvas.height = window.innerHeight;

// Audio context
let audioCtx;
try {
    audioCtx = new (window.AudioContext || window.webkitAudioContext)();
} catch (e) {
    console.warn('Web Audio API not supported');
}

function initAudio() {
    if (audioCtx && audioCtx.state === 'suspended') {
        audioCtx.resume();
    }
    document.removeEventListener('click', initAudio);
}
document.addEventListener('click', initAudio);

class Bubble {
    constructor(x, y, radius) {
        this.x = x;
        this.y = y;
        this.radius = radius || Math.random() * 30 + 20;
        this.dx = (Math.random() - 0.5) * 4;
        this.dy = (Math.random() - 0.5) * 4;
        this.hue = Math.random() * 360;
        this.saturation = 80;
        this.lightness = 60;
        this.alpha = 0.7;
        this.collidedWith = new Set();
        this.pulseRadius = 0;
        this.isPulsing = false;
        this.popAnimation = 0;
        this.isPopping = false;
        this.note = Math.floor(Math.random() * 12);
        this.octave = Math.floor(Math.random() * 3) + 3;
    }

    draw() {
        if (this.isPopping) {
            ctx.beginPath();
            ctx.arc(this.x, this.y, this.radius * (1 + this.popAnimation), 0, Math.PI * 2);
            ctx.strokeStyle = `hsla(${this.hue}, ${this.saturation}%, ${this.lightness}%, ${1 - this.popAnimation})`;
            ctx.lineWidth = 2;
            ctx.stroke();
            return;
        }

        ctx.beginPath();
        ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2);
        ctx.fillStyle = `hsla(${this.hue}, ${this.saturation}%, ${this.lightness}%, ${this.alpha})`;
        ctx.fill();

        ctx.beginPath();
        ctx.arc(this.x - this.radius * 0.3, this.y - this.radius * 0.3, this.radius * 0.2, 0, Math.PI * 2);
        ctx.fillStyle = `hsla(0, 0%, 100%, 0.3)`;
        ctx.fill();

        if (this.isPulsing) {
            ctx.beginPath();
            ctx.arc(this.x, this.y, this.radius + this.pulseRadius, 0, Math.PI * 2);
            ctx.strokeStyle = `hsla(${this.hue}, ${this.saturation}%, ${this.lightness}%, ${1 - this.pulseRadius / 30})`;
            ctx.lineWidth = 2;
            ctx.stroke();

            this.pulseRadius += 1;
            if (this.pulseRadius > 30) {
                this.isPulsing = false;
                this.pulseRadius = 0;
            }
        }
    }

    update(bubbles) {
        if (this.isPopping) {
            this.popAnimation += 0.05;
            if (this.popAnimation >= 1) return false;
            return true;
        }

        this.x += this.dx;
        this.y += this.dy;

        if (this.x + this.radius > canvas.width || this.x - this.radius < 0) {
            this.dx = -this.dx;
            this.playNote(0.5);
        }
        if (this.y + this.radius > canvas.height || this.y - this.radius < 0) {
            this.dy = -this.dy;
            this.playNote(0.5);
        }

        for (let i = 0; i < bubbles.length; i++) {
            const other = bubbles[i];
            if (other === this) continue;

            const dx = this.x - other.x;
            const dy = this.y - other.y;
            const distance = Math.sqrt(dx * dx + dy * dy);

            if (distance < this.radius + other.radius) {
                const id = `${Math.min(i, bubbles.indexOf(this))}-${Math.max(i, bubbles.indexOf(this))}`;
                if (!this.collidedWith.has(id)) {
                    this.collidedWith.add(id);

                    const angle = Math.atan2(dy, dx);
                    const sin = Math.sin(angle);
                    const cos = Math.cos(angle);

                    const vx1 = this.dx * cos + this.dy * sin;
                    const vy1 = this.dy * cos - this.dx * sin;
                    const vx2 = other.dx * cos + other.dy * sin;
                    const vy2 = other.dy * cos - other.dx * sin;

                    this.dx = cos * vx2 - sin * vy1;
                    this.dy = sin * vx2 + cos * vy1;
                    other.dx = cos * vx1 - sin * vy2;
                    other.dy = sin * vx1 + cos * vy2;

                    this.playNote(1.0);
                    this.isPulsing = true;
                    other.isPulsing = true;

                    this.hue = (this.hue + other.hue) / 2;
                    other.hue = this.hue + 30;

                    if (Math.random() < 0.01) {
                        this.isPopping = true;
                        this.playPop();
                    }

                    setTimeout(() => {
                        this.collidedWith.delete(id);
                    }, 300);
                }

                const overlap = (this.radius + other.radius - distance) / 2;
                const moveX = overlap * (dx / distance);
                const moveY = overlap * (dy / distance);

                this.x += moveX;
                this.y += moveY;
                other.x -= moveX;
                other.y -= moveY;
            }
        }
        return true;
    }

    playNote(volume = 0.7) {
        if (!audioCtx) return;

        const notes = [261.63, 277.18, 293.66, 311.13, 329.63, 349.23, 369.99, 392.00, 415.30, 440.00, 466.16, 493.88];
        const frequency = notes[this.note] * Math.pow(2, this.octave - 4);

        try {
            const oscillator = audioCtx.createOscillator();
            const gainNode = audioCtx.createGain();
            oscillator.type = 'sine';
            oscillator.frequency.setValueAtTime(frequency, audioCtx.currentTime);
            gainNode.gain.setValueAtTime(0, audioCtx.currentTime);
            gainNode.gain.linearRampToValueAtTime(volume, audioCtx.currentTime + 0.01);
            gainNode.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 1);
            oscillator.connect(gainNode);
            gainNode.connect(audioCtx.destination);
            oscillator.start();
            oscillator.stop(audioCtx.currentTime + 1);
        } catch (e) {
            console.warn('Error playing audio', e);
        }
    }

    playPop() {
        if (!audioCtx) return;
        try {
            const buffer = audioCtx.createBuffer(1, audioCtx.sampleRate * 0.1, audioCtx.sampleRate);
            const output = buffer.getChannelData(0);
            for (let i = 0; i < buffer.length; i++) output[i] = Math.random() * 2 - 1;
            const noise = audioCtx.createBufferSource();
            noise.buffer = buffer;
            const filter = audioCtx.createBiquadFilter();
            filter.type = 'highpass';
            filter.frequency.value = 1000;
            const gainNode = audioCtx.createGain();
            gainNode.gain.setValueAtTime(1, audioCtx.currentTime);
            gainNode.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.1);
            noise.connect(filter);
            filter.connect(gainNode);
            gainNode.connect(audioCtx.destination);
            noise.start();
            noise.stop(audioCtx.currentTime + 0.1);
        } catch (e) {
            console.warn('Error playing pop sound', e);
        }
    }
}

let bubbles = [];
let sizeFactor = 1;

function addBubbles(count, x, y) {
    for (let i = 0; i < count; i++) {
        const offsetX = (Math.random() - 0.5) * 100;
        const offsetY = (Math.random() - 0.5) * 100;
        bubbles.push(new Bubble(
            x ? x + offsetX : Math.random() * canvas.width,
            y ? y + offsetY : Math.random() * canvas.height,
            (Math.random() * 30 + 20) * sizeFactor
        ));
    }
}

addBubbles(10);

function animate() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    bubbles = bubbles.filter(bubble => bubble.update(bubbles));
    bubbles.forEach(bubble => bubble.draw());
    requestAnimationFrame(animate);
}

animate();

canvas.addEventListener('click', (e) => {
    addBubbles(5, e.clientX, e.clientY);
});

document.getElementById('more-bubbles').addEventListener('click', () => {
    addBubbles(10);
});

document.getElementById('reset').addEventListener('click', () => {
    bubbles = [];
    sizeFactor = 1;
    addBubbles(10);
});

window.addEventListener('resize', () => {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
});
