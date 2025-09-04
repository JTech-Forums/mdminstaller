class FluidCursor {
    constructor() {
        this.cursor = document.createElement('div');
        this.cursor.className = 'fluid-cursor';
        document.body.appendChild(this.cursor);
        document.body.classList.add('hide-cursor');
        this.pos = { x: window.innerWidth / 2, y: window.innerHeight / 2 };
        this.mouse = { x: this.pos.x, y: this.pos.y };
        this.speed = 0.25;
        document.addEventListener('mousemove', (e) => {
            this.mouse.x = e.clientX;
            this.mouse.y = e.clientY;
        });
        this.render = this.render.bind(this);
        requestAnimationFrame(this.render);
    }

    render() {
        this.pos.x += (this.mouse.x - this.pos.x) * this.speed;
        this.pos.y += (this.mouse.y - this.pos.y) * this.speed;
        this.cursor.style.transform = `translate3d(${this.pos.x}px, ${this.pos.y}px, 0)`;
        requestAnimationFrame(this.render);
    }
}

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => new FluidCursor());
} else {
    new FluidCursor();
}
