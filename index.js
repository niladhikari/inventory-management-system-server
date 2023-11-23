const express = require("express");
const cors = require("cors");
const cookieParser = require("cookie-parser");
require("dotenv").config();
const app = express();
const port = process.env.PORT || 5000;

// middlewares
app.use(cors());
app.use(express.json());
app.use(cookieParser());


app.get('/', (req, res) => {
    res.send('Inventory Management System Running .....')
  })
  
  app.listen(port, () => {
    console.log(`Inventory Management System Server is running on port ${port}`)
  })