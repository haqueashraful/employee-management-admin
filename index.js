const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");
require("dotenv").config();
const express = require("express");
const cors = require("cors");
const jwt = require("jsonwebtoken");
const cookieParser = require("cookie-parser");
const stripe = require("stripe")(process.env.STRIPE_SECRET_KEY);
const app = express();
const port = process.env.PORT || 5000;

const corsOptions = {
  origin: ["http://localhost:5173", "https://employeecare-ha.netlify.app"],
  credentials: true,
};

app.use(cors(corsOptions));
app.options("*", cors(corsOptions));
app.use(express.json());
app.use(cookieParser());

const uri = process.env.MONGO_URI;
const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  },
});

// collection related
const usersCollection = client.db("supermercy").collection("users");
// data sample
// {
//   "_id": "665b4b24e35bebf166b643c2",
//   "email": "123ashrafulhaque@gmail.com",
//   "name": "Ashraful Haque",
//   "role": "admin",
//   "bank_account_no": "4242424242424242",
//   "designation": "N/A",
//   "photo": "https://lh3.googleusercontent.com/a/ACg8ocKagLlEnu_0ZLwYahloX8ASDM1zI4dabcAGu1NJWPq9v3ZzD98B=s96-c",
//   "salary": 700,
//   "isVerified": true,
//   "isFired": false
// }

const workCollection = client.db("supermercy").collection("work");
// data sample
// {
// "_id" : "665c2a9e15327d312fdedd3c",
// "task":"Support",
// "hours":"5",
// "date":"2024-06-02",
// "userEmail":"88mohammedhaque@gmail.com",
// "name":"rana "
// }

const paymentCollection = client.db("supermercy").collection("payment");
// data sample
// {
// "_id":"665d88c6117a2f96bda9af13",
// "email":"88mohammedhaque@gmail.com",
// "salary":500,
// "name":"rana ",
// "photo":"https://i.ibb.co/PDmYMnP/bg3.jpg",
// "designation":"Sales Assistant",
// "bankAccountNo":"22342324332324",
// "role":"hr",
// "transactionId":"pi_3PNWuvJCEfzY5SAc0yKrwRve",
// "month":"June",
// "year":"2024",
// "status":"completed"
// }

const reviewCollection = client.db("supermercy").collection("reviews");
// data sample
// {
//   "_id": "665ee7f38df64cab744c54ec",
//   "name": "Robert Johnson",
//   "details": "This is by far the best service I have ever used. The customer support is outstanding, and the product itself is top-notch. I couldn't be happier!",
//   "rating": 5
// }

const contactCollection = client.db("supermercy").collection("contact");
// data sample
// {
//   "_id":"66639498c2a82b233bae4cae",
// "name":"MD. ASHRAFUL HAQUE",
// "email":"123ashrafulhaque@gmail.com",
// "message":"i am new here how can i reach you",
// "phone":"01856328101"
// }

async function run() {
  try {
    // await client.connect();

    // Middleware to verify token
    // Middleware to verify token
    const verifyToken = (req, res, next) => {
      const token = req.cookies.token;

      if (!token) {
        return res.status(401).json({ message: "Unauthorized" });
      }

      try {
        const decoded = jwt.verify(token, process.env.TOKEN_SECRET);
        req.user = decoded;
        next();
      } catch (error) {
        console.error("Error verifying JWT:", error);
        return res.status(403).json({ message: "Forbidden" });
      }
    };

    // Middleware to verify admin
    const verifyAdmin = async (req, res, next) => {
      try {
        const userEmail = req.user.email;
        const user = await usersCollection.findOne({ email: userEmail });
        if (!user || user.role !== "admin") {
          return res.status(403).json({ message: "Forbidden" });
        }

        next();
      } catch (error) {
        console.error("Error verifying admin:", error);
        res.status(500).json({ message: "Internal server error" });
      }
    };

    // Cookie options for token
    const cookieOptions = {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: process.env.NODE_ENV === "production" ? "none" : "strict",
    };

    // Create JWT token
    app.post("/jwt", async (req, res) => {
      try {
        const { email } = req.body;
        const payload = { email };
        const token = jwt.sign(payload, process.env.TOKEN_SECRET, {
          expiresIn: "1h",
        });

        res
          .cookie("token", token, cookieOptions)
          .status(200)
          .send({ token, message: "Token created successfully" });
      } catch (error) {
        console.error("Error creating JWT:", error);
        res.status(500).json({ message: "Error creating JWT" });
      }
    });

    // Clear JWT token
    app.post("/logout", async (req, res) => {
      try {
        res
          .clearCookie("token", cookieOptions)
          .status(200)
          .send({ success: true });
      } catch (error) {
        console.error("Error clearing JWT:", error);
        res.status(500).json({ message: "Error clearing JWT" });
      }
    });

    // Get all users
    app.get("/users", async (req, res) => {
      const result = await usersCollection.find().toArray();
      res.send(result);
    });

    // get all verified users
    app.get("/users/verified", verifyToken, verifyAdmin, async (req, res) => {
      const result = await usersCollection.find({ isVerified: true }).toArray();
      res.send(result);
    });

    // get by email
    app.get("/users/:email", async (req, res) => {
      const { email } = req.params;
      const result = await usersCollection.findOne({ email });
      res.send(result);
    });

    // get user is fire
    app.get("/users/fired/:email", async (req, res) => {
      const { email } = req.params;
      const result = await usersCollection.findOne({ email });
      if (result) {
        return res.send({ isFired: result.isFired });
      }
      res.send({ isFired: false });
    });

    // Create a new user
    app.post("/users", async (req, res) => {
      try {
        const { email, ...rest } = req.body;
        const existingUser = await usersCollection.findOne({ email });

        if (existingUser) {
          return res.status(409).send({ message: "User already exists" });
        }
        const userWithSalary = {
          email,
          ...rest,
          isVerified: false,
          isFired: false,
        };
        const result = await usersCollection.insertOne(userWithSalary);
        res.send({ message: "User created successfully", result });
      } catch (error) {
        console.error("Error creating user:", error);
        res.status(500).json({ message: "Error creating user" });
      }
    });

    app.patch("/users/:email", verifyToken, async (req, res) => {
      const { email } = req.params;
      const fieldsToUpdate = req.body;
      console.log(email, fieldsToUpdate);
      try {
        const result = await usersCollection.updateOne(
          { email },
          { $set: fieldsToUpdate }
        );

        if (result.modifiedCount === 0) {
          return res
            .status(404)
            .send({ message: "User not found or no changes made" });
        }

        res.send({ message: "User updated successfully", result });
      } catch (error) {
        console.error("Error updating user:", error);
        res.status(500).send({ message: "Internal Server Error" });
      }
    });

    // change verify
    app.patch("/users/verify/:email", verifyToken, async (req, res) => {
      const { email } = req.params;
      const result = await usersCollection.updateOne(
        { email },
        { $set: { isVerified: true } }
      );
      res.send(result);
    });

    // get role
    app.get("/users/role/:email", verifyToken, async (req, res) => {
      const { email } = req.params;
      const user = await usersCollection.findOne({ email });
      res.send({ role: user?.role });
    });

    // app.get("/users/role/:email", verifyToken, async (req, res) => {
    //   const { email } = req.params;
    //   try {
    //     const user = await usersCollection.findOne({ email });
    //     if (!user) {
    //       return res.status(404).send({ error: "User not found" });
    //     }

    //     if (user.role === 'hr') {
    //       return res.send({ role: user.isVerified ? 'hr' : false });
    //     } else if (user.role === 'employee' || user.role === 'admin') {
    //       return res.send({ role: user.role });
    //     } else {
    //       return res.send({ role: false });
    //     }
    //   } catch (error) {
    //     console.error("Error fetching user role:", error);
    //     res.status(500).send({ error: "Internal server error" });
    //   }
    // });

    // isAdmin Verify
    app.get("/users/admin/:email", verifyToken, async (req, res) => {
      const { email } = req.params;
      const user = await usersCollection.findOne({ email });
      const isAdmin = user?.role === "admin";
      res.send({ isAdmin });
    });

    // work apis
    app.get("/works", verifyToken, async (req, res) => {
      const { employee, month } = req.query;
      const query = {};
      if (employee && employee !== "null") {
        query.name = employee;
      }

      if (month && month !== "null") {
        const monthRegex = month.replace(/\//g, "\\/");
        query.date = { $regex: monthRegex };
      }
      try {
        const result = await workCollection.find(query).toArray();
        res.send(result);
      } catch (error) {
        console.error("Error fetching work records:", error);
        res.status(500).send("Internal Server Error");
      }
    });

    app.post("/works", verifyToken, async (req, res) => {
      try {
        const result = await workCollection.insertOne(req.body);
        res.send(result);
      } catch (error) {
        console.error("Error creating work:", error);
        res.status(500).json({ message: "Error creating work" });
      }
    });

    app.get("/works/:email", verifyToken, async (req, res) => {
      const { email } = req.params;
      const result = await workCollection
        .find({ userEmail: email })
        .sort({ createdAt: -1 })
        .toArray();
      res.send(result);
    });

    // Create a payment intent
    app.post("/create-payment-intent", async (req, res) => {
      const { amount } = req.body;

      try {
        const paymentIntent = await stripe.paymentIntents.create({
          amount,
          currency: "usd",
          payment_method_types: ["card"], // Allow card payments
        });

        res.send({
          clientSecret: paymentIntent.client_secret,
        });
      } catch (error) {
        res.status(400).send({ error: error.message });
      }
    });

    // Get all payments
    app.get("/payments", verifyToken, async (req, res) => {
      const result = await paymentCollection.find().toArray();
      res.send(result);
    });

    app.get("/payments/:email", verifyToken, async (req, res) => {
      const { email } = req.params;
      const result = await paymentCollection.find({ email }).toArray();
      res.send(result);
    });

    // Get user's payment of this month exists
    app.get("/payment/:email", verifyToken, async (req, res) => {
      try {
        const { email } = req.params;
        const { month, year } = req.query;
        if (!email) {
          return res.status(400).send({ error: "Email is required." });
        }

        if (!month || !year) {
          return res
            .status(400)
            .send({ error: "Month and year are required." });
        }

        const payments = await paymentCollection.find({ email }).toArray();

        const paymentExists = payments.some(
          (payment) =>
            payment.month.toLowerCase() === month.toLowerCase() &&
            payment.year === year
        );

        if (paymentExists) {
          res.send({ exists: true });
        } else {
          res.send({ exists: false });
        }
      } catch (error) {
        console.error("Failed to get payment:", error);
        res.status(500).send({ error: "Internal server error." });
      }
    });

    app.post("/payments", verifyToken, async (req, res) => {
      const payment = req.body;
      const result = await paymentCollection.insertOne(payment);
      res.send(result);
    });

    // contact us apis
    app.get("/contacts", verifyToken, async (req, res) => {
      const result = await contactCollection.find().toArray();
      res.send(result);
    });

    app.post("/contacts", async (req, res) => {
      const contact = req.body;
      const result = await contactCollection.insertOne(contact);
      res.send(result);
    });

    // review apis
    app.get("/reviews", async (req, res) => {
      const result = await reviewCollection.find().toArray();
      res.send(result);
    });

    app.post("/reviews", async (req, res) => {
      const review = req.body;
      const result = await reviewCollection.insertOne(review);
      res.send(result);
    });

    // Send a ping to confirm a successful connection
    app.get("/", (req, res) => {
      res.send("Hello World!");
    });
    // await client.db("admin").command({ ping: 1 });
    // console.log("Pinged your deployment. You successfully connected to MongoDB!");
  } finally {
    // Ensures that the client will close when you finish/error
    // await client.close();
  }
}

run().catch(console.dir);

app.listen(port, () => {
  console.log(`Server is running on port ${port}`);
});
