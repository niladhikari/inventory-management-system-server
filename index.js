const express = require("express");
const cors = require("cors");
const jwt = require("jsonwebtoken");
const cookieParser = require("cookie-parser");
const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");
require("dotenv").config();
const stripe = require("stripe")(process.env.STIPE_SECRET_KEY);
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
  },
});

async function run() {
  try {
    // Connect the client to the server	(optional starting in v4.7)
    // await client.connect();

    //db collection
    const userCollection = client.db("inventoryDB").collection("users");
    const shopCollection = client.db("inventoryDB").collection("shops");
    const productCollection = client.db("inventoryDB").collection("products");
    const paymentCollection = client.db("inventoryDB").collection("payments");
    const reviewsCollection = client.db("inventoryDB").collection("reviews");
    const cartCollection = client.db("inventoryDB").collection("carts");
    const salesCollection = client.db("inventoryDB").collection("sales");

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

    //sale collection
    app.get("/sales", verifyToken, async (req, res) => {
      const result = await salesCollection.find().toArray();
      res.send(result);
    });

    // cart collection
    app.post("/carts", async (req, res) => {
      try {
        const product = req.body;
    
        // Fetch the product details from the product collection
        const productDetails = await productCollection.findOne({
          _id: new ObjectId(product.id)
        });
    
        if (!productDetails) {
          return res.status(404).json({ message: "Product not found" });
        }
    
        // Check if the product quantity is greater than 0
        if (productDetails.quantity > 0) {
          const result = await cartCollection.insertOne(product);
          return res.status(200).json({ message: "Product added to cart successfully", result });
        } else {
          return res.status(400).json({ message: "Product quantity is 0, cannot be added to cart" });
        }
      } catch (error) {
        return res.status(500).json({ message: "Error adding product to cart", error: error.message });
      }
    });

    app.get("/carts", verifyToken, async (req, res) => {
      const email = req.query.email;
      const query = { email: email };
      const result = await cartCollection.find(query).toArray();
      res.send(result);
    });

   // Assuming you have the necessary imports and configurations

   app.patch("/carts/:email",verifyToken, async (req, res) => {
    const email = req.params.email;
  
    try {
      const findProducts = await cartCollection.find({ email }).toArray();
      const salesData = []; // Array to store sales data
  
      const currentTime = new Date(); // Get current date and time
  
      for (const singleProduct of findProducts) {
        const product = await productCollection.findOne({
          _id: new ObjectId(singleProduct.id)
        });
  
        if (product) {
          await productCollection.updateOne(
            { _id: product._id },
            {
              $set: {
                quantity: product.quantity - 1,
                saleCount: product.saleCount + 1
              }
            }
          );
  
          // Add sales information to the salesData array
          salesData.push({
            productId: product._id,
            productName: product.name,
            profit: product.profit,
            sellingPrice: product.sellingPrice,
            production: product.production,
            quantitySold: 1,
            saleDate: currentTime,
        
             // Add sale date and time
          });
  
          await cartCollection.deleteOne({
            _id: new ObjectId(singleProduct._id)
          });
        }
      }
  
      // Insert sales data into the Sales Collection
      await salesCollection.insertMany(salesData);
  
      res.send({ status: true, message: "Checkout successful" });
    } catch (error) {
      res.status(500).send({ status: false, message: "Checkout failed" });
    }
  });


    
    //jwt related api
    app.post("/jwt", async (req, res) => {
      const user = req.body;
      const token = jwt.sign(user, process.env.ACCESS_TOKEN_SECRET, {
        expiresIn: "1h",
      });
      res.send({ token });
    });

   

    //post method  add the user in the database
    // insert email if user doesn't exists:
    app.post("/users", async (req, res) => {
      const user = req.body;
      const query = { email: user.email };
      const existingUser = await userCollection.findOne(query);
      if (existingUser) {
        return res.send({ message: "user exists", data: existingUser });
      }
      const result = await userCollection.insertOne(user);
      const useExist = await userCollection.findOne({ email: user?.email });
      console.log(result);
      res.send(useExist);
    });

    //Api for the shop collection

    //get operation for the reviews data pass the client side
    app.get("/reviews", async (req, res) => {
      const result = await reviewsCollection.find().toArray();
      res.send(result);
    });

    //post method for the shop
    app.post("/shops", async (req, res) => {
      const shop = req.body;
      const userEmail = shop.email; // Assuming 'email' identifies the user

      const existingShop = await shopCollection.findOne({ email: userEmail });

      if (existingShop) {
        return res
          .status(400)
          .json({ message: "User already has a shop", data: existingShop });
      }

      // If the user doesn't have a shop, proceed with creating the shop
      try {
        const result = await shopCollection.insertOne(shop);
        const user = await userCollection.findOne({ email: shop?.email });
        console.log(93, user.email);

        if (user && user.crateShop === false) {
          const filter = { _id: user?._id };
          const updatedDoc = {
            $set: {
              crateShop: true,
              roll: "manager",
            },
          };

          await userCollection.updateOne(filter, updatedDoc);
          const updatedUser = await userCollection.findOne({
            email: user?.email,
          });
          res.send({ UserData: updatedUser, insertResult: result });
        } else {
          res.send({ insertResult: result });
        }
      } catch (error) {
        console.error("Error:", error);
        // Handle error appropriately, perhaps send an error response
        res.status(500).send("An error occurred.");
      }
    });

    app.get("/singleUser/:email",  async (req, res) => {
      const email = req.params.email;
      const query = { email: email };
      const results = await userCollection.findOne(query);
      if (results?.roll == "admin") {
        const price = await paymentCollection.find().toArray();
        const priceArray = price.map((price) => price.price);
        const totalAmount = priceArray.reduce((acc, price) => acc + price, 0);
        const updateLimit = {
          $set: {
            price: totalAmount,
          },
        };
        await userCollection.updateOne({ email: email }, updateLimit);
        const results = await userCollection.findOne(query);
        res.send(results);
      } else {
        res.send(results);
      }
    });

    app.get('/users',async(req,res)=>{
      const result = await shopCollection.find().toArray();
      res.send(result);
    })

    app.get("/shops", async (req, res) => {
      const result = await shopCollection.find().toArray();
      res.send(result);
    });



    app.get("/shops/:email", verifyToken, async (req, res) => {
      const email = req.params.email;
      const query = { email: email };
      const results = await shopCollection.findOne(query);
      res.send(results);
    });

    //for the product collection api
    app.post("/products", async (req, res) => {
      const cartItem = req.body;
      const filter = { email: cartItem.email };
      const shopInfo = await shopCollection.findOne(filter);
      if (parseInt(shopInfo.limit) > 0) {
        const result = await productCollection.insertOne(cartItem);

        const updateLimit = {
          $set: {
            limit: parseInt(shopInfo.limit) - 1,
          },
        };
        await shopCollection.updateOne(filter, updateLimit);
        res.send(result);
      } else {
        const result = "limit is over";
        res.send(result);
      }
    });

    app.get("/products", verifyToken, async (req, res) => {
      const result = await productCollection.find().toArray();
      res.send(result);
    });

    app.get("/products/:email",verifyToken, async (req, res) => {
      const email = req.params.email;
      const query = { email: email };
      const results = await productCollection.find(query).toArray();
      res.send(results);
    });

    //get operation for update the menu data pass the db
    app.get("/myProducts/:id",verifyToken, async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const result = await productCollection.findOne(query);
      res.send(result);
    });

    app.get("/productSale",verifyToken, async (req, res) => {
      const result = await productCollection.find().toArray();
      res.send(result);
    });

    //patch operation for update the items value and pass the database
    app.patch("/products/:id", async (req, res) => {
      const item = req.body;
      const id = req.params.id;
      const filter = { _id: new ObjectId(id) };
      const updatedDoc = {
        $set: {
          name: item.name,
          location: item.location,
          quantity: item.quantity,
          production: item.production,
          profit: item.profit,
          discount: item.discount,
          description: item.description,
          image: item.image,
        },
      };
      const result = await productCollection.updateOne(filter, updatedDoc);
      res.send(result);
    });

    app.delete("/products/:id", verifyToken, async (req, res) => {
      try {
        const id = req.params.id;
        const query = { _id: new ObjectId(id) };
        const deletedProduct = await productCollection.findOne(query);

        if (deletedProduct) {
          const filter = { email: deletedProduct.email };
          const shopInfo = await shopCollection.findOne(filter);

          const updateLimit = {
            $set: {
              limit: parseInt(shopInfo.limit) + 1,
            },
          };

          await shopCollection.updateOne(filter, updateLimit);
          const result = await productCollection.deleteOne(query);
          res.send(result);
        } else {
          res.status(404).send("Product not found");
        }
      } catch (error) {
        res.status(500).send("An error occurred");
      }
    });

    // payment intent
    // this is using for the post the client secret
    app.post("/create-payment-intent", async (req, res) => {
      const { price } = req.body;
      const amount = parseInt(price * 100);
      const paymentIntent = await stripe.paymentIntents.create({
        amount: amount,
        currency: "usd",
        payment_method_types: ["card"],
      });
      res.send({
        clientSecret: paymentIntent.client_secret,
      });
    });

    app.post("/payments", async (req, res) => {
      const payment = req.body;
      const paymentResult = await paymentCollection.insertOne(payment);
      console.log(paymentResult);
      if (paymentResult.insertedId) {
        const productFind = await shopCollection.findOne({
          email: payment?.email,
        });
        const updateLimit = {
          $set: {
            limit: parseInt(productFind.limit) + payment.limit,
          },
        };
        console.log(264, productFind.limit);

        const result2 = await shopCollection.updateOne(
          { email: productFind.email },
          updateLimit
        );
        console.log(result2);
      }
      res.send({ paymentResult });
    });

    // Send a ping to confirm a successful connection
    await client.db("admin").command({ ping: 1 });
    console.log(
      "Pinged your deployment. You successfully connected to MongoDB!"
    );
  } finally {
    // Ensures that the client will close when you finish/error
  }
}
run().catch(console.dir);

app.get("/", (req, res) => {
  res.send("Inventory Management System Running .....");
});

app.listen(port, () => {
  console.log(`Inventory Management System Server is running on port ${port}`);
});
