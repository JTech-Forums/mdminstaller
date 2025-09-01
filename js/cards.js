export function renderKits(apks, { onInstall, onInfo } = {}) {
    const grid = document.getElementById('kitsGrid');
    if (!grid) return null;

    grid.innerHTML = '';

    apks.forEach((apk) => {
        const slide = document.createElement('div');
        slide.className = 'swiper-slide';
        slide.innerHTML = `
            <div class="app-item card-modern">
                <div class="app-icon">
                    ${apk.image ? `<img src="${apk.image}" alt="${apk.title}">` : ''}
                </div>
                <span class="app-title">${apk.title}</span>
                <div class="action-bar">
                    <button class="install-btn">Install</button>
                    <button class="info-btn">View Info</button>
                </div>
            </div>
        `;

        slide.querySelector('.install-btn')?.addEventListener('click', () => onInstall && onInstall(apk));
        slide.querySelector('.info-btn')?.addEventListener('click', () => onInfo && onInfo(apk));

        grid.appendChild(slide);
    });

    const startIndex = apks.findIndex(a => a.key === 'MBsmart' || a.name === 'MBsmart');

    return new Swiper('#kitsSwiper', {
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
}
