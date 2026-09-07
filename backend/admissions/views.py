from rest_framework import viewsets, status
from rest_framework.decorators import action, api_view, permission_classes
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from rest_framework_simplejwt.views import TokenObtainPairView
from django.http import FileResponse, HttpResponse
from io import BytesIO
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import getSampleStyleSheet
from reportlab.lib.units import inch
from reportlab.platypus import SimpleDocTemplate, Table, TableStyle, Paragraph, Spacer
from reportlab.lib import colors as rl_colors
from docx import Document
from docx.shared import Inches
from .models import Course, Intake, Student, AdmissionLetter
from .serializers import CourseSerializer, IntakeSerializer, StudentSerializer, AdmissionLetterSerializer


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

    @action(detail=False, methods=['get'])
    def export_pdf(self, request):
        students = Student.objects.select_related('course', 'intake').all()
        buffer = BytesIO()
        doc = SimpleDocTemplate(buffer, pagesize=A4, rightMargin=30, leftMargin=30, topMargin=30, bottomMargin=30)
        styles = getSampleStyleSheet()
        elements = []
        elements.append(Paragraph('EAIMS Student Directory', styles['Heading1']))
        elements.append(Spacer(1, 12))
        elements.append(Paragraph(f'Generated: {request.user.username}', styles['Normal']))
        elements.append(Spacer(1, 20))
        data = [['#', 'Name', 'Programme', 'Type', 'Address', 'Email', 'Intake', 'Joined']]
        for i, student in enumerate(students, 1):
            data.append([
                str(i),
                student.full_name,
                student.course.course_name if student.course else '',
                student.programme_type,
                student.address or '',
                student.email or '',
                student.intake.intake_name if student.intake else '',
                student.created_at.strftime('%Y-%m-%d'),
            ])
        table = Table(data, colWidths=[0.3*inch, 1.2*inch, 1.2*inch, 0.8*inch, 1.0*inch, 1.0*inch, 0.8*inch, 0.6*inch])
        table.setStyle(TableStyle([
            ('BACKGROUND', (0, 0), (-1, 0), rl_colors.HexColor('#4F46E5')),
            ('TEXTCOLOR', (0, 0), (-1, 0), rl_colors.white),
            ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
            ('FONTSIZE', (0, 0), (-1, 0), 9),
            ('FONTSIZE', (0, 1), (-1, -1), 8),
            ('ROWBACKGROUNDS', (0, 1), (-1, -1), [rl_colors.white, rl_colors.HexColor('#F8FAFC')]),
            ('GRID', (0, 0), (-1, -1), 0.5, rl_colors.HexColor('#E2E8F0')),
            ('VALIGN', (0, 0), (-1, -1), 'TOP'),
            ('LEFTPADDING', (0, 0), (-1, -1), 3),
            ('RIGHTPADDING', (0, 0), (-1, -1), 3),
            ('TOPPADDING', (0, 0), (-1, -1), 4),
            ('BOTTOMPADDING', (0, 0), (-1, -1), 4),
        ]))
        elements.append(table)
        doc.build(elements)
        buffer.seek(0)
        response = FileResponse(buffer, as_attachment=True, filename='students.pdf')
        response['Content-Type'] = 'application/pdf'
        return response

    @action(detail=False, methods=['get'])
    def export_docx(self, request):
        students = Student.objects.select_related('course', 'intake').all()
        doc = Document()
        doc.add_heading('EAIMS Student Directory', 0)
        table = doc.add_table(rows=1, cols=8)
        table.style = 'Table Grid'
        header_cells = table.rows[0].cells
        headers = ['#', 'Name', 'Programme', 'Type', 'Address', 'Email', 'Intake', 'Joined']
        for i, h in enumerate(headers):
            header_cells[i].text = h
            from docx.oxml.ns import qn
            from docx.oxml import OxmlElement
            sh = OxmlElement('w:shd')
            sh.set(qn('w:fill'), '4F4649')
            header_cells[i]._tc.get_or_add_tcPr().append(sh)
        for i, student in enumerate(students, 1):
            row = table.add_row().cells
            row[0].text = str(i)
            row[1].text = student.full_name
            row[2].text = student.course.course_name if student.course else ''
            row[3].text = student.programme_type
            row[4].text = student.address or ''
            row[5].text = student.email or ''
            row[6].text = student.intake.intake_name if student.intake else ''
            row[7].text = student.created_at.strftime('%Y-%m-%d')
        buffer = BytesIO()
        doc.save(buffer)
        buffer.seek(0)
        response = FileResponse(buffer, as_attachment=True, filename='students.docx')
        response['Content-Type'] = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
        return response


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
