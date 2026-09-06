from django.contrib import admin
from .models import Course, Intake, Student, AdmissionLetter


@admin.register(Course)
class CourseAdmin(admin.ModelAdmin):
    list_display = ('course_code', 'course_name', 'programme_type', 'capacity_limit')
    list_filter = ('programme_type',)


@admin.register(Intake)
class IntakeAdmin(admin.ModelAdmin):
    list_display = ('intake_name', 'academic_year', 'is_active')
    list_filter = ('is_active', 'academic_year')


@admin.register(Student)
class StudentAdmin(admin.ModelAdmin):
    list_display = ('first_name', 'last_name', 'course', 'intake', 'programme_type', 'created_at')
    list_filter = ('programme_type', 'intake', 'course')


@admin.register(AdmissionLetter)
class AdmissionLetterAdmin(admin.ModelAdmin):
    list_display = ('registration_number', 'student', 'sequence_number', 'generated_date')
