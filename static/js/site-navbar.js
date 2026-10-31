function formatGatherlyDate(value) {
    if (!value) return '';
    const match = String(value).match(/^(\d{4})-(\d{2})-(\d{2})/);
    const date = match
        ? new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]))
        : new Date(String(value).replace(' ', 'T'));
    return Number.isNaN(date.getTime())
        ? String(value)
        : date.toLocaleDateString('en-IN', {day: 'numeric', month: 'long', year: 'numeric'});
}

function formatGatherlyTime(value) {
    if (!value) return '';
    const match = String(value).match(/(?:T|\s)?(\d{1,2}):(\d{2})/);
    if (!match) return String(value);
    const hours = Number(match[1]);
    const minutes = Number(match[2]);
    if (hours > 23 || minutes > 59) return String(value);
    const suffix = hours >= 12 ? 'PM' : 'AM';
    return `${hours % 12 || 12}:${String(minutes).padStart(2, '0')} ${suffix}`;
}

function formatGatherlyDateTime(value) {
    if (!value) return '';
    const match = String(value).match(/^(\d{4}-\d{2}-\d{2})[T ](\d{1,2}:\d{2})/);
    return match
        ? `${formatGatherlyDate(match[1])} · ${formatGatherlyTime(match[2])}`
        : formatGatherlyDate(value);
}

window.formatGatherlyDate = formatGatherlyDate;
window.formatGatherlyTime = formatGatherlyTime;
window.formatGatherlyDateTime = formatGatherlyDateTime;

// Global Navigation Actions (Works from any page on the site)
function handleHostEventNav() {
    if (typeof window.openCreateEventModal === 'function') {
        window.openCreateEventModal();
    } else {
        window.location.href = '/?create=1';
    }
}

function handleNavAction(action) {
    // Close user dropdown if open
    const userMenu = document.getElementById('navUserMenu') || document.querySelector('.nav-account-menu');
    if (userMenu) userMenu.removeAttribute('open');

    // Close mobile drawer if open
    const mobileContent = document.getElementById('navMobileContent');
    const mobileToggle = document.getElementById('navMobileToggle');
    if (mobileContent) mobileContent.classList.remove('is-open');
    if (mobileToggle) {
        mobileToggle.setAttribute('aria-expanded', 'false');
        mobileToggle.setAttribute('aria-label', 'Open navigation menu');
    }

    if (action === 'passes') {
        if (typeof window.openPasses === 'function') {
            window.openPasses();
        } else {
            window.location.href = '/?passes=1';
        }
    } else if (action === 'invitations') {
        if (typeof window.openInvitations === 'function') {
            window.openInvitations();
        } else {
            window.location.href = '/account#invitations';
        }
    } else if (action === 'updates') {
        if (typeof window.openEventUpdates === 'function') {
            window.openEventUpdates();
        } else {
            window.location.href = '/account#updates';
        }
    } else if (action === 'wishlist') {
        if (typeof window.openWishlist === 'function') {
            window.openWishlist();
        } else {
            window.location.href = '/?wishlist=1';
        }
    }
}

window.handleHostEventNav = handleHostEventNav;
window.handleNavAction = handleNavAction;

document.addEventListener('DOMContentLoaded', () => {
    // 1. Mobile navigation drawer toggle
    const mobileToggle = document.getElementById('navMobileToggle');
    const mobileContent = document.getElementById('navMobileContent');

    mobileToggle?.addEventListener('click', (e) => {
        e.stopPropagation();
        const isOpen = mobileToggle.getAttribute('aria-expanded') === 'true';

        mobileToggle.setAttribute('aria-expanded', String(!isOpen));
        mobileToggle.setAttribute(
            'aria-label',
            isOpen ? 'Open navigation menu' : 'Close navigation menu'
        );

        mobileContent?.classList.toggle('is-open', !isOpen);
    });

    // Mobile calendar link handling
    document.getElementById('mobileCalendarLink')?.addEventListener('click', () => {
        const desktopCalendar = document.getElementById('calendarNavLink');
        if (desktopCalendar && typeof desktopCalendar.click === 'function') {
            desktopCalendar.click();
        }
    });

    // Close the mobile menu after clicking any link inside it
    mobileContent?.querySelectorAll('a, button').forEach(item => {
        item.addEventListener('click', () => {
            mobileContent.classList.remove('is-open');
            mobileToggle?.setAttribute('aria-expanded', 'false');
            mobileToggle?.setAttribute('aria-label', 'Open navigation menu');
        });
    });

    // 2. Notification Badges Synchronization
    const navTotalBadge = document.getElementById('navTotalBadge');
    const inviteCount = document.getElementById('invitePendingCount');
    const updateCount = document.getElementById('eventUpdateCount');
    const mobileInviteCount = document.getElementById('mobileInvitePendingCount');
    const mobileUpdateCount = document.getElementById('mobileEventUpdateCount');

    function updateNavTotalBadge() {
        if (!navTotalBadge) return;

        const countValue = element => {
            if (!element || element.classList.contains('hidden')) {
                return 0;
            }
            return Number.parseInt(element.textContent.trim(), 10) || 0;
        };

        const total = countValue(inviteCount) + countValue(updateCount);

        navTotalBadge.hidden = total === 0;
        navTotalBadge.textContent = total > 99 ? '99+' : String(total);

        // Sync with mobile badges
        if (mobileInviteCount && inviteCount) {
            mobileInviteCount.textContent = inviteCount.textContent;
            mobileInviteCount.className = inviteCount.className;
        }
        if (mobileUpdateCount && updateCount) {
            mobileUpdateCount.textContent = updateCount.textContent;
            mobileUpdateCount.className = updateCount.className;
        }
    }

    updateNavTotalBadge();

    [inviteCount, updateCount].forEach(element => {
        if (!element) return;
        new MutationObserver(updateNavTotalBadge).observe(element, {
            childList: true,
            characterData: true,
            attributes: true,
            subtree: true
        });
    });

    // 3. Proactive background badge fetch on secondary pages if not already fetched
    const isUserMenuPresent = document.querySelector('.nav-user-menu, .nav-account-menu');
    if (isUserMenuPresent && (!inviteCount || !inviteCount.textContent.trim())) {
        fetch('/api/invitations')
            .then(r => r.json())
            .then(data => {
                if (data && data.success && Array.isArray(data.invitations)) {
                    const pending = data.invitations.filter(item => item.status === 'PENDING').length;
                    if (inviteCount) {
                        inviteCount.textContent = String(pending);
                        inviteCount.classList.toggle('hidden', pending === 0);
                    }
                    updateNavTotalBadge();
                }
            })
            .catch(() => {});

        fetch('/api/my/notifications')
            .then(r => r.json())
            .then(data => {
                if (data && data.success && Array.isArray(data.notifications)) {
                    const unread = data.notifications.filter(item => !item.is_read).length;
                    if (updateCount) {
                        updateCount.textContent = String(unread);
                        updateCount.classList.toggle('hidden', unread === 0);
                    }
                    updateNavTotalBadge();
                }
            })
            .catch(() => {});
    }

    // 4. Close User Dropdown and Mobile Drawer when clicking outside
    const userMenu = document.querySelector('.nav-account-menu, .nav-user-menu');

    document.addEventListener('click', event => {
        if (userMenu && !userMenu.contains(event.target)) {
            userMenu.removeAttribute('open');
        }
        if (mobileContent && mobileToggle && !mobileContent.contains(event.target) && !mobileToggle.contains(event.target)) {
            mobileContent.classList.remove('is-open');
            mobileToggle.setAttribute('aria-expanded', 'false');
            mobileToggle.setAttribute('aria-label', 'Open navigation menu');
        }
    });

    // Close with Escape key
    document.addEventListener('keydown', event => {
        if (event.key === 'Escape') {
            userMenu?.removeAttribute('open');
            mobileContent?.classList.remove('is-open');
            mobileToggle?.setAttribute('aria-expanded', 'false');
            mobileToggle?.setAttribute('aria-label', 'Open navigation menu');
        }
    });

    // 5. Date & Time formatting helpers
    document.querySelectorAll('[data-gatherly-date][data-gatherly-time]').forEach(element => {
        element.textContent = `${formatGatherlyDate(element.dataset.gatherlyDate)} · ${formatGatherlyTime(element.dataset.gatherlyTime)}`;
    });

    // 6. Theme Toggle (Sun/Moon with smooth transitions)
    const root = document.documentElement;
    const toggle = document.getElementById('siteThemeToggle');
    const savedTheme = localStorage.getItem('gatherly-theme');
    if (savedTheme === 'light' || savedTheme === 'dark') {
        root.dataset.theme = savedTheme;
    }

    const updateThemeLabel = () => {
        if (!toggle) return;
        const dark = root.dataset.theme === 'dark';
        toggle.setAttribute('aria-label', dark ? 'Switch to light mode' : 'Switch to dark mode');
        toggle.title = dark ? 'Switch to light mode' : 'Switch to dark mode';
    };

    updateThemeLabel();
    toggle?.addEventListener('click', () => {
        root.dataset.theme = root.dataset.theme === 'dark' ? 'light' : 'dark';
        localStorage.setItem('gatherly-theme', root.dataset.theme);
        updateThemeLabel();
    });

    // 7. Global Sign-out Handler
    document.addEventListener('click', async event => {
        const button = event.target.closest('[data-site-signout]');
        if (!button) return;

        button.disabled = true;
        try {
            const response = await fetch(button.dataset.signoutEndpoint || '/api/logout', {method: 'POST'});
            if (!response.ok) throw new Error(`Sign out failed (HTTP ${response.status}).`);
            window.location.assign(button.dataset.signoutDestination || '/');
        } catch (error) {
            button.disabled = false;
            window.alert(error.message || 'Could not sign out. Please try again.');
        }
    });
});
