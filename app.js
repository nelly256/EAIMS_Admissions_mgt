const state = {
    courses: [],
    intakes: [],
    students: [],
    admissionLetters: []
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
    programmeTotal: document.getElementById('programme-total'),
    certificateCount: document.getElementById('certificate-count'),
    diplomaCount: document.getElementById('diploma-count'),
    programmeTypeChart: document.getElementById('programme-type-chart'),
    applicantTypeChart: document.getElementById('applicant-type-chart'),
    certificateApplicants: document.getElementById('certificate-applicants'),
    diplomaApplicants: document.getElementById('diploma-applicants'),
    totalApplicants: document.getElementById('total-applicants'),
    courseCount: document.getElementById('course-count'),
    intakeCount: document.getElementById('intake-count'),
    intakeApplicantCount: document.getElementById('intake-applicant-count'),
    intakeApplicantLabel: document.getElementById('intake-applicant-label'),
    studentCount: document.getElementById('student-count'),
    letterCount: document.getElementById('letter-count')
};

function createId(list) {
    return list.length > 0 ? Math.max(...list.map((item) => item.id)) + 1 : 1;
}

function getNextSequenceNumberForIntake(intakeId) {
    const letters = state.admissionLetters.filter((letter) => {
        const student = state.students.find((item) => item.id === letter.student_id);
        return student && student.intake_id === intakeId;
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
        const student = state.students.find((item) => item.id === letter.student_id);
        return student && student.course_id === courseId;
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

function updateLetterSequenceForStudent(studentId) {
    const student = state.students.find((item) => item.id === studentId);

    if (!student) {
        elements.letterForm.sequence_number.value = '';
        elements.letterForm.registration_number.value = '';
        return;
    }

    const course = state.courses.find((item) => item.id === student.course_id);
    if (!course) {
        elements.letterForm.sequence_number.value = '';
        elements.letterForm.registration_number.value = '';
        return;
    }

    const intake = state.intakes.find((item) => item.id === student.intake_id);
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

const selectedCourses = { Diploma: new Set(), Certificate: new Set() };
const selectedStudents = new Set();

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

function deleteSelectedDiploma() {
    deleteSelectedByType('Diploma');
}

function deleteSelectedCertificate() {
    deleteSelectedByType('Certificate');
}

function deleteSelectedByType(type) {
    if (selectedCourses[type].size === 0) {
        showAlert(`No ${type} programmes selected for deletion.`);
        return;
    }
    
    const selectedIds = Array.from(selectedCourses[type]);
    const blockedIds = selectedIds.filter((id) => state.students.some((s) => s.course_id === id));
    
    if (blockedIds.length > 0) {
        showAlert('Cannot delete selected programmes. Some have students enrolled.');
        return;
    }
    
    state.courses = state.courses.filter((c) => !selectedIds.includes(c.id));
    selectedCourses[type].clear();
    render();
}

function deleteCourse(courseId) {
    const course = state.courses.find((item) => item.id === courseId);
    if (!course) return;
    
    const hasStudents = state.students.some((student) => student.course_id === courseId);
    if (hasStudents) {
        showAlert('Cannot delete this programme. There are students enrolled in it.');
        return;
    }
    
    state.courses = state.courses.filter((item) => item.id !== courseId);
    render();
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

function deleteSelectedStudents() {
    if (selectedStudents.size === 0) {
        showAlert('No students selected for deletion.');
        return;
    }

    const selectedIds = Array.from(selectedStudents);
    state.students = state.students.filter((student) => !selectedIds.includes(student.id));
    state.admissionLetters = state.admissionLetters.filter((letter) => !selectedIds.includes(letter.student_id));
    selectedStudents.clear();
    render();
}

function renderCourses() {
    const diplomaCourses = state.courses.filter((course) => course.programme_type === 'Diploma');
    const certificateCourses = state.courses.filter((course) => course.programme_type === 'Certificate');

    const renderCourseTable = (courses, typePrefix, type) =>
        courses
            .map((course, index) => {
                const applicantCount = state.students.filter((student) => student.course_id === course.id).length;
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
        ? state.students.filter((student) => student.intake_id === activeIntake.id).length
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
    elements.studentTable.innerHTML = state.students
        .map((student, index) => {
            const course = state.courses.find((item) => item.id === student.course_id);
            const intake = state.intakes.find((item) => item.id === student.intake_id);
            const isChecked = selectedStudents.has(student.id) ? 'checked' : '';
            return `
            <tr>
                <td><input type="checkbox" ${isChecked} onchange="toggleStudentSelection(${student.id})"></td>
                <td>${index + 1}</td>
                <td>${student.first_name} ${student.last_name}</td>
                <td>${course ? course.course_name : 'N/A'}</td>
                <td>${student.programme_type || 'N/A'}</td>
                <td>${student.address ? student.address : 'N/A'}</td>
                <td>${intake ? intake.intake_name : 'N/A'}</td>
                <td>${formatDate(student.created_at)}</td>
            </tr>`;
        })
        .join('');
}

function renderLetters() {
    elements.letterTable.innerHTML = state.admissionLetters
        .map((letter, index) => {
            const student = state.students.find((item) => item.id === letter.student_id);
            return `
            <tr>
                <td>${index + 1}</td>
                <td>${student ? `${student.first_name} ${student.last_name}` : 'Unknown'}</td>
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
            state.students.map((student) => `<option value="${student.id}">${student.first_name} ${student.last_name}${student.address ? ' — ' + student.address : ''}</option>`).join('');
    }
}

function renderProgrammeStats() {
    const totalProgrammes = state.courses.length;
    const certificateProgrammes = state.courses.filter((course) => course.programme_type === 'Certificate').length;
    const diplomaProgrammes = state.courses.filter((course) => course.programme_type === 'Diploma').length;
    const certificateApplicants = state.students.filter((student) => {
        const course = state.courses.find((item) => item.id === student.course_id);
        return course && course.programme_type === 'Certificate';
    }).length;
    const diplomaApplicants = state.students.filter((student) => {
        const course = state.courses.find((item) => item.id === student.course_id);
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

function render() {
    renderSummary();
    renderCourses();
    renderProgrammeStats();
    renderIntakes();
    renderIntakeProjection();
    renderStudents();
    renderLetters();
    refreshSelects();
}

function showAlert(message) {
    alert(message);
}

function handleCourseSubmit(event) {
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

    if (state.courses.some((course) => course.course_code.toLowerCase() === courseCode.toLowerCase() && course.programme_type === programmeType)) {
        showAlert('Course code must be unique within the same programme type.');
        return;
    }

    state.courses.push({
        id: createId(state.courses),
        course_code: courseCode,
        course_name: courseName,
        programme_type: programmeType,
        capacity_limit: capacity
    });

    form.reset();
    form.capacity_limit.value = 50;
    render();
}

function handleStudentSubmit(event) {

    event.preventDefault();
    const form = event.target;
    const firstName = form.first_name.value.trim();
    const lastName = form.last_name.value.trim();
    const address = form.address ? form.address.value.trim() : '';
    const programmeType = form.programme_type.value;
    const courseId = Number(form.course_id.value);
    const activeIntake = state.intakes.find((intake) => intake.is_active);

    if (!firstName || !lastName || !programmeType || !courseId) {
        showAlert('Please complete all student fields.');
        return;
    }

    if (!activeIntake) {
        showAlert('No active intake available. Please set an active intake first.');
        return;
    }

    state.students.push({
        id: createId(state.students),
        first_name: firstName,
        last_name: lastName,
        address: address,
        programme_type: programmeType,
        course_id: courseId,
        intake_id: activeIntake.id,
        created_at: Date.now()
    });

    form.reset();
    render();
}

function handleLetterSubmit(event) {
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

    if (state.admissionLetters.some((letter) => letter.registration_number.toLowerCase() === registrationNumber.toLowerCase())) {
        showAlert('Registration number must be unique.');
        return;
    }

    if (state.admissionLetters.some((letter) => letter.student_id === studentId)) {
        showAlert('This student already has an admission letter.');
        return;
    }

    state.admissionLetters.push({
        id: createId(state.admissionLetters),
        student_id: studentId,
        registration_number: registrationNumber,
        sequence_number: sequenceNumber,
        generated_date: Date.now()
    });

    form.reset();
    render();
}

function setupTabs() {
    const tabs = document.querySelectorAll('.tab-button');
    const panels = document.querySelectorAll('.tab-panel');

    tabs.forEach((button) => {
        button.addEventListener('click', () => {
            tabs.forEach((item) => item.classList.remove('active'));
            panels.forEach((panel) => panel.classList.remove('active'));

            button.classList.add('active');
            document.getElementById(button.dataset.target).classList.add('active');
        });
    });
}

function setActiveIntake(intakeName) {
    state.intakes.forEach((intake) => {
        intake.is_active = intake.intake_name === intakeName;
    });

    const intakeButtons = document.querySelectorAll('.choice-button');
    intakeButtons.forEach((button) => {
        button.classList.toggle('active', button.dataset.intakeName === intakeName);
    });

    render();
}

function setupIntakeButtons() {
    const intakeButtons = document.querySelectorAll('.choice-button');
    intakeButtons.forEach((button) => {
        button.addEventListener('click', () => {
            setActiveIntake(button.dataset.intakeName);
        });
    });
}

function resetIntakeSelection() {
    setActiveIntake('MARCH');
}

function initDemoData() {
    state.courses = [
        { id: 1, course_code: 'CS101', course_name: 'Computer Science', programme_type: 'Diploma', capacity_limit: 80 },
        { id: 2, course_code: 'BUS201', course_name: 'Business Management', programme_type: 'Certificate', capacity_limit: 60 }
    ];
    state.intakes = [
        { id: 1, intake_name: 'MARCH', academic_year: 2026, is_active: true },
        { id: 2, intake_name: 'AUGUST', academic_year: 2026, is_active: false }
    ];
    state.students = [
        { id: 1, first_name: 'Amelia', last_name: 'Kiptoo', address: 'Nakuru, Kenya', course_id: 1, intake_id: 1, created_at: Date.now() - 1000 * 60 * 60 * 24 },
        { id: 2, first_name: 'Sammy', last_name: 'Mugambi', address: 'Nairobi, Kenya', course_id: 2, intake_id: 2, created_at: Date.now() - 1000 * 60 * 60 * 24 * 2 }
    ];
}

function init() {
    if (!elements.courseForm || !elements.studentForm || !elements.letterForm) {
        return;
    }

    setupTabs();
    initDemoData();
    render();

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
    resetIntakeSelection();
}

window.addEventListener('DOMContentLoaded', init);
