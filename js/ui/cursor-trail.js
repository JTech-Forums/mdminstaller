class CursorTrail {
    constructor() {
        const rootStyles = getComputedStyle(document.documentElement);
        this.color = rootStyles.getPropertyValue('--primary-color').trim() || '#8b5cf6';
        this.particles = [];
        this.maxParticles = 20;
        this.mouseX = 0;
        this.mouseY = 0;
        this.animationFrame = null;
        this.init();
    }

    init() {
        this.container = document.createElement('div');
        this.container.className = 'cursor-trail-container';
        document.body.appendChild(this.container);
        document.addEventListener('mousemove', (e) => this.handleMouseMove(e));
        this.animate();
    }

    handleMouseMove(e) {
        this.mouseX = e.clientX;
        this.mouseY = e.clientY;
        this.createParticle();
    }

    createParticle() {
        if (this.particles.length >= this.maxParticles) {
            return;
        }

        const particle = document.createElement('div');
        particle.className = 'cursor-trail-particle';
        const size = 6 + Math.random() * 6;
        particle.style.width = size + 'px';
        particle.style.height = size + 'px';
        particle.style.background = `radial-gradient(circle, ${this.color} 0%, transparent 70%)`;
        particle.style.left = this.mouseX + 'px';
        particle.style.top = this.mouseY + 'px';
        particle.style.opacity = '0.6';
        particle.style.transform = 'translate(-50%, -50%)';

        const particleData = {
            element: particle,
            x: this.mouseX,
            y: this.mouseY,
            vx: (Math.random() - 0.5) * 0.5,
            vy: -0.5 - Math.random() * 0.5,
            life: 1,
            decay: 0.03 + Math.random() * 0.02
        };

        this.container.appendChild(particle);
        this.particles.push(particleData);
    }

    animate() {
        this.particles = this.particles.filter(particle => {
            particle.life -= particle.decay;
            if (particle.life <= 0) {
                particle.element.remove();
                return false;
            }
            particle.x += particle.vx;
            particle.y += particle.vy;
            particle.vy -= 0.02;
            particle.element.style.left = particle.x + 'px';
            particle.element.style.top = particle.y + 'px';
            particle.element.style.opacity = particle.life * 0.6;
            const scale = 1 + (1 - particle.life) * 0.5;
            particle.element.style.transform = `translate(-50%, -50%) scale(${scale})`;
            particle.element.style.filter = `blur(${(1 - particle.life) * 2}px)`;
            return true;
        });
        this.animationFrame = requestAnimationFrame(() => this.animate());
    }
}

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
        window.cursorTrail = new CursorTrail();
    });
} else {
    window.cursorTrail = new CursorTrail();
}
