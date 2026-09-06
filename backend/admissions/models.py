from django.db import models


class Course(models.Model):
    PROGRAMME_CHOICES = [
        ('Diploma', 'Diploma'),
        ('Certificate', 'Certificate'),
    ]

    course_code = models.CharField(max_length=20)
    course_name = models.CharField(max_length=200)
    programme_type = models.CharField(max_length=20, choices=PROGRAMME_CHOICES)
    capacity_limit = models.PositiveIntegerField(default=50)

    class Meta:
        unique_together = ('course_code', 'programme_type')

    def __str__(self):
        return f'{self.course_code} — {self.course_name} ({self.programme_type})'


class Intake(models.Model):
    intake_name = models.CharField(max_length=50)
    academic_year = models.PositiveIntegerField()
    is_active = models.BooleanField(default=False)

    class Meta:
        unique_together = ('intake_name', 'academic_year')

    def __str__(self):
        return f'{self.intake_name} {self.academic_year}'


class Student(models.Model):
    PROGRAMME_CHOICES = [
        ('Diploma', 'Diploma'),
        ('Certificate', 'Certificate'),
    ]

    full_name = models.CharField(max_length=200)
    address = models.CharField(max_length=300, blank=True, default='')
    email = models.EmailField(max_length=200, blank=True, default='')
    programme_type = models.CharField(max_length=20, choices=PROGRAMME_CHOICES)
    course = models.ForeignKey(Course, on_delete=models.PROTECT, related_name='students')
    intake = models.ForeignKey(Intake, on_delete=models.PROTECT, related_name='students')
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return self.full_name


class AdmissionLetter(models.Model):
    student = models.ForeignKey(Student, on_delete=models.CASCADE, related_name='admission_letters')
    registration_number = models.CharField(max_length=100, unique=True)
    sequence_number = models.PositiveIntegerField()
    generated_date = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return self.registration_number
