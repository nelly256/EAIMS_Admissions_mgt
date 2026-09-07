import urllib.request, json

BASE = 'http://127.0.0.1:8000/api'

# Get token
data = json.dumps({'username': 'admin', 'password': 'admin123'}).encode()
req = urllib.request.Request(f'{BASE}/auth/token/', data=data, headers={'Content-Type': 'application/json'})
tokens = json.loads(urllib.request.urlopen(req).read())
access_token = tokens['access']
auth_header = {'Authorization': f'Bearer {access_token}'}

def post(endpoint, payload):
    data = json.dumps(payload).encode()
    headers = {**auth_header, 'Content-Type': 'application/json'}
    req = urllib.request.Request(f'{BASE}/{endpoint}/', data=data, headers=headers)
    return json.loads(urllib.request.urlopen(req).read())

# Create courses
c1 = post('courses', {'course_code': 'CS101', 'course_name': 'Computer Science', 'programme_type': 'Diploma', 'capacity_limit': 80})
c2 = post('courses', {'course_code': 'BUS201', 'course_name': 'Business Management', 'programme_type': 'Certificate', 'capacity_limit': 60})
c3 = post('courses', {'course_code': 'BA', 'course_name': 'Business Administration', 'programme_type': 'Diploma', 'capacity_limit': 70})
c4 = post('courses', {'course_code': 'BA', 'course_name': 'Business Administration', 'programme_type': 'Certificate', 'capacity_limit': 60})
c5 = post('courses', {'course_code': 'PPM', 'course_name': 'Project Planning & Mgmt', 'programme_type': 'Diploma', 'capacity_limit': 50})
c6 = post('courses', {'course_code': 'PPM', 'course_name': 'Project Planning & Mgmt', 'programme_type': 'Certificate', 'capacity_limit': 40})
c7 = post('courses', {'course_code': 'PM', 'course_name': 'Procurement Mgmt', 'programme_type': 'Diploma', 'capacity_limit': 60})
c8 = post('courses', {'course_code': 'PM', 'course_name': 'Procurement Mgmt', 'programme_type': 'Certificate', 'capacity_limit': 50})
c9 = post('courses', {'course_code': 'AF', 'course_name': 'Accounting & Finance', 'programme_type': 'Diploma', 'capacity_limit': 70})
c10 = post('courses', {'course_code': 'AF', 'course_name': 'Accounting & Finance', 'programme_type': 'Certificate', 'capacity_limit': 60})

# Create intakes
i1 = post('intakes', {'intake_name': 'MARCH', 'academic_year': 2026, 'is_active': True})
i2 = post('intakes', {'intake_name': 'AUGUST', 'academic_year': 2026, 'is_active': False})

# Create students
post('students', {'full_name': 'Amelia Kiptoo', 'address': 'Nakuru, Kenya', 'programme_type': 'Diploma', 'course': c1['id'], 'intake': i1['id']})
post('students', {'full_name': 'Sammy Mugambi', 'address': 'Nairobi, Kenya', 'programme_type': 'Certificate', 'course': c2['id'], 'intake': i2['id']})

print('Demo data seeded successfully')
