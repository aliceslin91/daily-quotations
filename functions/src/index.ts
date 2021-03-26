import * as functions from "firebase-functions";
import * as admin from "firebase-admin";
import * as express from "express";
import * as bodyParser from "body-parser";
import * as seedrandom from "seedrandom";

admin.initializeApp(functions.config().firebase);
const db = admin.firestore();

const app = express();
const main = express();

main.use("/api/v1", app);
main.use(bodyParser.json());

export const webApi = functions.https.onRequest(main);

/* GET Endpoints */
app.get("/hello", (req, res) => {
  res.send("world");
});

app.get("/quotes", async (request, response) => {
  try {
    const quoteQuerySnapshot = await db.collection("quotes").get();
    const quotes: any[] = [];
    quoteQuerySnapshot.forEach((doc) => {
      quotes.push({
        id: doc.id,
        data: doc.data(),
      });
    });

    response.json(quotes);
  } catch (error) {
    response.status(500).send(error);
  }
});

app.get("/quotes/:id", async (request, response) => {
  try {
    const quoteId = request.params.id;

    if (!quoteId) throw new Error("Quote ID is required");

    const quote = await db.collection("quotes").doc(quoteId).get();

    if (!quote.exists) {
      throw new Error("Quote doesn't exist.");
    }

    response.json({
      id: quote.id,
      data: quote.data(),
    });
  } catch (error) {
    response.status(500).send(error);
  }
});

app.get("/daily-quote", async (request, response) => {
  try {
    const quoteIdsRef = await db.doc("quotesMetaData/ids").get();
    if (!quoteIdsRef.exists) {
      throw new Error("Quote IDs don't exist.");
    }

    // Generate a seed based on the day
    const today = new Date();
    const dd = today.getDate();
    const mm = today.getMonth() + 1;
    const yyyy = today.getFullYear();

    const seed = `${yyyy}${mm}${dd}`;

    const quoteIds = quoteIdsRef.data()?.docs || [];
    const random = seedrandom(seed);
    const randomIndex = Math.floor(random() * quoteIds.length);

    const quote = await db
      .collection("quotes")
      .doc(quoteIds[randomIndex])
      .get();

    if (!quote.exists) {
      throw new Error("Quote doesn't exist.");
    }

    response.json({
      id: quote.id,
      data: quote.data(),
    });
  } catch (error) {
    response.status(500).send(error);
  }
});

/* POST Endpoints */
app.post("/quotes", async (request, response) => {
  try {
    const { quote, author_primary, author_secondary } = request.body;
    const data = {
      quote,
      author_primary,
      author_secondary,
      tags: [],
    };
    const quoteRef = await db.collection("quotes").add(data);
    const newQuote = await quoteRef.get();

    // update the meta data collection
    const quoteIdsRef = await db.doc("quotesMetaData/ids");
    await quoteIdsRef.update({
      docs: admin.firestore.FieldValue.arrayUnion(quoteRef.id),
    });

    response.json({
      id: quoteRef.id,
      data: newQuote.data(),
    });
  } catch (error) {
    response.status(500).send(error);
  }
});

/* DELETE Endpoints */
app.delete("/quotes/:id", async (request, response) => {
  try {
    const quoteId = request.params.id;

    if (!quoteId) throw new Error("id is blank");

    await db.collection("quotes").doc(quoteId).delete();

    // update the meta data collection
    const quoteIdsRef = await db.doc("quotesMetaData/ids");
    await quoteIdsRef.update({
      docs: admin.firestore.FieldValue.arrayRemove(quoteId),
    });

    response.json({
      id: quoteId,
    });
  } catch (error) {
    response.status(500).send(error);
  }
});

// // Start writing Firebase Functions
// // https://firebase.google.com/docs/functions/typescript
//
// export const helloWorld = functions.https.onRequest((request, response) => {
//   functions.logger.info("Hello logs!", {structuredData: true});
//   response.send("Hello from Firebase!");
// });
