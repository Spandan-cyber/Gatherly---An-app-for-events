let editingShowtimeId = null;

document.addEventListener('DOMContentLoaded', () => {
    document.getElementById('showtimeForm').addEventListener('submit', createMovieShowtime);
    document.getElementById('addCinemaTier').addEventListener('click', () => addCinemaTierRow());
    document.getElementById('seatLayoutCsv').addEventListener('input', renderSeatLayoutPreview);
    document.getElementById('seatLayoutFile').addEventListener('change', loadSeatCsvFile);
    document.getElementById('cancelShowtimeEdit').addEventListener('click', cancelShowtimeEdit);
    document.getElementById('cinemaGateForm').addEventListener('submit', createCinemaGate);
    addCinemaTierRow({code: 'STANDARD', name: 'Standard', color: '#6ee7b7', price: 200});
    renderSeatLayoutPreview();
    loadCinemaManagerData();
});

function cinemaNode(tag, className = '', text = '') {
    const element = document.createElement(tag);
    if (className) element.className = className;
    if (text) element.textContent = text;
    return element;
}

function managerNotice(message, isError = false) {
    const notice = document.getElementById('cinemaManagerNotice');
    notice.textContent = message;
    notice.classList.toggle('hidden', !message);
    notice.classList.toggle('error', isError);
    if (message && isError) window.alert(message);
}

async function managerRequest(url, options = {}) {
    const response = await fetch(url, options);
    let result;
    try {
        result = await response.json();
    } catch {
        throw new Error(`The server returned an unexpected response (HTTP ${response.status}).`);
    }
    if (!response.ok || !result.success) throw new Error(result.message || 'Could not complete the request.');
    return result;
}

function addCinemaTierRow(tier = {}) {
    const container = document.getElementById('cinemaTierRows');
    if (container.children.length >= 10) {
        managerNotice('A screening can have at most 10 ticket tiers.', true);
        return;
    }
    const row = cinemaNode('div', 'cinema-tier-row');
    row.append(
        tierInput('Code', 'code', tier.code || '', 'text'),
        tierInput('Tier name', 'name', tier.name || '', 'text'),
        tierInput('Color', 'color', tier.color || '#6ee7b7', 'color'),
        tierInput('Price (₹)', 'price', String(tier.price ?? 0), 'number')
    );
    const remove = cinemaNode('button', 'cinema-remove-tier', '×');
    remove.type = 'button';
    remove.setAttribute('aria-label', 'Remove tier');
    remove.addEventListener('click', () => {
        row.remove();
        renderSeatLayoutPreview();
    });
    row.appendChild(remove);
    row.querySelectorAll('input').forEach(input => input.addEventListener('input', renderSeatLayoutPreview));
    container.appendChild(row);
    renderSeatLayoutPreview();
}

function tierInput(labelText, field, value, type) {
    const label = cinemaNode('label', '', labelText);
    const input = document.createElement('input');
    input.type = type;
    input.dataset.tierField = field;
    input.value = value;
    if (type === 'number') {
        input.min = '0';
        input.step = '1';
    }
    if (type === 'color') input.className = 'cinema-tier-color';
    if (field === 'code') {
        input.maxLength = 12;
        input.autocomplete = 'off';
    }
    if (field === 'name') input.maxLength = 60;
    label.appendChild(input);
    return label;
}

function readCinemaTiers() {
    return [...document.querySelectorAll('.cinema-tier-row')].map(row => {
        const value = field => row.querySelector(`[data-tier-field="${field}"]`).value.trim();
        return {
            code: value('code').toUpperCase(),
            name: value('name'),
            color: value('color'),
            price: Number(value('price'))
        };
    });
}

async function loadSeatCsvFile(event) {
    const file = event.target.files?.[0];
    if (!file) return;
    if (file.size > 200_000) {
        managerNotice('Seat CSV files must be 200 KB or smaller.', true);
        event.target.value = '';
        return;
    }
    document.getElementById('seatLayoutCsv').value = await file.text();
    renderSeatLayoutPreview();
}

function renderSeatLayoutPreview() {
    const preview = document.getElementById('seatLayoutPreview');
    const lines = document.getElementById('seatLayoutCsv').value.trim().split(/\r?\n/);
    const tierColors = new Map(readCinemaTiers().map(tier => [tier.code, tier.color]));
    if (lines.length < 2 || !/^row\s*,\s*seat\s*,\s*tier\s*$/i.test(lines[0])) {
        preview.replaceChildren(cinemaNode('p', 'cinema-help', 'Use CSV columns row,seat,tier to preview this seating mesh.'));
        return;
    }
    const rows = new Map();
    for (const line of lines.slice(1)) {
        const [rowLabel, seatNumber, tierCode] = line.split(',').map(value => value.trim());
        if (!rowLabel || !/^\d+$/.test(seatNumber || '') || !tierCode) continue;
        if (!rows.has(rowLabel.toUpperCase())) rows.set(rowLabel.toUpperCase(), []);
        rows.get(rowLabel.toUpperCase()).push({number: Number(seatNumber), tier: tierCode.toUpperCase()});
    }
    preview.replaceChildren();
    [...rows.keys()].sort((a, b) => a.localeCompare(b, undefined, {numeric: true})).forEach(rowLabel => {
        const row = cinemaNode('div', 'cinema-preview-row');
        row.appendChild(cinemaNode('span', 'movie-row-label', rowLabel));
        rows.get(rowLabel).sort((a, b) => a.number - b.number).forEach(seat => {
            const chip = cinemaNode('span', 'movie-seat cinema-preview-seat', String(seat.number));
            chip.style.setProperty('--seat-color', tierColors.get(seat.tier) || '#888888');
            chip.title = `${rowLabel}${seat.number} · ${seat.tier}`;
            row.appendChild(chip);
        });
        preview.appendChild(row);
    });
}

async function createMovieShowtime(event) {
    event.preventDefault();
    const form = event.currentTarget;
    const tiers = readCinemaTiers();
    if (!tiers.length || tiers.some(tier => !tier.code || !tier.name || !Number.isFinite(tier.price) || tier.price < 0)) {
        managerNotice('Enter a code, name, and non-negative price for every tier.', true);
        return;
    }
    const submit = document.getElementById('createShowtime');
    submit.disabled = true;
    submit.textContent = editingShowtimeId ? 'SAVING…' : 'PUBLISHING…';
    const body = new FormData(form);
    body.set('tiers', JSON.stringify(tiers));
    body.set('seats_csv', document.getElementById('seatLayoutCsv').value);
    try {
        const result = await managerRequest(
            editingShowtimeId ? `/api/cinema/showtimes/${editingShowtimeId}` : '/api/cinema/showtimes',
            {method: editingShowtimeId ? 'PUT' : 'POST', body}
        );
        managerNotice(result.message);
        if (editingShowtimeId) cancelShowtimeEdit();
        await loadCinemaManagerData();
    } catch (error) {
        managerNotice(error.message, true);
    } finally {
        submit.disabled = false;
        submit.textContent = editingShowtimeId ? 'SAVE SCREENING CHANGES' : 'PUBLISH SCREENING';
    }
}

function cinemaMoney(amount) {
    return new Intl.NumberFormat(undefined, {style: 'currency', currency: 'INR', maximumFractionDigits: 0})
        .format(Number(amount) || 0);
}

function cinemaDate(value) {
    return formatGatherlyDateTime(value);
}

async function loadCinemaManagerData() {
    try {
        const [showtimeData, reservationData, analyticsData, gatesData] = await Promise.all([
            managerRequest('/api/cinema/showtimes?manage=1'),
            managerRequest('/api/cinema/manage/reservations'),
            managerRequest('/api/cinema/manage/analytics'),
            managerRequest('/api/cinema/manage/gates')
        ]);
        renderManagerShowtimes(showtimeData.showtimes);
        renderManagerReservations(reservationData.reservations);
        renderCinemaAnalytics(analyticsData.summary);
        renderCinemaGateAccounts(gatesData.accounts);
    } catch (error) {
        managerNotice(error.message, true);
    }
}

async function createCinemaGate(event) {
    event.preventDefault();
    const form = event.currentTarget;
    const submit = form.querySelector('button[type="submit"]');
    submit.disabled = true;
    try {
        const result = await managerRequest('/api/cinema/manage/gates', {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({display_name: form.elements.display_name.value})
        });
        renderCinemaGateCredentials(result);
        form.reset();
        await loadCinemaManagerData();
    } catch (error) {
        managerNotice(error.message, true);
    } finally {
        submit.disabled = false;
    }
}

function renderCinemaGateCredentials(result) {
    const section = document.getElementById('cinemaGateAccounts');
    section.querySelectorAll('.gate-credentials').forEach(panel => panel.remove());
    const panel = cinemaNode('aside', 'gate-credentials');
    panel.setAttribute('aria-live', 'assertive');
    panel.append(
        cinemaNode('h4', '', 'Save these theatre gate credentials now'),
        cinemaNode('p', '', 'This login is valid for all screenings managed by this theatre. The generated password is shown only once.'),
        cinemaNode('span', '', `Scanner: ${window.location.origin}${result.scanner_url}`),
        cinemaNode('span', '', `Username: ${result.credentials.username}`),
        cinemaNode('span', '', `Password: ${result.credentials.password}`)
    );
    const copy = cinemaNode('button', 'btn-primary', 'COPY CREDENTIALS');
    copy.type = 'button';
    copy.addEventListener('click', async () => {
        try {
            await navigator.clipboard.writeText(
                `Scanner: ${window.location.origin}${result.scanner_url}\nUsername: ${result.credentials.username}\nPassword: ${result.credentials.password}`
            );
            managerNotice('Theatre gate credentials copied. Store them securely.');
        } catch {
            managerNotice('Clipboard access is unavailable. Select and copy the credentials manually.', true);
        }
    });
    panel.appendChild(copy);
    section.prepend(panel);
}

function renderCinemaGateAccounts(accounts) {
    const list = document.getElementById('cinemaGateAccounts');
    list.querySelectorAll('.cinema-gate-account').forEach(account => account.remove());
    if (!accounts.length) {
        list.appendChild(cinemaNode('p', 'cinema-help cinema-gate-account', 'No theatre movie gates created yet.'));
        return;
    }
    accounts.forEach(account => {
        const card = cinemaNode('article', 'cinema-reservation-card cinema-gate-account');
        card.append(
            cinemaNode('h3', '', account.display_name),
            cinemaNode('p', '', `${account.username} · ${account.active ? 'Active' : 'Revoked'}`)
        );
        if (account.active) {
            const revoke = cinemaNode('button', 'btn-primary btn-logout', 'REVOKE GATE');
            revoke.type = 'button';
            revoke.addEventListener('click', async () => {
                if (!window.confirm('Immediately revoke this theatre gate login?')) return;
                try {
                    const result = await managerRequest(
                        `/api/cinema/manage/gates/${account.id}/revoke`,
                        {method: 'POST'}
                    );
                    managerNotice(result.message);
                    await loadCinemaManagerData();
                } catch (error) {
                    managerNotice(error.message, true);
                }
            });
            card.appendChild(revoke);
        }
        list.appendChild(card);
    });
}

function renderManagerShowtimes(showtimes) {
    const list = document.getElementById('managerShowtimes');
    list.replaceChildren();
    if (!showtimes.length) {
        list.appendChild(cinemaNode('p', 'cinema-help', 'You have not published a screening yet.'));
        return;
    }
    showtimes.forEach(showtime => {
        const card = cinemaNode('article', 'cinema-showtime-card');
        card.append(
            cinemaNode('h3', '', showtime.film_title),
            cinemaNode('p', '', `${cinemaDate(showtime.starts_at)} · ${showtime.city}`),
            cinemaNode('p', '', `${showtime.theatre_name} · ${showtime.screen_name} · ${showtime.seat_count} seats`),
            cinemaNode('p', '', `${showtime.seats_available} available · ${showtime.pending_reservations} pending reservations`),
            cinemaNode('p', '', `${showtime.confirmed_reservations} confirmed reservations · ${cinemaMoney(showtime.revenue)} confirmed`)
        );
        const edit = cinemaNode('button', 'btn-primary btn-logout', 'EDIT SHOW & SEATS');
        edit.type = 'button';
        edit.addEventListener('click', () => loadShowtimeForEditing(showtime.id));
        card.appendChild(edit);
        list.appendChild(card);
    });
}

function renderCinemaAnalytics(summary) {
    const container = document.getElementById('cinemaAnalytics');
    container.replaceChildren();
    [
        ['Screenings', summary.screenings],
        ['Confirmed reservations', summary.confirmed_reservations],
        ['Pending reservations', summary.pending_reservations],
        ['Confirmed revenue', cinemaMoney(summary.confirmed_revenue)],
        ['Occupied seats', `${summary.occupied_seats} / ${summary.active_seats}`]
    ].forEach(([label, value]) => {
        const metric = cinemaNode('div', 'cinema-analytics-metric');
        metric.append(cinemaNode('span', '', label), cinemaNode('strong', '', String(value)));
        container.appendChild(metric);
    });
    container.appendChild(cinemaNode(
        'p',
        'cinema-help cinema-analytics-note',
        'Revenue includes completed manual confirmations only. Gatherly does not process online movie payments.'
    ));
}

async function loadShowtimeForEditing(showtimeId) {
    try {
        const result = await managerRequest(`/api/cinema/showtimes/${showtimeId}`);
        const {showtime, tiers, seats} = result;
        const form = document.getElementById('showtimeForm');
        editingShowtimeId = showtimeId;
        form.elements.film_title.value = showtime.film_title;
        form.elements.language.value = showtime.language;
        form.elements.duration_minutes.value = showtime.duration_minutes;
        form.elements.starts_at.value = showtime.starts_at.replace(' ', 'T').slice(0, 16);
        form.elements.theatre_name.value = showtime.theatre_name;
        form.elements.screen_name.value = showtime.screen_name;
        form.elements.city.value = showtime.city;
        form.elements.synopsis.value = showtime.synopsis;
        form.elements.poster.value = '';
        document.getElementById('cinemaTierRows').replaceChildren();
        tiers.forEach(tier => addCinemaTierRow(tier));
        document.getElementById('seatLayoutCsv').value = [
            'row,seat,tier',
            ...seats.map(seat => `${seat.row_label},${seat.seat_number},${seat.tier_code}`)
        ].join('\n');
        renderSeatLayoutPreview();
        document.querySelector('#showtimeForm > h2').textContent = 'Edit screening';
        document.getElementById('createShowtime').textContent = 'SAVE SCREENING CHANGES';
        document.getElementById('cancelShowtimeEdit').classList.remove('hidden');
        form.scrollIntoView({behavior: 'smooth', block: 'start'});
        managerNotice(`Editing ${showtime.film_title}. Seats with confirmed reservations cannot be removed or moved to another tier.`);
    } catch (error) {
        managerNotice(error.message, true);
    }
}

function cancelShowtimeEdit() {
    editingShowtimeId = null;
    const form = document.getElementById('showtimeForm');
    form.reset();
    document.getElementById('cinemaTierRows').replaceChildren();
    addCinemaTierRow({code: 'STANDARD', name: 'Standard', color: '#6ee7b7', price: 200});
    document.getElementById('seatLayoutCsv').value = 'row,seat,tier\nA,1,STANDARD\nA,2,STANDARD\nA,3,STANDARD\nB,1,STANDARD\nB,2,STANDARD\nB,3,STANDARD';
    document.getElementById('createShowtime').textContent = 'PUBLISH SCREENING';
    document.getElementById('cancelShowtimeEdit').classList.add('hidden');
    document.querySelector('#showtimeForm > h2').textContent = 'Create a screening';
    renderSeatLayoutPreview();
}

function renderManagerReservations(reservations) {
    const list = document.getElementById('managerReservations');
    list.replaceChildren();
    const pending = reservations.filter(item => item.status === 'PENDING');
    if (!pending.length) {
        list.appendChild(cinemaNode('p', 'cinema-help', 'No pending reservations.'));
        return;
    }
    pending.forEach(reservation => {
        const card = cinemaNode('article', 'cinema-reservation-card');
        card.append(
            cinemaNode('h3', '', reservation.film_title),
            cinemaNode('p', '', `${reservation.full_name} · ${reservation.seats}`),
            cinemaNode('p', '', `${cinemaDate(reservation.starts_at)} · ${cinemaMoney(reservation.total_amount)}`)
        );
        const confirm = cinemaNode('button', 'btn-primary', 'CONFIRM PAYMENT & ISSUE TICKET');
        confirm.type = 'button';
        confirm.addEventListener('click', async () => {
            if (!window.confirm(`Confirm payment for ${reservation.full_name} and issue the selected-seat ticket?`)) return;
            confirm.disabled = true;
            try {
                const result = await managerRequest(`/api/cinema/manage/reservations/${reservation.id}/confirm`, {method: 'POST'});
                managerNotice(result.message, !result.email_sent);
                await loadCinemaManagerData();
            } catch (error) {
                managerNotice(error.message, true);
                confirm.disabled = false;
            }
        });
        card.appendChild(confirm);
        const cancel = cinemaNode('button', 'btn-primary btn-logout', 'CANCEL & RELEASE SEATS');
        cancel.type = 'button';
        cancel.addEventListener('click', async () => {
            if (!window.confirm('Cancel this pending reservation and release its seats?')) return;
            try {
                const result = await managerRequest(`/api/cinema/reservations/${reservation.id}/cancel`, {method: 'POST'});
                managerNotice(result.message);
                await loadCinemaManagerData();
            } catch (error) {
                managerNotice(error.message, true);
            }
        });
        card.appendChild(cancel);
        list.appendChild(card);
    });
}
