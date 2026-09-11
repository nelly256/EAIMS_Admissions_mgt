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
    studentSelect: document.querySelector('#letter-form #student-search-input'),
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
    notificationsTable: document.getElementById('notifications-table'),
    notificationDropdown: document.getElementById('notification-dropdown'),
    notificationBell: document.getElementById('notification-bell'),
    notificationList: document.getElementById('notification-list'),
    studentSearchInput: document.getElementById('student-search'),
    studentFilterType: document.getElementById('filter-programme-type'),
    clearFiltersButton: document.getElementById('clear-filters'),
    // Letter preview modal elements
    letterPreviewModal: document.getElementById('letter-preview-modal'),
    letterPreviewFrame: document.getElementById('letter-preview-frame'),
    letterPreviewClose: document.getElementById('letter-preview-close'),
    previewDownloadPdf: document.getElementById('preview-download-pdf'),
    previewPrint: document.getElementById('preview-print'),
    previewShareEmail: document.getElementById('preview-share-email'),
    previewClose: document.getElementById('preview-close'),
    // Email confirmation modal elements
    emailConfirmModal: document.getElementById('email-confirm-modal'),
    emailConfirmClose: document.getElementById('email-confirm-close'),
    emailConfirmCancel: document.getElementById('email-confirm-cancel'),
    emailConfirmSend: document.getElementById('email-confirm-send'),
    emailConfirmTo: document.getElementById('email-confirm-to'),
    emailConfirmSubject: document.getElementById('email-confirm-subject'),
    emailConfirmMessage: document.getElementById('email-confirm-message'),
    overviewTotal: document.getElementById('overview-total'),
    overviewAdmitted: document.getElementById('overview-admitted'),
    overviewProgress: document.getElementById('overview-progress'),
    overviewHint: document.getElementById('overview-hint'),
};

const selectedCourses = { Diploma: new Set(), Certificate: new Set() };
const selectedStudents = new Set();

function getToken() {
    return sessionStorage.getItem('eaims_token');
}

function getRefreshToken() {
    return sessionStorage.getItem('eaims_refresh_token');
}

function setToken(token) {
    sessionStorage.setItem('eaims_token', token);
}

function setRefreshToken(token) {
    sessionStorage.setItem('eaims_refresh_token', token);
}

function clearToken() {
    sessionStorage.removeItem('eaims_token');
    sessionStorage.removeItem('eaims_refresh_token');
}

function isAuthenticated() {
    return !!getToken();
}

function apiFetch(url, options = {}, retryCount = 0) {
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
            if (res.status === 401 && retryCount === 0) {
                const refreshed = await tryRefreshToken();
                if (refreshed) {
                    const newToken = getToken();
                    defaults.headers['Authorization'] = `Bearer ${newToken}`;
                    const retryRes = await fetch(`${API_BASE}${url}`, { ...defaults, ...options });
                    if (retryRes.status === 401) {
                        clearToken();
                        window.location.href = 'login.html';
                        throw new Error('Unauthorized');
                    }
                    const contentType = retryRes.headers.get('content-type') || '';
                    if (contentType.includes('application/json')) {
                        const data = await retryRes.json().catch(() => null);
                        if (!retryRes.ok && data) {
                            throw { __apiError: true, detail: data.detail || data };
                        }
                        return data;
                    }
                    if (!retryRes.ok) {
                        throw { __apiError: true, detail: 'Request failed' };
                    }
                    return null;
                }
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

async function tryRefreshToken() {
    const refreshToken = getRefreshToken();
    if (!refreshToken) return false;
    try {
        const res = await fetch(`${API_BASE}/auth/token/refresh/`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ refresh: refreshToken }),
        });
        if (!res.ok) return false;
        const data = await res.json();
        setToken(data.access);
        if (data.refresh) {
            setRefreshToken(data.refresh);
        }
        return true;
    } catch (err) {
        return false;
    }
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

async function resetSequenceNumber() {
    const studentId = getSelectedStudentId();
    if (!studentId) {
        return;
    }
    await updateLetterSequenceForStudent(studentId);
}

function getSelectedStudentId() {
    const name = elements.studentSelect?.value?.trim();
    if (!name) {
        elements.letterForm.sequence_number.value = '';
        elements.letterForm.registration_number.value = '';
        return null;
    }
    const student = state.students.find((item) => item.full_name.toLowerCase() === name.toLowerCase());
    return student ? student.id : null;
}

function updateRegistrationNumberFromSequence() {
    const studentId = getSelectedStudentId();
    if (!studentId) {
        return;
    }
    const student = state.students.find((item) => item.id === Number(studentId));
    if (!student) {
        return;
    }
    const course = state.courses.find((item) => item.id === student.course);
    if (!course) {
        return;
    }
    const intake = state.intakes.find((item) => item.id === student.intake);
    const sequenceNumber = Number(elements.letterForm.sequence_number.value);
    if (sequenceNumber) {
        elements.letterForm.registration_number.value = createRegistrationNumberForCourse(course, intake, sequenceNumber);
    }
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
    updateOverviewCard();
}

function updateOverviewCard() {
    const total = state.students.length;
    const admitted = state.admissionLetters.length;
    const pending = total - admitted;
    const percentage = total > 0 ? Math.round((admitted / total) * 100) : 0;

    if (elements.overviewTotal) {
        elements.overviewTotal.textContent = total;
    }
    if (elements.overviewAdmitted) {
        elements.overviewAdmitted.textContent = admitted;
    }
    if (elements.overviewProgress) {
        elements.overviewProgress.style.width = `${percentage}%`;
    }
    if (elements.overviewHint) {
        elements.overviewHint.textContent = `${percentage}% of applicants admitted`;
    }
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
    const intakeAbbreviations = { 'MARCH': 'MAR', 'AUGUST': 'AUG' };
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
            const intakeDisplay = intake ? (intakeAbbreviations[intake.intake_name.toUpperCase()] || intake.intake_name.slice(0, 3).toUpperCase()) : 'N/A';
            return `
            <tr>
                <td><input type="checkbox" ${isChecked} onchange="toggleStudentSelection(${student.id})"></td>
                <td>${index + 1}</td>
                <td>${student.full_name}</td>
                <td>${course ? course.course_name : 'N/A'}</td>
                <td>${student.programme_type || 'N/A'}</td>
                <td>${student.address ? student.address : 'N/A'}</td>
                <td>${student.email ? student.email : 'N/A'}</td>
                <td>${intakeDisplay}</td>
                <td>${formatDate(student.created_at)}</td>
            </tr>`;
        })
        .join('');
}

function renderLetters() {
    elements.letterTable.innerHTML = state.admissionLetters
        .map((letter, index) => {
            const student = state.students.find((item) => item.id === letter.student);
            const programme = student && student.course ? student.course.course_name : '—';
            const intake = student && student.intake ? `${student.intake.intake_name} ${student.intake.academic_year}` : '—';
            const statusClass = `status-badge ${letter.status || 'not_generated'}`;
            const statusText = letter.status_display || letter.status || 'Not Generated';
            const canView = letter.status !== 'not_generated';
            const canResend = letter.status === 'sent' || letter.status === 'generated';

            return `
            <tr>
                <td>${index + 1}</td>
                <td>${student ? student.full_name : 'Unknown'}</td>
                <td>${letter.registration_number}</td>
                <td>${programme}</td>
                <td>${intake}</td>
                <td>${formatDate(letter.generated_date)}</td>
                <td><span class="${statusClass}">${statusText}</span></td>
                <td>
                    <div class="action-buttons">
                        <button class="icon-button view" onclick="previewLetter(${letter.id})" ${!canView ? 'disabled' : ''} title="View Letter">👁</button>
                        <button class="icon-button resend" onclick="resendLetter(${letter.id})" ${!canResend ? 'disabled' : ''} title="Resend Email">↻</button>
                    </div>
                </td>
            </tr>`;
        })
        .join('');
}

/* ===== Admission Letter Preview & Email ===== */

let currentPreviewLetterId = null;

async function previewLetter(letterId) {
    currentPreviewLetterId = letterId;
    try {
        const letter = await apiFetch(`/letters/${letterId}/preview/`);
        renderLetterPreview(letter);
        openLetterPreviewModal();
    } catch (err) {
        if (err.message !== 'Unauthorized') {
            showAlert(err.detail || err.message || 'Failed to load letter preview.');
        }
    }
}

function renderLetterPreview(letter) {
    const studentName = letter.student_name || 'Student';
    const programme = letter.programme || '—';
    const intake = letter.intake || '—';
    const regNumber = letter.registration_number || '—';
    const seqNumber = letter.sequence_number || '—';
    const admissionDate = letter.generated_date ? formatDate(letter.generated_date) : '—';
    const studentEmail = letter.student_email || '';

    // Determine qualification and duration based on programme type
    const student = state.students.find(s => s.id === letter.student);
    const isDiploma = student && student.programme_type === 'Diploma';
    const qualification = isDiploma ? 'Diploma' : 'Certificate';
    const duration = isDiploma ? 'two-year' : 'one-year';
    const startDate = letter.generated_date ? formatDate(letter.generated_date) : '—';

    // Student number
    const studentNumber = letter.student_number || '—';

    const html = `
    <!DOCTYPE html>
    <html>
    <head>
        <meta charset="UTF-8">
        <style>
            @import url('https://fonts.googleapis.com/css2?family=Times+New+Roman&display=swap');
            * { margin: 0; padding: 0; box-sizing: border-box; }
            body { 
                font-family: 'Times New Roman', Times, serif; 
                color: #000; 
                line-height: 1.6; 
                padding: 2cm;
                font-size: 11.5pt;
            }
            /* Header */
            .header-table { width: 100%; border-collapse: collapse; margin-bottom: 6px; }
            .header-table td { vertical-align: top; padding: 0; }
            .logo-cell { width: 90px; }
            .logo-img { width: 85px; height: 85px; object-fit: contain; }
            .logo-fallback { 
                width: 75px; height: 75px; 
                background: linear-gradient(45deg, #FFD700 0%, #FFD700 50%, #228B22 50%, #228B22 100%);
                display: flex;
            }
            .logo-fallback::after {
                content: '';
                position: absolute;
                width: 75px; height: 75px;
                background: linear-gradient(45deg, #1E3A8A 0%, #1E3A8A 50%, #CC0000 50%, #CC0000 100%);
                top: 37px; left: 37px;
            }
            .text-cell { text-align: center; }
            .inst-name { 
                font-family: 'Times New Roman', Times, serif; 
                font-weight: bold; 
                font-size: 14pt; 
                line-height: 17pt; 
                margin-bottom: 2px; 
            }
            .office-name { 
                font-family: 'Times New Roman', Times, serif; 
                font-weight: bold; 
                font-size: 11pt; 
                line-height: 14pt; 
                margin-bottom: 4px; 
            }
            .header-info { 
                font-family: 'Times New Roman', Times, serif; 
                font-size: 8pt; 
                line-height: 10pt; 
                text-align: center; 
                color: #333; 
                margin: 1px 0;
            }
            /* Thin separator lines */
            .separator-line {
                border: none;
                height: 2px;
                margin: 2px 0;
            }
            .separator-line.green { background: #228B22; }
            .separator-line.yellow { background: #FFD700; }
            .separator-line.blue { background: #1E3A8A; }
            /* Title */
            .letter-title { 
                font-family: 'Times New Roman', Times, serif; 
                font-weight: bold; 
                font-size: 15pt; 
                line-height: 19pt; 
                text-align: center; 
                color: #CC0000; 
                margin: 6px 0 14px 0; 
            }
            /* Student details */
            .details-table { width: 100%; border-collapse: collapse; margin-bottom: 16px; }
            .details-table td { vertical-align: middle; padding: 4px 0; }
            .details-table .label { 
                font-family: 'Times New Roman', Times, serif; 
                font-weight: bold; 
                font-size: 11pt; 
                line-height: 15pt; 
                width: 220px; 
            }
            .details-table .value { 
                font-family: 'Times New Roman', Times, serif; 
                font-size: 11pt; 
                line-height: 15pt; 
            }
            /* Body text */
            .body-text { 
                font-family: 'Times New Roman', Times, serif; 
                font-size: 11.5pt; 
                line-height: 16pt; 
                text-align: justify; 
                margin-bottom: 8pt; 
            }
            .body-text b { font-weight: bold; }
            /* Document list */
            .doc-list { 
                font-family: 'Times New Roman', Times, serif; 
                font-size: 11pt; 
                line-height: 15pt; 
                text-align: justify; 
                margin: 4px 0; 
                padding-left: 20px; 
                text-indent: -20px;
            }
            /* Closing */
            .closing { 
                font-family: 'Times New Roman', Times, serif; 
                font-size: 11.5pt; 
                line-height: 16pt; 
                margin-top: 20pt; 
            }
            .signature { 
                font-family: 'Times New Roman', Times, serif; 
                font-size: 11.5pt; 
                line-height: 16pt; 
                margin-top: 40pt; 
            }
            .signature b { display: block; margin-bottom: 6pt; }
        </style>
    </head>
    <body>
        <!-- Header Table -->
        <table class="header-table">
            <tr>
                <td class="logo-cell">
                    <img src="/static/logo.jpg" alt="EAIMS Logo" class="logo-img" onerror="this.style.display='none'; this.nextElementSibling.style.display='flex';">
                    <div class="logo-fallback" style="display:none;"></div>
                </td>
                <td class="text-cell">
                    <div class="inst-name">EAST AFRICAN INSTITUTE FOR MANAGEMENT SCIENCE</div>
                    <div class="office-name">NORTHERN UGANDA REGIONAL OFFICE</div>
                    <div class="header-info">P. O. BOX 701 – GULU</div>
                    <div class="header-info">Plot 6/8 Alex Latim Road, Opposite Kingdom Hall of Jehovah Witness.</div>
                    <div class="header-info">Tel: 0772394768 / 058142176 – email: eastmstitute@yahoo.com</div>
                    <div class="header-info">EAIMS is licensed by the Ministry of Education and Sports - Ref No. UME/TVET/071</div>
                    <div class="header-info">NCHE REF: TE/PL. 052, UBTVET - C</div>
                    <div class="header-info">CENTRE No. UVT 645</div>
                </td>
            </tr>
        </table>

        <hr class="separator-line green">
        <hr class="separator-line yellow">
        <hr class="separator-line blue">

        <!-- Title -->
        <div class="letter-title">ADMISSION LETTER</div>

        <!-- Student Details -->
        <table class="details-table">
            <tr>
                <td class="label">STUDENT'S NAME:</td>
                <td class="value">${studentName}</td>
            </tr>
            <tr>
                <td class="label">REGISTRATION NUMBER:</td>
                <td class="value">${regNumber}</td>
            </tr>
            <tr>
                <td class="label">STUDENT NUMBER:</td>
                <td class="value">${studentNumber}</td>
            </tr>
        </table>

        <!-- Body Paragraphs -->
        <p class="body-text">
            I write to offer you admission at this Institute for the <b>${intake}</b> 
            for a <b>${duration}</b> course of study leading to the award of a 
            <b>${qualification}</b> IN <b>${programme.toUpperCase()}</b>.
        </p>
        <p class="body-text">
            You have been admitted as a privately sponsored student at the Institute's Main Campus 
            located on Plot 6/8 Alex Latim Road, Next to Radio Favour FM - Pece Vangard, 
            Pece – Laroo Division, Gulu City.
        </p>
        <p class="body-text">
            The course starts on <b>${startDate}</b> and therefore, you should ensure that you 
            report and register with the Institute's Admissions Office within two weeks 
            from the beginning of the semester.
        </p>
        <p class="body-text">
            This is a provisional offer made on the basis of the documents and information 
            as submitted on your application form as they will be subjected to verification. 
            You will be asked to present more (if necessary) supporting and convincing evidence 
            at the time of registration including but not limited to:
        </p>

        <!-- Document List -->
        <p class="doc-list">a) Original Uganda Advanced Certificate of Education (UACE) or its equivalent.</p>
        <p class="doc-list">b) Original Uganda Certificate of Education (UCE) or its equivalent.</p>
        <p class="doc-list">c) Two (2) current colored passport size photographs.</p>
        <p class="doc-list">d) A copy of the Identity Card from your previous school or current employer.</p>
        <p class="doc-list">e) Original National Identification Card or Birth Certificate.</p>

        <!-- Closing -->
        <p class="closing">Yours faithfully,</p>
        <p class="signature">
            <b>[Authorized Officer]</b>
            <span>EAIMS Admissions Office</span>
        </p>
    </body>
    </html>`;

    elements.letterPreviewFrame.srcdoc = html;
}

function openLetterPreviewModal() {
    if (elements.letterPreviewModal) {
        elements.letterPreviewModal.style.display = 'flex';
        document.body.style.overflow = 'hidden';
    }
}

function closeLetterPreviewModal() {
    if (elements.letterPreviewModal) {
        elements.letterPreviewModal.style.display = 'none';
        document.body.style.overflow = '';
    }
    if (elements.letterPreviewFrame) {
        elements.letterPreviewFrame.srcdoc = '';
    }
    currentPreviewLetterId = null;
}

async function downloadLetterPdf(letterId) {
    try {
        const response = await fetch(`${API_BASE}/letters/${letterId}/download-pdf/`, {
            headers: {
                'Authorization': `Bearer ${getToken()}`
            }
        });
        if (!response.ok) throw new Error('Failed to download PDF');
        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `EAIMS_Admission_Letter_${letterId}.pdf`;
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(url);
        document.body.removeChild(a);
    } catch (err) {
        showAlert('Failed to download PDF: ' + err.message);
    }
}

function printLetter() {
    if (elements.letterPreviewFrame) {
        elements.letterPreviewFrame.contentWindow.focus();
        elements.letterPreviewFrame.contentWindow.print();
    }
}

function openEmailConfirmModal(letter) {
    const studentName = letter.student_name || 'Student';
    const studentEmail = letter.student_email || letter.recipient_email || '';
    const programme = letter.programme || 'Programme';
    const intake = letter.intake || 'Intake';

    elements.emailConfirmTo.textContent = studentEmail;
    elements.emailConfirmSubject.textContent = `EAIMS Admission Letter – ${studentName}`;
    elements.emailConfirmMessage.innerHTML = `
        Dear ${studentName},<br><br>
        Congratulations!<br><br>
        We are pleased to inform you that you have been admitted to EAIMS for the
        ${programme} programme under the ${intake} intake.<br><br>
        Please find your official admission letter attached to this email.<br><br>
        Kindly review the letter and follow the instructions provided.<br><br>
        Regards,<br>
        EAIMS Admissions Office
    `;

    elements.emailConfirmModal.dataset.letterId = letter.id;
    if (elements.emailConfirmModal) {
        elements.emailConfirmModal.style.display = 'flex';
        document.body.style.overflow = 'hidden';
    }
}

function closeEmailConfirmModal() {
    if (elements.emailConfirmModal) {
        elements.emailConfirmModal.style.display = 'none';
        document.body.style.overflow = '';
    }
    delete elements.emailConfirmModal.dataset.letterId;
}

async function sendLetterEmail() {
    const letterId = elements.emailConfirmModal?.dataset.letterId;
    if (!letterId) return;

    closeEmailConfirmModal();

    try {
        const result = await apiFetch(`/letters/${letterId}/send-email/`, { method: 'POST' });
        showAlert(result.message || 'Admission letter sent successfully!');
        await refreshData();
    } catch (err) {
        if (err.message !== 'Unauthorized') {
            showAlert(err.detail || err.message || 'Failed to send email.');
        }
    }
}

async function resendLetter(letterId) {
    const letter = state.admissionLetters.find(l => l.id === letterId);
    if (!letter) return;

    const studentEmail = letter.student_email || letter.recipient_email || '';
    const studentName = letter.student_name || 'Student';

    if (confirm(`This admission letter has already been sent to ${studentEmail}. Do you want to resend it?`)) {
        try {
            const result = await apiFetch(`/letters/${letterId}/resend-email/`, { method: 'POST' });
            showAlert(result.message || 'Admission letter resent successfully!');
            await refreshData();
        } catch (err) {
            if (err.message !== 'Unauthorized') {
                showAlert(err.detail || err.message || 'Failed to resend email.');
            }
        }
    }
}

function setupLetterPreviewModal() {
    if (elements.letterPreviewClose) {
        elements.letterPreviewClose.addEventListener('click', closeLetterPreviewModal);
    }
    if (elements.previewClose) {
        elements.previewClose.addEventListener('click', closeLetterPreviewModal);
    }
    if (elements.previewDownloadPdf) {
        elements.previewDownloadPdf.addEventListener('click', () => {
            if (currentPreviewLetterId) downloadLetterPdf(currentPreviewLetterId);
        });
    }
    if (elements.previewPrint) {
        elements.previewPrint.addEventListener('click', printLetter);
    }
    if (elements.previewShareEmail) {
        elements.previewShareEmail.addEventListener('click', () => {
            const letter = state.admissionLetters.find(l => l.id === currentPreviewLetterId);
            if (letter) {
                closeLetterPreviewModal();
                openEmailConfirmModal(letter);
            }
        });
    }

    // Close on overlay click
    if (elements.letterPreviewModal) {
        elements.letterPreviewModal.addEventListener('click', (e) => {
            if (e.target === elements.letterPreviewModal) closeLetterPreviewModal();
        });
    }

    // Email confirmation modal
    if (elements.emailConfirmClose) {
        elements.emailConfirmClose.addEventListener('click', closeEmailConfirmModal);
    }
    if (elements.emailConfirmCancel) {
        elements.emailConfirmCancel.addEventListener('click', closeEmailConfirmModal);
    }
    if (elements.emailConfirmSend) {
        elements.emailConfirmSend.addEventListener('click', sendLetterEmail);
    }
    if (elements.emailConfirmModal) {
        elements.emailConfirmModal.addEventListener('click', (e) => {
            if (e.target === elements.emailConfirmModal) closeEmailConfirmModal();
        });
    }
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
        const datalist = document.getElementById('student-options');
        if (datalist) {
            datalist.innerHTML = state.students
                .filter((student) => !state.admissionLetters.some((letter) => letter.student === student.id))
                .map((student) => `<option value="${escapeHtml(student.full_name)}">${student.address ? escapeHtml(student.address) : ''}</option>`)
                .join('');
        }
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

function renderNotificationsPage() {
    if (!elements.notificationsTable) return;

    if (state.notifications.length === 0) {
        elements.notificationsTable.innerHTML = '<tr><td colspan="4" style="text-align:center;">No notifications yet</td></tr>';
        return;
    }

    elements.notificationsTable.innerHTML = state.notifications
        .map((notification, index) => {
            const cls = notification.is_read ? '' : 'unread';
            const time = notification.time_since || formatDate(notification.created_at);
            const status = notification.is_read ? 'Read' : 'Unread';
            return `
            <tr class="${cls}" data-notification-id="${notification.id}" style="cursor: pointer;">
                <td>${index + 1}</td>
                <td>${escapeHtml(notification.message)}</td>
                <td>${escapeHtml(time)}</td>
                <td>${status}</td>
            </tr>`;
        })
        .join('');

    elements.notificationsTable.querySelectorAll('tr[data-notification-id]').forEach((row) => {
        row.addEventListener('click', () => {
            const notificationId = Number(row.dataset.notificationId);
            const notification = state.notifications.find((item) => item.id === notificationId);
            if (notification) {
                openNotificationModal(notification);
            }
        });
    });
}

function openNotificationModal(notification) {
    const modal = document.getElementById('notification-modal');
    const messageEl = document.getElementById('notification-modal-message');
    const timeEl = document.getElementById('notification-modal-time');
    const statusEl = document.getElementById('notification-modal-status');

    if (!modal || !messageEl || !timeEl || !statusEl) return;

    messageEl.textContent = notification.message || '';
    timeEl.textContent = 'Time: ' + (notification.time_since || formatDate(notification.created_at) || '');
    statusEl.textContent = 'Status: ' + (notification.is_read ? 'Read' : 'Unread');

    modal.classList.add('show');
}

function closeNotificationModal() {
    const modal = document.getElementById('notification-modal');
    if (modal) {
        modal.classList.remove('show');
    }
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

    const headerLink = document.getElementById('notification-header-link');
    if (headerLink) {
        headerLink.addEventListener('click', (e) => {
            e.stopPropagation();
            elements.notificationDropdown?.classList.remove('show');
            const notificationsTab = document.querySelector('.tab-button[data-target="notifications"]');
            if (notificationsTab) {
                notificationsTab.click();
            }
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
    const studentId = getSelectedStudentId();
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
        await apiFetch('/letters/generate/', {
            method: 'POST',
            body: JSON.stringify({
                student_id: studentId,
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
        button.addEventListener('click', async () => {
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

            if (button.dataset.target === 'notifications') {
                await fetchNotifications();
                renderNotificationsPage();
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
        if (data.refresh) {
            setRefreshToken(data.refresh);
        }
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
        const handleStudentSearchInput = () => {
            const name = elements.studentSelect.value.trim();
            if (!name) {
                elements.letterForm.sequence_number.value = '';
                elements.letterForm.registration_number.value = '';
                return;
            }
            const cursorPosition = elements.studentSelect.selectionStart;
            elements.studentSelect.value = elements.studentSelect.value
                .split(' ')
                .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
                .join(' ');
            elements.studentSelect.setSelectionRange(cursorPosition, cursorPosition);
            const studentId = getSelectedStudentId();
            if (studentId) {
                updateLetterSequenceForStudent(studentId);
            }
        };
        elements.studentSelect.addEventListener('input', handleStudentSearchInput);
        elements.studentSelect.addEventListener('change', handleStudentSearchInput);
        elements.studentSelect.addEventListener('blur', handleStudentSearchInput);
    }
    const sequenceResetButton = document.getElementById('sequence-reset-button');
    if (sequenceResetButton) {
        sequenceResetButton.addEventListener('click', async () => {
            await resetSequenceNumber();
        });
    }
    if (elements.letterForm.sequence_number) {
        const updateRegFromSeq = () => updateRegistrationNumberFromSequence();
        elements.letterForm.sequence_number.addEventListener('input', updateRegFromSeq);
        elements.letterForm.sequence_number.addEventListener('change', updateRegFromSeq);
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
    setupLetterPreviewModal();
    resetIntakeSelection();
    startNotificationPolling();

    const logoutButton = document.getElementById('logout-button');
    if (logoutButton) {
        logoutButton.addEventListener('click', logout);
    }
    document.addEventListener('click', handleDocumentClick);

    const modalCloseButton = document.getElementById('notification-modal-close');
    if (modalCloseButton) {
        modalCloseButton.addEventListener('click', closeNotificationModal);
    }

    if (elements.studentSearchInput) {
        elements.studentSearchInput.addEventListener('input', () => renderStudents());
    }
}

function handleDocumentClick(event) {
    const dropdown = document.getElementById('export-dropdown');
    if (dropdown && !dropdown.contains(event.target) && !event.target.closest('.export-dropdown-button')) {
        dropdown.style.display = 'none';
    }
}

function toggleExportDropdown() {
    const dropdown = document.getElementById('export-dropdown');
    if (dropdown) {
        dropdown.style.display = dropdown.style.display === 'none' ? 'block' : 'none';
    }
}

async function exportStudents(format) {
    const dropdown = document.getElementById('export-dropdown');
    if (dropdown) {
        dropdown.style.display = 'none';
    }

    const token = getToken();
    const endpoint = format === 'pdf'
        ? '/students/export_pdf/'
        : '/students/export_docx/';
    const url = `${API_BASE}${endpoint}`;

    console.log('[Export] Requesting', format.toUpperCase(), 'from', url);

    try {
        const xhr = new XMLHttpRequest();
        xhr.open('GET', url, true);
        if (token) {
            xhr.setRequestHeader('Authorization', `Bearer ${token}`);
        }
        xhr.responseType = 'blob';

        xhr.onload = function () {
            console.log('[Export] Status:', xhr.status, 'Content-Type:', xhr.getResponseHeader('Content-Type'));

            if (xhr.status === 401) {
                clearToken();
                window.location.href = 'login.html';
                return;
            }

            if (xhr.status < 200 || xhr.status >= 300) {
                const errorText = xhr.responseText ? xhr.responseText.slice(0, 200) : 'Unknown error';
                console.error('[Export] Failed with status', xhr.status, ':', errorText);
                showAlert(`Export failed (${xhr.status}): ${errorText}`);
                return;
            }

            const blob = xhr.response;
            if (!blob || blob.size === 0) {
                console.error('[Export] Empty response blob');
                showAlert('Export failed: empty file received.');
                return;
            }

            const disposition = xhr.getResponseHeader('Content-Disposition') || '';
            const filenameMatch = disposition.match(/filename="?([^"]+)"?/);
            const fallbackName = format === 'pdf' ? 'students.pdf' : 'students.docx';
            const filename = filenameMatch && filenameMatch[1] ? filenameMatch[1] : fallbackName;

            console.log('[Export] Downloading file:', filename, 'size:', blob.size, 'bytes');

            const blobUrl = window.URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.href = blobUrl;
            link.download = filename;
            link.style.display = 'none';
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);

            setTimeout(() => window.URL.revokeObjectURL(blobUrl), 1000);
            console.log('[Export] Download triggered');
        };

        xhr.onerror = function () {
            console.error('[Export] Network error while fetching', url);
            showAlert('Export failed: network error. Check your connection.');
        };

        xhr.ontimeout = function () {
            console.error('[Export] Request timed out for', url);
            showAlert('Export failed: request timed out.');
        };

        xhr.send();
    } catch (err) {
        console.error('[Export] Exception:', err);
        if (err.message !== 'Unauthorized') {
            showAlert(err.detail || err.message || 'Export failed. Please try again.');
        }
    }
}

window.addEventListener('DOMContentLoaded', init);
