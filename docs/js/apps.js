import { AdbConnection } from './adb/connections.js';
import { ApkInstaller } from './adb/apk-installer.js';
import { UIManager } from './ui/ui-manager.js';
import KITS from './data/kits.js';
import { renderKits } from './ui/cards.js';
import { loadReviews, loadAllReviews, submitReview, computeAverage } from './reviews.js';
import { deviceHasAccounts, disableAccountApps, reenablePackages, isDeviceRooted } from './adb/account-utils.js';

class JTechMDMInstaller {
    constructor() {
        this.adbConnection = new AdbConnection();
        this.apkInstaller = new ApkInstaller();
        this.uiManager = new UIManager();
        this.device = null;
        this.apkQueue = [];
        this.availableApks = [];
        this.currentTutorialStep = 0;
        this.tutorialSteps = [];
        this.swiper = null;
        this.reviewsCache = {};
        this.infoRenderToken = 0;
        this.activeVendorKey = '';
    }

    async init() {
        this.setupEventListeners();
        this.checkWebUSBSupport();
        this.uiManager.updateConnectionStatus('disconnected');
        await this.loadAvailableApks();
        this.renderAvailableApks(); // Initialize Swiper here
        // Prefetch all reviews to avoid race conditions when swiping fast
        try {
            this.reviewsCache = await loadAllReviews();
        } catch {}
        await this.tryAutoConnect();
        const executeBtn = document.getElementById('executeBtn');
        if (executeBtn) executeBtn.disabled = true;
        // Ensure tutorial dots match steps
        this.setupInlineTutorialDots();
        // Initialize info card based on active slide
        this.bindSwiperInfo();
    }

    checkWebUSBSupport() {
        if (!('usb' in navigator)) {
            this.uiManager.showError('WebUSB is not supported in this browser. Please use Chrome or Edge.');
            const btn = document.getElementById('connectBtn');
            if (btn) btn.disabled = true;
        }
    }

    setupEventListeners() {
        // Connection button
        document.getElementById('connectBtn')?.addEventListener('click', () => this.handleConnect());

        // File upload
        const uploadArea = document.getElementById('uploadArea');
        const apkInput = document.getElementById('apkInput');

        uploadArea?.addEventListener('click', () => apkInput?.click());
        apkInput?.addEventListener('change', (e) => this.handleFileSelection(e));

        // Drag and drop
        uploadArea?.addEventListener('dragover', (e) => {
            e.preventDefault();
            uploadArea.classList.add('drag-over');
        });

        uploadArea?.addEventListener('dragleave', () => {
            uploadArea.classList.remove('drag-over');
        });

        uploadArea?.addEventListener('drop', (e) => {
            e.preventDefault();
            uploadArea.classList.remove('drag-over');
            this.handleFileDrop(e);
        });

        // Queue management
        document.getElementById('clearQueueBtn')?.addEventListener('click', () => this.clearQueue());
        document.getElementById('installBtn')?.addEventListener('click', () => this.installApks());

        // ADB Console
        document.getElementById('executeBtn')?.addEventListener('click', () => this.executeCommand());
        document.getElementById('commandInput')?.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') this.executeCommand();
        });
        document.getElementById('clearConsoleBtn')?.addEventListener('click', () => this.clearConsole());
        document.getElementById('downloadConsoleBtn')?.addEventListener('click', () => this.downloadConsoleOutput());
        document.getElementById('copyConsoleBtn')?.addEventListener('click', () => this.copyConsoleOutput());

        // Modals

        document.getElementById('aboutBtn')?.addEventListener('click', () => {
            document.getElementById('aboutModal')?.classList.remove('hidden');
        });

        document.getElementById('closeTutorialBtn')?.addEventListener('click', () => {
            document.getElementById('tutorialModal')?.classList.add('hidden');
            localStorage.setItem('tutorialSeen', 'true');
        });

        document.getElementById('closeAboutBtn')?.addEventListener('click', () => {
            document.getElementById('aboutModal')?.classList.add('hidden');
        });

        document.getElementById('skipTutorialBtn')?.addEventListener('click', () => {
            document.getElementById('welcomeModal')?.classList.add('hidden');
            localStorage.setItem('tutorialSeen', 'true');
        });

        document.getElementById('startTutorialBtn')?.addEventListener('click', () => {
            document.getElementById('welcomeModal')?.classList.add('hidden');
            this.showTutorialStep(0);
            document.getElementById('tutorialModal')?.classList.remove('hidden');
        });

        document.getElementById('closeWelcomeBtn')?.addEventListener('click', () => {
            document.getElementById('welcomeModal')?.classList.add('hidden');
            localStorage.setItem('tutorialSeen', 'true');
        });

        document.getElementById('nextStepBtn')?.addEventListener('click', () => {
            this.showTutorialStep(this.currentTutorialStep + 1, 'forward');
            this.updateInlineDots();
        });

        document.getElementById('prevStepBtn')?.addEventListener('click', () => {
            this.showTutorialStep(this.currentTutorialStep - 1, 'backward');
            this.updateInlineDots();
        });

        // Inline tutorial navigation inside connection card
        document.getElementById('inlineNextBtn')?.addEventListener('click', () => {
            this.showTutorialStep(this.currentTutorialStep + 1, 'forward');
            this.updateInlineDots();
        });
        document.getElementById('inlinePrevBtn')?.addEventListener('click', () => {
            this.showTutorialStep(this.currentTutorialStep - 1, 'backward');
            this.updateInlineDots();
        });

        // Close modals on outside click
        document.querySelectorAll('.modal').forEach(modal => {
            modal.addEventListener('click', (e) => {
                if (e.target === modal) {
                    modal.classList.add('hidden');
                }
            });
        });

        // Automatically handle USB device connection changes
        if ('usb' in navigator) {
            navigator.usb.addEventListener('disconnect', async () => {
                this.uiManager.logToConsole('USB device disconnected', 'warning');
                if (this.device) {
                    await this.handleDisconnect();
                }
            });

            navigator.usb.addEventListener('connect', async () => {
                this.uiManager.logToConsole('USB device connected', 'info');
                if (!this.device) {
                    await this.tryAutoConnect();
                }
            });
        }

        // Release ADB connection when tab is hidden and reconnect when visible
        // Keep ADB session alive across tab switches to avoid repeated
        // authorization prompts. Reconnect only if we're not already connected.
        document.addEventListener('visibilitychange', async () => {
            if (!document.hidden && !this.device) {
                await this.tryAutoConnect();
            }
        });
    }

    showTutorialStep(index, direction) {
        const inlineContainer = document.querySelector('.tutorial-inline');
        const modalContainer = document.querySelector('#tutorialModal .tutorial-container');
        const usingInline = inlineContainer && !inlineContainer.classList.contains('hidden');
        const scope = usingInline ? inlineContainer : (modalContainer || document);
        this.tutorialSteps = Array.from(scope.querySelectorAll('.tutorial-step'));
        if (this.tutorialSteps.length === 0) return;

        const lastIndex = this.currentTutorialStep;
        if (index >= this.tutorialSteps.length) {
            index = 0; // Start over instead of closing
        }

        if (index < 0) index = 0;

        // Animate transition
        if (typeof lastIndex === 'number' && lastIndex !== index) {
            const forward = direction ? direction === 'forward' : (index > lastIndex || (lastIndex === this.tutorialSteps.length - 1 && index === 0));
            this.animateTutorialTransition(lastIndex, index, forward);
        } else {
            this.tutorialSteps.forEach((step, i) => step.classList.toggle('active', i === index));
        }
        this.currentTutorialStep = index;
        
        const prevBtn = usingInline ? document.getElementById('inlinePrevBtn') : document.getElementById('prevStepBtn');
        const nextBtn = usingInline ? document.getElementById('inlineNextBtn') : document.getElementById('nextStepBtn');

        if (prevBtn) prevBtn.disabled = index === 0;
        if (nextBtn) nextBtn.textContent = (index === this.tutorialSteps.length - 1) ? 'Start Over' : 'Next';
        this.updateInlineDots();
    }

    animateTutorialTransition(fromIndex, toIndex, forward = true) {
        const fromEl = this.tutorialSteps[fromIndex];
        const toEl = this.tutorialSteps[toIndex];
        if (!fromEl || !toEl) return;

        // Lock container height to prevent jump
        const container = fromEl.parentElement;
        if (container) {
            const currentH = fromEl.offsetHeight;
            // Activate target to measure height without flashing
            toEl.classList.add('active');
            const nextH = toEl.offsetHeight;
            const targetH = Math.max(currentH, nextH);
            container.style.height = targetH + 'px';
        } else {
            // Ensure target visible if no container
            toEl.classList.add('active');
        }

        // Apply animation classes
        const leaveClass = forward ? 'leave-left' : 'leave-right';
        const enterClass = forward ? 'enter-right' : 'enter-left';
        // Force a reflow so the browser picks up the active state before animating
        void toEl.offsetWidth;
        fromEl.classList.add(leaveClass);
        toEl.classList.add(enterClass);

        const cleanup = () => {
            fromEl.classList.remove('active', 'leave-left', 'leave-right');
            toEl.classList.remove('enter-right', 'enter-left');
            if (container) container.style.height = '';
            fromEl.removeEventListener('animationend', onAnimEnd);
        };
        const onAnimEnd = () => cleanup();
        fromEl.addEventListener('animationend', onAnimEnd, { once: true });
    }

    updateInlineDots() {
        const count = this.tutorialSteps?.length || 0;
        const dotsContainer = document.getElementById('inlineDots');
        if (!dotsContainer || !count) return;
        // Rebuild if count mismatches
        if (dotsContainer.children.length !== count) {
            dotsContainer.innerHTML = '';
            for (let i = 0; i < count; i++) {
                const span = document.createElement('span');
                span.className = 'dot' + (i === this.currentTutorialStep ? ' active' : '');
                dotsContainer.appendChild(span);
            }
        } else {
            Array.from(dotsContainer.children).forEach((d, i) => d.classList.toggle('active', i === this.currentTutorialStep));
        }
    }

    setupInlineTutorialDots() {
        const inline = document.querySelector('.tutorial-inline');
        if (!inline) return;
        this.tutorialSteps = Array.from(inline.querySelectorAll('.tutorial-step'));
        this.currentTutorialStep = 0;
        this.updateInlineDots();
    }

    async handleConnect(silent = false) {
        try {
            const btn = document.getElementById('connectBtn');
            if (btn) btn.disabled = true;

            if (this.device) {
                await this.handleDisconnect();
            }
            else {
                // Connect
                this.uiManager.logToConsole('Requesting USB device access...', 'info');
                this.uiManager.logToConsole('Please select your Android device from the browser prompt', 'info');
                const connectPromise = this.adbConnection.connect(this.uiManager);
                let dismissAllow = null;
                const allowTimer = setTimeout(() => {
                    dismissAllow = this.uiManager.showWarning('Tap allow on your device');
                }, 1000);
                this.device = await connectPromise.finally(() => {
                    clearTimeout(allowTimer);
                    if (dismissAllow) dismissAllow();
                });

                if (this.device) {
                    await this.finalizeConnection();
                }
            }
        } catch (error) {
            console.error('Connection error:', error);
            if (!silent) {
                if (error.message && error.message.includes('Unable to claim interface')) {
                    this.uiManager.showError("Connection failed: another ADB server might already be using the device. Run `adb kill-server` in your command prompt and then retry.");
                } else {
                    const errorText = error?.message || error?.name || String(error);
                    this.uiManager.showError(`Connection failed: ${errorText}`);
                }
            }
            const btn = document.getElementById('connectBtn');
            if (btn) btn.disabled = false;
            throw error;
        }
    }

    async handleDisconnect() {
        await this.adbConnection.disconnect();
        this.device = null;
        this.apkInstaller.setAdbConnection(null);
        this.uiManager.updateConnectionStatus('disconnected');

        const btn = document.getElementById('connectBtn');
        if (btn) {
            btn.innerHTML = `
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <path d="M20 16V7a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v9m16 0H4m16 0l1.28 2.55a1 1 0 0 1-.9 1.45H3.62a1 1 0 0 1-.9-1.45L4 16"></path>
                </svg>
                Connect
            `;
            btn.disabled = false;
        }

        // Disable only the execute button when disconnected
        const executeBtn = document.getElementById('executeBtn');
        if (executeBtn) executeBtn.disabled = true;

        // Keep swiper active but update button states
        this.updateInstallButtonStates();
    }

    async finalizeConnection() {
        const btn = document.getElementById('connectBtn');
        this.apkInstaller.setAdbConnection(this.adbConnection);
        this.uiManager.logToConsole('Device connected. Getting device information...', 'info');
        this.uiManager.logToConsole('If prompted on your device, tap "Allow" to authorize this computer', 'warning');

        const deviceInfo = await this.adbConnection.getDeviceInfo();
        let rooted = false;
        let accountsFound = false;
        try { rooted = await isDeviceRooted(this.adbConnection); } catch {}
        try { accountsFound = await deviceHasAccounts(this.adbConnection); } catch {}
        this.uiManager.updateConnectionStatus('connected', { ...deviceInfo, rooted, accountsFound });
        if (btn) {
            btn.innerHTML = `
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <path d="M18.36 6.64a9 9 0 1 1-12.73 0"></path>
                    <line x1="12" y1="2" x2="12" y2="12"></line>
                </svg>
                Disconnect
            `;
            btn.disabled = false;
        }
        // Enable execute button when connected
        const executeBtn = document.getElementById('executeBtn');
        if (executeBtn) executeBtn.disabled = false;
        this.uiManager.logToConsole('Device connected and ready', 'success');
        
        // Update install button states when connected
        this.updateInstallButtonStates();
    }

    async tryAutoConnect(retries = 5, delay = 1000) {
        const cached = JSON.parse(localStorage.getItem('adbDevice') || 'null');
        if (!cached) return;

        const devices = await navigator.usb.getDevices();
        const match = devices.find(d =>
            d.vendorId === cached.vendorId &&
            d.productId === cached.productId &&
            (!cached.serialNumber || d.serialNumber === cached.serialNumber)
        );
        if (!match) {
            localStorage.removeItem('adbDevice');
            return;
        }

        for (let attempt = 0; attempt < retries; attempt++) {
            try {
                await this.handleConnect(true);
                return;
            } catch (error) {
                if (!error.message.includes('another ADB instance')) {
                    console.error('Auto-connect failed:', error);
                    localStorage.removeItem('adbDevice');
                    return;
                }
                await new Promise(resolve => setTimeout(resolve, delay));
            }
        }
    }

    handleAppSelection(e) {
        const btn = e.currentTarget;
        const apkType = btn.dataset.apk;

        if (apkType === 'custom') {
            document.getElementById('uploadSection')?.classList.remove('hidden');
            document.getElementById('apkInput')?.click();
        } else {
            const apkInfo = this.getPresetApkInfo(apkType);
            if (apkInfo) {
                this.addToQueue(apkInfo);
                btn.classList.add('selected');
            }
        }
    }

    async loadAvailableApks() {
        try {
            let apks = [];
            const isLocal = location.hostname === 'localhost' || location.hostname === '127.0.0.1';
            try {
                if (isLocal) {
                    const res = await fetch('/api/apks');
                    if (!res.ok) throw new Error('/api/apks failed');
                    apks = await res.json();
                } else {
                    const res = await fetch('apks.json');
                    if (!res.ok) throw new Error('apks.json not found');
                    apks = await res.json();
                }
            } catch (err) {
                const res = await fetch(isLocal ? 'apks.json' : '/api/apks');
                apks = await res.json();
            }

            this.availableApks = apks.map(apk => {
                const kit = KITS.find(k => k.key === apk.name) || {};
                return {
                    ...apk,
                    ...kit,
                    title: kit.title || apk.name,
                    infoUrl: kit.infoUrl || '#',
                    key: kit.key || apk.name,
                    image: kit.image ? `apk/${kit.key}/${kit.image}` : apk.image
                };
            });
            
            // Sort to make eGate and TripleUMDM most prominent
            this.availableApks.sort((a, b) => {
                const priority = { 'eGate': 1, 'TripleUMDM': 2 };
                const aPriority = priority[a.key] || 999;
                const bPriority = priority[b.key] || 999;
                return aPriority - bPriority;
            });
        } catch (error) {
            console.error('Failed to load APKs:', error);
            this.uiManager.logToConsole('Failed to load APK files from server', 'warning');
            this.availableApks = [];
        }
    }

    renderAvailableApks() {
        if (this.swiper) {
            this.swiper.destroy(true, true);
            this.swiper = null;
        }

        this.swiper = renderKits(this.availableApks, {
            onInstall: (apk) => this.installKit(apk)
        });
        
        // Set initial button states based on connection status
        this.updateInstallButtonStates();
    }

    bindSwiperInfo() {
        if (!this.swiper) return;
        const update = () => this.updateInfoCardForActive();
        this.swiper.on('slideChange', update);
        this.swiper.on('activeIndexChange', update);
        this.swiper.on('slideChangeTransitionEnd', update);
        // initial
        setTimeout(update, 0);
    }

    async updateInfoCardForActive() {
        if (!this.swiper || !Array.isArray(this.availableApks) || this.availableApks.length === 0) return;
        const activeIdx = this.swiper.activeIndex ?? 0;
        const slideEl = this.swiper.slides?.[activeIdx];
        const key = slideEl?.dataset?.key;
        let apk = null;
        if (key) {
            apk = this.availableApks.find(a => (a.key || a.name) === key) || null;
        }
        if (!apk) {
            const idx = this.swiper.realIndex ?? 0;
            apk = this.availableApks[idx] || this.availableApks[0];
        }
        await this.renderInfoCard(apk);
    }

    async renderInfoCard(apk) {
        const titleEl = document.getElementById('infoTitle');
        const descEl = document.getElementById('infoDesc');
        const priceEl = document.getElementById('infoPrice');
        const linkEl = document.getElementById('infoLink');
        const ratingEl = document.getElementById('infoRating');
        const listEl = document.getElementById('reviewsList');
        const formEl = document.getElementById('reviewForm');
        const starsInput = document.getElementById('reviewStars');
        const writeBtn = document.getElementById('writeReviewBtn');
        const cancelBtn = document.getElementById('cancelReviewBtn');
        const reviewPanel = document.getElementById('reviewPanel');
        const reviewsSection = document.getElementById('reviews');
        // Default to view mode
        if (reviewPanel && reviewsSection) {
            reviewPanel.classList.add('hidden');
            reviewsSection.classList.remove('hidden');
        }
        // Ensure meta/desc are visible in view mode
        if (descEl) descEl.classList.remove('hidden');
        if (priceEl) priceEl.classList.remove('hidden');
        if (linkEl) linkEl.classList.remove('hidden');

        if (!titleEl) return;

        titleEl.textContent = apk.title || apk.name || 'MDM';
        descEl.textContent = apk.description || 'No description available.';
        const priceText = apk.pricing || apk.price || ((apk.badge && /free/i.test(apk.badge)) ? 'Free' : '—');
        priceEl.textContent = `Price: ${priceText}`;
        if (apk.infoUrl) {
            linkEl.href = apk.infoUrl;
            linkEl.textContent = 'Website';
        } else {
            linkEl.removeAttribute('href');
            linkEl.textContent = '—';
        }

        // Load and render reviews (cached first), guard races when swiping quickly
        const vendor = apk.key || apk.name || 'unknown';
        this.activeVendorKey = vendor;
        const token = ++this.infoRenderToken;
        const cached = this.reviewsCache[vendor];
        if (cached) {
            this.renderStars(ratingEl, computeAverage(cached));
            this.renderReviewsList(listEl, cached);
        } else {
            this.renderReviewsList(listEl, []);
        }
        try {
            const fresh = await loadReviews(vendor);
            if (token === this.infoRenderToken && vendor === this.activeVendorKey) {
                this.reviewsCache[vendor] = fresh;
                this.renderStars(ratingEl, computeAverage(fresh));
                this.renderReviewsList(listEl, fresh);
            }
        } catch {}
        this.setupReviewForm(starsInput, formEl, vendor, listEl, ratingEl, () => {
            if (reviewPanel && reviewsSection) {
                reviewPanel.classList.add('hidden');
                reviewsSection.classList.remove('hidden');
                if (descEl) descEl.classList.remove('hidden');
                if (priceEl) priceEl.classList.remove('hidden');
                if (linkEl) linkEl.classList.remove('hidden');
            }
        });

        if (writeBtn && reviewPanel && reviewsSection) {
            writeBtn.onclick = () => {
                reviewsSection.classList.add('hidden');
                reviewPanel.classList.remove('hidden');
                if (descEl) descEl.classList.add('hidden');
                if (priceEl) priceEl.classList.add('hidden');
                if (linkEl) linkEl.classList.add('hidden');
            };
        }
        if (cancelBtn && reviewPanel && reviewsSection) {
            cancelBtn.onclick = () => {
                reviewPanel.classList.add('hidden');
                reviewsSection.classList.remove('hidden');
                if (descEl) descEl.classList.remove('hidden');
                if (priceEl) priceEl.classList.remove('hidden');
                if (linkEl) linkEl.classList.remove('hidden');
            };
        }
    }

    renderStars(container, avgOrValue) {
        if (!container) return;
        const value = Number(avgOrValue) || 0;
        container.innerHTML = '';
        for (let i = 1; i <= 5; i++) {
            const span = document.createElement('span');
            span.className = 'star' + (i <= Math.round(value) ? '' : ' empty');
            span.textContent = '★';
            container.appendChild(span);
        }
        // stars only; omit numeric avg
    }

    renderReviewsList(container, reviews) {
        if (!container) return;
        container.innerHTML = '';
        if (!reviews || reviews.length === 0) {
            const empty = document.createElement('div');
            empty.className = 'review-item';
            empty.textContent = 'No reviews yet. Be the first to review!';
            container.appendChild(empty);
            return;
        }
        reviews.slice(0, 20).forEach(r => {
            const item = document.createElement('div');
            item.className = 'review-item';
            const meta = document.createElement('div');
            meta.className = 'review-meta';
            const left = document.createElement('div');
            left.textContent = r.name || 'Anonymous';
            const right = document.createElement('div');
            right.textContent = new Date(r.createdAt || Date.now()).toLocaleDateString();
            meta.appendChild(left);
            meta.appendChild(right);
            const stars = document.createElement('div');
            stars.className = 'info-rating';
            for (let i = 1; i <= 5; i++) {
                const s = document.createElement('span');
                s.className = 'star' + (i <= (Number(r.rating) || 0) ? '' : ' empty');
                s.textContent = '★';
                stars.appendChild(s);
            }
            const text = document.createElement('div');
            text.className = 'review-body';
            text.textContent = r.text || '';
            item.appendChild(meta);
            item.appendChild(stars);
            item.appendChild(text);
            container.appendChild(item);
        });
    }

    setupReviewForm(starsContainer, formEl, vendor, listEl, avgContainer, onSubmitted) {
        if (!starsContainer || !formEl) return;
        // Build interactive star input
        starsContainer.innerHTML = '';
        let selected = 5;
        const draw = () => {
            starsContainer.querySelectorAll('.star').forEach((node, idx) => {
                node.classList.toggle('empty', idx + 1 > selected);
            });
        };
        for (let i = 1; i <= 5; i++) {
            const star = document.createElement('span');
            star.className = 'star' + (i <= selected ? '' : ' empty');
            star.textContent = '★';
            star.dataset.value = String(i);
            star.addEventListener('click', () => { selected = i; draw(); });
            starsContainer.appendChild(star);
        }

        formEl.onsubmit = async (e) => {
            e.preventDefault();
            const name = (document.getElementById('reviewName')?.value || '').trim();
            const text = (document.getElementById('reviewText')?.value || '').trim();
            if (!text) return;
            try {
                const updated = await submitReview(vendor, { name, text, rating: selected });
                this.reviewsCache[vendor] = updated;
                this.renderReviewsList(listEl, updated);
                this.renderStars(avgContainer, computeAverage(updated));
                formEl.reset();
                selected = 5; draw();
                if (typeof onSubmitted === 'function') onSubmitted();
            } catch (err) {
                console.warn('Review submit failed:', err && err.message, err && err.details);
                const n = document.createElement('div');
                n.style.cssText = 'position:fixed;top:20px;left:20px;background:linear-gradient(135deg,#ef4444,#dc2626);color:#fff;padding:10px 14px;border-radius:8px;z-index:1002;box-shadow:0 10px 15px -3px rgba(0,0,0,.5);border:1px solid var(--border-color);';
                n.textContent = 'Review submission failed. Please try again.';
                document.body.appendChild(n);
                setTimeout(() => n.remove(), 5000);
            }
        };
    }
    
    updateInstallButtonStates() {
        const installButtons = document.querySelectorAll('.install-btn');
        installButtons.forEach(btn => {
            btn.disabled = !this.device;
            btn.textContent = 'Install';
        });
    }

    getPresetApkInfo(type) {
        if (type === 'custom') return null;

        if (type.startsWith('file-')) {
            const index = parseInt(type.replace('file-', ''), 10);
            const apk = this.availableApks[index];

            if (apk) {
                return {
                    name: apk.name,
                    file: null,
                    url: apk.url,
                    size: 'Remote',
                    package: 'unknown',
                    postInstallCommands: apk.postInstallCommands
                };
            }
            }
        return null;
    }

    handleFileSelection(e) {
        const files = Array.from(e.target.files || []);
        files.forEach(file => {
            if (file.name.toLowerCase().endsWith('.apk')) {
                this.addToQueue({
                    name: file.name,
                    file: file,
                    size: this.formatFileSize(file.size),
                    package: 'unknown'
                });
            }
        });
    }

    handleFileDrop(e) {
        const files = Array.from(e.dataTransfer.files || []);
        files.forEach(file => {
            if (file.name.toLowerCase().endsWith('.apk')) {
                this.addToQueue({
                    name: file.name,
                    file: file,
                    size: this.formatFileSize(file.size),
                    package: 'unknown'
                });
            }
        });
    }

    addToQueue(apkInfo) {
        const exists = this.apkQueue.find(item => item.name === apkInfo.name);
        if (!exists) {
            this.apkQueue.push(apkInfo);
            this.updateQueueDisplay();
            document.getElementById('apkQueue')?.classList.remove('hidden');
        }
    }

    removeFromQueue(index) {
        this.apkQueue.splice(index, 1);
        this.updateQueueDisplay();
        if (this.apkQueue.length === 0) {
            document.getElementById('apkQueue')?.classList.add('hidden');
        }
    }

    clearQueue() {
        this.apkQueue = [];
        this.updateQueueDisplay();
        document.getElementById('apkQueue')?.classList.add('hidden');
        document.querySelectorAll('.app-item').forEach(btn => {
            btn.classList.remove('selected');
        });
    }

    updateQueueDisplay() {
        const queueList = document.getElementById('queueList');
        if (!queueList) return;

        queueList.innerHTML = '';

        this.apkQueue.forEach((apk, index) => {
            const item = document.createElement('div');
            item.className = 'queue-item';
            item.innerHTML = `
                <div class="queue-item-info">
                    <div class="queue-item-icon">APK</div>
                    <div class="queue-item-details">
                        <h4>${apk.name}</h4>
                        <p>${apk.size} • ${apk.package}</p>
                    </div>
                </div>
                <button class="queue-item-remove" data-index="${index}">
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <line x1="18" y1="6" x2="6" y2="18"></line>
                        <line x1="6" y1="6" x2="18" y2="18"></line>
                    </svg>
                </button>
            `;

            item.querySelector('.queue-item-remove')?.addEventListener('click', () => {
                this.removeFromQueue(index);
            });

            queueList.appendChild(item);
        });
    }

    async installApks() {
        if (!this.device) {
            this.uiManager.showError('Please connect a device first');
            return;
        }

        if (this.apkQueue.length === 0) {
            this.uiManager.showError('No APKs in queue');
            return;
        }

        const installBtn = document.getElementById('installBtn');
        if (installBtn) installBtn.disabled = true;

        let successCount = 0;
        let failCount = 0;

        for (let i = 0; i < this.apkQueue.length; i++) {
            const apk = this.apkQueue[i];
            const progress = ((i + 1) / this.apkQueue.length) * 100;

            this.uiManager.updateProgress(progress, `Installing ${apk.name}...`);

            try {
                let fileToInstall = apk.file;

                if (apk.url && !apk.file) {
                    this.uiManager.logToConsole(`Downloading ${apk.name}...`, 'info');
                    const response = await fetch(apk.url);
                    if (!response.ok) {
                        throw new Error(`Failed to load APK file: ${response.statusText}`);
                    }
                    const arrayBuffer = await response.arrayBuffer();
                    fileToInstall = new File([arrayBuffer], apk.name + '.apk', { type: 'application/vnd.android.package-archive' });
                }

                if (fileToInstall) {
                    await this.apkInstaller.installFromFile(this.device, fileToInstall);

                    if (apk.postInstallCommands && apk.postInstallCommands.length > 0) {
                        this.uiManager.logToConsole(`Executing post-install commands for ${apk.name}...`, 'info');
                        this.uiManager.logToConsole('Waiting for app components to register...', 'info');
                        await new Promise(resolve => setTimeout(resolve, 2000));

                        for (const command of apk.postInstallCommands) {
                            if (command.trim()) {
                                try {
                                    if (command.includes('dpm set-device-owner') || command.includes('device-admin')) {
                                        this.uiManager.logToConsole('Device admin command detected - waiting for component registration...', 'info');
                                        await new Promise(resolve => setTimeout(resolve, 3000));
                                    }

                                    await this.executeCommandWithAccountCheck(command);

                                    await new Promise(resolve => setTimeout(resolve, 500));

                                } catch (cmdError) {
                                    this.uiManager.logToConsole(`Command failed: ${command} - ${cmdError.message}`, 'warning');
                                }
                            }
                        }

                        this.uiManager.logToConsole(`Post-install setup completed for ${apk.name}`, 'success');
                    }
                } else {
                    throw new Error('No APK file available for installation');
                }

                successCount++;
                this.uiManager.logToConsole(`Successfully installed ${apk.name}`, 'success');
            } catch (error) {
                failCount++;
                this.uiManager.logToConsole(`Failed to install ${apk.name}: ${error.message}`, 'error');
            }
        }

        this.uiManager.updateProgress(100, 'Installation complete');
        this.uiManager.logToConsole(`Installation complete: ${successCount} succeeded, ${failCount} failed`,
            failCount > 0 ? 'warning' : 'success');

        if (installBtn) installBtn.disabled = false;

        setTimeout(() => {
            this.clearQueue();
        }, 2000);
    }

    async installKit(apk) {
        if (!this.device) {
            this.uiManager.showError('Please connect a device first');
            return;
        }

        this.uiManager.updateProgress(0, `Installing ${apk.title || apk.name}...`);

        try {
            let fileToInstall = apk.file;

            if (apk.url && !apk.file) {
                this.uiManager.logToConsole(`Downloading ${apk.title || apk.name}...`, 'info');
                const response = await fetch(apk.url);
                if (!response.ok) {
                    throw new Error(`Failed to load APK file: ${response.statusText}`);
                }
                const arrayBuffer = await response.arrayBuffer();
                fileToInstall = new File([arrayBuffer], (apk.name || apk.title) + '.apk', { type: 'application/vnd.android.package-archive' });
            }

            if (!fileToInstall) throw new Error('No APK file available for installation');

            await this.apkInstaller.installFromFile(this.device, fileToInstall);

            if (apk.postInstallCommands && apk.postInstallCommands.length > 0) {
                this.uiManager.logToConsole(`Executing post-install commands for ${apk.title || apk.name}...`, 'info');
                this.uiManager.logToConsole('Waiting for app components to register...', 'info');
                await new Promise(resolve => setTimeout(resolve, 2000));

                for (const command of apk.postInstallCommands) {
                    if (!command.trim()) continue;
                    try {
                        if (command.includes('dpm set-device-owner') || command.includes('device-admin')) {
                            this.uiManager.logToConsole('Device admin command detected - waiting for component registration...', 'info');
                            await new Promise(resolve => setTimeout(resolve, 3000));
                        }

                        await this.executeCommandWithAccountCheck(command);

                        await new Promise(resolve => setTimeout(resolve, 500));
                    } catch (cmdError) {
                        this.uiManager.logToConsole(`Command failed: ${command} - ${cmdError.message}`, 'warning');
                    }
                }

                this.uiManager.logToConsole(`Post-install setup completed for ${apk.title || apk.name}`, 'success');
            }

            this.uiManager.updateProgress(100, 'Installation complete');
            this.uiManager.logToConsole(`Successfully installed ${apk.title || apk.name}`, 'success');
            this.uiManager.showSuccess(`${apk.title || apk.name} installed successfully`);
        } catch (error) {
        this.uiManager.updateProgress(100, 'Installation failed');
        this.uiManager.logToConsole(`Failed to install ${apk.title || apk.name}: ${error.message}`, 'error');
        this.uiManager.showError(`Failed to install ${apk.title || apk.name}: ${error.message}`);
    }
}

    async executeCommandWithAccountCheck(command) {
        this.uiManager.logToConsole(`Running: ${command}`, 'info');
        let result = await this.adbConnection.executeShellCommand(command);

        if (command.includes('dpm set-device-owner') && !/success/i.test(result)) {
            const hasAccounts = /account/i.test(result) || await deviceHasAccounts(this.adbConnection);
            if (hasAccounts) {
                this.uiManager.logToConsole('Accounts detected - temporarily disabling account apps...', 'warning');
                const disabled = await disableAccountApps(this.adbConnection);
                try {
                    this.uiManager.logToConsole('Retrying device owner command...', 'info');
                    result = await this.adbConnection.executeShellCommand(command);
                } finally {
                    await reenablePackages(this.adbConnection, disabled);
                }
                if (!/success/i.test(result)) {
                    throw new Error('accounts found - please go into settings>accounts>remove all accounts - then reboot and try again.');
                }
            } else {
                throw new Error(result.trim() || 'Command failed');
            }
        }

        if (result.trim()) {
            this.uiManager.logToConsole(`Command output: ${result.trim()}`, 'info');
        }
        return result;
    }

    formatFileSize(bytes) {
        if (bytes === 0) return '0 Bytes';
        const k = 1024;
        const sizes = ['Bytes', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + ' ' + sizes[i];
    }

    async executeCommand() {
        const commandInput = document.getElementById('commandInput');
        const command = commandInput?.value.trim();
        if (!command) return;

        if (!this.device) {
            this.uiManager.logToConsole('ERROR: No device connected', 'error');
            return;
        }

        const executeBtn = document.getElementById('executeBtn');
        if (executeBtn) {
            executeBtn.disabled = true;
            executeBtn.innerHTML = `
                <svg class="spinner" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <path d="M21 12a9 9 0 1 1-6.219-8.56"></path>
                </svg>
                Running...
            `;
        }

        try {
            this.uiManager.logToConsole(`$ adb shell ${command}`, 'command');
            const result = await this.adbConnection.executeShellCommand(command);
            if (result.trim()) this.uiManager.logToConsole(result, 'output');
            else this.uiManager.logToConsole('(no output)', 'info');
        } catch (error) {
            this.uiManager.logToConsole(`ERROR: ${error.message}`, 'error');
        }

        if (executeBtn) {
            executeBtn.disabled = false;
            executeBtn.innerHTML = `
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <polygon points="5,3 19,12 5,21"></polygon>
                </svg>
                Execute
            `;
        }
        if (commandInput) commandInput.value = '';
    }


    

    

    

    clearConsole() {
        const consoleOutput = document.getElementById('consoleOutput');
        if (consoleOutput) consoleOutput.innerHTML = '';
    }

    downloadConsoleOutput() {
        const consoleOutput = document.getElementById('consoleOutput');
        if (!consoleOutput || consoleOutput.children.length === 0) {
            this.uiManager.showWarning('No console output to download');
            return;
        }

        const content = Array.from(consoleOutput.children)
            .map(entry => entry.textContent)
            .join('\n');

        const timestamp = new Date().toISOString().replace(/[:.]/g, '-') ;
        const filename = `adb-console-output-${timestamp}.txt`;

        const blob = new Blob([content], { type: 'text/plain' });
        const url = URL.createObjectURL(blob);

        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);

        this.uiManager.showSuccess('Console output downloaded');
    }

    async executeRawCommand(command) {
        if (!this.adbConnection || !this.adbConnection.adb) {
            throw new Error('No device connected');
        }

        try {
            return await this.adbConnection.adb.subprocess.spawnWaitText(command);
        } catch (error) {
            throw new Error(`Failed to execute command: ${error.message}`);
        }
    }

    copyConsoleOutput() {
        const consoleOutput = document.getElementById('consoleOutput');
        if (!consoleOutput || consoleOutput.children.length === 0) {
            this.uiManager.showWarning('No console output to copy');
            return;
        }
        const content = Array.from(consoleOutput.children)
            .map(entry => entry.textContent)
            .join('\n');
        navigator.clipboard.writeText(content)
            .then(() => this.uiManager.showSuccess('Console output copied to clipboard'))
            .catch(() => this.uiManager.showError('Failed to copy output'));
    }

    setupNewCardEffects() {
        const card = document.getElementById('newCard');
        if (!card) return;
        // Ensure emoji exists (in case the markup was not present)
        if (!card.querySelector('.new-card-emoji')) {
            const img = document.createElement('img');
            img.src = 'https://raw.githubusercontent.com/JTech-Forums/mdminstaller/main/emoji.png';
            img.alt = 'emoji';
            img.className = 'new-card-emoji';
            card.appendChild(img);
        }
        const setCoords = (clientX, clientY) => {
            const rect = card.getBoundingClientRect();
            const x = ((clientX - rect.left) / rect.width) * 100;
            const y = ((clientY - rect.top) / rect.height) * 100;
            card.style.setProperty('--x', x + '%');
            card.style.setProperty('--y', y + '%');
        };
        const trigger = (clientX, clientY) => {
            setCoords(clientX, clientY);
            card.classList.remove('boom');
            // restart animation
            void card.offsetWidth; // reflow
            card.classList.add('boom');
        };
        card.addEventListener('mousemove', (e) => setCoords(e.clientX, e.clientY));
        card.addEventListener('mouseenter', (e) => trigger(e.clientX, e.clientY));
        card.addEventListener('click', (e) => {
            trigger(e.clientX, e.clientY);
            card.classList.toggle('revealed');
        });
        card.addEventListener('touchstart', (e) => {
            const t = e.touches[0];
            if (!t) return;
            trigger(t.clientX, t.clientY);
            card.classList.toggle('revealed');
        }, { passive: true });
    }
}


/* ---------- Initialize app when DOM is ready ---------- */
document.addEventListener('DOMContentLoaded', async () => {
    const app = new JTechMDMInstaller();
    await app.init();
    window.uiManager = app.uiManager;
    // Do not auto-open tutorial/welcome on first load
});
