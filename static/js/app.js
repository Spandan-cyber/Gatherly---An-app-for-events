let detectedCity = '';
let pendingAuthEmail = '';
let pendingAuthPurpose = '';
let selectedEvent = null;
let selectedQuantity = 1;
let discoveredEvents = [];
let calendarMonth = new Date(new Date().getFullYear(), new Date().getMonth(), 1);

document.addEventListener("DOMContentLoaded", () => {
    if (document.getElementById('eventGrid')) fetchEvents();
    if (document.body.dataset.isSignedIn === 'true') {
        loadInvitationCount();
        loadEventUpdateCount();
    }
    const invitationToken = document.body.dataset.invitationToken;
    if (invitationToken) openInvitation(invitationToken);
    document.addEventListener('keydown', event => {
        if (event.key === 'Escape') {
            document.getElementById('invitationsOverlay')?.classList.add('hidden');
        }
    });
    document.getElementById('invitationsOverlay')?.addEventListener('click', event => {
        if (event.target === event.currentTarget) event.currentTarget.classList.add('hidden');
    });
    document.addEventListener('keydown', event => {
        if (event.key === 'Escape') closeUpdates();
    });
    document.getElementById('updatesOverlay')?.addEventListener('click', event => {
        if (event.target === event.currentTarget) closeUpdates();
    });
    initializeHeroTyping();
    const params = new URLSearchParams(window.location.search);
    const next = params.get('next');
    if (next && next.startsWith('/') && !next.startsWith('//') &&
        document.body.dataset.isSignedIn === 'true') {
        window.location.replace(next);
        return;
    }

    if (params.get('auth') === 'login' && document.body.dataset.isSignedIn !== 'true') {
        openAuthModal('login');
    }
    if (params.get('create') === '1' && document.body.dataset.isSignedIn === 'true') {
        openCreateEventModal();
    }
    if (params.get('passes') === '1' && document.body.dataset.isSignedIn === 'true') openPasses();
    if (params.get('wishlist') === '1' && document.body.dataset.isSignedIn === 'true') openWishlist();
    document.getElementById('eventSort')?.addEventListener('change', fetchEvents);
    document.getElementById('eventCategoryFilter')?.addEventListener('change', fetchEvents);
    document.getElementById('eventPriceFilter')?.addEventListener('change', fetchEvents);
    document.getElementById('showEventCards')?.addEventListener('click', () => setEventView('cards'));
    document.getElementById('showEventCalendar')?.addEventListener('click', () => setEventView('calendar'));
    document.getElementById('calendarPrevious')?.addEventListener('click', () => moveCalendarMonth(-1));
    document.getElementById('calendarNext')?.addEventListener('click', () => moveCalendarMonth(1));
    document.getElementById('calendarNavLink')?.addEventListener('click', () => {
        setEventView('calendar');
        document.getElementById('events')?.scrollIntoView({behavior: 'smooth'});
    });
    document.getElementById('addEventTier')?.addEventListener('click', () => addEventTierRow());
    if (document.getElementById('eventTierRows')) addEventTierRow();
    document.getElementById('addEventPartner')?.addEventListener('click', () => addEventPartnerRow());
    if (document.getElementById('eventPartnerRows')) addEventPartnerRow();
});

function addEventTierRow() {
    const container = document.getElementById('eventTierRows');
    if (!container || container.children.length >= 20) return;
    const row = document.createElement('div');
    row.className = 'form-row tier-form-row';
    [['Tier name', 'text'], ['Price (₹)', 'number'], ['Capacity', 'number'], ['Seating-plan image', 'file']].forEach(([labelText, type]) => {
        const group = document.createElement('div');
        group.className = 'input-group';
        const label = document.createElement('label');
        label.textContent = labelText;
        const input = document.createElement('input');
        input.type = type;
        input.dataset.tierField = labelText.startsWith('Tier') ? 'name'
            : labelText.startsWith('Price') ? 'price'
                : labelText.startsWith('Capacity') ? 'capacity' : 'image';
        if (type === 'number') {
            input.min = '0';
            input.step = labelText.startsWith('Price') ? '0.01' : '1';
        }
        if (type === 'file') input.accept = 'image/*';
        if (input.dataset.tierField === 'name') input.maxLength = 80;
        group.append(label, input);
        row.appendChild(group);
    });
    if (container.children.length) {
        const remove = document.createElement('button');
        remove.type = 'button';
        remove.className = 'btn-primary btn-logout';
        remove.textContent = 'REMOVE TIER';
        remove.addEventListener('click', () => row.remove());
        row.appendChild(remove);
    }
    container.appendChild(row);
}

function addEventPartnerRow() {
    const container = document.getElementById('eventPartnerRows');
    if (!container) return;
    if (container.children.length >= 12) {
        window.alert('An event can have up to 12 sponsors or event partners.');
        return;
    }
    const row = document.createElement('div');
    row.className = 'event-partner-form-row';

    const nameLabel = document.createElement('label');
    nameLabel.textContent = 'Name';
    const name = document.createElement('input');
    name.type = 'text';
    name.name = 'partner_name';
    name.maxLength = 120;
    name.placeholder = 'Organization or brand';
    nameLabel.appendChild(name);

    const typeLabel = document.createElement('label');
    typeLabel.textContent = 'Type';
    const type = document.createElement('select');
    type.name = 'partner_type';
    [['SPONSOR', 'Sponsor'], ['EVENT PARTNER', 'Event partner']].forEach(([value, labelText]) => {
        const option = document.createElement('option');
        option.value = value;
        option.textContent = labelText;
        type.appendChild(option);
    });
    typeLabel.appendChild(type);

    const logoLabel = document.createElement('label');
    logoLabel.textContent = 'Logo (optional)';
    const logo = document.createElement('input');
    logo.type = 'file';
    logo.name = 'partner_logo';
    logo.accept = 'image/*';
    logoLabel.appendChild(logo);

    const remove = document.createElement('button');
    remove.type = 'button';
    remove.className = 'btn-primary btn-logout';
    remove.textContent = 'REMOVE';
    remove.setAttribute('aria-label', 'Remove sponsor or event partner');
    remove.addEventListener('click', () => row.remove());

    row.append(nameLabel, typeLabel, logoLabel, remove);
    container.appendChild(row);
}

function downloadCalendarEvent(event) {
    const date = String(event.event_date || '').replace(/-/g, '');
    const time = String(event.event_time || '00:00').replace(/:/g, '');
    if (!/^\d{8}$/.test(date) || !/^\d{4}$/.test(time)) {
        window.alert('This event does not have a valid calendar date and time.');
        return;
    }
    const escapeIcs = value => String(value || '').replace(/\\/g, '\\\\')
        .replace(/\n/g, '\\n').replace(/,/g, '\\,').replace(/;/g, '\\;');
    const uid = `gatherly-${event.booking_id || event.id || date}@gatherly`;
    const content = [
        'BEGIN:VCALENDAR',
        'VERSION:2.0',
        'PRODID:-//Gatherly//Events//EN',
        'CALSCALE:GREGORIAN',
        'BEGIN:VEVENT',
        `UID:${uid}`,
        `DTSTAMP:${new Date().toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '')}`,
        `DTSTART:${date}T${time}00`,
        `SUMMARY:${escapeIcs(event.title)}`,
        `LOCATION:${escapeIcs(event.venue)}`,
        `DESCRIPTION:${escapeIcs(`${event.quantity || 1} ticket(s) booked through Gatherly`)}`,
        'END:VEVENT',
        'END:VCALENDAR'
    ].join('\r\n');
    const file = new Blob([content], {type: 'text/calendar;charset=utf-8'});
    const url = URL.createObjectURL(file);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${String(event.title || 'gatherly-event').trim().replace(/[^\w-]+/g, '-')}.ics`;
    link.click();
    URL.revokeObjectURL(url);
}

function getUserLocation() {
    const label = document.getElementById('userLocationText');
    if (!label) return;
    if (!navigator.geolocation) {
        label.textContent = 'Choose your city';
        return;
    }
    label.textContent = 'Find my city';
    navigator.geolocation.getCurrentPosition(async position => {
        try {
            const {latitude, longitude} = position.coords;
            const response = await fetch(`https://photon.komoot.io/reverse?lat=${latitude}&lon=${longitude}&limit=1`);
            if (!response.ok) throw new Error('City lookup unavailable');
            const result = await response.json();
            const place = result.features?.[0]?.properties;
            const city = place?.city || place?.town || place?.village || place?.name || place?.county;
            if (!city) throw new Error('Could not determine a nearby city');
            detectedCity = city;
            label.textContent = city;
            const saved = await fetch('/api/update-location', {
                method: 'POST',
                headers: {'Content-Type': 'application/json'},
                body: JSON.stringify({city})
            });
            if (!saved.ok) throw new Error('Could not save the city preference');
            const eventCity = document.getElementById('evCity');
            if (eventCity && !eventCity.value) eventCity.value = city;
            fetchEvents();
        } catch (error) {
            label.textContent = 'Choose your city';
            console.warn('Could not detect nearest city:', error);
        }
    }, () => {
        label.textContent = 'Choose your city';
    }, {maximumAge: 300000, timeout: 10000});
}

function copyDetectedCity() {
    const input = document.getElementById('evCity');
    if (input && detectedCity) input.value = detectedCity;
    else window.alert('Use “Find my city” in the navigation first, or enter the event city manually.');
}

async function initializeHeroTyping() {
    const items = Array.from(document.querySelectorAll('[data-typewriter]'));
    if (!items.length || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    for (const item of items) {
        const fullText = item.textContent.trim();
        item.setAttribute('aria-label', fullText);
        item.setAttribute('aria-live', 'off');
        item.textContent = '';
        item.classList.add('is-typing');
        for (const character of fullText) {
            item.textContent += character;
            await new Promise(resolve => window.setTimeout(resolve, 17));
        }
        item.classList.remove('is-typing');
        await new Promise(resolve => window.setTimeout(resolve, 180));
    }
}

async function loadInvitationCount() {
    const badge = document.getElementById('invitePendingCount');
    if (!badge) return;
    const response = await fetch('/api/invitations');
    const data = await response.json();
    if (!response.ok || !data.success) return;
    const count = data.invitations.filter(invite => invite.status === 'PENDING').length;
    badge.textContent = String(count);
    badge.classList.toggle('hidden', count === 0);
}

async function loadEventUpdateCount() {
    const badge = document.getElementById('eventUpdateCount');
    if (!badge) return;
    try {
        const response = await fetch('/api/my/notifications');
        const data = await response.json();
        if (!response.ok || !data.success) return;
        const count = data.notifications.filter(item => !item.is_read).length;
        badge.textContent = String(count);
        badge.classList.toggle('hidden', count === 0);
    } catch (error) {
        console.warn('Could not load event update count:', error);
    }
}

async function openEventUpdates() {
    if (document.body.dataset.isSignedIn !== 'true') {
        openAuthModal('login');
        return;
    }
    const overlay = document.getElementById('updatesOverlay');
    const list = document.getElementById('eventUpdates');
    overlay.classList.remove('hidden');
    list.replaceChildren();
    appendText(list, 'p', 'Loading your event updates…', 'empty-state');
    try {
        const response = await fetch('/api/my/notifications');
        const data = await response.json();
        list.replaceChildren();
        if (!response.ok || !data.success) {
            appendText(list, 'p', data.message || 'Event updates could not be loaded.', 'empty-state');
            return;
        }
        if (!data.notifications.length) {
            appendText(list, 'p', 'No event updates yet. Hosts can share private updates here without receiving your contact details.', 'empty-state');
            return;
        }
        data.notifications.forEach(notification => {
            const card = document.createElement('article');
            card.className = `dashboard-card event-update-card${notification.is_read ? '' : ' unread'}`;
            appendText(card, 'span', notification.kind === 'CANCELLED' ? 'EVENT CANCELLED' : 'EVENT UPDATE', 'section-kicker');
            appendText(card, 'h3', notification.event_title);
            appendText(card, 'h4', notification.title);
            appendText(card, 'p', notification.message, 'event-update-message');
            appendText(card, 'time', formatGatherlyDateTime(notification.created_at), 'capacity-note');
            if (!notification.is_read) {
                const markRead = document.createElement('button');
                markRead.type = 'button';
                markRead.className = 'btn-primary btn-logout';
                markRead.textContent = 'MARK AS READ';
                markRead.addEventListener('click', async () => {
                    markRead.disabled = true;
                    try {
                        const result = await fetch(`/api/my/notifications/${notification.id}/read`, {method: 'POST'});
                        const resultData = await result.json();
                        if (!result.ok || !resultData.success) {
                            window.alert(resultData.message || 'Could not update this notification.');
                            markRead.disabled = false;
                            return;
                        }
                        notification.is_read = 1;
                        openEventUpdates();
                        await loadEventUpdateCount();
                    } catch {
                        window.alert('Could not update this notification. Check your connection and try again.');
                        markRead.disabled = false;
                    }
                });
                card.appendChild(markRead);
            }
            list.appendChild(card);
        });
        await loadEventUpdateCount();
    } catch {
        list.replaceChildren();
        appendText(list, 'p', 'Event updates could not be loaded. Check your connection and try again.', 'empty-state');
    }
}

function closeUpdates() {
    document.getElementById('updatesOverlay')?.classList.add('hidden');
}

async function openInvitations() {
    if (document.body.dataset.isSignedIn !== 'true') {
        openAuthModal('login');
        return;
    }
    const overlay = document.getElementById('invitationsOverlay');
    const list = document.getElementById('receivedInvitations');
    overlay.classList.remove('hidden');
    list.replaceChildren();
    appendText(list, 'p', 'Loading your invitations…', 'empty-state');
    try {
        const response = await fetch('/api/invitations');
        const data = await response.json();
        list.replaceChildren();
        if (!response.ok || !data.success) {
            appendText(list, 'p', data.message || 'Invitations could not be loaded.', 'empty-state');
            return;
        }
        if (!data.invitations.length) {
            appendText(list, 'p', 'No invitations yet. When someone invites you, it will show up here.', 'empty-state');
            return;
        }
        data.invitations.forEach(invitation => {
            const card = document.createElement('article');
            card.className = 'dashboard-card invitation-card';
            appendText(card, 'h3', invitation.title);
            appendText(card, 'p', `${formatGatherlyDate(invitation.event_date)} · ${formatGatherlyTime(invitation.event_time)} · ${invitation.venue}`);
            appendText(card, 'p', `${invitation.role === 'MANAGER' ? 'Event management' : 'Guest RSVP'} · ${invitation.status}`, 'capacity-note');
            const actions = document.createElement('div');
            actions.className = 'dashboard-actions';
            const eventLink = document.createElement('a');
            eventLink.className = 'btn-primary btn-logout';
            eventLink.href = `/events/${invitation.public_id}`;
            eventLink.textContent = 'VIEW EVENT';
            actions.appendChild(eventLink);
            if (invitation.status === 'PENDING') {
                [['ACCEPTED', 'ACCEPT / RSVP YES', 'btn-primary'], ['DECLINED', 'DECLINE', 'btn-primary btn-logout']]
                    .forEach(([decision, label, className]) => {
                        const button = document.createElement('button');
                        button.type = 'button';
                        button.className = className;
                        button.textContent = label;
                        button.addEventListener('click', async () => {
                            button.disabled = true;
                            try {
                                const result = await fetch(
                                    `/api/invitations/${encodeURIComponent(invitation.invitation_token)}/respond`,
                                    {
                                        method: 'POST',
                                        headers: {'Content-Type': 'application/json'},
                                        body: JSON.stringify({decision})
                                    }
                                );
                                const responseData = await result.json();
                                if (!result.ok || !responseData.success) {
                                    window.alert(responseData.message || 'Unable to update your RSVP.');
                                    button.disabled = false;
                                    return;
                                }
                                await loadInvitationCount();
                                openInvitations();
                            } catch {
                                window.alert('Could not update your RSVP. Check your connection and try again.');
                                button.disabled = false;
                            }
                        });
                        actions.appendChild(button);
                    });
            }
            card.appendChild(actions);
            list.appendChild(card);
        });
        await loadInvitationCount();
    } catch {
        list.replaceChildren();
        appendText(list, 'p', 'Invitations could not be loaded. Check your connection and try again.', 'empty-state');
    }
}

async function fetchEvents() {
    if (!document.getElementById('eventGrid')) return;
    const res = await fetch('/api/events');
    const data = await res.json();
    if (!data.success) return;
    discoveredEvents = data.events;

    const grid = document.getElementById('eventGrid');
    const category = document.getElementById('eventCategoryFilter')?.value || '';
    const priceFilter = document.getElementById('eventPriceFilter')?.value || '';
    const sort = document.getElementById('eventSort')?.value || 'recommended';
    let events = data.events.filter(ev => (!category || ev.category === category) &&
        (!priceFilter || (priceFilter === 'free' ? !ev.is_paid : Boolean(ev.is_paid))));
    if (sort === 'date') events.sort((a, b) => `${a.event_date} ${a.event_time}`.localeCompare(`${b.event_date} ${b.event_time}`));
    if (sort === 'price-low') events.sort((a, b) => Number(a.price) - Number(b.price));
    if (sort === 'price-high') events.sort((a, b) => Number(b.price) - Number(a.price));
    if (sort === 'name') events.sort((a, b) => a.title.localeCompare(b.title));
    if (sort === 'city') events.sort((a, b) => a.city.localeCompare(b.city) || a.title.localeCompare(b.title));
    grid.replaceChildren();

    events.forEach(ev => {
        const card = document.createElement('div');
        card.className = 'event-card';
        const imageWrap = document.createElement('div');
        imageWrap.className = 'card-image-wrap';
        const cardImage = ev.cover_image || ev.main_image;
        if (cardImage) {
            const image = document.createElement('img');
            image.src = `/uploads/${cardImage}`;
            image.alt = ev.title;
            imageWrap.appendChild(image);
        }
        const visibility = document.createElement('span');
        visibility.className = 'distance-badge';
        visibility.textContent = ev.visibility === 'PRIVATE' ? 'INVITE ONLY' : 'EXPLORE';
        imageWrap.appendChild(visibility);

        const details = document.createElement('div');
        details.className = 'card-details';
        const meta = document.createElement('div');
        meta.className = 'event-meta';
        meta.textContent = `${formatGatherlyDate(ev.event_date)} · ${ev.city} · ${ev.venue}`;
        const heading = document.createElement('h3');
        heading.textContent = ev.title;
        if (ev.organizer_badge === 'verified_organizer') {
            const badge = document.createElement('span');
            badge.className = 'verified-badge';
            badge.textContent = '☑️ Verified organizer';
            badge.setAttribute('aria-label', 'Verified event organizer');
            details.append(meta, badge, heading);
        } else {
            details.append(meta, heading);
        }
        const description = document.createElement('p');
        description.textContent = ev.description || 'A Gatherly experience awaits.';
        const footer = document.createElement('div');
        footer.className = 'event-card-footer';
        const price = document.createElement('strong');
        const startingPrice = ev.tiers?.length
            ? Math.min(...ev.tiers.map(tier => Number(tier.price)))
            : Number(ev.price);
        price.textContent = ev.is_paid ? `From ₹${startingPrice.toFixed(2)}` : 'FREE';
        const button = document.createElement('button');
        button.type = 'button';
        button.className = 'btn-primary';
        button.textContent = 'EXPLORE EVENT';
        button.addEventListener('click', () => window.location.assign(`/events/${ev.public_id}`));
        footer.append(price, button);
        details.append(description, footer);
        card.append(imageWrap, details);
        grid.appendChild(card);
    });
    renderEventCalendar(events);
}

function setEventView(view) {
    const calendar = view === 'calendar';
    document.getElementById('eventGrid')?.classList.toggle('hidden', calendar);
    document.getElementById('eventCalendar')?.classList.toggle('hidden', !calendar);
    document.getElementById('showEventCards')?.classList.toggle('active', !calendar);
    document.getElementById('showEventCalendar')?.classList.toggle('active', calendar);
    document.getElementById('showEventCards')?.setAttribute('aria-pressed', String(!calendar));
    document.getElementById('showEventCalendar')?.setAttribute('aria-pressed', String(calendar));
    if (calendar) renderEventCalendar(getFilteredEvents());
}

function getFilteredEvents() {
    const category = document.getElementById('eventCategoryFilter')?.value || '';
    const priceFilter = document.getElementById('eventPriceFilter')?.value || '';
    return discoveredEvents.filter(event =>
        (!category || event.category === category) &&
        (!priceFilter || (priceFilter === 'free' ? !event.is_paid : Boolean(event.is_paid)))
    );
}

function moveCalendarMonth(offset) {
    calendarMonth = new Date(calendarMonth.getFullYear(), calendarMonth.getMonth() + offset, 1);
    renderEventCalendar(getFilteredEvents());
}

function renderEventCalendar(events) {
    const grid = document.getElementById('calendarGrid');
    const label = document.getElementById('calendarMonthLabel');
    if (!grid || !label) return;
    label.textContent = calendarMonth.toLocaleDateString('en-IN', {month: 'long', year: 'numeric'});
    grid.replaceChildren();
    ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].forEach(day => {
        const heading = document.createElement('span');
        heading.className = 'calendar-weekday';
        heading.textContent = day;
        grid.appendChild(heading);
    });
    const year = calendarMonth.getFullYear();
    const month = calendarMonth.getMonth();
    const firstWeekday = new Date(year, month, 1).getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const eventsByDay = new Map();
    events.forEach(event => {
        const date = new Date(`${event.event_date}T00:00:00`);
        if (date.getFullYear() !== year || date.getMonth() !== month) return;
        const dayEvents = eventsByDay.get(date.getDate()) || [];
        dayEvents.push(event);
        eventsByDay.set(date.getDate(), dayEvents);
    });
    for (let index = 0; index < firstWeekday; index += 1) {
        const blank = document.createElement('div');
        blank.className = 'calendar-day calendar-day-empty';
        blank.setAttribute('aria-hidden', 'true');
        grid.appendChild(blank);
    }
    for (let day = 1; day <= daysInMonth; day += 1) {
        const cell = document.createElement('div');
        cell.className = 'calendar-day';
        const number = document.createElement('span');
        number.className = 'calendar-day-number';
        number.textContent = String(day);
        cell.appendChild(number);
        (eventsByDay.get(day) || []).forEach(event => {
            const entry = document.createElement('a');
            entry.className = 'calendar-event';
            entry.href = `/events/${event.public_id}`;
            entry.title = `${formatGatherlyTime(event.event_time)} · ${event.title}`;
            entry.textContent = `${formatGatherlyTime(event.event_time)} ${event.title}`;
            cell.appendChild(entry);
        });
        grid.appendChild(cell);
    }
}

async function openEventDetails(eventId) {
    const response = await fetch(`/api/events/${eventId}`);
    const data = await response.json();
    if (!response.ok || !data.success) {
        if (response.status === 401) {
            openAuthModal('login');
            showAuthMessage(data.message);
        } else {
            window.alert(data.message || 'Unable to load this event.');
        }
        return;
    }
    selectedEvent = data.event;
    document.getElementById('eventBookingReview').classList.add('hidden');
    renderEventDetails(selectedEvent);
    document.getElementById('eventDetailsOverlay').classList.remove('hidden');
}

function closeEventDetails() {
    document.getElementById('eventDetailsOverlay').classList.add('hidden');
    selectedEvent = null;
}

function renderEventDetails(ev) {
    const content = document.getElementById('eventDetailsContent');
    content.replaceChildren();
    const cover = document.createElement('div');
    cover.className = 'event-detail-cover';
    const coverPath = ev.cover_image || ev.main_image;
    if (coverPath) {
        const image = document.createElement('img');
        image.src = `/uploads/${coverPath}`;
        image.alt = `${ev.title} cover`;
        cover.appendChild(image);
    }
    content.appendChild(cover);

    const category = document.createElement('span');
    category.className = 'hero-badge';
    category.textContent = `${ev.is_cancelled ? 'CANCELLED · ' : ''}${ev.category} · ${ev.visibility === 'PRIVATE' ? 'INVITE ONLY' : 'PUBLIC'}`;
    const title = document.createElement('h2');
    title.className = 'modal-title event-detail-title';
    title.textContent = ev.title;
    const meta = document.createElement('p');
    meta.className = 'event-detail-meta';
    meta.textContent = `${formatGatherlyDate(ev.event_date)} · ${formatGatherlyTime(ev.event_time)} · ${ev.venue} · Hosted by ${ev.organizer_name}`;
    const description = document.createElement('p');
    description.className = 'event-detail-description';
    description.textContent = ev.description || 'Join us for this Gatherly experience.';
    content.append(category, title, meta);
    if (ev.organizer_badge === 'verified_organizer') {
        const badge = document.createElement('span');
        badge.className = 'verified-badge';
        badge.textContent = '☑️ Verified organizer';
        content.appendChild(badge);
    }
    content.appendChild(description);

    if (ev.media && ev.media.length) {
        const gallery = document.createElement('div');
        gallery.className = 'event-gallery';
        ev.media.forEach(item => {
            const media = item.media_type === 'video' ? document.createElement('video') : document.createElement('img');
            media.src = `/uploads/${item.media_path}`;
            if (item.media_type === 'video') {
                media.controls = true;
                media.preload = 'metadata';
            } else {
                media.alt = `${ev.title} event gallery`;
            }
            gallery.appendChild(media);
        });
        content.appendChild(gallery);
    }

    const partners = ev.partners || [];
    if (partners.length) {
        const partnerSection = document.createElement('section');
        partnerSection.className = 'event-partners-display';
        const partnerTitle = document.createElement('h3');
        partnerTitle.textContent = 'Made possible with';
        const partnerList = document.createElement('div');
        partnerList.className = 'event-partners-list';
        partners.forEach(partner => {
            const card = document.createElement('div');
            card.className = 'event-partner-card';
            if (partner.logo_path) {
                const logo = document.createElement('img');
                logo.src = `/uploads/${partner.logo_path}`;
                logo.alt = `${partner.name} logo`;
                card.appendChild(logo);
            }
            const name = document.createElement('strong');
            name.textContent = partner.name;
            const kind = document.createElement('span');
            kind.textContent = partner.partner_type === 'EVENT PARTNER' ? 'EVENT PARTNER' : 'SPONSOR';
            card.append(name, kind);
            partnerList.appendChild(card);
        });
        partnerSection.append(partnerTitle, partnerList);
        content.appendChild(partnerSection);
    }

    const capacity = document.createElement('p');
    capacity.className = 'capacity-note';
    capacity.textContent = ev.ticket_limit === null
        ? 'Tickets: unlimited'
        : `${ev.tickets_remaining} of ${ev.ticket_limit} tickets remaining`;
    content.appendChild(capacity);
    const price = document.createElement('p');
    price.className = 'capacity-note';
    price.textContent = ev.is_paid ? `₹${Number(ev.price).toFixed(2)} per ticket` : 'Free admission';
    content.appendChild(price);

    if (ev.is_cancelled) {
        const cancelled = document.createElement('p');
        cancelled.className = 'host-cancelled-notice';
        cancelled.textContent = 'This event has been cancelled. Ticket sales and entry are disabled. Check your Gatherly event updates for details.';
        content.appendChild(cancelled);
        return;
    }

    if (ev.invitation_role === 'MANAGER' && ev.rsvp_status === 'PENDING') {
        const rsvp = document.createElement('div');
        rsvp.className = 'event-rsvp-actions';
        const accept = document.createElement('button');
        accept.className = 'btn-primary';
        accept.textContent = 'ACCEPT MANAGEMENT INVITE';
        accept.addEventListener('click', () => respondToInvitation(ev.invitation_token, 'ACCEPTED', ev.id));
        const decline = document.createElement('button');
        decline.className = 'btn-primary btn-logout';
        decline.textContent = 'DECLINE';
        decline.addEventListener('click', () => respondToInvitation(ev.invitation_token, 'DECLINED', ev.id));
        rsvp.append(accept, decline);
        content.appendChild(rsvp);
    } else if (ev.invitation_role === 'GUEST' && ev.rsvp_status !== 'ACCEPTED') {
        const rsvp = document.createElement('div');
        rsvp.className = 'event-rsvp-actions';
        const accept = document.createElement('button');
        accept.className = 'btn-primary';
        accept.textContent = 'ACCEPT INVITATION';
        accept.addEventListener('click', () => respondToInvitation(
            ev.invitation_token || document.body.dataset.invitationToken, 'ACCEPTED', ev.id
        ));
        const decline = document.createElement('button');
        decline.className = 'btn-primary btn-logout';
        decline.textContent = 'DECLINE';
        decline.addEventListener('click', () => respondToInvitation(
            ev.invitation_token || document.body.dataset.invitationToken, 'DECLINED', ev.id
        ));
        rsvp.append(accept, decline);
        content.appendChild(rsvp);
    } else if (ev.invitation_role && ev.rsvp_status === 'DECLINED') {
        const declined = document.createElement('p');
        declined.className = 'capacity-note';
        declined.textContent = 'You declined this invitation.';
        content.appendChild(declined);
    } else if (ev.invitation_role === 'MANAGER' && ev.can_manage) {
        const dashboard = document.createElement('button');
        dashboard.className = 'btn-primary';
        dashboard.textContent = 'OPEN EVENT DASHBOARD';
        dashboard.addEventListener('click', openOrganizerDashboard);
        content.appendChild(dashboard);
    } else {
        const purchase = document.createElement('div');
        purchase.className = 'event-purchase-controls';
        const quantityLabel = document.createElement('label');
        quantityLabel.textContent = 'TICKETS';
        quantityLabel.htmlFor = 'bookingQuantity';
        const quantityInput = document.createElement('input');
        quantityInput.id = 'bookingQuantity';
        quantityInput.type = 'number';
        quantityInput.min = '1';
        quantityInput.max = String(Math.min(20, ev.tickets_remaining || 20));
        quantityInput.value = '1';
        quantityInput.disabled = ev.tickets_remaining === 0;
        quantityInput.addEventListener('input', () => {
            selectedQuantity = Number(quantityInput.value);
            updateBookingEstimate();
        });
        const total = document.createElement('strong');
        total.id = 'bookingEstimate';
        const confirm = document.createElement('button');
        confirm.className = 'btn-primary';
        confirm.textContent = ev.tickets_remaining === 0 ? 'SOLD OUT' : 'CONTINUE';
        confirm.disabled = ev.tickets_remaining === 0;
        confirm.addEventListener('click', reviewBooking);
        purchase.append(quantityLabel, quantityInput, total, confirm);
        content.appendChild(purchase);
        selectedQuantity = 1;
        updateBookingEstimate();
    }
}

function updateBookingEstimate() {
    const estimate = document.getElementById('bookingEstimate');
    if (estimate && selectedEvent) {
        const price = selectedEvent.is_paid ? Number(selectedEvent.price) : 0;
        estimate.textContent = `Total: ₹${(price * selectedQuantity).toFixed(2)}`;
    }
}

function reviewBooking() {
    if (!selectedEvent || !Number.isInteger(selectedQuantity) || selectedQuantity < 1 || selectedQuantity > 20) {
        window.alert('Choose a valid ticket quantity (1–20).');
        return;
    }
    const price = selectedEvent.is_paid ? Number(selectedEvent.price) : 0;
    const review = document.getElementById('eventBookingReview');
    review.replaceChildren();
    review.classList.remove('hidden');
    const heading = document.createElement('h3');
    heading.className = 'booking-modal-ev-title';
    heading.textContent = 'Confirm your booking';
    const summary = document.createElement('p');
    summary.className = 'booking-modal-ev-detail';
    summary.textContent = `${selectedQuantity} × ${selectedEvent.title} · Total ₹${(price * selectedQuantity).toFixed(2)}`;
    const note = document.createElement('p');
    note.className = 'booking-modal-notice';
    note.textContent = selectedEvent.is_paid
        ? 'ℹ️ This is a payment request, not a confirmed ticket. The organizer must verify payment before passes are issued.'
        : '✨ Your free passes will be confirmed immediately.';
    const confirm = document.createElement('button');
    confirm.type = 'button';
    confirm.className = 'btn-primary';
    confirm.textContent = selectedEvent.is_paid ? 'REQUEST TICKETS' : 'CONFIRM BOOKING';
    confirm.addEventListener('click', confirmBooking);
    const back = document.createElement('button');
    back.type = 'button';
    back.className = 'btn-primary btn-logout';
    back.textContent = 'GO BACK';
    back.addEventListener('click', () => review.classList.add('hidden'));
    review.append(heading, summary, note, confirm, back);
    review.scrollIntoView({behavior: 'smooth', block: 'nearest'});
}

async function confirmBooking() {
    if (!selectedEvent) return;
    const response = await fetch('/api/book-ticket', {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({event_id: selectedEvent.id, quantity: selectedQuantity})
    });
    const data = await response.json();
    if (response.status === 401) {
        closeEventDetails();
        openAuthModal('login');
        showAuthMessage(data.message);
        return;
    }
    if (!response.ok || !data.success) {
        window.alert(data.message || 'Booking could not be completed.');
        return;
    }
    const content = document.getElementById('eventDetailsContent');
    content.replaceChildren();
    const title = document.createElement('h2');
    title.className = 'modal-title';
    title.textContent = data.status === 'PENDING' ? 'REQUEST SENT' : 'YOU’RE GOING!';
    const message = document.createElement('p');
    message.className = 'event-detail-description';
    message.textContent = data.message;
    content.append(title, message);
    if (data.qr_url) {
        const pass = document.createElement('div');
        pass.className = 'booking-pass-card';
        const qrWrap = document.createElement('div');
        qrWrap.className = 'booking-pass-qr-wrap';
        const qr = document.createElement('img');
        qr.className = 'saved-ticket-qr';
        qr.src = data.qr_url;
        qr.alt = 'Saved ticket QR code';
        qrWrap.appendChild(qr);

        const qrInstruction = document.createElement('p');
        qrInstruction.className = 'booking-pass-instruction';
        qrInstruction.textContent = `One QR admits ${selectedQuantity} ${selectedQuantity === 1 ? 'person' : 'people'}. Scanned one person at a time at the entrance.`;

        const downloadLink = document.createElement('a');
        downloadLink.className = 'btn-primary booking-download-btn';
        downloadLink.href = data.qr_url;
        downloadLink.download = `gatherly-pass-${selectedEvent.id}.png`;
        downloadLink.textContent = 'DOWNLOAD PASS (PNG)';

        pass.append(qrWrap, qrInstruction, downloadLink);
        content.appendChild(pass);
    }
    document.getElementById('eventBookingReview').classList.add('hidden');
    fetchEvents();
}

async function respondToInvitation(token, decision, eventId) {
    if (!token) {
        window.alert('Open the invitation link from your email to RSVP.');
        return;
    }
    const response = await fetch(`/api/invitations/${encodeURIComponent(token)}/respond`, {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({decision})
    });
    const data = await response.json();
    if (!response.ok || !data.success) {
        window.alert(data.message || 'Unable to update your RSVP.');
        if (response.status === 401) openAuthModal('login');
        return;
    }
    await openEventDetails(eventId);
}

async function openInvitation(token) {
    const response = await fetch('/api/invitations/lookup/' + encodeURIComponent(token));
    const data = await response.json();
    if (!response.ok || !data.success) {
        window.alert(data.message || 'This invitation is unavailable.');
        return;
    }
    if (!data.signed_in) {
        openAuthModal('login');
        showAuthMessage(`Sign in as ${data.email} to view your invitation.`);
        return;
    }
    window.location.assign(`/events/${data.public_id}`);
}

function openCreateEventModal() { document.getElementById('eventModalOverlay').classList.remove('hidden'); }
function closeCreateEventModal() { document.getElementById('eventModalOverlay').classList.add('hidden'); }
function togglePriceInput(isPaidVal) {
    document.getElementById('priceGroup').classList.toggle('hidden', isPaidVal !== 'true');
}

async function handleCreateEvent(event) {
    event.preventDefault();
    const formData = new FormData();
    formData.append('title', document.getElementById('evTitle').value);
    formData.append('category', document.getElementById('evCategory').value);
    formData.append('visibility', document.getElementById('evVisibility').value);
    formData.append('is_paid', document.getElementById('evIsPaid').value);
    formData.append('price', document.getElementById('evPrice').value);
    formData.append('ticket_limit', document.getElementById('evCapacity').value);
    formData.append('event_date', document.getElementById('evDate').value);
    formData.append('event_time', document.getElementById('evTime').value);
    formData.append('venue', document.getElementById('evVenue').value);
    formData.append('city', document.getElementById('evCity').value.trim());
    formData.append('description', document.getElementById('evDescription').value);
    formData.append('publish_at', document.getElementById('evPublishAt').value);
    formData.append('ticket_sales_start_at', document.getElementById('evSalesStartAt').value);
    const tierRows = Array.from(document.querySelectorAll('#eventTierRows .tier-form-row'));
    const tiers = [];
    for (const row of tierRows) {
        const values = Object.fromEntries(Array.from(row.querySelectorAll('[data-tier-field]'))
            .map(input => [input.dataset.tierField, input]));
        const name = values.name.value.trim();
        if (!name && !values.price.value && !values.capacity.value && !values.image.files[0]) continue;
        if (!name || !values.price.value || !values.capacity.value) {
            window.alert('Complete the name, price, and capacity for each ticket tier, or leave the row empty.');
            return;
        }
        const tierIndex = tiers.length;
        tiers.push({name, price: Number(values.price.value), capacity: Number(values.capacity.value)});
        if (values.image.files[0]) formData.append(`tier_image_${tierIndex}`, values.image.files[0]);
    }
    formData.append('tiers', JSON.stringify(tiers));
    if (tiers.length) {
        formData.set('ticket_limit', String(tiers.reduce((sum, tier) => sum + tier.capacity, 0)));
    }
    if(document.getElementById('evMainImg').files[0]) {
        formData.append('main_image', document.getElementById('evMainImg').files[0]);
    }
    if(document.getElementById('evCoverImg').files[0]) {
        formData.append('cover_image', document.getElementById('evCoverImg').files[0]);
    }
    if(document.getElementById('evVideo').files[0]) {
        const vid = document.getElementById('evVideo').files[0];
        if (vid.size > 30 * 1024 * 1024) {
            showFloatingAlert('Teaser video size exceeds 30MB limit. Please upload a compressed video under 30MB.', 'error');
            return;
        }
        formData.append('video_file', vid);
    }
    let partnerIndex = 0;
    document.querySelectorAll('#eventPartnerRows .event-partner-form-row').forEach(row => {
        const name = row.querySelector('[name="partner_name"]').value.trim();
        const type = row.querySelector('[name="partner_type"]').value;
        const logo = row.querySelector('[name="partner_logo"]').files[0];
        if (!name && !logo) return;
        formData.append('partner_name', name);
        formData.append('partner_type', type);
        if (logo) formData.append(`partner_logo_${partnerIndex}`, logo);
        partnerIndex += 1;
    });
    Array.from(document.getElementById('evGalleryImages').files).forEach(file => {
        formData.append('gallery_images', file);
    });

    const res = await fetch('/api/events/create', { method: 'POST', body: formData });
    const data = await res.json();
    if (data.success) {
        closeCreateEventModal();
        fetchEvents();
        openOrganizerDashboard();
    } else {
        window.alert(data.message || 'Could not create this event.');
    }
}

function appendText(parent, tag, text, className = '') {
    const element = document.createElement(tag);
    element.textContent = text;
    if (className) element.className = className;
    parent.appendChild(element);
    return element;
}

async function openOrganizerDashboard() {
    window.location.assign('/host/dashboard');
}

function renderDashboardInvitations(invitations) {
    const list = document.getElementById('dashboardInvitations');
    list.replaceChildren();
    if (!invitations.length) {
        appendText(list, 'p', 'No invitations yet.', 'empty-state');
        return;
    }
    invitations.forEach(invite => {
        const card = document.createElement('article');
        card.className = 'dashboard-card';
        appendText(card, 'h4', invite.title);
        appendText(card, 'p', `${formatGatherlyDate(invite.event_date)} · ${invite.venue}`);
        appendText(card, 'p', `${invite.role === 'MANAGER' ? 'Management invite' : 'Guest invite'} · ${invite.status}`);
        if (invite.status === 'PENDING') {
            const actions = document.createElement('div');
            actions.className = 'dashboard-actions';
            ['ACCEPTED', 'DECLINED'].forEach(decision => {
                const button = document.createElement('button');
                button.className = decision === 'ACCEPTED' ? 'btn-primary' : 'btn-primary btn-logout';
                button.textContent = decision === 'ACCEPTED' ? 'ACCEPT / RSVP YES' : 'DECLINE';
                button.addEventListener('click', async () => {
                    const response = await fetch(`/api/invitations/${encodeURIComponent(invite.invitation_token)}/respond`, {
                        method: 'POST',
                        headers: {'Content-Type': 'application/json'},
                        body: JSON.stringify({decision})
                    });
                    const data = await response.json();
                    if (!response.ok || !data.success) {
                        window.alert(data.message || 'Unable to update invitation.');
                        return;
                    }
                    openOrganizerDashboard();
                    loadInvitationCount();
                });
                actions.appendChild(button);
            });
            card.appendChild(actions);
        }
        list.appendChild(card);
    });
}

function renderDashboardEvents(events) {
    const list = document.getElementById('dashboardEvents');
    list.replaceChildren();
    if (!events.length) {
        appendText(list, 'p', 'You have not created or joined an event yet.', 'empty-state');
        return;
    }
    events.forEach(ev => {
        const card = document.createElement('article');
        card.className = 'dashboard-card organizer-event-card';
        appendText(card, 'h3', ev.title);
        appendText(card, 'p', `${formatGatherlyDate(ev.event_date)} · ${formatGatherlyTime(ev.event_time)} · ${ev.venue}`);
        const remaining = ev.ticket_limit === null
            ? `${ev.tickets_reserved} tickets reserved · unlimited capacity`
            : `${ev.tickets_reserved} / ${ev.ticket_limit} tickets reserved`;
        appendText(card, 'p', remaining, 'capacity-note');
        const openEvent = document.createElement('a');
        openEvent.className = 'back-link';
        openEvent.href = `/events/${ev.public_id}`;
        openEvent.textContent = 'Open event page →';
        card.appendChild(openEvent);

        const inviteForm = document.createElement('form');
        inviteForm.className = 'invite-form';
        const emailInput = document.createElement('input');
        emailInput.type = 'email';
        emailInput.placeholder = 'Invite by email';
        emailInput.required = true;
        const roleSelect = document.createElement('select');
        [['GUEST', 'Guest RSVP'], ['MANAGER', 'Event manager']].forEach(([value, label]) => {
            if (value === 'MANAGER' && !ev.owner) return;
            const option = document.createElement('option');
            option.value = value;
            option.textContent = label;
            roleSelect.appendChild(option);
        });
        const inviteButton = document.createElement('button');
        inviteButton.type = 'submit';
        inviteButton.className = 'btn-primary';
        inviteButton.textContent = 'SEND INVITE';
        inviteForm.append(emailInput, roleSelect, inviteButton);
        inviteForm.addEventListener('submit', async event => {
            event.preventDefault();
            const response = await fetch(`/api/events/${ev.id}/invitations`, {
                method: 'POST',
                headers: {'Content-Type': 'application/json'},
                body: JSON.stringify({email: emailInput.value, role: roleSelect.value})
            });
            const data = await response.json();
            window.alert(data.invite_url ? `${data.message}\nShare this invitation link manually: ${data.invite_url}` : (data.message || 'Invitation could not be sent.'));
            if (data.success) openOrganizerDashboard();
        });
        card.appendChild(inviteForm);

        appendText(card, 'h4', 'Bookings');
        const bookings = document.createElement('div');
        bookings.className = 'dashboard-list';
        if (!ev.bookings.length) appendText(bookings, 'p', 'No bookings yet.', 'empty-state');
        ev.bookings.forEach(booking => {
            const bookingCard = document.createElement('div');
            bookingCard.className = 'booking-row';
            appendText(bookingCard, 'span',
                `${booking.full_name} · ${booking.quantity} guest(s) · ${booking.admitted_count} admitted · ${booking.status} · payment ${booking.payment_status}`);
            if (booking.status === 'PENDING') {
                const actions = document.createElement('div');
                actions.className = 'dashboard-actions';
                [['CONFIRM_PAYMENT', 'CONFIRM PAYMENT'], ['REJECT', 'REJECT']].forEach(([decision, label]) => {
                    const button = document.createElement('button');
                    button.type = 'button';
                    button.className = decision === 'REJECT' ? 'btn-primary btn-logout' : 'btn-primary';
                    button.textContent = label;
                    button.addEventListener('click', async () => {
                        const response = await fetch(`/api/organizer/bookings/${booking.id}/decision`, {
                            method: 'POST',
                            headers: {'Content-Type': 'application/json'},
                            body: JSON.stringify({decision})
                        });
                        const data = await response.json();
                        if (!response.ok || !data.success) {
                            window.alert(data.message || 'Could not update booking.');
                            return;
                        }
                        openOrganizerDashboard();
                    });
                    actions.appendChild(button);
                });
                bookingCard.appendChild(actions);
            }
            bookings.appendChild(bookingCard);
        });
        card.appendChild(bookings);
        appendText(card, 'h4', 'Team');
        ev.team.forEach(member => {
            appendText(card, 'p', `${member.email} · ${member.status}`);
        });
        ev.invitations.forEach(invite => {
            appendText(card, 'p', `${invite.email} · ${invite.role} invite · ${invite.status}`);
        });
        list.appendChild(card);
    });
}

async function openPasses() {
    const overlay = document.getElementById('passesOverlay');
    overlay.classList.remove('hidden');
    const response = await fetch('/api/my-passes');
    const data = await response.json();
    const list = document.getElementById('myPassesList');
    list.replaceChildren();
    if (!response.ok || !data.success) {
        appendText(list, 'p', data.message || 'Unable to load passes.', 'empty-state');
        return;
    }

    const moviePasses = data.movie_passes || [];
    if (!data.bookings.length && !moviePasses.length) {
        appendText(list, 'p', 'Your passes will appear here after booking.', 'empty-state');
        return;
    }
    data.bookings.forEach(booking => {
        const card = document.createElement('article');
        card.className = 'dashboard-card';
        appendText(card, 'h3', booking.title);
        appendText(card, 'p', `${formatGatherlyDate(booking.event_date)} · ${formatGatherlyTime(booking.event_time)} · ${booking.venue}${booking.is_cancelled ? ' · EVENT CANCELLED' : ''}`);
        appendText(card, 'p', `${booking.is_cancelled ? 'CANCELLED EVENT · ' : ''}${booking.quantity} guest(s)${booking.tier_name ? ` · ${booking.tier_name}` : ''} · ${booking.admitted_count} admitted · ${booking.status} · payment ${booking.payment_status}`);
        if (booking.qr_url) {
            const pass = document.createElement('div');
            pass.className = 'ticket-pass';
            const image = document.createElement('img');
            image.src = booking.qr_url;
            image.alt = 'Your saved Gatherly ticket QR';
            image.loading = 'lazy';
            pass.appendChild(image);
            const caption = document.createElement('span');
            caption.className = 'ticket-pass-caption';
            caption.textContent = 'One QR · scan once per guest';
            pass.appendChild(caption);
            const download = document.createElement('a');
            download.className = 'btn-primary btn-logout ticket-qr-download';
            download.href = booking.qr_url;
            download.download = `gatherly-pass-${booking.booking_id}.png`;
            download.textContent = 'DOWNLOAD QR';
            pass.appendChild(download);
            card.appendChild(pass);
        }
        const calendarButton = document.createElement('button');
        calendarButton.className = 'btn-primary btn-logout calendar-add-button';
        calendarButton.type = 'button';
        calendarButton.textContent = 'ADD TO CALENDAR';
        calendarButton.addEventListener('click', () => downloadCalendarEvent(booking));
        card.appendChild(calendarButton);
        list.appendChild(card);
    });
    if (moviePasses.length) {
        appendText(list, 'h3', 'MOVIE TICKETS', 'section-kicker');
        moviePasses.forEach(ticket => {
            const card = document.createElement('article');
            card.className = 'dashboard-card';
            appendText(card, 'h3', ticket.title);
            appendText(card, 'p', `${formatGatherlyDateTime(ticket.starts_at)} · ${ticket.theatre_name} · ${ticket.screen_name} · Seats ${ticket.seats}`);
            appendText(card, 'p', `${ticket.status} · payment ${ticket.payment_status} · ${ticket.admitted_count} admitted`);
            if (ticket.qr_url) {
                const pass = document.createElement('div');
                pass.className = 'ticket-pass';
                const image = document.createElement('img');
                image.src = ticket.qr_url;
                image.alt = 'Your Gatherly movie ticket QR';
                image.loading = 'lazy';
                image.width = 220;
                image.height = 220;
                pass.appendChild(image);
                const caption = document.createElement('span');
                caption.className = 'ticket-pass-caption';
                caption.textContent = 'Movie ticket · one QR for the selected seats; scan once per person';
                pass.appendChild(caption);
                const download = document.createElement('a');
                download.className = 'btn-primary btn-logout ticket-qr-download';
                download.href = ticket.qr_url;
                download.download = `gatherly-movie-pass-${ticket.reservation_id}.png`;
                download.textContent = 'DOWNLOAD MOVIE QR';
                pass.appendChild(download);
                card.appendChild(pass);
            }
            list.appendChild(card);
        });
    }
}

async function openWishlist() {
    if (document.body.dataset.isSignedIn !== 'true') {
        openAuthModal('login');
        return;
    }
    const overlay = document.getElementById('wishlistOverlay');
    const list = document.getElementById('wishlistEvents');
    overlay.classList.remove('hidden');
    list.replaceChildren();
    appendText(list, 'p', 'Loading your wishlist…', 'empty-state');
    const response = await fetch('/api/my-wishlist');
    const data = await response.json();
    list.replaceChildren();
    if (!response.ok || !data.success) {
        appendText(list, 'p', data.message || 'Your wishlist could not be loaded.', 'empty-state');
        return;
    }
    if (!data.events.length) {
        appendText(list, 'p', 'Your wishlist is empty. Save an event to keep it close.', 'empty-state');
        return;
    }
    data.events.forEach(event => {
        const card = document.createElement('article');
        card.className = 'dashboard-card organizer-event-card';
        const imagePath = event.cover_image || event.main_image;
        if (imagePath) {
            const image = document.createElement('img');
            image.src = `/uploads/${imagePath}`;
            image.alt = `${event.title} cover`;
            image.className = 'wishlist-event-image';
            card.appendChild(image);
        }
        appendText(card, 'h3', event.title);
        appendText(card, 'p', `${formatGatherlyDate(event.event_date)} · ${event.city} · ${event.venue}`);
        appendText(card, 'p', event.tickets_on_sale
            ? (event.tickets_remaining === 0 ? 'Sold out · Join the ticket waitlist' : 'Tickets are on sale')
            : `Tickets open ${event.ticket_sales_start_at ? formatGatherlyDateTime(event.ticket_sales_start_at) : 'soon'}`, 'capacity-note');
        const actions = document.createElement('div');
        actions.className = 'dashboard-actions';
        const open = document.createElement('a');
        open.className = 'btn-primary';
        open.href = `/events/${event.public_id}`;
        open.textContent = 'OPEN EVENT';
        const remove = document.createElement('button');
        remove.className = 'btn-primary btn-logout';
        remove.type = 'button';
        remove.textContent = 'REMOVE';
        remove.addEventListener('click', async () => {
            const result = await fetch(`/api/events/${event.id}/wishlist`, {method: 'DELETE'});
            const removed = await result.json();
            if (!result.ok || !removed.success) {
                window.alert(removed.message || 'Could not remove this event.');
                return;
            }
            openWishlist();
        });
        actions.append(open, remove);
        card.appendChild(actions);
        list.appendChild(card);
    });
}

function openAuthModal(view = 'login') {
    clearAuthMessage();
    switchAuthView(view);
    document.getElementById('authModalOverlay').classList.remove('hidden');
}
function closeAuthModal() { document.getElementById('authModalOverlay').classList.add('hidden'); }

function switchAuthView(view) {
    document.getElementById('viewLogin').classList.add('hidden');
    document.getElementById('viewSignup').classList.add('hidden');
    document.getElementById('viewReset').classList.add('hidden');
    document.getElementById('viewVerify').classList.add('hidden');
    clearAuthMessage();

    if (view === 'login') document.getElementById('viewLogin').classList.remove('hidden');
    if (view === 'signup') document.getElementById('viewSignup').classList.remove('hidden');
    if (view === 'reset') {
        document.getElementById('viewReset').classList.remove('hidden');
        document.getElementById('resetRequestForm').classList.remove('hidden');
        document.getElementById('resetConfirmForm').classList.add('hidden');
    }
    if (view === 'verify') document.getElementById('viewVerify').classList.remove('hidden');
}

function showAuthMessage(message, type = 'error') {
    const alert = document.getElementById('modalAlert');
    alert.textContent = message;
    alert.className = `alert-box ${type}`;
}

function clearAuthMessage() {
    const alert = document.getElementById('modalAlert');
    if (alert) {
        alert.textContent = '';
        alert.className = 'alert-box hidden';
    }
}

async function readAuthResponse(response) {
    const data = await response.json();
    if (!response.ok || !data.success) {
        showAuthMessage(data.message || 'Something went wrong. Please try again.');
        return null;
    }
    return data;
}

async function handleLogin(event) {
    event.preventDefault();
    clearAuthMessage();
    const res = await fetch('/api/login', {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({
            email: document.getElementById('loginEmail').value,
            password: document.getElementById('loginPassword').value
        })
    });
    const data = await readAuthResponse(res);
    if (!data) return;
    const next = new URLSearchParams(window.location.search).get('next');
    if (next && next.startsWith('/') && !next.startsWith('//')) {
        window.location.assign(next);
    } else {
        window.location.reload();
    }
}

async function handleSignup(event) {
    event.preventDefault();
    clearAuthMessage();
    const res = await fetch('/api/signup', {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({
            full_name: document.getElementById('signupName').value,
            email: document.getElementById('signupEmail').value,
            password: document.getElementById('signupPassword').value
        })
    });
    const data = await readAuthResponse(res);
    if (!data) return;
    pendingAuthEmail = data.email;
    pendingAuthPurpose = 'signup_verification';
    document.getElementById('verifyEmailLabel').textContent = pendingAuthEmail;
    document.getElementById('authOtp').value = '';
    switchAuthView('verify');
    showAuthMessage(data.message, 'success');
}

async function handleVerifyOtp(event) {
    event.preventDefault();
    clearAuthMessage();
    const res = await fetch('/api/verify-otp', {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({
            email: pendingAuthEmail,
            purpose: pendingAuthPurpose,
            otp: document.getElementById('authOtp').value
        })
    });
    const data = await readAuthResponse(res);
    if (data) {
        const next = new URLSearchParams(window.location.search).get('next');
        if (next && next.startsWith('/') && !next.startsWith('//')) {
            window.location.assign(next);
        } else {
            window.location.reload();
        }
    }
}

async function handleRequestReset(event) {
    event.preventDefault();
    clearAuthMessage();
    const res = await fetch('/api/request-password-reset', {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({ email: document.getElementById('resetEmail').value })
    });
    const data = await readAuthResponse(res);
    if(data) {
        document.getElementById('resetRequestForm').classList.add('hidden');
        document.getElementById('resetConfirmForm').classList.remove('hidden');
        showAuthMessage(data.message, 'success');
    }
}

async function handleConfirmReset(event) {
    event.preventDefault();
    clearAuthMessage();
    const res = await fetch('/api/reset-password', {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({
            email: document.getElementById('resetEmail').value,
            otp: document.getElementById('resetOtp').value,
            new_password: document.getElementById('resetNewPassword').value
        })
    });
    const data = await readAuthResponse(res);
    if(data) {
        switchAuthView('login');
        showAuthMessage(data.message, 'success');
    }
}

async function handleLogout() {
    const response = await fetch('/api/logout', { method: 'POST' });
    if (response.ok) window.location.reload();
}