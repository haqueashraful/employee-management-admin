const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");
require("dotenv").config();
const express = require("express");
const cors = require("cors");
const jwt = require("jsonwebtoken");
const cookieParser = require("cookie-parser");

const app = express();
const port = process.env.PORT || 5000;

const corsOptions = {
  origin: ["http://localhost:5173", "*"],
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

async function run() {
  try {
    await client.connect();

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
      const user = req.user;

      if (user.role !== "admin") {
        return res.status(403).json({ message: "Forbidden" });
      }

      next();
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

        const userWithSalary = { email, ...rest, salary: 0, role: 'employee', isVerified: false, isFired: false };
        const result = await usersCollection.insertOne(userWithSalary);
        console.log(result)
        res.send(result);
      } catch (error) {
        console.error("Error creating user:", error);
        res.status(500).json({ message: "Error creating user" });
      }
    });


        // verify fired user
        app.patch("/users/fired/:email", async (req, res) => {
          const { email } = req.params;
          const result = await usersCollection.updateOne(
            { email },
            { $set: { isFired: true } }
          );
          res.send(result);
        });

        
        
    // Send a ping to confirm a successful connection
    app.get("/", (req, res) => {
      res.send("Hello World!");
    });
    await client.db("admin").command({ ping: 1 });
    console.log(
      "Pinged your deployment. You successfully connected to MongoDB!"
    );
  } finally {
    // Ensures that the client will close when you finish/error
    // await client.close();
  }
}

run().catch(console.dir);

app.listen(port, () => {
  console.log(`Server is running on port ${port}`);
});
