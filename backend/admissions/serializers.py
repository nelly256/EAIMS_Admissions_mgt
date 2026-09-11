from rest_framework import serializers
from .models import Course, Intake, Student, AdmissionLetter, Notification


class CourseSerializer(serializers.ModelSerializer):
    class Meta:
        model = Course
        fields = ['id', 'course_code', 'course_name', 'programme_type', 'capacity_limit']


class IntakeSerializer(serializers.ModelSerializer):
    class Meta:
        model = Intake
        fields = ['id', 'intake_name', 'academic_year', 'is_active']


class StudentSerializer(serializers.ModelSerializer):
    course_name = serializers.SerializerMethodField()
    intake_name = serializers.SerializerMethodField()
    academic_year = serializers.SerializerMethodField()

    class Meta:
        model = Student
        fields = [
            'id', 'full_name', 'address', 'email', 'programme_type',
            'course', 'course_name', 'intake', 'intake_name', 'academic_year',
            'created_at',
        ]
        read_only_fields = ['created_at']

    def get_course_name(self, obj):
        return obj.course.course_name if obj.course else None

    def get_intake_name(self, obj):
        return obj.intake.intake_name if obj.intake else None

    def get_academic_year(self, obj):
        return obj.intake.academic_year if obj.intake else None

    def validate(self, data):
        course = data.get('course')
        programme_type = data.get('programme_type')
        if course and programme_type and course.programme_type != programme_type:
            raise serializers.ValidationError(
                'Student programme type must match the course programme type.'
            )
        return data

    def create(self, validated_data):
        course = validated_data['course']
        if course.programme_type != validated_data['programme_type']:
            raise serializers.ValidationError(
                'Student programme type must match the course programme type.'
            )
        return super().create(validated_data)


class AdmissionLetterSerializer(serializers.ModelSerializer):
    student_name = serializers.SerializerMethodField()
    programme = serializers.SerializerMethodField()
    intake = serializers.SerializerMethodField()
    student_email = serializers.SerializerMethodField()
    programme_type = serializers.SerializerMethodField()
    status_display = serializers.CharField(source='get_status_display', read_only=True)

    class Meta:
        model = AdmissionLetter
        fields = [
            'id', 'student', 'student_name', 'programme', 'intake', 'student_email', 'programme_type',
            'registration_number', 'sequence_number', 'student_number',
            'generated_date', 'status', 'status_display', 'sent_date', 'recipient_email', 'sent_count',
        ]
        read_only_fields = ['id', 'student_name', 'programme', 'intake', 'student_email', 'programme_type',
                            'registration_number', 'sequence_number', 'student_number',
                            'generated_date', 'status', 'status_display', 'sent_date', 'recipient_email', 'sent_count']

    def get_student_name(self, obj):
        return obj.student.full_name

    def get_programme(self, obj):
        return obj.student.course.course_name if obj.student and obj.student.course else None

    def get_intake(self, obj):
        return f'{obj.student.intake.intake_name} {obj.student.intake.academic_year}' if obj.student and obj.student.intake else None

    def get_student_email(self, obj):
        return obj.student.email if obj.student else None

    def get_programme_type(self, obj):
        return obj.student.programme_type if obj.student else None

    def create(self, validated_data):
        validated_data['status'] = 'generated'
        return super().create(validated_data)


class NotificationSerializer(serializers.ModelSerializer):
    student_name = serializers.SerializerMethodField()
    student_programme = serializers.SerializerMethodField()
    time_since = serializers.SerializerMethodField()

    class Meta:
        model = Notification
        fields = [
            'id', 'recipient_type', 'student', 'student_name', 'student_programme',
            'message', 'is_read', 'created_at', 'time_since',
        ]
        read_only_fields = ['id', 'student', 'student_name', 'student_programme',
                            'message', 'created_at', 'time_since']

    def get_student_name(self, obj):
        return obj.student.full_name if obj.student else None

    def get_student_programme(self, obj):
        if obj.student and obj.student.course:
            return f'{obj.student.course.course_code} ({obj.student.programme_type})'
        return None

    def get_time_since(self, obj):
        from datetime import timedelta
        diff = obj.created_at
        from django.utils import timezone
        delta = timezone.now() - diff
        if delta < timedelta(minutes=1):
            return 'just now'
        if delta < timedelta(hours=1):
            return f'{int(delta.total_seconds() // 60)}m ago'
        if delta < timedelta(days=1):
            return f'{int(delta.total_seconds() // 3600)}h ago'
        return f'{delta.days}d ago'
