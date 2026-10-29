document.addEventListener('DOMContentLoaded', () => {
    document.getElementById('provisionAccountForm').addEventListener('submit', provisionPartner);
    document.getElementById('provisionAccountForm').elements.account_type.addEventListener('change', updateEmailPlaceholder);
    loadAdminData();
});

async function adminRequest(url, options = {}) {
    const response = await fetch(url, options);
    let result;
    try {
        result = await response.json();
    } catch {
        throw new Error(`Unexpected server response (HTTP ${response.status}).`);
    }
    if (!response.ok || !result.success) throw new Error(result.message || 'Request failed.');
    return result;
}

function adminNotice(message, error = false) {
    const notice = document.getElementById('superAdminNotice');
    notice.textContent = message;
    notice.classList.toggle('hidden', !message);
    notice.classList.toggle('error', error);
    if (message && error) window.alert(message);
}

function updateEmailPlaceholder(event) {
    const email = document.getElementById('provisionAccountForm').elements.email;
    email.placeholder = event.target.value === 'THEATRE'
        ? 'theatre@gatherly.theatre or cinema@gatherly.movies'
        : 'organizer@gatherly.organizer';
}

async function provisionPartner(event) {
    event.preventDefault();
    const form = event.currentTarget;
    const submit = form.querySelector('[type="submit"]');
    submit.disabled = true;
    try {
        const payload = Object.fromEntries(new FormData(form).entries());
        const result = await adminRequest('/api/super-admin/accounts', {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify(payload)
        });
        adminNotice(result.message);
        form.reset();
        updateEmailPlaceholder({target: form.elements.account_type});
        await loadAdminData();
    } catch (error) {
        adminNotice(error.message, true);
    } finally {
        submit.disabled = false;
    }
}

async function loadAdminData() {
    try {
        const [data, movieData] = await Promise.all([
            adminRequest('/api/super-admin/accounts'),
            adminRequest('/api/super-admin/movie-analytics')
        ]);
        renderVerificationRequests(data.requests);
        renderVerifiedAccounts(data.accounts);
        renderMovieAnalytics(movieData);
    } catch (error) {
        adminNotice(error.message, true);
    }
}

function renderMovieAnalytics(data) {
    const summary = document.getElementById('movieAdminSummary');
    summary.replaceChildren();
    [
        ['Verified theatres', data.theatres.length],
        ['Screenings', data.summary.screenings],
        ['Upcoming screenings', data.summary.upcoming_screenings],
        ['Confirmed reservations', data.summary.confirmed_reservations],
        ['Pending reservations', data.summary.pending_reservations],
        ['Confirmed revenue', new Intl.NumberFormat(undefined, {style: 'currency', currency: 'INR', maximumFractionDigits: 0}).format(Number(data.summary.confirmed_revenue) || 0)]
    ].forEach(([label, value]) => {
        const metric = adminText('div', 'cinema-analytics-metric');
        metric.append(adminText('span', '', label), adminText('strong', '', String(value)));
        summary.appendChild(metric);
    });
    const theatres = document.getElementById('movieTheatreAnalytics');
    theatres.replaceChildren();
    if (!data.theatres.length) {
        theatres.appendChild(adminText('p', 'cinema-help', 'No verified theatre accounts yet.'));
        return;
    }
    data.theatres.forEach(theatre => {
        const card = adminText('article', 'cinema-showtime-card');
        const revenue = new Intl.NumberFormat(undefined, {style: 'currency', currency: 'INR', maximumFractionDigits: 0})
            .format(Number(theatre.confirmed_revenue) || 0);
        card.append(
            adminText('h3', '', theatre.organization_name || 'Verified theatre'),
            adminText('p', '', `${theatre.screenings} screenings · ${theatre.confirmed_reservations} confirmed reservations · ${theatre.pending_reservations} pending`),
            adminText('p', '', `${revenue} confirmed manually`)
        );
        theatres.appendChild(card);
    });
}

function renderVerificationRequests(requests) {
    const list = document.getElementById('verificationRequests');
    list.replaceChildren();
    if (!requests.length) {
        list.appendChild(adminText('p', 'cinema-help', 'No pending requests.'));
        return;
    }
    requests.forEach(request => {
        const card = adminText('article', 'cinema-reservation-card');
        card.append(
            adminText('h3', '', `${request.organization_name} · ${request.requested_type}`),
            adminText('p', '', `${request.full_name} · ${request.email} · ${request.created_at}`)
        );
        [['approve', 'APPROVE'], ['reject', 'REJECT']].forEach(([decision, label]) => {
            const button = adminText('button', 'btn-primary', label);
            button.type = 'button';
            button.addEventListener('click', () => reviewRequest(request.id, decision));
            card.appendChild(button);
        });
        list.appendChild(card);
    });
}

async function reviewRequest(id, decision) {
    try {
        const result = await adminRequest(`/api/super-admin/verification-requests/${id}`, {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({decision})
        });
        adminNotice(result.message);
        await loadAdminData();
    } catch (error) {
        adminNotice(error.message, true);
    }
}

function renderVerifiedAccounts(accounts) {
    const list = document.getElementById('verifiedAccounts');
    list.replaceChildren();
    if (!accounts.length) {
        list.appendChild(adminText('p', 'cinema-help', 'No organization accounts provisioned yet.'));
        return;
    }
    accounts.forEach(account => {
        const card = adminText('article', 'cinema-showtime-card');
        card.append(
            adminText('h3', '', `${account.organization_name || account.full_name} · Verified ${account.account_type}`),
            adminText('p', '', `${account.full_name} · ${account.email}`),
            adminText('p', '', `Account ${account.id} · ${account.is_verified ? 'Active' : 'Disabled'}`)
        );
        list.appendChild(card);
    });
}

function adminText(tag, className = '', text = '') {
    const element = document.createElement(tag);
    if (className) element.className = className;
    if (text) element.textContent = text;
    return element;
}
