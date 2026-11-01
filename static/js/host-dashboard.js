let hostEvents = [];
let newlyCreatedGateCredentials = null;

document.addEventListener('DOMContentLoaded', () => {
    document.getElementById('newEventAssistant').replaceChildren(renderNewEventAssistant());
    loadHostDashboard();
});

function node(tag, className = '', text = '') {
    const element = document.createElement(tag);
    if (className) element.className = className;
    if (text !== undefined && text !== '') element.textContent = text;
    return element;
}

function setHostNotice(message, isError = false) {
    const notice = document.getElementById('hostNotice');
    notice.textContent = message;
    notice.classList.toggle('hidden', !message);
    notice.classList.toggle('error', isError);
    if (message && isError) window.alert(message);
}

async function apiRequest(path, options = {}) {
    const response = await fetch(path, options);
    const contentType = response.headers.get('content-type') || '';
    if (!contentType.includes('application/json')) {
        const message = response.status === 404
            ? 'The server returned 404. Restart Gatherly so it loads the latest API routes, then try again.'
            : `The server returned a non-JSON response (HTTP ${response.status}).`;
        throw new Error(message);
    }
    const result = await response.json();
    if (!response.ok || !result.success) {
        if (response.status === 401) {
            window.location.assign('/?auth=login&next=%2Fhost%2Fdashboard');
        }
        throw new Error(result.message || 'The request could not be completed.');
    }
    return result;
}

async function loadHostDashboard() {
    setHostNotice('');
    const eventsContainer = document.getElementById('hostEventList');
    eventsContainer.replaceChildren(node('p', 'empty-state', 'Loading your host workspace…'));
    try {
        const eventsData = await apiRequest('/api/organizer/events');
        hostEvents = eventsData.events || [];
        renderHostSummary(hostEvents);
        renderHostEvents(hostEvents);
        const requestedEvent = new URLSearchParams(window.location.search).get('event');
        const selectedEvent = hostEvents.find(item =>
            item.public_id === requestedEvent || String(item.id) === requestedEvent
        );
        if (selectedEvent) openHostEvent(selectedEvent.id);
    } catch (error) {
        setHostNotice(error.message, true);
        eventsContainer.replaceChildren(node('p', 'empty-state', 'Your workspace could not be loaded.'));
    }
}

function renderNewEventAssistant() {
    const section = node('section', 'host-ai-assistant host-ai-new-event');
    section.append(
        node('span', 'section-kicker', 'GATHERLY AI'),
        node('h3', '', 'Draft a new event'),
        node('p', 'host-muted', 'Describe the event in plain language. Review the draft before creating it. AI-created events start free with unlimited capacity; add ticket tiers, artwork, and partners from Manage Event.')
    );
    const examples = node('div', 'host-ai-examples');
    [
        'Create a public indie music night in Delhi on 20 December 2026 at 7 PM.',
        'Draft an invite-only community workshop in Pune for 5 November 2026.'
    ].forEach(prompt => {
        const button = node('button', 'host-ai-example', prompt);
        button.type = 'button';
        button.addEventListener('click', () => { input.value = prompt; input.focus(); });
        examples.appendChild(button);
    });

    const messages = node('div', 'host-ai-messages');
    messages.setAttribute('aria-live', 'polite');
    const privacy = node('p', 'host-ai-privacy',
        'Your prompt is sent to Google Gemini to prepare the draft. Chat history is not sent or stored. Do not include passwords or payment details.');
    const form = node('form', 'host-ai-form');
    const input = document.createElement('textarea');
    input.name = 'prompt';
    input.maxLength = 1200;
    input.rows = 2;
    input.required = true;
    input.placeholder = 'Include the event name, category, date, time, city, venue, and who can attend…';
    input.setAttribute('aria-label', 'Describe the event to draft');
    const submit = node('button', 'btn-primary', 'DRAFT EVENT');
    submit.type = 'submit';
    form.append(input, submit);
    const draft = node('article', 'host-ai-event-draft hidden');
    const create = node('button', 'btn-primary host-ai-apply hidden', 'CREATE THIS EVENT');
    create.type = 'button';
    create.disabled = true;
    let proposedAction = null;
    let hostDraftHistory = [];
    let hostDraftState = {};

    const message = (text, role) => {
        messages.appendChild(node('p', `host-ai-message ${role}`, text));
        while (messages.children.length > 6) messages.removeChild(messages.firstChild);
        messages.scrollTop = messages.scrollHeight;
    };

    form.addEventListener('submit', async submitEvent => {
        submitEvent.preventDefault();
        const prompt = input.value.trim();
        if (!prompt) return;
        message(prompt, 'user');
        input.value = '';
        submit.disabled = true;
        draft.replaceChildren();
        draft.classList.add('hidden');
        create.classList.add('hidden');
        proposedAction = null;
        message('Drafting your event…', 'assistant pending');
        try {
            const result = await apiRequest('/api/organizer/assistant/event-draft', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    prompt,
                    history: hostDraftHistory,
                    draft_state: hostDraftState
                })
            });
            messages.lastChild.remove();
            message(result.reply, 'assistant');
            hostDraftHistory.push({ role: 'user', text: prompt });
            hostDraftHistory.push({ role: 'assistant', text: result.reply });
            if (result.draft_state) {
                hostDraftState = Object.assign(hostDraftState, result.draft_state);
            }
            if (result.action && result.action.fields) {
                hostDraftState = Object.assign(hostDraftState, result.action.fields);
                proposedAction = result.action;
                const fields = result.action.fields;
                draft.append(
                    node('h4', '', fields.title),
                    node('p', '', `${fields.category} · ${formatGatherlyDate(fields.event_date)} · ${formatGatherlyTime(fields.event_time)}`),
                    node('p', '', `${fields.venue}, ${fields.city} · ${fields.visibility === 'PRIVATE' ? 'Invite only' : 'Public'}`),
                    node('p', '', fields.description || 'No description yet.')
                );
                draft.classList.remove('hidden');
                create.classList.remove('hidden');
                create.disabled = false;
            }
        } catch (error) {
            messages.lastChild.remove();
            message(error.message || 'The assistant could not draft this event.', 'assistant error');
        } finally {
            submit.disabled = false;
        }
    });

    create.addEventListener('click', async () => {
        if (!proposedAction || !window.confirm('Create this event with the details shown above?')) return;
        create.disabled = true;
        try {
            const result = await apiRequest('/api/organizer/assistant/event-draft/apply', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ action: proposedAction })
            });
            window.location.assign(`/host/dashboard?event=${encodeURIComponent(result.public_id)}`);
        } catch (error) {
            create.disabled = false;
            message(error.message || 'Could not create this event.', 'assistant error');
        }
    });

    section.append(examples, messages, privacy, form, draft, create);
    return section;
}

function renderHostSummary(events) {
    const bookings = events.flatMap(event => event.bookings || []);
    const values = [
        events.length,
        bookings.filter(booking => booking.status === 'CONFIRMED')
            .reduce((sum, booking) => sum + Number(booking.quantity), 0),
        bookings.reduce((sum, booking) => sum + Number(booking.admitted_count || 0), 0),
        bookings.filter(booking => booking.status === 'PENDING').length
    ];
    document.getElementById('hostSummary').replaceChildren(...[
        ['EVENTS', values[0]],
        ['CONFIRMED GUESTS', values[1]],
        ['PEOPLE ADMITTED', values[2]],
        ['NEEDS ATTENTION', values[3]]
    ].map(([label, value]) => {
        const card = node('article', 'host-summary-card');
        card.append(node('span', '', label), node('strong', '', String(value)));
        return card;
    }));
}

function renderHostEvents(events) {
    const list = document.getElementById('hostEventList');
    const selected = document.getElementById('hostSelectedEvent');
    selected.classList.add('hidden');
    selected.replaceChildren();
    list.classList.remove('hidden');
    list.replaceChildren();
    if (!events.length) {
        list.appendChild(node('p', 'empty-state', 'You have not created or joined an event yet.'));
        return;
    }
    events.forEach(event => {
        const card = node('article', 'host-event-card');
        const heading = node('div', 'host-event-heading');
        const details = node('div');
        details.append(
            node('span', 'section-kicker', event.is_cancelled
                ? 'CANCELLED EVENT' : (event.owner ? 'EVENT OWNER' : 'EVENT TEAM')),
            node('h2', '', event.title),
            node('p', 'host-event-meta', `${formatGatherlyDate(event.event_date)} · ${formatGatherlyTime(event.event_time)} · ${event.venue}, ${event.city}`)
        );
        const manage = node('button', 'btn-primary', 'MANAGE EVENT');
        manage.type = 'button';
        manage.addEventListener('click', () => openHostEvent(event.id));
        heading.append(details, manage);
        card.appendChild(heading);
        list.appendChild(card);
    });
}

function openHostEvent(eventId) {
    const event = hostEvents.find(item =>
        Number(item.id) === Number(eventId) || item.public_id === String(eventId)
    );
    if (!event) return;
    const list = document.getElementById('hostEventList');
    const selected = document.getElementById('hostSelectedEvent');
    const back = node('button', 'btn-primary btn-logout', '← ALL EVENTS');
    back.type = 'button';
    back.addEventListener('click', () => {
        selected.classList.add('hidden');
        list.classList.remove('hidden');
    });
    selected.replaceChildren(back, renderHostEvent(event));
    list.classList.add('hidden');
    selected.classList.remove('hidden');
    selected.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

function renderHostEvent(event) {
    const card = node('article', 'host-event-card');
    const heading = node('div', 'host-event-heading');
    const details = node('div');
    details.append(
        node('span', 'section-kicker', event.owner ? 'EVENT OWNER' : 'EVENT TEAM'),
        node('h2', '', event.title),
        node('p', 'host-event-meta', `${formatGatherlyDate(event.event_date)} · ${formatGatherlyTime(event.event_time)} · ${event.venue}, ${event.city}`)
    );
    const open = node('a', 'btn-primary btn-logout', 'VIEW EVENT PAGE');
    open.href = `/events/${event.public_id}`;
    heading.append(details, open);
    if (event.is_cancelled) {
        card.appendChild(node('p', 'host-cancelled-notice', 'This event is cancelled. Attendee history is retained and ticket entry is disabled.'));
    } else {
        const cancel = node('button', 'btn-primary host-danger-button', 'CANCEL / REMOVE EVENT');
        cancel.type = 'button';
        cancel.addEventListener('click', () => cancelManagedEvent(event.id));
        heading.appendChild(cancel);
    }
    card.appendChild(heading);

    const bookings = event.bookings || [];
    const confirmed = bookings.filter(booking => booking.status === 'CONFIRMED');
    const stats = node('div', 'host-event-stats');
    [
        ['Reserved', bookings.reduce((sum, booking) => sum + Number(booking.quantity), 0)],
        ['Confirmed', confirmed.reduce((sum, booking) => sum + Number(booking.quantity), 0)],
        ['Admitted', bookings.reduce((sum, booking) => sum + Number(booking.admitted_count || 0), 0)],
        ['Pending', bookings.filter(booking => booking.status === 'PENDING').length]
    ].forEach(([label, value]) => {
        const item = node('div', 'host-stat');
        item.append(node('span', '', label), node('strong', '', String(value)));
        stats.appendChild(item);
    });
    card.appendChild(stats);
    const schedule = node('p', 'host-muted',
        `Publication: ${event.publish_at ? formatGatherlyDateTime(event.publish_at) : 'Immediate'} · Ticket sales: ${event.ticket_sales_start_at ? formatGatherlyDateTime(event.ticket_sales_start_at) : 'Immediate'}`);
    card.appendChild(schedule);
    if (event.tiers?.length) {
        const tierSummary = node('div', 'host-event-stats');
        event.tiers.forEach(tier => {
            const item = node('div', 'host-stat');
            item.append(
                node('span', '', `${tier.name} · ₹${Number(tier.price).toFixed(2)}`),
                node('strong', '', `${tier.tickets_remaining} / ${tier.capacity}`)
            );
            if (tier.image_path) {
                const image = node('img', 'host-tier-image');
                image.src = `/uploads/${tier.image_path}`;
                image.alt = `${tier.name} seating plan`;
                item.appendChild(image);
            }
            tierSummary.appendChild(item);
        });
        card.appendChild(tierSummary);
    }
    if (event.owner && !event.is_cancelled) {
        card.appendChild(renderEventEditor(event));
        card.appendChild(renderEventMediaEditor(event));
        card.appendChild(renderEventPartnersEditor(event));
        card.appendChild(renderTierEditor(event));
    }
    if (!event.is_cancelled) {
        card.appendChild(renderAnnouncementTool(event));
        card.appendChild(renderEventWorkspace(event));
        card.appendChild(renderInviteTools(event));
        card.appendChild(renderPeople(event));
    }
    card.appendChild(renderBookings(event));
    card.appendChild(renderWaitlist(event));
    if (event.owner && !event.is_cancelled) card.appendChild(renderGateAccounts(event));
    return card;
}

function renderEventWorkspace(event) {
    const details = node('details', 'host-subsection host-event-workspace');
    const summary = node('summary', '', 'Planning: tasks, budget, venues, vendors & analytics');
    const content = node('div', 'host-workspace-content');
    details.append(summary, content);
    details.addEventListener('toggle', async () => {
        if (!details.open || details.dataset.loaded === 'true') return;
        details.dataset.loaded = 'true';
        content.replaceChildren(node('p', 'host-muted', 'Loading event planning workspace…'));
        try {
            const data = await apiRequest(`/api/organizer/events/${event.id}/workspace`);
            renderEventWorkspaceData(event, data, content);
        } catch (error) {
            details.dataset.loaded = 'false';
            content.replaceChildren(node('p', 'host-muted', error.message));
            window.alert(error.message);
        }
    });
    return details;
}

function renderEventWorkspaceData(event, data, content) {
    content.replaceChildren();
    const metrics = data.analytics;
    const stats = node('div', 'host-event-stats');
    [
        ['Confirmed guests', metrics.confirmed_guests],
        ['Admitted', metrics.admitted_guests],
        ['Pending guests', metrics.pending_guests],
        ['Confirmed revenue', `₹${Number(metrics.confirmed_revenue).toFixed(2)}`],
        ['Actual expenses', `₹${Number(metrics.actual_expenses).toFixed(2)}`]
    ].forEach(([label, value]) => {
        const stat = node('div', 'host-stat');
        stat.append(node('span', '', label), node('strong', '', String(value)));
        stats.appendChild(stat);
    });
    content.appendChild(stats);
    content.appendChild(renderHostAnalytics(metrics, data.budget));
    content.appendChild(renderPlannerAssistant(event, data, content));

    const tasks = node('section', 'host-workspace-group');
    tasks.appendChild(node('h4', '', 'Tasks'));
    const taskForm = document.createElement('form');
    taskForm.className = 'host-workspace-form';
    const taskTitle = workspaceInput('Task title', 'title', true);
    const dueAt = workspaceInput('Due date', 'due_at', false, 'date');
    const taskDetails = workspaceInput('Details', 'details', false);
    const assign = document.createElement('select');
    assign.name = 'assigned_to';
    const unassigned = node('option', '', 'Unassigned');
    unassigned.value = '';
    assign.appendChild(unassigned);
    const selfOption = node('option', '', 'Me');
    selfOption.value = 'self';
    assign.appendChild(selfOption);
    data.team.forEach(member => {
        const option = node('option', '', member.full_name);
        option.value = String(member.id);
        assign.appendChild(option);
    });
    taskForm.append(taskTitle, taskDetails, dueAt, assign, workspaceSubmit('ADD TASK'));
    taskForm.addEventListener('submit', async action => {
        action.preventDefault();
        const formData = new FormData(taskForm);
        try {
            await saveWorkspaceItem(event.id, {
                kind: 'task',
                title: formData.get('title'),
                details: formData.get('details'),
                due_at: formData.get('due_at'),
                assigned_to: formData.get('assigned_to')
            }, content);
        } catch (error) {
            setHostNotice(error.message, true);
        }
    });
    tasks.appendChild(taskForm);
    data.tasks.forEach(task => {
        const row = node('div', 'host-workspace-row');
        const label = `${task.title}${task.assigned_name ? ` · ${task.assigned_name}` : ''}${task.due_at ? ` · due ${formatGatherlyDate(task.due_at)}` : ''}`;
        row.appendChild(node('span', '', label));
        const status = document.createElement('select');
        [['OPEN', 'Open'], ['IN_PROGRESS', 'In progress'], ['DONE', 'Done']].forEach(([value, text]) => {
            const option = node('option', '', text);
            option.value = value;
            option.selected = task.status === value;
            status.appendChild(option);
        });
        status.addEventListener('change', async () => {
            try {
                await saveWorkspaceItem(event.id, { kind: 'task_status', task_id: task.id, status: status.value }, content);
            } catch (error) {
                setHostNotice(error.message, true);
            }
        });
        row.appendChild(status);
        tasks.appendChild(row);
    });
    content.appendChild(tasks);

    const budget = node('section', 'host-workspace-group');
    budget.appendChild(node('h4', '', 'Budget tracker'));
    const budgetForm = document.createElement('form');
    budgetForm.className = 'host-workspace-form';
    budgetForm.append(
        workspaceInput('Item', 'label', true),
        workspaceInput('Category', 'category', false),
        workspaceInput('Estimated ₹', 'estimated_amount', true, 'number'),
        workspaceInput('Actual ₹', 'actual_amount', true, 'number'),
        workspaceSubmit('ADD COST')
    );
    budgetForm.querySelectorAll('input[type="number"]').forEach(input => {
        input.min = '0';
        input.step = '0.01';
    });
    budgetForm.addEventListener('submit', action => submitWorkspaceForm(action, event.id, budgetForm, 'budget', content));
    data.budget.forEach(item => budget.appendChild(node(
        'p', 'host-muted',
        `${item.label} · ${item.category} · estimated ₹${Number(item.estimated_amount).toFixed(2)} / actual ₹${Number(item.actual_amount).toFixed(2)}`
    )));
    budget.appendChild(budgetForm);
    content.appendChild(budget);

    const venues = node('section', 'host-workspace-group');
    venues.appendChild(node('h4', '', 'Venue options'));
    data.venues.forEach(venue => venues.appendChild(node(
        'p', 'host-muted', `${venue.name}${venue.address ? ` · ${venue.address}` : ''}${venue.capacity ? ` · capacity ${venue.capacity}` : ''}`
    )));
    const venueForm = document.createElement('form');
    venueForm.className = 'host-workspace-form';
    venueForm.append(
        workspaceInput('Venue name', 'name', true),
        workspaceInput('Address', 'address'),
        workspaceInput('Capacity', 'capacity', false, 'number'),
        workspaceInput('Notes', 'notes'),
        workspaceSubmit('ADD VENUE')
    );
    venueForm.addEventListener('submit', action => submitWorkspaceForm(action, event.id, venueForm, 'venue', content));
    venues.appendChild(venueForm);
    content.appendChild(venues);

    const vendors = node('section', 'host-workspace-group');
    vendors.appendChild(node('h4', '', 'Vendors'));
    data.vendors.forEach(vendor => vendors.appendChild(node(
        'p', 'host-muted',
        `${vendor.name} · ${vendor.category} · ${vendor.status} · ₹${Number(vendor.cost).toFixed(2)}${vendor.contact_email ? ` · ${vendor.contact_email}` : ''}`
    )));
    const vendorForm = document.createElement('form');
    vendorForm.className = 'host-workspace-form';
    vendorForm.append(
        workspaceInput('Vendor name', 'name', true),
        workspaceInput('Category', 'category'),
        workspaceInput('Contact email', 'contact_email', false, 'email'),
        workspaceInput('Phone', 'contact_phone', false, 'tel'),
        workspaceInput('Cost ₹', 'cost', true, 'number'),
        workspaceSubmit('ADD VENDOR')
    );
    vendorForm.querySelector('[name="cost"]').min = '0';
    vendorForm.querySelector('[name="cost"]').step = '0.01';
    vendorForm.addEventListener('submit', action => submitWorkspaceForm(action, event.id, vendorForm, 'vendor', content));
    vendors.appendChild(vendorForm);
    content.appendChild(vendors);
}

function renderHostAnalytics(metrics, budgetItems) {
    const section = node('section', 'host-analytics');
    const heading = node('div', 'host-analytics-heading');
    heading.append(
        node('span', 'section-kicker', 'QUICK INSIGHTS'),
        node('h4', '', 'Event at a glance'),
        node('p', 'host-muted', 'A visual snapshot of check-ins, booking status, and event finances.')
    );
    section.appendChild(heading);

    const confirmed = Math.max(0, Number(metrics.confirmed_guests) || 0);
    const admitted = Math.min(confirmed, Math.max(0, Number(metrics.admitted_guests) || 0));
    const pending = Math.max(0, Number(metrics.pending_guests) || 0);
    const guests = confirmed + pending;
    const estimatedBudget = budgetItems.reduce((sum, item) => sum + Math.max(0, Number(item.estimated_amount) || 0), 0);
    const actualExpenses = Math.max(0, Number(metrics.actual_expenses) || 0);
    const revenue = Math.max(0, Number(metrics.confirmed_revenue) || 0);
    const maxFinance = Math.max(estimatedBudget, actualExpenses, revenue, 1);
    const budgetPercent = estimatedBudget ? Math.min(100, actualExpenses / estimatedBudget * 100) : 0;
    const charts = node('div', 'host-analytics-grid');
    charts.append(
        analyticsBarCard(
            'Guest check-ins',
            `${admitted} of ${confirmed} confirmed guests admitted`,
            confirmed ? admitted / confirmed * 100 : 0,
            `${admitted} admitted`,
            `${confirmed} confirmed`
        ),
        analyticsStackCard('Booking status', confirmed, pending, guests),
        analyticsBarCard(
            'Budget used',
            estimatedBudget ? `${budgetPercent.toFixed(0)}% of estimated budget` : 'Add estimates to track budget usage',
            budgetPercent,
            `₹${actualExpenses.toFixed(2)} spent`,
            `₹${estimatedBudget.toFixed(2)} estimated`
        ),
        analyticsFinanceCard(revenue, actualExpenses, maxFinance)
    );
    section.appendChild(charts);
    return section;
}

function renderPlannerAssistant(event, workspace, content) {
    const section = node('section', 'host-ai-assistant');
    section.append(
        node('span', 'section-kicker', 'GATHERLY AI'),
        node('h3', '', 'Your planning copilot'),
        node('p', 'host-muted', 'Ask for a focused event plan, task changes, or a budget draft. Suggestions are reviewed before anything is saved.')
    );
    const examples = node('div', 'host-ai-examples');
    [
        'Create a concise event-day task checklist.',
        'Suggest a budget breakdown for this event.',
        'Assign the open tasks across the team fairly.'
    ].forEach(prompt => {
        const button = node('button', 'host-ai-example', prompt);
        button.type = 'button';
        button.addEventListener('click', () => { input.value = prompt; input.focus(); });
        examples.appendChild(button);
    });

    const messages = node('div', 'host-ai-messages');
    messages.setAttribute('aria-live', 'polite');
    const privacy = node('p', 'host-ai-privacy',
        'Each prompt, brief event summary, and active teammate names are sent to Google Gemini (no emails or attendee details). Chat history is not sent or stored. Never include passwords or payment details.');
    const form = node('form', 'host-ai-form');
    const input = document.createElement('textarea');
    input.name = 'prompt';
    input.maxLength = 1200;
    input.rows = 3;
    input.required = true;
    input.placeholder = 'e.g. Add a sound-check task for the event date and assign it to Priya…';
    input.setAttribute('aria-label', 'Prompt the event planning assistant');
    const submit = node('button', 'btn-primary', 'ASK ASSISTANT');
    submit.type = 'submit';
    form.append(input, submit);
    const plan = node('div', 'host-ai-plan');
    const apply = node('button', 'btn-primary host-ai-apply hidden', 'APPLY SELECTED CHANGES');
    apply.type = 'button';
    apply.disabled = true;
    let proposedActions = [];

    const appendMessage = (text, role) => {
        const message = node('p', `host-ai-message ${role}`, text);
        messages.appendChild(message);
        while (messages.children.length > 8) messages.removeChild(messages.firstChild);
        messages.scrollTop = messages.scrollHeight;
    };

    const renderPlan = actions => {
        proposedActions = actions;
        plan.replaceChildren();
        apply.classList.add('hidden');
        apply.disabled = true;
        if (!actions.length) return;
        plan.appendChild(node('h4', '', 'Review suggested changes'));
        actions.forEach((action, index) => {
            const label = node('label', 'host-ai-plan-item');
            const checkbox = document.createElement('input');
            checkbox.type = 'checkbox';
            checkbox.checked = true;
            checkbox.dataset.actionIndex = String(index);
            checkbox.addEventListener('change', () => {
                apply.disabled = !plan.querySelector('input[type="checkbox"]:checked');
            });
            label.append(
                checkbox,
                node('span', '', describeAssistantAction(action, workspace))
            );
            plan.appendChild(label);
        });
        apply.classList.remove('hidden');
        apply.disabled = false;
    };

    form.addEventListener('submit', async submitEvent => {
        submitEvent.preventDefault();
        const prompt = input.value.trim();
        if (!prompt) return;
        appendMessage(prompt, 'user');
        input.value = '';
        submit.disabled = true;
        plan.replaceChildren();
        apply.classList.add('hidden');
        appendMessage('Thinking through the event plan…', 'assistant pending');
        try {
            const result = await apiRequest(`/api/organizer/events/${event.id}/assistant`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ prompt })
            });
            messages.lastChild.remove();
            appendMessage(result.reply, 'assistant');
            renderPlan(result.actions || []);
        } catch (error) {
            messages.lastChild.remove();
            appendMessage(error.message || 'The assistant could not complete that request.', 'assistant error');
        } finally {
            submit.disabled = false;
        }
    });

    apply.addEventListener('click', async () => {
        const selected = Array.from(plan.querySelectorAll('input[type="checkbox"]:checked'))
            .map(checkbox => proposedActions[Number(checkbox.dataset.actionIndex)])
            .filter(Boolean);
        if (!selected.length) return;
        if (!window.confirm(`Apply ${selected.length} selected change(s) to this event?`)) return;
        apply.disabled = true;
        try {
            const result = await apiRequest(`/api/organizer/events/${event.id}/assistant/apply`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ actions: selected })
            });
            appendMessage(result.message, 'assistant');
            await loadHostDashboard();
            openHostEvent(event.id);
        } catch (error) {
            apply.disabled = false;
            appendMessage(error.message || 'Could not apply the selected changes.', 'assistant error');
        }
    });

    section.append(examples, messages, privacy, form, plan, apply);
    return section;
}

function describeAssistantAction(action, workspace) {
    const team = workspace.team || [];
    const personName = userId => team.find(member => Number(member.id) === Number(userId))?.full_name || 'Unassigned';
    if (action.type === 'task_create') {
        return `Create task “${action.title}” · ${personName(action.assigned_to)}${action.due_at ? ` · due ${formatGatherlyDate(action.due_at)}` : ''}`;
    }
    if (action.type === 'task_update') {
        const task = workspace.tasks.find(item => Number(item.id) === Number(action.task_id));
        const changes = Object.entries(action.fields).map(([key, value]) => {
            if (key === 'assigned_to') return `assign to ${personName(value)}`;
            if (key === 'due_at') return value ? `due ${formatGatherlyDate(value)}` : 'clear due date';
            return `${key.replace('_', ' ')}: ${value || 'clear'}`;
        }).join(', ');
        return `Update task “${task?.title || `#${action.task_id}`}” · ${changes}`;
    }
    if (action.type === 'budget_create') {
        return `Add budget item “${action.label}” · estimate ₹${Number(action.estimated_amount).toFixed(2)} · actual ₹${Number(action.actual_amount).toFixed(2)}`;
    }
    if (action.type === 'budget_update') {
        const item = workspace.budget.find(entry => Number(entry.id) === Number(action.budget_id));
        const changes = Object.entries(action.fields).map(([key, value]) =>
            `${key.replace('_', ' ')}: ${key.endsWith('amount') ? `₹${Number(value).toFixed(2)}` : value}`
        ).join(', ');
        return `Update budget “${item?.label || `#${action.budget_id}`}” · ${changes}`;
    }
    if (action.type === 'event_update') {
        const changes = Object.entries(action.fields).map(([key, value]) => {
            if (key === 'event_date') value = formatGatherlyDate(value);
            if (key === 'event_time') value = formatGatherlyTime(value);
            return `${key.replace('_', ' ')}: ${value}`;
        }).join(', ');
        return `Edit event details · ${changes}`;
    }
    return 'Review assistant suggestion';
}

function analyticsBarCard(title, description, percent, primaryLabel, totalLabel) {
    const card = node('article', 'host-analytics-card');
    card.append(node('h5', '', title), node('p', 'host-muted', description));
    const track = node('div', 'host-chart-track');
    track.setAttribute('role', 'img');
    track.setAttribute('aria-label', `${description}: ${Math.round(percent)} percent`);
    const fill = node('span', 'host-chart-fill');
    fill.style.width = `${Math.max(0, Math.min(100, percent))}%`;
    track.appendChild(fill);
    const labels = node('div', 'host-chart-labels');
    labels.append(node('strong', '', primaryLabel), node('span', '', totalLabel));
    card.append(track, labels);
    return card;
}

function analyticsStackCard(title, confirmed, pending, total) {
    const card = node('article', 'host-analytics-card');
    card.append(node('h5', '', title), node('p', 'host-muted', `${total} guests currently reserved`));
    const track = node('div', 'host-chart-track host-chart-stack');
    track.setAttribute('role', 'img');
    track.setAttribute('aria-label', `${confirmed} confirmed guests and ${pending} pending guests`);
    const denominator = total || 1;
    const confirmedFill = node('span', 'host-chart-fill');
    confirmedFill.style.width = `${confirmed / denominator * 100}%`;
    const pendingFill = node('span', 'host-chart-fill host-chart-pending');
    pendingFill.style.width = `${pending / denominator * 100}%`;
    track.append(confirmedFill, pendingFill);
    const labels = node('div', 'host-chart-labels');
    labels.append(
        node('strong', '', `${confirmed} confirmed`),
        node('span', '', `${pending} pending`)
    );
    card.append(track, labels);
    return card;
}

function analyticsFinanceCard(revenue, expenses, maxFinance) {
    const card = node('article', 'host-analytics-card');
    card.append(
        node('h5', '', 'Income vs. expenses'),
        node('p', 'host-muted', 'Confirmed ticket revenue compared with recorded spend')
    );
    const bars = node('div', 'host-finance-bars');
    [
        ['Revenue', revenue, 'host-chart-fill'],
        ['Expenses', expenses, 'host-chart-fill host-chart-pending']
    ].forEach(([label, amount, fillClass]) => {
        const row = node('div', 'host-finance-row');
        const name = node('span', '', label);
        const track = node('div', 'host-chart-track');
        track.setAttribute('role', 'img');
        track.setAttribute('aria-label', `${label}: ₹${amount.toFixed(2)}`);
        const fill = node('span', fillClass);
        fill.style.width = `${amount / maxFinance * 100}%`;
        track.appendChild(fill);
        row.append(name, track, node('strong', '', `₹${amount.toFixed(2)}`));
        bars.appendChild(row);
    });
    card.appendChild(bars);
    return card;
}

function workspaceInput(placeholder, name, required = false, type = 'text') {
    const input = document.createElement('input');
    input.type = type;
    input.name = name;
    input.placeholder = placeholder;
    input.setAttribute('aria-label', placeholder);
    input.required = required;
    if (type === 'number') input.min = '0';
    return input;
}

function workspaceSubmit(label) {
    const button = node('button', 'btn-primary btn-logout', label);
    button.type = 'submit';
    return button;
}

async function submitWorkspaceForm(action, eventId, form, kind, content) {
    action.preventDefault();
    const values = Object.fromEntries(new FormData(form).entries());
    try {
        await saveWorkspaceItem(eventId, { kind, ...values }, content);
    } catch (error) {
        setHostNotice(error.message, true);
    }
}

async function saveWorkspaceItem(eventId, payload, content) {
    await apiRequest(`/api/organizer/events/${eventId}/workspace`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
    });
    const event = hostEvents.find(item => Number(item.id) === Number(eventId));
    if (event) {
        const data = await apiRequest(`/api/organizer/events/${eventId}/workspace`);
        renderEventWorkspaceData(event, data, content);
    }
    setHostNotice('Event planning workspace saved.');
}

function renderAnnouncementTool(event) {
    const section = node('section', 'host-subsection host-announcement-section');
    section.append(
        node('h3', '', 'Send a private attendee update'),
        node('p', 'host-muted', 'Choose where confirmed attendees receive this update. Email is sent privately; attendee contact details are never shown to you.')
    );
    const form = node('form', 'host-announcement-form');
    const titleLabel = node('label', '', 'Update title');
    const title = node('input');
    title.maxLength = 120;
    title.required = true;
    titleLabel.appendChild(title);
    const messageLabel = node('label', '', 'Message');
    const message = node('textarea');
    message.rows = 4;
    message.maxLength = 2000;
    message.required = true;
    messageLabel.appendChild(message);
    const deliveryLabel = node('label', '', 'Deliver via');
    const delivery = node('select');
    [
        ['both', 'In-app and email'],
        ['in_app', 'In-app only'],
        ['email', 'Email only']
    ].forEach(([value, label]) => {
        const option = node('option', '', label);
        option.value = value;
        delivery.appendChild(option);
    });
    deliveryLabel.appendChild(delivery);
    const submit = node('button', 'btn-primary', 'SEND PRIVATE UPDATE');
    submit.type = 'submit';
    form.append(titleLabel, messageLabel, deliveryLabel, submit);
    form.addEventListener('submit', async action => {
        action.preventDefault();
        submit.disabled = true;
        try {
            const result = await apiRequest(`/api/organizer/events/${event.id}/announcements`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    title: title.value,
                    message: message.value,
                    delivery_channel: delivery.value
                })
            });
            setHostNotice(result.message);
            form.reset();
        } catch (error) {
            setHostNotice(error.message, true);
        } finally {
            submit.disabled = false;
        }
    });
    section.appendChild(form);
    return section;
}

async function cancelManagedEvent(eventId) {
    if (!window.confirm('Cancel this event? It will disappear from listings, ticket entry will stop, and attendees will receive a private Gatherly update and email notification. Event and ticket history will be retained.')) return;
    try {
        const result = await apiRequest(`/api/organizer/events/${eventId}/cancel`, { method: 'POST' });
        setHostNotice(result.message);
        await loadHostDashboard();
    } catch (error) {
        setHostNotice(error.message, true);
    }
}

function renderEventEditor(event) {
    const details = node('details', 'host-subsection host-event-editor');
    const summary = node('summary', '', 'Edit event details');
    const form = node('form', 'host-edit-form');
    const fields = [
        ['Event name', 'title', 'text', event.title],
        ['Category', 'category', 'text', event.category],
        ['Date', 'event_date', 'date', event.event_date],
        ['Time', 'event_time', 'time', event.event_time],
        ['Venue', 'venue', 'text', event.venue],
        ['City', 'city', 'text', event.city]
    ];
    fields.forEach(([labelText, key, type, value]) => {
        const label = node('label', '', labelText);
        const input = node('input');
        input.name = key;
        input.type = type;
        input.value = value || '';
        input.required = true;
        if (key === 'title') input.maxLength = 120;
        if (key === 'category') input.maxLength = 80;
        if (key === 'venue') input.maxLength = 200;
        if (key === 'city') input.maxLength = 100;
        label.appendChild(input);
        form.appendChild(label);
    });
    [['Publish at', 'publish_at', event.publish_at], ['Ticket sales start at', 'ticket_sales_start_at', event.ticket_sales_start_at]]
        .forEach(([labelText, key, value]) => {
            const label = node('label', '', `${labelText} (optional)`);
            const input = node('input');
            input.name = key;
            input.type = 'datetime-local';
            input.value = value ? String(value).slice(0, 16) : '';
            label.appendChild(input);
            form.appendChild(label);
        });
    const visibilityLabel = node('label', '', 'Visibility');
    const visibility = node('select');
    visibility.name = 'visibility';
    [['PUBLIC', 'Public'], ['PRIVATE', 'Invite only']].forEach(([value, text]) => {
        const option = node('option', '', text);
        option.value = value;
        option.selected = event.visibility === value;
        visibility.appendChild(option);
    });
    visibilityLabel.appendChild(visibility);
    form.appendChild(visibilityLabel);
    const descriptionLabel = node('label', 'host-description-field', 'Event description');
    const description = node('textarea');
    description.name = 'description';
    description.maxLength = 5000;
    description.rows = 4;
    description.value = event.description || '';
    descriptionLabel.appendChild(description);
    form.appendChild(descriptionLabel);
    const save = node('button', 'btn-primary', 'SAVE EVENT DETAILS');
    save.type = 'submit';
    form.appendChild(save);
    form.addEventListener('submit', async action => {
        action.preventDefault();
        save.disabled = true;
        const payload = Object.fromEntries(new FormData(form).entries());
        try {
            const result = await apiRequest(`/api/organizer/events/${event.id}/details`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });
            setHostNotice(result.message);
            await loadHostDashboard();
        } catch (error) {
            setHostNotice(error.message, true);
        } finally {
            save.disabled = false;
        }
    });
    details.append(summary, form);
    return details;
}

function renderEventPartnersEditor(event) {
    const details = node('details', 'host-subsection host-event-editor');
    details.appendChild(node('summary', '', 'Manage sponsors & event partners'));
    const list = node('div', 'host-partners-manager-list');
    (event.partners || []).forEach(partner => {
        const item = node('div', 'host-partner-manager-item');
        if (partner.logo_path) {
            const logo = node('img');
            logo.src = `/uploads/${partner.logo_path}`;
            logo.alt = '';
            item.appendChild(logo);
        }

        item.append(
            node('strong', '', partner.name),
            node('span', 'host-status', partner.partner_type)
        );
        list.appendChild(item);
    });
    if (!event.partners?.length) {
        list.appendChild(node('p', 'host-muted', 'No sponsors or event partners added yet.'));
    }

    const form = node('form', 'host-partner-form');
    const name = workspaceInput('Organization or brand name', 'name', true);
    name.maxLength = 120;
    const type = document.createElement('select');
    type.name = 'partner_type';
    type.setAttribute('aria-label', 'Partner type');
    [['SPONSOR', 'Sponsor'], ['EVENT PARTNER', 'Event partner']].forEach(([value, label]) => {
        const option = node('option', '', label);
        option.value = value;
        type.appendChild(option);
    });
    const logoLabel = node('label', 'host-partner-logo-label', 'Logo (optional)');
    const logo = document.createElement('input');
    logo.type = 'file';
    logo.name = 'logo';
    logo.accept = 'image/jpeg,image/png,image/webp,image/gif';
    logoLabel.appendChild(logo);
    const submit = workspaceSubmit('ADD PARTNER');
    form.append(name, type, logoLabel, submit);
    form.addEventListener('submit', async action => {
        action.preventDefault();
        submit.disabled = true;
        try {
            const result = await apiRequest(`/api/organizer/events/${event.id}/partners`, {
                method: 'POST',
                body: new FormData(form)
            });
            setHostNotice(result.message);
            await loadHostDashboard();
        } catch (error) {
            setHostNotice(error.message, true);
        } finally {
            submit.disabled = false;
        }
    });
    details.append(list, form);
    return details;
}

function renderEventMediaEditor(event) {
    const details = node('details', 'host-subsection host-event-editor');
    details.appendChild(node('summary', '', 'Edit artwork, photos & video'));
    const form = node('form', 'host-edit-form host-media-editor');
    const currentMedia = node('div', 'host-current-media');
    currentMedia.setAttribute('aria-label', 'Current event media');
    const media = event.media || [];
    if (media.length) {
        media.forEach((item, index) => {
            const card = node('label', 'host-media-item');
            const preview = item.media_type === 'video' ? document.createElement('video') : document.createElement('img');
            preview.src = `/uploads/${item.media_path}`;
            preview.className = 'host-media-preview';
            if (item.media_type === 'video') {
                preview.controls = true;
                preview.preload = 'metadata';
            } else {
                preview.alt = `Current event image ${index + 1}`;
                preview.loading = 'lazy';
            }
            const mediaRole = item.media_path === event.main_image ? 'Main artwork'
                : item.media_path === event.cover_image ? 'Cover art'
                    : item.media_path === event.video_file ? 'Teaser video'
                        : item.media_type === 'video' ? `Gallery video ${index + 1}` : `Gallery image ${index + 1}`;
            const caption = node('span', '', mediaRole);
            const removeLabel = node('span', 'host-media-remove');
            const remove = document.createElement('input');
            remove.type = 'checkbox';
            remove.name = 'remove_media';
            remove.value = item.media_path;
            remove.setAttribute('aria-label', `Remove ${item.media_type} ${index + 1}`);
            removeLabel.append(remove, document.createTextNode('Remove'));
            card.append(preview, caption, removeLabel);
            currentMedia.appendChild(card);
        });
    } else {
        currentMedia.appendChild(node('p', 'host-muted', 'No event artwork or media uploaded yet.'));
    }
    form.appendChild(currentMedia);

    [
        ['Replace main artwork', 'main_image', 'image/jpeg,image/png,image/webp,image/gif', false],
        ['Replace cover art', 'cover_image', 'image/jpeg,image/png,image/webp,image/gif', false],
        ['Replace teaser video', 'video_file', 'video/mp4,video/webm,video/quicktime', false],
        ['Add gallery photos', 'gallery_images', 'image/jpeg,image/png,image/webp,image/gif', true]
    ].forEach(([text, name, accept, multiple]) => {
        const label = node('label', '', text);
        const input = document.createElement('input');
        input.type = 'file';
        input.name = name;
        input.accept = accept;
        if (multiple) input.multiple = true;
        label.appendChild(input);
        form.appendChild(label);
    });

    const save = node('button', 'btn-primary', 'SAVE EVENT MEDIA');
    save.type = 'submit';
    form.appendChild(save);
    form.addEventListener('submit', async action => {
        action.preventDefault();
        save.disabled = true;
        const payload = new FormData(form);
        payload.delete('remove_media');
        payload.append('remove_paths', JSON.stringify(
            Array.from(form.querySelectorAll('input[name="remove_media"]:checked'), input => input.value)
        ));
        try {
            const result = await apiRequest(`/api/organizer/events/${event.id}/media`, {
                method: 'POST',
                body: payload
            });
            setHostNotice(result.message);
            await loadHostDashboard();
        } catch (error) {
            setHostNotice(error.message, true);
        } finally {
            save.disabled = false;
        }
    });
    details.appendChild(form);
    return details;
}

function renderTierEditor(event) {
    const details = node('details', 'host-subsection host-event-editor');
    details.appendChild(node('summary', '', 'Manage ticket tiers and seating plans'));
    const form = node('form', 'host-edit-form');
    const rows = node('div', 'host-tier-editor-rows');
    const addRow = tier => {
        const row = node('div', 'tier-form-row host-tier-edit-row');
        const fields = [
            ['Tier name', 'name', 'text', tier?.name || ''],
            ['Description', 'description', 'text', tier?.description || ''],
            ['Price', 'price', 'number', tier?.price ?? ''],
            ['Capacity', 'capacity', 'number', tier?.capacity ?? '']
        ];
        fields.forEach(([labelText, name, type, value]) => {
            const label = node('label', '', labelText);
            const input = node('input');
            input.type = type;
            input.name = name;
            input.value = String(value);
            input.required = true;
            input.dataset.tierField = name;
            if (type === 'number') {
                input.min = '0';
                input.step = name === 'price' ? '0.01' : '1';
            }
            if (name === 'name') input.maxLength = 80;
            if (name === 'description') input.maxLength = 500;
            label.appendChild(input);
            row.appendChild(label);
        });
        const imageLabel = node('label', '', 'Seating-plan image (optional)');
        const image = node('input');
        image.type = 'file';
        image.accept = 'image/*';
        image.dataset.tierField = 'image';
        imageLabel.appendChild(image);
        row.appendChild(imageLabel);
        const remove = node('button', 'btn-primary btn-logout', 'REMOVE');
        remove.type = 'button';
        remove.addEventListener('click', () => row.remove());
        row.appendChild(remove);
        rows.appendChild(row);
    };
    (event.tiers || []).forEach(addRow);
    if (!rows.childElementCount) addRow(null);
    const add = node('button', 'btn-primary btn-logout', 'ADD TIER');
    add.type = 'button';
    add.addEventListener('click', () => {
        if (rows.childElementCount >= 20) return;
        addRow(null);
    });
    const save = node('button', 'btn-primary', 'SAVE TICKETS & SEATING');
    save.type = 'submit';
    form.append(rows, add, save);
    form.addEventListener('submit', async action => {
        action.preventDefault();
        const payload = [];
        const formData = new FormData();
        for (const row of rows.querySelectorAll('.host-tier-edit-row')) {
            const fields = Object.fromEntries(Array.from(row.querySelectorAll('[data-tier-field]'))
                .map(input => [input.dataset.tierField, input]));
            const index = payload.length;
            payload.push({
                name: fields.name.value,
                description: fields.description.value,
                price: Number(fields.price.value),
                capacity: Number(fields.capacity.value)
            });
            if (fields.image.files[0]) formData.append(`tier_image_${index}`, fields.image.files[0]);
        }
        formData.append('tiers', JSON.stringify(payload));
        save.disabled = true;
        try {
            await apiRequest(`/api/organizer/events/${event.id}/tiers`, { method: 'POST', body: formData });
            setHostNotice('Ticket tiers updated.');
            await loadHostDashboard();
        } catch (error) {
            setHostNotice(error.message, true);
        } finally {
            save.disabled = false;
        }
    });
    details.appendChild(form);
    return details;
}

function renderInviteTools(event) {
    const section = node('section', 'host-subsection');
    section.append(
        node('h3', '', 'Invite guests and collaborators'),
        node('p', 'host-muted', 'Guest invitations include RSVP access. Collaborators can help manage this event.')
    );
    const form = node('form', 'host-invite-form');
    const emailLabel = node('label', '', 'Email address');
    const email = node('input');
    email.type = 'email';
    email.autocomplete = 'email';
    email.required = true;
    emailLabel.appendChild(email);
    const roleLabel = node('label', '', 'Access type');
    const role = node('select');
    [['GUEST', 'Guest RSVP'], ['MANAGER', 'Event manager']].forEach(([value, text]) => {
        if (value === 'MANAGER' && !event.owner) return;
        const option = node('option', '', text);
        option.value = value;
        role.appendChild(option);
    });
    roleLabel.appendChild(role);
    const submit = node('button', 'btn-primary', 'SEND INVITATION');
    submit.type = 'submit';
    form.append(emailLabel, roleLabel, submit);
    form.addEventListener('submit', async action => {
        action.preventDefault();
        submit.disabled = true;
        try {
            const data = await apiRequest(`/api/events/${event.id}/invitations`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email: email.value, role: role.value })
            });
            setHostNotice(data.invite_url
                ? `${data.message}. Share this invitation link with the invitee: ${data.invite_url}`
                : data.message);
            await loadHostDashboard();
        } catch (error) {
            setHostNotice(error.message, true);
        } finally {
            submit.disabled = false;
        }
    });
    section.appendChild(form);
    return section;
}

function renderPeople(event) {
    const section = node('section', 'host-subsection');
    section.append(node('h3', '', 'Guests, RSVPs, and event team'));
    const list = node('div', 'host-people-grid');
    const invitations = event.invitations || [];
    const team = event.team || [];
    if (!invitations.length && !team.length) {
        list.appendChild(node('p', 'empty-state', 'No invitations or collaborators yet.'));
    }
    invitations.forEach(invitation => {
        const person = node('article', 'host-person-card');
        person.append(
            node('strong', '', invitation.email),
            node('span', 'host-status', `${invitation.role === 'MANAGER' ? 'Collaborator' : 'Guest'} · ${invitation.status}`)
        );
        const button = node('button', 'btn-primary btn-logout', invitation.role === 'MANAGER' ? 'REVOKE ACCESS' : 'CANCEL INVITE');
        button.type = 'button';
        button.disabled = invitation.status === 'DECLINED';
        button.addEventListener('click', () => revokeInvitation(event.id, invitation.id));
        person.appendChild(button);
        list.appendChild(person);
    });
    team.filter(member => !invitations.some(invitation =>
        invitation.email.toLowerCase() === member.email.toLowerCase() &&
        invitation.role === 'MANAGER'
    )).forEach(member => {
        const person = node('article', 'host-person-card');
        person.append(
            node('strong', '', member.email),
            node('span', 'host-status', `Collaborator · ${member.status}`)
        );
        list.appendChild(person);
    });
    section.appendChild(list);
    return section;
}

async function revokeInvitation(eventId, invitationId) {
    if (!window.confirm('Revoke this invitation or event access?')) return;
    try {
        const result = await apiRequest(
            `/api/organizer/events/${eventId}/invitations/${invitationId}/revoke`,
            { method: 'POST' }
        );
        setHostNotice(result.message);
        await loadHostDashboard();
    } catch (error) {
        setHostNotice(error.message, true);
    }
}

function renderBookings(event) {
    const section = node('section', 'host-subsection');
    section.appendChild(node('h3', '', 'Bookings and entry'));
    const list = node('div', 'host-booking-list');
    const bookings = event.bookings || [];
    if (!bookings.length) list.appendChild(node('p', 'empty-state', 'No bookings yet.'));
    bookings.forEach(booking => {
        const row = node('article', 'host-booking-row');
        const info = node('div', 'host-booking-info');
        info.append(
            node('strong', '', `Booking ${booking.id}`),
            node('span', '', `${booking.quantity} guest(s) · ${booking.admitted_count || 0} admitted`),
            node('span', 'host-status', booking.hold_expires_at
                ? `WAITLIST OFFER · expires ${booking.hold_expires_at}`
                : `${booking.status} · payment ${booking.payment_status}`)
        );
        row.appendChild(info);
        if (!event.is_cancelled && booking.status === 'PENDING' && !booking.hold_expires_at) {
            const actions = node('div', 'host-actions');
            [['CONFIRM_PAYMENT', 'CONFIRM PAYMENT'], ['REJECT', 'REJECT']].forEach(([decision, text]) => {
                const button = node('button', decision === 'REJECT' ? 'btn-primary btn-logout' : 'btn-primary', text);
                button.type = 'button';
                button.addEventListener('click', () => decideBooking(booking.id, decision));
                actions.appendChild(button);
            });
            row.appendChild(actions);
        }
        list.appendChild(row);
    });
    section.appendChild(list);
    return section;
}

function renderWaitlist(event) {
    const section = node('section', 'host-subsection');
    section.appendChild(node('h3', '', 'Ticket waitlist'));
    const list = node('div', 'host-booking-list');
    const entries = event.waitlist || [];
    if (!entries.length) list.appendChild(node('p', 'empty-state', 'No active waitlist requests.'));
    entries.forEach(entry => {
        const row = node('article', 'host-booking-row');
        row.append(
            node('strong', '', `Waitlist request ${entry.id}`),
            node('span', '', `${entry.quantity} ticket(s)${entry.tier_name ? ` · ${entry.tier_name}` : ''}`),
            node('span', 'host-status', entry.status === 'OFFERED'
                ? `Offer expires ${entry.offered_until}` : 'Waiting · FIFO queue')
        );
        list.appendChild(row);
    });
    section.appendChild(list);
    return section;
}

async function decideBooking(bookingId, decision) {
    try {
        const result = await apiRequest(`/api/organizer/bookings/${bookingId}/decision`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ decision })
        });
        setHostNotice(result.email_sent === false
            ? 'Booking updated, but the confirmation email could not be delivered.'
            : `Booking ${result.status.toLowerCase()}.`);
        await loadHostDashboard();
    } catch (error) {
        setHostNotice(error.message, true);
    }
}

function renderGateAccounts(event) {
    const section = node('section', 'host-subsection host-gate-section');
    section.append(
        node('h3', '', 'Event-specific gate accounts'),
        node('p', 'host-muted', 'Each account is restricted to this event. The generated password is shown only once.')
    );
    const form = node('form', 'host-invite-form');
    const label = node('label', '', 'Gate or entrance name');
    const name = node('input');
    name.maxLength = 80;
    name.required = true;
    name.placeholder = 'e.g. North Gate';
    label.appendChild(name);
    const submit = node('button', 'btn-primary', 'CREATE GATE LOGIN');
    submit.type = 'submit';
    form.append(label, submit);
    form.addEventListener('submit', async action => {
        action.preventDefault();
        submit.disabled = true;
        try {
            const result = await apiRequest(`/api/organizer/events/${event.id}/gate-accounts`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ display_name: name.value })
            });
            newlyCreatedGateCredentials = { eventId: event.id, result };
            event.gate_accounts.unshift(result.account);
            name.value = '';
            renderHostEvents(hostEvents);
            setHostNotice(result.message);
        } catch (error) {
            setHostNotice(error.message, true);
        } finally {
            submit.disabled = false;
        }
    });
    section.appendChild(form);
    const accounts = node('div', 'host-people-grid');
    (event.gate_accounts || []).forEach(account => {
        const person = node('article', 'host-person-card');
        person.append(
            node('strong', '', account.display_name),
            node('span', 'host-status', account.active ? 'Active' : 'Revoked'),
            node('code', 'gate-username', account.username)
        );
        if (account.active) {
            const revoke = node('button', 'btn-primary btn-logout', 'REVOKE GATE ACCESS');
            revoke.type = 'button';
            revoke.addEventListener('click', () => revokeGateAccount(event.id, account.id));
            person.appendChild(revoke);
        }
        accounts.appendChild(person);
    });
    if (!accounts.childElementCount) accounts.appendChild(node('p', 'empty-state', 'No gate accounts created.'));
    section.appendChild(accounts);
    if (newlyCreatedGateCredentials?.eventId === event.id) {
        renderGateCredentials(section, newlyCreatedGateCredentials.result);
        newlyCreatedGateCredentials = null;
    }
    return section;
}

function renderGateCredentials(section, result) {
    const credentials = result.credentials;
    const panel = node('aside', 'gate-credentials');
    panel.setAttribute('aria-live', 'assertive');
    panel.append(
        node('h4', '', 'Save these gate credentials now'),
        node('p', '', 'This password will not be displayed again. Share it only with trusted gate staff.'),
        node('span', '', `Scanner: ${window.location.origin}${result.scanner_url}`),
        node('span', '', `Username: ${credentials.username}`),
        node('span', '', `Password: ${credentials.password}`)
    );
    const copy = node('button', 'btn-primary', 'COPY CREDENTIALS');
    copy.type = 'button';
    copy.addEventListener('click', async () => {
        try {
            await navigator.clipboard.writeText(
                `Scanner: ${window.location.origin}${result.scanner_url}\nUsername: ${credentials.username}\nPassword: ${credentials.password}`
            );
            setHostNotice('Gate credentials copied. Store them securely.');
        } catch {
            setHostNotice('Clipboard access is unavailable. Select and copy the credentials manually.', true);
        }
    });
    panel.appendChild(copy);
    section.prepend(panel);
}

async function revokeGateAccount(eventId, accountId) {
    if (!window.confirm('Immediately disable this gate login?')) return;
    try {
        const result = await apiRequest(
            `/api/organizer/events/${eventId}/gate-accounts/${accountId}/revoke`,
            { method: 'POST' }
        );
        setHostNotice(result.message);
        await loadHostDashboard();
    } catch (error) {
        setHostNotice(error.message, true);
    }
}

async function signOutHost() {
    try {
        await fetch('/api/logout', { method: 'POST' });
        window.location.assign('/');
    } catch {
        setHostNotice('Could not sign out. Check your connection and try again.', true);
    }
}
