class FluidCursor {
    constructor() {
        document.body.classList.add('hide-cursor');

        // SVG filter for gooey effect
        document.body.insertAdjacentHTML('afterbegin',
            '<svg xmlns="http://www.w3.org/2000/svg" width="0" height="0"><defs><filter id="gooey"><feGaussianBlur in="SourceGraphic" stdDeviation="10" result="blur"/><feColorMatrix in="blur" mode="matrix" values="1 0 0 0 0 0 1 0 0 0 0 0 1 0 0 0 0 0 20 -10" result="goo"/><feComposite in="SourceGraphic" in2="goo" operator="atop"/></filter></defs></svg>'
        );

        this.container = document.createElement('div');
        this.container.className = 'fluid-cursor';

        this.dot = document.createElement('div');
        this.dot.className = 'cursor-dot';
        this.follow = document.createElement('div');
        this.follow.className = 'cursor-follow';
        this.trail = document.createElement('div');
        this.trail.className = 'cursor-trail';

        this.container.appendChild(this.trail);
        this.container.appendChild(this.follow);
        this.container.appendChild(this.dot);
        document.body.appendChild(this.container);

        this.pos = { x: window.innerWidth / 2, y: window.innerHeight / 2 };
        this.followPos = { ...this.pos };
        this.trailPos = { ...this.pos };

        document.addEventListener('mousemove', (e) => {
            this.pos.x = e.clientX;
            this.pos.y = e.clientY;
            this.dot.style.transform = `translate3d(${this.pos.x}px, ${this.pos.y}px,0)`;
        });

        this.render = this.render.bind(this);
        requestAnimationFrame(this.render);
    }

    render() {
        // follower slightly lags behind cursor
        this.followPos.x += (this.pos.x - this.followPos.x) * 0.2;
        this.followPos.y += (this.pos.y - this.followPos.y) * 0.2;
        this.follow.style.transform = `translate3d(${this.followPos.x}px, ${this.followPos.y}px,0)`;

        // trailing blob lags further creating fluid tail
        this.trailPos.x += (this.followPos.x - this.trailPos.x) * 0.25;
        this.trailPos.y += (this.followPos.y - this.trailPos.y) * 0.25;
        this.trail.style.transform = `translate3d(${this.trailPos.x}px, ${this.trailPos.y}px,0)`;

        requestAnimationFrame(this.render);
    }
}

function init() {
    new FluidCursor();
}

if (typeof module !== 'undefined' && module.exports) {
    module.exports = FluidCursor;
} else {
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
}

