const express = require('express');
const jwt = require("jsonwebtoken");
require("dotenv").config();
const app = express();
const JWT_SECRET = process.env.JWT_SECRET;

const users = [
  {
    email: "he194188@fpt.edu.vn",
    password: "he194188@123",
  },
]

app.get('/', async (req, res) => {
    try {
        res.send({ message: 'Welcome to Practical Exam!' });
    } catch (error) {
        res.send({ error: error.message });
    }
});

//1.Viết api chung
app.get("/", (req, res) => {
  res.send("Welcome to JWT demo");
});

//2.Login api: cấp token
app.post("/api/auth/login", (req, res) => {
  const { username, password } = req.body || {};
  console.log("Username:", username);
  const user = users.find(
    (u) => u.username === username && u.password === password,
  );
  if (!user) {
    console.log("Login failed!");
    return res
      .status(401)
      .json({ message: "Tên đăng nhập hoặc mật khẩu không đúng" });
  }

  //tạo token
  const token = jwt.sign(
    {
      role: user.role,
    },
    JWT_SECRET,
    {
      subject: String(user.id),
      expiresIn: "1h",
    },
  );
  console.log("Login success: ", user.username);
  console.log("JWT created: ");
  return res.json({
    message: "Login successfully",
    tokenType: "Bearer",
    expiresIn: 300,
    accessToken: token,
  });
});
//Middleware: xác thực token
function authenticateToken(req, res, next) {
  const authHeader = req.headers.authorization;
  //kiểm tra header Authorization
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    console.log("Missing token");
    return res.status(401).json({
      message: "Access token require",
    });
  }
  //lấy token từ header
  const token = authHeader.slice("Bearer ".length);
  try {
    const payload = jwt.verify(token, JWT_SECRET);
    //lưu thông tin đã xác minh để routes
    req.user = {
      id: payload.sub,
      role: payload.role,
    };
    console.log("Token valid", req.user.id);
    next();
  } catch (error) {
    console.log("Token Invalid");
    return res.status(401).json({
      message: "Invalid or expired token",
    });
  }
}

const PORT = process.env.PORT || 9999;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));