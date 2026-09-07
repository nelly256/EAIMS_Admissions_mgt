from django.contrib import admin
from .models import Course, Intake, Student, AdmissionLetter, Notification


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
    list_display = ('full_name', 'course', 'intake', 'programme_type', 'created_at')
    list_filter = ('programme_type', 'intake', 'course')


@admin.register(AdmissionLetter)
class AdmissionLetterAdmin(admin.ModelAdmin):
    list_display = ('registration_number', 'student', 'sequence_number', 'generated_date')


@admin.register(Notification)
class NotificationAdmin(admin.ModelAdmin):
    list_display = ('short_message', 'student', 'is_read', 'created_at')
    list_filter = ('is_read', 'recipient_type', 'created_at')
    readonly_fields = ('student', 'message', 'created_at', 'recipient_type')

    def short_message(self, obj):
        return obj.message[:60] + '…' if len(obj.message) > 60 else obj.message
    short_message.short_description = 'Message'
