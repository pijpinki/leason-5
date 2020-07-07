const { HttpError } = require('./HttpError');

const errorHandler = (logsCollection) => async (err, req, res, next) => {
  if (!err) {
    return res.status(404).send({ message: 'Page not found' });
  }

  await logsCollection.insertOne({
    errorMessage: err.message,
  });

  if (err instanceof HttpError) {
    return res.status(err.statusCode).send({ message: err.message });
  }

  return res.status(500).send({ message: err.message });
};

exports.errorHandler = errorHandler;
