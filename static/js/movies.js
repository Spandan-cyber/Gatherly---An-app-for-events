let activeShowtime = null;
let activeSeats = [];
let selectedMovieSeats = new Set();
let favouriteMovies = new Set();
let waitlistedMovies = new Set();

document.addEventListener('DOMContentLoaded', () => {
    if (document.getElementById('movieShowtimes')) loadMovieShowtimes();
    if (document.body.dataset.openTickets === 'true') loadMovieTicketsPage();
    document.getElementById('movieTicketsButton')?.addEventListener('click', event => {
        if (document.body.dataset.isSignedIn === 'true') return;
        event.preventDefault();
        window.location.assign('/?auth=login&next=%2Fmovies%2Ftickets');
    });
    document.getElementById('closeSeatPicker')?.addEventListener('click', closeSeatPicker);
    document.getElementById('closeMovieTickets')?.addEventListener('click', closeMovieTickets);
    document.getElementById('seatPicker')?.addEventListener('click', event => {
        if (event.target === event.currentTarget) closeSeatPicker();
    });
    document.getElementById('movieTickets')?.addEventListener('click', event => {
        if (event.target === event.currentTarget) closeMovieTickets();
    });
    document.addEventListener('keydown', event => {
        if (event.key === 'Escape') {
            closeSeatPicker();
            closeMovieTickets();
        }
    });
});

function movieElement(tag, className = '', text = '') {
    const element = document.createElement(tag);
    if (className) element.className = className;
    if (text) element.textContent = text;
    return element;
}

async function movieRequest(url, options = {}) {
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

function showMovieNotice(message, isError = false) {
    const notice = document.getElementById('moviesNotice');
    notice.textContent = message;
    notice.classList.toggle('hidden', !message);
    notice.classList.toggle('error', isError);
    if (message && isError) window.alert(message);
}

function movieDate(value) {
    return formatGatherlyDateTime(value);
}

async function loadMovieShowtimes() {
    const grid = document.getElementById('movieShowtimes');
    grid.replaceChildren(movieElement('p', 'empty-state', 'Finding screenings…'));
    try {
        const [data, actions] = await Promise.all([
            movieRequest('/api/cinema/showtimes'),
            document.body.dataset.isSignedIn === 'true'
                ? movieRequest('/api/cinema/movie-actions').catch(() => ({favourites: [], waitlist: []}))
                : Promise.resolve({favourites: [], waitlist: []})
        ]);
        favouriteMovies = new Set(actions.favourites.map(title => title.toLocaleLowerCase()));
        waitlistedMovies = new Set(actions.waitlist.map(item => item.film_title.toLocaleLowerCase()));
        grid.replaceChildren();
        if (!data.showtimes.length) {
            grid.appendChild(movieElement('p', 'empty-state', 'No movie screenings are listed yet. Check back soon.'));
            return;
        }
        data.showtimes.forEach((showtime, index) => {
            const card = movieElement('article', 'movie-card');
            card.style.animationDelay = `${Math.min(index * 35, 300)}ms`;
            if (showtime.poster_url) {
                const poster = movieElement('img', 'movie-poster');
                poster.src = showtime.poster_url;
                poster.alt = `${showtime.film_title} poster`;
                poster.loading = 'lazy';
                card.appendChild(poster);
            } else {
                const poster = movieElement('div', 'movie-poster movie-poster-placeholder', 'G');
                poster.setAttribute('aria-hidden', 'true');
                card.appendChild(poster);
            }
            const copy = movieElement('div', 'movie-card-copy');
            copy.append(
                movieElement('span', 'section-kicker', showtime.language || 'MOVIE SCREENING'),
                movieElement('h3', '', showtime.film_title),
                movieElement('p', 'movie-card-meta', `${movieDate(showtime.starts_at)} · ${showtime.duration_minutes} min`),
                movieElement('p', 'movie-card-meta', `${showtime.theatre_display_name} · ${showtime.screen_name} · ${showtime.city}`),
                movieElement('p', 'movie-card-meta', `${showtime.seats_available} seats · From ${movieMoney(showtime.minimum_price)}`)
            );
            if (showtime.verified_theatre) {
                copy.appendChild(movieElement('span', 'verified-badge', '✓ Verified theatre'));
            }
            if (showtime.average_rating) {
                copy.appendChild(movieElement(
                    'p', 'movie-card-meta',
                    `★ ${Number(showtime.average_rating).toFixed(1)} · ${showtime.rating_count} rating${showtime.rating_count === 1 ? '' : 's'}`
                ));
            }
            const listActions = movieElement('div', 'movie-list-actions');
            const titleKey = showtime.film_title.toLocaleLowerCase();
            const favourite = movieElement(
                'button', 'btn-primary btn-logout',
                favouriteMovies.has(titleKey) ? '♥ FAVOURITED' : '♡ FAVOURITE'
            );
            favourite.type = 'button';
            favourite.setAttribute('aria-pressed', String(favouriteMovies.has(titleKey)));
            favourite.addEventListener('click', () => updateMovieList(showtime, 'favourite'));
            const waitlist = movieElement(
                'button', 'btn-primary btn-logout',
                waitlistedMovies.has(titleKey) ? 'ON WISHLIST' : 'ADD TO WISHLIST'
            );
            waitlist.type = 'button';
            waitlist.setAttribute('aria-pressed', String(waitlistedMovies.has(titleKey)));
            waitlist.addEventListener('click', () => updateMovieList(showtime, 'waitlist'));
            listActions.append(favourite, waitlist);
            copy.appendChild(listActions);
            const choose = movieElement('button', 'btn-primary', 'CHOOSE SEATS');
            choose.type = 'button';
            choose.addEventListener('click', () => openSeatPicker(showtime.id));
            copy.appendChild(choose);
            card.appendChild(copy);
            grid.appendChild(card);
        });
    } catch (error) {
        grid.replaceChildren(movieElement('p', 'empty-state', error.message));
    }
}

async function updateMovieList(showtime, action) {
    if (document.body.dataset.isSignedIn !== 'true') {
        window.location.assign('/?auth=login&next=%2Fmovies');
        return;
    }
    const titleKey = showtime.film_title.toLocaleLowerCase();
    const list = action === 'favourite' ? favouriteMovies : waitlistedMovies;
    try {
        await movieRequest('/api/cinema/movie-actions', {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({
                action,
                film_title: showtime.film_title,
                city: showtime.city,
                enabled: !list.has(titleKey)
            })
        });
        await loadMovieShowtimes();
    } catch (error) {
        showMovieNotice(error.message, true);
    }
}

function movieMoney(amount) {
    return new Intl.NumberFormat(undefined, {style: 'currency', currency: 'INR', maximumFractionDigits: 0})
        .format(Number(amount) || 0);
}

async function openSeatPicker(showtimeId) {
    if (document.body.dataset.isSignedIn !== 'true') {
        window.location.assign('/?auth=login&next=%2Fmovies');
        return;
    }
    const overlay = document.getElementById('seatPicker');
    const content = document.getElementById('seatPickerContent');
    overlay.classList.remove('hidden');
    overlay.setAttribute('aria-hidden', 'false');
    content.replaceChildren(movieElement('p', 'empty-state', 'Loading the seat map…'));
    selectedMovieSeats = new Set();
    try {
        const data = await movieRequest(`/api/cinema/showtimes/${showtimeId}`);
        activeShowtime = data.showtime;
        activeSeats = data.seats;
        renderSeatPicker(data);
    } catch (error) {
        content.replaceChildren(movieElement('p', 'empty-state', error.message));
    }
}

function closeSeatPicker() {
    const overlay = document.getElementById('seatPicker');
    if (!overlay) return;
    overlay.classList.add('hidden');
    overlay.setAttribute('aria-hidden', 'true');
    activeShowtime = null;
}

function closeMovieTickets() {
    const overlay = document.getElementById('movieTickets');
    if (!overlay) return;
    overlay.classList.add('hidden');
    overlay.setAttribute('aria-hidden', 'true');
}

function renderSeatPicker(data) {
    const content = document.getElementById('seatPickerContent');
    content.replaceChildren();
    const heading = movieElement('div', 'movie-detail-heading');
    if (data.showtime.poster_url) {
        const poster = movieElement('img', 'movie-detail-poster');
        poster.src = data.showtime.poster_url;
        poster.alt = '';
        heading.appendChild(poster);
    }
    const copy = movieElement('div');
    copy.append(
        movieElement('span', 'section-kicker', `${data.showtime.language || 'MOVIE'} · ${data.showtime.duration_minutes} MIN`),
        movieElement('h2', '', data.showtime.film_title),
        movieElement('p', '', `${movieDate(data.showtime.starts_at)} · ${data.showtime.theatre_name} · ${data.showtime.screen_name}`)
    );
    heading.appendChild(copy);
    content.appendChild(heading);
    if (data.showtime.synopsis) content.appendChild(movieElement('p', 'movie-seat-help', data.showtime.synopsis));
    const screen = movieElement('div', 'cinema-screen', 'SCREEN');
    screen.setAttribute('aria-hidden', 'true');
    content.appendChild(screen);

    const seatMap = movieElement('div', 'movie-seat-map');
    seatMap.setAttribute('role', 'group');
    seatMap.setAttribute('aria-label', 'Select available seats');
    const grouped = new Map();
    data.seats.forEach(seat => {
        if (!grouped.has(seat.row_label)) grouped.set(seat.row_label, []);
        grouped.get(seat.row_label).push(seat);
    });
    [...grouped.keys()].sort((a, b) => a.localeCompare(b, undefined, {numeric: true})).forEach(rowLabel => {
        const row = movieElement('div', 'movie-seat-row');
        row.appendChild(movieElement('span', 'movie-row-label', rowLabel));
        grouped.get(rowLabel).sort((a, b) => a.seat_number - b.seat_number).forEach(seat => {
            const button = movieElement('button', 'movie-seat', String(seat.seat_number));
            button.type = 'button';
            button.dataset.seatId = String(seat.id);
            button.style.setProperty('--seat-color', seat.tier_color);
            button.setAttribute('aria-pressed', String(selectedMovieSeats.has(seat.id)));
            button.setAttribute('aria-label', `Row ${rowLabel}, seat ${seat.seat_number}, ${seat.tier_name}, ${movieMoney(seat.price)}${seat.is_reserved ? ', unavailable' : ', available'}`);
            button.title = `${seat.tier_name} · ${movieMoney(seat.price)}`;
            button.disabled = Boolean(seat.is_reserved);
            if (!seat.is_reserved) {
                button.addEventListener('click', () => {
                    if (selectedMovieSeats.has(seat.id)) selectedMovieSeats.delete(seat.id);
                    else if (selectedMovieSeats.size < 10) selectedMovieSeats.add(seat.id);
                    else showMovieNotice('Choose up to 10 seats in one reservation.', true);
                    renderSeatPicker(data);
                    document.querySelector(`[data-seat-id="${seat.id}"]`)?.focus();
                });
            }
            if (selectedMovieSeats.has(seat.id)) button.classList.add('selected');
            row.appendChild(button);
        });
        row.appendChild(movieElement('span', 'movie-row-label', rowLabel));
        seatMap.appendChild(row);
    });
    content.appendChild(seatMap);

    const legend = movieElement('div', 'movie-seat-legend');
    data.tiers.forEach(tier => {
        const item = movieElement('span', 'movie-tier-legend');
        const swatch = movieElement('span', 'movie-tier-swatch');
        swatch.style.backgroundColor = tier.color;
        item.append(swatch, document.createTextNode(`${tier.name} · ${movieMoney(tier.price)}`));
        legend.appendChild(item);
    });
    const unavailable = movieElement('span', 'movie-tier-legend');
    const soldSwatch = movieElement('span', 'movie-tier-swatch');
    soldSwatch.style.backgroundColor = 'rgba(255,255,255,.25)';
    unavailable.append(soldSwatch, document.createTextNode('Unavailable'));
    legend.appendChild(unavailable);
    content.appendChild(legend);

    const footer = movieElement('div', 'movie-selection-bar');
    const selected = activeSeats.filter(seat => selectedMovieSeats.has(seat.id));
    const total = selected.reduce((sum, seat) => sum + Number(seat.price), 0);
    const summary = movieElement('div', 'movie-selection-total', movieMoney(total));
    summary.appendChild(movieElement('small', '', `${selected.length} seat${selected.length === 1 ? '' : 's'} selected${selected.length ? ` · ${selected.map(seat => `${seat.row_label}${seat.seat_number}`).join(', ')}` : ''}`));
    const reserve = movieElement('button', 'btn-primary', selected.some(seat => Number(seat.price) > 0) ? 'REQUEST RESERVATION' : 'CONFIRM SEATS');
    reserve.type = 'button';
    reserve.disabled = selected.length === 0;
    reserve.addEventListener('click', () => reserveMovieSeats(selected));
    footer.append(summary, reserve);
    content.appendChild(footer);
    if (selected.some(seat => Number(seat.price) > 0)) {
        content.appendChild(movieElement(
            'p',
            'cinema-payment-note',
            'Paid reservations use the theatre’s manual payment flow. Contact the theatre for payment instructions; your ticket is issued after the manager confirms receipt.'
        ));
    }
}

async function reserveMovieSeats(seats) {
    if (!activeShowtime || !seats.length) return;
    const button = document.querySelector('.movie-selection-bar .btn-primary');
    button.disabled = true;
    button.textContent = 'RESERVING…';
    try {
        const result = await movieRequest(`/api/cinema/showtimes/${activeShowtime.id}/reservations`, {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({seat_ids: seats.map(seat => seat.id)})
        });
        closeSeatPicker();
        showMovieConfirmation(result);
        loadMovieShowtimes();
    } catch (error) {
        showMovieNotice(error.message, true);
        button.disabled = false;
        button.textContent = 'TRY AGAIN';
    }
}

function showMovieConfirmation(result) {
    const overlay = document.getElementById('seatPicker');
    const content = document.getElementById('seatPickerContent');
    overlay.classList.remove('hidden');
    overlay.setAttribute('aria-hidden', 'false');
    content.replaceChildren();
    const confirmation = movieElement('div', 'movie-ticket-confirmation');
    confirmation.append(
        movieElement('span', 'section-kicker', result.status === 'CONFIRMED' ? 'SEATS CONFIRMED' : 'RESERVATION RECEIVED'),
        movieElement('h2', '', result.status === 'CONFIRMED' ? 'You’re all set.' : 'Payment needs confirmation.'),
        movieElement('p', 'movie-seat-help', result.message),
        movieElement('p', 'movie-selection-total', movieMoney(result.total_amount))
    );
    if (result.qr_url) {
        const qr = movieElement('img');
        qr.src = result.qr_url;
        qr.alt = 'Movie ticket QR code';
        qr.width = 190;
        qr.height = 190;
        confirmation.append(qr, movieElement('p', 'movie-seat-help', 'Show this QR at the theatre for entry.'));
    } else {
        confirmation.appendChild(movieElement('p', 'movie-seat-help', 'The selected seats are held while the theatre reviews your payment. Your QR ticket appears in My Movie Tickets after confirmation.'));
    }
    if (result.email_sent === false) {
        confirmation.appendChild(movieElement(
            'p',
            'movie-notice error',
            'Your confirmed ticket is saved in Movie Tickets, but the email could not be delivered. Download the QR from your account.'
        ));
    }
    const close = movieElement('button', 'btn-primary', 'DONE');
    close.type = 'button';
    close.addEventListener('click', closeSeatPicker);
    confirmation.appendChild(close);
    content.appendChild(confirmation);
}

async function openMovieTickets() {
    if (document.body.dataset.isSignedIn !== 'true') {
        window.location.assign('/?auth=login&next=%2Fmovies%2Ftickets');
        return;
    }
    const overlay = document.getElementById('movieTickets');
    const list = document.getElementById('movieReservationList');
    if (!overlay || !list) return;
    overlay.classList.remove('hidden');
    overlay.setAttribute('aria-hidden', 'false');
    await renderMovieTickets(list);
}

async function loadMovieTicketsPage() {
    const list = document.getElementById('movieTicketPageList');
    if (!list) return;
    if (document.body.dataset.isSignedIn !== 'true') {
        window.location.replace('/?auth=login&next=%2Fmovies%2Ftickets');
        return;
    }
    await renderMovieTickets(list);
}

async function renderMovieTickets(list) {
    list.replaceChildren(movieElement('p', 'empty-state', 'Loading your movie tickets…'));
    try {
        const data = await movieRequest('/api/cinema/my-reservations');
        list.replaceChildren();
        if (!data.reservations.length) {
            list.appendChild(movieElement('p', 'empty-state', 'No movie tickets yet.'));
            return;
        }
        data.reservations.forEach(reservation => {
            const card = movieElement('article', 'movie-reservation-card');
            card.append(
                movieElement('h3', '', reservation.film_title),
                movieElement('p', '', `${movieDate(reservation.starts_at)} · ${reservation.theatre_name} · ${reservation.screen_name}`),
                movieElement('p', '', `Seats ${reservation.seats} · ${movieMoney(reservation.total_amount)}`),
                movieElement('p', '', `${reservation.status} · Payment ${reservation.payment_status}`)
            );
            if (reservation.status === 'PENDING') {
                const cancel = movieElement('button', 'btn-primary btn-logout', 'CANCEL RESERVATION');
                cancel.type = 'button';
                cancel.addEventListener('click', async () => {
                    if (!window.confirm('Cancel this pending reservation and release the seats?')) return;
                    try {
                        const result = await movieRequest(`/api/cinema/reservations/${reservation.id}/cancel`, {method: 'POST'});
                        showMovieNotice(result.message);
                        await openMovieTickets();
                        loadMovieShowtimes();
                    } catch (error) {
                        showMovieNotice(error.message, true);
                    }
                });
                card.appendChild(cancel);
            }
            if (reservation.status === 'CONFIRMED') {
                const qrUrl = reservation.qr_url || `/api/cinema/reservations/${reservation.id}/qr`;
                const qr = movieElement('img', 'movie-pass-qr');
                qr.src = qrUrl;
                qr.alt = `Movie ticket QR for ${reservation.film_title}, seats ${reservation.seats}`;
                qr.loading = 'eager';
                qr.width = 220;
                qr.height = 220;
                qr.addEventListener('error', () => {
                    qr.replaceWith(movieElement('p', 'movie-seat-help', 'QR image could not be loaded. Use the secure ticket link to open it.'));
                }, {once: true});
                card.appendChild(qr);
                const link = movieElement('a', 'movie-ticket-link', 'OPEN MOVIE QR');
                link.href = qrUrl;
                link.target = '_blank';
                link.rel = 'noopener';
                card.appendChild(link);
                const download = movieElement('a', 'movie-ticket-link', 'DOWNLOAD MOVIE QR');
                download.href = qrUrl;
                download.download = `gatherly-movie-pass-${reservation.id}.png`;
                card.appendChild(download);
                card.appendChild(movieElement(
                    'p',
                    'movie-seat-help',
                    `${Math.max(0, Number(reservation.seat_count) - Number(reservation.admitted_count || 0))} guest(s) remain to enter. Present the same QR once per guest.`
                ));
            }
            const startsAt = new Date(reservation.starts_at);
            if (reservation.status === 'CONFIRMED' && startsAt < new Date()) {
                const rating = movieElement('form', 'movie-rating-form');
                const starsLabel = movieElement('label', '', 'Rate this watched movie');
                const stars = document.createElement('select');
                stars.setAttribute('aria-label', 'Movie rating');
                for (let value = 5; value >= 1; value -= 1) {
                    const option = movieElement('option', '', `${value} star${value === 1 ? '' : 's'}`);
                    option.value = String(value);
                    stars.appendChild(option);
                }
                const review = document.createElement('input');
                review.type = 'text';
                review.maxLength = 1000;
                review.placeholder = 'Optional review';
                review.setAttribute('aria-label', 'Optional movie review');
                starsLabel.appendChild(stars);
                const submitRating = movieElement('button', 'btn-primary btn-logout', 'SUBMIT RATING');
                submitRating.type = 'submit';
                rating.append(starsLabel, review, submitRating);
                rating.addEventListener('submit', async event => {
                    event.preventDefault();
                    try {
                        const result = await movieRequest('/api/cinema/movie-ratings', {
                            method: 'POST',
                            headers: {'Content-Type': 'application/json'},
                            body: JSON.stringify({
                                showtime_id: reservation.showtime_id,
                                rating: Number(stars.value),
                                review: review.value
                            })
                        });
                        showMovieNotice(result.message);
                        await loadMovieShowtimes();
                    } catch (error) {
                        showMovieNotice(error.message, true);
                    }
                });
                card.appendChild(rating);
            }
            list.appendChild(card);
        });
    } catch (error) {
        list.replaceChildren(movieElement('p', 'empty-state', error.message));
    }
}
