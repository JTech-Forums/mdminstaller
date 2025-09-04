class CursorTrail {
    constructor() {
        this.icons = [
            '/apk/eGate/egate.svg',
            '/apk/TripleUMDM/tripleumdm.svg',
            '/apk/GenTech/gentech.svg',
            '/apk/Kdroid/kdroid.svg',
            '/apk/KosherPlay/kosherplay.svg',
            '/apk/Livigent/livigent.svg',
            '/apk/MBsmart/mbsmart.svg',
            '/apk/Meshimer/meshimer.svg',
            '/apk/Netfree/netfree.svg',
            '/apk/Netspark/netspark.svg',
            '/apk/OfflineMDM/offline.svg',
            '/apk/OldMDM/oldmdm.svg',
            '/apk/SecureGuardMDM/secureguard.svg',
            '/apk/Techloq/techloq.svg'
        ];
        
        this.particles = [];
        this.maxParticles = 25; // More particles for denser smoke
        this.mouseX = 0;
        this.mouseY = 0;
        this.lastMouseX = 0;
        this.lastMouseY = 0;
        this.isMoving = false;
        this.moveTimeout = null;
        this.animationFrame = null;
        this.particleCounter = 0;
        
        this.init();
    }
    
    init() {
        // Create container for trail particles
        this.container = document.createElement('div');
        this.container.className = 'cursor-trail-container';
        document.body.appendChild(this.container);
        
        // Track mouse movement
        document.addEventListener('mousemove', (e) => this.handleMouseMove(e));
        
        // Start animation loop
        this.animate();
    }
    
    handleMouseMove(e) {
        this.mouseX = e.clientX;
        this.mouseY = e.clientY;
        
        // Calculate movement speed
        const dx = this.mouseX - this.lastMouseX;
        const dy = this.mouseY - this.lastMouseY;
        const speed = Math.sqrt(dx * dx + dy * dy);
        
        // Create particles more frequently for denser smoke
        if (speed > 1) {
            this.isMoving = true;
            // Create multiple particles for smoky effect
            this.createParticle();
            if (speed > 5 && this.particleCounter % 2 === 0) {
                setTimeout(() => this.createParticle(), 50);
            }
            this.particleCounter++;
        }
        
        this.lastMouseX = this.mouseX;
        this.lastMouseY = this.mouseY;
        
        // Clear existing timeout and set new one
        clearTimeout(this.moveTimeout);
        this.moveTimeout = setTimeout(() => {
            this.isMoving = false;
        }, 100);
    }
    
    createParticle() {
        // Limit number of particles
        if (this.particles.length >= this.maxParticles) {
            return;
        }
        
        const particle = document.createElement('div');
        particle.className = 'cursor-trail-particle';
        
        // Random icon from MDM collection
        const randomIcon = this.icons[Math.floor(Math.random() * this.icons.length)];
        particle.style.backgroundImage = `url('${randomIcon}')`;
        
        // Position at mouse with larger random spread for smoke effect
        const offsetX = (Math.random() - 0.5) * 40;
        const offsetY = (Math.random() - 0.5) * 40;
        particle.style.left = (this.mouseX + offsetX) + 'px';
        particle.style.top = (this.mouseY + offsetY) + 'px';
        
        // Larger initial size for more visibility
        const scale = 0.6 + Math.random() * 0.8;
        particle.style.transform = `translate(-50%, -50%) scale(${scale})`;
        
        // Add initial opacity
        particle.style.opacity = '0.7';
        
        // Track particle data with smoke-like properties
        const particleData = {
            element: particle,
            x: this.mouseX + offsetX,
            y: this.mouseY + offsetY,
            vx: (Math.random() - 0.5) * 3,  // More horizontal spread
            vy: (Math.random() - 0.5) * 2 - 2,  // Stronger upward drift
            life: 1.0,
            decay: 0.015 + Math.random() * 0.015,  // Slower decay for longer trails
            scale: scale,
            rotation: Math.random() * 360
        };
        
        this.container.appendChild(particle);
        this.particles.push(particleData);
    }
    
    animate() {
        // Update each particle
        this.particles = this.particles.filter(particle => {
            // Update life
            particle.life -= particle.decay;
            
            if (particle.life <= 0) {
                // Remove dead particle
                particle.element.remove();
                return false;
            }
            
            // Update position with smoke physics
            particle.x += particle.vx;
            particle.y += particle.vy;
            particle.vy -= 0.08; // Stronger upward drift for smoke
            particle.vx *= 0.98; // Slow down horizontal movement
            
            // Add some turbulence
            particle.x += Math.sin(particle.life * 10) * 0.5;
            
            // Update visual properties
            particle.element.style.left = particle.x + 'px';
            particle.element.style.top = particle.y + 'px';
            particle.element.style.opacity = particle.life * 0.8;
            
            // Expand and rotate as it rises (smoke effect)
            const currentScale = particle.scale * (1 + (1 - particle.life) * 1.5);
            particle.rotation += 2;
            particle.element.style.transform = `translate(-50%, -50%) scale(${currentScale}) rotate(${particle.rotation}deg)`;
            
            // Add blur as particle fades
            particle.element.style.filter = `blur(${(1 - particle.life) * 3}px)`;
            
            return true;
        });
        
        this.animationFrame = requestAnimationFrame(() => this.animate());
    }
    
    destroy() {
        // Clean up
        if (this.animationFrame) {
            cancelAnimationFrame(this.animationFrame);
        }
        this.particles.forEach(p => p.element.remove());
        this.particles = [];
        if (this.container) {
            this.container.remove();
        }
    }
}

// Initialize cursor trail when DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
        window.cursorTrail = new CursorTrail();
    });
} else {
    window.cursorTrail = new CursorTrail();
}