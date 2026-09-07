from django.db.models.signals import post_save
from django.dispatch import receiver
from .models import Notification, Student


@receiver(post_save, sender=Student)
def create_student_application_notification(sender, instance, created, **kwargs):
    if created:
        course = instance.course
        intake = instance.intake
        course_label = course.course_code if course else 'unknown programme'
        programme_label = getattr(course, 'programme_type', instance.programme_type) if course else instance.programme_type
        intake_label = f'{intake.intake_name} {intake.academic_year}' if intake else 'unknown intake'

        Notification.objects.create(
            recipient_type='ar',
            student=instance,
            message=(
                f'New application from {instance.full_name} for '
                f'{programme_label} program ({course_label}) — intake {intake_label}.'
            ),
        )
