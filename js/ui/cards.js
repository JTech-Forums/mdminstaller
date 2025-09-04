export function renderKits(apks, { onInstall } = {}) {
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
                    ${apk.infoUrl ? `<a class="info-overlay" href="${apk.infoUrl}" target="_blank" rel="noopener noreferrer">View Info</a>` : ''}
                </div>
                <div class="app-content">
                    <span class="app-title">${apk.title}</span>
                    <button class="install-btn">Install</button>
                </div>
            </div>
        `;

        slide.querySelector('.install-btn')?.addEventListener('click', () => onInstall && onInstall(apk));

        grid.appendChild(slide);
    });

    // Start with eGate as the prominent option
    const startIndex = apks.findIndex(a => a.key === 'eGate' || a.name === 'eGate');

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

