const express = require("express");
const cors = require("cors");
const jwt = require("jsonwebtoken");
const cookieParser = require("cookie-parser");
const { MongoClient, ServerApiVersion } = require('mongodb');
require("dotenv").config();
const app = express();
const port = process.env.PORT || 5000;

// middlewares
app.use(cors());
app.use(express.json());
app.use(cookieParser());


const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.fcmyfrv.mongodb.net/?retryWrites=true&w=majority`;

// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  }
});

async function run() {
  try {
    // Connect the client to the server	(optional starting in v4.7)
    // await client.connect();

    //db collection 
    const userCollection = client.db("inventoryDB").collection("users");
    const shopCollection = client.db("inventoryDB").collection("shops");


        //jwt related api
        app.post("/jwt", async (req, res) => {
          const user = req.body;
          const token = jwt.sign(user, process.env.ACCESS_TOKEN_SECRET, {
            expiresIn: "1h",
          });
          res.send({ token });
        });
    
        //middleware
        const verifyToken = (req, res, next) => {
          console.log("inside verify token", req.headers.authorization);
          if (!req.headers.authorization) {
            return res.status(401).send({ message: "unauthorized access" });
          }
          const token = req.headers.authorization.split(" ")[1];
          jwt.verify(token, process.env.ACCESS_TOKEN_SECRET, (err, decoded) => {
            if (err) {
              return res.status(401).send({ message: "unauthorized access" });
            }
            req.decoded = decoded;
            next();
          });
        };
    

    //post method  add the user in the database
    // insert email if user doesn't exists:
    app.post("/users", async (req, res) => {
      const user = req.body;
      const query = { email: user.email };
      const existingUser = await userCollection.findOne(query);
      if (existingUser) {
        return res.send({ message: "user exists", insertedId: null });
      }
      const result = await userCollection.insertOne(user);
      console.log(result);
      res.send(result);
    });

     //Api for the shop collection
    //post method for the shop
    app.post("/shops", async (req, res) => {
      const shop = req.body;
      const userEmail = shop.email; // Assuming 'email' identifies the user
    
      const existingShop = await shopCollection.findOne({ email: userEmail });
    
      if (existingShop) {
        return res.status(400).json({ message: "User already has a shop" });
      }
    
      // If the user doesn't have a shop, proceed with creating the shop
      const result = await shopCollection.insertOne(shop);
      console.log(result);
    
      res.send(result);
    });




    // Send a ping to confirm a successful connection
    await client.db("admin").command({ ping: 1 });
    console.log("Pinged your deployment. You successfully connected to MongoDB!");
  } finally {
    // Ensures that the client will close when you finish/error
  
  }
}
run().catch(console.dir);



app.get('/', (req, res) => {
    res.send('Inventory Management System Running .....')
  })
  
  app.listen(port, () => {
    console.log(`Inventory Management System Server is running on port ${port}`)
  })