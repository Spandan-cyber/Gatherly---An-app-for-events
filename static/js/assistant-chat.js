document.addEventListener('DOMContentLoaded', () => {
    const panel = document.getElementById('publicAssistantPanel');
    const toggle = document.getElementById('publicAssistantToggle');
    const close = document.getElementById('publicAssistantClose');
    const form = document.getElementById('publicAssistantForm');
    const input = document.getElementById('publicAssistantInput');
    const send = document.getElementById('publicAssistantSend');
    const messages = document.getElementById('publicAssistantMessages');

    if (!panel || !toggle || !close || !form || !input || !send || !messages) {
        return;
    }

    const conversation = [];
    let busy = false;

    function scrollToBottom() {
        messages.scrollTop = messages.scrollHeight;
    }

    function appendMessage(text, role, extraClass = '') {
        const message = document.createElement('p');

        message.className =
            `public-assistant-message ${role}` +
            (extraClass ? ` ${extraClass}` : '');

        message.textContent = text;
        messages.appendChild(message);

        while (messages.children.length > 20) {
            messages.removeChild(messages.firstChild);
        }

        scrollToBottom();
        return message;
    }

    

    function setOpen(open) {
        panel.classList.toggle('hidden', !open);
        toggle.setAttribute('aria-expanded', String(open));

        if (open) {
            input.focus();
        } else {
            toggle.focus();
        }
    }

    appendMessage(
        'Hi! I can help you discover public events on Gatherly.',
        'assistant'
    );

    toggle.addEventListener('click', () => {
        setOpen(panel.classList.contains('hidden'));
    });

    close.addEventListener('click', () => setOpen(false));

    document.addEventListener('keydown', event => {
        if (event.key === 'Escape' && !panel.classList.contains('hidden')) {
            setOpen(false);
        }
    });

    form.addEventListener('submit', async event => {
        event.preventDefault();

        const prompt = input.value.trim();

        if (!prompt || busy) {
            return;
        }

        const history = conversation.slice(-6);

        appendMessage(prompt, 'user');
        input.value = '';

        busy = true;
        send.disabled = true;

        const pending = appendMessage(
            'Finding events for you…',
            'assistant',
            'pending'
        );

        try {
            const response = await fetch('/api/assistant/chat', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    prompt,
                    history
                })
            });

            const result = await response.json();

            if (!response.ok || !result.success) {
                throw new Error(
                    result.message ||
                    'The assistant could not reply. Please try again.'
                );
            }

            pending.remove();

            appendMessage(formatDatesInReply(result.reply), 'assistant');

            if (/(\+?\s*Host Event|\/host\/dashboard|Host Dashboard|create an event|create event)/i.test(result.reply) ||
                /^(how to |can i |want to )?(create|host|organize|publish) (an? )?event/i.test(prompt)) {
                appendHostQuickAction();
            }

            // Render event cards and booking buttons returned by Flask.
            if (Array.isArray(result.events)) {
                appendEventCards(result.events);
            }

            conversation.push({role: 'user', text: prompt});

            conversation.push({
                role: 'assistant',
                text: result.reply
            });

        } catch (error) {
            pending.remove();

            appendMessage(
                error.message ||
                'The assistant could not reply. Please try again.',
                'assistant',
                'error'
            );
        } finally {
            busy = false;
            send.disabled = false;
            input.focus();
        }
    });

    function formatEventDate(dateString) {
        if (!dateString) {
            return 'Date to be announced';
        }

        // Match dates in YYYY-MM-DD format.
        const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dateString);

        if (!match) {
            return dateString;
        }

        const year = Number(match[1]);
        const month = Number(match[2]) - 1;
        const day = Number(match[3]);

        const date = new Date(year, month, day);

        // Check that the date is valid.
        if (
            date.getFullYear() !== year ||
            date.getMonth() !== month ||
            date.getDate() !== day
        ) {
            return dateString;
        }

        // Calculate the correct ordinal suffix: st, nd, rd, or th.
        const suffix =
            day % 100 >= 11 && day % 100 <= 13
                ? 'th'
                : day % 10 === 1
                    ? 'st'
                    : day % 10 === 2
                        ? 'nd'
                        : day % 10 === 3
                            ? 'rd'
                            : 'th';

        const monthName = date.toLocaleDateString('en-IN', {
            month: 'long'
        });

        return `${day}${suffix} ${monthName} ${year}`;
    }

    function formatDatesInReply(text) {
        return text.replace(
            /\b(\d{4})-(\d{2})-(\d{2})\b/g,
            (original, year, month, day) => {
                return formatEventDate(original);
            }
        );
    }
    function appendEventCards(events) {
        events.forEach(event => {
            const card = document.createElement('div');
            card.className = 'assistant-event-card';

            const title = document.createElement('h4');
            title.textContent = event.title || 'Event';
            card.appendChild(title);

            const details = document.createElement('p');
            details.textContent =
                `🗓️ ${formatEventDate(event.date)} · ` +
                `📍 ${[event.venue, event.city].filter(Boolean).join(', ')}`;
            card.appendChild(details);

            const price = document.createElement('p');

            if (!event.is_paid) {
                price.textContent = '🎟️ Free';
            } else if (
                typeof event.minimum_ticket_price === 'number' &&
                event.minimum_ticket_price > 0
            ) {
                price.textContent =
                    `🎟️ Tickets starting from ₹${event.minimum_ticket_price}`;
            } else {
                price.textContent = '🎟️ Price not available';
            }

            card.appendChild(price);

            if (event.booking_url) {
                try {
                    const url = new URL(
                        event.booking_url,
                        window.location.origin
                    );

                    if (url.origin !== window.location.origin) return;

                    const button = document.createElement('a');
                    button.href = url.href;
                    button.className = 'assistant-book-button';
                    button.textContent = '🎟️ Book Tickets';

                    card.appendChild(button);
                } catch (error) {
                    console.warn('Invalid booking URL');
                }
            }

            messages.appendChild(card);
        });

        messages.scrollTop = messages.scrollHeight;
    }

    function appendHostQuickAction() {
        const wrap = document.createElement('div');
        wrap.className = 'assistant-quick-actions';
        wrap.innerHTML = `
            <button type="button" class="assistant-quick-btn host-btn" onclick="if(window.handleHostEventNav){window.handleHostEventNav();}else{window.location.href='/?create=1';}">
                ✨ + Host Event Now
            </button>
            <a href="/host/dashboard" class="assistant-quick-btn dashboard-btn">
                🎪 Open Host Dashboard
            </a>
        `;
        messages.appendChild(wrap);
        messages.scrollTop = messages.scrollHeight;
    }
});