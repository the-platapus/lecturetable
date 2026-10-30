const days = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

let initialScrollDone = false;

async function loadTimetable() {
    try {
        const response = await fetch('timetable.json');
        if (!response.ok) throw new Error("timetable.json not found");
        const timetable = await response.json();
        renderUI(timetable);
        
        if (!initialScrollDone) {
            setTimeout(() => {
                const activeCard = document.querySelector('.class-item.active');
                if (activeCard) {
                    activeCard.scrollIntoView({ behavior: 'smooth', inline: 'center', block: 'nearest' });
                }
                initialScrollDone = true;
            }, 2000);
        }

        if (!window.timetableInterval) {
            window.timetableInterval = setInterval(() => renderUI(timetable), 60000); // update every minute
        }
    } catch (e) {
        console.error("Error loading timetable", e);
        document.getElementById('next-class-label').textContent = "Waiting for initial sync from GitHub Actions...";
    }
}

function parseTime(timeStr) {
    const [hours, mins] = timeStr.split(':').map(Number);
    const d = new Date();
    d.setHours(hours, mins, 0, 0);
    return d;
}

function formatAMPM(date) {
    let hours = date.getHours();
    let minutes = date.getMinutes();
    const ampm = hours >= 12 ? 'pm' : 'am';
    hours = hours % 12;
    hours = hours ? hours : 12;
    minutes = minutes < 10 ? '0' + minutes : minutes;
    return hours + ':' + minutes + ' ' + ampm;
}

function formatMinutesTime(mins) {
    const hours = Math.floor(mins / 60);
    const m = mins % 60;
    const ampm = hours >= 12 ? 'pm' : 'am';
    let h12 = hours % 12;
    h12 = h12 ? h12 : 12;
    const mStr = m < 10 ? '0' + m : m;
    return `${h12}:${mStr} ${ampm}`;
}

function getWeekRange(timetable) {
    let earliest = null;
    let latest = null;

    Object.values(timetable).forEach(classes => {
        if (!Array.isArray(classes)) return;
        classes.forEach(c => {
            const [sH, sM] = c.start.split(':').map(Number);
            const [eH, eM] = c.end.split(':').map(Number);
            const sMins = sH * 60 + sM;
            const eMins = eH * 60 + eM;

            if (earliest === null || sMins < earliest) earliest = sMins;
            if (latest === null || eMins > latest) latest = eMins;
        });
    });

    if (earliest === null) earliest = 8 * 60;
    if (latest === null) latest = 16 * 60;
    return { earliest, latest };
}

function renderTimeline(timetable, todaysClasses, now) {
    const { earliest, latest } = getWeekRange(timetable);
    const totalRange = latest - earliest;
    if (totalRange <= 0) return;

    const startLabel = document.getElementById('timeline-start-label');
    const endLabel = document.getElementById('timeline-end-label');
    if (startLabel) startLabel.textContent = formatMinutesTime(earliest);
    if (endLabel) endLabel.textContent = formatMinutesTime(latest);

    const sortedClasses = [...todaysClasses].map(c => {
        const [sH, sM] = c.start.split(':').map(Number);
        const [eH, eM] = c.end.split(':').map(Number);
        return {
            ...c,
            startMins: sH * 60 + sM,
            endMins: eH * 60 + eM
        };
    }).sort((a, b) => a.startMins - b.startMins);

    const segments = [];
    let cursor = earliest;

    sortedClasses.forEach(c => {
        const classStart = Math.max(cursor, c.startMins);
        const classEnd = Math.min(latest, c.endMins);

        if (classStart > cursor) {
            segments.push({
                type: 'free',
                start: cursor,
                end: classStart
            });
        }

        if (classEnd > classStart) {
            segments.push({
                type: 'class',
                start: classStart,
                end: classEnd,
                subject: c.subject,
                room: c.room
            });
            cursor = classEnd;
        }
    });

    if (cursor < latest) {
        segments.push({
            type: 'free',
            start: cursor,
            end: latest
        });
    }

    const bar = document.getElementById('timeline-bar');
    if (bar) {
        bar.innerHTML = '';
        segments.forEach(seg => {
            const segDiv = document.createElement('div');
            const pct = ((seg.end - seg.start) / totalRange) * 100;
            segDiv.className = `timeline-segment ${seg.type}`;
            segDiv.style.width = `${pct}%`;

            const timeStr = `${formatMinutesTime(seg.start)} - ${formatMinutesTime(seg.end)}`;
            if (seg.type === 'class') {
                segDiv.title = `${seg.subject} (${seg.room}) · ${timeStr}`;
            } else {
                segDiv.title = `Free Time · ${timeStr}`;
            }
            bar.appendChild(segDiv);
        });
    }

    const indicator = document.getElementById('timeline-arrow-indicator');
    const arrowTime = document.getElementById('timeline-arrow-time');
    if (indicator) {
        const nowMins = now.getHours() * 60 + now.getMinutes() + now.getSeconds() / 60;
        const progress = ((nowMins - earliest) / totalRange) * 100;
        const clampedProgress = Math.min(Math.max(progress, 0), 100);
        indicator.style.left = `${clampedProgress}%`;

        if (arrowTime) {
            arrowTime.textContent = formatAMPM(now);
        }

        if (nowMins < earliest || nowMins > latest) {
            indicator.style.opacity = '0.6';
        } else {
            indicator.style.opacity = '1';
        }
    }
}

function renderUI(timetable) {
    const now = new Date();
    const todayName = days[now.getDay()];

    // Update Header Date
    document.getElementById('date-display').textContent = `LGU · ${now.toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })}`;

    const todaysClasses = timetable[todayName] || [];

    // Render Free-time & Class Timeline Bar
    renderTimeline(timetable, todaysClasses, now);

    // Find Next Class
    let nextClass = null;
    let currentClass = null;
    let nextClassTimeDiff = Infinity;

    todaysClasses.forEach(c => {
        const start = parseTime(c.start);
        const end = parseTime(c.end);

        if (now >= start && now <= end) {
            currentClass = c;
        } else if (start > now && (start - now) < nextClassTimeDiff) {
            nextClass = c;
            nextClassTimeDiff = start - now;
        }
    });

    const nextLabel = document.getElementById('next-class-label');
    const bigTime = document.getElementById('next-class-big-time');

    if (currentClass) {
        const start = parseTime(currentClass.start);
        const end = parseTime(currentClass.end);
        const totalDurationMins = Math.round((end - start) / 60000);
        const minsPassed = Math.floor((now - start) / 60000);
        const minsLeft = Math.ceil((end - now) / 60000);

        const startThresholdMins = totalDurationMins * 0.3;
        const endThresholdMins = totalDurationMins * 0.1;

        let statusText = "";
        if (minsPassed <= startThresholdMins) {
            statusText = "Just started";
        } else if (minsLeft <= endThresholdMins) {
            statusText = "Almost there";
        } else if (totalDurationMins > 45) {
            statusText = "Still going…";
        }

        const statusSuffix = statusText ? ` · <span>${statusText}</span>` : "";
        nextLabel.innerHTML = `Ongoing: <span>${currentClass.subject}</span> in <span>${currentClass.room}</span> ends in <span>${minsLeft} minutes</span>${statusSuffix}`;
        bigTime.textContent = formatAMPM(end);
    } else if (nextClass) {
        const minsLeft = Math.ceil(nextClassTimeDiff / 60000);
        const timeText = minsLeft > 60 ? `${Math.floor(minsLeft / 60)} hrs ${minsLeft % 60} mins` : `${minsLeft} minutes`;
        nextLabel.innerHTML = `Next class: <span>${nextClass.subject}</span> in <span>${nextClass.room}</span> in <span>${timeText}</span>`;
        bigTime.textContent = formatAMPM(parseTime(nextClass.start));
    } else {
        nextLabel.innerHTML = `No more classes today!`;
        bigTime.textContent = "--:--";
    }

    // Render Today's Classes Row
    const row = document.getElementById('classes-row');
    row.innerHTML = '';

    if (todaysClasses.length === 0) {
        row.innerHTML = '<div class="class-item" style="opacity: 0.6;">No classes today</div>';
    } else {
        todaysClasses.forEach(c => {
            const start = parseTime(c.start);
            const end = parseTime(c.end);
            const isActive = (now >= start && now <= end) || (nextClass === c && !currentClass);

            const item = document.createElement('div');
            item.className = `class-item ${isActive ? 'active' : ''}`;
            item.innerHTML = `
                <div class="subject-name" title="${c.subject}">${c.subject}</div>
                ${c.teacher ? `<div class="class-teacher" title="${c.teacher}">${c.teacher}</div>` : ''}
                <div class="class-room" title="${c.room}">${c.room}</div>
                <div class="class-time">${formatAMPM(start)} - ${formatAMPM(end)}</div>
            `;
            row.appendChild(item);
        });
    }

    // Render Full Timetable
    const tbody = document.querySelector('#full-timetable tbody');
    tbody.innerHTML = '';

    const getAdjustedDay = (d) => d === 0 ? 7 : d;
    const adjustedToday = getAdjustedDay(now.getDay());

    ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'].forEach(day => {
        const tr = document.createElement('tr');
        if (day === todayName) tr.className = 'active-day';

        const classDayIndex = days.indexOf(day);
        const adjustedClassDay = getAdjustedDay(classDayIndex);

        const classesHtml = (timetable[day] || []).map(c => {
            let isOver = false;
            if (adjustedClassDay < adjustedToday) {
                isOver = true; // Past day
            } else if (adjustedClassDay === adjustedToday) {
                isOver = parseTime(c.end) < now; // Today, but time has passed
            }

            const pillClass = isOver ? 'full-class-pill over' : 'full-class-pill';
            return `<span class="${pillClass}">${c.start} - ${c.end} | ${c.subject} (${c.room})</span>`;
        }).join(' ') || '-';

        tr.innerHTML = `
            <td>${day}</td>
            <td>${classesHtml}</td>
        `;
        tbody.appendChild(tr);
    });
}

// Tab Switching logic
document.querySelectorAll('.tab').forEach(tab => {
    tab.addEventListener('click', (e) => {
        document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
        document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));

        e.target.classList.add('active');
        document.getElementById(e.target.dataset.target).classList.add('active');
    });
});

document.getElementById('refresh-btn').addEventListener('click', (e) => {
    e.preventDefault();
    loadTimetable();
});

loadTimetable();
