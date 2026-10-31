let bookingEvent = null;
let bookingQuantity = 1;
let selectedTierId = null;
let waitlistTimer = null;
let saleCountdownTimer = null;

document.addEventListener('DOMContentLoaded', loadBookingPage);

async function loadBookingPage() {
    const eventId = document.body.dataset.eventId;
    const response = await fetch(`/api/events/${eventId}`);
    const data = await response.json();
    if (!response.ok || !data.success) {
        renderBookingError(data.message || 'This event could not be loaded.');
        return;
    }
    bookingEvent = data.event;
    window.clearInterval(saleCountdownTimer);
    window.clearInterval(waitlistTimer);
    selectedTierId = bookingEvent.tiers?.[0]?.id ?? null;
    renderBookingEvent(bookingEvent);
    if (bookingEvent.tickets_on_sale && document.body.dataset.isSignedIn === 'true') {
        refreshWaitlistState();
        waitlistTimer = window.setInterval(refreshWaitlistState, 15000);
    }
}

function element(tag, className, text) {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (text !== undefined) node.textContent = text;
    return node;
}

function ensureBookingModal() {
    let overlay = document.getElementById('bookingModalOverlay');
    if (!overlay) {
        overlay = element('div', 'modal-overlay hidden');
        overlay.id = 'bookingModalOverlay';
        overlay.setAttribute('role', 'dialog');
        overlay.setAttribute('aria-modal', 'true');
        overlay.setAttribute('aria-labelledby', 'bookingModalTitle');

        const card = element('div', 'glass-modal booking-floating-modal');
        const closeBtn = element('button', 'close-modal-btn', '✕');
        closeBtn.type = 'button';
        closeBtn.setAttribute('aria-label', 'Close booking modal');
        closeBtn.addEventListener('click', closeBookingModal);

        const body = element('div', 'booking-modal-body');
        body.id = 'bookingConfirmation';

        card.append(closeBtn, body);
        overlay.appendChild(card);

        overlay.addEventListener('click', (e) => {
            if (e.target === overlay) closeBookingModal();
        });

        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && !overlay.classList.contains('hidden')) {
                closeBookingModal();
            }
        });

        document.body.appendChild(overlay);
    }
    return overlay;
}

function openBookingModal() {
    const overlay = ensureBookingModal();
    overlay.classList.remove('hidden');
    document.body.classList.add('modal-open');
}

function closeBookingModal() {
    const overlay = document.getElementById('bookingModalOverlay');
    if (overlay) overlay.classList.add('hidden');
    document.body.classList.remove('modal-open');
}
window.closeBookingModal = closeBookingModal;
window.openBookingModal = openBookingModal;

function renderBookingError(message) {
    const content = document.getElementById('bookingPageContent');
    content.replaceChildren(
        element('section', 'booking-error', 'Unable to open this event'),
        element('p', 'event-detail-description', message)
    );
    if (document.body.dataset.isSignedIn !== 'true') {
        const link = element('a', 'btn-primary booking-login-link', 'Sign in to continue');
        const next = encodeURIComponent(window.location.pathname);
        link.href = `/?auth=login&next=${next}`;
        content.appendChild(link);
    }
}

function renderBookingEvent(event) {
    const content = document.getElementById('bookingPageContent');
    content.replaceChildren();
    const shell = element('article', 'booking-experience');
    const hero = element('section', 'booking-hero');
    const coverPath = event.cover_image || event.main_image;
    if (coverPath) {
        const image = element('img', 'booking-cover');
        image.src = `/uploads/${coverPath}`;
        image.alt = '';
        image.setAttribute('aria-hidden', 'true');
        hero.appendChild(image);
    }
    if (event.video_file) {
        const video = element('video', 'booking-cover booking-cover-video');
        video.src = `/uploads/${event.video_file}`;
        video.muted = true;
        video.loop = true;
        video.autoplay = !window.matchMedia('(prefers-reduced-motion: reduce)').matches;
        video.playsInline = true;
        video.preload = 'metadata';
        video.setAttribute('aria-hidden', 'true');
        video.tabIndex = -1;
        hero.classList.add('booking-hero-has-video');
        hero.appendChild(video);
    }
    const heroShade = element('div', 'booking-hero-shade');
    const eyebrow = element('span', 'booking-eyebrow',
        `${event.is_cancelled ? 'CANCELLED · ' : ''}${event.category} · ${event.visibility === 'PRIVATE' ? 'INVITE ONLY' : event.city}`);
    const title = element('h1', 'booking-title', event.title);
    document.title = `${event.title} — Gatherly`;
    const subline = element('p', 'booking-subline', `${formatGatherlyDate(event.event_date)} · ${formatGatherlyTime(event.event_time)} · ${event.city}`);
    heroShade.append(eyebrow, title, subline);
    hero.appendChild(heroShade);
    shell.appendChild(hero);

    const columns = element('div', 'booking-columns');
    const details = element('section', 'booking-details');
    details.appendChild(element('span', 'section-kicker', 'THE EXPERIENCE'));
    details.appendChild(element('h2', 'booking-section-title', 'The night, in full.'));
    details.appendChild(element('p', 'booking-description', event.description || 'A Gatherly experience made to be shared.'));
    const facts = element('div', 'booking-facts');
    [
        ['WHEN', `${formatGatherlyDate(event.event_date)} · ${formatGatherlyTime(event.event_time)}`],
        ['WHERE', `${event.venue}, ${event.city}`],
        ['HOSTED BY', event.organizer_name],
        ['ADMISSION', event.tiers?.length ? 'Multiple ticket tiers' : (event.is_paid ? `₹${Number(event.price).toFixed(2)} per person` : 'Free')]
    ].forEach(([label, value]) => {
        const fact = element('div', 'booking-fact');
        fact.append(element('span', 'section-kicker', label), element('strong', '', value));
        facts.appendChild(fact);
    });
    details.appendChild(facts);
    const calendarLink = element('button', 'btn-primary btn-logout calendar-add-button', 'ADD EVENT TO CALENDAR');
    calendarLink.type = 'button';
    calendarLink.addEventListener('click', () => downloadCalendarEvent(event));
    details.appendChild(calendarLink);

    if (event.partners?.length) {
        const section = element('section', 'booking-partners');
        section.append(
            element('span', 'section-kicker', 'IN GOOD COMPANY'),
            element('h2', 'booking-partners-title', 'Our sponsors & partners')
        );
        const grid = element('div', 'booking-partners-grid');
        event.partners.forEach(partner => {
            const card = element('article', 'booking-partner-card');
            if (partner.logo_path) {
                const logo = element('img', '');
                logo.src = `/uploads/${partner.logo_path}`;
                logo.alt = `${partner.name} logo`;
                card.appendChild(logo);
            }
            card.append(
                element('strong', '', partner.name),
                element('span', '', partner.partner_type === 'EVENT PARTNER' ? 'EVENT PARTNER' : 'SPONSOR')
            );
            grid.appendChild(card);
        });
        section.appendChild(grid);
        details.appendChild(section);
    }
    columns.appendChild(details);

    const booking = element('aside', 'booking-card');
    if (event.is_cancelled) {
        booking.classList.add('booking-cancelled');
        booking.append(
            element('span', 'section-kicker', 'EVENT STATUS'),
            element('h2', 'booking-section-title', 'This event was cancelled'),
            element('p', 'booking-payment-note', 'Ticket sales and gate entry are disabled. Check your Gatherly event updates for information from the host.')
        );
        columns.appendChild(booking);
        shell.appendChild(columns);
        content.appendChild(shell);
        return;
    }
    booking.appendChild(element('span', 'section-kicker', 'YOUR PASS'));
    const selectedTier = getSelectedTier();
    const price = selectedTier ? Number(selectedTier.price) : (event.is_paid ? Number(event.price) : 0);
    booking.appendChild(element('h2', 'booking-section-title', price > 0 ? `₹${price.toFixed(2)}` : 'Free'));
    if (event.tiers?.length) {
        const tierLabel = element('label', 'section-kicker', 'TICKET TIER');
        tierLabel.htmlFor = 'bookingTier';
        const tierSelect = element('select', 'booking-tier-select');
        tierSelect.id = 'bookingTier';
        event.tiers.forEach(tier => {
            const option = element('option', '', `${tier.name} · ₹${Number(tier.price).toFixed(2)} · ${tier.tickets_remaining} left`);
            option.value = String(tier.id);
            tierSelect.appendChild(option);
        });
        tierSelect.value = String(selectedTierId);
        tierSelect.addEventListener('change', () => {
            selectedTierId = Number(tierSelect.value);
            updateBookingTotal();
            refreshBookingAvailability();
        });
        booking.append(tierLabel, tierSelect);
        if (selectedTier?.image_path) {
            const seating = element('img', 'booking-seating-plan');
            seating.src = `/uploads/${selectedTier.image_path}`;
            seating.alt = `${selectedTier.name} seating plan`;
            booking.appendChild(seating);
        }
    }
    const capacityText = selectedTier
        ? `${selectedTier.tickets_remaining} of ${selectedTier.capacity} ${selectedTier.name} tickets left`
        : event.ticket_limit === null ? 'Unlimited capacity' : `${event.tickets_remaining} of ${event.ticket_limit} spots left`;
    const capacity = element('p', 'booking-capacity', capacityText);
    booking.appendChild(capacity);
    if (!event.tickets_on_sale) {
        const saleNote = element('p', 'booking-payment-note');
        saleNote.id = 'ticketSalesCountdown';
        booking.appendChild(saleNote);
        updateTicketSalesCountdown();
        saleCountdownTimer = window.setInterval(updateTicketSalesCountdown, 1000);
    }
    const qtyLabel = element('label', 'section-kicker', 'NUMBER OF PEOPLE');
    qtyLabel.htmlFor = 'bookingQuantity';
    const quantity = element('input', 'booking-quantity');
    quantity.id = 'bookingQuantity';
    quantity.type = 'number';
    quantity.min = '1';
    const available = selectedTier ? selectedTier.tickets_remaining : event.tickets_remaining;
    quantity.max = String(Math.min(20, available === null || available === 0 ? 20 : available));
    quantity.value = '1';
    quantity.disabled = !event.tickets_on_sale;
    quantity.addEventListener('input', () => {
        bookingQuantity = Number(quantity.value);
        updateBookingTotal();
    });
    const total = element('div', 'booking-total');
    total.id = 'bookingTotal';
    const continueButton = element('button', 'btn-primary booking-continue',
        available === 0 ? 'JOIN WAITLIST' : 'REVIEW YOUR BOOKING');
    continueButton.type = 'button';
    continueButton.disabled = !event.tickets_on_sale;
    continueButton.addEventListener('click', () => {
        if (available === 0) joinWaitlist();
        else reviewBooking();
    });
    booking.append(qtyLabel, quantity, total, continueButton);
    if (event.is_published) {
        const wishlistButton = element('button', 'btn-primary btn-logout booking-wishlist',
            event.is_wishlisted ? 'REMOVE FROM WISHLIST' : 'ADD TO WISHLIST');
        wishlistButton.type = 'button';
        wishlistButton.addEventListener('click', toggleWishlist);
        booking.appendChild(wishlistButton);
    }
    const note = element('p', 'booking-payment-note', event.is_paid
        ? 'Paid reservations need organizer confirmation. A pass is issued only after payment is verified.'
        : 'One QR pass is issued for this booking. Each scan admits one person, up to your selected quantity.');
    booking.appendChild(note);
    columns.appendChild(booking);
    shell.appendChild(columns);

    if (event.media?.length) {
        const gallerySection = element('section', 'booking-gallery-section');
        gallerySection.append(element('span', 'section-kicker', 'A LOOK INSIDE'), element('h2', 'booking-section-title', 'Set the scene.'));
        const gallery = element('div', 'booking-gallery');
        event.media.forEach(item => {
            const media = item.media_type === 'video' ? element('video', 'booking-media') : element('img', 'booking-media');
            media.src = `/uploads/${item.media_path}`;
            if (item.media_type === 'video') {
                media.controls = true;
                media.preload = 'metadata';
                media.setAttribute('aria-label', `${event.title} teaser video`);
            } else {
                media.alt = `${event.title} event photo`;
                media.loading = 'lazy';
            }
            gallery.appendChild(media);
        });
        gallerySection.appendChild(gallery);
        shell.appendChild(gallerySection);
    }

    content.appendChild(shell);
    ensureBookingModal();
    updateBookingTotal();
}

function updateTicketSalesCountdown() {
    const note = document.getElementById('ticketSalesCountdown');
    if (!note || !bookingEvent?.ticket_sales_start_at) return;
    const start = new Date(bookingEvent.ticket_sales_start_at).getTime();
    const remaining = start - Date.now();
    if (remaining <= 0) {
        window.clearInterval(saleCountdownTimer);
        loadBookingPage();
        return;
    }
    const seconds = Math.floor(remaining / 1000);
    const days = Math.floor(seconds / 86400);
    const hours = Math.floor((seconds % 86400) / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    const countdown = days ? `${days}d ${hours}h ${minutes}m` : `${hours}h ${minutes}m ${secs}s`;
    note.textContent = `Tickets open in ${countdown}. Add this event to your wishlist for now.`;
}

function updateBookingTotal() {
    const total = document.getElementById('bookingTotal');
    if (!total || !bookingEvent) return;
    const tier = getSelectedTier();
    const price = tier ? Number(tier.price) : (bookingEvent.is_paid ? Number(bookingEvent.price) : 0);
    total.textContent = `Total · ₹${(price * bookingQuantity).toFixed(2)}`;
}

function getSelectedTier() {
    return bookingEvent?.tiers?.find(tier => Number(tier.id) === Number(selectedTierId)) || null;
}

function refreshBookingAvailability() {
    if (!bookingEvent) return;
    const tier = getSelectedTier();
    const capacity = document.querySelector('.booking-capacity');
    if (capacity && tier) capacity.textContent = `${tier.tickets_remaining} of ${tier.capacity} ${tier.name} tickets left`;
    const button = document.querySelector('.booking-continue');
    if (button) button.textContent = tier?.tickets_remaining === 0 ? 'JOIN WAITLIST' : 'REVIEW YOUR BOOKING';
    const priceHeading = document.querySelector('.booking-card .booking-section-title');
    if (priceHeading) {
        const price = tier ? Number(tier.price) : (bookingEvent.is_paid ? Number(bookingEvent.price) : 0);
        priceHeading.textContent = price > 0 ? `₹${price.toFixed(2)}` : 'Free';
    }
    const quantity = document.getElementById('bookingQuantity');
    if (quantity) {
        const available = tier ? tier.tickets_remaining : bookingEvent.tickets_remaining;
        quantity.max = String(Math.min(20, available === null || available === 0 ? 20 : available));
    }
    const plan = document.querySelector('.booking-seating-plan');
    if (plan) plan.remove();
    if (tier?.image_path) {
        const image = element('img', 'booking-seating-plan');
        image.src = `/uploads/${tier.image_path}`;
        image.alt = `${tier.name} seating plan`;
        document.querySelector('.booking-card').insertBefore(image, document.querySelector('.booking-capacity'));
    }
}

async function toggleWishlist() {
    if (document.body.dataset.isSignedIn !== 'true') {
        window.location.assign(`/?auth=login&next=${encodeURIComponent(window.location.pathname)}`);
        return;
    }
    const method = bookingEvent.is_wishlisted ? 'DELETE' : 'POST';
    const response = await fetch(`/api/events/${bookingEvent.id}/wishlist`, {method});
    const data = await response.json();
    if (!response.ok || !data.success) {
        if (typeof showFloatingAlert === 'function') {
            showFloatingAlert(data.message || 'Wishlist could not be updated.', 'error');
        } else {
            window.alert(data.message || 'Wishlist could not be updated.');
        }
        return;
    }
    bookingEvent.is_wishlisted = data.wishlisted;
    const button = document.querySelector('.booking-wishlist');
    if (button) button.textContent = data.wishlisted ? 'REMOVE FROM WISHLIST' : 'ADD TO WISHLIST';
    if (typeof showFloatingAlert === 'function') {
        showFloatingAlert(data.wishlisted ? 'Added to your wishlist!' : 'Removed from wishlist.', 'info');
    }
}

async function refreshWaitlistState() {
    if (!bookingEvent || !bookingEvent.tickets_on_sale) return;
    const response = await fetch(`/api/events/${bookingEvent.id}/waitlist`);
    const data = await response.json();
    if (!response.ok || !data.success || !data.waitlist) return;

    const modalBody = document.getElementById('bookingConfirmation');
    if (!modalBody || modalBody.dataset.waitlistId === String(data.waitlist.id)) return;
    modalBody.dataset.waitlistId = String(data.waitlist.id);
    modalBody.replaceChildren();

    const isOffered = data.waitlist.status === 'OFFERED';
    const badgeWrap = element('div', 'booking-success-badge-wrap');
    badgeWrap.appendChild(element('div', `booking-status-icon ${isOffered ? 'confirmed' : 'pending'}`, isOffered ? '🎟️' : '⏱'));

    const kicker = element('span', 'section-kicker', 'TICKET QUEUE');
    const title = element('h2', 'modal-title', isOffered ? 'Your ticket offer is ready!' : 'You’re in the queue.');
    title.id = 'bookingModalTitle';

    const desc = element('p', 'booking-modal-message', isOffered
        ? `Accept before ${data.waitlist.offered_until} to secure your place.`
        : `Queue position: #${data.position}. Requests are offered in order with a short 5–7 minute hold.`);

    modalBody.append(badgeWrap, kicker, title, desc);

    const actions = element('div', 'booking-modal-actions');
    if (isOffered) {
        const accept = element('button', 'btn-primary booking-submit-btn', 'ACCEPT TICKET OFFER');
        accept.type = 'button';
        accept.addEventListener('click', () => acceptWaitlistOffer(data.waitlist.id));
        actions.appendChild(accept);
    }
    const closeBtn = element('button', 'btn-primary btn-logout booking-modal-back', 'DISMISS');
    closeBtn.type = 'button';
    closeBtn.addEventListener('click', closeBookingModal);
    actions.appendChild(closeBtn);

    modalBody.appendChild(actions);
    openBookingModal();
}

async function joinWaitlist() {
    if (document.body.dataset.isSignedIn !== 'true') {
        window.location.assign(`/?auth=login&next=${encodeURIComponent(window.location.pathname)}`);
        return;
    }
    const response = await fetch(`/api/events/${bookingEvent.id}/waitlist`, {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({quantity: bookingQuantity, tier_id: selectedTierId})
    });
    const data = await response.json();
    if (!response.ok || !data.success) {
        if (typeof showFloatingAlert === 'function') {
            showFloatingAlert(data.message || 'Could not join ticket queue.', 'error');
        } else {
            window.alert(data.message || 'Could not join the ticket queue.');
        }
        return;
    }
    if (typeof showFloatingAlert === 'function') {
        showFloatingAlert('You joined the ticket waitlist!', 'success');
    }
    refreshWaitlistState();
}

async function acceptWaitlistOffer(waitlistId) {
    const response = await fetch(`/api/waitlist/${waitlistId}/accept`, {method: 'POST'});
    const data = await response.json();
    if (!response.ok || !data.success) {
        if (typeof showFloatingAlert === 'function') {
            showFloatingAlert(data.message || 'This offer could not be accepted.', 'error');
        } else {
            window.alert(data.message || 'This offer could not be accepted.');
        }
        refreshWaitlistState();
        return;
    }

    const modalBody = document.getElementById('bookingConfirmation');
    modalBody.replaceChildren();

    const badgeWrap = element('div', 'booking-success-badge-wrap');
    badgeWrap.appendChild(element('div', 'booking-status-icon confirmed', '✓'));

    modalBody.append(
        badgeWrap,
        element('span', 'section-kicker', 'OFFER ACCEPTED'),
        element('h2', 'modal-title', 'Your place is saved!'),
        element('p', 'booking-modal-message', data.message)
    );

    if (data.qr_url) {
        const ticketCard = element('div', 'booking-pass-card');
        const ticketTop = element('div', 'booking-pass-header');
        ticketTop.append(
            element('strong', 'booking-pass-title', bookingEvent.title),
            element('span', 'booking-pass-chip', `${bookingQuantity} ${bookingQuantity === 1 ? 'Attendee' : 'Attendees'}`)
        );

        const qrWrap = element('div', 'booking-pass-qr-wrap');
        const qr = element('img', 'saved-ticket-qr');
        qr.src = data.qr_url;
        qr.alt = 'Your Gatherly ticket QR code';
        qrWrap.appendChild(qr);

        const qrNote = element('p', 'booking-pass-instruction',
            `One QR admits your party. Scan once per attendee at the entrance.`);

        const download = element('a', 'btn-primary booking-download-btn', 'DOWNLOAD PASS (PNG)');
        download.href = data.qr_url;
        download.download = `gatherly-pass-${bookingEvent.id}.png`;

        ticketCard.append(ticketTop, qrWrap, qrNote, download);
        modalBody.appendChild(ticketCard);
    }

    const actions = element('div', 'booking-modal-actions');
    const passes = element('a', 'btn-primary', 'VIEW ALL MY PASSES');
    passes.href = '/?passes=1';
    const doneBtn = element('button', 'btn-primary btn-logout', 'DONE');
    doneBtn.type = 'button';
    doneBtn.addEventListener('click', closeBookingModal);
    actions.append(passes, doneBtn);
    modalBody.appendChild(actions);

    openBookingModal();
}

function reviewBooking() {
    const tier = getSelectedTier();
    const remaining = tier ? tier.tickets_remaining : bookingEvent.tickets_remaining;
    if (!Number.isInteger(bookingQuantity) || bookingQuantity < 1 ||
        bookingQuantity > 20 || (remaining !== null && remaining > 0 && bookingQuantity > remaining)) {
        if (typeof showFloatingAlert === 'function') {
            showFloatingAlert('Choose a valid ticket quantity within remaining capacity (1–20).', 'error');
        } else {
            window.alert('Choose a valid quantity within the remaining capacity.');
        }
        return;
    }

    ensureBookingModal();
    const review = document.getElementById('bookingConfirmation');
    review.replaceChildren();

    // 1. Header
    const kicker = element('span', 'section-kicker', 'CONFIRM RESERVATION');
    const title = element('h2', 'modal-title', 'Review your booking');
    title.id = 'bookingModalTitle';

    // 2. Event Snippet Box
    const eventCard = element('div', 'booking-modal-event-card');
    const coverPath = bookingEvent.cover_image || bookingEvent.main_image;
    if (coverPath) {
        const thumb = element('img', 'booking-modal-thumb');
        thumb.src = `/uploads/${coverPath}`;
        thumb.alt = '';
        eventCard.appendChild(thumb);
    }
    const eventMeta = element('div', 'booking-modal-event-meta');
    const evTitle = element('h3', 'booking-modal-ev-title', bookingEvent.title);
    const evWhen = element('p', 'booking-modal-ev-detail',
        `📅 ${formatGatherlyDate(bookingEvent.event_date)} at ${formatGatherlyTime(bookingEvent.event_time)}`);
    const evWhere = element('p', 'booking-modal-ev-detail',
        `📍 ${bookingEvent.venue}, ${bookingEvent.city}`);
    eventMeta.append(evTitle, evWhen, evWhere);
    eventCard.appendChild(eventMeta);

    // 3. Breakdown Summary Card
    const unitPrice = tier ? Number(tier.price) : (bookingEvent.is_paid ? Number(bookingEvent.price) : 0);
    const totalPrice = unitPrice * bookingQuantity;
    const isPaid = unitPrice > 0;

    const breakdown = element('div', 'booking-modal-summary');
    const tierRow = element('div', 'booking-summary-row');
    tierRow.append(
        element('span', 'summary-label', 'Ticket Type'),
        element('strong', 'summary-value', tier ? tier.name : 'General Admission')
    );
    const qtyRow = element('div', 'booking-summary-row');
    qtyRow.append(
        element('span', 'summary-label', 'Attendees'),
        element('strong', 'summary-value', `${bookingQuantity} ${bookingQuantity === 1 ? 'Person' : 'People'}`)
    );
    const rateRow = element('div', 'booking-summary-row');
    rateRow.append(
        element('span', 'summary-label', 'Price per ticket'),
        element('strong', 'summary-value', unitPrice > 0 ? `₹${unitPrice.toFixed(2)}` : 'Free')
    );
    const totalRow = element('div', 'booking-summary-row booking-summary-total');
    totalRow.append(
        element('span', 'summary-label', 'Total Amount'),
        element('strong', 'summary-value total-accent', totalPrice > 0 ? `₹${totalPrice.toFixed(2)}` : 'Free')
    );
    breakdown.append(tierRow, qtyRow, rateRow, totalRow);

    // 4. Policy Notice
    const notice = element('p', 'booking-modal-notice', isPaid
        ? 'ℹ️ Paid reservations are confirmed once payment is verified by the organizer. You will receive an email upon confirmation.'
        : '✨ Instant admission. One single QR pass will be issued that admits all attendees in your booking.');

    // 5. Action Buttons
    const actions = element('div', 'booking-modal-actions');
    const confirmBtn = element('button', 'btn-primary booking-submit-btn',
        isPaid ? 'REQUEST RESERVATION' : 'CONFIRM & GET PASS');
    confirmBtn.type = 'button';
    confirmBtn.id = 'bookingConfirmBtn';
    confirmBtn.addEventListener('click', submitBooking);

    const editBtn = element('button', 'btn-primary btn-logout booking-modal-back', 'CHANGE QUANTITY');
    editBtn.type = 'button';
    editBtn.addEventListener('click', closeBookingModal);

    actions.append(confirmBtn, editBtn);

    review.append(kicker, title, eventCard, breakdown, notice, actions);
    openBookingModal();
}

async function submitBooking() {
    const confirmBtn = document.getElementById('bookingConfirmBtn');
    if (confirmBtn) {
        confirmBtn.disabled = true;
        confirmBtn.textContent = 'Securing your spots...';
    }

    try {
        const response = await fetch('/api/book-ticket', {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({event_id: bookingEvent.id, quantity: bookingQuantity, tier_id: selectedTierId})
        });
        const data = await response.json();
        if (!response.ok || !data.success) {
            if (response.status === 401) {
                closeBookingModal();
                window.location.assign(`/?auth=login&next=${encodeURIComponent(window.location.pathname)}`);
                return;
            }
            if (data.queued) {
                closeBookingModal();
                refreshWaitlistState();
                return;
            }
            if (confirmBtn) {
                confirmBtn.disabled = false;
                confirmBtn.textContent = 'TRY AGAIN';
            }
            if (typeof showFloatingAlert === 'function') {
                showFloatingAlert(data.message || 'Booking could not be completed.', 'error');
            } else {
                window.alert(data.message || 'Booking could not be completed.');
            }
            return;
        }

        // Render Confirmed Success State in the floating modal
        const confirmation = document.getElementById('bookingConfirmation');
        confirmation.replaceChildren();

        const isPending = data.status === 'PENDING';

        const badgeWrapper = element('div', 'booking-success-badge-wrap');
        const badgeIcon = element('div', `booking-status-icon ${isPending ? 'pending' : 'confirmed'}`, isPending ? '⏱' : '✓');
        badgeWrapper.appendChild(badgeIcon);

        const kicker = element('span', 'section-kicker', isPending ? 'REQUEST RECEIVED' : 'YOU’RE GOING!');
        const title = element('h2', 'modal-title', isPending ? 'With the host for approval.' : 'Your place is confirmed.');
        title.id = 'bookingModalTitle';

        const description = element('p', 'booking-modal-message', data.message || (isPending
            ? 'The organizer will review your payment. Your pass will be issued once approved.'
            : 'Your pass is ready! Present this QR at the gate for entry.'));

        confirmation.append(badgeWrapper, kicker, title, description);

        if (data.qr_url) {
            const ticketCard = element('div', 'booking-pass-card');

            const ticketTop = element('div', 'booking-pass-header');
            ticketTop.append(
                element('strong', 'booking-pass-title', bookingEvent.title),
                element('span', 'booking-pass-chip', `${bookingQuantity} ${bookingQuantity === 1 ? 'Attendee' : 'Attendees'}`)
            );

            const qrWrap = element('div', 'booking-pass-qr-wrap');
            const image = element('img', 'saved-ticket-qr');
            image.src = data.qr_url;
            image.alt = 'Your saved Gatherly ticket QR code';
            image.addEventListener('error', () => {
                image.alt = 'QR image is not available. Open My Passes after signing in to reload it.';
            });
            qrWrap.appendChild(image);

            const qrInstruction = element('p', 'booking-pass-instruction',
                `One QR admits ${bookingQuantity} ${bookingQuantity === 1 ? 'person' : 'people'}. Scanned one person at a time at the entrance.`);

            const downloadLink = element('a', 'btn-primary booking-download-btn', 'DOWNLOAD PASS (PNG)');
            downloadLink.href = data.qr_url;
            downloadLink.download = `gatherly-pass-${bookingEvent.id}.png`;

            ticketCard.append(ticketTop, qrWrap, qrInstruction, downloadLink);
            confirmation.appendChild(ticketCard);

            const emailNote = element('p', 'booking-email-note',
                data.email_sent ? '✉️ A copy of this same QR was emailed to you.' : '📱 The QR is saved to your Gatherly passes.');
            confirmation.appendChild(emailNote);
        }

        const actions = element('div', 'booking-modal-actions');
        const passes = element('a', 'btn-primary', 'VIEW ALL MY PASSES');
        passes.href = '/?passes=1';

        const doneBtn = element('button', 'btn-primary btn-logout', 'DONE');
        doneBtn.type = 'button';
        doneBtn.addEventListener('click', () => {
            closeBookingModal();
            loadBookingPage();
        });

        actions.append(passes, doneBtn);
        confirmation.appendChild(actions);

        if (typeof showFloatingAlert === 'function') {
            showFloatingAlert(isPending ? 'Reservation request submitted!' : 'Tickets booked successfully! 🎉', 'success');
        }

        openBookingModal();

    } catch (err) {
        if (confirmBtn) {
            confirmBtn.disabled = false;
            confirmBtn.textContent = 'TRY AGAIN';
        }
        if (typeof showFloatingAlert === 'function') {
            showFloatingAlert('Network or server error while booking.', 'error');
        } else {
            window.alert('Network error while booking.');
        }
    }
}
