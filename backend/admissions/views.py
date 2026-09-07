from rest_framework import viewsets, status
from rest_framework.decorators import action, api_view, permission_classes
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from rest_framework_simplejwt.views import TokenObtainPairView
from .models import Course, Intake, Student, AdmissionLetter, Notification
from .serializers import CourseSerializer, IntakeSerializer, StudentSerializer, AdmissionLetterSerializer, NotificationSerializer


class CourseViewSet(viewsets.ModelViewSet):
    queryset = Course.objects.all()
    serializer_class = CourseSerializer
    permission_classes = [IsAuthenticated]


class IntakeViewSet(viewsets.ModelViewSet):
    queryset = Intake.objects.all()
    serializer_class = IntakeSerializer
    permission_classes = [IsAuthenticated]

    @action(detail=True, methods=['post'])
    def activate(self, request, pk=None):
        intake = self.get_object()
        Intake.objects.filter(is_active=True).exclude(pk=intake.pk).update(is_active=False)
        intake.is_active = True
        intake.save()
        return Response({'status': f'Intake {intake.intake_name} is now active'})


class StudentViewSet(viewsets.ModelViewSet):
    queryset = Student.objects.select_related('course', 'intake')
    serializer_class = StudentSerializer
    permission_classes = [IsAuthenticated]


class AdmissionLetterViewSet(viewsets.ModelViewSet):
    queryset = AdmissionLetter.objects.select_related('student')
    serializer_class = AdmissionLetterSerializer
    permission_classes = [IsAuthenticated]

    @action(detail=False, methods=['post'])
    def generate(self, request):
        student_id = request.data.get('student_id')
        if not student_id:
            return Response({'error': 'student_id is required'}, status=status.HTTP_400_BAD_REQUEST)
        try:
            student = Student.objects.get(pk=student_id)
        except Student.DoesNotExist:
            return Response({'error': 'Student not found'}, status=status.HTTP_404_NOT_FOUND)

        if AdmissionLetter.objects.filter(student=student).exists():
            return Response(
                {'error': 'This student already has an admission letter'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        course = student.course
        intake = student.intake
        sequence = AdmissionLetter.objects.filter(
            student__course=course
        ).count() + 1

        intake_code = ''.join(
            c[0].upper() for c in intake.intake_name.split() if c
        )[:3].ljust(3, 'X')
        reg_number = f'{intake.academic_year}-{intake_code}-{str(sequence).zfill(4)}'

        letter = AdmissionLetter.objects.create(
            student=student,
            registration_number=reg_number,
            sequence_number=sequence,
        )
        serializer = self.get_serializer(letter)
        return Response(serializer.data, status=status.HTTP_201_CREATED)


class NotificationViewSet(viewsets.ModelViewSet):
    queryset = Notification.objects.all().order_by('-created_at')
    serializer_class = NotificationSerializer
    permission_classes = [IsAuthenticated]

    @action(detail=True, methods=['post'])
    def mark_read(self, request, pk=None):
        notification = self.get_object()
        notification.is_read = True
        notification.save()
        return Response({'status': 'marked as read'})

    @action(detail=False, methods=['post'])
    def mark_all_read(self, request):
        Notification.objects.filter(is_read=False).update(is_read=True)
        return Response({'status': 'all notifications marked as read'})

    @action(detail=False, methods=['get'])
    def unread_count(self, request):
        count = Notification.objects.filter(is_read=False).count()
        return Response({'unread_count': count})
