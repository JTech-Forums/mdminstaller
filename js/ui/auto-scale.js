(function() {
    const BASE_WIDTH = 1920;
    function adjustScale() {
        const scale = Math.min(window.innerWidth / BASE_WIDTH, 1);
        document.body.style.setProperty('--page-scale', scale.toString());
        if (scale < 1) {
            document.body.classList.add('scaled');
        } else {
            document.body.classList.remove('scaled');
        }
    }
    window.addEventListener('load', adjustScale);
    window.addEventListener('resize', adjustScale);
})();

