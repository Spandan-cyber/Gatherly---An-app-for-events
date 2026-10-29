let accountActivity = {};

document.addEventListener('DOMContentLoaded', () => {
    document.getElementById('accountProfileForm').addEventListener('submit', saveAccountProfile);
    document.getElementById('organizationVerificationForm').addEventListener('submit', requestOrganizationVerification);
    document.getElementById('accountPasswordRequest').addEventListener('click', requestAccountPasswordCode);
    document.getElementById('accountPasswordForm').addEventListener('submit', updateAccountPassword);
    document.getElementById('accountDeleteRequest').addEventListener('click', requestAccountDeletion);
    document.getElementById('accountDeleteForm').addEventListener('submit', confirmAccountDeletion);
    document.querySelectorAll('[data-activity-tab]').forEach(button => {
        button.addEventListener('click', () => selectActivityTab(button.dataset.activityTab));
    });
    loadAccountPage();
});

function accountNode(tag, className = '', text = '') {
    const item = document.createElement(tag);
    if (className) item.className = className;
    if (text) item.textContent = text;
    return item;
}

function accountNotice(message, isError = false) {
    const notice = document.getElementById('accountNotice');
    notice.textContent = message;
    notice.classList.toggle('hidden', !message);
    notice.classList.toggle('error', isError);
    if (message && isError) window.alert(message);
}

async function accountRequest(url, options = {}) {
    const response = await fetch(url, options);
    const data = await response.json();
    if (response.status === 401) {
        window.location.assign('/?auth=login&next=%2Faccount');
        throw new Error('Sign in to continue.');
    }
    if (!response.ok || !data.success) throw new Error(data.message || 'The request could not be completed.');
    return data;
}

async function loadAccountPage() {
    try {
        const [accountData, activityData] = await Promise.all([
            accountRequest('/api/account'),
            accountRequest('/api/account/activity')
        ]);
        document.getElementById('accountName').value = accountData.account.full_name || '';
        document.getElementById('accountEmail').value = accountData.account.email || '';
        document.getElementById('accountCity').value = accountData.account.city || '';
        const roleStatus = document.getElementById('accountRoleStatus');
        roleStatus.textContent = accountData.account.account_type === 'THEATRE'
            ? `${accountData.account.organization_name || 'Theatre'} · Verified theatre`
            : accountData.account.account_type === 'ORGANIZER'
                ? `${accountData.account.organization_name || 'Organizer'} · Verified event organizer`
                : accountData.account.account_type === 'ADMIN'
                    ? 'Gatherly super administrator'
                    : 'Standard Gatherly account · no organization badge';
        document.getElementById('organizationVerificationForm').classList.toggle(
            'hidden', accountData.account.account_type !== 'USER'
        );
        document.getElementById('organizationName').value = accountData.account.organization_name || '';
        const navName = document.querySelector('.welcome-user strong');
        if (navName) navName.textContent = accountData.account.full_name || '';
        accountActivity = activityData.activity;
        renderAccountActivity('bookings');
    } catch (error) {
        accountNotice(error.message, true);
    }
}

async function requestOrganizationVerification(event) {
    event.preventDefault();
    const submit = event.currentTarget.querySelector('button[type="submit"]');
    submit.disabled = true;
    try {
        const result = await accountRequest('/api/account/verification-request', {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({
                account_type: document.getElementById('organizationAccountType').value,
                organization_name: document.getElementById('organizationName').value
            })
        });
        accountNotice(result.message);
    } catch (error) {
        accountNotice(error.message, true);
    } finally {
        submit.disabled = false;
    }
}

async function saveAccountProfile(event) {
    event.preventDefault();
    const submit = event.currentTarget.querySelector('button[type="submit"]');
    submit.disabled = true;
    try {
        const data = await accountRequest('/api/account', {
            method: 'PATCH',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({
                full_name: document.getElementById('accountName').value,
                city: document.getElementById('accountCity').value
            })
        });
        const navName = document.querySelector('.welcome-user strong');
        if (navName) navName.textContent = data.account.full_name;
        accountNotice(data.message);
    } catch (error) {
        accountNotice(error.message, true);
    } finally {
        submit.disabled = false;
    }
}

function selectActivityTab(key) {
    document.querySelectorAll('[data-activity-tab]').forEach(button => {
        const active = button.dataset.activityTab === key;
        button.classList.toggle('active', active);
        button.setAttribute('aria-selected', String(active));
    });
    renderAccountActivity(key);
}

function renderAccountActivity(key) {
    const list = document.getElementById('accountActivity');
    list.replaceChildren();
    const entries = accountActivity[key] || [];
    if (!entries.length) {
        const messages = {
            bookings: 'Your bookings and passes will appear here.',
            movie_passes: 'Your movie reservations and movie-only passes will appear here.',
            hosted_events: 'Events you create will appear here.',
            invitations: 'Invitations you receive will appear here.',
            waitlist: 'Your ticket waitlist activity will appear here.'
        };
        list.appendChild(accountNode('p', 'empty-state', messages[key]));
        return;
    }
    entries.forEach(item => {
        const card = accountNode('article', 'account-activity-card');
        const title = item.title || item.film_title || 'Gatherly event';
        card.appendChild(accountNode('h3', '', title));
        let detail = '';
        let status = '';
        if (key === 'bookings') {
            detail = `${formatGatherlyDate(item.event_date)} · ${formatGatherlyTime(item.event_time)} · ${item.venue} · ${item.quantity} ticket(s)${item.tier_name ? ` · ${item.tier_name}` : ''}`;
            status = `${item.event_cancelled_at ? 'EVENT CANCELLED · ' : ''}${item.status} · ${item.payment_status} · ${item.admitted_count}/${item.quantity} admitted`;
        } else if (key === 'movie_passes') {
            detail = `${formatGatherlyDateTime(item.starts_at)} · ${item.theatre_name} · ${item.screen_name} · Seats ${item.seats} · ${new Intl.NumberFormat('en-IN', {style: 'currency', currency: 'INR', maximumFractionDigits: 0}).format(Number(item.total_amount) || 0)}`;
            status = `${item.status} · ${item.payment_status}`;
        } else if (key === 'hosted_events') {
            detail = `${formatGatherlyDate(item.event_date)} · ${item.city} · Created ${formatActivityDate(item.created_at)}`;
            status = `${item.visibility} event`;
        } else if (key === 'invitations') {
            detail = `${formatGatherlyDate(item.event_date)} · ${item.role === 'MANAGER' ? 'Management invite' : 'Guest invitation'} · ${formatActivityDate(item.created_at)}`;
            status = item.status;
        } else {
            detail = `${item.quantity} ticket(s)${item.tier_name ? ` · ${item.tier_name}` : ''} · ${formatActivityDate(item.created_at)}`;
            status = item.status;
        }
        card.append(
            accountNode('p', 'account-muted', detail),
            accountNode('span', 'account-activity-status', status)
        );
        if (key === 'bookings' || key === 'hosted_events') {
            const link = accountNode('a', 'account-activity-link', key === 'bookings' ? 'VIEW EVENT' : 'MANAGE EVENT');
            link.href = key === 'bookings' ? `/events/${item.event_public_id}` : '/host/dashboard';
            card.appendChild(link);
        }
        if (key === 'movie_passes') {
            const link = accountNode('a', 'account-activity-link', item.status === 'CONFIRMED' ? 'VIEW MOVIE PASS' : 'VIEW MOVIE RESERVATION');
            link.href = '/movies/tickets';
            card.appendChild(link);
        }
        list.appendChild(card);
    });
}

function formatActivityDate(value) {
    if (!value) return '';
    const parsed = new Date(value.replace(' ', 'T'));
    return Number.isNaN(parsed.getTime()) ? value : parsed.toLocaleDateString('en-IN', {day: 'numeric', month: 'long', year: 'numeric'});
}

async function requestAccountPasswordCode() {
    const button = document.getElementById('accountPasswordRequest');
    button.disabled = true;
    try {
        const data = await accountRequest('/api/request-password-reset', {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({email: document.getElementById('accountEmail').value})
        });
        document.getElementById('accountPasswordFields').classList.remove('hidden');
        accountNotice(data.message);
    } catch (error) {
        accountNotice(error.message, true);
    } finally {
        button.disabled = false;
    }
}

async function updateAccountPassword(event) {
    event.preventDefault();
    const password = document.getElementById('accountNewPassword').value;
    if (password.length < 8) {
        accountNotice('Use a password with at least 8 characters.', true);
        return;
    }
    try {
        const data = await accountRequest('/api/reset-password', {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({
                email: document.getElementById('accountEmail').value,
                otp: document.getElementById('accountPasswordOtp').value,
                new_password: password
            })
        });
        document.getElementById('accountPasswordForm').reset();
        document.getElementById('accountPasswordFields').classList.add('hidden');
        accountNotice(data.message);
    } catch (error) {
        accountNotice(error.message, true);
    }
}

async function requestAccountDeletion() {
    const button = document.getElementById('accountDeleteRequest');
    button.disabled = true;
    try {
        const data = await accountRequest('/api/account/delete/request', {method: 'POST'});
        document.getElementById('accountDeleteForm').classList.remove('hidden');
        accountNotice(data.message);
    } catch (error) {
        accountNotice(error.message, true);
    } finally {
        button.disabled = false;
    }
}

async function confirmAccountDeletion(event) {
    event.preventDefault();
    if (!window.confirm('Delete your Gatherly account and remove its personal profile details? This cannot be undone.')) return;
    const submit = event.currentTarget.querySelector('button[type="submit"]');
    submit.disabled = true;
    try {
        const data = await accountRequest('/api/account/delete/confirm', {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({otp: document.getElementById('accountDeleteOtp').value})
        });
        accountNotice(data.message);
        window.setTimeout(() => window.location.assign('/'), 900);
    } catch (error) {
        accountNotice(error.message, true);
        submit.disabled = false;
    }
}
