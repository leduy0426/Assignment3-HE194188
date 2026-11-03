

//requirement 2: Get Student in a Class
enpoint
GET /api/classes/:classId/students?status=enrolled 
require:
-validate classId, classId not a valid isObjectIdOrHexString, => HTTP 400
- corresponding class does not exist => HTTP 401
- status query param is optinal. Default: enrolled- only accept enrolled or dropped as valid values for status param (case-insensitive). if invalid => HTTP 400
- return only student whose enrollment status matches the requested status value
- each student contains fields:  getStudentById, studentCode, fullName, and email 
Example:
GET /api/classes/65bb00000000000000000001/student?status=enrolled 
result: 3 enrolled student in class SE1701 (SE001, SE002, and SE003)