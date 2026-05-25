export function normalizeSemester(semester) {
    if (!semester) return null;

    return {
        ...semester,
        display_name: semester.display_name || semester.name || semester.academic_year || `Semester ${semester.id}`,
        normalized_semester_no: Number(semester.normalized_semester_no || semester.semester_no || semester.semester_number || 0),
        normalized_registration_open: Boolean(
            semester.normalized_registration_open ??
            semester.registration_open ??
            semester.registration_status === 'open'
        ),
        total_credits: Number(semester.total_credits || 0),
        course_count: Number(semester.course_count || 0),
        released_course_count: Number(semester.released_course_count || 0),
        registered_student_count: Number(semester.registered_student_count || 0),
    };
}

export function formatRole(role) {
    if (!role) return 'Unknown';
    return role.charAt(0).toUpperCase() + role.slice(1);
}

export function getReleaseProgress(semester) {
    const courseCount = Number(semester?.course_count || 0);
    const releasedCourseCount = Number(semester?.released_course_count || 0);

    if (!courseCount) return 0;
    return Math.round((releasedCourseCount / courseCount) * 100);
}

export function getRegistrationStatusLabel(semester) {
    return semester?.normalized_registration_open ? 'Registration Open' : 'Registration Closed';
}

export function getSemesterHealth(semester) {
    if (!semester) return 'idle';
    if (!semester.course_count) return 'draft';
    if (semester.gradesheet_released) return 'released';
    if (semester.released_course_count === semester.course_count && semester.course_count > 0) return 'ready';
    if (semester.registered_student_count > 0) return 'active';
    return 'planning';
}
