// ===== STUDY CALENDAR MODULE =====
let calendarRef = null;
let calendarUserId = null;
let currentDate = new Date(); // Month/Year currently viewed
let selectedDate = new Date(); // Selected day for reminders
let monthReminders = {};
let calendarListener = null;

function initCalendar(userId) {
  calendarUserId = userId;
  calendarRef = db.collection("users").doc(userId).collection("reminders");

  calendarListener = calendarRef.onSnapshot(
    (snapshot) => {
      monthReminders = {};
      snapshot.forEach((doc) => {
        const data = doc.data();
        const dateStr = data.dateStr;
        if (!monthReminders[dateStr]) {
          monthReminders[dateStr] = {};
        }
        monthReminders[dateStr][doc.id] = {
          text: data.text,
          time: data.time,
          createdAt: data.createdAt,
        };
      });
      renderCalendarGrid();
      renderReminders();
      checkUpcomingNotifications();
    },
    (error) => {
      console.error("Error listening for calendar reminders: ", error);
    },
  );
}

function cleanupCalendar() {
  if (calendarListener) {
    calendarListener();
    calendarListener = null;
  }
  calendarUserId = null;
  monthReminders = {};
}

// ----- MONTH NAVIGATION -----
function prevMonth() {
  currentDate.setMonth(currentDate.getMonth() - 1);
  renderCalendarGrid();
}

function nextMonth() {
  currentDate.setMonth(currentDate.getMonth() + 1);
  renderCalendarGrid();
}

// ----- RENDER CALENDAR -----
function renderCalendarGrid() {
  const monthYearLabel = document.getElementById("calendar-month-year");
  const daysGrid = document.getElementById("calendar-days");
  if (!monthYearLabel || !daysGrid) return;

  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();

  // Set header text (e.g., "May 2026")
  const monthNames = [
    "January",
    "February",
    "March",
    "April",
    "May",
    "June",
    "July",
    "August",
    "September",
    "October",
    "November",
    "December",
  ];
  monthYearLabel.textContent = `${monthNames[month]} ${year}`;

  daysGrid.innerHTML = "";

  // Get first day of the month (0 = Sunday, ..., 6 = Saturday)
  const firstDayIndex = new Date(year, month, 1).getDay();

  // Get total days in current month
  const totalDays = new Date(year, month + 1, 0).getDate();

  // Get total days in previous month for padding
  const prevTotalDays = new Date(year, month, 0).getDate();

  // Highlight today's date
  const today = new Date();

  // Calculate grid cell count (35 or 42)
  const totalCells = firstDayIndex + totalDays;
  const gridCells = totalCells <= 35 ? 35 : 42;

  // 1. Render Padding Days from Previous Month
  for (let i = firstDayIndex - 1; i >= 0; i--) {
    const dayNum = prevTotalDays - i;
    const dayDiv = document.createElement("div");
    dayDiv.className = "calendar-day outside-month";
    dayDiv.textContent = dayNum;
    daysGrid.appendChild(dayDiv);
  }

  // 2. Render Current Month Days
  for (let day = 1; day <= totalDays; day++) {
    const dayDiv = document.createElement("div");
    dayDiv.className = "calendar-day";
    dayDiv.textContent = day;

    // Date Strings for comparisons and key mappings
    const dateStr = formatDateString(year, month, day);

    // Check if this day has reminders
    const hasReminders =
      monthReminders[dateStr] &&
      Object.keys(monthReminders[dateStr]).length > 0;
    if (hasReminders) {
      const dot = document.createElement("div");
      dot.className = "reminder-dot";
      dayDiv.appendChild(dot);
    }

    // Check if Today
    const isToday =
      today.getDate() === day &&
      today.getMonth() === month &&
      today.getFullYear() === year;
    if (isToday) {
      dayDiv.classList.add("today");
    }

    // Check if Selected
    const isSelected =
      selectedDate.getDate() === day &&
      selectedDate.getMonth() === month &&
      selectedDate.getFullYear() === year;
    if (isSelected) {
      dayDiv.classList.add("selected");
    }

    // Click behavior
    dayDiv.onclick = () => selectDate(year, month, day);

    daysGrid.appendChild(dayDiv);
  }

  // 3. Render Padding Days from Next Month
  const nextMonthPadding = gridCells - totalCells;
  for (let day = 1; day <= nextMonthPadding; day++) {
    const dayDiv = document.createElement("div");
    dayDiv.className = "calendar-day outside-month";
    dayDiv.textContent = day;
    daysGrid.appendChild(dayDiv);
  }
}

function selectDate(year, month, day) {
  selectedDate = new Date(year, month, day);
  renderCalendarGrid();
  renderReminders();
}

// ----- RENDER REMINDERS -----
function renderReminders() {
  const listContainer = document.getElementById("reminders-list");
  const dateTitle = document.getElementById("selected-date-title");
  if (!listContainer || !dateTitle) return;

  const year = selectedDate.getFullYear();
  const month = selectedDate.getMonth();
  const day = selectedDate.getDate();

  const monthNames = [
    "Jan",
    "Feb",
    "Mar",
    "Apr",
    "May",
    "Jun",
    "Jul",
    "Aug",
    "Sep",
    "Oct",
    "Nov",
    "Dec",
  ];
  dateTitle.textContent = `Reminders: ${monthNames[month]} ${day}, ${year}`;

  listContainer.innerHTML = "";

  const dateStr = formatDateString(year, month, day);
  const dayReminders = monthReminders[dateStr] || {};
  const entries = Object.entries(dayReminders).sort((a, b) => {
    // Sort by time, if equal sort by creation date
    if (a[1].time && b[1].time) {
      return a[1].time.localeCompare(b[1].time);
    }
    return a[1].createdAt - b[1].createdAt;
  });

  if (entries.length === 0) {
    listContainer.innerHTML = `
      <div style="text-align: center; padding: 32px 16px; color: var(--gray-400);">
        <i class="fas fa-calendar-check" style="font-size: 2.2rem; margin-bottom: 8px; opacity: 0.6;"></i>
        <p style="font-size: 0.85rem;">No reminders set for this day.</p>
      </div>
    `;
    return;
  }

  entries.forEach(([id, reminder]) => {
    const item = document.createElement("div");
    item.className = "reminder-item";

    const formattedTime = reminder.time
      ? formatTime12Hour(reminder.time)
      : "No time set";

    item.innerHTML = `
      <div class="reminder-info">
        <span class="reminder-text">${escapeHtml(reminder.text)}</span>
        <span class="reminder-time"><i class="far fa-clock"></i> ${formattedTime}</span>
      </div>
      <button class="reminder-delete" onclick="deleteReminder('${dateStr}', '${id}', event)" title="Delete"><i class="fas fa-trash"></i></button>
    `;
    listContainer.appendChild(item);
  });
}

// ----- ADD / DELETE ACTIONS -----
function addReminder() {
  if (!calendarUserId) return;

  const textInput = document.getElementById("reminder-text-input");
  const timeInput = document.getElementById("reminder-time-input");
  if (!textInput || !timeInput) return;

  const text = textInput.value.trim();
  const time = timeInput.value;

  if (!text) {
    alert("Please enter a reminder text!");
    return;
  }

  const dateStr = formatDateString(
    selectedDate.getFullYear(),
    selectedDate.getMonth(),
    selectedDate.getDate(),
  );

  calendarRef.add({
    dateStr: dateStr,
    text: text,
    time: time,
    createdAt: Date.now(),
  });

  textInput.value = "";
  timeInput.value = "";
}

function deleteReminder(dateStr, reminderId, event) {
  if (event) event.stopPropagation();
  if (
    confirm("Are you sure you want to delete this reminder?") &&
    calendarUserId
  ) {
    calendarRef.doc(reminderId).delete();
  }
}

// ----- UTILS -----
function formatDateString(year, month, day) {
  const mm = String(month + 1).padStart(2, "0");
  const dd = String(day).padStart(2, "0");
  return `${year}-${mm}-${dd}`;
}

function formatTime12Hour(time24) {
  if (!time24) return "";
  const [hoursStr, minutesStr] = time24.split(":");
  let hours = parseInt(hoursStr);
  const minutes = minutesStr;
  const ampm = hours >= 12 ? "PM" : "AM";
  hours = hours % 12;
  hours = hours ? hours : 12; // The hour '0' should be '12'
  return `${hours}:${minutes} ${ampm}`;
}

// ----- UPCOMING NOTIFICATIONS -----
function checkUpcomingNotifications() {
  const today = new Date();

  // Today T0
  const T0 = formatDateString(
    today.getFullYear(),
    today.getMonth(),
    today.getDate(),
  );

  // Tomorrow T1
  const tomorrow = new Date(today);
  tomorrow.setDate(today.getDate() + 1);
  const T1 = formatDateString(
    tomorrow.getFullYear(),
    tomorrow.getMonth(),
    tomorrow.getDate(),
  );

  // Day After Tomorrow T2
  const dayAfter = new Date(today);
  dayAfter.setDate(today.getDate() + 2);
  const T2 = formatDateString(
    dayAfter.getFullYear(),
    dayAfter.getMonth(),
    dayAfter.getDate(),
  );

  let notifications = [];

  const scanDate = (dateStr, tag, tagText) => {
    const dayData = monthReminders[dateStr] || {};
    Object.entries(dayData).forEach(([id, reminder]) => {
      notifications.push({
        id: id,
        dateStr: dateStr,
        text: reminder.text,
        time: reminder.time,
        tag: tag,
        tagText: tagText,
        createdAt: reminder.createdAt,
      });
    });
  };

  scanDate(T0, "today", "Today");
  scanDate(T1, "tomorrow", "Tomorrow");
  scanDate(T2, "upcoming", "Upcoming");

  // Sort notifications by date string, then by time string
  notifications.sort((a, b) => {
    if (a.dateStr !== b.dateStr) {
      return a.dateStr.localeCompare(b.dateStr);
    }
    if (a.time && b.time) {
      return a.time.localeCompare(b.time);
    }
    return a.createdAt - b.createdAt;
  });

  // Render dropdowns
  const list = document.getElementById("noti-dropdown-list");
  const mobList = document.getElementById("mobile-noti-dropdown-list");
  const badge = document.getElementById("noti-badge");
  const mobBadge = document.getElementById("mobile-noti-badge");

  const lastSeen = parseInt(localStorage.getItem(`liwanag_noti_seen_${calendarUserId}`) || "0");
  let unreadCount = 0;
  notifications.forEach(n => {
    if (n.createdAt > lastSeen) unreadCount++;
  });

  // Update Badges
  if (badge && mobBadge) {
    badge.textContent = unreadCount;
    mobBadge.textContent = unreadCount;
    if (unreadCount > 0) {
      badge.classList.remove("hidden");
      mobBadge.classList.remove("hidden");
    } else {
      badge.classList.add("hidden");
      mobBadge.classList.add("hidden");
    }
  }

  const renderList = (el) => {
    if (!el) return;
    el.innerHTML = "";

    if (notifications.length === 0) {
      el.innerHTML = `
        <div style="text-align: center; padding: 24px 8px; color: var(--gray-400);">
          <i class="fas fa-bell-slash" style="font-size: 1.5rem; margin-bottom: 8px; opacity: 0.5;"></i>
          <p style="font-size: 0.8rem; margin: 0;">No upcoming reminders.</p>
        </div>
      `;
      return;
    }

    notifications.forEach((n) => {
      const formattedTime = n.time ? formatTime12Hour(n.time) : "No time set";
      const itemDiv = document.createElement("div");
      itemDiv.className = "noti-item";
      itemDiv.onclick = () => viewNotificationDate(n.dateStr);

      itemDiv.innerHTML = `
        <span class="noti-item-text">${escapeHtml(n.text)}</span>
        <div class="noti-item-meta">
          <span class="noti-tag ${n.tag}">${n.tagText}</span>
          <span class="noti-time"><i class="far fa-clock"></i> ${formattedTime}</span>
        </div>
      `;
      el.appendChild(itemDiv);
    });
  };

  renderList(list);
  renderList(mobList);
}

function toggleNotifications(event) {
  if (event) event.stopPropagation();
  const dropdown = document.getElementById("noti-dropdown");
  const mobDropdown = document.getElementById("mobile-noti-dropdown");
  if (!dropdown || !mobDropdown) return;

  let isOpening = false;

  if (
    event &&
    event.currentTarget &&
    (event.currentTarget.id === "mobile-noti-bell-btn" ||
      event.currentTarget.closest("#mobile-noti-bell-btn"))
  ) {
    mobDropdown.classList.toggle("hidden");
    dropdown.classList.add("hidden");
    isOpening = !mobDropdown.classList.contains("hidden");
  } else {
    dropdown.classList.toggle("hidden");
    mobDropdown.classList.add("hidden");
    isOpening = !dropdown.classList.contains("hidden");
  }

  if (isOpening) {
    const badge = document.getElementById("noti-badge");
    const mobBadge = document.getElementById("mobile-noti-badge");
    if (badge) badge.classList.add("hidden");
    if (mobBadge) mobBadge.classList.add("hidden");
    
    if (calendarUserId) {
      localStorage.setItem(`liwanag_noti_seen_${calendarUserId}`, Date.now().toString());
    }
  }
}

function viewNotificationDate(dateStr) {
  const [year, month, day] = dateStr.split("-").map((num) => parseInt(num));
  selectedDate = new Date(year, month - 1, day);
  currentDate = new Date(year, month - 1, 1); // transition calendar grid to this month

  switchPanel("calendar");
  renderCalendarGrid();
  renderReminders();

  const dropdown = document.getElementById("noti-dropdown");
  const mobDropdown = document.getElementById("mobile-noti-dropdown");
  if (dropdown) dropdown.classList.add("hidden");
  if (mobDropdown) mobDropdown.classList.add("hidden");
}
