class CursorTrail {
    constructor() {
        const rootStyles = getComputedStyle(document.documentElement);
        this.color = rootStyles.getPropertyValue('--primary-color').trim() || '#3b82f6';
        const { r, g, b } = this.hexToRgb(this.color);
        this.rgbColor = `${r}, ${g}, ${b}`;
        this.particles = [];
        this.mouseX = 0;
        this.mouseY = 0;
        this.lastX = 0;
        this.lastY = 0;
        this.init();
    }

    init() {
        this.canvas = document.createElement('canvas');
        this.canvas.className = 'cursor-trail-canvas';
        this.ctx = this.canvas.getContext('2d');
        document.documentElement.appendChild(this.canvas);
        this.resize();
        window.addEventListener('resize', () => this.resize());
        document.addEventListener('mousemove', (e) => this.handleMouseMove(e));
        this.animate();
    }

    resize() {
        this.canvas.width = window.innerWidth;
        this.canvas.height = window.innerHeight;
    }

    handleMouseMove(e) {
        this.lastX = this.mouseX;
        this.lastY = this.mouseY;
        this.mouseX = e.clientX;
        this.mouseY = e.clientY;
        const dx = this.mouseX - this.lastX;
        const dy = this.mouseY - this.lastY;
        const dist = Math.sqrt(dx * dx + dy * dy) || 1;
        const vx = dx / dist;
        const vy = dy / dist;
        for (let i = 0; i < 2; i++) {
            this.createParticle(vx, vy);
        }
    }

    createParticle(vx, vy) {
        const speed = 0.1 + Math.random() * 0.3;
        const angle = Math.atan2(vy, vx) + (Math.random() - 0.5) * 0.2;
        const particle = {
            x: this.mouseX,
            y: this.mouseY,
            vx: Math.cos(angle) * speed + vx * 0.3,
            vy: Math.sin(angle) * speed + vy * 0.3,
            life: 1,
            decay: 0.01 + Math.random() * 0.01,
            size: 2 + Math.random() * 2
        };
        this.particles.push(particle);
        if (this.particles.length > 150) {
            this.particles.shift();
        }
    }

    animate() {
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
        this.ctx.globalCompositeOperation = 'lighter';
        this.ctx.filter = 'blur(8px)';
        for (let i = this.particles.length - 1; i >= 0; i--) {
            const p = this.particles[i];
            p.life -= p.decay;
            if (p.life <= 0) {
                this.particles.splice(i, 1);
                continue;
            }
            p.x += p.vx;
            p.y += p.vy;
            p.vx *= 0.96;
            p.vy *= 0.96;
            p.vy -= 0.01;
            const alpha = p.life * 0.5;
            const gradient = this.ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, p.size * 2);
            gradient.addColorStop(0, `rgba(${this.rgbColor}, ${alpha})`);
            gradient.addColorStop(1, `rgba(${this.rgbColor}, 0)`);
            this.ctx.fillStyle = gradient;
            this.ctx.beginPath();
            this.ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
            this.ctx.fill();
        }
        this.ctx.globalCompositeOperation = 'source-over';
        this.ctx.filter = 'none';
        requestAnimationFrame(() => this.animate());
    }

    hexToRgb(hex) {
        const normalized = hex.replace('#', '');
        const bigint = parseInt(normalized, 16);
        const r = (bigint >> 16) & 255;
        const g = (bigint >> 8) & 255;
        const b = bigint & 255;
        return { r, g, b };
    }
}

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
        window.cursorTrail = new CursorTrail();
    });
} else {
    window.cursorTrail = new CursorTrail();
}

