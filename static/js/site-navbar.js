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

document.addEventListener('DOMContentLoaded', () => {

        // Mobile navigation toggle
        const mobileToggle = document.getElementById('navMobileToggle');
        const mobileContent = document.getElementById('navMobileContent');

        mobileToggle?.addEventListener('click', () => {
            const isOpen = mobileToggle.getAttribute('aria-expanded') === 'true';

            mobileToggle.setAttribute('aria-expanded', String(!isOpen));
            mobileToggle.setAttribute(
                'aria-label',
                isOpen ? 'Open navigation menu' : 'Close navigation menu'
            );

            mobileContent?.classList.toggle('is-open', !isOpen);
        });
        //Notification Badge for My Gatherly
            const navTotalBadge = document.getElementById('navTotalBadge');
            const inviteCount = document.getElementById('invitePendingCount');
            const updateCount = document.getElementById('eventUpdateCount');

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

        // Close the mobile menu after a navigation link is selected.
        mobileContent?.querySelectorAll('a').forEach(link => {
            link.addEventListener('click', () => {
                mobileContent.classList.remove('is-open');
                mobileToggle?.setAttribute('aria-expanded', 'false');
                mobileToggle?.setAttribute('aria-label', 'Open navigation menu');
            });
        });

        // Close the My Gatherly dropdown when clicking outside.
        const accountMenu = document.querySelector('.nav-account-menu');

        document.addEventListener('click', event => {
            if (accountMenu && !accountMenu.contains(event.target)) {
                accountMenu.removeAttribute('open');
            }
        });

        // Close dropdowns with Escape.
        document.addEventListener('keydown', event => {
            if (event.key === 'Escape') {
                accountMenu?.removeAttribute('open');

                mobileContent?.classList.remove('is-open');
                mobileToggle?.setAttribute('aria-expanded', 'false');
                mobileToggle?.setAttribute('aria-label', 'Open navigation menu');
            }
        });
    document.querySelectorAll('[data-gatherly-date][data-gatherly-time]').forEach(element => {
        element.textContent = `${formatGatherlyDate(element.dataset.gatherlyDate)} · ${formatGatherlyTime(element.dataset.gatherlyTime)}`;
    });

    const root = document.documentElement;
    const toggle = document.getElementById('siteThemeToggle');
    const savedTheme = localStorage.getItem('gatherly-theme');
    if (savedTheme === 'light' || savedTheme === 'dark') root.dataset.theme = savedTheme;

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
