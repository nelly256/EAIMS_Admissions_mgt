const API_BASE = window.API_BASE || '/api';

const state = {
    courses: [],
    intakes: [],
    students: [],
    admissionLetters: [],
    notifications: [],
    lastUnreadCount: 0
};

const elements = {
    courseForm: document.getElementById('course-form'),
    studentForm: document.getElementById('student-form'),
    letterForm: document.getElementById('letter-form'),
    diplomaTable: document.getElementById('diploma-table'),
    certificateTable: document.getElementById('certificate-table'),
    intakeTable: document.getElementById('intakes-table'),
    studentTable: document.getElementById('students-table'),
    letterTable: document.getElementById('letters-table'),
    studentSelect: document.querySelector('#letter-form select[name="student_id"]'),
    courseSelect: document.querySelector('#student-form select[name="course_id"]'),
    intakeSelect: document.querySelector('#student-form select[name="intake_id"]'),
    programmeTypeSelect: document.querySelector('#student-form select[name="programme_type"]'),
    programmeTypeChart: document.getElementById('programme-type-chart'),
    applicantTypeChart: document.getElementById('applicant-type-chart'),
    insightsLocations: document.getElementById('insights-locations'),
    insightsProgrammes: document.getElementById('insights-programmes'),
    programmeTotal: document.getElementById('programme-total'),
    certificateCount: document.getElementById('certificate-count'),
    diplomaCount: document.getElementById('diploma-count'),
    certificateApplicants: document.getElementById('certificate-applicants'),
    diplomaApplicants: document.getElementById('diploma-applicants'),
    totalApplicants: document.getElementById('total-applicants'),
    courseCount: document.getElementById('course-count'),
    intakeCount: document.getElementById('intake-count'),
    intakeApplicantCount: document.getElementById('intake-applicant-count'),
    intakeApplicantLabel: document.getElementById('intake-applicant-label'),
    studentCount: document.getElementById('student-count'),
    letterCount: document.getElementById('letter-count'),
    notificationBadge: document.getElementById('notification-badge'),
    notificationDropdown: document.getElementById('notification-dropdown'),
    notificationBell: document.getElementById('notification-bell'),
    notificationList: document.getElementById('notification-list'),
    studentSearchInput: document.getElementById('student-search'),
    studentFilterType: document.getElementById('filter-programme-type'),
    clearFiltersButton: document.getElementById('clear-filters')
};

const selectedCourses = { Diploma: new Set(), Certificate: new Set() };
const selectedStudents = new Set();

function getToken() {
    return sessionStorage.getItem('eaims_token');
}

function setToken(token) {
    sessionStorage.setItem('eaims_token', token);
}

function clearToken() {
    sessionStorage.removeItem('eaims_token');
}

function isAuthenticated() {
    return !!getToken();
}

function apiFetch(url, options = {}) {
    const defaults = {
        headers: {
            'Content-Type': 'application/json',
        },
    };
    const token = getToken();
    if (token) {
        defaults.headers['Authorization'] = `Bearer ${token}`;
    }
    return fetch(`${API_BASE}${url}`, { ...defaults, ...options })
        .then(async res => {
            if (res.status === 401) {
                clearToken();
                window.location.href = 'login.html';
                throw new Error('Unauthorized');
            }
            const contentType = res.headers.get('content-type') || '';
            if (contentType.includes('application/json')) {
                const data = await res.json().catch(() => null);
                if (!res.ok && data) {
                    throw { __apiError: true, detail: data.detail || data };
                }
                return data;
            }
            if (!res.ok) {
                throw { __apiError: true, detail: 'Request failed' };
            }
            return null;
        });
}

async function refreshData() {
    try {
        const [courses, intakes, students, letters] = await Promise.all([
            apiFetch('/courses/'),
            apiFetch('/intakes/'),
            apiFetch('/students/'),
            apiFetch('/letters/')
        ]);
        state.courses = courses || [];
        state.intakes = intakes || [];
        state.students = students || [];
        state.admissionLetters = letters || [];
    } catch (err) {
        if (err.message !== 'Unauthorized') {
            showAlert('Failed to load data from server.');
        }
    }
    render();
}

function createId(list) {
    return list.length > 0 ? Math.max(...list.map((item) => item.id)) + 1 : 1;
}

function getNextSequenceNumberForIntake(intakeId) {
    const letters = state.admissionLetters.filter((letter) => {
        const student = state.students.find((item) => item.id === letter.student);
        return student && student.intake === intakeId;
    });
    return letters.length > 0 ? Math.max(...letters.map((letter) => letter.sequence_number)) + 1 : 1;
}

function getIntakeCode(intakeName) {
    const chars = intakeName.match(/\b\w/g) || [];
    return chars.slice(0, 3).join('').toUpperCase().padEnd(3, 'X');
}

function createRegistrationNumber(intake, sequenceNumber) {
    const intakeCode = getIntakeCode(intake.intake_name);
    return `${intake.academic_year}-${intakeCode}-${String(sequenceNumber).padStart(4, '0')}`;
}

function getNextSequenceNumberForCourse(courseId) {
    const letters = state.admissionLetters.filter((letter) => {
        const student = state.students.find((item) => item.id === letter.student);
        return student && student.course === courseId;
    });
    return letters.length > 0 ? Math.max(...letters.map((letter) => letter.sequence_number)) + 1 : 1;
}

function getProgrammeCode(course) {
    return course && typeof course.course_code === 'string' && course.course_code.trim().length > 0
        ? course.course_code.trim()
        : 'PG';
}

function createRegistrationNumberForCourse(course, intake, sequenceNumber) {
    const year = intake && intake.academic_year ? intake.academic_year : new Date().getFullYear();
    const yy = String(year).slice(-2).padStart(2, '0');
    const programmeTypeLetter = course && course.programme_type === 'Diploma' ? 'D' : course && course.programme_type === 'Certificate' ? 'C' : 'X';
    const programmeCode = getProgrammeCode(course);
    const seq = String(sequenceNumber).padStart(4, '0');
    return `${yy}/EAG/${programmeTypeLetter}${programmeCode}${seq}`;
}

async function updateLetterSequenceForStudent(studentId) {
    const student = state.students.find((item) => item.id === studentId);

    if (!student) {
        elements.letterForm.sequence_number.value = '';
        elements.letterForm.registration_number.value = '';
        return;
    }

    const course = state.courses.find((item) => item.id === student.course);
    if (!course) {
        elements.letterForm.sequence_number.value = '';
        elements.letterForm.registration_number.value = '';
        return;
    }

    const intake = state.intakes.find((item) => item.id === student.intake);
    const sequenceNumber = getNextSequenceNumberForCourse(course.id);
    elements.letterForm.sequence_number.value = sequenceNumber;
    elements.letterForm.registration_number.value = createRegistrationNumberForCourse(course, intake, sequenceNumber);
}

function formatDate(timestamp) {
    const date = new Date(timestamp);
    return date.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
}

function getActiveIntakeNumber() {
    const activeIntake = state.intakes.find((item) => item.is_active);
    if (!activeIntake) {
        return 0;
    }
    return activeIntake.intake_name === 'MARCH' ? 1 : activeIntake.intake_name === 'AUGUST' ? 2 : 0;
}

function renderSummary() {
    elements.courseCount.textContent = state.courses.length;
    elements.intakeCount.textContent = getActiveIntakeNumber();
    elements.studentCount.textContent = state.students.length;
    elements.letterCount.textContent = state.admissionLetters.length;
}

function toggleCourseSelection(courseId, type) {
    if (selectedCourses[type].has(courseId)) {
        selectedCourses[type].delete(courseId);
    } else {
        selectedCourses[type].add(courseId);
    }
    render();
}

function selectAllDiploma() {
    const diplomaCourses = state.courses.filter((c) => c.programme_type === 'Diploma');
    const allSelected = diplomaCourses.every((c) => selectedCourses.Diploma.has(c.id));
    if (allSelected) {
        diplomaCourses.forEach((c) => selectedCourses.Diploma.delete(c.id));
    } else {
        diplomaCourses.forEach((c) => selectedCourses.Diploma.add(c.id));
    }
    render();
}

function selectAllCertificate() {
    const certificateCourses = state.courses.filter((c) => c.programme_type === 'Certificate');
    const allSelected = certificateCourses.every((c) => selectedCourses.Certificate.has(c.id));
    if (allSelected) {
        certificateCourses.forEach((c) => selectedCourses.Certificate.delete(c.id));
    } else {
        certificateCourses.forEach((c) => selectedCourses.Certificate.add(c.id));
    }
    render();
}

async function deleteSelectedDiploma() {
    await deleteSelectedByType('Diploma');
}

async function deleteSelectedCertificate() {
    await deleteSelectedByType('Certificate');
}

async function deleteSelectedByType(type) {
    if (selectedCourses[type].size === 0) {
        showAlert(`No ${type} programmes selected for deletion.`);
        return;
    }

    const selectedIds = Array.from(selectedCourses[type]);
    const blockedIds = selectedIds.filter((id) => state.students.some((s) => s.course === id));

    if (blockedIds.length > 0) {
        showAlert('Cannot delete selected programmes. Some have students enrolled.');
        return;
    }

    try {
        await Promise.all(selectedIds.map((id) => apiFetch(`/courses/${id}/`, { method: 'DELETE' })));
        selectedCourses[type].clear();
        await refreshData();
    } catch (err) {
        if (err.message !== 'Unauthorized') {
            showAlert(err.detail || `Failed to delete selected ${type} programmes.`);
        }
    }
}

async function deleteCourse(courseId) {
    const course = state.courses.find((item) => item.id === courseId);
    if (!course) return;

    const hasStudents = state.students.some((student) => student.course === courseId);
    if (hasStudents) {
        showAlert('Cannot delete this programme. There are students enrolled in it.');
        return;
    }

    try {
        await apiFetch(`/courses/${courseId}/`, { method: 'DELETE' });
        await refreshData();
    } catch (err) {
        if (err.message !== 'Unauthorized') {
            showAlert(err.detail || 'Failed to delete programme.');
        }
    }
}

function toggleStudentSelection(studentId) {
    if (selectedStudents.has(studentId)) {
        selectedStudents.delete(studentId);
    } else {
        selectedStudents.add(studentId);
    }
    render();
}

function selectAllStudents() {
    const allSelected = state.students.length > 0 && state.students.every((student) => selectedStudents.has(student.id));
    if (allSelected) {
        selectedStudents.clear();
    } else {
        state.students.forEach((student) => selectedStudents.add(student.id));
    }
    render();
}

async function deleteSelectedStudents() {
    if (selectedStudents.size === 0) {
        showAlert('No students selected for deletion.');
        return;
    }

    const selectedIds = Array.from(selectedStudents);

    try {
        await Promise.all(selectedIds.map((id) => apiFetch(`/students/${id}/`, { method: 'DELETE' })));
        selectedStudents.clear();
        await refreshData();
    } catch (err) {
        if (err.message !== 'Unauthorized') {
            showAlert(err.detail || 'Failed to delete selected students.');
        }
    }
}

function renderCourses() {
    const diplomaCourses = state.courses.filter((course) => course.programme_type === 'Diploma');
    const certificateCourses = state.courses.filter((course) => course.programme_type === 'Certificate');

    const renderCourseTable = (courses, typePrefix, type) =>
        courses
            .map((course, index) => {
                const applicantCount = state.students.filter((student) => student.course === course.id).length;
                const programmeCode = getProgrammeCode(course);
                const displayCode = `${typePrefix}${programmeCode}`;
                const isChecked = selectedCourses[type].has(course.id) ? 'checked' : '';
                return `
                <tr>
                    <td><input type="checkbox" ${isChecked} onchange="toggleCourseSelection(${course.id}, '${type}')"></td>
                    <td>${index + 1}</td>
                    <td>${displayCode}</td>
                    <td>${course.course_name}</td>
                    <td>${course.capacity_limit}</td>
                    <td>${applicantCount}</td>
                </tr>`;
            })
            .join('');

    elements.diplomaTable.innerHTML = renderCourseTable(diplomaCourses, 'D', 'Diploma');
    elements.certificateTable.innerHTML = renderCourseTable(certificateCourses, 'C', 'Certificate');
}

function renderIntakes() {
    elements.intakeTable.innerHTML = state.intakes
        .map(
            (intake, index) => `
            <tr>
                <td>${index + 1}</td>
                <td>${intake.intake_name}</td>
                <td>${intake.academic_year}</td>
                <td><span class="status-badge ${intake.is_active ? 'active' : 'inactive'}">${intake.is_active ? 'Open' : 'Closed'}</span></td>
            </tr>`
        )
        .join('');
}

function renderIntakeProjection() {
    const activeIntake = state.intakes.find((intake) => intake.is_active);
    const applicantCount = activeIntake
        ? state.students.filter((student) => student.intake === activeIntake.id).length
        : 0;

    if (elements.intakeApplicantCount) {
        elements.intakeApplicantCount.textContent = applicantCount;
    }
    if (elements.intakeApplicantLabel) {
        elements.intakeApplicantLabel.textContent = activeIntake
            ? `Students applied for ${activeIntake.intake_name} ${activeIntake.academic_year}`
            : 'Students applied for the active intake';
    }
}

function renderStudents() {
    const term = (elements.studentSearchInput?.value || '').trim().toLowerCase();
    const typeFilter = elements.studentFilterType?.value || '';

    const filtered = state.students.filter((student) => {
        if (term) {
            const values = [
                student.full_name || '',
                student.email || '',
            ];
            if (!values.some((v) => v.toLowerCase().includes(term))) {
                return false;
            }
        }

        if (typeFilter && student.programme_type !== typeFilter) {
            return false;
        }

        return true;
    });

    if (!elements.studentTable) {
        console.error('Student table element not found');
        return;
    }

    console.log('renderStudents:', { total: state.students.length, filtered: filtered.length, term, typeFilter });

    if (filtered.length === 0) {
        elements.studentTable.innerHTML = '<tr><td colspan="9" style="text-align:center;color:#94a3b8;">No students found</td></tr>';
        return;
    }

    elements.studentTable.innerHTML = filtered
        .map((student, index) => {
            const course = state.courses.find((item) => item.id === student.course);
            const intake = state.intakes.find((item) => item.id === student.intake);
            const isChecked = selectedStudents.has(student.id) ? 'checked' : '';
            return `
            <tr>
                <td><input type="checkbox" ${isChecked} onchange="toggleStudentSelection(${student.id})"></td>
                <td>${index + 1}</td>
                <td>${student.full_name}</td>
                <td>${course ? course.course_name : 'N/A'}</td>
                <td>${student.programme_type || 'N/A'}</td>
                <td>${student.address ? student.address : 'N/A'}</td>
                <td>${student.email ? student.email : 'N/A'}</td>
                <td>${intake ? intake.intake_name : 'N/A'}</td>
                <td>${formatDate(student.created_at)}</td>
            </tr>`;
        })
        .join('');
}

function renderLetters() {
    elements.letterTable.innerHTML = state.admissionLetters
        .map((letter, index) => {
            const student = state.students.find((item) => item.id === letter.student);
            return `
            <tr>
                <td>${index + 1}</td>
                <td>${student ? student.full_name : 'Unknown'}</td>
                <td>${letter.registration_number}</td>
                <td>${letter.sequence_number}</td>
                <td>${formatDate(letter.generated_date)}</td>
            </tr>`;
        })
        .join('');
}

function populateCourseOptions(type) {
    const options = state.courses
        .filter((course) => !type || course.programme_type === type)
        .map((course) => `<option value="${course.id}">${course.course_code} — ${course.course_name}</option>`)
        .join('');

    elements.courseSelect.innerHTML = '<option value="">Select programme</option>' + options;
}

function refreshSelects() {
    const selectedType = elements.programmeTypeSelect ? elements.programmeTypeSelect.value : '';
    populateCourseOptions(selectedType);
    if (elements.intakeSelect) {
        elements.intakeSelect.innerHTML = '<option value="">Select intake</option>' +
            state.intakes.map((intake) => `<option value="${intake.id}">${intake.intake_name} (${intake.academic_year})</option>`).join('');
    }

    if (elements.studentSelect) {
        elements.studentSelect.innerHTML = '<option value="">Choose student</option>' +
            state.students
                .filter((student) => !state.admissionLetters.some((letter) => letter.student === student.id))
                .map((student) => `<option value="${student.id}">${student.full_name}${student.address ? ' — ' + student.address : ''}</option>`)
                .join('');
    }
}

function populateStudentFilters() {
    if (elements.studentFilterType) {
        elements.studentFilterType.innerHTML = `
            <option value="">All Types</option>
            <option value="Diploma">Diploma</option>
            <option value="Certificate">Certificate</option>
        `;
    }
}

function setupStudentFilters() {
    if (elements.studentFilterType) {
        elements.studentFilterType.addEventListener('change', () => renderStudents());
    }

    if (elements.clearFiltersButton) {
        elements.clearFiltersButton.addEventListener('click', () => {
            if (elements.studentSearchInput) elements.studentSearchInput.value = '';
            if (elements.studentFilterType) elements.studentFilterType.value = '';
            renderStudents();
        });
    }
}

function renderProgrammeStats() {
    const certificateProgrammes = state.courses.filter((course) => course.programme_type === 'Certificate').length;
    const diplomaProgrammes = state.courses.filter((course) => course.programme_type === 'Diploma').length;
    const totalProgrammes = certificateProgrammes + diplomaProgrammes;
    const certificateApplicants = state.students.filter((student) => {
        const course = state.courses.find((item) => item.id === student.course);
        return course && course.programme_type === 'Certificate';
    }).length;
    const diplomaApplicants = state.students.filter((student) => {
        const course = state.courses.find((item) => item.id === student.course);
        return course && course.programme_type === 'Diploma';
    }).length;
    const totalApplicants = certificateApplicants + diplomaApplicants;

    if (elements.programmeTotal) {
        elements.programmeTotal.textContent = totalProgrammes;
    }
    if (elements.certificateCount) {
        elements.certificateCount.textContent = certificateProgrammes;
    }
    if (elements.diplomaCount) {
        elements.diplomaCount.textContent = diplomaProgrammes;
    }
    if (elements.certificateApplicants) {
        elements.certificateApplicants.textContent = certificateApplicants;
    }
    if (elements.diplomaApplicants) {
        elements.diplomaApplicants.textContent = diplomaApplicants;
    }
    if (elements.totalApplicants) {
        elements.totalApplicants.textContent = totalApplicants;
    }

    updateDoughnutChart(elements.programmeTypeChart, certificateProgrammes, totalProgrammes, 'Programme type distribution');
    updateDoughnutChart(elements.applicantTypeChart, certificateApplicants, totalApplicants, 'Applicant type distribution');
}

function updateDoughnutChart(chart, certificateValue, totalValue, label) {
    if (!chart) {
        return;
    }

    const certificatePercent = totalValue > 0 ? (certificateValue / totalValue) * 100 : 0;
    const diplomaValue = totalValue - certificateValue;
    chart.style.setProperty('--certificate-percent', certificatePercent);
    chart.style.setProperty('--has-data', totalValue > 0 ? 1 : 0);
    chart.setAttribute('aria-label', `${label}: ${totalValue} total; ${certificateValue} certificate and ${diplomaValue} diploma.`);
}

function renderDemographicInsights() {
    if (elements.insightsLocations) {
        const locationCounts = {};
        state.students.forEach((student) => {
            const rawAddress = (student.address || '').trim();
            const location = rawAddress ? rawAddress.split(',')[0].trim() : 'Unknown';
            locationCounts[location] = (locationCounts[location] || 0) + 1;
        });

        const sortedLocations = Object.entries(locationCounts)
            .sort((a, b) => b[1] - a[1])
            .slice(0, 6);

        elements.insightsLocations.innerHTML = sortedLocations.length > 0
            ? sortedLocations.map(([location, count]) => `<li><span>${location}</span><strong>${count}</strong></li>`).join('')
            : '<li><span>No data yet</span></li>';
    }

    if (elements.insightsProgrammes) {
        const programmeCounts = {};
        state.students.forEach((student) => {
            const course = state.courses.find((item) => item.id === student.course);
            const programmeName = course ? course.course_name : 'Unknown Programme';
            programmeCounts[programmeName] = (programmeCounts[programmeName] || 0) + 1;
        });

        const sortedProgrammes = Object.entries(programmeCounts)
            .sort((a, b) => b[1] - a[1])
            .slice(0, 6);

        elements.insightsProgrammes.innerHTML = sortedProgrammes.length > 0
            ? sortedProgrammes.map(([programme, count]) => `<li><span>${programme}</span><strong>${count}</strong></li>`).join('')
            : '<li><span>No data yet</span></li>';
    }
}

function render() {
    try { renderSummary(); } catch (e) { console.error('renderSummary error:', e); }
    try { renderCourses(); } catch (e) { console.error('renderCourses error:', e); }
    try { renderProgrammeStats(); } catch (e) { console.error('renderProgrammeStats error:', e); }
    try { renderDemographicInsights(); } catch (e) { console.error('renderDemographicInsights error:', e); }
    try { renderIntakes(); } catch (e) { console.error('renderIntakes error:', e); }
    try { renderIntakeProjection(); } catch (e) { console.error('renderIntakeProjection error:', e); }
    try { renderStudents(); } catch (e) { console.error('renderStudents error:', e); }
    try { renderLetters(); } catch (e) { console.error('renderLetters error:', e); }
    try { refreshSelects(); } catch (e) { console.error('refreshSelects error:', e); }
}

/* ===== Notifications ===== */

async function fetchNotifications() {
    try {
        state.notifications = await apiFetch('/notifications/?ordering=-created_at') || [];
    } catch (err) {
        if (err.message !== 'Unauthorized') {
            state.notifications = [];
        }
    }
    renderNotifications();
    renderNotificationBadge();
}

function renderNotificationBadge() {
    const unreadCount = state.notifications.filter((n) => !n.is_read).length;

    if (elements.notificationBadge) {
        elements.notificationBadge.textContent = unreadCount;
        elements.notificationBadge.style.display = unreadCount > 0 ? 'inline-flex' : 'none';
    }

    if (unreadCount > state.lastUnreadCount) {
        elements.notificationBell?.classList.add('shake');
        setTimeout(() => elements.notificationBell?.classList.remove('shake'), 600);
    }
    state.lastUnreadCount = unreadCount;
}

function renderNotifications() {
    if (!elements.notificationList) return;

    if (state.notifications.length === 0) {
        elements.notificationList.innerHTML = '<div class="notification-empty">No notifications yet</div>';
        return;
    }

    elements.notificationList.innerHTML = state.notifications
        .slice(0, 10)
        .map((notification) => {
            const cls = notification.is_read ? '' : 'unread';
            const time = notification.time_since || formatDate(notification.created_at);
            return `
            <div class="notification-item ${cls}" onclick="markNotificationRead(${notification.id})">
                <p class="notification-message">${escapeHtml(notification.message)}</p>
                <span class="notification-time">${time}</span>
            </div>`;
        })
        .join('');
}

function escapeHtml(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

async function markNotificationRead(notificationId) {
    try {
        await apiFetch(`/notifications/${notificationId}/mark_read/`, { method: 'POST' });
    } catch (err) {
        if (err.message !== 'Unauthorized') {
            // ignore
        }
    }
    await fetchNotifications();
}

async function markAllNotificationsRead() {
    try {
        await apiFetch('/notifications/mark_all_read/', { method: 'POST' });
    } catch (err) {
        if (err.message !== 'Unauthorized') {
            // ignore
        }
    }
    await fetchNotifications();
}

function setupNotificationBell() {
    elements.notificationBell?.addEventListener('click', (e) => {
        e.stopPropagation();
        elements.notificationDropdown?.classList.toggle('show');
    });

    document.addEventListener('click', () => {
        elements.notificationDropdown?.classList.remove('show');
    });

    const markAllBtn = document.getElementById('mark-all-read');
    if (markAllBtn) {
        markAllBtn.addEventListener('click', async (e) => {
            e.stopPropagation();
            await markAllNotificationsRead();
        });
    }
}

function startNotificationPolling() {
    fetchNotifications();
    setInterval(fetchNotifications, 10000);
}

function showAlert(message) {
    alert(message);
}

async function handleCourseSubmit(event) {
    event.preventDefault();
    const form = event.target;
    const courseCode = form.course_code.value.trim();
    const courseName = form.course_name.value.trim();
    const programmeType = form.programme_type.value;
    const capacity = Number(form.capacity_limit.value) || 50;

    if (!courseCode || !courseName || !programmeType) {
        showAlert('Please fill in the course code, course name, and programme type.');
        return;
    }

    try {
        await apiFetch('/courses/', {
            method: 'POST',
            body: JSON.stringify({
                course_code: courseCode,
                course_name: courseName,
                programme_type: programmeType,
                capacity_limit: capacity,
            }),
        });
        form.reset();
        form.capacity_limit.value = 50;
        await refreshData();
    } catch (err) {
        if (err.message !== 'Unauthorized') {
            showAlert(err.detail || err.message || 'Failed to add programme.');
        }
    }
}

async function handleStudentSubmit(event) {
    event.preventDefault();
    const form = event.target;
    const fullName = form.full_name.value.trim();
    const address = form.address ? form.address.value.trim() : '';
    const email = form.email ? form.email.value.trim() : '';
    const programmeType = form.programme_type.value;
    const courseId = Number(form.course_id.value);

    if (!fullName || !programmeType || !courseId) {
        showAlert('Please complete all student fields.');
        return;
    }

    const activeIntake = state.intakes.find((intake) => intake.is_active);
    if (!activeIntake) {
        showAlert('No active intake available. Please set an active intake first.');
        return;
    }

    try {
        await apiFetch('/students/', {
            method: 'POST',
            body: JSON.stringify({
                full_name: fullName,
                address: address,
                email: email,
                programme_type: programmeType,
                course: courseId,
                intake: activeIntake.id,
            }),
        });
        form.reset();
        await refreshData();
    } catch (err) {
        if (err.message !== 'Unauthorized') {
            showAlert(err.detail || err.message || 'Failed to add student.');
        }
    }
}

async function handleLetterSubmit(event) {
    event.preventDefault();
    const form = event.target;
    const studentId = Number(form.student_id.value);
    const registrationNumber = form.registration_number.value.trim();
    const sequenceNumber = Number(form.sequence_number.value);

    if (!studentId) {
        showAlert('Please choose a student.');
        return;
    }

    if (!sequenceNumber || !registrationNumber) {
        showAlert('Could not generate a sequence number or registration number for the selected student.');
        return;
    }

    try {
        await apiFetch('/letters/', {
            method: 'POST',
            body: JSON.stringify({
                student: studentId,
                registration_number: registrationNumber,
                sequence_number: sequenceNumber,
            }),
        });
        form.reset();
        await refreshData();
    } catch (err) {
        if (err.message !== 'Unauthorized') {
            showAlert(err.detail || err.message || 'Failed to generate admission letter.');
        }
    }
}

async function setActiveIntake(intakeName) {
    const intake = state.intakes.find((item) => item.intake_name === intakeName);
    if (!intake) return;

    try {
        await apiFetch(`/intakes/${intake.id}/activate/`, { method: 'POST' });
    } catch (err) {
        if (err.message !== 'Unauthorized') {
            showAlert(err.detail || err.message || 'Failed to activate intake.');
        }
    }

    const intakeButtons = document.querySelectorAll('.choice-button');
    intakeButtons.forEach((button) => {
        button.classList.toggle('active', button.dataset.intakeName === intakeName);
    });

    await refreshData();
}

function setupTabs() {
    const tabs = document.querySelectorAll('.tab-button');
    const panels = document.querySelectorAll('.tab-panel');

    tabs.forEach((button) => {
        button.addEventListener('click', () => {
            tabs.forEach((item) => item.classList.remove('active'));
            panels.forEach((panel) => panel.classList.remove('active'));

            button.classList.add('active');
            const panel = document.getElementById(button.dataset.target);
            if (panel) {
                panel.classList.add('active');
            }

            if (button.dataset.target === 'students') {
                renderStudents();
            }
        });
    });
}

function setupIntakeButtons() {
    const intakeButtons = document.querySelectorAll('.choice-button');
    intakeButtons.forEach((button) => {
        button.addEventListener('click', () => {
            setActiveIntake(button.dataset.intakeName);
        });
    });
}

async function resetIntakeSelection() {
    await setActiveIntake('MARCH');
}

async function handleLogin(event) {
    event.preventDefault();
    const form = event.target;
    const username = form.querySelector('input[name="username"]').value.trim();
    const password = form.querySelector('input[name="password"]').value.trim();

    try {
        const res = await fetch(`${API_BASE}/auth/token/`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username, password }),
        });

        if (!res.ok) {
            showAlert('Invalid username or password.');
            return;
        }

        const data = await res.json();
        setToken(data.access);
        window.location.href = '/';
    } catch (err) {
        showAlert('Login failed. Please try again.');
    }
}

function handleForgotPassword() {
    showAlert('Please contact the system administrator to reset your password.');
}

function logout() {
    clearToken();
    window.location.href = '/login.html';
}

async function init() {
    const loginForm = document.getElementById('login-form');
    if (loginForm) {
        loginForm.addEventListener('submit', handleLogin);
        const forgotPasswordButton = document.getElementById('forgot-password-button');
        if (forgotPasswordButton) {
            forgotPasswordButton.addEventListener('click', handleForgotPassword);
        }
        return;
    }

    if (!isAuthenticated()) {
        window.location.href = '/login.html';
        return;
    }

    if (!elements.courseForm || !elements.studentForm || !elements.letterForm) {
        return;
    }

    setupTabs();
    await refreshData();
    await fetchNotifications();
    populateStudentFilters();
    renderStudents();

    if (elements.studentSearchInput) {
        elements.studentSearchInput.value = '';
    }

    elements.courseForm.addEventListener('submit', handleCourseSubmit);
    elements.studentForm.addEventListener('submit', handleStudentSubmit);
    elements.letterForm.addEventListener('submit', handleLetterSubmit);
    if (elements.studentSelect) {
        elements.studentSelect.addEventListener('change', (event) => {
            updateLetterSequenceForStudent(Number(event.target.value));
        });
    }
    if (elements.programmeTypeSelect) {
        elements.programmeTypeSelect.addEventListener('change', () => {
            const selectedType = elements.programmeTypeSelect.value;
            populateCourseOptions(selectedType);
        });
    }
    setupIntakeButtons();
    setupNotificationBell();
    setupStudentFilters();
    resetIntakeSelection();
    startNotificationPolling();

    const logoutButton = document.getElementById('logout-button');
    if (logoutButton) {
        logoutButton.addEventListener('click', logout);
    }

    if (elements.studentSearchInput) {
        elements.studentSearchInput.addEventListener('input', () => renderStudents());
    }
}

window.addEventListener('DOMContentLoaded', init);
