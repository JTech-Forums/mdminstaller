export function renderKits(apks, { onInstall } = {}) {
    const grid = document.getElementById('kitsGrid');
    const actions = document.getElementById('kitActions');
    if (!grid || !actions) return null;

    grid.innerHTML = '';

    apks.forEach((apk) => {
        const slide = document.createElement('div');
        slide.className = 'swiper-slide';
        slide.innerHTML = `
            <div class="app-item card-modern">
                <div class="app-icon">
                    ${apk.image ? `<img src="${apk.image}" alt="${apk.title}">` : ''}
                </div>
                <div class="app-content">
                    <span class="app-title">${apk.title}</span>
                </div>
            </div>
        `;
        grid.appendChild(slide);
    });

    const startIndex = apks.findIndex(a => a.key === 'MBsmart' || a.name === 'MBsmart');

    const swiper = new Swiper('#kitsSwiper', {
        effect: 'coverflow',
        grabCursor: true,
        centeredSlides: true,
        centeredSlidesBounds: true,
        slidesPerView: 'auto',
        slideToClickedSlide: true,
        spaceBetween: 20,
        initialSlide: startIndex >= 0 ? startIndex : 0,
        coverflowEffect: {
            rotate: 8,
            stretch: 10,
            depth: 160,
            modifier: 1,
            slideShadows: false
        },
        watchSlidesProgress: true,
        loop: true
    });

    const installBtn = actions.querySelector('.install-btn');
    const infoBtn = actions.querySelector('.info-btn');

    function updateActions() {
        const apk = apks[swiper.realIndex];
        installBtn.onclick = () => onInstall && onInstall(apk);
        infoBtn.href = apk.infoUrl;
    }

    swiper.on('slideChange', updateActions);
    updateActions();

    return swiper;
}
