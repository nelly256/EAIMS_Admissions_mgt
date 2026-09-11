from rest_framework import viewsets, status
from rest_framework.decorators import action, api_view, permission_classes
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from rest_framework_simplejwt.views import TokenObtainPairView
from django.conf import settings
from django.core.exceptions import ImproperlyConfigured, ValidationError
from django.core.mail import EmailMessage
from django.core.validators import validate_email
from django.http import FileResponse, HttpResponse
from django.utils import timezone
import logging
from io import BytesIO
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.units import inch
from reportlab.lib.enums import TA_CENTER, TA_LEFT, TA_JUSTIFY
from reportlab.platypus import SimpleDocTemplate, Table, TableStyle, Paragraph, Spacer, Image
from reportlab.lib import colors as rl_colors
from docx import Document
from docx.shared import Inches
from .models import Course, Intake, Student, AdmissionLetter, Notification
from .serializers import CourseSerializer, IntakeSerializer, StudentSerializer, AdmissionLetterSerializer, NotificationSerializer


logger = logging.getLogger(__name__)


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

    @action(detail=False, methods=['get'], url_path='export_pdf')
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

        wrap_style = styles['Normal'].clone('wrap')
        wrap_style.fontSize = 8
        wrap_style.leading = 10

        data = [[Paragraph(str(h), styles['Normal']) for h in ['#', 'Name', 'Programme', 'Type', 'Address', 'Email', 'Intake', 'Joined']]]
        for i, student in enumerate(students, 1):
            data.append([
                Paragraph(str(i), wrap_style),
                Paragraph(student.full_name, wrap_style),
                Paragraph(student.course.course_name if student.course else '', wrap_style),
                Paragraph(student.programme_type, wrap_style),
                Paragraph(student.address or '', wrap_style),
                Paragraph(student.email or '', wrap_style),
                Paragraph(student.intake.intake_name if student.intake else '', wrap_style),
                Paragraph(student.created_at.strftime('%Y-%m-%d'), wrap_style),
            ])
        table = Table(data, colWidths=[0.4*inch, 1.3*inch, 1.3*inch, 0.7*inch, 1.0*inch, 1.1*inch, 0.7*inch, 0.57*inch])
        table.setStyle(TableStyle([
            ('BACKGROUND', (0, 0), (-1, 0), rl_colors.HexColor('#4F46E5')),
            ('TEXTCOLOR', (0, 0), (-1, 0), rl_colors.white),
            ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
            ('FONTSIZE', (0, 0), (-1, 0), 9),
            ('FONTSIZE', (0, 1), (-1, -1), 8),
            ('ROWBACKGROUNDS', (0, 1), (-1, -1), [rl_colors.white, rl_colors.HexColor('#F8FAFC')]),
            ('GRID', (0, 0), (-1, -1), 0.5, rl_colors.HexColor('#E2E8F0')),
            ('VALIGN', (0, 0), (-1, -1), 'TOP'),
            ('LEFTPADDING', (0, 0), (-1, -1), 4),
            ('RIGHTPADDING', (0, 0), (-1, -1), 4),
            ('TOPPADDING', (0, 0), (-1, -1), 4),
            ('BOTTOMPADDING', (0, 0), (-1, -1), 4),
            ('WORDWRAP', (0, 0), (-1, -1), True),
        ]))
        elements.append(table)
        doc.build(elements)
        buffer.seek(0)
        response = FileResponse(buffer, as_attachment=True, filename='students.pdf')
        response['Content-Type'] = 'application/pdf'
        return response

    @action(detail=False, methods=['get'], url_path='export_docx')
    def export_docx(self, request):
        students = Student.objects.select_related('course', 'intake').all()
        doc = Document()
        doc.add_heading('EAIMS Student Directory', 0)
        table = doc.add_table(rows=1, cols=8)
        table.style = 'Table Grid'
        table.autofit = False
        table.allow_autofit = False

        header_cells = table.rows[0].cells
        headers = ['#', 'Name', 'Programme', 'Type', 'Address', 'Email', 'Intake', 'Joined']
        widths = [Inches(0.4), Inches(1.3), Inches(1.3), Inches(0.7), Inches(1.0), Inches(1.1), Inches(0.7), Inches(0.57)]
        for i, w in enumerate(widths):
            header_cells[i].width = w
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
            for j, w in enumerate(widths):
                row[j].width = w

        buffer = BytesIO()
        doc.save(buffer)
        buffer.seek(0)
        response = FileResponse(buffer, as_attachment=True, filename='students.docx')
        response['Content-Type'] = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
        return response


class AdmissionLetterViewSet(viewsets.ModelViewSet):
    queryset = AdmissionLetter.objects.select_related('student__course', 'student__intake')
    serializer_class = AdmissionLetterSerializer
    permission_classes = [IsAuthenticated]

    def _generate_letter_pdf(self, letter):
        """Generate PDF for an admission letter matching the EAIMS template specification."""
        from reportlab.lib.pagesizes import A4
        from reportlab.lib.units import mm, cm
        from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
        from reportlab.lib.enums import TA_CENTER, TA_LEFT, TA_JUSTIFY, TA_RIGHT
        from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle, PageBreak, KeepTogether
        from reportlab.lib import colors as rl_colors
        from reportlab.pdfgen import canvas
        from reportlab.lib.colors import Color
        from reportlab.graphics.shapes import Drawing, Rect
        import io

        buffer = io.BytesIO()

        doc = SimpleDocTemplate(
            buffer,
            pagesize=A4,
            rightMargin=2*cm,
            leftMargin=2*cm,
            topMargin=1.5*cm,
            bottomMargin=2*cm,
        )

        styles = getSampleStyleSheet()

        # Custom styles using Times New Roman (serif)
        # Note: Times-Roman is built into ReportLab
        header_inst_style = ParagraphStyle(
            'HeaderInst',
            parent=styles['Normal'],
            fontName='Times-Bold',
            fontSize=14,
            leading=17,
            alignment=TA_LEFT,
            textColor=rl_colors.black,
            spaceAfter=2,
        )

        header_office_style = ParagraphStyle(
            'HeaderOffice',
            parent=styles['Normal'],
            fontName='Times-Bold',
            fontSize=11,
            leading=14,
            alignment=TA_LEFT,
            textColor=rl_colors.black,
            spaceAfter=4,
        )

        header_info_style = ParagraphStyle(
            'HeaderInfo',
            parent=styles['Normal'],
            fontName='Times-Roman',
            fontSize=8,
            leading=10,
            alignment=TA_CENTER,
            textColor=rl_colors.HexColor('#333333'),
            spaceAfter=1,
        )

        title_style = ParagraphStyle(
            'AdmissionTitle',
            parent=styles['Normal'],
            fontName='Times-Bold',
            fontSize=15,
            leading=19,
            alignment=TA_CENTER,
            textColor=rl_colors.HexColor('#CC0000'),  # Red
            spaceAfter=12,
            spaceBefore=6,
        )

        student_label_style = ParagraphStyle(
            'StudentLabel',
            parent=styles['Normal'],
            fontName='Times-Bold',
            fontSize=11,
            leading=15,
            alignment=TA_LEFT,
            textColor=rl_colors.black,
        )

        student_value_style = ParagraphStyle(
            'StudentValue',
            parent=styles['Normal'],
            fontName='Times-Roman',
            fontSize=11,
            leading=15,
            alignment=TA_LEFT,
            textColor=rl_colors.black,
        )

        body_style = ParagraphStyle(
            'BodyText',
            parent=styles['Normal'],
            fontName='Times-Roman',
            fontSize=11.5,
            leading=16,
            alignment=TA_JUSTIFY,
            textColor=rl_colors.black,
            spaceAfter=8,
            firstLineIndent=0,
        )

        body_bold_style = ParagraphStyle(
            'BodyBold',
            parent=body_style,
            fontName='Times-Bold',
        )

        doc_list_style = ParagraphStyle(
            'DocList',
            parent=styles['Normal'],
            fontName='Times-Roman',
            fontSize=11,
            leading=15,
            alignment=TA_JUSTIFY,
            textColor=rl_colors.black,
            spaceAfter=4,
            leftIndent=20,
            firstLineIndent=-20,
        )

        closing_style = ParagraphStyle(
            'Closing',
            parent=styles['Normal'],
            fontName='Times-Roman',
            fontSize=11.5,
            leading=16,
            alignment=TA_LEFT,
            textColor=rl_colors.black,
            spaceAfter=4,
        )

        signature_style = ParagraphStyle(
            'Signature',
            parent=styles['Normal'],
            fontName='Times-Roman',
            fontSize=11.5,
            leading=16,
            alignment=TA_LEFT,
            textColor=rl_colors.black,
            spaceAfter=2,
        )

        # Build elements
        elements = []

        # ========== HEADER ==========
        # Use real logo image
        from reportlab.platypus import Image
        import os
        from django.conf import settings

        # Path to logo - check multiple locations
        logo_paths = [
            os.path.join(settings.BASE_DIR, 'frontend', 'logo.jpg'),
            os.path.join(settings.BASE_DIR.parent, 'frontend', 'logo.jpg'),
            'C:/xampp/htdocs/xampp/EAIMS_Admissions_mgt-main/frontend/logo.jpg',
        ]

        logo_image = None
        for logo_path in logo_paths:
            if os.path.exists(logo_path):
                try:
                    logo_image = Image(logo_path, width=50, height=50)
                    break
                except Exception:
                    continue

        # Fallback to abstract logo if image not found
        if logo_image is None:
            logo_drawing = Drawing(40, 40)
            colors_list = [
                rl_colors.HexColor('#FFD700'),  # yellow
                rl_colors.HexColor('#228B22'),  # green
                rl_colors.HexColor('#1E3A8A'),  # blue
                rl_colors.HexColor('#CC0000'),  # red
            ]
            for i, color in enumerate(colors_list):
                row = i // 2
                col = i % 2
                rect = Rect(col * 20, row * 20, 20, 20)
                rect.fillColor = color
                rect.strokeColor = rl_colors.white
                rect.strokeWidth = 1
                logo_drawing.add(rect)
            logo_element = logo_drawing
        else:
            logo_element = logo_image

        # Header text content
        header_text = [
            Paragraph('EAST AFRICAN INSTITUTE FOR MANAGEMENT SCIENCE', header_inst_style),
            Paragraph('NORTHERN UGANDA REGIONAL OFFICE', header_office_style),
            Spacer(1, 4),
            Paragraph('P. O. BOX 701 – GULU', header_info_style),
            Paragraph('Plot 6/8 Alex Latim Road, Opposite Kingdom Hall of Jehovah Witness.', header_info_style),
            Paragraph('Tel: 0772394768 / 058142176 – email: eastmstitute@yahoo.com', header_info_style),
            Spacer(1, 2),
            Paragraph('EAIMS is licensed by the Ministry of Education and Sports - Ref No. UME/TVET/071', header_info_style),
            Paragraph('NCHE REF: TE/PL. 052, UBTVET - C', header_info_style),
            Paragraph('CENTRE No. UVT 645', header_info_style),
        ]

        # Create header table: logo (left) + text (right)
        logo_width = 55 if logo_image else 45
        header_table = Table(
            [[logo_element, header_text]],
            colWidths=[logo_width, A4[0] - 4*cm - logo_width],
        )
        header_table.setStyle(TableStyle([
            ('VALIGN', (0, 0), (-1, -1), 'TOP'),
            ('LEFTPADDING', (0, 0), (-1, -1), 0),
            ('RIGHTPADDING', (0, 0), (-1, -1), 0),
            ('TOPPADDING', (0, 0), (-1, -1), 0),
            ('BOTTOMPADDING', (0, 0), (-1, -1), 0),
        ]))
        elements.append(header_table)
        elements.append(Spacer(1, 6))

        # Multicolored divider
        class DividerTable(Table):
            def __init__(self):
                # Create a drawing with 5 colored horizontal bars
                drawing = Drawing(A4[0] - 4*cm, 6)
                bar_width = (A4[0] - 4*cm) / 5
                divider_colors = [
                    rl_colors.HexColor('#FFD700'),  # yellow
                    rl_colors.HexColor('#228B22'),  # green
                    rl_colors.HexColor('#1E3A8A'),  # blue
                    rl_colors.HexColor('#CC0000'),  # red
                    rl_colors.HexColor('#FFFFFF'),  # white
                ]
                for i, color in enumerate(divider_colors):
                    rect = Rect(i * bar_width, 0, bar_width, 6)
                    rect.fillColor = color
                    rect.strokeColor = rl_colors.white
                    rect.strokeWidth = 0
                    drawing.add(rect)
                super().__init__([[drawing]], colWidths=[A4[0] - 4*cm])
                self.setStyle(TableStyle([
                    ('LEFTPADDING', (0, 0), (-1, -1), 0),
                    ('RIGHTPADDING', (0, 0), (-1, -1), 0),
                    ('TOPPADDING', (0, 0), (-1, -1), 0),
                    ('BOTTOMPADDING', (0, 0), (-1, -1), 0),
                ]))

        elements.append(DividerTable())
        elements.append(Spacer(1, 16))

        # ========== TITLE ==========
        elements.append(Paragraph('ADMISSION LETTER', title_style))
        elements.append(Spacer(1, 14))

        # ========== STUDENT DETAILS ==========
        # Prepare student details
        student_name = letter.student.full_name
        reg_number = letter.registration_number
        # Use sequence number as application/receipt number
        app_number = f"APP-{letter.sequence_number:06d}"

        details_data = [
            [Paragraph('STUDENT\'S NAME:', student_label_style),
             Paragraph(f'<u>{student_name}</u>', student_value_style)],
            [Paragraph('REGISTRATION NUMBER:', student_label_style),
             Paragraph(f'<u>{reg_number}</u>', student_value_style)],
            [Paragraph('APPLICATION/RECEIPT NUMBER:', student_label_style),
             Paragraph(f'<u>{app_number}</u>', student_value_style)],
        ]

        details_table = Table(details_data, colWidths=[6*cm, A4[0] - 4*cm - 6*cm])
        details_table.setStyle(TableStyle([
            ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
            ('LEFTPADDING', (0, 0), (-1, -1), 0),
            ('RIGHTPADDING', (0, 0), (-1, -1), 6),
            ('TOPPADDING', (0, 0), (-1, -1), 4),
            ('BOTTOMPADDING', (0, 0), (-1, -1), 4),
        ]))
        elements.append(details_table)
        elements.append(Spacer(1, 16))

        # ========== BODY PARAGRAPHS ==========
        # Extract dynamic data
        programme = letter.student.course.course_name
        intake_name = f"{letter.student.intake.intake_name} {letter.student.intake.academic_year}"
        # Determine qualification based on programme type
        qualification = 'Diploma' if letter.student.programme_type == 'Diploma' else 'Certificate'
        # Duration - typical: 2 years for diploma, 1-2 years for certificate
        duration = 'two-year' if letter.student.programme_type == 'Diploma' else 'one-year'
        start_date = letter.generated_date.strftime('%B %d, %Y')

        # Paragraph 1
        para1 = (
            f'I write to offer you admission at this Institute for the <b>{intake_name}</b> '
            f'for a <b>{duration}</b> course of study leading to the award of a '
            f'<b>{qualification}</b> IN <b>{programme.upper()}</b>.'
        )
        elements.append(Paragraph(para1, body_style))
        elements.append(Spacer(1, 10))

        # Paragraph 2
        para2 = (
            f'You have been admitted as a privately sponsored student at the Institute\'s Main Campus '
            f'located on Plot 6/8 Alex Latim Road, Next to Radio Favour FM - Pece Vangard, '
            f'Pece – Laroo Division, Gulu City.'
        )
        elements.append(Paragraph(para2, body_style))
        elements.append(Spacer(1, 10))

        # Paragraph 3
        para3 = (
            f'The course starts on <b>{start_date}</b> and therefore, you should ensure that you '
            f'report and register with the Institute\'s Admissions Office within two weeks '
            f'from the beginning of the semester.'
        )
        elements.append(Paragraph(para3, body_style))
        elements.append(Spacer(1, 10))

        # Paragraph 4
        para4 = (
            'This is a provisional offer made on the basis of the documents and information '
            'as submitted on your application form as they will be subjected to verification. '
            'You will be asked to present more (if necessary) supporting and convincing evidence '
            'at the time of registration including but not limited to:'
        )
        elements.append(Paragraph(para4, body_style))
        elements.append(Spacer(1, 8))

        # ========== DOCUMENT LIST ==========
        doc_items = [
            'a) Original Uganda Advanced Certificate of Education (UACE) or its equivalent.',
            'b) Original Uganda Certificate of Education (UCE) or its equivalent.',
            'c) Two (2) current colored passport size photographs.',
            'd) A copy of the Identity Card from your previous school or current employer.',
            'e) Original National Identification Card or Birth Certificate.',
        ]

        for item in doc_items:
            elements.append(Paragraph(item, doc_list_style))

        elements.append(Spacer(1, 20))

        # ========== CLOSING ==========
        elements.append(Paragraph('Yours faithfully,', closing_style))
        elements.append(Spacer(1, 40))
        elements.append(Paragraph('<b>[Authorized Officer]</b>', signature_style))
        elements.append(Spacer(1, 6))
        elements.append(Paragraph('EAIMS Admissions Office', signature_style))

        # Build with watermark on each page
        doc.build(elements)
        buffer.seek(0)
        return buffer

    @action(detail=False, methods=['post'])
    def generate(self, request):
        student_id = request.data.get('student_id')
        if not student_id:
            return Response({'error': 'student_id is required'}, status=status.HTTP_400_BAD_REQUEST)
        try:
            student = Student.objects.get(pk=student_id)
        except Student.DoesNotExist:
            return Response({'error': 'Student not found'}, status=status.HTTP_404_NOT_FOUND)

        # Check if letter already exists for this student
        existing_letter = AdmissionLetter.objects.filter(student=student).first()
        if existing_letter:
            existing_letter.status = 'generated'
            existing_letter.save()
            serializer = self.get_serializer(existing_letter)
            return Response(serializer.data, status=status.HTTP_200_OK)

        course = student.course
        intake = student.intake
        sequence = request.data.get('sequence_number') or AdmissionLetter.objects.filter(
            student__course=course
        ).count() + 1

        intake_code = ''.join(
            c[0].upper() for c in intake.intake_name.split() if c
        )[:3].ljust(3, 'X')
        reg_number = request.data.get('registration_number') or f'{intake.academic_year}-{intake_code}-{str(sequence).zfill(4)}'

        letter = AdmissionLetter.objects.create(
            student=student,
            registration_number=reg_number,
            sequence_number=sequence,
            status='generated',
        )
        serializer = self.get_serializer(letter)
        return Response(serializer.data, status=status.HTTP_201_CREATED)

    @action(detail=True, methods=['get'])
    def preview(self, request, pk=None):
        """Get letter details for preview."""
        letter = self.get_object()
        serializer = self.get_serializer(letter)
        return Response(serializer.data)

    @action(detail=True, methods=['get'], url_path='download-pdf')
    def download_pdf(self, request, pk=None):
        """Generate and download the admission letter as PDF."""
        letter = self.get_object()
        buffer = self._generate_letter_pdf(letter)
        filename = f'EAIMS_Admission_Letter_{letter.student.full_name.replace(" ", "_")}_{letter.registration_number}.pdf'
        response = FileResponse(buffer, as_attachment=True, filename=filename)
        response['Content-Type'] = 'application/pdf'
        return response

    def _validate_email_configuration(self):
        if not settings.EMAIL_BACKEND.endswith('smtp.EmailBackend'):
            return

        missing = []
        if not settings.EMAIL_HOST:
            missing.append('EMAIL_HOST')
        if not settings.EMAIL_HOST_USER:
            missing.append('EMAIL_HOST_USER')
        if not settings.EMAIL_HOST_PASSWORD:
            missing.append('EMAIL_HOST_PASSWORD')
        if not settings.DEFAULT_FROM_EMAIL:
            missing.append('DEFAULT_FROM_EMAIL')
        if settings.EMAIL_USE_TLS and settings.EMAIL_USE_SSL:
            raise ImproperlyConfigured(
                'EMAIL_USE_TLS and EMAIL_USE_SSL cannot both be enabled.'
            )
        if missing:
            raise ImproperlyConfigured(
                'Email SMTP configuration is incomplete: ' + ', '.join(missing) + '.'
            )

    def _send_admission_email(self, letter):
        """Send admission letter email with PDF attachment."""
        self._validate_email_configuration()

        student = letter.student
        if not student.email:
            raise ValueError('Student has no email address')
        try:
            validate_email(student.email)
        except ValidationError as exc:
            raise ValueError('Student has an invalid email address') from exc

        recipient_email = student.email.strip()
        pdf_buffer = self._generate_letter_pdf(letter)
        pdf_filename = f'EAIMS_Admission_Letter_{student.full_name.replace(" ", "_")}_{letter.registration_number}.pdf'

        subject = f'EAIMS Admission Letter – {student.full_name}'
        message = (
            f'Dear {student.full_name},\n\n'
            f'Congratulations!\n\n'
            f'We are pleased to inform you that you have been admitted to EAIMS for the '
            f'{student.course.course_name} programme under the '
            f'{student.intake.intake_name} {student.intake.academic_year} intake.\n\n'
            f'Please find your official admission letter attached to this email.\n\n'
            f'Kindly review the letter and follow the instructions provided.\n\n'
            f'Regards,\n'
            f'EAIMS Admissions Office'
        )

        email = EmailMessage(
            subject=subject,
            body=message,
            from_email=settings.DEFAULT_FROM_EMAIL,
            to=[recipient_email],
        )
        email.attach(pdf_filename, pdf_buffer.getvalue(), 'application/pdf')
        sent_count = email.send(fail_silently=False)
        if sent_count != 1:
            raise RuntimeError(f'Email was not delivered to any recipient: {recipient_email}')

        letter.status = 'sent'
        letter.sent_date = timezone.now()
        letter.recipient_email = recipient_email
        letter.sent_count += 1
        letter.save()

        return True

    @action(detail=True, methods=['post'], url_path='send-email')
    def send_email(self, request, pk=None):
        """Send admission letter via email with PDF attachment."""
        letter = self.get_object()

        if letter.status == 'not_generated':
            return Response(
                {'error': 'Letter has not been generated yet'},
                status=status.HTTP_400_BAD_REQUEST
            )

        student = letter.student
        if not student.email:
            return Response(
                {'error': 'Student has no email address'},
                status=status.HTTP_400_BAD_REQUEST
            )

        try:
            self._send_admission_email(letter)
            serializer = self.get_serializer(letter)
            return Response({
                'message': f'Admission letter successfully sent to {student.email}',
                'letter': serializer.data
            }, status=status.HTTP_200_OK)
        except ImproperlyConfigured as exc:
            logger.warning('Admission email configuration error: %s', exc)
            letter.status = 'failed'
            letter.save()
            return Response(
                {
                    'error': (
                        'Email service is not configured correctly. '
                        'Check EMAIL_HOST, EMAIL_HOST_USER, EMAIL_HOST_PASSWORD, '
                        'and DEFAULT_FROM_EMAIL.'
                    )
                },
                status=status.HTTP_503_SERVICE_UNAVAILABLE,
            )
        except ValueError as exc:
            return Response(
                {'error': str(exc)},
                status=status.HTTP_400_BAD_REQUEST,
            )
        except Exception as exc:
            logger.exception('Failed to send admission email for letter %s', letter.id)
            letter.status = 'failed'
            letter.save()
            return Response(
                {'error': 'Failed to send email. Check the server logs and email configuration.'},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR,
            )


    @action(detail=True, methods=['post'], url_path='resend-email')
    def resend_email(self, request, pk=None):
        """Resend admission letter email."""
        letter = self.get_object()

        if letter.status not in ['sent', 'generated']:
            return Response(
                {'error': 'Letter must be generated or previously sent before resending'},
                status=status.HTTP_400_BAD_REQUEST
            )

        student = letter.student
        if not student.email:
            return Response(
                {'error': 'Student has no email address'},
                status=status.HTTP_400_BAD_REQUEST
            )

        try:
            self._send_admission_email(letter)
            serializer = self.get_serializer(letter)
            return Response({
                'message': f'Admission letter successfully resent to {student.email}',
                'letter': serializer.data
            }, status=status.HTTP_200_OK)
        except Exception as e:
            letter.status = 'failed'
            letter.save()
            return Response(
                {'error': f'Failed to resend email: {str(e)}'},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )


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
