require('dotenv').config();
const express = require('express');
const { MongoClient, ObjectID } = require('mongodb');
const { HttpError } = require('./HttpError');
const { errorHandler } = require('./error-handler');

const { MONGODB_CONNECTION_URL, MONGODB_DATABASE } = process.env;

const app = express();

async function main() {
  const connection = await MongoClient.connect(MONGODB_CONNECTION_URL, { useUnifiedTopology: true });
  const database = connection.db(MONGODB_DATABASE);

  const usersCollection = database.collection('users');
  const logsCollection = database.collection('custom_logs');

  const wrapper = (func) => async (req, res, next) => {
    try {
      await func(req, res);
    } catch (e) {
      errorHandler(logsCollection)(e, req, res, next);
    }
  };

  app.use(express.json());

  app.use(async (req, res, next) => {
    await logsCollection.insertOne({
      url: req.url,
      data: { ...req.body || {}, ...req.query },
      method: req.method,
      headers: { ...req.headers },
    });

    next();
  });

  app.get('/users', wrapper(async (req, res) => {
    const users = await usersCollection.find({}).toArray();

    res.send({ users });
  }));

  app.post('/users', wrapper(async (req, res) => {
    if (!req.body || Object.keys(req.body).length === 0) {
      throw new HttpError(400, 'Bad request params');
    }

    await usersCollection.insertOne(req.body);

    res.status(201).send();
  }));

  app.patch('/users/:userId', wrapper(async (req, res) => {
    const userId = ObjectID(req.params.userId);

    const user = await usersCollection.findOne({ _id: userId });

    if (!user) throw new HttpError(404, 'User not found');

    await usersCollection.updateOne({ _id: userId }, { $set: { ...req.body } });

    res.status(201).send();
  }));

  app.delete('/users/:userId', wrapper(async (req, res) => {
    const userId = ObjectID(req.params.userId);

    const user = await usersCollection.findOne({ _id: userId });

    if (!user) throw new HttpError(404, 'User not found');

    await usersCollection.deleteOne({ _id: userId });

    res.send();
  }));

  app.use(errorHandler(logsCollection));

  app.listen(process.env.PORT, err => {
    err ? console.error(err) : console.info(`Server started at ${process.env.PORT}`);
  });
}

main().catch(console.error);
