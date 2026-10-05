const days = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

async function loadTimetable() {
    try {
        const response = await fetch('timetable.json');
        if (!response.ok) throw new Error("timetable.json not found");
        const timetable = await response.json();
        renderUI(timetable);
        setInterval(() => renderUI(timetable), 60000); // update every minute
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

function renderUI(timetable) {
    const now = new Date();
    const todayName = days[now.getDay()];
    
    // Update Header Date
    document.getElementById('date-display').textContent = `LGU · ${now.toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })}`;

    const todaysClasses = timetable[todayName] || [];
    
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
        const end = parseTime(currentClass.end);
        const minsLeft = Math.ceil((end - now) / 60000);
        nextLabel.innerHTML = `Ongoing: <span>${currentClass.subject}</span> ends in <span>${minsLeft} minutes</span>`;
        bigTime.textContent = formatAMPM(end);
    } else if (nextClass) {
        const minsLeft = Math.ceil(nextClassTimeDiff / 60000);
        const timeText = minsLeft > 60 ? `${Math.floor(minsLeft/60)} hrs ${minsLeft%60} mins` : `${minsLeft} minutes`;
        nextLabel.innerHTML = `Next class: <span>${nextClass.subject}</span> in <span>${timeText}</span>`;
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
                <div class="class-time">${formatAMPM(start)}</div>
            `;
            row.appendChild(item);
        });
    }

    // Render Full Timetable
    const tbody = document.querySelector('#full-timetable tbody');
    tbody.innerHTML = '';
    
    ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'].forEach(day => {
        const tr = document.createElement('tr');
        if (day === todayName) tr.className = 'active-day';
        
        const classesHtml = (timetable[day] || []).map(c => 
            `<span class="full-class-pill">${c.start} - ${c.subject}</span>`
        ).join(' ') || '-';
        
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
